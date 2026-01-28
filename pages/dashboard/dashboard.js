(function(){
  const itemsCountEl = document.getElementById('dash-items-count');
  const billsCountEl = document.getElementById('dash-bills-count');
  const revenueEl = document.getElementById('dash-revenue');
  const chartEl = document.getElementById('dashboard-chart');
  const revenueChartEl = document.getElementById('dashboard-revenue-chart');
  const inventoryChartEl = document.getElementById('dashboard-inventory-chart');

  const setChartMessage = (canvasEl, message) => {
    if (!canvasEl) return;
    const panel = canvasEl.closest?.('.chart-panel') || canvasEl.parentElement;
    if (!panel) return;
    panel.classList.remove('has-chart');
    let msg = panel.querySelector('.chart-fallback');
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'chart-fallback';
      panel.appendChild(msg);
    }
    msg.textContent = message;
  };

  const clearChartMessage = (canvasEl) => {
    if (!canvasEl) return;
    const panel = canvasEl.closest?.('.chart-panel') || canvasEl.parentElement;
    if (!panel) return;
    panel.classList.add('has-chart');
    const msg = panel.querySelector('.chart-fallback');
    if (msg) msg.remove();
  };

  let updateQueued = false;
  const queueUpdate = () => {
    if (updateQueued) return;
    updateQueued = true;
    requestAnimationFrame(() => {
      updateQueued = false;
      updateStats();
    });
  };

  const updateStats = () => {
    const itemsData = Vienna.storage.get('vienna-items', []) || [];
    const billsData = Vienna.storage.get('vienna-bills', []) || [];
    const total = billsData.reduce((s, b) => s + (parseFloat(b.total) || 0), 0);
    if (itemsCountEl) itemsCountEl.textContent = itemsData.length;
    if (billsCountEl) billsCountEl.textContent = billsData.length;
    if (revenueEl) revenueEl.textContent = total.toFixed(2);

    // If Chart.js didn't load (offline / CDN blocked), avoid blank panels.
    if (typeof Chart === 'undefined') {
      const msg = 'لا يمكن عرض الرسوم البيانية الآن. تأكد من الاتصال بالإنترنت أو أن رابط Chart.js يعمل.';
      setChartMessage(revenueChartEl, msg);
      setChartMessage(chartEl, msg);
      setChartMessage(inventoryChartEl, msg);
      return;
    }

    if (chartEl) {
      try {
        const dataValues = [itemsData.length, billsData.length, Math.round(total)];
        if (!window.dashboardChart) {
          window.dashboardChart = Vienna.buildSummaryChart(chartEl, ['أصناف','فواتير','إجمالي'], dataValues);
        } else {
          window.dashboardChart.data.datasets[0].data = dataValues;
          window.dashboardChart.update();
        }
        clearChartMessage(chartEl);
      } catch (e) {
        setChartMessage(chartEl, 'حدثت مشكلة أثناء إنشاء الرسم البياني.');
      }
    }

    if (revenueChartEl) {
      try {
        const monthsCount = 6;
        const now = new Date();
        const months = [];
        for (let i = monthsCount - 1; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
        const monthKeys = months.map(d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        const sums = monthKeys.map(() => 0);
        billsData.forEach(b => {
          const date = new Date(b.date);
          if (Number.isNaN(date.getTime())) return;
          const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
          const idx = monthKeys.indexOf(key);
          if (idx >= 0) sums[idx] += parseFloat(b.total) || 0;
        });
        const labels = months.map(d => new Intl.DateTimeFormat('ar-EG', { month: 'short', year: 'numeric' }).format(d));
        if (!window.dashboardRevenueChart) {
          window.dashboardRevenueChart = Vienna.buildLineChart(revenueChartEl, labels, sums.map(v => Math.round(v*100)/100));
        } else {
          window.dashboardRevenueChart.data.labels = labels;
          window.dashboardRevenueChart.data.datasets[0].data = sums.map(v => Math.round(v*100)/100);
          window.dashboardRevenueChart.update();
        }
        clearChartMessage(revenueChartEl);
      } catch (e) {
        setChartMessage(revenueChartEl, 'حدثت مشكلة أثناء إنشاء رسم الإيرادات.');
      }
    }

    if (inventoryChartEl) {
      try {
        const inventory = Vienna.storage.get('vienna-inventory', {}) || {};
        const rows = itemsData
          .map(it => ({ name: it.name || '—', qty: Number(inventory[it.id] || 0) }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 8);
        const labels = rows.map(r => r.name);
        const values = rows.map(r => r.qty);

        if (!window.dashboardInventoryChart) {
          const ctx = inventoryChartEl.getContext('2d');
          window.dashboardInventoryChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels,
              datasets: [{
                label: 'الكمية',
                data: values,
                backgroundColor: 'rgba(73,136,196,0.55)',
                borderColor: 'rgba(15,40,84,0.25)',
                borderWidth: 1,
                borderRadius: 10,
                maxBarThickness: 44,
              }]
            },
            options: {
              plugins: { legend: { display: false }, tooltip: { rtl: true } },
              scales: {
                x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0 } },
                y: { beginAtZero: true }
              }
            }
          });
        } else {
          window.dashboardInventoryChart.data.labels = labels;
          window.dashboardInventoryChart.data.datasets[0].data = values;
          window.dashboardInventoryChart.update();
        }
        clearChartMessage(inventoryChartEl);
      } catch (e) {
        setChartMessage(inventoryChartEl, 'حدثت مشكلة أثناء إنشاء رسم المخزن.');
      }
    }
  };

  updateStats();
  Vienna.on('vienna-data-changed', queueUpdate);
  // Cross-tab updates
  window.addEventListener('storage', (e) => {
    if (!e || !e.key) return;
    if (e.key.startsWith('vienna-')) queueUpdate();
  });
})();
