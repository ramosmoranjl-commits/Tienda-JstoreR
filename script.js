
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKWE4Wyh_N_pt12iDlXx_garwZHFKRcE19DRoKSa2Cb_v3KoSmcQcJXRS2MdrfB7Bso-DqSXdINSt/pub?gid=0&single=true&output=csv";
const STORE_LOCATION = { lat: -12.053850, lng: -77.031550 };
let CATALOG_DB = [];
let state_cart = JSON.parse(localStorage.getItem('jst_master_cart')) || [];
const FREE_SHIPPING_THRESHOLD = 500;
const SHIPPING_RATE_PER_KM = 1.5;
let map, userMarker;
window.onload = async () => {
    await fetchProducts();
    refreshCartUI();
    initMap();
};
async function fetchProducts() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const text = await response.text();
        const rows = text.split('\n').slice(1);
        CATALOG_DB = rows.map(row => {
            const c = row.split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/);
            return { id: c[0], name: c[1]?.replace(/\"/g,""), cat: c[2], price: parseFloat(c[3]), img: c[4], desc: c[5] };
        });
        renderProducts(CATALOG_DB);
    } catch (e) { console.error("Error cargando productos", e); }
}
function renderProducts(items) {
    const grid = document.getElementById('main-grid');
    grid.innerHTML = items.map(p => `
        <div class="product-card" onclick="openQuickView('${p.id}')">
            <img src="${p.img}" class="product-image">
            <div class="product-info">
                <p style="font-size:0.7rem; color:var(--jst-accent-gold); font-weight:800; text-transform:uppercase;">${p.cat}</p>
                <h3 style="font-size:1rem; margin:5px 0;">${p.name}</h3>
                <p style="font-weight:800;">S/ ${p.price.toFixed(2)}</p>
            </div>
        </div>
    `).join('');
}
function toggleCart(open) {
    document.getElementById('side-cart').classList.toggle('open', open);
    if(open) goToStep(1);
}
function addToCart(id) {
    const p = CATALOG_DB.find(x => x.id == id);
    const item = state_cart.find(x => x.id == id);
    if(item) item.qty++;
    else state_cart.push({...p, qty: 1});
    updateCartStorage();
    showToast("¡Agregado con éxito!");
}
function updateCartStorage() {
    localStorage.setItem('jst_master_cart', JSON.stringify(state_cart));
    refreshCartUI();
}
function refreshCartUI() {
    const list = document.getElementById('cart-items-list');
    const badge = document.getElementById('cart-count-badge');
    const total_s1 = document.getElementById('step1-total');
    
    let subtotal = 0;
    let count = 0;
    
    list.innerHTML = state_cart.map(item => {
        subtotal += item.price * item.qty;
        count += item.qty;
        return `
            <div style="display:flex; gap:15px; margin-bottom:20px; align-items:center;">
                <img src="${item.img}" style="width:60px; height:60px; object-fit:cover; border-radius:10px;">
                <div style="flex:1;">
                    <h4 style="font-size:0.9rem;">${item.name}</h4>
                    <p style="font-size:0.8rem; color:var(--jst-slate);">S/ ${item.price.toFixed(2)} x ${item.qty}</p>
                </div>
                <button onclick="changeQty('${item.id}', -1)" style="border:none; background:#f1f5f9; width:25px; height:25px; border-radius:5px;">-</button>
                <button onclick="changeQty('${item.id}', 1)" style="border:none; background:#f1f5f9; width:25px; height:25px; border-radius:5px;">+</button>
            </div>
        `;
    }).join('');
    badge.innerText = count;
    total_s1.innerText = `S/ ${subtotal.toFixed(2)}`;
    updateShippingProgress(subtotal);
}
function changeQty(id, delta) {
    const item = state_cart.find(x => x.id == id);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0) state_cart = state_cart.filter(x => x.id !== id);
    updateCartStorage();
}
function updateShippingProgress(subtotal) {
    const bar = document.getElementById('ship-progress-bar');
    const msg = document.getElementById('ship-msg-text');
    const perc = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
    bar.style.width = perc + "%";
    msg.innerText = subtotal >= FREE_SHIPPING_THRESHOLD ? "¡Tienes ENVÍO GRATIS!" : `Faltan S/ ${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)} para envío gratis`;
}
function goToStep(n) {
    document.querySelectorAll('.cart-step').forEach((s, i) => s.classList.toggle('active', i === (n-1)));
    if(n === 2) {
        document.getElementById('side-cart').classList.add('step2-active');
        calculateFinals();
    } else {
        document.getElementById('side-cart').classList.remove('step2-active');
    }
}
function calculateFinals() {
    const sub = state_cart.reduce((a, b) => a + (b.price * b.qty), 0);
    const km = parseFloat(document.getElementById('form-km').value) || 0;
    const ship = sub >= FREE_SHIPPING_THRESHOLD ? 0 : (km * SHIPPING_RATE_PER_KM);
    
    document.getElementById('final-subtotal').innerText = `S/ ${sub.toFixed(2)}`;
    document.getElementById('final-shipping').innerText = ship === 0 ? "GRATIS" : `S/ ${ship.toFixed(2)}`;
    document.getElementById('final-total').innerText = `S/ ${(sub + ship).toFixed(2)}`;
    validateForm();
}
function validateForm() {
    const name = document.getElementById('form-name').value;
    const phone = document.getElementById('form-phone').value;
    const coords = document.getElementById('real-coordinates').value;
    document.getElementById('btn-finish').classList.toggle('active', name && phone && coords);
}
function triggerCelebration() {
    document.getElementById('celebration-modal').classList.add('active');
    let p = 0;
    const iv = setInterval(() => {
        p += 5;
        document.getElementById('celebration-progress').style.width = p + "%";
        if(p >= 100) { clearInterval(iv); sendOrder(); }
    }, 100);
}
function sendOrder() {
    const name = document.getElementById('form-name').value;
    const sub = document.getElementById('final-subtotal').innerText;
    const ship = document.getElementById('final-shipping').innerText;
    const total = document.getElementById('final-total').innerText;
    const coords = document.getElementById('real-coordinates').value;
    const items = state_cart.map(i => `- ${i.name} (x${i.qty})`).join('%0A');
    
    // CORRECCIÓN DEL ENLACE DE MAPA
    let msg = `🛍️ *NUEVO PEDIDO - JSTORER*%0A%0A`;
    msg += `👤 *Cliente:* ${name}%0A`;
    msg += `📦 *Productos:*%0A${items}%0A%0A`;
    msg += `💰 *Subtotal:* ${sub}%0A`;
    msg += `🚚 *Envío:* ${ship}%0A`;
    msg += `⭐ *TOTAL:* ${total}%0A%0A`;
    if(coords) msg += `🗺️ *Ubicación:* https://www.google.com/maps?q=${coords}`;
    window.open(`https://wa.me/51932508670?text=${msg}`, '_blank');
}
// FUNCIONES DE MAPA (Leaflet)
function initMap() {
    map = L.map('map-picker').setView([STORE_LOCATION.lat, STORE_LOCATION.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    map.on('click', e => updateMarker(e.latlng));
}
function updateMarker(latlng) {
    if(userMarker) userMarker.setLatLng(latlng);
    else userMarker = L.marker(latlng, {draggable:true}).addTo(map);
    
    const dist = map.distance([STORE_LOCATION.lat, STORE_LOCATION.lng], latlng) / 1000;
    document.getElementById('form-km').value = dist.toFixed(2);
    document.getElementById('real-coordinates').value = `${latlng.lat},${latlng.lng}`;
    calculateFinals();
}
function showToast(m) {
    const t = document.getElementById('toast-notify');
    t.innerText = m; t.style.bottom = "30px";
    setTimeout(() => t.style.bottom = "-100px", 3000);
}