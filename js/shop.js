/*
  SHOP.JS — everything the CUSTOMER side does.
  Loads after firebase-config.js, so `db` and `storage` already exist.

  What this file does, top to bottom:
  1. Reads products from Firestore (collection "products") and draws the grid.
  2. Reads delivery locations (collection "settings", doc "deliveryLocations") for the dropdown.
  3. Keeps the cart in localStorage (just on this customer's own browser — this is fine
     to store locally since it's only "what's in my basket right now", not sensitive data).
  4. Sends the order to Firestore ("orders") and calls the Netlify Function that triggers
     the M-Pesa STK push.
  5. Builds the WhatsApp / call buttons from one phone number you set below.
  6. Draws a QR code that points at this website's own URL.
*/

// ====== 1. YOUR CONTACT NUMBER (used for WhatsApp + Call buttons) ======
const OWNER_PHONE_INTL = "254712345678"; // <-- change to your number, format 254XXXXXXXXX (no +, no leading 0)

// ---------- State ----------
let cart = JSON.parse(localStorage.getItem("cart") || "[]");

// ---------- DOM refs ----------
const grid = document.getElementById("grid");
const cartDrawer = document.getElementById("cartDrawer");
const cartItemsEl = document.getElementById("cartItems");
const cartCountEl = document.getElementById("cartCount");
const overlay = document.getElementById("overlay");
const deliverySelect = document.getElementById("deliverySelect");

// ====== 2. LOAD PRODUCTS ======
function renderProducts(products){
  grid.innerHTML = "";
  products.forEach(p => {
    const out = (p.stock ?? 0) <= 0;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.imageUrl || ''}" alt="${p.name}">
      <div class="body">
        <h3>${p.name}</h3>
        <span class="price">KES ${Number(p.price).toLocaleString()}</span>
        <span class="stock-badge ${out ? 'out':'in'}">${out ? 'Out of stock' : 'In stock'}</span>
        <button class="add" ${out ? 'disabled':''} data-id="${p.id}">Add to cart</button>
      </div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll("button.add").forEach(btn=>{
    btn.addEventListener("click", ()=> addToCart(btn.dataset.id, products));
  });
}

function loadProducts(){
  // onSnapshot = live updates. If admin changes stock/price, this page updates itself,
  // no refresh needed — this is also how "out of stock" appears instantly.
  db.collection("products").orderBy("createdAt","desc").onSnapshot(snap=>{
    const products = snap.docs
      .map(d => ({id:d.id, ...d.data()}))
      .filter(p => p.visible !== false); // admin's "Visible to customers" checkbox
    renderProducts(products);
    window._allProducts = products; // cache for cart lookups
  });
}

// ====== 3. CART ======
function addToCart(id, products){
  const product = products.find(p=>p.id===id);
  if(!product || (product.stock ?? 0) <= 0) return;
  const existing = cart.find(i=>i.id===id);
  if(existing){ existing.qty++; } else { cart.push({id, name:product.name, price:product.price, qty:1}); }
  saveCart();
}
function saveCart(){
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}
function renderCart(){
  cartCountEl.textContent = cart.reduce((n,i)=>n+i.qty,0);
  cartItemsEl.innerHTML = cart.map(i=>`
    <div class="cart-line">
      <span>${i.name} x${i.qty}</span>
      <span>KES ${(i.price*i.qty).toLocaleString()}
        <button class="ghost" style="width:auto;padding:2px 8px;margin:0 0 0 8px" data-remove="${i.id}">✕</button>
      </span>
    </div>`).join("") || "<p>Your cart is empty.</p>";
  cartItemsEl.querySelectorAll("[data-remove]").forEach(b=>{
    b.addEventListener("click", ()=>{
      cart = cart.filter(i=>i.id!==b.dataset.remove);
      saveCart();
    });
  });
}

// ====== 4. DELIVERY LOCATIONS DROPDOWN ======
function loadDeliveryLocations(){
  db.collection("settings").doc("deliveryLocations").onSnapshot(doc=>{
    const list = doc.exists ? (doc.data().list || []) : [];
    deliverySelect.innerHTML = `<option value="">Select delivery location</option>` +
      list.map(loc=>`<option value="${loc}">${loc}</option>`).join("");
  });
}

// ====== 5. CHECKOUT + STK PUSH ======
async function checkout(){
  const location = deliverySelect.value;
  const phone = document.getElementById("payerPhone").value.trim();
  if(!location) return alert("Please choose a delivery location.");
  if(cart.length===0) return alert("Your cart is empty.");
  if(!/^2547\d{8}$/.test(phone)) return alert("Enter phone as 2547XXXXXXXX for M-Pesa.");

  const total = cart.reduce((n,i)=>n+i.price*i.qty,0);

  // Save the order first so you have a record even if payment fails/cancels.
  const orderRef = await db.collection("orders").add({
    items: cart, total, deliveryLocation: location, phone,
    status: "awaiting_payment",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Log the checkout attempt (this is one of the "logs" the admin can view/delete).
  db.collection("logs").add({
    type: "checkout_attempt", orderId: orderRef.id, phone, total,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Call the Netlify Function — it holds your secret M-Pesa keys server-side and
  // talks to Safaricom's Daraja API. See netlify/functions/mpesa-stkpush.js.
  try{
    const res = await fetch("/.netlify/functions/mpesa-stkpush", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ phone, amount: total, orderId: orderRef.id })
    });
    const data = await res.json();
    if(data.ok){
      alert("Check your phone and enter your M-Pesa PIN to complete payment.");
      cart = []; saveCart(); toggleCart(false);
    } else {
      alert("Payment request failed: " + (data.error || "unknown error"));
    }
  }catch(e){
    alert("Could not reach payment service. Is the STK push function set up yet?");
  }
}

// ====== 6. QR CODE ======
function drawQr(){
  const box = document.getElementById("qrBox");
  if(box && window.QRCode){
    new QRCode(box, { text: window.location.origin, width:140, height:140 });
  }
}

// ====== WhatsApp / Call buttons ======
function wireContactButtons(){
  document.getElementById("waBtn").href = `https://wa.me/${OWNER_PHONE_INTL}?text=${encodeURIComponent("Hi, I'm interested in an item from your shop")}`;
  document.getElementById("callBtn").href = `tel:+${OWNER_PHONE_INTL}`;
}

// ====== UI wiring ======
function toggleCart(open){
  cartDrawer.classList.toggle("open", open);
  overlay.classList.toggle("show", open);
}
document.getElementById("cartBtn").addEventListener("click", ()=>toggleCart(true));
overlay.addEventListener("click", ()=>toggleCart(false));
document.getElementById("closeCart").addEventListener("click", ()=>toggleCart(false));
document.getElementById("checkoutBtn").addEventListener("click", checkout);

// ====== boot ======
loadProducts();
loadDeliveryLocations();
renderCart();
wireContactButtons();
window.addEventListener("load", drawQr);
