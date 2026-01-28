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

  // RTL / theme helpers
  Vienna.rtl = document.documentElement.getAttribute('dir') === 'rtl';
})();
