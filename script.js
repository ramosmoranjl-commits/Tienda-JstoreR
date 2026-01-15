
/* ==========================================================================
   JSTORER CORE JS - V2.0
   ========================================================================== */
// CONFIGURACIÓN DE NEGOCIO
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKWE4Wyh_N_pt12iDlXx_garwZHFKRcE19DRoKSa2Cb_v3KoSmcQcJXRS2MdrfB7Bso-DqSXdINSt/pub?gid=0&single=true&output=csv";
const STORE_COORDS = { lat: -12.053850, lng: -77.031550 }; // Dirección base de la tienda
const FREE_SHIPPING_THRESHOLD = 400; // Pedido mínimo para envío gratis
const SHIPPING_RATE_PER_KM = 2; // Costo por kilómetro solicitado
let CATALOG_DB = [];
let state_cart = JSON.parse(localStorage.getItem('jst_master_cart')) || [];
let current_category = "Todas";
let currentQVId = null;
// Mapa Variables
let mainMap = null;
let userMarker = null;
window.onload = async () => {
    initGoldDust();
    await fetchProducts();
    renderPills();
    refreshCartUI();
};
// --- CARGA DE PRODUCTOS ---
async function fetchProducts() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const text = await response.text();
        const rows = text.split('\n').slice(1);
        CATALOG_DB = rows.map(row => {
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return {
                id: cols[0]?.trim(),
                name: cols[1]?.replace(/^"|"$/g, '').trim(),
                price: parseFloat(cols[2]),
                cat: cols[3]?.trim(),
                img: cols[4]?.trim(),
                stock: parseInt(cols[5]) || 0,
                desc: cols[6]?.replace(/^"|"$/g, '').trim()
            };
        }).filter(p => p.id && p.name);
        renderCollection();
    } catch (e) { console.error("Error cargando base de datos", e); }
}
function renderCollection() {
    const grid = document.getElementById('main-grid');
    const term = document.getElementById('master-search').value.toLowerCase();
    
    const filtered = CATALOG_DB.filter(p => {
        const matchesCat = current_category === "Todas" || p.cat === current_category;
        const matchesSearch = p.name.toLowerCase().includes(term);
        return matchesCat && matchesSearch;
    });
    grid.innerHTML = filtered.map(p => {
        const outOfStock = p.stock <= 0;
        return `
        <article class="card-item" style="${outOfStock ? 'opacity:0.6' : ''}">
            <div class="card-img-container" onclick="openQuickView('${p.id}')">
                <img src="${p.img}" alt="${p.name}" loading="lazy">
            </div>
            <div style="flex:1;">
                <span style="font-size:0.7rem; color:var(--jst-accent-gold); font-weight:800; text-transform:uppercase;">${p.cat}</span>
                <h3 style="font-size:1.05rem; margin:5px 0 10px;">${p.name}</h3>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <span class="price-tag">S/ ${p.price.toFixed(2)}</span>
                <button class="btn-add" onclick="addItemToCart('${p.id}')" ${outOfStock ? 'disabled' : ''}>
                    <i class="fas ${outOfStock ? 'fa-ban' : 'fa-plus'}"></i>
                </button>
            </div>
        </article>`;
    }).join('');
}
// --- LÓGICA DEL CARRITO ---
function toggleCart(open) {
    document.getElementById('side-cart').classList.toggle('open', open);
}
function addItemToCart(id) {
    const p = CATALOG_DB.find(x => x.id === id);
    if (!p || p.stock <= 0) return;
    const exist = state_cart.find(x => x.id === id);
    if (exist) exist.qty++; else state_cart.push({ ...p, qty: 1 });
    updateCart();
    showToast("¡Agregado!");
}
function updateCart() {
    localStorage.setItem('jst_master_cart', JSON.stringify(state_cart));
    refreshCartUI();
}
function refreshCartUI() {
    const badge = document.getElementById('cart-badge');
    const totalQty = state_cart.reduce((a, b) => a + b.qty, 0);
    badge.innerText = totalQty;
    badge.style.display = totalQty > 0 ? 'flex' : 'none';
    document.getElementById('cart-items-list').innerHTML = state_cart.map((item, idx) => `
        <div style="display:flex; gap:12px; margin-bottom:15px; align-items:center;">
            <img src="${item.img}" style="width:50px; height:50px; border-radius:10px; object-fit:cover;">
            <div style="flex:1;">
                <h4 style="font-size:0.85rem; margin:0;">${item.name}</h4>
                <div style="color:var(--jst-accent-gold); font-weight:700;">S/ ${(item.price * item.qty).toFixed(2)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; background:#f1f5f9; padding:5px 10px; border-radius:8px; font-size:0.8rem;">
                <button onclick="changeQty(${idx}, -1)" style="border:none; cursor:pointer; background:none; font-weight:bold;">-</button>
                <span>${item.qty}</span>
                <button onclick="changeQty(${idx}, 1)" style="border:none; cursor:pointer; background:none; font-weight:bold;">+</button>
            </div>
        </div>
    `).join('');
    refreshTotals();
}
function changeQty(idx, n) {
    state_cart[idx].qty += n;
    if (state_cart[idx].qty <= 0) state_cart.splice(idx, 1);
    updateCart();
}
function refreshTotals() {
    const subtotal = state_cart.reduce((a, b) => a + (b.price * b.qty), 0);
    const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
    
    document.getElementById('ship-progress-bar').style.width = `${progress}%`;
    const msgEl = document.getElementById('ship-msg-text');
    
    let shipping = 0;
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
        msgEl.innerHTML = "<span style='color:#10b981'>¡Envío Gratis desbloqueado!</span>";
        shipping = 0;
    } else {
        msgEl.innerHTML = `Faltan S/ ${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)} para envío gratis`;
        const km = parseFloat(document.getElementById('form-km').value) || 0;
        shipping = Math.max(8, km * SHIPPING_RATE_PER_KM); // Mínimo 8 soles si hay distancia
    }
    document.getElementById('step1-total').innerText = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('final-subtotal').innerText = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('final-shipping').innerText = shipping === 0 ? "GRATIS" : `S/ ${shipping.toFixed(2)}`;
    document.getElementById('final-total').innerText = `S/ ${(subtotal + shipping).toFixed(2)}`;
}
// --- LÓGICA DE MAPA (UBER EXPERIENCE) ---
function initOrderMap() {
    if (mainMap) {
        mainMap.invalidateSize();
        return;
    }
    // Inicializar en la tienda por defecto
    mainMap = L.map('order-map', { zoomControl: false }).setView([STORE_COORDS.lat, STORE_COORDS.lng], 15);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mainMap);
    // Icono Premium
    const pinIcon = L.divIcon({
        html: `<div style="background:var(--jst-onyx); width:34px; height:34px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; border:3px solid white; box-shadow:0 4px 10px rgba(0,0,0,0.2);"><i class="fas fa-home" style="transform:rotate(45deg); color:white; font-size:14px;"></i></div>`,
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 34]
    });
    userMarker = L.marker([STORE_COORDS.lat, STORE_COORDS.lng], {
        icon: pinIcon,
        draggable: true
    }).addTo(mainMap);
    userMarker.on('dragend', function() {
        const pos = userMarker.getLatLng();
        updateLocationDetails(pos.lat, pos.lng);
    });
    // Intentar geolocalizar al usuario
    getCurrentLocation();
}
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            mainMap.setView([lat, lng], 16);
            userMarker.setLatLng([lat, lng]);
            updateLocationDetails(lat, lng);
        }, err => console.log("Ubicación denegada"));
    }
}
async function updateLocationDetails(lat, lng) {
    // Calcular distancia Haversine
    const dist = calculateDistance(STORE_COORDS.lat, STORE_COORDS.lng, lat, lng);
    document.getElementById('form-km').value = dist.toFixed(2);
    
    // Geocodificación inversa (Nominatim)
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`);
        const data = await res.json();
        if (data.display_name) {
            const simpleAddr = data.display_name.split(',').slice(0, 3).join(',');
            document.getElementById('form-address').value = simpleAddr;
        }
    } catch (e) { console.error("Error obteniendo dirección"); }
    
    refreshTotals();
    validateForm();
}
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
// --- UTILIDADES UI ---
function goToStep(n) {
    const cart = document.getElementById('side-cart');
    if (n === 2) {
        cart.classList.add('step-2');
        setTimeout(initOrderMap, 500);
    } else {
        cart.classList.remove('step-2');
    }
}
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
    const km = document.getElementById('form-km').value;
    const total = document.getElementById('final-total').innerText;
    const shipCost = document.getElementById('final-shipping').innerText;
    let msg = `*NUEVO PEDIDO JSTORE-R*\n\n`;
    state_cart.forEach(p => msg += `• ${p.name} (x${p.qty})\n`);
    msg += `\n*RESUMEN:*`;
    msg += `\nEnvío: ${shipCost} (${km} km)`;
    msg += `\n*TOTAL:* ${total}`;
    msg += `\n\n*DATOS DE ENTREGA:*`;
    msg += `\n👤: ${name}\n📍: ${addr}\n📱: ${phone}`;
    
    window.open(`https://wa.me/51932508670?text=${encodeURIComponent(msg)}`, '_blank');
}
// Otros Efectos
function showToast(m) {
    const t = document.getElementById('toast-notify');
    t.innerText = m; t.style.bottom = "30px";
    setTimeout(() => t.style.bottom = "-100px", 2500);
}
function setCategory(c) { current_category = c; renderPills(); renderCollection(); }
function renderPills() {
    const cats = ["Todas", ...new Set(CATALOG_DB.map(p => p.cat).filter(Boolean))];
    document.getElementById('category-pills-render').innerHTML = cats.map(c => 
        `<div class="pill-item ${c===current_category?'active':''}" onclick="setCategory('${c}')">${c}</div>`
    ).join('');
}
function toggleFaq(el) { el.classList.toggle('active'); }
function openQuickView(id) {
    const p = CATALOG_DB.find(x => x.id == id);
    if(!p) return;
    currentQVId = id;
    document.getElementById('qv-img').src = p.img;
    document.getElementById('qv-cat').innerText = p.cat;
    document.getElementById('qv-name').innerText = p.name;
    document.getElementById('qv-price').innerText = `S/ ${p.price.toFixed(2)}`;
    document.getElementById('qv-desc').innerText = p.desc;
    document.getElementById('quick-view-modal').classList.add('active');
}
function closeQuickView() { document.getElementById('quick-view-modal').classList.remove('active'); }
function addToCartFromQV() { if(currentQVId) { addItemToCart(currentQVId); closeQuickView(); } }
function initGoldDust() {
    const cvs = document.getElementById('gold-dust-layer');
    const ctx = cvs.getContext('2d');
    cvs.width = window.innerWidth; cvs.height = window.innerHeight;
    const particles = Array(30).fill().map(() => ({
        x: Math.random() * cvs.width, y: Math.random() * cvs.height,
        r: Math.random() * 1.5 + 0.5, s: Math.random() * 0.4 + 0.1
    }));
    function draw() {
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.fillStyle = "rgba(199, 106, 58, 0.3)";
        particles.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            p.y -= p.s; if (p.y < 0) p.y = cvs.height;
        });
        requestAnimationFrame(draw);
    }
    draw();
}