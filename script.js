
// CONFIG
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOKWE4Wyh_N_pt12iDlXx_garwZHFKRcE19DRoKSa2Cb_v3KoSmcQcJXRS2MdrfB7Bso-DqSXdINSt/pub?gid=0&single=true&output=csv";
const FREE_SHIPPING_THRESHOLD = 500;
let CATALOG_DB = [];
let state_cart = JSON.parse(localStorage.getItem('jst_master_cart')) || [];
let current_category = "Todas";
window.onload = async () => {
    await fetchProducts();
    renderPills();
    refreshCartUI();
};
// FETCH
async function fetchProducts(){
    const res = await fetch(GOOGLE_SHEET_URL);
    const csv = await res.text();
    CATALOG_DB = parseCSV(csv);
    renderCollection();
}
function parseCSV(csv){
    const lines = csv.split('\n');
    const result=[];
    for(let i=1;i<lines.length;i++){
        const p = lines[i].split(',');
        if(p.length>=5){
            result.push({
                id:p[0],
                name:p[1],
                cat:p[2],
                price:parseFloat(p[3]),
                img:p[4],
                desc:p[5]||"",
                stock:parseInt(p[6])||0
            });
        }
    }
    return result;
}
// RENDER
function renderCollection(){
    const grid=document.getElementById('main-grid');
    grid.innerHTML = CATALOG_DB.map(p=>`
        <article class="card-item">
            <img src="${p.img}">
            <h3>${p.name}</h3>
            <span>S/ ${p.price.toFixed(2)}</span>
            <button onclick="addItemToCart('${p.id}')">+</button>
        </article>
    `).join('');
}
function renderPills(){
    const pills=document.getElementById('category-pills-render');
    const cats=["Todas",...new Set(CATALOG_DB.map(p=>p.cat))];
    pills.innerHTML=cats.map(c=>`
        <div class="pill-item" onclick="setCategory('${c}')">${c}</div>
    `).join('');
}
function setCategory(c){
    current_category=c;
    renderCollection();
}
// CARRITO
function addItemToCart(id){
    const prod=CATALOG_DB.find(p=>p.id==id);
    if(!prod) return;
    const item=state_cart.find(i=>i.id==id);
    if(item) item.qty++;
    else state_cart.push({...prod,qty:1});
    updateCart();
}
function updateCart(){
    localStorage.setItem('jst_master_cart',JSON.stringify(state_cart));
    refreshCartUI();
}
function refreshCartUI(){
    const count=state_cart.reduce((a,b)=>a+b.qty,0);
    const badge=document.getElementById('cart-badge');
    badge.textContent=count;
    badge.style.display=count?'flex':'none';
}
function toggleCart(open){
    document.getElementById('side-cart').classList.toggle('open',open);
}
