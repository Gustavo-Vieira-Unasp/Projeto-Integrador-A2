import { renderPageShell } from '../services/uiStateService.js';
import {
  escapeHtml,
  calcularStatusUmidadeSolo,
  calcularStatusUmidadeAr,
  calcularStatusTemperatura,
} from '../services/cardHelpers.js';
import { renderCardSensor } from '../services/appRenderService.js';
import {
  normalizarRegistro,
  agregarBucketLeituras,
  TEMP_PLAUSIVEL_HORTA_MAX,
} from '../services/apiService.js';
import { renderGraficosDemonstracaoErros } from '../services/evidenciasC1ChartDemo.js';
import {
  METADADOS,
  DECISOES_RESUMO,
  TABELA_BOUNDARY,
  CENARIOS_SIMULACAO,
  NOTA_BORDA_80,
} from '../services/evidenciasC1Content.js';

const EIXO_MIN = -10;
const EIXO_MAX = 220;

function renderTabelaDecisoes(secao) {
  const rows = secao.linhas.map(l => `
    <tr class="border-b border-slate-100 dark:border-slate-800">
      <td class="px-3 py-2 text-[11px]">${escapeHtml(l.opcao)}</td>
      <td class="px-3 py-2 text-[11px] font-bold ${l.decisao.startsWith('Adotada') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}">${escapeHtml(l.decisao)}</td>
      <td class="px-3 py-2 text-[11px] text-slate-500">${escapeHtml(l.motivo)}</td>
    </tr>`).join('');

  return `
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <h3 class="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 font-mono border-b border-slate-100 dark:border-slate-800">${escapeHtml(secao.titulo)}</h3>
      <table class="w-full text-left font-mono">
        <thead class="bg-slate-50 dark:bg-slate-950/50 text-[9px] uppercase text-slate-400">
          <tr><th class="px-3 py-2">Opção</th><th class="px-3 py-2">Decisão</th><th class="px-3 py-2">Motivo</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderMiniHistorico(registro) {
  const flags = [];
  if (registro.leituraSuspeita) flags.push('<span class="text-red-500">suspeito</span>');
  if (registro.temperaturaImprovavel && !registro.leituraSuspeita) {
    flags.push('<span class="text-amber-600">improvável</span>');
  }
  const dataFmt = new Date(registro.dataHora).toLocaleString('pt-BR');
  return `
    <tr class="border-b border-slate-100 dark:border-slate-800">
      <td class="px-3 py-2 font-mono text-[10px]">${dataFmt}</td>
      <td class="px-3 py-2 font-mono text-[10px]">A</td>
      <td class="px-3 py-2 font-mono text-[10px]">${registro.temperatura ?? '—'}°C</td>
      <td class="px-3 py-2 font-mono text-[10px]">${registro.umidadeAr ?? '—'}%</td>
      <td class="px-3 py-2 font-mono text-[10px]">${registro.umidadeSoloPorcentagem ?? '—'}%</td>
      <td class="px-3 py-2 font-mono text-[9px]">${flags.join(' ') || '—'}</td>
    </tr>`;
}

function renderCardsSimulacao(registro) {
  const erros = registro.errosLeitura || {};

  return `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      ${renderCardSensor(
        'Umid. Solo',
        registro.umidadeSoloPorcentagem,
        '%',
        'normal',
        calcularStatusUmidadeSolo(registro.umidadeSoloPorcentagem),
        { icone: '🌱', corValor: 'text-emerald-600 dark:text-emerald-400', corBarra: 'bg-emerald-500' },
        { motivoRejeicao: erros.umidadeSoloPorcentagem }
      )}
      ${renderCardSensor(
        'Umid. Ar',
        registro.umidadeAr,
        '%',
        'normal',
        calcularStatusUmidadeAr(registro.umidadeAr),
        { icone: '💧', corValor: 'text-sky-600 dark:text-sky-400', corBarra: 'bg-sky-500' },
        { motivoRejeicao: erros.umidadeAr }
      )}
      ${renderCardSensor(
        'Temperatura',
        registro.temperatura,
        '°C',
        'normal',
        calcularStatusTemperatura(registro.temperatura),
        { icone: '🌡️', corValor: 'text-red-600 dark:text-red-400', corBarra: 'bg-red-500' },
        {
          motivoRejeicao: erros.temperatura,
          temperaturaImprovavel: registro.temperaturaImprovavel === true,
        }
      )}
    </div>`;
}

function renderAntesDepois213() {
  const depois = normalizarRegistro({
    id: 99,
    dataHora: '2026-06-13T14:00:00.000Z',
    temperatura: 213,
    umidadeAr: 61,
    umidadeSoloPorcentagem: 63,
  });

  const cardAntes = `
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/80 rounded-lg flex h-32 relative shadow-md overflow-hidden opacity-90">
      <div class="w-1.5 shrink-0 bg-red-500"></div>
      <div class="flex flex-col justify-between p-4 flex-1">
        <span class="text-[10px] font-bold text-slate-500 uppercase">Temperatura · ANTES</span>
        <p class="text-3xl font-black text-red-600 font-mono">213<span class="text-xs text-slate-400 ml-0.5">°C</span></p>
        <span class="text-[10px] text-slate-500">"Sem validação UC-01"</span>
      </div>
    </div>`;

  const cardDepois = renderCardSensor(
    'Temperatura · DEPOIS',
    depois.temperatura,
    '°C',
    'normal',
    '—',
    { icone: '🌡️', corValor: 'text-red-600 dark:text-red-400', corBarra: 'bg-red-500' },
    { motivoRejeicao: depois.errosLeitura?.temperatura }
  );

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${cardAntes}
      ${cardDepois}
    </div>`;
}

function renderPainelAgregacao() {
  const bucket = [
    { temperatura: 20, umidadeAr: 60, umidadeSoloPorcentagem: 50 },
    { temperatura: null, umidadeAr: 60, umidadeSoloPorcentagem: 50 },
    { temperatura: 22, umidadeAr: 60, umidadeSoloPorcentagem: 50 },
  ];
  const medias = agregarBucketLeituras(bucket);
  const mediaBug = parseFloat(((20 + 0 + 22) / 3).toFixed(1));

  return `
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-4 font-mono text-[11px] space-y-2">
      <p class="font-bold text-slate-700 dark:text-slate-200">Agregação — bucket [20 °C, null, 22 °C]</p>
      <p class="text-red-500 dark:text-red-400">Antes (temperatura || 0): média ≈ ${mediaBug} °C — null virava 0</p>
      <p class="text-emerald-600 dark:text-emerald-400">Depois (agregarBucketLeituras): média = ${medias.temperatura} °C — null excluído</p>
    </div>`;
}

function renderGraficoFaixasTemperatura() {
  const w = 800;
  const h = 100;
  const x = (t) => ((t - EIXO_MIN) / (EIXO_MAX - EIXO_MIN)) * w;

  const zonas = [
    { de: -10, ate: TEMP_PLAUSIVEL_HORTA_MAX, fill: 'rgba(16,185,129,0.35)', label: 'Normal / plausível horta' },
    { de: TEMP_PLAUSIVEL_HORTA_MAX, ate: 80, fill: 'rgba(245,158,11,0.35)', label: 'UC-01 ok · improvável (≥50 °C)' },
    { de: 80, ate: 85, fill: 'rgba(248,113,113,0.25)', label: 'Fora UC-01 (80–85)' },
    { de: 85, ate: EIXO_MAX, fill: 'rgba(239,68,68,0.3)', label: 'Rejeitado (sentinel / impossível)' },
  ];

  const zonasSvg = zonas.map(z => `
    <rect x="${x(z.de)}" y="20" width="${Math.max(0, x(z.ate) - x(z.de))}" height="40" fill="${z.fill}" />`).join('');

  const marcadores = [
    { t: 22, cor: '#10b981', rotulo: '22' },
    { t: 50, cor: '#f59e0b', rotulo: '50' },
    { t: 80, cor: '#f59e0b', rotulo: '80' },
    { t: 85, cor: '#ef4444', rotulo: '85' },
    { t: 213, cor: '#ef4444', rotulo: '213' },
  ];

  const marcadoresSvg = marcadores.map(m => `
    <line x1="${x(m.t)}" y1="16" x2="${x(m.t)}" y2="64" stroke="${m.cor}" stroke-width="2" stroke-dasharray="3,2" />
    <circle cx="${x(m.t)}" cy="40" r="5" fill="${m.cor}" />
    <text x="${x(m.t)}" y="78" text-anchor="middle" font-size="11" fill="currentColor">${m.rotulo}°C</text>
  `).join('');

  const legenda = zonas.map(z => `
    <span class="inline-flex items-center gap-1 mr-3">
      <span class="inline-block w-3 h-3 rounded-sm" style="background:${z.fill}"></span>
      <span>${escapeHtml(z.label)}</span>
    </span>`).join('');

  return `
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4">
      <p class="text-[11px] font-mono text-slate-600 dark:text-slate-300">
        Escala ${EIXO_MIN}…${EIXO_MAX} °C · Limiar horta: ${TEMP_PLAUSIVEL_HORTA_MAX} °C · Recorde BR ≈ 44,8 °C
      </p>
      <svg viewBox="0 0 ${w} ${h}" class="w-full h-auto text-slate-700 dark:text-slate-200" role="img" aria-label="Faixas de temperatura UC-01 e plausibilidade horta">
        ${zonasSvg}
        <line x1="0" y1="60" x2="${w}" y2="60" stroke="currentColor" stroke-opacity="0.2" />
        ${marcadoresSvg}
        <text x="0" y="95" font-size="10" fill="currentColor" opacity="0.6">${EIXO_MIN}°C</text>
        <text x="${w - 30}" y="95" font-size="10" fill="currentColor" opacity="0.6">${EIXO_MAX}°C</text>
      </svg>
      <div class="flex flex-wrap gap-y-1 text-[9px] font-mono text-slate-500">${legenda}</div>
      ${renderGraficosDemonstracaoErros()}
    </div>`;
}

function renderCenario(cenario) {
  const registro = normalizarRegistro(cenario.payload);
  return `
    <div class="space-y-3 pb-6 border-b border-slate-200 dark:border-slate-800 last:border-0">
      <div>
        <h4 class="text-sm font-bold text-slate-800 dark:text-white">${escapeHtml(cenario.titulo)}</h4>
        <p class="text-[11px] font-mono text-slate-500 mt-0.5">${escapeHtml(cenario.descricao)}</p>
      </div>
      ${renderCardsSimulacao(registro)}
      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table class="w-full text-left">
          <thead class="bg-slate-50 dark:bg-slate-950/50 text-[9px] uppercase text-slate-400 font-mono">
            <tr>
              <th class="px-3 py-2">Data</th><th class="px-3 py-2">Canteiro</th>
              <th class="px-3 py-2">Temp</th><th class="px-3 py-2">Umid. Ar</th>
              <th class="px-3 py-2">Umid. Solo</th><th class="px-3 py-2">Flags</th>
            </tr>
          </thead>
          <tbody>${renderMiniHistorico(registro)}</tbody>
        </table>
      </div>
    </div>`;
}

function renderTabelaBoundary() {
  const rows = TABELA_BOUNDARY.map(r => `
    <tr class="border-b border-slate-100 dark:border-slate-800 font-mono text-[11px]">
      <td class="px-3 py-2">${escapeHtml(r.campo)}</td>
      <td class="px-3 py-2">${escapeHtml(r.input)}</td>
      <td class="px-3 py-2">${escapeHtml(String(r.esperado))}</td>
      <td class="px-3 py-2">${r.suspeita ? 'sim' : 'não'}</td>
      <td class="px-3 py-2">${escapeHtml(r.motivo)}</td>
      <td class="px-3 py-2 text-[10px]">${escapeHtml(r.naUi || '—')}</td>
    </tr>`).join('');

  return `
    <table class="w-full text-left rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
      <thead class="bg-slate-50 dark:bg-slate-950/50 text-[9px] uppercase text-slate-400">
        <tr>
          <th class="px-3 py-2">Campo</th><th class="px-3 py-2">Input</th>
          <th class="px-3 py-2">Esperado</th><th class="px-3 py-2">Suspeita</th>
          <th class="px-3 py-2">Motivo UC-01</th><th class="px-3 py-2">Na UI</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="text-[10px] font-mono text-slate-500 mt-2">${escapeHtml(NOTA_BORDA_80)}</p>`;
}

export function renderEvidenciasC1View({ logTestes = '' }) {
  const decisoesHtml = DECISOES_RESUMO.map(renderTabelaDecisoes).join('');
  const cenariosHtml = CENARIOS_SIMULACAO.map(renderCenario).join('');

  const conteudo = `
    <div class="space-y-8">
      <div class="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-lg px-4 py-3 font-mono text-[11px] text-blue-800 dark:text-blue-300">
        <p><strong>${escapeHtml(METADADOS.autor)}</strong> · ${escapeHtml(METADADOS.data)}</p>
        <p class="mt-1">Rastreabilidade: UC-01 Passo 4 · Risco ${METADADOS.riscoId} · Teste <code>${METADADOS.testId}</code> · Evento <code>reading_rejected</code></p>
        <p class="mt-1 text-blue-600 dark:text-blue-400">Documento completo: <code>${escapeHtml(METADADOS.docDecisoes)}</code></p>
      </div>

      <section>
        <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 font-mono mb-3">A · Decisões de implementação</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${decisoesHtml}</div>
      </section>

      <section>
        <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 font-mono mb-3">B · Simulações do dashboard</h2>
        <div class="space-y-6">
          <div>
            <h3 class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Antes vs Depois — 213 °C</h3>
            ${renderAntesDepois213()}
          </div>
          ${cenariosHtml}
          ${renderPainelAgregacao()}
        </div>
      </section>

      <section>
        <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 font-mono mb-3">D · Faixas de temperatura e gráfico</h2>
        ${renderGraficoFaixasTemperatura()}
      </section>

      <section>
        <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 font-mono mb-3">C · Evidência de testes (${escapeHtml(METADADOS.testId)})</h2>
        <div class="space-y-4">
          ${renderTabelaBoundary()}
          <p class="text-[11px] font-mono text-slate-500">Matriz de riscos: ${escapeHtml(METADADOS.testStrategy)} (Risco ${METADADOS.riscoId})</p>
          <div class="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div class="px-4 py-2 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-500">test-unit-c1.log</div>
            <pre class="p-4 overflow-x-auto text-[10px] leading-relaxed font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-[#0f172a] max-h-[480px] overflow-y-auto whitespace-pre-wrap">${escapeHtml(logTestes)}</pre>
          </div>
        </div>
      </section>
    </div>`;

  return renderPageShell(METADADOS.titulo, METADADOS.subtitulo, conteudo);
}
