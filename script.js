
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKWE4Wyh_N_pt12iDlXx_garwZHFKRcE19DRoKSa2Cb_v3KoSmcQcJXRS2MdrfB7Bso-DqSXdINSt/pub?gid=0&single=true&output=csv";
const STORE_LOCATION = { lat: -12.053850, lng: -77.031550 };
const FREE_SHIPPING_THRESHOLD = 400; // S/ 400 para gratis
const SHIPPING_RATE_PER_KM = 2; // S/ 2 por KM
let CATALOG_DB = [];
let state_cart = JSON.parse(localStorage.getItem('jst_cart')) || [];
let mainMap = null;
let userMarker = null;
window.onload = () => {
    initGoldDust();
    fetchProducts();
    refreshCartUI();
};
async function fetchProducts() {
    try {
        const res = await fetch(GOOGLE_SHEET_URL);
        const data = await res.text();
        const rows = data.split('\n').slice(1);
        CATALOG_DB = rows.map(row => {
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return {
                id: cols[0]?.trim(),
                name: cols[1]?.replace(/"/g, '').trim(),
                price: parseFloat(cols[2]),
                cat: cols[3]?.trim(),
                img: cols[4]?.trim(),
                stock: parseInt(cols[5]) || 0
            };
        }).filter(p => p.id);
        renderCatalog();
        renderPills();
    } catch (e) { console.error("Error Sheet:", e); }
}
function renderCatalog() {
    const grid = document.getElementById('main-grid');
    const term = document.getElementById('master-search').value.toLowerCase();
    const filtered = CATALOG_DB.filter(p => p.name.toLowerCase().includes(term));
    
    grid.innerHTML = filtered.map(p => `
        <div class="card-item">
            <div class="card-img-container"><img src="${p.img}" loading="lazy"></div>
            <h4 style="font-size:0.85rem; height:35px; overflow:hidden;">${p.name}</h4>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <b style="font-size:1.1rem;">S/ ${p.price.toFixed(2)}</b>
                <button onclick="addToCart('${p.id}')" style="background:var(--gold); border:none; color:white; width:35px; height:35px; border-radius:10px;"><i class="fas fa-plus"></i></button>
            </div>
        </div>
    `).join('');
}
function toggleCart(show) {
    document.getElementById('side-cart').classList.toggle('open', show);
}
function addToCart(id) {
    const p = CATALOG_DB.find(x => x.id === id);
    const exist = state_cart.find(x => x.id === id);
    if(exist) exist.qty++; else state_cart.push({...p, qty: 1});
    saveCart();
    showToast();
}
function saveCart() {
    localStorage.setItem('jst_cart', JSON.stringify(state_cart));
    refreshCartUI();
}
function refreshCartUI() {
    const badge = document.getElementById('cart-badge');
    const totalQty = state_cart.reduce((a,b) => a + b.qty, 0);
    badge.innerText = totalQty;
    badge.style.display = totalQty > 0 ? 'flex' : 'none';
    document.getElementById('cart-items-list').innerHTML = state_cart.map((item, idx) => `
        <div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">
            <img src="${item.img}" style="width:50px; height:50px; border-radius:10px; object-fit:cover;">
            <div style="flex:1;">
                <div style="font-size:0.8rem; font-weight:600;">${item.name}</div>
                <div style="color:var(--gold); font-weight:800;">S/ ${(item.price * item.qty).toFixed(2)}</div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; background:#f1f5f9; padding:5px 10px; border-radius:10px;">
                <span onclick="updateQty(${idx},-1)" style="cursor:pointer">-</span>
                <span style="font-weight:800">${item.qty}</span>
                <span onclick="updateQty(${idx},1)" style="cursor:pointer">+</span>
            </div>
        </div>
    `).join('');
    calculateTotals();
}
function updateQty(idx, n) {
    state_cart[idx].qty += n;
    if(state_cart[idx].qty <= 0) state_cart.splice(idx, 1);
    saveCart();
}
function calculateTotals() {
    const subtotal = state_cart.reduce((a,b) => a + (b.price * b.qty), 0);
    const km = parseFloat(document.getElementById('form-km').value) || 0;
    
    let shipCost = (subtotal >= FREE_SHIPPING_THRESHOLD) ? 0 : (km * SHIPPING_RATE_PER_KM);
    if(shipCost > 0 && shipCost < 7) shipCost = 7; // Mínimo base sugerido
    document.getElementById('step1-total').innerText = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('final-shipping').innerText = shipCost === 0 ? "GRATIS" : `S/ ${shipCost.toFixed(2)}`;
    document.getElementById('final-total').innerText = `S/ ${(subtotal + shipCost).toFixed(2)}`;
    const prog = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
    document.getElementById('ship-progress-bar').style.width = `${prog}%`;
    document.getElementById('ship-msg-text').innerText = subtotal >= FREE_SHIPPING_THRESHOLD ? "¡Envío Gratis!" : `Faltan S/ ${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)} para envío gratis`;
}
// MAP LOGIC
function goToStep(n) {
    const cart = document.getElementById('side-cart');
    if(n === 2) {
        cart.classList.add('step-2');
        setTimeout(initMap, 400);
    } else {
        cart.classList.remove('step-2');
    }
}
function initMap() {
    if(mainMap) { mainMap.invalidateSize(); return; }
    mainMap = L.map('order-map', { zoomControl: false }).setView([STORE_LOCATION.lat, STORE_LOCATION.lng], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mainMap);
    
    const icon = L.divIcon({
        html: `<div style="background:var(--dark); width:30px; height:30px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:3px solid white; display:flex; align-items:center; justify-content:center;"><i class="fas fa-home" style="transform:rotate(45deg); color:white; font-size:12px;"></i></div>`,
        className: '', iconSize: [30,30], iconAnchor: [15,30]
    });
    userMarker = L.marker([STORE_LOCATION.lat, STORE_LOCATION.lng], { icon, draggable: true }).addTo(mainMap);
    userMarker.on('dragend', () => {
        const p = userMarker.getLatLng();
        updateLocationData(p.lat, p.lng);
    });
}
async function updateLocationData(lat, lng) {
    const dist = getDistance(STORE_LOCATION.lat, STORE_LOCATION.lng, lat, lng);
    document.getElementById('form-km').value = dist.toFixed(2);
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        document.getElementById('form-address').value = data.display_name.split(',').slice(0,3).join(',');
    } catch(e) {}
    
    calculateTotals();
    validateForm();
}
function getDistance(la1, lo1, la2, lo2) {
    const R = 6371;
    const dLat = (la2-la1)*Math.PI/180;
    const dLon = (lo2-lo1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function getCurrentLocation() {
    navigator.geolocation.getCurrentPosition(p => {
        const coords = [p.coords.latitude, p.coords.longitude];
        mainMap.setView(coords, 17);
        userMarker.setLatLng(coords);
        updateLocationData(coords[0], coords[1]);
    });
}
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
    let msg = `*NUEVO PEDIDO JSTORE-R*\n\n`;
    state_cart.forEach(i => msg += `• ${i.name} (x${i.qty})\n`);
    msg += `\n*TOTAL:* ${total}\n*CLIENTE:* ${name}\n*DIRECCIÓN:* ${addr}`;
    window.open(`https://wa.me/51932508670?text=${encodeURIComponent(msg)}`);
}
function showToast() {
    const t = document.getElementById('toast-notify');
    t.style.bottom = "30px";
    setTimeout(() => t.style.bottom = "-100px", 2000);
}
function initGoldDust() {
    const canvas = document.getElementById('gold-dust-layer');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array(20).fill().map(() => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        v: Math.random() * 0.5 + 0.2
    }));
    function animate() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = "rgba(199, 106, 58, 0.2)";
        particles.forEach(p => {
            p.y -= p.v; if(p.y < 0) p.y = canvas.height;
            ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI*2); ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();
}