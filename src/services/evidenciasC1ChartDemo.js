import { escapeHtml } from './cardHelpers.js';
import {
  normalizarRegistro,
  classificarTemperaturaIntegridade,
} from './apiService.js';
import {
  ZONAS_TEMP_GRAFICO,
  tempParaYPixel,
  LARGURA_FAIXA_TEMP_C1,
  TEMP_GRAFICO_MIN,
  TEMP_GRAFICO_MAX,
} from './temperaturaZonasChart.js';
import { PAINELS_GRAFICO_DEMO } from './evidenciasC1Content.js';

const SVG_W = 640;
const SVG_H = 160;
const PAD = { left: 36, right: 44, top: 16, bottom: 28 };
const Y_DEMO_MIN = 0;
const Y_DEMO_MAX = 80;

/**
 * Aplica normalizarRegistro ponto a ponto para demonstração estática.
 * @param {number[]} temperaturasBrutas
 * @param {string[]} [rotulos]
 */
export function montarSerieDemonstracao(temperaturasBrutas, rotulos = []) {
  return temperaturasBrutas.map((bruto, i) => {
    const reg = normalizarRegistro({
      id: 200 + i,
      dataHora: `2026-06-13T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
      temperatura: bruto,
      umidadeAr: 55,
      umidadeSoloPorcentagem: 60,
    });
    return {
      bruto,
      valor: reg.temperatura,
      cls: classificarTemperaturaIntegridade(reg.temperatura, reg.errosLeitura),
      rotulo: rotulos[i] || `T${i}`,
    };
  });
}

export function tempDemoParaY(valor, plotTop, plotBottom, yMin = Y_DEMO_MIN, yMax = Y_DEMO_MAX) {
  if (valor === null || valor === undefined) return null;
  const ratio = (valor - yMin) / (yMax - yMin);
  return plotBottom - ratio * (plotBottom - plotTop);
}

/**
 * Paths SVG da linha de temperatura com lacunas onde valor === null.
 */
export function construirPathTemperatura(pontos, plotLeft, plotRight, plotTop, plotBottom) {
  const segments = [];
  let current = [];
  const n = pontos.length;
  const step = n > 1 ? (plotRight - plotLeft) / (n - 1) : 0;

  pontos.forEach((p, i) => {
    if (p.valor === null || p.valor === undefined) {
      if (current.length >= 2) segments.push([...current]);
      else if (current.length === 1) segments.push([...current]);
      current = [];
      return;
    }
    const x = plotLeft + i * step;
    const y = tempDemoParaY(p.valor, plotTop, plotBottom);
    current.push({ x, y, ponto: p });
  });
  if (current.length >= 1) segments.push(current);

  return segments.map((seg) => seg
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' '));
}

function corPonto(cls) {
  if (cls === 'improvavel') return '#f59e0b';
  if (cls === 'rejeitada') return '#ef4444';
  return '#10b981';
}

function renderFaixaC1Svg(plotTop, plotBottom, plotRight) {
  const x0 = plotRight - LARGURA_FAIXA_TEMP_C1;
  const zonas = ZONAS_TEMP_GRAFICO.map((z) => {
    const yTop = tempParaYPixel(z.ate, plotTop, plotBottom, TEMP_GRAFICO_MIN, TEMP_GRAFICO_MAX);
    const yBottom = tempParaYPixel(z.de, plotTop, plotBottom, TEMP_GRAFICO_MIN, TEMP_GRAFICO_MAX);
    return `<rect x="${x0}" y="${yTop.toFixed(1)}" width="${LARGURA_FAIXA_TEMP_C1}" height="${(yBottom - yTop).toFixed(1)}" fill="${z.cor}" />`;
  }).join('');
  return `${zonas}<text x="${x0 + LARGURA_FAIXA_TEMP_C1 / 2}" y="${plotTop + 8}" text-anchor="middle" font-size="7" fill="#94a3b8" font-family="monospace">C1</text>`;
}

function renderGridSvg(plotLeft, plotRight, plotTop, plotBottom) {
  const ticks = [0, 20, 40, 60, 80];
  return ticks.map((t) => {
    const y = tempDemoParaY(t, plotTop, plotBottom);
    return `
      <line x1="${plotLeft}" y1="${y.toFixed(1)}" x2="${plotRight}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
      <text x="${plotRight + 6}" y="${(y + 3).toFixed(1)}" font-size="8" fill="#ef4444" font-family="monospace">${t}</text>`;
  }).join('');
}

/**
 * @param {import('./evidenciasC1Content.js').PAINELS_GRAFICO_DEMO[0]} painel
 */
export function renderPainelGraficoEstatico(painel) {
  const pontos = montarSerieDemonstracao(painel.temperaturasBrutas, painel.rotulos);
  const plotLeft = PAD.left;
  const plotRight = SVG_W - PAD.right;
  const plotTop = PAD.top;
  const plotBottom = SVG_H - PAD.bottom;
  const n = pontos.length;
  const step = n > 1 ? (plotRight - plotLeft) / (n - 1) : 0;

  const paths = construirPathTemperatura(pontos, plotLeft, plotRight, plotTop, plotBottom);
  const pathsSvg = paths.map(d => `<path d="${d}" fill="none" stroke="#ef4444" stroke-width="1.8" stroke-linejoin="round" />`).join('');

  const pontosSvg = pontos.map((p, i) => {
    const x = plotLeft + i * step;
    if (p.valor === null || p.valor === undefined) {
      return `
        <g>
          <circle cx="${x.toFixed(1)}" cy="${((plotTop + plotBottom) / 2).toFixed(1)}" r="6" fill="none" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2" opacity="0.7" />
          <text x="${x.toFixed(1)}" y="${(plotBottom + 14).toFixed(1)}" text-anchor="middle" font-size="7" fill="#ef4444" font-family="monospace">null</text>
          <text x="${x.toFixed(1)}" y="${plotTop - 4}" text-anchor="middle" font-size="7" fill="#64748b" font-family="monospace">${p.bruto}° in</text>
        </g>`;
    }
    const y = tempDemoParaY(p.valor, plotTop, plotBottom);
    const cor = corPonto(p.cls);
    return `
      <g>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${cor}" stroke="#0f172a" stroke-width="1" />
        <text x="${x.toFixed(1)}" y="${plotTop - 4}" text-anchor="middle" font-size="7" fill="#64748b" font-family="monospace">${p.bruto}°</text>
      </g>`;
  }).join('');

  const rotulosX = pontos.map((p, i) => {
    const x = plotLeft + i * step;
    return `<text x="${x.toFixed(1)}" y="${(plotBottom + 14).toFixed(1)}" text-anchor="middle" font-size="7" fill="#64748b" font-family="monospace">${escapeHtml(p.rotulo)}</text>`;
  }).join('');

  const legendaEntrada = pontos.map(p => `${p.bruto}→${p.valor ?? 'null'}`).join(' · ');

  return `
    <div class="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-[#0f172a]">
      <div class="px-3 py-2 border-b border-slate-800/80">
        <h4 class="text-[11px] font-bold text-slate-200 font-mono">${escapeHtml(painel.titulo)}</h4>
        <p class="text-[10px] font-mono text-slate-500 mt-0.5">${escapeHtml(painel.descricao)}</p>
      </div>
      <svg viewBox="0 0 ${SVG_W} ${SVG_H}" class="w-full h-auto" role="img" aria-label="${escapeHtml(painel.titulo)}">
        ${renderGridSvg(plotLeft, plotRight, plotTop, plotBottom)}
        ${renderFaixaC1Svg(plotTop, plotBottom, plotRight)}
        ${pathsSvg}
        ${pontosSvg}
        ${rotulosX}
        <text x="${plotRight + 6}" y="${plotTop - 2}" font-size="8" fill="#ef4444" font-family="monospace">°C</text>
      </svg>
      <p class="px-3 py-1.5 text-[9px] font-mono text-slate-500 border-t border-slate-800/80">Entrada bruta → gráfico: ${escapeHtml(legendaEntrada)}</p>
    </div>`;
}

export function renderGraficosDemonstracaoErros() {
  const paineis = PAINELS_GRAFICO_DEMO.map(renderPainelGraficoEstatico).join('');
  return `
    <div class="space-y-3">
      <p class="text-[11px] font-bold text-slate-700 dark:text-slate-200">Como entra no gráfico da Principal — por tipo de erro</p>
      ${paineis}
    </div>`;
}
