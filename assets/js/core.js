// Core shared utilities and event bus
(function(){
  window.Vienna = window.Vienna || {};
  const bus = new EventTarget();
  Vienna.bus = bus;

  Vienna.emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
  Vienna.on = (name, handler) => { bus.addEventListener(name, handler); return () => bus.removeEventListener(name, handler); };

  // Storage helpers
  const __memStore = new Map();
  Vienna.storage = {
    get(key, fallback){
      if (__memStore.has(key)) return __memStore.get(key);
      return fallback;
    },
    set(key, val){
      __memStore.set(key, val);
      Vienna.emit('vienna-data-changed', { key });
    },
    remove(key){
      __memStore.delete(key);
      Vienna.emit('vienna-data-changed', { key });
    },
    clear(){
      __memStore.clear();
      Vienna.emit('vienna-data-changed', { key: '*' });
    }
  };

  // A promise that resolves when app-level async initialization (like server sync) completes.
  Vienna.ready = Promise.resolve();

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
