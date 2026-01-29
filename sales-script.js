const products = [
    { id: 1, name: "طقم قدور جرانيت", price: 120, img: "https://images.unsplash.com/photo-1584990333939-242863db13d7?w=300" },
    { id: 2, name: "خلاط كهربائي", price: 45, img: "https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=300" },
    { id: 3, name: "مكواة بخار", price: 35, img: "https://images.unsplash.com/photo-1590244948168-d4cbf53d4b1a?w=300" },
    { id: 4, name: "مكنسة ذكية", price: 150, img: "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=300" },
    { id: 5, name: "طقم سكاكين", price: 25, img: "https://images.unsplash.com/photo-1593611664164-5b4974aa3959?w=300" }
];

let cart = [];

function init() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = products.map(p => `
        <div class="product-card">
            <img src="${p.img}">
            <div class="p-info">
                <h3>${p.name}</h3>
                <p>${p.price} دينار</p>
                <button class="add-to-cart" onclick="addToCart('${p.name}', ${p.price})">إضافة للسلة</button>
            </div>
        </div>
    `).join('');
}

window.addToCart = (n, p) => {
    let item = cart.find(x => x.n === n);
    if(item) item.q++; else cart.push({n, p, q:1});
    updateCart();
};

function updateCart() {
    document.getElementById('cart-count').innerText = cart.reduce((a, b) => a + b.q, 0);
    document.getElementById('cartItems').innerHTML = cart.map(x => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${x.n} (x${x.q})</span>
            <span>${x.p * x.q} دينار</span>
        </div>
    `).join('');
}

window.toggleCart = () => {
    const m = document.getElementById('cartModal');
    m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
};

document.getElementById('salesForm').onsubmit = (e) => {
    e.preventDefault();
    if(cart.length === 0) return alert("السلة فارغة");
    
    const order = {
        id: Date.now(),
        name: document.getElementById('custName').value,
        phone: document.getElementById('custPhone').value,
        phoneExtra: document.getElementById('custPhoneExtra').value || "لا يوجد",
        address: document.getElementById('custAddress').value,
        items: [...cart], // حفظ المنتجات داخل الطلبية
        total: cart.reduce((a, b) => a + (b.p*b.q), 0),
        status: "جديد",
        driver: "غير محدد",
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', {hour12: false})
    };

    let orders = JSON.parse(localStorage.getItem('orders')) || [];
    orders.unshift(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    
    alert("تم إرسال الطلبية بنجاح");
    cart = []; updateCart(); toggleCart(); e.target.reset();
};

init();