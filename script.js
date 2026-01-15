
// CONFIGURACIÓN
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKWE4Wyh_N_pt12iDlXx_garwZHFKRcE19DRoKSa2Cb_v3KoSmcQcJXRS2MdrfB7Bso-DqSXdINSt/pub?gid=0&single=true&output=csv";
const STORE_LOCATION = { lat: -12.053850, lng: -77.031550 };
let CATALOG_DB = [];
let state_cart = JSON.parse(localStorage.getItem('jst_master_cart')) || [];
let current_category = "Todas";
let currentQVId = null;
const FREE_SHIPPING_THRESHOLD = 500;
const SHIPPING_RATE_PER_KM = 1.5; // Ajustable
window.onload = async () => {
    initGoldDust();
    await fetchProducts();
    renderPills();
    refreshCartUI();
    initReviewStars();
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
        const btn = isSoldOut 
            ? `<button class="btn-add" style="background:#e2e8f0; color:#94a3b8; cursor:not-allowed;"><i class="fas fa-ban"></i></button>`
            : `<button class="btn-add" onclick="addItemToCart('${p.id}')"><i class="fas fa-plus"></i></button>`;
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
                <span class="price-tag">S/ ${p.price.toFixed(2)}</span>${btn}
            </div>
        </article>`;
    }).join('');
}
function renderPills() {
    document.getElementById('category-pills-render').innerHTML = 
        ["Todas", ...new Set(CATALOG_DB.map(p => p.cat).filter(Boolean))]
        .map(c => `<div class="pill-item ${c===current_category?'active':''}" onclick="setCategory('${c}',this)">${c}</div>`).join('');
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
    document.getElementById('cart-badge').innerText = state_cart.reduce((a,b)=>a+b.qty,0);
    document.getElementById('cart-badge').style.display = state_cart.length ? 'flex' : 'none';
    
    document.getElementById('cart-items-list').innerHTML = state_cart.map((item, idx) => `
        <div style="display:flex; gap:15px; margin-bottom:20px; align-items:center;">
            <img src="${item.img}" style="width:70px; height:70px; border-radius:12px; object-fit:cover;">
            <div style="flex:1;">
                <h4 style="font-size:0.9rem;">${item.name}</h4>
                <div style="color:var(--jst-accent-gold); font-weight:700;">S/ ${(item.price * item.qty).toFixed(2)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px; background:#f1f5f9; padding:5px 10px; border-radius:8px;">
                <button onclick="modQty(${idx}, -1)" style="border:none; background:none; cursor:pointer;">-</button>
                <span style="font-weight:700; font-size:0.9rem;">${item.qty}</span>
                <button onclick="modQty(${idx}, 1)" style="border:none; background:none; cursor:pointer;">+</button>
            </div>
            <button onclick="remItem(${idx})" style="border:none; background:none; color:#ef4444; cursor:pointer;"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
    
    refreshSummary();
}
function modQty(idx, n) {
    state_cart[idx].qty += n;
    if(state_cart[idx].qty <= 0) state_cart.splice(idx, 1);
    updateCart();
}
function remItem(idx) { state_cart.splice(idx, 1); updateCart(); }
function refreshSummary() {
    const sub = state_cart.reduce((a,b)=>a+(b.price*b.qty),0);
    document.getElementById('step1-total').innerText = `S/ ${sub.toFixed(2)}`;
    
    // Shipping Logic
    const bar = document.getElementById('ship-progress-bar');
    const pct = Math.min(100, (sub/FREE_SHIPPING_THRESHOLD)*100);
    bar.style.width = `${pct}%`;
    const msg = document.getElementById('ship-msg-text');
    const box = document.getElementById('shipping-progress-box');
    
    if(sub >= FREE_SHIPPING_THRESHOLD) {
        box.classList.add('unlocked');
        msg.innerHTML = "<span style='color:#10b981'>¡Envío GRATIS conseguido!</span>";
    } else {
        box.classList.remove('unlocked');
        msg.innerHTML = `Faltan <b>S/ ${(FREE_SHIPPING_THRESHOLD-sub).toFixed(2)}</b> para envío gratis`;
    }
    // Suggestions
    renderSuggestions();
    
    // Step 2 Calcs
    document.getElementById('final-subtotal').innerText = `S/ ${sub.toFixed(2)}`;
    const distStr = document.getElementById('form-km').value;
    let shipCost = 0;
    
    if(sub >= FREE_SHIPPING_THRESHOLD) {
        shipCost = 0;
        document.getElementById('final-shipping').innerHTML = `<span style="color:#10b981">GRATIS</span>`;
    } else if(distStr && !isNaN(parseFloat(distStr))) {
        shipCost = parseFloat(distStr) * SHIPPING_RATE_PER_KM;
        // Costo mínimo de envío
        if(shipCost < 10) shipCost = 10;
        document.getElementById('final-shipping').innerText = `S/ ${shipCost.toFixed(2)}`;
    } else {
        document.getElementById('final-shipping').innerText = "Por calcular";
    }
    
    document.getElementById('final-total').innerText = `S/ ${(sub + shipCost).toFixed(2)}`;
}
function renderSuggestions() {
    if(!state_cart.length) return document.getElementById('suggestions-area').style.display='none';
    const ids = state_cart.map(x=>x.id);
    const avail = CATALOG_DB.filter(p=>!ids.includes(p.id) && p.stock > 0).sort(()=>0.5-Math.random()).slice(0,4);
    if(avail.length) {
        document.getElementById('suggestions-area').style.display='block';
        document.getElementById('suggestions-render').innerHTML = avail.map(s=>`
            <div class="mini-card" onclick="addItemToCart('${s.id}')">
                <img src="${s.img}" style="width:100%; height:100px; object-fit:cover; border-radius:10px; margin-bottom:8px;">
                <div style="font-size:0.8rem; font-weight:700;">S/ ${s.price}</div>
            </div>`).join('');
    }
}
// QUICK VIEW
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
// UI UTILS
function showToast(msg) {
    const t = document.getElementById('toast-notify');
    t.innerText = msg; t.style.bottom = "30px";
    setTimeout(() => t.style.bottom = "-100px", 3000);
}
function toggleFaq(el) { el.classList.toggle('active'); }
function goToStep(n) {
    const cart = document.getElementById('side-cart');
    n === 2 ? cart.classList.add('step-2') : cart.classList.remove('step-2');
}
// LOCATION & FORM LOGIC
function validateForm() {
    const name = document.getElementById('form-name').value;
    const addr = document.getElementById('form-address').value;
    const phone = document.getElementById('form-phone').value;
    const btn = document.getElementById('btn-finish');
    
    if(name && addr && phone) btn.classList.add('active');
    else btn.classList.remove('active');
}
function sendOrder() {
    const name = document.getElementById('form-name').value;
    const addr = document.getElementById('form-address').value;
    const phone = document.getElementById('form-phone').value;
    const total = document.getElementById('final-total').innerText;
    
    let msg = `*HOLA JSTORE-R, QUIERO PEDIR:*\n\n`;
    state_cart.forEach(p => msg += `— ${p.name} (x${p.qty})\n`);
    msg += `\n*TOTAL A PAGAR:* ${total}\n`;
    msg += `--------------------------\n`;
    msg += `*DATOS DE ENVÍO:*\nCliente: ${name}\nDirección: ${addr}\nCelular: ${phone}`;
    
    window.open(`https://wa.me/51932508670?text=${encodeURIComponent(msg)}`, '_blank');
}
// EFECTOS VISUALES & REVIEWS
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
let starRating = 5;
function setStars(n) {
    starRating = n;
    // Lógica visual si tuvieras el modal renderizado en JS
}
function initReviewStars() { setStars(5); }
function openReviewModal() { alert("Pronto podrás dejar tu reseña aquí."); }
/* ===========================================================
   SISTEMA DE MAPAS Y GEOLOCALIZACIÓN (Estilo Uber)
   =========================================================== */
let map, userMarker;
let debounceTimer;
// Iniciar mapa cuando se abre el paso 2
function initMapLogic() {
    if(map) return; // Si ya existe, no lo re-creamos
    
    // Centrado inicial (ej: Lima)
    map = L.map('map-picker').setView([STORE_LOCATION.lat, STORE_LOCATION.lng], 12);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM & Carto',
        maxZoom: 19
    }).addTo(map);
    // Icono personalizado
    const icon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/447/447031.png',
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
    });
    // Evento al hacer clic en el mapa
    map.on('click', function(e) {
        setPin(e.latlng.lat, e.latlng.lng, "Ubicación seleccionada en mapa");
    });
}
// Función para buscar direcciones (Autocomplete)
function searchAddress(query) {
    const resultsBox = document.getElementById('address-results');
    
    if(query.length < 3) {
        resultsBox.style.display = 'none';
        return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        // Usamos Nominatim (OpenStreetMap) restringido a Perú
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=pe&limit=5`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            resultsBox.innerHTML = '';
            if(data.length > 0) {
                resultsBox.style.display = 'block';
                data.forEach(place => {
                    const item = document.createElement('div');
                    item.className = 'result-item';
                    item.innerHTML = `<i class="fas fa-map-marker-alt"></i> <span>${place.display_name.split(',')[0]}, ${place.display_name.split(',')[1] || ''}</span>`;
                    item.onclick = () => {
                        document.getElementById('address-search').value = place.display_name; // Poner nombre completo
                        setPin(place.lat, place.lon, place.display_name);
                        resultsBox.style.display = 'none';
                    };
                    resultsBox.appendChild(item);
                });
            }
        } catch(e) { console.error("Error buscando dirección", e); }
    }, 500); // Espera 500ms a que termines de escribir
}
// Poner el PIN en el mapa y calcular precio
function setPin(lat, lng, addressText) {
    if(userMarker) map.removeLayer(userMarker);
    
    userMarker = L.marker([lat, lng], {draggable: true}).addTo(map);
    map.flyTo([lat, lng], 15); // Animación tipo Uber
    
    // Guardar coordenadas
    document.getElementById('real-coordinates').value = `${lat},${lng}`;
    
    // Calcular Distancia
    const dist = getDist(STORE_LOCATION.lat, STORE_LOCATION.lng, lat, lng);
    document.getElementById('form-km').value = dist.toFixed(1);
    
    // Actualizar UI
    refreshSummary();
    validateForm();
    // Evento si el usuario arrastra el pin manualmente
    userMarker.on('dragend', function(event) {
        const position = event.target.getLatLng();
        setPin(position.lat, position.lng, "Ubicación ajustada");
    });
}
// REEMPLAZO DE LA FUNCIÓN getDist ANTIGUA
function getDist(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
// MODIFICACIÓN IMPORTANTE EN LA FUNCIÓN goToStep
// Busca tu función goToStep existente y cámbiala por esta:
function goToStep(n) {
    const cart = document.getElementById('side-cart');
    n === 2 ? cart.classList.add('step-2') : cart.classList.remove('step-2');
    
    if(n === 2) {
        setTimeout(() => {
            initMapLogic();
            map.invalidateSize(); // Arregla el bug de mapa gris
        }, 300);
    }
}