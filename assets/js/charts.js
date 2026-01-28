// Shared Chart.js defaults and helpers
(function(){
  if (typeof Chart === 'undefined') return;
  // Global defaults for RTL and fonts
  Chart.defaults.font.family = '"Cairo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  Chart.defaults.color = '#0f2854';
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;

  // Locale + smoother animations
  Chart.defaults.locale = 'ar';
  Chart.defaults.animation = { duration: 650, easing: 'easeOutQuart' };
  Chart.defaults.transitions = {
    active: { animation: { duration: 160 } },
    resize: { animation: { duration: 0 } }
  };

  const gridColor = 'rgba(15,40,84,0.08)';
  const borderColor = 'rgba(15,40,84,0.18)';
  Chart.defaults.scales.linear.grid.color = gridColor;
  Chart.defaults.scales.category.grid.color = gridColor;
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.point.radius = 2.8;
  Chart.defaults.elements.point.hoverRadius = 5.5;
  Chart.defaults.elements.bar.borderRadius = 10;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,40,84,0.92)';
  Chart.defaults.plugins.tooltip.titleColor = '#fff';
  Chart.defaults.plugins.tooltip.bodyColor = '#fff';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.displayColors = false;
  Chart.defaults.plugins.tooltip.rtl = true;
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
          tooltip: { mode: 'index', intersect: false },
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
      // A more modern look than bars for a quick summary
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          label: '\u0645\u0648\u062c\u0632',
          data,
          backgroundColor: ['rgba(73,136,196,0.85)', 'rgba(102,204,153,0.85)', 'rgba(255,179,102,0.85)'],
          borderColor: borderColor,
          borderWidth: 1,
          hoverOffset: 6,
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { }
        },
        cutout: '68%',
      }
    });
  };
})();
