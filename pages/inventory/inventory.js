(function(){
  function initializeInventory(){
    const list = document.getElementById('inventory-list');
    const searchInput = document.getElementById('inventory-search');
    if (!list) return;

    let rows = [];

    const ensureSupabase = async () => {
      if (!(window.SupabaseSvc && SupabaseSvc.ensureReady)) throw new Error('Supabase client not loaded');
      await SupabaseSvc.ensureReady();
    };

    const load = async () => {
      await ensureSupabase();
      rows = await SupabaseSvc.getInventoryWithItems();
    };

    const render = (query = '') => {
      list.innerHTML = '';
      const q = (query || '').toLowerCase().trim();
      const filtered = (rows || [])
        .map(r => ({ qty: Number(r.quantity || 0), item: r.item || r.items || r.item_id || null }))
        .filter(r => r.item && (!q || (r.item.name || '').toLowerCase().includes(q) || (r.item.description || '').toLowerCase().includes(q)));

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'لا توجد أصناف في المخزن.';
        list.appendChild(empty);
        return;
      }

      filtered.forEach(({ item, qty }) => {
        const card = document.createElement('div'); card.className = 'item-card';
        const sellPrice = (item.sell_price != null) ? Number(item.sell_price) : '';
        card.innerHTML = `
          <img src="${item.image || 'https://placehold.co/600x400/bde8f5/0f2854?text=No+Image'}" alt="">
          <div class="card-content">
            <h3>${item.name}</h3>
            <p>${item.description || ''}</p>
            <div style="display:flex;gap:10px;align-items:center;margin-top:10px;">
              <div style="display:inline-flex;align-items:center;gap:8px;">
                <span class="badge text-bg-light" style="font-weight:800;padding:8px 10px;border-radius:12px;border:1px solid rgba(15,40,84,0.08);">الكمية: <strong style="margin-inline-start:6px;color:var(--dark-blue);">${qty}</strong></span>
              </div>
              <div style="flex:1;display:flex;gap:8px;align-items:center;">
                <input type="number" class="inventory-sell-price form-control" value="${sellPrice}" placeholder="سعر البيع" min="0" step="0.01" data-itemid="${item.id}">
                <button class="save-price-btn btn btn-sm btn-outline-primary">حفظ السعر</button>
              </div>
            </div>
          </div>`;
        const saveBtn = card.querySelector('.save-price-btn'); const priceInput = card.querySelector('.inventory-sell-price');

        saveBtn.addEventListener('click', async () => {
          const raw = (priceInput.value || '').trim();
          const v = raw === '' ? null : Math.max(0, Number.parseFloat(raw) || 0);
          try {
            await ensureSupabase();
            await SupabaseSvc.updateItem(item.id, { sell_price: v });
            item.sell_price = v;
            if (window.Vienna && Vienna.toast) Vienna.toast('تم حفظ سعر البيع.', 'success');
          } catch (e) {
            console.error(e);
            if (window.Vienna && Vienna.toast) Vienna.toast('حدث خطأ أثناء حفظ السعر.', 'error');
          }
        });
        list.appendChild(card);
      });
    };

    searchInput && searchInput.addEventListener('input', (e) => render(e.target.value));

    (async () => {
      try {
        await load();
        render(searchInput ? searchInput.value : '');
      } catch (e) {
        console.error(e);
        list.innerHTML = '<div class="empty-state">لا يمكن تحميل بيانات المخزن. تأكد من إعداد Supabase.</div>';
        if (window.Vienna && Vienna.toast) Vienna.toast('Supabase غير جاهز. لا يمكن تحميل المخزن.', 'error');
      }
    })();
  }

  initializeInventory();
})();
