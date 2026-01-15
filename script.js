
// JSTORER CORE ENGINE V2.5
const CONFIG = {
    SHEET_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKWE4Wyh_N_pt12iDlXx_garwZHFKRcE19DRoKSa2Cb_v3KoSmcQcJXRS2MdrfB7Bso-DqSXdINSt/pub?gid=0&single=true&output=csv",
    STORE_COORDS: { lat: -12.053850, lng: -77.031550 },
    FREE_SHIP_LIMIT: 400,
    KM_RATE: 2, // S/ 2.00 por Kilómetro
    WHATSAPP: "51932508670"
};
let CATALOG = [];
let cart = JSON.parse(localStorage.getItem('jst_cart')) || [];
let mainMap = null;
let pinMarker = null;
window.onload = async () => {
    initGoldDust();
    await loadProducts();
    renderPills();
    refreshCartUI();
};
// DATOS
async function loadProducts() {
    try {
        const res = await fetch(CONFIG.SHEET_URL);
        const data = await res.text();
        const rows = data.split('\n').slice(1);
        CATALOG = rows.map(row => {
            const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return {
                id: c[0]?.trim(),
                name: c[1]?.replace(/"/g, '').trim(),
                price: parseFloat(c[2]),
                cat: c[3]?.trim(),
                img: c[4]?.trim(),
                stock: parseInt(c[5]) || 0,
                desc: c[6]?.replace(/"/g, '').trim()
            };
        }).filter(p => p.id);
        renderGallery();
    } catch (e) { console.error("Error cargando Sheet", e); }
}
function renderGallery() {
    const grid = document.getElementById('main-grid');
    const term = document.getElementById('master-search').value.toLowerCase();
    const filtered = CATALOG.filter(p => p.name.toLowerCase().includes(term));
    
    grid.innerHTML = filtered.map(p => `
        <div class="card-item">
            <div class="card-img-container" onclick="openQuickView('${p.id}')">
                <img src="${p.img}" loading="lazy">
            </div>
            <div style="flex:1;">
                <span style="font-size:0.65rem; color:var(--gold); font-weight:800; text-transform:uppercase;">${p.cat}</span>
                <h4 style="font-size:0.9rem; margin:4px 0;">${p.name}</h4>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <span class="price-tag">S/ ${p.price.toFixed(2)}</span>
                <button class="btn-add" onclick="addToCart('${p.id}')"><i class="fas fa-plus"></i></button>
            </div>
        </div>
    `).join('');
}
// CARRITO
function toggleCart(show) { document.getElementById('side-cart').classList.toggle('open', show); }
function addToCart(id) {
    const p = CATALOG.find(x => x.id === id);
    const exist = cart.find(x => x.id === id);
    if(exist) exist.qty++; else cart.push({...p, qty: 1});
    updateCart();
    showToast("Producto agregado");
}
function updateCart() {
    localStorage.setItem('jst_cart', JSON.stringify(cart));
    refreshCartUI();
}
function refreshCartUI() {
    const badge = document.getElementById('cart-badge');
    const totalQty = cart.reduce((a,b) => a + b.qty, 0);
    badge.innerText = totalQty;
    badge.style.display = totalQty > 0 ? 'flex' : 'none';
    document.getElementById('cart-items-list').innerHTML = cart.map((item, idx) => `
        <div style="display:flex; gap:12px; margin-bottom:15px; align-items:center;">
            <img src="${item.img}" style="width:55px; height:55px; border-radius:12px; object-fit:cover;">
            <div style="flex:1;">
                <h5 style="font-size:0.85rem; margin:0;">${item.name}</h5>
                <b style="color:var(--gold);">S/ ${(item.price * item.qty).toFixed(2)}</b>
            </div>
            <div style="display:flex; gap:8px; align-items:center; background:#f1f5f9; padding:5px 10px; border-radius:10px; font-size:0.8rem;">
                <span onclick="modQty(${idx},-1)" style="cursor:pointer; font-weight:800;">-</span>
                <span style="font-weight:800;">${item.qty}</span>
                <span onclick="modQty(${idx},1)" style="cursor:pointer; font-weight:800;">+</span>
            </div>
        </div>
    `).join('');
    
    calculateTotals();
    renderSuggestions();
}
function modQty(idx, n) {
    cart[idx].qty += n;
    if(cart[idx].qty <= 0) cart.splice(idx, 1);
    updateCart();
}
function calculateTotals() {
    const subtotal = cart.reduce((a,b) => a + (b.price * b.qty), 0);
    const km = parseFloat(document.getElementById('form-km').value) || 0;
    
    let shipping = (subtotal >= CONFIG.FREE_SHIP_LIMIT) ? 0 : (km * CONFIG.KM_RATE);
    if(shipping > 0 && shipping < 8) shipping = 8; // Mínimo sugerido
    document.getElementById('step1-total').innerText = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('final-subtotal').innerText = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('final-shipping').innerText = shipping === 0 ? "GRATIS" : `S/ ${shipping.toFixed(2)}`;
    document.getElementById('final-total').innerText = `S/ ${(subtotal + shipping).toFixed(2)}`;
    const prog = Math.min(100, (subtotal / CONFIG.FREE_SHIP_LIMIT) * 100);
    document.getElementById('ship-progress-bar').style.width = `${prog}%`;
    document.getElementById('ship-msg-text').innerText = subtotal >= CONFIG.FREE_SHIP_LIMIT ? "¡Envío Gratis!" : `Faltan S/ ${(CONFIG.FREE_SHIP_LIMIT - subtotal).toFixed(2)} para envío gratis`;
}
// MAPA & GEOLOCALIZACIÓN
function goToStep(n) {
    const s = document.getElementById('side-cart');
    if(n === 2) {
        s.classList.add('step-2');
        setTimeout(initMap, 450);
    } else {
        s.classList.remove('step-2');
    }
}
function initMap() {
    if(mainMap) { mainMap.invalidateSize(); return; }
    mainMap = L.map('order-map', { zoomControl: false }).setView([CONFIG.STORE_COORDS.lat, CONFIG.STORE_COORDS.lng], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mainMap);
    
    const uberIcon = L.divIcon({
        html: `<div style="background:var(--dark); width:32px; height:32px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:3px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.2);"><i class="fas fa-home" style="transform:rotate(45deg); color:white; font-size:14px;"></i></div>`,
        className: '', iconSize: [32,32], iconAnchor: [16,32]
    });
    pinMarker = L.marker([CONFIG.STORE_COORDS.lat, CONFIG.STORE_COORDS.lng], { icon: uberIcon, draggable: true }).addTo(mainMap);
    pinMarker.on('dragend', () => {
        const pos = pinMarker.getLatLng();
        updateMapData(pos.lat, pos.lng);
    });
}
async function updateMapData(lat, lng) {
    const dist = getDist(CONFIG.STORE_COORDS.lat, CONFIG.STORE_COORDS.lng, lat, lng);
    document.getElementById('form-km').value = dist.toFixed(2);
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        // Limpiamos dirección para que no sea infinita
        const parts = data.display_name.split(',');
        document.getElementById('form-address').value = parts.slice(0,3).join(',');
    } catch(e) { console.log("Geocoding failed"); }
    
    calculateTotals();
    validateForm();
}
function getDist(la1, lo1, la2, lo2) {
    const R = 6371;
    const dLa = (la2-la1)*Math.PI/180;
    const dLo = (lo2-lo1)*Math.PI/180;
    const a = Math.sin(dLa/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function getCurrentLocation() {
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => {
        const lat = p.coords.latitude; const lng = p.coords.longitude;
        mainMap.setView([lat, lng], 17);
        pinMarker.setLatLng([lat, lng]);
        updateMapData(lat, lng);
    });
}
// FINALIZACIÓN
function validateForm() {
    const n = document.getElementById('form-name').value;
    const a = document.getElementById('form-address').value;
    const p = document.getElementById('form-phone').value;
    const btn = document.getElementById('btn-finish');
    if(n.length > 2 && a.length > 5 && p.length >= 9) btn.classList.add('active');
    else btn.classList.remove('active');
}
function sendOrder() {
    const name = document.getElementById('form-name').value;
    const addr = document.getElementById('form-address').value;
    const total = document.getElementById('final-total').innerText;
    const km = document.getElementById('form-km').value;
    
    let text = `*HOLA JSTORE-R, QUIERO PEDIR:*\n\n`;
    cart.forEach(i => text += `— ${i.name} (x${i.qty})\n`);
    text += `\n*RESUMEN:*`;
    text += `\nSubtotal: ${document.getElementById('final-subtotal').innerText}`;
    text += `\nEnvío: ${document.getElementById('final-shipping').innerText} (${km} km)`;
    text += `\n*TOTAL:* ${total}`;
    text += `\n\n*DATOS DE ENTREGA:*`;
    text += `\n👤 Cliente: ${name}\n📍 Dirección: ${addr}\n📱 Celular: ${document.getElementById('form-phone').value}`;
    
    window.open(`https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(text)}`);
}
// UI UTILS
function openQuickView(id) {
    const p = CATALOG.find(x => x.id === id);
    if(!p) return;
    document.getElementById('qv-img').src = p.img;
    document.getElementById('qv-cat').innerText = p.cat;
    document.getElementById('qv-name').innerText = p.name;
    document.getElementById('qv-price').innerText = `S/ ${p.price.toFixed(2)}`;
    document.getElementById('qv-desc').innerText = p.desc || "Sin descripción disponible.";
    document.getElementById('quick-view-modal').classList.add('active');
}
function closeQuickView() { document.getElementById('quick-view-modal').classList.remove('active'); }
function showToast(msg) {
    const t = document.getElementById('toast-notify');
    t.innerText = msg; t.style.bottom = "30px";
    setTimeout(() => t.style.bottom = "-100px", 2500);
}
function toggleFaq(el) { el.classList.toggle('active'); }
function renderPills() {
    const cats = ["Todas", ...new Set(CATALOG.map(p => p.cat).filter(Boolean))];
    document.getElementById('category-pills-render').innerHTML = cats.map(c => 
        `<div class="pill-item" onclick="filterByCat(this, '${c}')">${c}</div>`
    ).join('');
}
function filterByCat(el, c) {
    document.querySelectorAll('.pill-item').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    const grid = document.getElementById('main-grid');
    const filtered = (c === "Todas") ? CATALOG : CATALOG.filter(p => p.cat === c);
    // Renderizado simple para filtro
    grid.innerHTML = filtered.map(p => `
        <div class="card-item">
            <div class="card-img-container" onclick="openQuickView('${p.id}')"><img src="${p.img}"></div>
            <div style="flex:1;"><h4 style="font-size:0.9rem; margin:4px 0;">${p.name}</h4></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <span class="price-tag">S/ ${p.price.toFixed(2)}</span>
                <button class="btn-add" onclick="addToCart('${p.id}')"><i class="fas fa-plus"></i></button>
            </div>
        </div>`).join('');
}
function renderSuggestions() {
    const ids = cart.map(x => x.id);
    const sug = CATALOG.filter(p => !ids.includes(p.id) && p.stock > 0).slice(0, 4);
    if(sug.length > 0 && cart.length > 0) {
        document.getElementById('suggestions-area').style.display = 'block';
        document.getElementById('suggestions-render').innerHTML = sug.map(s => `
            <div class="mini-sug" onclick="addToCart('${s.id}')" style="min-width:110px; cursor:pointer;">
                <img src="${s.img}" style="width:100%; height:80px; object-fit:cover; border-radius:10px;">
                <div style="font-size:0.7rem; font-weight:800; margin-top:5px;">S/ ${s.price}</div>
            </div>`).join('');
    } else { document.getElementById('suggestions-area').style.display = 'none'; }
}
function initGoldDust() {
    const cvs = document.getElementById('gold-dust-layer');
    const ctx = cvs.getContext('2d');
    cvs.width = window.innerWidth; cvs.height = window.innerHeight;
    const parts = Array(25).fill().map(() => ({ x: Math.random()*cvs.width, y: Math.random()*cvs.height, s: Math.random()*0.4+0.1 }));
    function anim() {
        ctx.clearRect(0,0,cvs.width,cvs.height);
        ctx.fillStyle = "rgba(199, 106, 58, 0.3)";
        parts.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI*2); ctx.fill();
            p.y -= p.s; if(p.y < 0) p.y = cvs.height;
        });
        requestAnimationFrame(anim);
    }
    anim();
}