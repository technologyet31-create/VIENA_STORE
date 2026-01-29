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

  const ensureSupabase = async () => {
    if (!(window.SupabaseSvc && SupabaseSvc.ensureReady)) throw new Error('Supabase client not loaded');
    await SupabaseSvc.ensureReady();
    return SupabaseSvc._client;
  };

  const updateStats = async () => {
    const client = await ensureSupabase();

    const itemsRes = await client.from('items').select('id', { count: 'exact', head: true });
    const billsRes = await client.from('bills').select('id', { count: 'exact', head: true });

    const itemsCount = itemsRes.count || 0;
    const billsCount = billsRes.count || 0;
    if (itemsCountEl) itemsCountEl.textContent = String(itemsCount);
    if (billsCountEl) billsCountEl.textContent = String(billsCount);

    // Revenue (sum of bill totals) for last 6 months
    const monthsCount = 6;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1), 1);
    const startIso = start.toISOString();

    const { data: bills, error: billsErr } = await client
      .from('bills')
      .select('created_at,total')
      .gte('created_at', startIso)
      .order('created_at', { ascending: true })
      .limit(2000);
    if (billsErr) throw billsErr;

    const totalRevenue = (bills || []).reduce((s, b) => s + (Number(b.total) || 0), 0);
    if (revenueEl) revenueEl.textContent = totalRevenue.toFixed(2);

    if (typeof Chart === 'undefined') {
      const msg = 'لا يمكن عرض الرسوم البيانية الآن. تأكد من الاتصال بالإنترنت أو أن رابط Chart.js يعمل.';
      setChartMessage(revenueChartEl, msg);
      setChartMessage(chartEl, msg);
      setChartMessage(inventoryChartEl, msg);
      return;
    }

    // Summary chart
    if (chartEl) {
      try {
        const dataValues = [itemsCount, billsCount, Math.round(totalRevenue)];
        if (!window.dashboardChart) {
          window.dashboardChart = Vienna.buildSummaryChart(chartEl, ['أصناف','فواتير','إجمالي'], dataValues);
        } else {
          window.dashboardChart.data.datasets[0].data = dataValues;
          window.dashboardChart.update();
        }
        clearChartMessage(chartEl);
      } catch {
        setChartMessage(chartEl, 'حدثت مشكلة أثناء إنشاء الرسم البياني.');
      }
    }

    // Revenue by month chart
    if (revenueChartEl) {
      try {
        const months = [];
        for (let i = monthsCount - 1; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
        const monthKeys = months.map(d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        const sums = monthKeys.map(() => 0);
        (bills || []).forEach(b => {
          const date = new Date(b.created_at);
          if (Number.isNaN(date.getTime())) return;
          const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
          const idx = monthKeys.indexOf(key);
          if (idx >= 0) sums[idx] += Number(b.total) || 0;
        });

        const labels = months.map(d => new Intl.DateTimeFormat('ar-EG', { month: 'short', year: 'numeric' }).format(d));
        const points = sums.map(v => Math.round(v * 100) / 100);

        if (!window.dashboardRevenueChart) {
          window.dashboardRevenueChart = Vienna.buildLineChart(revenueChartEl, labels, points);
        } else {
          window.dashboardRevenueChart.data.labels = labels;
          window.dashboardRevenueChart.data.datasets[0].data = points;
          window.dashboardRevenueChart.update();
        }
        clearChartMessage(revenueChartEl);
      } catch {
        setChartMessage(revenueChartEl, 'حدثت مشكلة أثناء إنشاء رسم الإيرادات.');
      }
    }

    // Inventory chart (top 8)
    if (inventoryChartEl) {
      try {
        const { data: inv, error: invErr } = await client
          .from('inventory')
          .select('quantity,item:items(name)')
          .order('quantity', { ascending: false })
          .limit(8);
        if (invErr) throw invErr;
        const labels = (inv || []).map(r => (r.item && r.item.name) ? r.item.name : '—');
        const values = (inv || []).map(r => Number(r.quantity) || 0);

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
      } catch {
        setChartMessage(inventoryChartEl, 'حدثت مشكلة أثناء إنشاء رسم المخزن.');
      }
    }
  };

  (async () => {
    try {
      await updateStats();
    } catch (e) {
      console.error(e);
      if (window.Vienna && Vienna.toast) Vienna.toast('لا يمكن تحميل بيانات لوحة التحكم. تأكد من إعداد Supabase.', 'error');
    }
  })();
})();
