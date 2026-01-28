// Core shared utilities and event bus
(function(){
  window.Vienna = window.Vienna || {};
  const bus = new EventTarget();
  Vienna.bus = bus;

  Vienna.emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
  Vienna.on = (name, handler) => { bus.addEventListener(name, handler); return () => bus.removeEventListener(name, handler); };

  // Storage helpers
  Vienna.storage = {
    get(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, val){ localStorage.setItem(key, JSON.stringify(val)); Vienna.emit('vienna-data-changed', { key }); }
  };

  // Ensure *any* localStorage writes trigger updates (even from legacy code)
  if (!Vienna.__storagePatched && typeof localStorage !== 'undefined') {
    Vienna.__storagePatched = true;
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    const originalClear = localStorage.clear.bind(localStorage);

    localStorage.setItem = (key, value) => {
      originalSetItem(key, value);
      try { Vienna.emit('vienna-data-changed', { key }); } catch {}
    };
    localStorage.removeItem = (key) => {
      originalRemoveItem(key);
      try { Vienna.emit('vienna-data-changed', { key }); } catch {}
    };
    localStorage.clear = () => {
      originalClear();
      try { Vienna.emit('vienna-data-changed', { key: '*' }); } catch {}
    };
  }

  // RTL / theme helpers
  Vienna.rtl = document.documentElement.getAttribute('dir') === 'rtl';

  // Toast notifications
  Vienna.toast = (message, type = 'info', opts = {}) => {
    const title = opts.title || (type === 'success' ? 'تم' : type === 'error' ? 'خطأ' : type === 'warn' ? 'تنبيه' : 'معلومة');
    const timeout = Number.isFinite(opts.timeout) ? opts.timeout : 2600;

    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon"></div>
      <div>
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    const remove = () => {
      toast.classList.add('is-leaving');
      setTimeout(() => toast.remove(), 240);
    };

    toast.addEventListener('click', remove);
    if (timeout > 0) setTimeout(remove, timeout);
  };
})();
