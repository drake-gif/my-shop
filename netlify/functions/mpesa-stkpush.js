/*
  MPESA-STKPUSH.JS — Netlify Function (runs on Netlify's servers, not in the browser).

  Why this has to be a server function and not plain browser JS:
  M-Pesa's Daraja API needs a "Consumer Key/Secret" that must stay secret. Anything in
  browser JS can be read by anyone viewing page source, so this call happens here instead,
  using environment variables you set in the Netlify dashboard (Site settings > Environment
  variables) — never hard-code them in this file.

  Required environment variables (set these in Netlify, see README):
    MPESA_CONSUMER_KEY
    MPESA_CONSUMER_SECRET
    MPESA_SHORTCODE        (your Paybill/Till number, or 174379 for the Daraja sandbox)
    MPESA_PASSKEY
    MPESA_CALLBACK_URL     (a URL Safaricom can reach to tell you payment succeeded —
                             usually another Netlify Function, e.g. /.netlify/functions/mpesa-callback)

  You said you'll plug in the real keys later — this file is ready to go, just fill the
  Netlify env vars in when you have them. Until then STK requests will fail gracefully.
*/

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ ok:false, error:"Method not allowed" }) };
  }

  try {
    const { phone, amount, orderId } = JSON.parse(event.body);

    const {
      MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET,
      MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL
    } = process.env;

    if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
      return { statusCode: 200, body: JSON.stringify({ ok:false, error:"M-Pesa keys not configured yet. Add them in Netlify env vars." }) };
    }

    // 1. Get an OAuth access token from Safaricom.
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
    const tokenRes = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: `Basic ${auth}` }
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Build the STK push request.
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(MPESA_SHORTCODE + MPESA_PASSKEY + timestamp).toString("base64");

    const stkRes = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: MPESA_CALLBACK_URL,
        AccountReference: orderId,
        TransactionDesc: "Shop order " + orderId
      })
    });
    const stkData = await stkRes.json();

    return { statusCode: 200, body: JSON.stringify({ ok: true, data: stkData }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok:false, error: err.message }) };
  }
};
