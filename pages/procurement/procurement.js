(function(){
  async function initializeProcurementPage(){
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

    const billFormTitle = document.getElementById('bill-form-title');
    const cancelEditBtn = document.getElementById('cancel-bill-edit-btn');

    let currentItemRow = null;
    let editingBillId = null;
    let items = [];
    let bills = [];

    const ensureSupabase = async () => {
      if (!(window.SupabaseSvc && SupabaseSvc.ensureReady)) throw new Error('Supabase client not loaded');
      await SupabaseSvc.ensureReady();
    };

    const shortId = (id) => {
      const s = String(id || '');
      if (s.length <= 8) return s;
      return s.slice(0, 4) + '…' + s.slice(-4);
    };

    const loadItems = async () => {
      await ensureSupabase();
      items = await SupabaseSvc.listItems(500);
    };

    const loadBills = async () => {
      await ensureSupabase();
      // Prefer the RPC if installed; fall back to table query.
      try {
        const res = await SupabaseSvc.lastBills(50);
        if (Array.isArray(res)) {
          bills = res.map(b => ({
            id: b.id,
            date: b.created_at || b.date || new Date().toISOString(),
            paymentMethod: b.payment_method || b.paymentMethod || 'cash',
            paid: Number(b.paid || 0),
            total: Number(b.total || 0),
            remaining: Number(b.remaining || 0),
            items: (b.items || b.bill_items || []).map(it => ({
              itemId: it.item_id ?? it.itemId,
              itemName: it.item_name ?? it.itemName ?? it.name ?? '—',
              qty: Number(it.qty || 0),
              buyPrice: Number(it.buy_price ?? it.buyPrice ?? 0),
              sellPrice: Number(it.sell_price ?? it.sellPrice ?? 0),
            })),
          }));
          return;
        }
      } catch (e) {
        // ignore and fall through
      }

      const { data, error } = await SupabaseSvc._client
        .from('bills')
        .select('id,created_at,payment_method,paid,total,remaining,bill_items(item_id,qty,buy_price,sell_price,item:items(name))')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      bills = (data || []).map(b => ({
        id: b.id,
        date: b.created_at,
        paymentMethod: b.payment_method || 'cash',
        paid: Number(b.paid || 0),
        total: Number(b.total || 0),
        remaining: Number(b.remaining || 0),
        items: (b.bill_items || []).map(it => ({
          itemId: it.item_id,
          itemName: (it.item && it.item.name) ? it.item.name : '—',
          qty: Number(it.qty || 0),
          buyPrice: Number(it.buy_price || 0),
          sellPrice: Number(it.sell_price || 0),
        })),
      }));
    };

    const calculateTotals = () => {
      let total = 0;
      billItemsContainer.querySelectorAll('.bill-item-row').forEach(row => {
        let qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        let price = parseFloat(row.querySelector('.item-buy-price').value) || 0;
        if (qty < 0) qty = 0;
        if (!Number.isFinite(qty)) qty = 0;
        qty = Math.floor(qty);
        row.querySelector('.item-qty').value = qty;
        if (price < 0) price = 0;
        if (!Number.isFinite(price)) price = 0;
        row.querySelector('.item-buy-price').value = price;
        const subtotal = qty * price;
        row.querySelector('.item-subtotal').textContent = subtotal.toFixed(2);
        total += subtotal;
      });
      billTotalEl.textContent = total.toFixed(2);

      let paid = parseFloat(amountPaidInput.value) || 0;
      if (!Number.isFinite(paid) || paid < 0) paid = 0;
      if (paid > total) paid = total;
      amountPaidInput.value = paid.toFixed(2);

      const remaining = Math.max(0, total - paid);
      billRemainingEl.textContent = remaining.toFixed(2);
      billRemainingEl.style.color = remaining > 0 ? '#e74c3c' : 'var(--dark-blue)';
    };

    const fillPricesForRow = (itemId, row) => {
      if (!itemId) return;
      const it = items.find(i => String(i.id) === String(itemId));
      if (!it) return;
      const buyEl = row.querySelector('.item-buy-price');
      const sellEl = row.querySelector('.item-sell-price');
      if (buyEl && it.last_buy_price != null) buyEl.value = Number(it.last_buy_price).toFixed(2);
      if (sellEl && it.sell_price != null) sellEl.value = Number(it.sell_price);
    };

    const createBillItemRow = () => {
      const row = document.createElement('div');
      row.className = 'bill-item-row';
      const recentItems = items.slice(0, 6);
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
        <div class="subtotal-group"><span class="item-subtotal">0.00</span><button type="button" class="remove-item-row-btn">&times;</button></div>
      `;

      row.querySelector('.remove-item-row-btn').addEventListener('click', () => {
        row.remove();
        calculateTotals();
      });

      row.querySelector('.more-items-btn').addEventListener('click', () => {
        currentItemRow = row;
        itemSearchModal.style.display = 'block';
        renderItemSearchResults('');
      });

      row.querySelector('.item-select').addEventListener('change', () => {
        const selected = row.querySelector('.item-select').value;
        fillPricesForRow(selected, row);
        row.querySelector('.item-buy-price').focus();
      });

      const qtyInput = row.querySelector('.item-qty');
      const buyInput = row.querySelector('.item-buy-price');
      const sellInput = row.querySelector('.item-sell-price');

      const ensureNonNegativeInteger = (el) => {
        let v = parseFloat(el.value) || 0;
        if (!Number.isFinite(v) || v < 0) v = 0;
        v = Math.floor(v);
        el.value = v;
      };
      qtyInput.addEventListener('input', () => { ensureNonNegativeInteger(qtyInput); calculateTotals(); });
      buyInput.addEventListener('input', () => { if (parseFloat(buyInput.value) < 0) buyInput.value = 0; calculateTotals(); });
      sellInput.addEventListener('input', () => { if (parseFloat(sellInput.value) < 0) sellInput.value = 0; calculateTotals(); });

      billItemsContainer.appendChild(row);
      return row;
    };

    const renderBillDetails = (bill) => {
      billDetailsTitle.textContent = `تفاصيل الفاتورة #${shortId(bill.id)}`;
      const itemsTable = `
        <table>
          <thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الشراء</th><th>الإجمالي الجزئي</th></tr></thead>
          <tbody>
            ${(bill.items || []).map(item => `
              <tr><td>${item.itemName}</td><td>${item.qty}</td><td>${Number(item.buyPrice).toFixed(2)}</td><td>${(Number(item.qty) * Number(item.buyPrice)).toFixed(2)}</td></tr>
            `).join('')}
          </tbody>
        </table>`;
      const summaryDetails = `
        <div id="bill-details-summary">
          <div>
            <div class="summary-row"><span>الإجمالي:</span><span>${Number(bill.total).toFixed(2)}</span></div>
            <div class="summary-row"><span>المدفوع:</span><span>${Number(bill.paid).toFixed(2)}</span></div>
            <div class="summary-row remaining"><span>المتبقي:</span><span>${Number(bill.remaining).toFixed(2)}</span></div>
            <div class="summary-row"><span>طريقة الدفع:</span><span>${bill.paymentMethod === 'cash' ? 'نقدي' : 'بطاقة'}</span></div>
            <div class="summary-row"><span>التاريخ:</span><span>${new Date(bill.date).toLocaleString()}</span></div>
          </div>
        </div>`;
      billDetailsContent.innerHTML = itemsTable + summaryDetails;
      billDetailsContainer.style.display = 'block';
    };

    const renderRecentBills = (filterQuery = '') => {
      recentBillsList.innerHTML = '';
      const q = String(filterQuery || '').trim();
      const filteredBills = bills
        .filter(bill => !q || String(bill.id).includes(q))
        .slice(0, 10);

      if (filteredBills.length === 0) {
        recentBillsList.innerHTML = '<p>لا توجد فواتير تطابق البحث.</p>';
        return;
      }

      filteredBills.forEach(bill => {
        const card = document.createElement('div');
        card.className = 'recent-bill-card';
        card.dataset.billId = bill.id;
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div>
              <strong>فاتورة #${shortId(bill.id)}</strong>
              <div style="font-size:12px;color:var(--vienna-muted);">${new Date(bill.date).toLocaleDateString()}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="btn btn-sm btn-outline-secondary view-bill-btn">عرض</button>
              <button class="btn btn-sm btn-outline-primary edit-bill-btn">تعديل</button>
              <button class="btn btn-sm btn-outline-danger delete-bill-btn">حذف</button>
            </div>
          </div>`;

        card.querySelector('.view-bill-btn').addEventListener('click', (ev) => {
          ev.stopPropagation();
          document.querySelectorAll('.recent-bill-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          renderBillDetails(bill);
        });

        card.querySelector('.edit-bill-btn').addEventListener('click', (ev) => {
          ev.stopPropagation();
          beginEditBill(bill);
        });

        card.querySelector('.delete-bill-btn').addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const ok = window.confirm('هل أنت متأكد أنك تريد حذف هذه الفاتورة؟');
          if (!ok) return;
          try {
            await ensureSupabase();
            await SupabaseSvc.deleteProcurement(String(bill.id));
            if (String(editingBillId) === String(bill.id)) cancelEdit();
            await loadBills();
            renderRecentBills(billSearchInput.value || '');
            billDetailsContainer.style.display = 'none';
            if (window.Vienna && Vienna.toast) Vienna.toast('تم حذف الفاتورة.', 'info');
          } catch (e) {
            console.error(e);
            if (window.Vienna && Vienna.toast) Vienna.toast('تعذر حذف الفاتورة. تحقق من الاتصال والصلاحيات.', 'error');
          }
        });

        card.addEventListener('click', () => {
          document.querySelectorAll('.recent-bill-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          renderBillDetails(bill);
        });

        recentBillsList.appendChild(card);
      });
    };

    const renderItemSearchResults = (query) => {
      itemSearchResults.innerHTML = '';
      const q = (query || '').toLowerCase().trim();
      const filteredItems = items.filter(item => (item.name || '').toLowerCase().includes(q));
      filteredItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'search-result-item';
        itemEl.innerHTML = `<img src="${item.image || 'https://placehold.co/100x100/bde8f5/0f2854?text=??'}" alt=""><span>${item.name}</span>`;
        itemEl.addEventListener('click', () => {
          if (currentItemRow) {
            const select = currentItemRow.querySelector('.item-select');
            if (!select.querySelector(`option[value="${item.id}"]`)) select.add(new Option(item.name, item.id, true, true));
            select.value = item.id;
            fillPricesForRow(item.id, currentItemRow);
            currentItemRow.querySelector('.item-buy-price').focus();
          }
          itemSearchModal.style.display = 'none';
        });
        itemSearchResults.appendChild(itemEl);
      });
    };

    const beginEditBill = (bill) => {
      if (!bill) return;
      editingBillId = bill.id;
      billItemsContainer.innerHTML = '';
      (bill.items || []).forEach(it => {
        const row = createBillItemRow();
        const select = row.querySelector('.item-select');
        if (!select.querySelector(`option[value="${it.itemId}"]`)) select.add(new Option(it.itemName, it.itemId, true, true));
        select.value = it.itemId;
        row.querySelector('.item-qty').value = it.qty;
        row.querySelector('.item-buy-price').value = Number(it.buyPrice).toFixed(2);
        row.querySelector('.item-sell-price').value = (it.sellPrice != null) ? Number(it.sellPrice) : '';
      });
      document.getElementById('payment-method').value = bill.paymentMethod || 'cash';
      amountPaidInput.value = Number(bill.paid || 0).toFixed(2);
      calculateTotals();
      if (billFormTitle) billFormTitle.textContent = `تعديل الفاتورة #${shortId(bill.id)}`;
      if (cancelEditBtn) cancelEditBtn.style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
      editingBillId = null;
      billItemsContainer.innerHTML = '';
      billForm.reset();
      createBillItemRow();
      calculateTotals();
      if (billFormTitle) billFormTitle.textContent = 'فاتورة جديدة';
      if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    };

    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

    billForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const billItems = [];
      let valid = true;
      billItemsContainer.querySelectorAll('.bill-item-row').forEach(row => {
        const itemId = row.querySelector('.item-select').value;
        if (!itemId) { valid = false; return; }
        const qty = Math.floor(parseFloat(row.querySelector('.item-qty').value) || 0);
        const buyPrice = parseFloat(row.querySelector('.item-buy-price').value) || 0;
        const sellPrice = parseFloat(row.querySelector('.item-sell-price').value) || 0;
        billItems.push({ item_id: itemId, qty, buy_price: buyPrice, sell_price: sellPrice });
      });
      if (!valid || billItems.length === 0) { alert('الرجاء إضافة صنف واحد على الأقل واختياره.'); return; }
      for (const it of billItems) {
        if (!Number.isFinite(it.qty) || it.qty <= 0) { alert('الكمية يجب أن تكون أكبر من صفر.'); return; }
        if (!Number.isFinite(it.buy_price) || it.buy_price < 0) { alert('سعر الشراء غير صالح.'); return; }
      }

      try {
        await ensureSupabase();
        const paymentMethod = document.getElementById('payment-method').value;
        const paid = parseFloat(amountPaidInput.value) || 0;
        if (editingBillId) {
          await SupabaseSvc.updateProcurement(String(editingBillId), paymentMethod, paid, billItems);
          if (window.Vienna && Vienna.toast) Vienna.toast('تم تحديث الفاتورة.', 'success');
        } else {
          await SupabaseSvc.createProcurement(paymentMethod, paid, billItems);
          if (window.Vienna && Vienna.toast) Vienna.toast('تم حفظ الفاتورة.', 'success');
        }
        await loadBills();
        cancelEdit();
        renderRecentBills(billSearchInput.value || '');
        billDetailsContainer.style.display = 'none';
      } catch (e2) {
        console.error(e2);
        const msg = String(e2?.message || e2?.error_description || e2?.details || e2 || '').trim();
        if (window.Vienna && Vienna.toast) {
          Vienna.toast(msg ? `تعذر حفظ الفاتورة: ${msg}` : 'تعذر حفظ الفاتورة. تحقق من الاتصال والصلاحيات.', 'error');
        }
      }
    });

    addBillItemBtn.addEventListener('click', createBillItemRow);
    amountPaidInput.addEventListener('input', calculateTotals);
    billSearchInput.addEventListener('input', (e) => renderRecentBills(e.target.value));
    itemSearchInput.addEventListener('input', (e) => renderItemSearchResults(e.target.value));
    closeItemSearchBtn.addEventListener('click', () => itemSearchModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target == itemSearchModal) itemSearchModal.style.display = 'none'; });

    try {
      await loadItems();
      await loadBills();
      createBillItemRow();
      calculateTotals();
      renderRecentBills();
    } catch (e) {
      console.error(e);
      recentBillsList.innerHTML = '<p>لا يمكن تحميل بيانات المشتريات. تأكد من إعداد Supabase.</p>';
      if (window.Vienna && Vienna.toast) Vienna.toast('Supabase غير جاهز. لا يمكن تحميل المشتريات.', 'error');
    }
  }

  initializeProcurementPage();
})();
