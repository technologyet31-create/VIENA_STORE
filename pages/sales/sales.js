(function(){
  const productsEl = document.getElementById('sales-products');
  const searchEl = document.getElementById('sales-search');
  const cartEl = document.getElementById('sales-cart-items');
  const cartCountEl = document.getElementById('sales-cart-count');
  const cartTotalEl = document.getElementById('sales-cart-total');
  const paymentMethodEl = document.getElementById('sales-payment-method');
  const paidEl = document.getElementById('sales-paid');
  const confirmBtn = document.getElementById('sales-confirm');
  const createOrderBtn = document.getElementById('sales-create-order');
  const clearBtn = document.getElementById('sales-clear');

  const custNameEl = document.getElementById('order-cust-name');
  const custPhoneEl = document.getElementById('order-cust-phone');
  const custPhone2El = document.getElementById('order-cust-phone2');
  const custAddressEl = document.getElementById('order-cust-address');
  const orderNotesEl = document.getElementById('order-notes');

  const state = {
    rows: [],
    filteredRows: [],
    cart: new Map(), // item_id -> { itemId, name, sellPrice, qty }
  };

  const toast = (msg, type='info') => {
    if (window.Vienna && Vienna.toast) return Vienna.toast(msg, type);
    alert(msg);
  };

  const money = (n) => {
    const v = Number(n) || 0;
    return (Math.round(v * 100) / 100).toFixed(2);
  };

  const cartTotal = () => {
    let total = 0;
    for (const line of state.cart.values()) total += (Number(line.sellPrice) || 0) * (Number(line.qty) || 0);
    return total;
  };

  const renderCart = () => {
    if (!cartEl) return;

    const lines = Array.from(state.cart.values());
    const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

    if (cartCountEl) cartCountEl.textContent = String(totalQty);
    if (cartTotalEl) cartTotalEl.textContent = money(cartTotal());

    if (!lines.length) {
      cartEl.innerHTML = '<div class="text-muted">السلة فارغة.</div>';
      return;
    }

    cartEl.innerHTML = lines.map(l => {
      return `
        <div class="cart-row">
          <div style="min-width:0;">
            <div class="name text-truncate">${escapeHtml(l.name || '—')}</div>
            <div class="product-meta">${money(l.sellPrice)} دينار</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <input class="form-control form-control-sm qty-input" type="number" min="1" step="1" value="${Number(l.qty) || 1}" data-action="setQty" data-id="${l.itemId}">
            <button class="btn btn-sm btn-outline-danger" type="button" data-action="remove" data-id="${l.itemId}">
              <i class="bi bi-trash" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  const renderProducts = () => {
    if (!productsEl) return;

    if (!state.filteredRows.length) {
      productsEl.innerHTML = '<div class="text-muted">لا توجد أصناف مطابقة.</div>';
      return;
    }

    productsEl.innerHTML = state.filteredRows.map(r => {
      const item = r.item || r.items || r;
      const qty = Number(r.quantity ?? r.qty ?? 0) || 0;
      const sell = Number(item.sell_price ?? item.sellPrice ?? 0) || 0;
      const canSell = sell > 0;

      return `
        <div class="product-card">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div style="min-width:0">
              <div class="fw-bold text-truncate">${escapeHtml(item.name || '—')}</div>
              <div class="product-meta">المخزون: <b>${qty}</b></div>
            </div>
            <div class="text-nowrap fw-bold">${money(sell)} د</div>
          </div>
          <div class="d-flex align-items-center gap-2 mt-2">
            <input class="form-control form-control-sm" type="number" min="1" step="1" value="1" data-action="qtyInput" data-id="${item.id}">
            <button class="btn btn-sm btn-primary" type="button" data-action="add" data-id="${item.id}" ${canSell ? '' : 'disabled'}>
              إضافة
            </button>
          </div>
          ${canSell ? '' : '<div class="text-danger small mt-2">حدد سعر بيع للصنف في صفحة المخزن.</div>'}
        </div>
      `;
    }).join('');
  };

  const escapeHtml = (str) => {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  const applySearch = () => {
    const q = (searchEl?.value || '').trim().toLowerCase();
    if (!q) state.filteredRows = state.rows.slice();
    else {
      state.filteredRows = state.rows.filter(r => {
        const item = r.item || r.items || r;
        const hay = `${item.name || ''} ${item.description || ''} ${item.qrcode || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    renderProducts();
  };

  const load = async () => {
    await SupabaseSvc.ensureReady();
    const rows = await SupabaseSvc.getInventoryWithItems();
    state.rows = rows || [];
    state.filteredRows = state.rows.slice();
    renderProducts();
    renderCart();
  };

  const addToCart = (itemId, qtyToAdd) => {
    const row = state.rows.find(r => {
      const it = r.item || r.items || r;
      return String(it.id) === String(itemId);
    });
    if (!row) return;

    const item = row.item || row.items || row;
    const sell = Number(item.sell_price ?? 0) || 0;
    if (!(sell > 0)) {
      toast('لا يمكن البيع بدون سعر بيع. عدل السعر في صفحة المخزن.', 'error');
      return;
    }

    const current = state.cart.get(String(item.id)) || { itemId: String(item.id), name: item.name || '—', sellPrice: sell, qty: 0 };
    current.qty = Math.max(1, (Number(current.qty) || 0) + (Number(qtyToAdd) || 1));
    current.sellPrice = sell;
    state.cart.set(String(item.id), current);
    renderCart();
  };

  const onProductsClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const itemId = btn.getAttribute('data-id');

    if (action === 'add') {
      const qtyInput = productsEl.querySelector(`[data-action="qtyInput"][data-id="${CSS.escape(itemId)}"]`);
      const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
      addToCart(itemId, qty);
    }
  };

  const onCartChange = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');

    if (action === 'setQty') {
      const line = state.cart.get(String(id));
      if (!line) return;
      const qty = Math.max(1, Number(el.value) || 1);
      line.qty = qty;
      state.cart.set(String(id), line);
      renderCart();
    }
  };

  const onCartClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');

    if (action === 'remove') {
      state.cart.delete(String(id));
      renderCart();
    }
  };

  const submitSale = async () => {
    const lines = Array.from(state.cart.values());
    if (!lines.length) {
      toast('السلة فارغة.', 'error');
      return;
    }

    const paymentMethod = paymentMethodEl?.value || null;
    const paid = Number(paidEl?.value) || 0;

    confirmBtn?.setAttribute('disabled', 'disabled');
    try {
      if (!(window.SupabaseIntegration && SupabaseIntegration.createSale)) {
        throw new Error('SupabaseIntegration not loaded');
      }

      await SupabaseIntegration.createSale(null, paymentMethod, paid, lines.map(l => ({
        itemId: l.itemId,
        qty: l.qty,
        sellPrice: l.sellPrice,
        discount: 0,
      })));

      toast('تم تسجيل عملية البيع بنجاح.', 'success');
      state.cart.clear();
      renderCart();
      await load();
    } catch (e) {
      console.error(e);
      toast('فشل تسجيل البيع. تحقق من إعداد Supabase والصلاحيات.', 'error');
    } finally {
      confirmBtn?.removeAttribute('disabled');
    }
  };

  const clearCart = () => {
    state.cart.clear();
    renderCart();
  };

  const buildOrderCustomer = () => {
    return {
      name: (custNameEl?.value || '').trim() || null,
      phone: (custPhoneEl?.value || '').trim() || null,
      phoneExtra: (custPhone2El?.value || '').trim() || null,
      address: (custAddressEl?.value || '').trim() || null,
    };
  };

  const buildLegacyOrderNotesJson = (lines) => {
    const customer = buildOrderCustomer();
    const payload = {
      customer,
      lines: (lines || []).map(l => ({
        itemId: String(l.itemId),
        name: String(l.name || ''),
        qty: Number(l.qty) || 0,
        desiredPrice: Number(l.sellPrice) || 0,
      })),
      note: (orderNotesEl?.value || '').trim() || null,
      createdAtClient: new Date().toISOString(),
    };
    return JSON.stringify(payload);
  };

  const submitOrder = async () => {
    const lines = Array.from(state.cart.values());
    if (!lines.length) {
      toast('السلة فارغة.', 'error');
      return;
    }

    createOrderBtn?.setAttribute('disabled', 'disabled');
    try {
      if (!(window.SupabaseIntegration && SupabaseIntegration.createOrder)) {
        throw new Error('SupabaseIntegration not loaded');
      }

      const customer = buildOrderCustomer();
      const freeTextNotes = (orderNotesEl?.value || '').trim() || null;
      const legacyNotes = buildLegacyOrderNotesJson(lines);

      const orderId = await SupabaseIntegration.createOrder(null, lines.map(l => ({
        itemId: l.itemId,
        qty: l.qty,
        desiredPrice: l.sellPrice,
      })), {
        // v2 columns (preferred)
        customerName: customer.name,
        customerPhone: customer.phone,
        customerPhoneExtra: customer.phoneExtra,
        customerAddress: customer.address,
        notes: freeTextNotes,
        // legacy fallback for current schema
        legacyNotes,
      });

      toast(`تم إرسال الطلب بنجاح: ${orderId}`, 'success');
      state.cart.clear();
      renderCart();
      await load();
    } catch (e) {
      console.error(e);
      toast('فشل إرسال الطلب. تحقق من إعداد Supabase والصلاحيات.', 'error');
    } finally {
      createOrderBtn?.removeAttribute('disabled');
    }
  };

  productsEl?.addEventListener('click', onProductsClick);
  cartEl?.addEventListener('click', onCartClick);
  cartEl?.addEventListener('input', onCartChange);
  searchEl?.addEventListener('input', applySearch);
  confirmBtn?.addEventListener('click', submitSale);
  createOrderBtn?.addEventListener('click', submitOrder);
  clearBtn?.addEventListener('click', clearCart);

  (async () => {
    try {
      await load();
    } catch (e) {
      console.error(e);
      toast('لا يمكن تحميل صفحة المبيعات. تأكد من إعداد Supabase.', 'error');
    }
  })();
})();
