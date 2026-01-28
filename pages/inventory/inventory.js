(function(){
  function initializeInventory(){
    const list = document.getElementById('inventory-list');
    const searchInput = document.getElementById('inventory-search');
    if (!list) return;

    let items = Vienna.storage.get('vienna-items', []) || [];
    let inventory = Vienna.storage.get('vienna-inventory', {}) || {};

    const render = (query = '') => {
      list.innerHTML = '';
      const q = (query || '').toLowerCase().trim();
      const filtered = items.filter(i => !q || (i.name && i.name.toLowerCase().includes(q)) || (i.description && i.description.toLowerCase().includes(q)));
      if (filtered.length === 0) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'لا توجد أصناف في المخزن.'; list.appendChild(empty); return; }
      filtered.forEach(item => {
        const card = document.createElement('div'); card.className = 'item-card';
        const qty = inventory[item.id] || 0;
        card.innerHTML = `
          <img src="${item.image || 'https://placehold.co/600x400/bde8f5/0f2854?text=No+Image'}" alt="">
          <div class="card-content">
            <h3>${item.name}</h3>
            <p>${item.description || ''}</p>
            <div class="inventory-controls">
              <input type="number" class="inventory-qty" value="${qty}" min="0" data-itemid="${item.id}">
              <button class="save-inv-btn">حفظ</button>
            </div>
          </div>`;
        const saveBtn = card.querySelector('.save-inv-btn'); const qtyInput = card.querySelector('.inventory-qty');
        saveBtn.addEventListener('click', () => { const v = parseFloat(qtyInput.value) || 0; inventory[item.id] = v; Vienna.storage.set('vienna-inventory', inventory); });
        list.appendChild(card);
      });
    };

    searchInput && searchInput.addEventListener('input', (e) => render(e.target.value));
    const refresh = () => { items = Vienna.storage.get('vienna-items', []) || []; inventory = Vienna.storage.get('vienna-inventory', {}) || {}; render(searchInput ? searchInput.value : ''); };
    Vienna.on('vienna-data-changed', refresh);

    render();
  }

  initializeInventory();
})();
