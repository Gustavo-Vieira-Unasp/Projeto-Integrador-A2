import { FAIXAS_UC01, TEMP_PLAUSIVEL_HORTA_MAX } from './apiService.js';

export { TEMP_PLAUSIVEL_HORTA_MAX };

/** Escala vertical da mini-faixa C1 no Centro Analítico (−10…80 °C). */
export const TEMP_GRAFICO_MIN = FAIXAS_UC01.temperatura.min;
export const TEMP_GRAFICO_MAX = FAIXAS_UC01.temperatura.max;

/** Faixas coloridas para overlay no gráfico analítico (Principal). */
export const ZONAS_TEMP_GRAFICO = [
  { de: TEMP_GRAFICO_MIN, ate: TEMP_PLAUSIVEL_HORTA_MAX, cor: 'rgba(16,185,129,0.45)' },
  { de: TEMP_PLAUSIVEL_HORTA_MAX, ate: TEMP_GRAFICO_MAX, cor: 'rgba(245,158,11,0.45)' },
  { de: 80, ate: 85, cor: 'rgba(248,113,113,0.35)' },
];

/**
 * Converte temperatura (°C) em coordenada Y do canvas.
 * Escala linear: min → bottom, max → top.
 */
export function tempParaYPixel(temp, top, bottom, min = TEMP_GRAFICO_MIN, max = TEMP_GRAFICO_MAX) {
  const clamped = Math.min(max, Math.max(min, temp));
  const ratio = (clamped - min) / (max - min);
  return bottom - ratio * (bottom - top);
}

/** Largura (px) da faixa vertical C1 dentro do chartArea. */
export const LARGURA_FAIXA_TEMP_C1 = 10;

/**
 * Plugin Chart.js — mini-escala vertical C1 (−10…80 °C) colada à direita do gráfico.
 * @param {boolean} isDark
 */
export function criarPluginFaixasTemperaturaC1(isDark) {
  return {
    id: 'faixasTemperaturaC1',
    afterDraw(chart) {
      const tempDs = chart.data.datasets.find(d => d.id === 'temp');
      if (!tempDs || tempDs.hidden) return;

      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      const { top, bottom, right } = chartArea;
      const x0 = right - LARGURA_FAIXA_TEMP_C1;

      ctx.save();

      ZONAS_TEMP_GRAFICO.forEach((z) => {
        const yTop = tempParaYPixel(z.ate, top, bottom);
        const yBottom = tempParaYPixel(z.de, top, bottom);
        ctx.fillStyle = z.cor;
        ctx.fillRect(x0, yTop, LARGURA_FAIXA_TEMP_C1, yBottom - yTop);
      });

      const y50 = tempParaYPixel(TEMP_PLAUSIVEL_HORTA_MAX, top, bottom);
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.25)';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y50);
      ctx.lineTo(right, y50);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('C1', x0 + LARGURA_FAIXA_TEMP_C1 / 2, top + 10);

      ctx.restore();
    },
  };
}
