import { criarPluginFaixasTemperaturaC1 } from './temperaturaZonasChart.js';

export function inicializarGraficoAnalitico(canvasCtx, dadosAgrupados, chartInstance, onPontoSelecionado) {
  if (!dadosAgrupados || dadosAgrupados.length === 0) return chartInstance;

  const labels = dadosAgrupados.map(d => d.dataHora);

  const phNormalizado = dadosAgrupados.map(d => {
    const ph = d.pHSolo || 7;
    return parseFloat(((ph - 4.0) / 5.0 * 100).toFixed(1));
  });

  const datasets = [
    {
      id: 'umid_solo',
      label: 'Umid. Solo (%)',
      data: dadosAgrupados.map(d => d.umidadeSoloPorcentagem),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.08)',
      fill: true,
      yAxisID: 'y',
      tension: 0.5,
      borderWidth: 1.8,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
    {
      id: 'umid_ar',
      label: 'Umid. Ar (%)',
      data: dadosAgrupados.map(d => d.umidadeAr),
      borderColor: '#0ea5e9',
      backgroundColor: 'transparent',
      yAxisID: 'y',
      tension: 0.5,
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
    {
      id: 'temp',
      label: 'Temperatura (°C)',
      data: dadosAgrupados.map(d => d.temperatura),
      borderColor: '#ef4444',
      backgroundColor: 'transparent',
      yAxisID: 'y1',
      tension: 0.5,
      borderWidth: 1.8,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
    {
      id: 'luz',
      label: 'Luz Solar (%)',
      data: dadosAgrupados.map(d => d.luzSolar),
      borderColor: '#eab308',
      backgroundColor: 'transparent',
      yAxisID: 'y',
      borderDash: [4, 4],
      tension: 0.4,
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
    {
      id: 'ph',
      label: 'pH Solo (norm.)',
      data: phNormalizado,
      borderColor: '#a855f7',
      backgroundColor: 'transparent',
      yAxisID: 'y',
      tension: 0.4,
      borderWidth: 1.5,
      borderDash: [6, 3],
      pointRadius: 0,
      pointHoverRadius: 4,
    }
  ];

  const pluginFaixasFundo = {
    id: 'faixasFundo',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const { left, right, top, bottom } = chartArea;
      const xScale = scales.x;
      const dados = dadosAgrupados;
      const totalPontos = dados.length;
      if (totalPontos < 2) return;

      const larguraPonto = (right - left) / (totalPontos - 1);

      ctx.save();
      dados.forEach((p, i) => {
        const x = xScale.getPixelForValue(i);
        const xProx = i < totalPontos - 1 ? xScale.getPixelForValue(i + 1) : x + larguraPonto;
        const largura = xProx - x;

        if (p.estaChovendo) {
          ctx.fillStyle = 'rgba(14, 165, 233, 0.10)';
          ctx.fillRect(x, top, largura, bottom - top);
        }
        if (p.statusIrrigacao === 'LIGADO') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.13)';
          ctx.fillRect(x, top, largura, bottom - top);
        }
      });
      ctx.restore();
    }
  };

  const isDark = document.documentElement.classList.contains('dark')
    || window.matchMedia('(prefers-color-scheme: dark)').matches;

  const pluginFaixasTemperaturaC1 = criarPluginFaixasTemperaturaC1(isDark);
  const chartPlugins = [pluginFaixasFundo, pluginFaixasTemperaturaC1];

  const gridColor  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const tickColor  = isDark ? '#64748b' : '#94a3b8';
  const labelColor = isDark ? '#64748b' : '#94a3b8';

  const opcoesBase = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        borderWidth: 1,
        titleColor: isDark ? '#94a3b8' : '#475569',
        bodyColor: isDark ? '#cbd5e1' : '#334155',
        titleFont: { family: 'monospace', size: 10 },
        bodyFont: { family: 'monospace', size: 11 },
        padding: 10,
        callbacks: {
          label(ctx) {
            if (ctx.dataset.id === 'ph') {
              const phReal = ((ctx.parsed.y / 100) * 5.0 + 4.0).toFixed(2);
              return ` pH Solo: ${phReal}`;
            }
            const unidade = ctx.dataset.id === 'temp' ? '°C' : '%';
            return ` ${ctx.dataset.label}: ${ctx.parsed.y}${unidade}`;
          },
          afterBody(items) {
            const idx = items[0]?.dataIndex;
            if (idx == null) return [];
            const p = dadosAgrupados[idx];
            const linhas = [];
            if (p?.estaChovendo)              linhas.push('  🌧 Chovendo');
            if (p?.statusIrrigacao === 'LIGADO') linhas.push('  💧 Irrigação ativa');
            return linhas;
          }
        }
      },
      faixasFundo: pluginFaixasFundo
    },
    onClick(e, elements) {
      if (elements.length > 0 && onPontoSelecionado) {
        onPontoSelecionado(dadosAgrupados[elements[0].index]);
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: {
          color: tickColor,
          font: { family: 'monospace', size: 9 },
          maxTicksLimit: 12,
          maxRotation: 35,
        }
      },
      y: {
        position: 'left',
        min: 0,
        max: 100,
        grid: { color: gridColor },
        ticks: { color: tickColor, font: { family: 'monospace', size: 10 } },
        title: { display: true, text: 'Umid. (%) / Luz (%) / pH norm.', color: labelColor, font: { size: 9, family: 'monospace' } }
      },
      y1: {
        position: 'right',
        min: 0,
        max: 40,
        grid: { drawOnChartArea: false },
        ticks: { color: '#ef4444', font: { family: 'monospace', size: 10 } },
        title: { display: true, text: 'Temp (°C)', color: '#ef4444', font: { size: 9, family: 'monospace' } }
      }
    }
  };

  if (chartInstance) {
    chartInstance.data.labels   = labels;
    chartInstance.data.datasets = datasets;
    chartInstance.options = opcoesBase;
    chartInstance.config.plugins = chartPlugins;
    chartInstance.update('none');
    return chartInstance;
  }

  return new Chart(canvasCtx, {
    type: 'line',
    data: { labels, datasets },
    plugins: chartPlugins,
    options: opcoesBase,
  });
}

export function inicializarGraficoRelatorio(canvasCtx, dados, chartInstance) {
  if (!dados?.length) return chartInstance;

  const labels = dados.map(d => d.nome);
  const totals = dados.map(d => d.total);

  const isDark = document.documentElement.classList.contains('dark');
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Irrigações',
        data: totals,
        backgroundColor: 'rgba(16,185,129,0.7)',
        borderColor: '#10b981',
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { font: { family: 'monospace', size: 10 } } },
        x: { grid: { display: false }, ticks: { font: { family: 'monospace', size: 10 } } },
      },
    },
  };

  if (chartInstance) {
    chartInstance.data = config.data;
    chartInstance.options = config.options;
    chartInstance.update('none');
    return chartInstance;
  }

  return new Chart(canvasCtx, config);
}
