// Shared Chart.js defaults and helpers
(function(){
  if (typeof Chart === 'undefined') return;
  // Global defaults for RTL and fonts
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  Chart.defaults.color = '#0f2854';
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  const gridColor = 'rgba(15,40,84,0.08)';
  const borderColor = 'rgba(15,40,84,0.18)';
  Chart.defaults.scales.linear.grid.color = gridColor;
  Chart.defaults.scales.category.grid.color = gridColor;
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.point.radius = 3;
  Chart.defaults.elements.point.hoverRadius = 5;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,40,84,0.9)';
  Chart.defaults.plugins.tooltip.titleColor = '#fff';
  Chart.defaults.plugins.tooltip.bodyColor = '#fff';
  Chart.defaults.plugins.legend.labels.boxWidth = 10;

  // Helper to build gradient fills
  function gradient(ctx, color){
    const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    g.addColorStop(0, color.replace('1)', '0.25)'));
    g.addColorStop(1, color.replace('1)', '0.02)'));
    return g;
  }

  window.Vienna = window.Vienna || {};
  Vienna.buildLineChart = (canvas, labels, data, color) => {
    const ctx = canvas.getContext('2d');
    const base = color || 'rgba(73,136,196,1)';
    return new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{
        label: '\u0625\u064a\u0631\u0627\u062f',
        data,
        borderColor: base,
        backgroundColor: gradient(ctx, base),
        fill: true,
        tension: 0.35,
      }]},
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false, rtl: true },
        },
        scales: {
          x: { grid: { drawBorder: false }, ticks: { maxRotation: 0 } },
          y: { grid: { color: gridColor }, beginAtZero: true },
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
      }
    });
  };

  Vienna.buildSummaryChart = (canvas, labels, data) => {
    const ctx = canvas.getContext('2d');
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '\u0645\u0648\u062c\u0632',
          data,
          backgroundColor: ['#4da6ff', '#66cc99', '#ffb366'],
          borderColor: borderColor,
          borderWidth: 1,
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { rtl: true }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        }
      }
    });
  };
})();
