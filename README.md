# My Shop — online store with M-Pesa STK push + secret admin panel

A small online shop: customers browse items, add to cart, pick a delivery
location, and pay with M-Pesa (STK push). You manage everything — products,
prices, stock, delivery locations, other admins — from a hidden admin panel.

No coding tools needed to run it: it's plain HTML/CSS/JavaScript. The only
"backend" is Firebase (free) for the database/photos/login, and two small
Netlify Functions for the parts that need a secret key (M-Pesa, creating admins).

---

## 1. What each file does

```
index.html                     Customer-facing shop page
css/style.css                  Dark theme for the customer side (gold accent)
js/firebase-config.js          <-- YOU paste your Firebase keys here (only file to edit for setup)
js/shop.js                     Loads products, cart, checkout, delivery dropdown, QR code, STK push call

admin-7f3k9x2q/login.html      Secret admin login page (username + password)
admin-7f3k9x2q/dashboard.html  Secret admin dashboard (products, delivery, orders, logs, admins)
css/admin.css                  Dark theme for the admin side (teal accent, visually different)
js/admin.js                    All admin logic: product CRUD, image upload, delivery list,
                                order feed, logs, add-admin, change password, out-of-stock alerts

netlify/functions/mpesa-stkpush.js   Server-side function that calls Safaricom's Daraja API
netlify/functions/create-admin.js    Server-side function that safely creates a new admin login

netlify.toml                   Tells Netlify where the site & functions live (no build step)
package.json                   Lists the one Node package the functions need (firebase-admin)
firestore.rules                Database security rules — paste into Firebase console
storage.rules                  Photo storage security rules — paste into Firebase console
```

**How the pieces talk to each other:**
`index.html`/`dashboard.html` load Firebase's SDK directly from a CDN (`<script>`
tags — no `npm install` needed to just *run* the site). They read/write data
straight to your Firestore database in the browser. The two things that need a
*secret* key (M-Pesa credentials, creating new admin logins) go through a
Netlify Function instead, since anything in browser code can be read by anyone.

---

## 2. One-time setup

### A. Create a Firebase project (free)
1. Go to https://console.firebase.google.com → **Add project** → give it any name.
2. In the project, go to **Build > Firestore Database** → Create database →
   start in production mode → pick a location close to you.
3. Go to **Build > Storage** → Get started (accept defaults) — this is where
   product photos are stored.
4. Go to **Build > Authentication** → Get started → enable **Email/Password**
   sign-in method (this is what powers admin login, even though admins type a
   "username" — see the comment at the top of `login.html` for why).
5. Go to **Project settings (gear icon) > General**, scroll to "Your apps",
   click the `</>` web icon, register an app (no need for hosting), and copy
   the `firebaseConfig` object it gives you.
6. Paste those values into `js/firebase-config.js`.
7. Go to **Firestore Database > Rules**, replace the contents with everything
   in `firestore.rules` in this project, click **Publish**.
8. Go to **Storage > Rules**, do the same with `storage.rules`.

### B. Create your first admin account
Firestore rules only let admins be *created* through the Netlify function
(for security) — but for your very first admin, you can add it by hand once:
1. Firebase Console → **Authentication > Users > Add user** → email:
   `youradmin@yourshop.local`, any password.
2. Firebase Console → **Firestore Database > Start collection** → collection
   ID `admins` → document ID = the UID shown next to the user you just
   created in Authentication → add a field `username` (string) = `youradmin`.
3. Now on the login page you can log in with username `youradmin` and that
   password. From then on, use the dashboard's "Add another admin" — it
   handles both steps automatically.

### C. M-Pesa (Daraja) setup — do this when you're ready
1. Register at https://developer.safaricom.co.ke, create an app to get a
   **Consumer Key** and **Consumer Secret** (sandbox first, for testing).
2. Get the sandbox **Shortcode** (174379) and **Passkey** from the Daraja
   docs' "Lipa na M-Pesa Online" test credentials page.
3. You'll set these as environment variables in Netlify (step 3 below), not
   in the code — never paste real keys into files you push to GitHub.

---

## 3. Run it on your own computer first

No build step is required — but browsers block some Firebase features when
you just double-click an HTML file (`file://` URLs), so serve it locally:

```bash
cd my-shop
npx serve .
```

Then open the URL it prints (usually `http://localhost:3000`). The admin page
is at `http://localhost:3000/admin-7f3k9x2q/login.html` — note this folder
name is your "secret" — rename it to anything you like before going live.

The M-Pesa button won't fully work locally unless you also run
`netlify dev` (below), since `/.netlify/functions/...` only exists once
Netlify Functions are running.

To test the whole thing including the functions locally:
```bash
npm install -g netlify-cli
npm install
netlify dev
```

---

## 4. Put it on GitHub

```bash
cd my-shop
git init
git add .
git commit -m "Initial shop site"
```
Then create an empty repository on https://github.com/new (don't add a
README there), and push:
```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

## 5. Deploy to Netlify (for testing, free)

1. Go to https://app.netlify.com → **Add new site > Import an existing project**.
2. Choose GitHub, authorize it, and pick the repo you just pushed.
3. Build settings: leave **Build command** empty and **Publish directory** as `.`
   (Netlify will read `netlify.toml`, which already sets this).
4. Click **Deploy site**. In a minute you'll get a URL like
   `https://random-name-123.netlify.app`.
5. Add your secrets: **Site configuration > Environment variables > Add a variable**:
   - `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`,
     `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` (M-Pesa)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — from Firebase Console > Project
     settings > Service accounts > Generate new private key, paste the whole
     JSON file's content as the value (used only by `create-admin.js`, never
     exposed to browsers).
6. **Trigger deploy** again after adding env vars so the functions pick them up.
7. Every time you `git push`, Netlify redeploys automatically — that's the
   whole workflow for testing changes.

---

## 6. About the "secret" admin page

Two separate protections are stacked here, and it's worth knowing the
difference:
- **The folder name** (`admin-7f3k9x2q`) isn't linked from anywhere on the
  public site and isn't in any sitemap, so a normal visitor will never stumble
  onto it. Rename it to your own random string before going live, and only
  share that link with yourself.
- **The real security** is the login + Firestore rules — even if someone
  guessed the URL, they can't see or change anything without a valid admin
  login, because `firestore.rules` blocks writes (and most reads) from anyone
  who isn't in the `admins` collection. Don't rely on the secret URL alone.

## 7. Adding the QR code to a poster/flyer

The homepage already shows a QR code linking to itself in the footer. If you
want a downloadable image version for printing, open the live site, right
-click the QR code, and save the image — or generate one at
https://www.qr-code-generator.com using your Netlify URL.

## 8. Common tweaks

- **Your WhatsApp/call number**: edit `OWNER_PHONE_INTL` at the top of `js/shop.js`.
- **Hide an item without deleting it**: uncheck "Visible to customers" in the
  products table — `shop.js` already filters these out on the customer side.
- **Currency**: search `js/shop.js` for `KES` and replace if needed.
