
// CONFIGURACIÓN
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKWE4Wyh_N_pt12iDlXx_garwZHFKRcE19DRoKSa2Cb_v3KoSmcQcJXRS2MdrfB7Bso-DqSXdINSt/pub?gid=0&single=true&output=csv";
const STORE_LOCATION = { lat: -12.053850, lng: -77.031550 }; // JR. Cuzco 626 Cercado de Lima
let CATALOG_DB = [];
let state_cart = JSON.parse(localStorage.getItem('jst_master_cart')) || [];
let current_category = "Todas";
let currentQVId = null;
const FREE_SHIPPING_THRESHOLD = 500;
const SHIPPING_RATE_PER_KM = 1.5;
// Variables de Mapa
let map = null;
let mapMarker = null;
window.onload = async () => {
    initGoldDust();
    await fetchProducts();
    renderPills();
    refreshCartUI();
};
// LÓGICA DE DATOS
async function fetchProducts() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const text = await response.text();
        const rows = text.split('\n').slice(1);
        CATALOG_DB = rows.map(row => {
            const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return {
                id: c[0]?.trim(), name: c[1]?.replace(/^"|"$/g, '').trim(),
                price: parseFloat(c[2]), cat: c[3]?.trim(),
                img: c[4]?.trim(), stock: parseInt(c[5]) || 0,
                desc: c[6]?.replace(/^"|"$/g, '').trim()
            };
        }).filter(p => p.id && p.name);
        renderCollection();
    } catch (e) { console.error("Error loading sheet:", e); }
}
function renderCollection() {
    const grid = document.getElementById('main-grid');
    const filtered = current_category === "Todas" ? CATALOG_DB : CATALOG_DB.filter(p => p.cat === current_category);
    const term = document.getElementById('master-search').value.toLowerCase();
    const final = filtered.filter(p => p.name.toLowerCase().includes(term));
    
    grid.innerHTML = final.map(p => {
        const isSoldOut = p.stock <= 0;
        return `
        <article class="card-item" style="${isSoldOut ? 'opacity:0.7;' : ''}">
            <div class="card-img-container" onclick="openQuickView('${p.id}')">
                <img src="${p.img}" alt="${p.name}" loading="lazy">
            </div>
            <div class="card-info">
                <span style="font-size:0.65rem; color:var(--jst-accent-gold); font-weight:800; text-transform:uppercase;">${p.cat}</span>
                <h3 style="font-size:1.1rem; margin:5px 0 8px;">${p.name}</h3>
                <p style="font-size:0.85rem; color:var(--jst-slate); line-height:1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.desc}</p>
            </div>
            <div class="card-action" style="margin-top:auto; padding-top:15px; display:flex; justify-content:space-between; align-items:center;">
                <span class="price-tag">S/ ${p.price.toFixed(2)}</span>
                ${isSoldOut ? `<button class="btn-add" disabled><i class="fas fa-ban"></i></button>` : `<button class="btn-add" onclick="addItemToCart('${p.id}')"><i class="fas fa-plus"></i></button>`}
            </div>
        </article>`;
    }).join('');
}
function renderPills() {
    const cats = ["Todas", ...new Set(CATALOG_DB.map(p => p.cat).filter(Boolean))];
    document.getElementById('category-pills-render').innerHTML = cats.map(c => 
        `<div class="pill-item ${c===current_category?'active':''}" onclick="setCategory('${c}')">${c}</div>`
    ).join('');
}
function setCategory(c) { current_category = c; renderPills(); renderCollection(); }
function handleSmartFilter() { renderCollection(); }
// CARRITO
function toggleCart(open) {
    const cart = document.getElementById('side-cart');
    open ? cart.classList.add('open') : cart.classList.remove('open');
}
function addItemToCart(id) {
    const p = CATALOG_DB.find(x => x.id == id);
    if(!p || p.stock <= 0) return;
    const exist = state_cart.find(x => x.id == id);
    if(exist) exist.qty++; else state_cart.push({...p, qty: 1});
    updateCart();
    showToast("Producto agregado");
}
function updateCart() {
    localStorage.setItem('jst_master_cart', JSON.stringify(state_cart));
    refreshCartUI();
}
function refreshCartUI() {
    const badge = document.getElementById('cart-badge');
    badge.innerText = state_cart.reduce((a,b)=>a+b.qty,0);
    badge.style.display = state_cart.length ? 'flex' : 'none';
    
    document.getElementById('cart-items-list').innerHTML = state_cart.map((item, idx) => `
        <div style="display:flex; gap:15px; margin-bottom:20px; align-items:center;">
            <img src="${item.img}" style="width:60px; height:60px; border-radius:12px; object-fit:cover;">
            <div style="flex:1;">
                <h4 style="font-size:0.85rem; margin-bottom:4px;">${item.name}</h4>
                <div style="color:var(--jst-accent-gold); font-weight:800; font-size:0.9rem;">S/ ${(item.price * item.qty).toFixed(2)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; background:#f1f5f9; padding:4px 8px; border-radius:8px;">
                <button onclick="modQty(${idx}, -1)" style="border:none; background:none; cursor:pointer; font-weight:bold;">-</button>
                <span style="font-weight:700; font-size:0.8rem;">${item.qty}</span>
                <button onclick="modQty(${idx}, 1)" style="border:none; background:none; cursor:pointer; font-weight:bold;">+</button>
            </div>
        </div>
    `).join('');
    
    refreshSummary();
}
function modQty(idx, n) {
    state_cart[idx].qty += n;
    if(state_cart[idx].qty <= 0) state_cart.splice(idx, 1);
    updateCart();
}
function refreshSummary() {
    const sub = state_cart.reduce((a,b)=>a+(b.price*b.qty),0);
    document.getElementById('step1-total').innerText = `S/ ${sub.toFixed(2)}`;
    document.getElementById('final-subtotal').innerText = `S/ ${sub.toFixed(2)}`;
    
    // Barra de envío gratis
    const bar = document.getElementById('ship-progress-bar');
    const pct = Math.min(100, (sub/FREE_SHIPPING_THRESHOLD)*100);
    bar.style.width = `${pct}%`;
    const msg = document.getElementById('ship-msg-text');
    
    let shipCost = 0;
    if(sub >= FREE_SHIPPING_THRESHOLD) {
        msg.innerHTML = "<span style='color:#10b981'>¡Envío GRATIS!</span>";
        shipCost = 0;
        document.getElementById('final-shipping').innerText = "GRATIS";
    } else {
        msg.innerHTML = `S/ ${(FREE_SHIPPING_THRESHOLD-sub).toFixed(2)} más para envío gratis`;
        const km = parseFloat(document.getElementById('form-km').value) || 0;
        shipCost = Math.max(10, km * SHIPPING_RATE_PER_KM);
        document.getElementById('final-shipping').innerText = `S/ ${shipCost.toFixed(2)}`;
    }
    
    document.getElementById('final-total').innerText = `S/ ${(sub + shipCost).toFixed(2)}`;
    renderSuggestions();
}
// LÓGICA DE MAPA INTERACTIVO (UBER STYLE)
function initOrderMap() {
    if (map) return; // Evitar reinicializar
    // Iniciar en Lima (Cercado)
    map = L.map('order-map', { zoomControl: false }).setView([STORE_LOCATION.lat, STORE_LOCATION.lng], 15);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    // Pin personalizado tipo "Uber"
    const uberIcon = L.divIcon({
        html: `<div style="background:var(--jst-onyx); width:30px; height:30px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; border:3px solid white; box-shadow:0 5px 15px rgba(0,0,0,0.3);"><i class="fas fa-home" style="transform:rotate(45deg); color:white; font-size:12px;"></i></div>`,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });
    mapMarker = L.marker([STORE_LOCATION.lat, STORE_LOCATION.lng], {
        icon: uberIcon,
        draggable: true
    }).addTo(map);
    // Evento al mover el Pin
    mapMarker.on('dragend', function(e) {
        const pos = mapMarker.getLatLng();
        updateLocationData(pos.lat, pos.lng);
    });
    // Intentar obtener ubicación GPS real del usuario al abrir
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const userPos = [pos.coords.latitude, pos.coords.longitude];
            map.setView(userPos, 16);
            mapMarker.setLatLng(userPos);
            updateLocationData(pos.coords.latitude, pos.coords.longitude);
        });
    }
}
async function updateLocationData(lat, lng) {
    // 1. Calcular Distancia
    const dist = getDist(STORE_LOCATION.lat, STORE_LOCATION.lng, lat, lng);
    document.getElementById('form-km').value = dist.toFixed(2);
    
    // 2. Geocodificación Inversa (Dirección Real)
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await res.json();
        if (data.display_name) {
            // Limpiar dirección para que no sea excesivamente larga
            const parts = data.display_name.split(',');
            const shortAddr = parts.slice(0, 3).join(',');
            document.getElementById('form-address').value = shortAddr;
        }
    } catch (e) { console.error("Geocoding error", e); }
    
    refreshSummary();
    validateForm();
}
function getDist(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function goToStep(n) {
    const cart = document.getElementById('side-cart');
    if (n === 2) {
        cart.classList.add('step-2');
        setTimeout(initOrderMap, 400); // Dar tiempo a la animación para inicializar mapa
    } else {
        cart.classList.remove('step-2');
    }
}
function validateForm() {
    const name = document.getElementById('form-name').value;
    const addr = document.getElementById('form-address').value;
    const phone = document.getElementById('form-phone').value;
    const btn = document.getElementById('btn-finish');
    if(name && addr.length > 5 && phone.length >= 9) btn.classList.add('active');
    else btn.classList.remove('active');
}
function sendOrder() {
    const name = document.getElementById('form-name').value;
    const addr = document.getElementById('form-address').value;
    const phone = document.getElementById('form-phone').value;
    const total = document.getElementById('final-total').innerText;
    
    let msg = `*NUEVO PEDIDO JSTORE-R*\n\n`;
    state_cart.forEach(p => msg += `• ${p.name} (x${p.qty})\n`);
    msg += `\n*TOTAL:* ${total}\n`;
    msg += `--------------------------\n`;
    msg += `*ENTREGA:*\n👤: ${name}\n📍: ${addr}\n📱: ${phone}`;
    
    window.open(`https://wa.me/51932508670?text=${encodeURIComponent(msg)}`, '_blank');
}
// RESTO DE FUNCIONES UI (QUICK VIEW, TOAST, DUST)
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
function showToast(msg) {
    const t = document.getElementById('toast-notify');
    t.innerText = msg; t.style.bottom = "30px";
    setTimeout(() => t.style.bottom = "-100px", 3000);
}
function toggleFaq(el) { el.classList.toggle('active'); }
function renderSuggestions() {
    const ids = state_cart.map(x=>x.id);
    const avail = CATALOG_DB.filter(p=>!ids.includes(p.id) && p.stock > 0).slice(0,4);
    if(avail.length && state_cart.length > 0) {
        document.getElementById('suggestions-area').style.display='block';
        document.getElementById('suggestions-render').innerHTML = avail.map(s=>`
            <div class="mini-card" onclick="addItemToCart('${s.id}')">
                <img src="${s.img}" style="width:100%; height:80px; object-fit:cover; border-radius:10px; margin-bottom:5px;">
                <div style="font-size:0.75rem; font-weight:700;">S/ ${s.price}</div>
            </div>`).join('');
    } else { document.getElementById('suggestions-area').style.display='none'; }
}
function initGoldDust() {
    const cvs = document.getElementById('gold-dust-layer'); if(!cvs) return;
    const ctx = cvs.getContext('2d');
    cvs.width=window.innerWidth; cvs.height=window.innerHeight;
    const p = Array(25).fill().map(()=>({x:Math.random()*cvs.width, y:Math.random()*cvs.height, r:Math.random()*1.5+0.5, s:Math.random()*0.3+0.1}));
    function draw() {
        ctx.clearRect(0,0,cvs.width,cvs.height);
        ctx.fillStyle="rgba(199, 106, 58, 0.4)";
        p.forEach(f=>{
            ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,Math.PI*2); ctx.fill();
            f.y-=f.s; if(f.y<0) f.y=cvs.height;
        });
        requestAnimationFrame(draw);
    }
    draw();
}
function openReviewModal() { alert("Sistema de reseñas en mantenimiento."); }