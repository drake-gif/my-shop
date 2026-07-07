/*
  ADMIN.JS — everything the DASHBOARD does. Loaded only on the secret admin pages.

  Sections below, in order:
  1. Auth guard — kick out anyone not logged in as an admin.
  2. Tab switching (just shows/hides the right <section>).
  3. Products — add / edit price & stock / toggle visibility / delete / image upload.
  4. Delivery locations — the list customers see in their dropdown.
  5. Orders — read-only feed of what's been ordered.
  6. Logs — checkout attempts + out-of-stock events; admin can delete them.
  7. Admins — change own password, add a new admin (via Netlify Function).
  8. Out-of-stock watcher — flips the "!" badge and logs an event when stock hits 0.
*/

// ====== 1. AUTH GUARD ======
auth.onAuthStateChanged(user=>{
  if(!user){
    window.location.href = "login.html";
  } else {
    boot();
  }
});
document.getElementById("logoutBtn").addEventListener("click", ()=> auth.signOut());

// ====== 2. TAB SWITCHING ======
document.querySelectorAll("nav.admin-nav button[data-tab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(s=>s.style.display="none");
    document.getElementById("tab-"+btn.dataset.tab).style.display="block";
    document.querySelectorAll("nav.admin-nav button[data-tab]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
  });
});

function boot(){
  watchProducts();
  watchDeliveryLocations();
  watchOrders();
  watchLogs();
  watchAdmins();
}

// ====== 3. PRODUCTS ======
document.getElementById("addProductBtn").addEventListener("click", async ()=>{
  const name = document.getElementById("pName").value.trim();
  const price = Number(document.getElementById("pPrice").value);
  const stock = Number(document.getElementById("pStock").value);
  const file = document.getElementById("pImage").files[0];
  if(!name || !price){ alert("Enter a name and price."); return; }

  let imageUrl = "";
  if(file){
    // Upload the actual photo file to Firebase Storage — customers never see a URL field,
    // you just pick the photo from your device.
    const ref = storage.ref(`products/${Date.now()}_${file.name}`);
    await ref.put(file);
    imageUrl = await ref.getDownloadURL();
  }

  await db.collection("products").add({
    name, price, stock, imageUrl, visible: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("pName").value="";
  document.getElementById("pPrice").value="";
  document.getElementById("pStock").value="";
  document.getElementById("pImage").value="";
});

function watchProducts(){
  db.collection("products").orderBy("createdAt","desc").onSnapshot(snap=>{
    const rows = snap.docs.map(d=>({id:d.id, ...d.data()}));
    document.getElementById("productsTable").innerHTML = rows.map(p=>`
      <tr>
        <td><img class="thumb" src="${p.imageUrl||''}"></td>
        <td>${p.name}</td>
        <td><input type="number" value="${p.price}" style="width:90px" data-price="${p.id}"></td>
        <td><input type="number" value="${p.stock}" style="width:70px" data-stock="${p.id}"></td>
        <td><input type="checkbox" ${p.visible!==false?'checked':''} data-visible="${p.id}"></td>
        <td><button class="small" data-save="${p.id}">Save</button>
            <button class="danger" data-del="${p.id}">Delete</button></td>
      </tr>`).join("");

    rows.forEach(p=>checkStock(p)); // out-of-stock watcher

    document.querySelectorAll("[data-save]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.save;
        const price = Number(document.querySelector(`[data-price="${id}"]`).value);
        const stock = Number(document.querySelector(`[data-stock="${id}"]`).value);
        const visible = document.querySelector(`[data-visible="${id}"]`).checked;
        db.collection("products").doc(id).update({price, stock, visible});
      });
    });
    document.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if(confirm("Delete this item?")) db.collection("products").doc(btn.dataset.del).delete();
      });
    });
  });
}

// ====== 4. DELIVERY LOCATIONS ======
document.getElementById("addLocationBtn").addEventListener("click", async ()=>{
  const val = document.getElementById("newLocation").value.trim();
  if(!val) return;
  const ref = db.collection("settings").doc("deliveryLocations");
  const doc = await ref.get();
  const list = doc.exists ? doc.data().list||[] : [];
  if(!list.includes(val)){
    await ref.set({list:[...list, val]});
  }
  document.getElementById("newLocation").value="";
});
function watchDeliveryLocations(){
  db.collection("settings").doc("deliveryLocations").onSnapshot(doc=>{
    const list = doc.exists ? doc.data().list||[] : [];
    document.getElementById("locationsTable").innerHTML = list.map(loc=>`
      <tr><td>${loc}</td><td><button class="danger small" data-loc="${loc}">Remove</button></td></tr>`).join("");
    document.querySelectorAll("[data-loc]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const ref = db.collection("settings").doc("deliveryLocations");
        const doc = await ref.get();
        const list = (doc.data().list||[]).filter(l=>l!==btn.dataset.loc);
        await ref.set({list});
      });
    });
  });
}

// ====== 5. ORDERS ======
function watchOrders(){
  db.collection("orders").orderBy("createdAt","desc").limit(100).onSnapshot(snap=>{
    document.getElementById("ordersTable").innerHTML = snap.docs.map(d=>{
      const o = d.data();
      const time = o.createdAt ? o.createdAt.toDate().toLocaleString() : "-";
      return `<tr><td>${time}</td><td>KES ${o.total}</td><td>${o.deliveryLocation}</td><td>${o.phone}</td><td>${o.status}</td></tr>`;
    }).join("");
  });
}

// ====== 6. LOGS ======
function watchLogs(){
  db.collection("logs").orderBy("createdAt","desc").limit(200).onSnapshot(snap=>{
    const hasOutOfStock = snap.docs.some(d=>d.data().type==="out_of_stock");
    document.getElementById("outOfStockBadge").style.display = hasOutOfStock ? "inline" : "none";

    document.getElementById("logsTable").innerHTML = snap.docs.map(d=>{
      const l = d.data();
      const time = l.createdAt ? l.createdAt.toDate().toLocaleString() : "-";
      const details = JSON.stringify({...l, createdAt:undefined, type:undefined});
      return `<tr><td>${time}</td><td>${l.type}</td><td>${details}</td>
              <td><button class="small" data-logdel="${d.id}">Delete</button></td></tr>`;
    }).join("");

    document.querySelectorAll("[data-logdel]").forEach(btn=>{
      btn.addEventListener("click", ()=> db.collection("logs").doc(btn.dataset.logdel).delete());
    });
  });
}
document.getElementById("clearLogsBtn").addEventListener("click", async ()=>{
  if(!confirm("Delete ALL logs? This cannot be undone.")) return;
  const snap = await db.collection("logs").get();
  const batch = db.batch();
  snap.docs.forEach(d=>batch.delete(d.ref));
  await batch.commit();
});

// ====== 7. ADMINS ======
document.getElementById("changePasswordBtn").addEventListener("click", async ()=>{
  const pw = document.getElementById("newPassword").value;
  if(pw.length < 6) return alert("Password must be at least 6 characters.");
  try{
    await auth.currentUser.updatePassword(pw);
    alert("Password updated.");
    document.getElementById("newPassword").value="";
  }catch(e){ alert("Could not update password: " + e.message); }
});

document.getElementById("addAdminBtn").addEventListener("click", async ()=>{
  const username = document.getElementById("newAdminUser").value.trim().toLowerCase();
  const password = document.getElementById("newAdminPass").value;
  if(!username || password.length < 6) return alert("Username + password (6+ chars) required.");

  // We never create other Firebase Auth users directly from the browser (doing so would
  // log the CURRENT admin out and log in as the new one). Instead we call a Netlify
  // Function that uses the Firebase Admin SDK on the server, with your login token
  // proving you're already an admin. See netlify/functions/create-admin.js
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch("/.netlify/functions/create-admin", {
    method:"POST",
    headers:{"Content-Type":"application/json", "Authorization":"Bearer "+idToken},
    body: JSON.stringify({username, password})
  });
  const data = await res.json();
  if(data.ok){
    alert("Admin created.");
    document.getElementById("newAdminUser").value="";
    document.getElementById("newAdminPass").value="";
  } else {
    alert("Failed: " + data.error);
  }
});

function watchAdmins(){
  db.collection("admins").onSnapshot(snap=>{
    document.getElementById("adminsTable").innerHTML = snap.docs.map(d=>{
      const a = d.data();
      return `<tr><td>${a.username}</td><td>${a.createdAt ? a.createdAt.toDate().toLocaleDateString() : ''}</td></tr>`;
    }).join("");
  });
}

// ====== 8. OUT-OF-STOCK WATCHER ======
const notifiedIds = new Set(); // avoid spamming a log entry every snapshot
function checkStock(product){
  if((product.stock ?? 0) <= 0 && !notifiedIds.has(product.id)){
    notifiedIds.add(product.id);
    db.collection("logs").add({
      type:"out_of_stock", productId: product.id, productName: product.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Optional: browser push-style notification if the admin allows it
    if(window.Notification && Notification.permission === "granted"){
      new Notification("Out of stock", {body: product.name + " is out of stock"});
    }
  }
  if((product.stock ?? 0) > 0){
    notifiedIds.delete(product.id);
  }
}
if(window.Notification && Notification.permission === "default"){
  Notification.requestPermission();
}
