let currentCancelId = null;

function filterOrders() {
    const allOrders = JSON.parse(localStorage.getItem('orders')) || [];
    const searchVal = document.getElementById('f-name-phone').value.toLowerCase();
    const driverVal = document.getElementById('f-driver').value;
    const statusVal = document.getElementById('f-status').value;
    const dateVal = document.getElementById('f-date').value;

    const filtered = allOrders.filter(o => {
        const matchSearch = o.name.toLowerCase().includes(searchVal) || o.phone.includes(searchVal) || o.phoneExtra.includes(searchVal);
        const matchDriver = driverVal === 'all' || o.driver === driverVal;
        const matchStatus = statusVal === 'all' || o.status === statusVal;
        const matchDate = !dateVal || o.date === dateVal;
        return matchSearch && matchDriver && matchStatus && matchDate;
    });

    render(filtered);
    updateStats(allOrders);
}

function render(orders) {
    const list = document.getElementById('ordersList');
    list.innerHTML = orders.map(o => `
        <div class="order-card ${o.status.replace(/ /g, '-')}">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:5px;">
                <strong>${o.name}</strong>
                <small>${o.date} | ${o.time}</small>
            </div>
            
            <div class="order-details">
                <p>📍 <b>العنوان:</b> ${o.address}</p>
                <p>📞 <b>الأساسي:</b> ${o.phone} | <b>الاحتياطي:</b> ${o.phoneExtra}</p>
                <div class="items-box">
                    <b>📦 المنتجات:</b><br>
                    ${o.items.map(i => `• ${i.n} (الكمية: ${i.q})`).join('<br>')}
                </div>
                <p style="font-size:1.1rem; color:var(--blue); margin-top:10px;"><b>💰 الإجمالي: ${o.total} دينار</b></p>
            </div>

            <div class="contact-row">
                <a href="tel:${o.phone}" class="btn-call">📞 اتصال</a>
                <a href="https://wa.me/${o.phone}" target="_blank" class="btn-wa">💬 واتساب</a>
            </div>

            <select class="status-select" onchange="handleStatusChange(${o.id}, this.value)">
                <option value="" disabled selected>${o.status} (${o.driver})</option>
                <optgroup label="توجيه لمندوب">
                    <option value="أحمد">المندوب أحمد</option>
                    <option value="محمد">المندوب محمد</option>
                    <option value="سعد">المندوب سعد</option>
                </optgroup>
                <optgroup label="تحديث الحالة">
                    <option value="تمت التوصيل">تمت التوصيل ✅</option>
                    <option value="في انتظار التسوية">في انتظار التسوية ⏳</option>
                    <option value="تمت التسوية">تمت التسوية 💰</option>
                    <option value="ملغي">إلغاء الطلبية ❌</option>
                </optgroup>
            </select>
        </div>
    `).join('');
}

function handleStatusChange(id, value) {
    let orders = JSON.parse(localStorage.getItem('orders'));
    let o = orders.find(x => x.id === id);
    const drivers = ["أحمد", "محمد", "سعد"];

    if(drivers.includes(value)) {
        o.status = "مع المندوب";
        o.driver = value;
    } else if(value === "ملغي") {
        currentCancelId = id;
        document.getElementById('cancelModal').style.display = 'flex';
        return;
    } else {
        o.status = value;
    }

    localStorage.setItem('orders', JSON.stringify(orders));
    filterOrders();
}

function confirmCancel() {
    const reason = document.getElementById('cancelReason').value;
    if(!reason) return alert("يرجى كتابة سبب الإلغاء");
    let orders = JSON.parse(localStorage.getItem('orders'));
    let o = orders.find(x => x.id === currentCancelId);
    o.status = "ملغي";
    o.cancelReason = reason;
    localStorage.setItem('orders', JSON.stringify(orders));
    document.getElementById('cancelModal').style.display = 'none';
    filterOrders();
}

function closeModal() { document.getElementById('cancelModal').style.display = 'none'; }

function updateStats(orders) {
    document.getElementById('stat-new').innerText = orders.filter(o => o.status === 'جديد').length;
    document.getElementById('stat-driver').innerText = orders.filter(o => o.status === 'مع المندوب').length;
    const totalSettled = orders.filter(o => o.status === 'تمت التسوية').reduce((a,b) => a + b.total, 0);
    document.getElementById('stat-money').innerText = totalSettled + " دينار";
}

window.onload = filterOrders;