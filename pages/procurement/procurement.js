(function(){
  function initializeProcurementPage(){
    const billForm = document.getElementById('bill-form');
    if (!billForm) return;

    const billItemsContainer = document.getElementById('bill-items-container');
    const addBillItemBtn = document.getElementById('add-bill-item-btn');
    const billTotalEl = document.getElementById('bill-total');
    const amountPaidInput = document.getElementById('amount-paid');
    const billRemainingEl = document.getElementById('bill-remaining');
    const recentBillsList = document.getElementById('recent-bills-list');
    const billSearchInput = document.getElementById('bill-search');
    const billDetailsContainer = document.getElementById('bill-details-container');
    const billDetailsTitle = document.getElementById('bill-details-title');
    const billDetailsContent = document.getElementById('bill-details-content');

    const itemSearchModal = document.getElementById('item-search-modal');
    const itemSearchInput = document.getElementById('item-search-input');
    const itemSearchResults = document.getElementById('item-search-results');
    const closeItemSearchBtn = itemSearchModal.querySelector('.close-btn');

    let currentItemRow = null;
    let bills = Vienna.storage.get('vienna-bills', []);

    const calculateTotals = () => {
      let total = 0;
      billItemsContainer.querySelectorAll('.bill-item-row').forEach(row => {
        let qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        let price = parseFloat(row.querySelector('.item-buy-price').value) || 0;
        if (qty < 0) qty = 0;
        if (!Number.isFinite(qty)) qty = 0;
        qty = Math.floor(qty);
        row.querySelector('.item-qty').value = qty;
        if (price < 0) price = 0; if (!Number.isFinite(price)) price = 0; row.querySelector('.item-buy-price').value = price;
        const subtotal = qty * price; row.querySelector('.item-subtotal').textContent = subtotal.toFixed(2); total += subtotal;
      });
      billTotalEl.textContent = total.toFixed(2);

      let paid = parseFloat(amountPaidInput.value) || 0;
      if (!Number.isFinite(paid) || paid < 0) paid = 0;
      // لا نسمح بأن يصبح "المدفوع" أكبر من الإجمالي حتى لا يصبح "الباقي" سالبًا
      if (paid > total) paid = total;
      amountPaidInput.value = paid.toFixed(2);

      const remaining = Math.max(0, total - paid);
      billRemainingEl.textContent = remaining.toFixed(2);
      billRemainingEl.style.color = remaining > 0 ? '#e74c3c' : 'var(--dark-blue)';
    };

    const createBillItemRow = () => {
      const row = document.createElement('div'); row.className = 'bill-item-row';
      const itemsLocal = Vienna.storage.get('vienna-items', []) || [];
      const recentItems = itemsLocal.slice(-5);
      const options = recentItems.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
      row.innerHTML = `
        <div class="form-group">
          <div class="item-select-wrapper">
            <select class="item-select">
              <option value="">اختر صنف...</option>
              ${options}
            </select>
            <button type="button" class="more-items-btn">المزيد</button>
          </div>
        </div>
        <div class="form-group"><input type="number" class="item-qty" placeholder="الكمية" min="1" value="1"></div>
        <div class="form-group"><input type="number" class="item-buy-price" placeholder="سعر الشراء" min="0" step="0.01"></div>
        <div class="form-group"><input type="number" class="item-sell-price" placeholder="سعر البيع" min="0" step="0.01"></div>
        <div class="subtotal-group"><span class="item-subtotal">0.00</span><button type="button" class="remove-item-row-btn">&times;</button></div>`;

      row.querySelector('.remove-item-row-btn').addEventListener('click', () => { row.remove(); calculateTotals(); });
      row.querySelector('.more-items-btn').addEventListener('click', () => { currentItemRow = row; itemSearchModal.style.display = 'block'; renderItemSearchResults(''); });
      row.querySelector('.item-select').addEventListener('change', () => row.querySelector('.item-buy-price').focus());
      const qtyInput = row.querySelector('.item-qty'); const buyInput = row.querySelector('.item-buy-price'); const sellInput = row.querySelector('.item-sell-price');
      const ensureNonNegativeInteger = (el) => { let v = parseFloat(el.value) || 0; if (!Number.isFinite(v) || v < 0) v = 0; v = Math.floor(v); el.value = v; };
      qtyInput.addEventListener('input', () => { ensureNonNegativeInteger(qtyInput); calculateTotals(); });
      buyInput.addEventListener('input', () => { if (parseFloat(buyInput.value) < 0) buyInput.value = 0; calculateTotals(); });
      sellInput.addEventListener('input', () => { if (parseFloat(sellInput.value) < 0) sellInput.value = 0; calculateTotals(); });

      billItemsContainer.appendChild(row); return row;
    };

    const renderBillDetails = (bill) => {
      billDetailsTitle.textContent = `تفاصيل الفاتورة #${bill.id}`;
      const itemsTable = `
        <table>
          <thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الشراء</th><th>الإجمالي الجزئي</th></tr></thead>
          <tbody>
            ${bill.items.map(item => `
              <tr><td>${item.itemName}</td><td>${item.qty}</td><td>${item.buyPrice.toFixed(2)}</td><td>${(item.qty * item.buyPrice).toFixed(2)}</td></tr>
            `).join('')}
          </tbody>
        </table>`;
      const summaryDetails = `
        <div id="bill-details-summary">
          <div>
            <div class="summary-row"><span>الإجمالي:</span><span>${bill.total.toFixed(2)}</span></div>
            <div class="summary-row"><span>المدفوع:</span><span>${bill.paid.toFixed(2)}</span></div>
            <div class="summary-row remaining"><span>المتبقي:</span><span>${bill.remaining.toFixed(2)}</span></div>
            <div class="summary-row"><span>طريقة الدفع:</span><span>${bill.paymentMethod === 'cash' ? 'نقدي' : 'بطاقة'}</span></div>
            <div class="summary-row"><span>التاريخ:</span><span>${new Date(bill.date).toLocaleString()}</span></div>
          </div>
        </div>`;
      billDetailsContent.innerHTML = itemsTable + summaryDetails; billDetailsContainer.style.display = 'block';
    };

    const renderRecentBills = (filterQuery = '') => {
      recentBillsList.innerHTML = '';
      const filteredBills = bills.filter(bill => bill.id.toString().includes(filterQuery)).slice(-10).reverse();
      if (filteredBills.length === 0) { recentBillsList.innerHTML = '<p>لا توجد فواتير تطابق البحث.</p>'; return; }
      filteredBills.forEach(bill => {
        const card = document.createElement('div'); card.className = 'recent-bill-card'; card.dataset.billId = bill.id;
        card.innerHTML = `<strong>فاتورة #${bill.id}</strong><span>${new Date(bill.date).toLocaleDateString()}</span>`;
        card.addEventListener('click', () => { document.querySelectorAll('.recent-bill-card').forEach(c => c.classList.remove('selected')); card.classList.add('selected'); renderBillDetails(bill); });
        recentBillsList.appendChild(card);
      });
    };

    const renderItemSearchResults = (query) => {
      itemSearchResults.innerHTML = '';
      const itemsLocal = Vienna.storage.get('vienna-items', []) || [];
      const filteredItems = itemsLocal.filter(item => (item.name || '').toLowerCase().includes(query.toLowerCase()));
      filteredItems.forEach(item => {
        const itemEl = document.createElement('div'); itemEl.className = 'search-result-item';
        itemEl.innerHTML = `<img src="${item.image || 'https://placehold.co/100x100/bde8f5/0f2854?text=??'}" alt=""><span>${item.name}</span>`;
        itemEl.addEventListener('click', () => {
          if (currentItemRow) {
            const select = currentItemRow.querySelector('.item-select');
            if (!select.querySelector(`option[value="${item.id}"]`)) select.add(new Option(item.name, item.id, true, true));
            select.value = item.id; currentItemRow.querySelector('.item-buy-price').focus();
          }
          itemSearchModal.style.display = 'none';
        });
        itemSearchResults.appendChild(itemEl);
      });
    };

    billForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const billItems = []; let valid = true;
      billItemsContainer.querySelectorAll('.bill-item-row').forEach(row => {
        const itemId = row.querySelector('.item-select').value; if (!itemId) { valid = false; return; }
        const qty = Math.floor(parseFloat(row.querySelector('.item-qty').value) || 0);
        const buyPrice = parseFloat(row.querySelector('.item-buy-price').value) || 0;
        const sellPrice = parseFloat(row.querySelector('.item-sell-price').value) || 0;
        billItems.push({ itemId, itemName: row.querySelector('.item-select').options[row.querySelector('.item-select').selectedIndex].text, qty, buyPrice, sellPrice });
      });
      if (!valid || billItems.length === 0) { alert('الرجاء إضافة صنف واحد على الأقل واختياره.'); return; }

      // مشتريات = إضافة للمخزن، لذلك لا يوجد حد أعلى مرتبط بالمخزون هنا
      for (const it of billItems) {
        if (!Number.isFinite(it.qty) || it.qty <= 0) { alert(`الكمية للصنف "${it.itemName}" يجب أن تكون أكبر من صفر.`); return; }
        if (!Number.isFinite(it.buyPrice) || it.buyPrice < 0) { alert(`سعر الشراء للصنف "${it.itemName}" غير صالح.`); return; }
      }

      const newBill = {
        id: Date.now(), date: new Date().toISOString(), items: billItems,
        paymentMethod: document.getElementById('payment-method').value,
        paid: parseFloat(amountPaidInput.value) || 0,
        total: parseFloat(billTotalEl.textContent) || 0,
        remaining: parseFloat(billRemainingEl.textContent) || 0,
      };
      bills.push(newBill); Vienna.storage.set('vienna-bills', bills);

      // مشتريات: تزيد الكميات في المخزن
      const inv = Vienna.storage.get('vienna-inventory', {});
      newBill.items.forEach(it => {
        const id = it.itemId;
        const qty = Math.floor(parseFloat(it.qty) || 0);
        inv[id] = (parseFloat(inv[id]) || 0) + qty;
      });
      Vienna.storage.set('vienna-inventory', inv);

      if (window.Vienna && typeof Vienna.toast === 'function') {
        Vienna.toast('تم حفظ الفاتورة وتحديث المخزن.', 'success');
      }

      billItemsContainer.innerHTML = ''; billForm.reset(); calculateTotals(); createBillItemRow(); renderRecentBills(); billDetailsContainer.style.display = 'none';
    });

    addBillItemBtn.addEventListener('click', createBillItemRow);
    amountPaidInput.addEventListener('input', calculateTotals);
    billSearchInput.addEventListener('input', (e) => renderRecentBills(e.target.value));
    itemSearchInput.addEventListener('input', (e) => renderItemSearchResults(e.target.value));
    closeItemSearchBtn.addEventListener('click', () => itemSearchModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target == itemSearchModal) itemSearchModal.style.display = 'none'; });

    createBillItemRow(); calculateTotals(); renderRecentBills();
  }

  // init
  initializeProcurementPage();
})();
