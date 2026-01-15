
/* ==========================================================================
   JSTORER CORE ENGINE V2.6 - LOGISTICS & INVENTORY SYSTEM
   ========================================================================== */
const APP_CONFIG = {
    SHEET_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKWE4Wyh_N_pt12iDlXx_garwZHFKRcE19DRoKSa2Cb_v3KoSmcQcJXRS2MdrfB7Bso-DqSXdINSt/pub?gid=0&single=true&output=csv",
    STORE_LOCATION: { lat: -12.053850, lng: -77.031550 }, // Cercado de Lima
    FREE_DELIVERY_MIN: 400, // Umbral solicitado: S/ 400
    KM_PRICE: 2, // Costo solicitado: S/ 2.00 por Kilómetro
    WHATSAPP_NUMBER: "51932508670"
};
let MASTER_CATALOG = [];
let local_cart = JSON.parse(localStorage.getItem('jst_v2_cart')) || [];
let main_map_instance = null;
let delivery_marker = null;
window.onload = async () => {
    initGoldDustEffect();
    await syncInventory();
    renderCategories();
    refreshUIPipeline();
};
// --- DATA ENGINE ---
async function syncInventory() {
    try {
        const response = await fetch(APP_CONFIG.SHEET_URL);
        const csvData = await response.text();
        const rows = csvData.split('\n').slice(1);
        
        MASTER_CATALOG = rows.map(row => {
            const columns = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return {
                id: columns[0]?.trim(),
                name: columns[1]?.replace(/"/g, '').trim(),
                price: parseFloat(columns[2]),
                category: columns[3]?.trim(),
                imageUrl: columns[4]?.trim(),
                stockCount: parseInt(columns[5]) || 0,
                description: columns[6]?.replace(/"/g, '').trim() || "Calidad y estilo garantizado por JstoreR."
            };
        }).filter(p => p.id && p.name);
        
        renderProductGrid();
    } catch (error) {
        console.error("Critical: Inventory Sync Failed", error);
    }
}
function renderProductGrid() {
    const gridElement = document.getElementById('main-grid');
    const searchTerm = document.getElementById('master-search').value.toLowerCase();
    
    const filteredItems = MASTER_CATALOG.filter(p => p.name.toLowerCase().includes(searchTerm));
    
    gridElement.innerHTML = filteredItems.map(product => {
        const isSoldOut = product.stockCount <= 0;
        return `
        <article class="card-item" style="${isSoldOut ? 'opacity:0.6;' : ''}">
            <div class="card-img-container" onclick="openQuickView('${product.id}')">
                <img src="${product.imageUrl}" alt="${product.name}" loading="lazy">
            </div>
            <div style="flex:1;">
                <span style="font-size:0.7rem; color:var(--jst-gold); font-weight:800; text-transform:uppercase;">${product.category}</span>
                <h4 style="font-size:1rem; margin:6px 0 12px; line-height:1.3;">${product.name}</h4>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="price-tag" style="font-weight:900; font-size:1.4rem;">S/ ${product.price.toFixed(2)}</span>
                <button class="cart-trigger" onclick="addProductToCart('${product.id}')" ${isSoldOut ? 'disabled' : ''} style="background:var(--jst-gold); color:white; border:none; width:42px; height:42px; border-radius:12px; cursor:pointer;">
                    <i class="fas ${isSoldOut ? 'fa-ban' : 'fa-plus'}"></i>
                </button>
            </div>
        </article>`;
    }).join('');
}
// --- CARRITO LOGIC ---
function toggleCart(status) {
    document.getElementById('side-cart').classList.toggle('open', status);
}
function addProductToCart(id) {
    const product = MASTER_CATALOG.find(x => x.id === id);
    if (!product || product.stockCount <= 0) return;
    const cartItem = local_cart.find(x => x.id === id);
    if (cartItem) {
        cartItem.quantity++;
    } else {
        local_cart.push({ ...product, quantity: 1 });
    }
    
    commitCartChanges();
    showPopup(`"${product.name}" añadido`);
}
function commitCartChanges() {
    localStorage.setItem('jst_v2_cart', JSON.stringify(local_cart));
    refreshUIPipeline();
}
function refreshUIPipeline() {
    const badge = document.getElementById('cart-badge');
    const totalCount = local_cart.reduce((acc, curr) => acc + curr.quantity, 0);
    badge.innerText = totalCount;
    badge.style.display = totalCount > 0 ? 'flex' : 'none';
    document.getElementById('cart-items-list').innerHTML = local_cart.map((item, idx) => `
        <div style="display:flex; gap:12px; margin-bottom:18px; align-items:center;">
            <img src="${item.imageUrl}" style="width:60px; height:60px; border-radius:14px; object-fit:cover;">
            <div style="flex:1;">
                <h5 style="font-size:0.85rem; margin:0; font-weight:600;">${item.name}</h5>
                <b style="color:var(--jst-gold);">S/ ${(item.price * item.quantity).toFixed(2)}</b>
            </div>
            <div style="display:flex; gap:12px; align-items:center; background:#f1f5f9; padding:6px 14px; border-radius:12px;">
                <span onclick="modifyQty(${idx}, -1)" style="cursor:pointer; font-weight:900;">-</span>
                <span style="font-weight:800; font-size:0.9rem;">${item.quantity}</span>
                <span onclick="modifyQty(${idx}, 1)" style="cursor:pointer; font-weight:900;">+</span>
            </div>
        </div>
    `).join('');
    runLogisticsCalculation();
    renderSmartSuggestions();
}
function modifyQty(index, value) {
    local_cart[index].quantity += value;
    if (local_cart[index].quantity <= 0) local_cart.splice(index, 1);
    commitCartChanges();
}
function runLogisticsCalculation() {
    const subtotal = local_cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    const distanceKm = parseFloat(document.getElementById('form-km').value) || 0;
    
    let deliveryFee = (subtotal >= APP_CONFIG.FREE_DELIVERY_MIN) ? 0 : (distanceKm * APP_CONFIG.KM_PRICE);
    
    // Mínimo de envío para distancias ínfimas
    if (deliveryFee > 0 && deliveryFee < 8) deliveryFee = 8; 
    document.getElementById('step1-total').innerText = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('final-subtotal').innerText = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('final-shipping').innerText = deliveryFee === 0 ? "GRATIS" : `S/ ${deliveryFee.toFixed(2)}`;
    document.getElementById('final-total').innerText = `S/ ${(subtotal + deliveryFee).toFixed(2)}`;
    // Barra de progreso dinámico
    const progressPercent = Math.min(100, (subtotal / APP_CONFIG.FREE_DELIVERY_MIN) * 100);
    document.getElementById('ship-progress-bar').style.width = `${progressPercent}%`;
    const messageElement = document.getElementById('ship-msg-text');
    
    if (subtotal >= APP_CONFIG.FREE_DELIVERY_MIN) {
        messageElement.innerHTML = "<span style='color:var(--jst-wa)'>¡Envío Gratis Desbloqueado!</span>";
    } else {
        messageElement.innerHTML = `S/ ${(APP_CONFIG.FREE_DELIVERY_MIN - subtotal).toFixed(2)} adicionales para envío gratis`;
    }
}
// --- UBER LOGISTICS ENGINE ---
function goToStep(stepNumber) {
    const cartElement = document.getElementById('side-cart');
    if (stepNumber === 2) {
        cartElement.classList.add('step-2');
        setTimeout(initLogisticsMap, 550);
    } else {
        cartElement.classList.remove('step-2');
    }
}
function initLogisticsMap() {
    if (main_map_instance) {
        main_map_instance.invalidateSize();
        return;
    }
    main_map_instance = L.map('order-map', { zoomControl: false }).setView([APP_CONFIG.STORE_LOCATION.lat, APP_CONFIG.STORE_LOCATION.lng], 15);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; JstoreR Maps'
    }).addTo(main_map_instance);
    const customPin = L.divIcon({
        html: `<div style="background:var(--jst-dark); width:34px; height:34px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:3px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 15px rgba(0,0,0,0.3);"><i class="fas fa-home" style="transform:rotate(45deg); color:white; font-size:14px;"></i></div>`,
        className: '', iconSize: [34, 34], iconAnchor: [17, 34]
    });
    delivery_marker = L.marker([APP_CONFIG.STORE_LOCATION.lat, APP_CONFIG.STORE_LOCATION.lng], {
        icon: customPin,
        draggable: true
    }).addTo(main_map_instance);
    delivery_marker.on('dragend', function() {
        const position = delivery_marker.getLatLng();
        handleMapPositionChange(position.lat, position.lng);
    });
    getCurrentLocation();
}
async function handleMapPositionChange(lat, lng) {
    // 1. Haversine Calculation
    const dist = getPreciseDistance(APP_CONFIG.STORE_LOCATION.lat, APP_CONFIG.STORE_LOCATION.lng, lat, lng);
    document.getElementById('form-km').value = dist.toFixed(2);
    
    // 2. Reverse Geocoding (Nominatim API)
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`);
        const addressData = await response.json();
        if (addressData.display_name) {
            const addressParts = addressData.display_name.split(',');
            // Tomamos calle, número y distrito
            document.getElementById('form-address').value = addressParts.slice(0, 3).join(',');
        }
    } catch (e) { console.warn("Reverse Geocoding Unavailable"); }
    
    runLogisticsCalculation();
    validateForm();
}
function getPreciseDistance(lat1, lon1, lat2, lon2) {
    const Radius = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return Radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        main_map_instance.setView([userLat, userLng], 16);
        delivery_marker.setLatLng([userLat, userLng]);
        handleMapPositionChange(userLat, userLng);
    }, null, { enableHighAccuracy: true });
}
// --- FORMULARIO Y WHATSAPP ---
function validateForm() {
    const name = document.getElementById('form-name').value;
    const addr = document.getElementById('form-address').value;
    const phone = document.getElementById('form-phone').value;
    const btn = document.getElementById('btn-finish');
    
    if (name.trim().length > 3 && addr.trim().length > 6 && phone.trim().length >= 9) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
}
function sendOrder() {
    const clientName = document.getElementById('form-name').value;
    const address = document.getElementById('form-address').value;
    const phone = document.getElementById('form-phone').value;
    const totalPayable = document.getElementById('final-total').innerText;
    const kmTravel = document.getElementById('form-km').value;
    let messageBody = `*NUEVO PEDIDO JSTORE-R*\n\n`;
    local_cart.forEach(item => messageBody += `• ${item.name} (x${item.quantity})\n`);
    messageBody += `\n*RESUMEN FINANCIERO:*`;
    messageBody += `\nSubtotal: ${document.getElementById('final-subtotal').innerText}`;
    messageBody += `\nEnvío: ${document.getElementById('final-shipping').innerText} (${kmTravel} km)`;
    messageBody += `\n*TOTAL A PAGAR: ${totalPayable}*`;
    messageBody += `\n\n*DATOS LOGÍSTICOS:*`;
    messageBody += `\n👤 Cliente: ${clientName}\n📍 Punto: ${address}\n📱 Contacto: ${phone}`;
    
    window.open(`https://wa.me/${APP_CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(messageBody)}`, '_blank');
}
// --- UI UTILITIES ---
function initGoldDustEffect() {
    const canvas = document.getElementById('gold-dust-layer');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const particles = Array(30).fill().map(() => ({ 
        x: Math.random() * canvas.width, 
        y: Math.random() * canvas.height, 
        speed: Math.random() * 0.4 + 0.1 
    }));
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(199, 106, 58, 0.3)";
        particles.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.fill();
            p.y -= p.speed; if (p.y < 0) p.y = canvas.height;
        });
        requestAnimationFrame(animate);
    }
    animate();
}
function openQuickView(id) {
    const product = MASTER_CATALOG.find(x => x.id === id);
    if (!product) return;
    document.getElementById('qv-img').src = product.imageUrl;
    document.getElementById('qv-cat').innerText = product.category;
    document.getElementById('qv-name').innerText = product.name;
    document.getElementById('qv-price').innerText = `S/ ${product.price.toFixed(2)}`;
    document.getElementById('qv-desc').innerText = product.description;
    document.getElementById('quick-view-modal').classList.add('active');
}
function closeQuickView() { document.getElementById('quick-view-modal').classList.remove('active'); }
function showPopup(msg) {
    const toast = document.getElementById('toast-notify');
    toast.innerText = msg; toast.style.bottom = "30px";
    setTimeout(() => toast.style.bottom = "-100px", 2800);
}
function toggleFaq(el) { el.classList.toggle('active'); }
function handleSmartFilter() { renderProductGrid(); }
function renderCategories() {
    const cats = ["Todas", ...new Set(MASTER_CATALOG.map(p => p.category).filter(Boolean))];
    document.getElementById('category-pills-render').innerHTML = cats.map(c => 
        `<div class="pill-item" onclick="applyCategoryFilter(this, '${c}')">${c}</div>`
    ).join('');
}
function applyCategoryFilter(element, category) {
    document.querySelectorAll('.pill-item').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
    const grid = document.getElementById('main-grid');
    const filtered = (category === "Todas") ? MASTER_CATALOG : MASTER_CATALOG.filter(p => p.category === category);
    
    grid.innerHTML = filtered.map(p => `
        <div class="card-item">
            <div class="card-img-container" onclick="openQuickView('${p.id}')"><img src="${p.imageUrl}"></div>
            <div style="flex:1;"><h4 style="font-size:1rem; margin:5px 0;">${p.name}</h4></div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:900; font-size:1.4rem;">S/ ${p.price.toFixed(2)}</span>
                <button class="cart-trigger" onclick="addProductToCart('${p.id}')" style="background:var(--jst-gold); color:white; border:none; width:42px; height:42px; border-radius:12px;"><i class="fas fa-plus"></i></button>
            </div>
        </div>`).join('');
}
function renderSmartSuggestions() {
    const cartIds = local_cart.map(x => x.id);
    const suggested = MASTER_CATALOG.filter(p => !cartIds.includes(p.id) && p.stockCount > 0).slice(0, 4);
    const suggestArea = document.getElementById('suggestions-area');
    
    if(suggested.length > 0 && local_cart.length > 0) {
        suggestArea.style.display = 'block';
        document.getElementById('suggestions-render').innerHTML = suggested.map(s => `
            <div class="mini-card-sug" onclick="addProductToCart('${s.id}')" style="min-width:115px; cursor:pointer;">
                <img src="${s.imageUrl}" style="width:100%; height:85px; object-fit:cover; border-radius:12px;">
                <div style="font-size:0.75rem; font-weight:800; margin-top:6px; color:var(--jst-dark);">S/ ${s.price}</div>
            </div>`).join('');
    } else { suggestArea.style.display = 'none'; }
}
function openReviewModal() { alert("Nuestro sistema de valoraciones se abrirá en una nueva pestaña."); }