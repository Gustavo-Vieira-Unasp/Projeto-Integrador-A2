import { renderNavbar } from './appRenderService.js';
import { gerarLayoutDashboard } from './dashboardViewService.js';
import { inicializarGraficoAnalitico, inicializarGraficoRelatorio } from './chartService.js';
import {
  fetchDashboardPayload,
  getCachedPayload,
  setCachedPayload,
  getAlertas,
  getHistoricoLeituras,
  getRelatorioAgregado,
  getStatusCanteiros,
  getCanteiros,
  createCanteiro,
  updateCanteiro,
  deleteCanteiro,
} from './dataService.js';
import {
  carregarCacheSnapshot,
  carregarSessaoLocal,
  salvarSessaoLocal,
  toCachedResponse,
} from './cacheService.js';
import { obterTelemetriaMockada, obterHistoricoMockado } from './mockService.js';
import { agregarBucketLeituras, enviarComandoIrrigacao } from './apiService.js';
import { sanitizarEntradaData, sanitizarDuracaoIrrigacao } from './cardHelpers.js';
import {
  iniciarRouter,
  onRouteChange,
  getRotaAtual,
  parseQueryParams,
  navegarPara,
} from './routerService.js';
import { renderAlertasView, lerFiltrosAlertasDoDOM } from '../views/alertasView.js';
import {
  renderHistoricoView,
  lerFiltrosHistoricoDoDOM,
  gerarCsvLeituras,
  downloadCsv,
} from '../views/historicoView.js';
import {
  renderCanteirosView,
  lerFormCanteiroDoDOM,
} from '../views/canteirosView.js';
import { renderEvidenciasC1View } from '../views/evidenciasC1View.js';
import { carregarLogTestes } from './evidenciasC1Content.js';
import {
  exporMetricsGlobais,
  logInfo,
  recordScreenRender,
  recordAlertsDisplayed,
} from './observabilityService.js';

const JANELA_PADRAO_HORAS = 48;

let estadoApp = {
  cenarioAtual: 'offline',
  filtroDataAtivo: false,
  filtrosVisibilidade: {
    umid_solo: true, umid_ar: true, temp: true, luz: true, ph: true,
    chuva: true, alerta: true, irrigacao: true,
  },
  configAgrupamento: { unidade: 'minuto', fator: 1 },
  configData: { inicio: '', fim: '', fimControleManual: false },
  limitesData: { min: '', max: '' },
  telemetriaAtual: null,
  telemetriaAnterior: null,
  dadosGraficoTimelineBrutos: [],
  dadosGraficoTimelineAgrupados: [],
  pontoSelecionado: null,
  timestampInicio: Date.now(),
  ultimoComando: null,
  logErros: [],
  duracaoIrrigacaoSeg: 60,
  fetchedAt: null,
  statusCanteiros: [],
  relatorioIrrigacao: [],
  uiEstado: 'loading',
  uiErro: null,
  // Sub-telas
  alertasFiltros: { canteiroId: 'todos', tipo: 'todos', periodoDias: 7 },
  alertasLista: [],
  historicoFiltros: { canteiroId: '', inicio: '', fim: '' },
  historicoPagina: 1,
  historicoDados: [],
  historicoPaginacao: {},
  canteirosForm: { mode: null, data: {}, erros: [], feedback: null },
};

let chartInstance = null;
let relatorioChartInstance = null;
let agendadorTimeout = null;
let estaCarregando = false;

const navContainer = document.getElementById('nav-container');
const appContainer = document.getElementById('app-container');

function adicionarLogErro(nivel, mensagem) {
  const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  estadoApp.logErros.unshift({ nivel, mensagem, timestamp });
  if (estadoApp.logErros.length > 20) estadoApp.logErros.pop();
  persistirSessaoLocal();
}

function persistirSessaoLocal() {
  salvarSessaoLocal({
    timestampInicio: estadoApp.timestampInicio,
    logErros: estadoApp.logErros,
    filtrosVisibilidade: estadoApp.filtrosVisibilidade,
    configAgrupamento: estadoApp.configAgrupamento,
    filtroDataAtivo: estadoApp.filtroDataAtivo,
    configData: estadoApp.configData,
    duracaoIrrigacaoSeg: estadoApp.duracaoIrrigacaoSeg,
    ultimoComando: estadoApp.ultimoComando,
    alertasFiltros: estadoApp.alertasFiltros,
  });
}

function restaurarSessaoLocal() {
  const sessao = carregarSessaoLocal();
  if (!sessao) return;
  if (sessao.timestampInicio) estadoApp.timestampInicio = sessao.timestampInicio;
  if (Array.isArray(sessao.logErros)) estadoApp.logErros = sessao.logErros;
  if (sessao.filtrosVisibilidade) estadoApp.filtrosVisibilidade = sessao.filtrosVisibilidade;
  if (sessao.configAgrupamento) estadoApp.configAgrupamento = sessao.configAgrupamento;
  if (typeof sessao.filtroDataAtivo === 'boolean') estadoApp.filtroDataAtivo = sessao.filtroDataAtivo;
  if (sessao.configData) estadoApp.configData = { ...estadoApp.configData, ...sessao.configData };
  if (sessao.duracaoIrrigacaoSeg) estadoApp.duracaoIrrigacaoSeg = sessao.duracaoIrrigacaoSeg;
  if (sessao.ultimoComando) estadoApp.ultimoComando = sessao.ultimoComando;
  if (sessao.alertasFiltros) estadoApp.alertasFiltros = { ...estadoApp.alertasFiltros, ...sessao.alertasFiltros };
}

function aplicarPayloadNoEstado(payload) {
  estadoApp.telemetriaAnterior = estadoApp.telemetriaAtual;
  estadoApp.cenarioAtual = payload.cenario || 'offline';
  estadoApp.telemetriaAtual = payload.telemetria;
  estadoApp.dadosGraficoTimelineBrutos = payload.historico || [];
  estadoApp.fetchedAt = payload.fetchedAt ?? null;
  setCachedPayload(payload);
}

function comandoBloqueado() {
  return estadoApp.cenarioAtual === 'offline' || estadoApp.cenarioAtual.endsWith('-cached');
}

function converterStringBrParaDate(stringBr) {
  try {
    if (!stringBr || !stringBr.includes('/')) return new Date();
    const partes = stringBr.trim().split(' ');
    const [dia, mes, ano] = partes[0].split('/').map(Number);
    const [hora, min] = (partes[1] || '00:00').split(':').map(Number);
    return new Date(ano || 2026, mes - 1, dia, hora || 0, min || 0, 0);
  } catch { return new Date(); }
}

function formatarDateParaStringBr(d) {
  if (!d || isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parsearDataHora(valor) {
  if (!valor) return NaN;
  if (typeof valor === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor))
      return new Date(valor + ':00-03:00').getTime();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(valor))
      return new Date(valor.replace(' ', 'T') + '-03:00').getTime();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(valor))
      return converterStringBrParaDate(valor).getTime();
    if (/^\d{4}\/\d{2}\/\d{2}/.test(valor))
      return new Date(valor.replace(/\//g, '-').replace(' ', 'T')).getTime();
  }
  return new Date(valor).getTime();
}

async function atualizarEstadoDados() {
  if (estaCarregando) return;
  estaCarregando = true;
  estadoApp.uiEstado = 'loading';

  try {
    const payload = await fetchDashboardPayload();
    aplicarPayloadNoEstado(payload);

    if (!estadoApp.dadosGraficoTimelineBrutos?.length) {
      adicionarLogErro('WARN', 'Histórico vazio — usando mock local');
      estadoApp.dadosGraficoTimelineBrutos = obterHistoricoMockado();
      estadoApp.cenarioAtual = 'offline';
      estadoApp.fetchedAt = null;
    }
    if (!estadoApp.telemetriaAtual) {
      estadoApp.telemetriaAtual = obterTelemetriaMockada();
    }

    estadoApp.statusCanteiros = await getStatusCanteiros();
    estadoApp.relatorioIrrigacao = await getRelatorioAgregado({ periodo: 7 });

    const origem = payload.fromCache ? 'cache' : 'rede';
    adicionarLogErro('OK', `${estadoApp.dadosGraficoTimelineBrutos.length} registros | ${estadoApp.cenarioAtual} (${origem})`);
    estadoApp.uiEstado = 'success';
    estadoApp.uiErro = null;
  } catch (err) {
    adicionarLogErro('ERR', `Falha na API: ${err.message}`);
    estadoApp.uiEstado = 'error';
    estadoApp.uiErro = err.message;
    const cached = await carregarCacheSnapshot();
    if (cached) {
      aplicarPayloadNoEstado(toCachedResponse(cached));
      estadoApp.uiEstado = 'success';
      adicionarLogErro('WARN', 'Recuperado do cache local após erro');
    } else {
      estadoApp.cenarioAtual = 'offline';
      estadoApp.fetchedAt = null;
      estadoApp.dadosGraficoTimelineBrutos = obterHistoricoMockado();
      estadoApp.telemetriaAtual = obterTelemetriaMockada();
      estadoApp.statusCanteiros = await getStatusCanteiros();
      estadoApp.relatorioIrrigacao = await getRelatorioAgregado({ periodo: 7 });
      estadoApp.uiEstado = 'success';
    }
  } finally {
    estaCarregando = false;
  }

  const agora = new Date();
  estadoApp.limitesData.max = formatarDateParaStringBr(agora);
  if (!estadoApp.configData.fimControleManual) {
    estadoApp.configData.fim = estadoApp.limitesData.max;
  }

  processarAgrupamentoETempo();
}

function processarAgrupamentoETempo() {
  const brutos = estadoApp.dadosGraficoTimelineBrutos;
  if (!brutos?.length) return;

  let filtrados;

  if (estadoApp.filtroDataAtivo && estadoApp.configData.inicio) {
    const ini = parsearDataHora(estadoApp.configData.inicio);
    const fim = estadoApp.configData.fimControleManual
      ? parsearDataHora(estadoApp.configData.fim)
      : Date.now();
    filtrados = brutos.filter(p => {
      const ts = parsearDataHora(p.dataHora);
      return !isNaN(ts) && ts >= ini && ts <= fim;
    });
  } else {
    const corte = Date.now() - JANELA_PADRAO_HORAS * 60 * 60 * 1000;
    filtrados = brutos.filter(p => {
      const ts = parsearDataHora(p.dataHora);
      return !isNaN(ts) && ts >= corte;
    });
  }

  if (!filtrados.length) {
    estadoApp.dadosGraficoTimelineAgrupados = [];
    return;
  }

  const factor = parseInt(estadoApp.configAgrupamento.fator) || 1;
  const unit = estadoApp.configAgrupamento.unidade;
  const buckets = {};

  filtrados.forEach(p => {
    const dt = new Date(parsearDataHora(p.dataHora));
    if (unit === 'minuto') dt.setMinutes(Math.floor(dt.getMinutes() / factor) * factor, 0, 0);
    else if (unit === 'hora') dt.setHours(Math.floor(dt.getHours() / factor) * factor, 0, 0, 0);
    else if (unit === 'dia') dt.setHours(0, 0, 0, 0);
    else dt.setMinutes(Math.floor(dt.getMinutes() / factor) * factor, 0, 0);
    const k = dt.toISOString();
    if (!buckets[k]) buckets[k] = [];
    buckets[k].push(p);
  });

  estadoApp.dadosGraficoTimelineAgrupados = Object.keys(buckets).sort().map(chave => {
    const lista = buckets[chave];
    const dt = new Date(chave);
    const medias = agregarBucketLeituras(lista);
    const chuva = lista.filter((r) => r.estaChovendo).length;
    const alerta = lista.filter((r) => r.alertaCriticoAlface).length;
    const irrigacao = lista.filter((r) => r.statusIrrigacao === 'LIGADO').length;
    const total = lista.length;

    return {
      dataHora: `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour12: false })}`,
      umidadeSoloPorcentagem: medias.umidadeSoloPorcentagem,
      umidadeAr: medias.umidadeAr,
      temperatura: medias.temperatura,
      luzSolar: medias.luzSolar,
      pHSolo: medias.pHSolo,
      estaChovendo: (chuva / total) >= 0.5,
      alertaCriticoAlface: (alerta / total) >= 0.5,
      statusIrrigacao: (irrigacao / total) >= 0.5 ? 'LIGADO' : 'DESLIGADO',
      vazaoGotejamentoLh: lista[0]?.vazaoGotejamentoLh || 0,
      controleManualAtivo: lista[0]?.controleManualAtivo || false,
      estacao: lista[0]?.estacao || '---',
      condicaoCeu: lista[0]?.condicaoCeu || '---',
    };
  });
}

function sincronizarPontoSelecionado(p) {
  estadoApp.pontoSelecionado = {
    horario: p.dataHora?.split(' ')[1] ?? '--:--:--',
    temperatura_c: p.temperatura ?? p.temperaturaCelsius ?? 0,
    luminosidade_lux: p.luzSolar ?? 0,
    umidade_ar_pct: p.umidadeAr ?? 0,
    umidade_solo_pct: p.umidadeSoloPorcentagem ?? 0,
    irrigacao_ativa: p.statusIrrigacao === 'LIGADO',
    ph_solo: p.pHSolo || 7,
    vazao_gotejamento: p.vazaoGotejamentoLh || 0,
    controle_manual: p.controleManualAtivo || false,
    estacao: p.estacao || '---',
    condicao_ceu: p.condicaoCeu || '---',
  };
}

async function carregarAlertas() {
  estadoApp.uiEstado = 'loading';
  try {
    const result = await getAlertas({
      ...estadoApp.alertasFiltros,
      pageSize: 50,
    });
    estadoApp.alertasLista = result.items;
    estadoApp.uiEstado = result.items.length ? 'success' : 'empty';
    recordAlertsDisplayed(result.items.length);
  } catch (err) {
    estadoApp.uiEstado = 'error';
    estadoApp.uiErro = err.message;
  }
}

async function carregarHistorico() {
  estadoApp.uiEstado = 'loading';
  try {
    const f = estadoApp.historicoFiltros;
    const result = await getHistoricoLeituras({
      canteiroId: f.canteiroId || undefined,
      inicio: f.inicio || undefined,
      fim: f.fim || undefined,
      page: estadoApp.historicoPagina,
      pageSize: 15,
    });
    estadoApp.historicoDados = result.items;
    estadoApp.historicoPaginacao = {
      page: result.page,
      totalPages: result.totalPages,
      total: result.total,
    };
    estadoApp.uiEstado = result.items.length ? 'success' : 'empty';
  } catch (err) {
    estadoApp.uiEstado = 'error';
    estadoApp.uiErro = err.message;
  }
}

function carregarCanteirosView() {
  estadoApp.uiEstado = 'success';
}

function destruirCharts() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (relatorioChartInstance) { relatorioChartInstance.destroy(); relatorioChartInstance = null; }
}

function renderizarPrincipal() {
  const t0 = performance.now();
  destruirCharts();

  appContainer.innerHTML = gerarLayoutDashboard({
    telemetriaAtual: estadoApp.telemetriaAtual,
    telemetriaAnterior: estadoApp.telemetriaAnterior,
    pontoSelecionado: estadoApp.pontoSelecionado,
    cenarioAtual: estadoApp.cenarioAtual,
    filtrosVisibilidade: estadoApp.filtrosVisibilidade,
    configAgrupamento: estadoApp.configAgrupamento,
    configData: estadoApp.configData,
    limitesData: estadoApp.limitesData,
    timestampInicio: estadoApp.timestampInicio,
    fetchedAt: estadoApp.fetchedAt,
    ultimoComando: estadoApp.ultimoComando,
    logErros: estadoApp.logErros,
    duracaoIrrigacaoSeg: estadoApp.duracaoIrrigacaoSeg,
    statusCanteiros: estadoApp.statusCanteiros,
    relatorioIrrigacao: estadoApp.relatorioIrrigacao,
    uiEstado: estadoApp.uiEstado,
    uiErro: estadoApp.uiErro,
  });

  if (estadoApp.uiEstado !== 'success') {
    document.getElementById('btn-retry-principal')?.addEventListener('click', () => processarCicloDadosEUI());
    recordScreenRender('principal', performance.now() - t0);
    return;
  }

  const canvas = document.getElementById('analiseChart');
  if (canvas && estadoApp.dadosGraficoTimelineAgrupados.length) {
    chartInstance = inicializarGraficoAnalitico(
      canvas,
      estadoApp.dadosGraficoTimelineAgrupados,
      chartInstance,
      (ponto) => { sincronizarPontoSelecionado(ponto); renderizarTelaAtual(); }
    );
    if (chartInstance) {
      chartInstance.data.datasets.forEach(ds => {
        ds.hidden = !estadoApp.filtrosVisibilidade[ds.id];
      });
      chartInstance.update('none');
    }
  }

  const relCanvas = document.getElementById('relatorioChart');
  if (relCanvas && estadoApp.relatorioIrrigacao.length) {
    relatorioChartInstance = inicializarGraficoRelatorio(
      relCanvas,
      estadoApp.relatorioIrrigacao,
      relatorioChartInstance
    );
  }

  vincularEventosDashboard();
  recordScreenRender('principal', performance.now() - t0);
}

function renderizarAlertas() {
  const t0 = performance.now();
  destruirCharts();
  appContainer.innerHTML = renderAlertasView({
    estado: estadoApp.uiEstado,
    alertas: estadoApp.alertasLista,
    filtros: estadoApp.alertasFiltros,
    erro: estadoApp.uiErro,
  });
  vincularEventosAlertas();
  recordScreenRender('alertas', performance.now() - t0);
}

function renderizarHistorico() {
  const t0 = performance.now();
  destruirCharts();
  appContainer.innerHTML = renderHistoricoView({
    estado: estadoApp.uiEstado,
    leituras: estadoApp.historicoDados,
    paginacao: estadoApp.historicoPaginacao,
    filtros: estadoApp.historicoFiltros,
    erro: estadoApp.uiErro,
  });
  vincularEventosHistorico();
  recordScreenRender('historico', performance.now() - t0);
}

function renderizarCanteiros() {
  const t0 = performance.now();
  destruirCharts();
  appContainer.innerHTML = renderCanteirosView({
    estado: estadoApp.uiEstado,
    canteiros: getCanteiros(),
    formMode: estadoApp.canteirosForm.mode,
    formData: estadoApp.canteirosForm.data,
    erros: estadoApp.canteirosForm.erros,
    feedback: estadoApp.canteirosForm.feedback,
    erro: estadoApp.uiErro,
  });
  vincularEventosCanteiros();
  recordScreenRender('canteiros', performance.now() - t0);
}

async function renderizarEvidenciasC1() {
  const t0 = performance.now();
  if (appContainer) {
    appContainer.innerHTML = '<div class="flex flex-col items-center justify-center py-20 gap-4"><div class="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div><p class="text-sm font-mono text-slate-500">Carregando evidências C1...</p></div>';
  }
  const logTestes = await carregarLogTestes();
  if (appContainer) {
    appContainer.innerHTML = renderEvidenciasC1View({ logTestes });
  }
  recordScreenRender('evidencias-c1', performance.now() - t0);
}

function renderizarTelaAtual() {
  atualizarNavbar();
  const rota = getRotaAtual();
  if (rota === 'alertas') renderizarAlertas();
  else if (rota === 'historico') renderizarHistorico();
  else if (rota === 'canteiros') renderizarCanteiros();
  else if (rota === 'evidencias-c1') renderizarEvidenciasC1();
  else renderizarPrincipal();
}

function atualizarNavbar() {
  if (navContainer) {
    navContainer.innerHTML = renderNavbar(estadoApp.cenarioAtual, getRotaAtual());
  }
}

function vincularEventosDashboard() {
  document.querySelectorAll('.chk-visibilidade').forEach(chk => {
    chk.addEventListener('change', e => {
      const id = e.target.getAttribute('data-series');
      estadoApp.filtrosVisibilidade[id] = e.target.checked;
      persistirSessaoLocal();
      if (chartInstance) {
        const ds = chartInstance.data.datasets.find(d => d.id === id);
        if (ds) { ds.hidden = !e.target.checked; chartInstance.update(); }
      }
    });
  });

  document.getElementById('select-unidade-tempo')?.addEventListener('change', e => {
    estadoApp.configAgrupamento.unidade = e.target.value;
    persistirSessaoLocal();
    processarAgrupamentoETempo();
    renderizarTelaAtual();
  });

  document.getElementById('input-fator-tempo')?.addEventListener('change', e => {
    estadoApp.configAgrupamento.fator = Math.max(1, parseInt(e.target.value) || 1);
    persistirSessaoLocal();
    processarAgrupamentoETempo();
    renderizarTelaAtual();
  });

  document.getElementById('btn-aplicar-datas')?.addEventListener('click', () => {
    const ini = sanitizarEntradaData(document.getElementById('filtro-data-inicio')?.value);
    const fim = sanitizarEntradaData(document.getElementById('filtro-data-fim')?.value);
    if (!ini) return;
    estadoApp.configData.inicio = ini;
    estadoApp.configData.fim = fim || '';
    estadoApp.configData.fimControleManual = !!(fim && fim !== '');
    estadoApp.filtroDataAtivo = true;
    persistirSessaoLocal();
    processarAgrupamentoETempo();
    renderizarTelaAtual();
  });

  document.getElementById('btn-limpar-datas')?.addEventListener('click', () => {
    estadoApp.filtroDataAtivo = false;
    estadoApp.configData.inicio = '';
    estadoApp.configData.fim = '';
    estadoApp.configData.fimControleManual = false;
    persistirSessaoLocal();
    processarAgrupamentoETempo();
    renderizarTelaAtual();
  });

  document.getElementById('select-duracao-irrigacao')?.addEventListener('change', e => {
    estadoApp.duracaoIrrigacaoSeg = sanitizarDuracaoIrrigacao(e.target.value);
    persistirSessaoLocal();
  });

  document.getElementById('btn-toggle-bomba')?.addEventListener('click', async () => {
    if (comandoBloqueado()) return;

    const bombaAtiva = estadoApp.telemetriaAtual?.statusIrrigacao === 'LIGADO';
    const ligar = !bombaAtiva;
    const cmd = ligar
      ? `Iniciar irrigação (${estadoApp.duracaoIrrigacaoSeg}s)`
      : 'Parar irrigação';

    estadoApp.ultimoComando = `${cmd}…`;
    renderizarTelaAtual();

    const resultado = await enviarComandoIrrigacao(ligar);

    if (resultado.ok) {
      estadoApp.ultimoComando = `${cmd} — ${resultado.statusAtual}`;
      adicionarLogErro('CMD', estadoApp.ultimoComando);
      logInfo('irrigation_command_ok', {
        ligar,
        status: resultado.statusAtual,
        baseUrl: resultado.baseUrl,
      });
      persistirSessaoLocal();
      await processarCicloDadosEUI();
      return;
    }

    estadoApp.ultimoComando = `${cmd} — FALHOU`;
    adicionarLogErro('ERR', resultado.erro || 'Falha ao enviar comando de irrigação');
    logInfo('irrigation_command_failed', { ligar, erro: resultado.erro });
    persistirSessaoLocal();
    renderizarTelaAtual();
  });
}

function vincularEventosAlertas() {
  document.getElementById('btn-aplicar-filtros-alertas')?.addEventListener('click', async () => {
    estadoApp.alertasFiltros = lerFiltrosAlertasDoDOM();
    persistirSessaoLocal();
    await carregarAlertas();
    renderizarTelaAtual();
  });
  document.getElementById('btn-retry-alertas')?.addEventListener('click', async () => {
    await carregarAlertas();
    renderizarTelaAtual();
  });
}

function vincularEventosHistorico() {
  document.getElementById('btn-aplicar-filtros-historico')?.addEventListener('click', async () => {
    const f = lerFiltrosHistoricoDoDOM();
    estadoApp.historicoFiltros = {
      canteiroId: f.canteiroId,
      inicio: sanitizarEntradaData(f.inicio),
      fim: sanitizarEntradaData(f.fim),
    };
    estadoApp.historicoPagina = 1;
    await carregarHistorico();
    renderizarTelaAtual();
  });

  document.getElementById('btn-hist-prev')?.addEventListener('click', async () => {
    if (estadoApp.historicoPagina > 1) {
      estadoApp.historicoPagina -= 1;
      await carregarHistorico();
      renderizarTelaAtual();
    }
  });

  document.getElementById('btn-hist-next')?.addEventListener('click', async () => {
    if (estadoApp.historicoPagina < (estadoApp.historicoPaginacao.totalPages || 1)) {
      estadoApp.historicoPagina += 1;
      await carregarHistorico();
      renderizarTelaAtual();
    }
  });

  document.getElementById('btn-exportar-csv')?.addEventListener('click', async () => {
    const f = estadoApp.historicoFiltros;
    const all = await getHistoricoLeituras({
      canteiroId: f.canteiroId || undefined,
      inicio: f.inicio || undefined,
      fim: f.fim || undefined,
      page: 1,
      pageSize: 500,
    });
    downloadCsv(gerarCsvLeituras(all.items));
    logInfo('csv_export', { count: all.items.length });
  });

  document.getElementById('btn-retry-historico')?.addEventListener('click', async () => {
    await carregarHistorico();
    renderizarTelaAtual();
  });
}

function vincularEventosCanteiros() {
  document.getElementById('btn-novo-canteiro')?.addEventListener('click', () => {
    estadoApp.canteirosForm = { mode: 'create', data: {}, erros: [], feedback: null };
    renderizarTelaAtual();
  });

  document.getElementById('btn-cancelar-canteiro')?.addEventListener('click', () => {
    estadoApp.canteirosForm = { mode: null, data: {}, erros: [], feedback: null };
    renderizarTelaAtual();
  });

  document.querySelectorAll('.btn-canteiro-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'edit') {
        const c = getCanteiros().find(x => x.id === id);
        estadoApp.canteirosForm = { mode: 'edit', data: { ...c }, erros: [], feedback: null };
        renderizarTelaAtual();
      } else if (action === 'delete') {
        if (confirm(`Excluir canteiro ${id}?`)) {
          const r = deleteCanteiro(id);
          estadoApp.canteirosForm.feedback = r.ok
            ? { tipo: 'ok', mensagem: 'Canteiro excluído' }
            : { tipo: 'erro', mensagem: r.erros.join(', ') };
          renderizarTelaAtual();
        }
      }
    });
  });

  document.getElementById('btn-salvar-canteiro')?.addEventListener('click', () => {
    const mode = estadoApp.canteirosForm.mode;
    const dados = lerFormCanteiroDoDOM(mode);
    const r = mode === 'create'
      ? createCanteiro(dados)
      : updateCanteiro(dados._mode === 'edit' ? estadoApp.canteirosForm.data.id : dados.id, dados);

    if (r.ok) {
      estadoApp.canteirosForm = {
        mode: null,
        data: {},
        erros: [],
        feedback: { tipo: 'ok', mensagem: mode === 'create' ? 'Canteiro criado' : 'Canteiro atualizado' },
      };
    } else {
      estadoApp.canteirosForm.erros = r.erros;
    }
    renderizarTelaAtual();
  });

  document.getElementById('btn-retry-canteiros')?.addEventListener('click', () => {
    carregarCanteirosView();
    renderizarTelaAtual();
  });
}

async function processarCicloDadosEUI() {
  await atualizarEstadoDados();
  if (!estadoApp.pontoSelecionado && estadoApp.telemetriaAtual) {
    sincronizarPontoSelecionado(estadoApp.telemetriaAtual);
  }
  renderizarTelaAtual();
}

async function onRotaMudou(rota, query) {
  logInfo('route_change', { screen: rota });

  if (query.canteiro) {
    estadoApp.alertasFiltros.canteiroId = query.canteiro;
  }
  if (query.tipo) {
    estadoApp.alertasFiltros.tipo = query.tipo;
  }

  if (rota === 'alertas') {
    await carregarAlertas();
  } else if (rota === 'historico') {
    await carregarHistorico();
  } else if (rota === 'canteiros') {
    carregarCanteirosView();
  } else if (rota === 'evidencias-c1') {
    /* render estático + fetch log local */
  } else if (rota === 'principal') {
    if (!getCachedPayload()) await atualizarEstadoDados();
  }

  renderizarTelaAtual();
}

function agendarProximaAtualizacao() {
  if (agendadorTimeout) clearTimeout(agendadorTimeout);
  const agora = new Date();
  const msAteVirada = 60000 - (agora.getSeconds() * 1000 + agora.getMilliseconds());
  agendadorTimeout = setTimeout(async () => {
    if (!estadoApp.configData.fimControleManual && getRotaAtual() === 'principal') {
      await processarCicloDadosEUI();
    }
    agendarProximaAtualizacao();
  }, msAteVirada + 30000);
}

function vincularToggleTema() {
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-toggle-tema')) {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme',
        document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      renderizarTelaAtual();
    }
  });
}

async function inicializarOrquestrador() {
  exporMetricsGlobais();
  logInfo('app_boot', { version: '0.2.0-dashboard-rc' });
  restaurarSessaoLocal();

  if (navContainer) {
    navContainer.innerHTML = renderNavbar(estadoApp.cenarioAtual, getRotaAtual());
  }

  const cached = await carregarCacheSnapshot();
  if (cached) {
    aplicarPayloadNoEstado(toCachedResponse(cached));
    processarAgrupamentoETempo();
    if (estadoApp.telemetriaAtual) {
      sincronizarPontoSelecionado(estadoApp.telemetriaAtual);
    }
    estadoApp.uiEstado = 'success';
  }

  iniciarRouter();
  onRouteChange(onRotaMudou);

  vincularToggleTema();

  const rota = getRotaAtual();
  const query = parseQueryParams(window.location.hash);
  await onRotaMudou(rota, query);

  if (rota === 'principal') {
    await processarCicloDadosEUI();
  }

  agendarProximaAtualizacao();
}

inicializarOrquestrador();

export {
  estadoApp,
  processarAgrupamentoETempo,
  sincronizarPontoSelecionado,
  renderizarTelaAtual,
  navegarPara,
};
