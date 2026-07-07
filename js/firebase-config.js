/*
  FIREBASE CONFIG
  ----------------
  This is the ONLY file where you paste your own Firebase project keys.
  Get these values from: Firebase Console > Project Settings > General > "Your apps" > Web app.

  Firebase is used for:
  - Firestore    -> the database (products, delivery locations, admins, logs)
  - Storage      -> stores the product photos you upload (no image URLs needed)
  - Authentication -> admin login (username/password)

  It's free on the "Spark" plan for a small shop like this.
*/

const firebaseConfig = {
  apiKey: "AIzaSyCvS4A-1_jjDn4oPIyn6QAQKYPWKdBekB4",
  authDomain: "my-shop-46ada.firebaseapp.com",
  projectId: "my-shop-46ada",
  storageBucket: "my-shop-46ada.firebasestorage.app",
  messagingSenderId: "921855443588",
  appId: "1:921855443588:web:428aa6cc796efafadaf8d1"
};

// Initialize Firebase (uses the compat SDK loaded via <script> tags in the HTML files,
// which keeps this project script-tag-only — no build step, no npm install needed to run it).
firebase.initializeApp(firebaseConfig);

// These three are used everywhere else in the project:
const db = firebase.firestore();       // the database
const storage = firebase.storage();    // image uploads
const auth = firebase.auth();          // admin login



//
// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyCvS4A-1_jjDn4oPIyn6QAQKYPWKdBekB4",
//   authDomain: "my-shop-46ada.firebaseapp.com",
//   projectId: "my-shop-46ada",
//   storageBucket: "my-shop-46ada.firebasestorage.app",
//   messagingSenderId: "921855443588",
//   appId: "1:921855443588:web:428aa6cc796efafadaf8d1"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
//