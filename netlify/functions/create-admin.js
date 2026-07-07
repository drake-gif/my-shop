/*
  CREATE-ADMIN.JS — Netlify Function.

  Creating a new Firebase Auth user has to happen on a server (via the Firebase ADMIN
  SDK), because doing it from the browser would sign the current admin out. This
  function also double-checks that whoever is calling it is ALREADY a logged-in admin
  before it lets them create another one — otherwise anyone could call this URL directly
  and create themselves an admin account.

  Required Netlify environment variables:
    FIREBASE_SERVICE_ACCOUNT_JSON  -> paste the ENTIRE contents of the service account
      JSON file you download from Firebase Console > Project Settings > Service Accounts
      > Generate new private key. Paste it as a single line/string value.
*/

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ ok:false, error:"Method not allowed" }) };
  }

  try {
    // 1. Verify the caller is a real, currently-logged-in admin.
    const authHeader = event.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) return { statusCode: 200, body: JSON.stringify({ ok:false, error:"Not authenticated" }) };
    const decoded = await admin.auth().verifyIdToken(idToken);

    const callerDoc = await admin.firestore().collection("admins").doc(decoded.uid).get();
    if (!callerDoc.exists) {
      return { statusCode: 200, body: JSON.stringify({ ok:false, error:"Caller is not an admin" }) };
    }

    // 2. Create the new admin's Firebase Auth account (username -> fake email, as in login.html).
    const { username, password } = JSON.parse(event.body);
    const email = `${username}@yourshop.local`;
    const newUser = await admin.auth().createUser({ email, password });

    // 3. Record them in the "admins" Firestore collection so the app knows who's an admin.
    await admin.firestore().collection("admins").doc(newUser.uid).set({
      username,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { statusCode: 200, body: JSON.stringify({ ok:true }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok:false, error: err.message }) };
  }
};
