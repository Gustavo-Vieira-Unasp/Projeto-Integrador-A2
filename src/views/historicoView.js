import { renderPageShell, renderEstadoLoading, renderEstadoErro, renderEstadoVazio } from '../services/uiStateService.js';
import { escapeHtml } from '../services/cardHelpers.js';
import { getCanteiros } from '../services/canteirosService.js';

export function renderHistoricoView({ estado, leituras = [], paginacao = {}, filtros = {}, erro = null }) {
  if (estado === 'loading') return renderEstadoLoading('Carregando histórico...');
  if (estado === 'error') return renderEstadoErro(erro || 'Falha ao carregar histórico', 'btn-retry-historico');

  const canteiros = getCanteiros();
  const { page = 1, totalPages = 1, total = 0 } = paginacao;

  const filtrosHtml = `
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-wrap gap-3 font-mono text-[11px]">
      <label class="flex flex-col gap-1">
        <span class="text-slate-400 uppercase text-[9px]">Canteiro</span>
        <select id="filtro-hist-canteiro" class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1">
          <option value="">Todos</option>
          ${canteiros.map(c => {
            const label = c.fonteApi ? escapeHtml(c.nome) : `${escapeHtml(c.nome)} (sem sensor)`;
            return `<option value="${c.id}" ${filtros.canteiroId === c.id ? 'selected' : ''}>${label}</option>`;
          }).join('')}
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-slate-400 uppercase text-[9px]">Início</span>
        <input type="datetime-local" id="filtro-hist-inicio" value="${filtros.inicio || ''}"
          class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1">
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-slate-400 uppercase text-[9px]">Fim</span>
        <input type="datetime-local" id="filtro-hist-fim" value="${filtros.fim || ''}"
          class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1">
      </label>
      <button id="btn-aplicar-filtros-historico" class="self-end bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded">Filtrar</button>
      <button id="btn-exportar-csv" class="self-end bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded">Exportar CSV</button>
    </div>`;

  if (estado === 'empty' || leituras.length === 0) {
    return renderPageShell('Histórico', 'Leituras passadas dos sensores', `
      ${filtrosHtml}
      ${renderEstadoVazio('Nenhuma leitura encontrada', 'Ajuste o intervalo de datas ou o canteiro selecionado.')}
    `);
  }

  const rows = leituras.map(r => {
    const flags = [];
    if (r.sensorOffline) flags.push('<span class="text-red-500">offline</span>');
    if (r.leituraSuspeita) flags.push('<span class="text-amber-500">suspeito</span>');
    if (r.temperaturaImprovavel && !r.leituraSuspeita) flags.push('<span class="text-amber-600">improvável</span>');
    const dataFmt = new Date(r.dataHora).toLocaleString('pt-BR');
    return `
      <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
        <td class="px-3 py-2 font-mono text-[11px]">${dataFmt}</td>
        <td class="px-3 py-2 font-mono text-[11px]">${escapeHtml(r.canteiroId || 'A')}</td>
        <td class="px-3 py-2 font-mono text-[11px]">${r.temperatura ?? '—'}°C</td>
        <td class="px-3 py-2 font-mono text-[11px]">${r.umidadeAr ?? '—'}%</td>
        <td class="px-3 py-2 font-mono text-[11px]">${r.umidadeSoloPorcentagem ?? '—'}%</td>
        <td class="px-3 py-2 font-mono text-[11px]">${r.luzSolar ?? '—'}%</td>
        <td class="px-3 py-2 font-mono text-[10px]">${flags.join(' ') || '—'}</td>
      </tr>`;
  }).join('');

  const pagHtml = `
    <div class="flex items-center justify-between font-mono text-[11px] text-slate-500 px-1">
      <span>${total} registro(s) · página ${page}/${totalPages}</span>
      <div class="flex gap-2">
        <button id="btn-hist-prev" ${page <= 1 ? 'disabled' : ''} class="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-30">Anterior</button>
        <button id="btn-hist-next" ${page >= totalPages ? 'disabled' : ''} class="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-30">Próxima</button>
      </div>
    </div>`;

  return renderPageShell('Histórico', 'Leituras passadas com paginação', `
    ${filtrosHtml}
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-slate-50 dark:bg-slate-950 text-[10px] uppercase text-slate-500 font-bold">
          <tr>
            <th class="px-3 py-2">Data/Hora</th>
            <th class="px-3 py-2">Canteiro</th>
            <th class="px-3 py-2">Temp</th>
            <th class="px-3 py-2">Umid. Ar</th>
            <th class="px-3 py-2">Umid. Solo</th>
            <th class="px-3 py-2">Luz</th>
            <th class="px-3 py-2">Flags</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pagHtml}
  `);
}

export function lerFiltrosHistoricoDoDOM() {
  return {
    canteiroId: document.getElementById('filtro-hist-canteiro')?.value || '',
    inicio: document.getElementById('filtro-hist-inicio')?.value || '',
    fim: document.getElementById('filtro-hist-fim')?.value || '',
  };
}

export function gerarCsvLeituras(leituras) {
  const header = 'dataHora,canteiro,temperatura,umidadeAr,umidadeSolo,luzSolar,flags\n';
  const rows = leituras.map(r => {
    const flags = [];
    if (r.sensorOffline) flags.push('offline');
    if (r.leituraSuspeita) flags.push('suspeito');
    if (r.temperaturaImprovavel && !r.leituraSuspeita) flags.push('improvavel');
    return [
      r.dataHora,
      r.canteiroId || 'A',
      r.temperatura ?? '',
      r.umidadeAr ?? '',
      r.umidadeSoloPorcentagem ?? '',
      r.luzSolar ?? '',
      flags.join('|'),
    ].join(',');
  }).join('\n');
  return header + rows;
}

export function downloadCsv(conteudo, nome = 'historico-phorta.csv') {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
