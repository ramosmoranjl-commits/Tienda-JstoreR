
/* JSTORER CORE ENGINE V2.6 - LOGISTICS & UI */
// CONFIGURACIÓN GLOBAL
const SETTINGS = {
    SHEET_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKWE4Wyh_N_pt12iDlXx_garwZHFKRcE19DRoKSa2Cb_v3KoSmcQcJXRS2MdrfB7Bso-DqSXdINSt/pub?gid=0&single=true&output=csv",
    STORE_COORDS: { lat: -12.053850, lng: -77.031550 }, // Ubicación Tienda (Lima)
    FREE_SHIP_MIN: 400, // S/ 400 para envío gratis
    KM_PRICE: 2, // S/ 2.00 por Kilómetro
    WHATSAPP: "51932508670"
};
let DB_PRODUCTS = [];
let shopping_cart = JSON.parse(localStorage.getItem('jst_master_cart')) || [];
let active_map = null;
let active_marker = null;
// INICIALIZACIÓN
window.onload = async () => {
    initGoldDust();
    await loadInventory();
    renderInventory();
    renderPills();
    updateCartUI();
};
// --- CARGA DE DATOS ---
async function loadInventory() {
    try {
        const response = await fetch(SETTINGS.SHEET_URL);
        const csv = await response.text();
        const lines = csv.split('\n').slice(1);
        
        DB_PRODUCTS = lines.map(line => {
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return {
                id: cols[0]?.trim(),
                name: cols[1]?.replace(/"/g, '').trim(),
                price: parseFloat(cols[2]),
                cat: cols[3]?.trim(),
                img: cols[4]?.trim(),
                stock: parseInt(cols[5]) || 0,
                desc: cols[6]?.replace(/"/g, '').trim() || "Calidad Premium Garantizada."
            };
        }).filter(p => p.id && p.name);
    } catch (err) {
        console.error("Error al conectar con el inventario:", err);
    }
}
// --- RENDERIZADO DE PRODUCTOS ---
function renderInventory() {
    const grid = document.getElementById('main-grid');
    const search = document.getElementById('master-search').value.toLowerCase();
    
    const filtered = DB_PRODUCTS.filter(p => p.name.toLowerCase().includes(search));
    
    grid.innerHTML = filtered.map(p => {
        const outOfStock = p.stock <= 0;
        return `
        <div class="card-item" style="${outOfStock ? 'opacity:0.6;' : ''}">
            <div class="card-img-container" onclick="openQuickView('${p.id}')">
                <img src="${p.img}" loading="lazy" alt="${p.name}">
            </div>
            <div style="flex:1;">
                <span style="font-size:0.7rem; color:var(--jst-gold); font-weight:800; text-transform:uppercase;">${p.cat}</span>
                <h4 style="font-size:1rem; margin:5px 0 12px; line-height:1.3;">${p.name}</h4>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:900; font-size:1.3rem;">S/ ${p.price.toFixed(2)}</span>
                <button class="cart-trigger" onclick="addItemToCart('${p.id}')" ${outOfStock ? 'disabled' : ''}>
                    <i class="fas ${outOfStock ? 'fa-ban' : 'fa-plus'}"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}
// --- LÓGICA DEL CARRITO ---
function toggleCart(open) {
    document.getElementById('side-cart').classList.toggle('open', open);
}
function addItemToCart(id) {
    const p = DB_PRODUCTS.find(x => x.id === id);
    if (!p || p.stock <= 0) return;
    const existing = shopping_cart.find(x => x.id === id);
    if (existing) {
        existing.qty++;
    } else {
        shopping_cart.push({ ...p, qty: 1 });
    }
    
    saveAndUpdate();
    showToast(`"${p.name}" agregado`);
}
function saveAndUpdate() {
    localStorage.setItem('jst_master_cart', JSON.stringify(shopping_cart));
    updateCartUI();
}
function updateCartUI() {
    const badge = document.getElementById('cart-badge');
    const totalQty = shopping_cart.reduce((a, b) => a + b.qty, 0);
    badge.innerText = totalQty;
    badge.style.display = totalQty > 0 ? 'flex' : 'none';
    document.getElementById('cart-items-list').innerHTML = shopping_cart.map((item, idx) => `
        <div style="display:flex; gap:12px; margin-bottom:15px; align-items:center;">
            <img src="${item.img}" style="width:55px; height:55px; border-radius:12px; object-fit:cover;">
            <div style="flex:1;">
                <h5 style="font-size:0.85rem; margin:0;">${item.name}</h5>
                <b style="color:var(--jst-gold);">S/ ${(item.price * item.qty).toFixed(2)}</b>
            </div>
            <div style="display:flex; gap:10px; align-items:center; background:#f1f5f9; padding:5px 12px; border-radius:10px;">
                <span onclick="modQty(${idx}, -1)" style="cursor:pointer; font-weight:900;">-</span>
                <span style="font-weight:800;">${item.qty}</span>
                <span onclick="modQty(${idx}, 1)" style="cursor:pointer; font-weight:900;">+</span>
            </div>
        </div>
    `).join('');
    calculateCartTotals();
}
function modQty(idx, val) {
    shopping_cart[idx].qty += val;
    if (shopping_cart[idx].qty <= 0) shopping_cart.splice(idx, 1);
    saveAndUpdate();
}
function calculateCartTotals() {
    const subtotal = shopping_cart.reduce((a, b) => a + (b.price * b.qty), 0);
    const km = parseFloat(document.getElementById('form-km').value) || 0;
    
    let shipCost = (subtotal >= SETTINGS.FREE_SHIP_MIN) ? 0 : (km * SETTINGS.KM_PRICE);
    if (shipCost > 0 && shipCost < 8) shipCost = 8; // Mínimo base
    document.getElementById('step1-total').innerText = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('final-subtotal').innerText = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('final-shipping').innerText = shipCost === 0 ? "GRATIS" : `S/ ${shipCost.toFixed(2)}`;
    document.getElementById('final-total').innerText = `S/ ${(subtotal + shipCost).toFixed(2)}`;
    // Barra de progreso
    const progress = Math.min(100, (subtotal / SETTINGS.FREE_SHIP_MIN) * 100);
    document.getElementById('ship-progress-bar').style.width = `${progress}%`;
    const msg = document.getElementById('ship-msg-text');
    if (subtotal >= SETTINGS.FREE_SHIP_MIN) {
        msg.innerHTML = "¡Envío Gratis Desbloqueado!";
    } else {
        msg.innerHTML = `Faltan S/ ${(SETTINGS.FREE_SHIP_MIN - subtotal).toFixed(2)} para Envío Gratis`;
    }
}
// --- TECNOLOGÍA DE MAPAS (RAPPI/UBER) ---
function goToStep(n) {
    const cartEl = document.getElementById('side-cart');
    if (n === 2) {
        cartEl.classList.add('step-2');
        setTimeout(initUberMap, 500); // Esperar animación
    } else {
        cartEl.classList.remove('step-2');
    }
}
function initUberMap() {
    if (active_map) {
        active_map.invalidateSize();
        return;
    }
    active_map = L.map('order-map', { zoomControl: false }).setView([SETTINGS.STORE_COORDS.lat, SETTINGS.STORE_COORDS.lng], 15);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(active_map);
    const pinIcon = L.divIcon({
        html: `<div style="background:var(--jst-dark); width:32px; height:32px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:3px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 5px 15px rgba(0,0,0,0.2);"><i class="fas fa-home" style="transform:rotate(45deg); color:white; font-size:14px;"></i></div>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 32]
    });
    active_marker = L.marker([SETTINGS.STORE_COORDS.lat, SETTINGS.STORE_COORDS.lng], {
        icon: pinIcon,
        draggable: true
    }).addTo(active_map);
    active_marker.on('dragend', function() {
        const pos = active_marker.getLatLng();
        updateLogistics(pos.lat, pos.lng);
    });
    getCurrentLocation();
}
async function updateLogistics(lat, lng) {
    // 1. Cálculo de Distancia Real
    const dist = calculateDistance(SETTINGS.STORE_COORDS.lat, SETTINGS.STORE_COORDS.lng, lat, lng);
    document.getElementById('form-km').value = dist.toFixed(2);
    
    // 2. Geocodificación Inversa (Dirección automática)
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`);
        const data = await res.json();
        if (data.display_name) {
            const shortAddr = data.display_name.split(',').slice(0, 3).join(',');
            document.getElementById('form-address').value = shortAddr;
        }
    } catch (e) { console.log("Nominatim error"); }
    
    calculateCartTotals();
    validateForm();
}
function calculateDistance(la1, lo1, la2, lo2) {
    const R = 6371;
    const dLa = (la2 - la1) * Math.PI / 180;
    const dLo = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        active_map.setView([lat, lng], 16);
        active_marker.setLatLng([lat, lng]);
        updateLogistics(lat, lng);
    });
}
// --- FINALIZACIÓN ---
function validateForm() {
    const name = document.getElementById('form-name').value;
    const addr = document.getElementById('form-address').value;
    const phone = document.getElementById('form-phone').value;
    const btn = document.getElementById('btn-finish');
    
    if (name.length > 2 && addr.length > 5 && phone.length >= 9) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
}
function sendOrder() {
    const name = document.getElementById('form-name').value;
    const addr = document.getElementById('form-address').value;
    const phone = document.getElementById('form-phone').value;
    const total = document.getElementById('final-total').innerText;
    const km = document.getElementById('form-km').value;
    let text = `*NUEVO PEDIDO JSTORE-R*\n\n`;
    shopping_cart.forEach(i => text += `• ${i.name} (x${i.qty})\n`);
    text += `\n*RESUMEN:*`;
    text += `\nSubtotal: ${document.getElementById('final-subtotal').innerText}`;
    text += `\nEnvío: ${document.getElementById('final-shipping').innerText} (${km} km)`;
    text += `\n*TOTAL: ${total}*`;
    text += `\n\n*DATOS DE ENTREGA:*`;
    text += `\n👤: ${name}\n📍: ${addr}\n📱: ${phone}`;
    
    window.open(`https://wa.me/${SETTINGS.WHATSAPP}?text=${encodeURIComponent(text)}`);
}
// --- UI EFFECTS (GOLD DUST, TOAST, MODALS) ---
function initGoldDust() {
    const cvs = document.getElementById('gold-dust-layer');
    const ctx = cvs.getContext('2d');
    cvs.width = window.innerWidth; cvs.height = window.innerHeight;
    const p = Array(25).fill().map(() => ({ x: Math.random() * cvs.width, y: Math.random() * cvs.height, s: Math.random() * 0.4 + 0.1 }));
    function anim() {
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.fillStyle = "rgba(199, 106, 58, 0.3)";
        p.forEach(f => {
            ctx.beginPath(); ctx.arc(f.x, f.y, 1, 0, Math.PI * 2); ctx.fill();
            f.y -= f.s; if (f.y < 0) f.y = cvs.height;
        });
        requestAnimationFrame(anim);
    }
    anim();
}
function openQuickView(id) {
    const p = DB_PRODUCTS.find(x => x.id === id);
    if (!p) return;
    document.getElementById('qv-img').src = p.img;
    document.getElementById('qv-cat').innerText = p.cat;
    document.getElementById('qv-name').innerText = p.name;
    document.getElementById('qv-price').innerText = `S/ ${p.price.toFixed(2)}`;
    document.getElementById('qv-desc').innerText = p.desc;
    document.getElementById('quick-view-modal').classList.add('active');
}
function closeQuickView() { document.getElementById('quick-view-modal').classList.remove('active'); }
function showToast(msg) {
    const t = document.getElementById('toast-notify');
    t.innerText = msg; t.style.bottom = "30px";
    setTimeout(() => t.style.bottom = "-100px", 2500);
}
function toggleFaq(el) { el.classList.toggle('active'); }
function handleSmartFilter() { renderInventory(); }
function renderPills() {
    const cats = ["Todas", ...new Set(DB_PRODUCTS.map(p => p.cat).filter(Boolean))];
    document.getElementById('category-pills-render').innerHTML = cats.map(c => 
        `<div class="pill-item" onclick="filterByCat(this, '${c}')">${c}</div>`
    ).join('');
}
function filterByCat(el, c) {
    document.querySelectorAll('.pill-item').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    const grid = document.getElementById('main-grid');
    const filtered = (c === "Todas") ? DB_PRODUCTS : DB_PRODUCTS.filter(p => p.cat === c);
    grid.innerHTML = filtered.map(p => `
        <div class="card-item">
            <div class="card-img-container" onclick="openQuickView('${p.id}')"><img src="${p.img}"></div>
            <div style="flex:1;">
                <span style="font-size:0.7rem; color:var(--jst-gold); font-weight:800;">${p.cat}</span>
                <h4 style="font-size:1rem; margin:5px 0;">${p.name}</h4>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:900; font-size:1.3rem;">S/ ${p.price.toFixed(2)}</span>
                <button class="cart-trigger" onclick="addItemToCart('${p.id}')"><i class="fas fa-plus"></i></button>
            </div>
        </div>`).join('');
}