import { formatarUptime, formatarDuracaoIrrigacao } from './cardHelpers.js';

/**
 * appRenderService.js
 * Funções de renderização HTML para navbar, sensor cards e painéis laterais.
 *
 * Melhorias implementadas (passos 1–9 do plano):
 *  Passo 1 — Barra de progresso visual nos sensor cards.
 *  Passo 3 — Timestamp de última atualização nos cards.
 *  Passo 4 — Indicador de tendência (delta ▲▼) nos cards.
 *  Passo 5 — Badge de chuva / irrigação no card de Umidade Solo.
 *  Passo 6 — Alertas corrigidos (sem "Reservatório" hardcoded).
 *  Passo 7 — Uptime calculado e último comando real.
 *  Passo 8 — Duração de irrigação configurável.
 *  Passo 9 — Tabela de erros acumulada.
 */

export function renderNavbar(cenarioAtual, rotaAtiva = 'principal') {
  const isOffline = cenarioAtual === 'offline';
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const links = [
    { id: 'principal', label: 'Principal', hash: '#/principal' },
    { id: 'alertas', label: 'Alertas', hash: '#/alertas' },
    { id: 'historico', label: 'Histórico', hash: '#/historico' },
    { id: 'canteiros', label: 'Canteiros', hash: '#/canteiros' },
    { id: 'evidencias-c1', label: 'C1', hash: '#/evidencias-c1' },
  ];

  const navLinks = links.map(l => {
    const ativo = rotaAtiva === l.id;
    const cls = ativo
      ? 'text-slate-900 dark:text-white border-b-2 border-blue-500 pb-1'
      : 'hover:text-slate-700 dark:hover:text-slate-200 transition-colors';
    return `<a href="${l.hash}" class="${cls}">${l.label}</a>`;
  }).join(`
          <span class="text-slate-300 dark:text-slate-700">•</span>
          `);

  return `
    <nav class="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-center justify-between shadow-lg">
      <div class="flex items-center gap-4 sm:gap-8">
        <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black tracking-tight text-lg select-none">
          <span>🌱</span> <span class="hidden sm:inline">PHorta</span>
        </div>
        <div class="flex items-center gap-3 sm:gap-6 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 overflow-x-auto">
          ${navLinks}
        </div>
      </div>
      <div class="flex items-center gap-4">
        <button id="btn-toggle-tema" title="Alternar tema claro/escuro"
          class="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 text-lg leading-none transition-colors cursor-pointer">
          ${isDark ? '☀️' : '🌙'}
        </button>
        <div class="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-sm">🔔</div>
        <div class="flex items-center gap-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-1 rounded-md">
          <span class="h-2 w-2 rounded-full ${isOffline ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}"></span>
          <span class="text-[10px] font-mono font-bold tracking-widest ${isOffline ? 'text-red-400' : 'text-emerald-400'} uppercase">
            [ ${isOffline ? 'Offline' : 'Online'} ]
          </span>
        </div>
      </div>
    </nav>
  `;
}

export const MOTIVO_REJEICAO_LABEL = {
  DHT22_SENTINEL: 'Sentinel DHT22 (85°C)',
  OUT_OF_RANGE_HIGH: 'Fora de faixa física',
  OUT_OF_RANGE_LOW: 'Fora de faixa física',
  NOT_A_NUMBER: 'Valor não numérico',
};

/**
 * Renderiza um card de sensor.
 *
 * @param {string} titulo          - Nome do sensor.
 * @param {number|null} valor      - Valor numérico lido.
 * @param {string} unidade         - Ex: '%', '°C'.
 * @param {string} estadoCard      - 'normal' | 'offline' | 'parcial' | 'pico' | 'render-live'.
 * @param {string} descricaoStatus - Texto de status dinâmico (calculado externamente).
 * @param {object} [accent={}]     - { icone, corValor, corBarra }.
 * @param {object} [opcoes={}]     - Opções das melhorias:
 *   - {string|null}  timestamp      - "HH:MM" da última leitura (Passo 3).
 *   - {number|null}  delta          - Variação desde leitura anterior (Passo 4).
 *   - {boolean}      showProgressBar- Exibir barra de progresso (Passo 1).
 *   - {number}       progressBarPct - % de preenchimento da barra (Passo 1).
 *   - {string|null}  badge          - Texto de badge contextual (Passo 5).
 *   - {string|null}  motivoRejeicao - Código de rejeição UC-01 (C1 integridade).
 *   - {boolean}      temperaturaImprovavel - Aceito UC-01, improvável p/ horta (>50 °C).
 */
export function renderCardSensor(titulo, valor, unidade, estadoCard, descricaoStatus, accent = {}, opcoes = {}) {
  const isOffline = estadoCard === 'offline';
  const isFalha = estadoCard === 'parcial' && (valor === null || valor === undefined);
  const motivoRejeicao = opcoes.motivoRejeicao || null;
  const isRejeitada = !isOffline && !isFalha
    && (valor === null || valor === undefined)
    && motivoRejeicao
    && motivoRejeicao !== 'MISSING';
  const isImprovavel = !isOffline && !isFalha && !isRejeitada
    && opcoes.temperaturaImprovavel === true
    && valor !== null && valor !== undefined;
  const icone = accent.icone || '📊';
  const corValor = isImprovavel
    ? 'text-amber-600 dark:text-amber-400'
    : (accent.corValor || 'text-slate-900 dark:text-white');
  const corBarra = isRejeitada
    ? 'bg-red-500'
    : isImprovavel
      ? 'bg-amber-500'
      : (accent.corBarra || 'bg-slate-300 dark:bg-slate-700');

  // Passo 3 — Timestamp
  const timestamp = opcoes.timestamp || null;

  // Passo 4 — Delta / tendência
  const delta = (opcoes.delta !== null && opcoes.delta !== undefined) ? opcoes.delta : null;
  const deltaNaoNulo = delta !== null && !isOffline && !isFalha && !isRejeitada;
  const deltaHtml = deltaNaoNulo
    ? `<span class="text-[9px] font-mono ${delta >= 0 ? 'text-emerald-500' : 'text-red-400'} leading-none">
         ${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}
       </span>`
    : '';

  // Passo 1 — Barra de progresso
  const showProgressBar = opcoes.showProgressBar === true && !isOffline && !isFalha && !isRejeitada && valor !== null;
  const progressBarPct = Math.min(100, Math.max(0, opcoes.progressBarPct ?? 0));
  const progressBarHtml = showProgressBar
    ? `<div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mt-1.5">
         <div class="${corBarra} h-1 rounded-full transition-all duration-500" style="width: ${progressBarPct}%"></div>
       </div>`
    : '';

  // Passo 5 — Badge contextual (chuva / irrigação)
  const badge = (!isOffline && !isFalha && !isRejeitada && !isImprovavel && opcoes.badge) ? opcoes.badge : null;
  const subtituloRejeicao = isRejeitada
    ? (MOTIVO_REJEICAO_LABEL[motivoRejeicao] || 'Leitura inválida')
    : null;
  const statusTexto = isOffline
    ? 'Inacessivel'
    : isFalha
      ? 'Erro I2C'
      : isRejeitada
        ? subtituloRejeicao
        : isImprovavel
          ? 'Improvável p/ horta'
          : (badge || descricaoStatus);

  const borderClass = isRejeitada
    ? 'border-red-300 dark:border-red-900/60'
    : isImprovavel
      ? 'border-amber-300 dark:border-amber-800/60'
      : 'border-slate-200 dark:border-slate-800/80';

  return `
    <div class="bg-white dark:bg-[#0f172a] border ${borderClass} rounded-lg flex h-32 relative shadow-md overflow-hidden">
      <div class="w-1.5 shrink-0 ${corBarra}"></div>
      <div class="flex flex-col justify-between p-4 flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">${titulo}</span>
          <div class="flex items-center gap-1.5 shrink-0">
            ${deltaHtml}
            <span class="text-sm leading-none">${icone}</span>
          </div>
        </div>
        <div class="my-1">
          ${isOffline
            ? `<p class="text-xs text-slate-500 italic">Dispositivo Offline</p>`
            : isFalha
              ? `<p class="text-xs font-bold text-amber-500">Falha no Sensor</p>`
              : isRejeitada
                ? `<p class="text-xs font-bold text-red-500">Leitura inválida</p>`
                : `<p class="text-3xl font-black ${corValor} tracking-tight font-mono leading-none">${valor}<span class="text-xs font-normal text-slate-400 ml-0.5">${unidade}</span></p>`
          }
          ${progressBarHtml}
        </div>
        <div class="text-[10px] text-slate-500 font-medium flex items-center justify-between gap-1">
          <span class="truncate ${isRejeitada ? 'text-red-500 dark:text-red-400' : isImprovavel ? 'text-amber-600 dark:text-amber-400' : ''}">"${statusTexto}"</span>
          ${timestamp ? `<span class="text-[9px] font-mono text-slate-400 shrink-0">${timestamp}</span>` : ''}
        </div>
      </div>
    </div>`;
}

/**
 * Renderiza os 4 painéis laterais do dashboard.
 *
 * @param {object} dados            - Objeto com leituras do sensor atual.
 * @param {string} cenarioAtual     - 'normal' | 'offline' | 'parcial' | 'render-live'.
 * @param {boolean} bombaManualAtiva
 * @param {object} [contexto={}]    - Dados de estado adicionais:
 *   - {number}   timestampInicio    - ms desde epoch (Passo 7).
 *   - {string|null} ultimoComando   - Último comando enviado (Passo 7).
 *   - {Array}    logErros           - Log acumulado de eventos (Passo 9).
 *   - {number}   duracaoIrrigacaoSeg- Duração configurável (Passo 8).
 *   - {number[]} opcoesDuracao      - Opções disponíveis (Passo 8).
 */
export function renderSidePanels(dados, cenarioAtual, bombaManualAtiva, contexto = {}) {
  const isOffline = cenarioAtual === 'offline';
  const isReadOnly = cenarioAtual.endsWith('-cached');
  const controlesDesabilitados = isOffline || isReadOnly;
  const modoBombaAtivo = controlesDesabilitados ? false : (dados.irrigacao_ativa || bombaManualAtiva);

  // Passo 7 — Uptime calculado
  const uptimeTexto = isOffline ? '0d 0h' : formatarUptime(contexto.timestampInicio ?? 0);
  const ultimoComando = contexto.ultimoComando || 'Nenhum';

  // Passo 8 — Duração de irrigação configurável
  const duracaoAtual = contexto.duracaoIrrigacaoSeg ?? 60;
  const opcoesDuracao = contexto.opcoesDuracao ?? [30, 60, 120, 300];
  const opcoesHtml = opcoesDuracao.map(s =>
    `<option value="${s}" ${s === duracaoAtual ? 'selected' : ''}>${formatarDuracaoIrrigacao(s)}</option>`
  ).join('');

  // Passo 9 — Log de erros acumulado
  const logErros = Array.isArray(contexto.logErros) ? contexto.logErros : [];
  const logHtml = logErros.length > 0
    ? logErros.slice(0, 8).map(e => {
        const cor = e.nivel === 'ERR' ? 'text-red-500' : e.nivel === 'WARN' ? 'text-yellow-500' : e.nivel === 'CMD' ? 'text-blue-400' : 'text-slate-500 dark:text-slate-600';
        return `<p class="${cor}">[${e.nivel}] ${e.timestamp} ${e.mensagem}</p>`;
      }).join('')
    : isOffline
      ? `<p class="text-red-500">[ERR] esp32 timeout disconnect</p>`
      : cenarioAtual === 'parcial'
        ? `<p class="text-yellow-500">[WARN] ldr barramento fallow</p>`
        : `<p class="text-slate-500 dark:text-slate-600">[OK] mqtt broker connected</p>
           <p class="text-slate-500 dark:text-slate-600">[OK] wifi RSSI -45dBm</p>`;

  // Alertas — umidade < 30% (assignment A1.8)
  const alertaUmidSoloBaixo = !isOffline && dados.umidade_solo_pct <= 30;
  const alertaTemperaturaAlta = !isOffline && dados.temperatura_c > 35;

  return `
    <!-- Passo 6 — Alertas -->
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/80 p-4 rounded-lg shadow-md space-y-3">
      <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">⚠️ Alertas</div>
      <div class="space-y-2 text-[11px] font-mono">
        <div class="flex items-center gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-900">
          <span class="h-2 w-2 rounded-full ${alertaUmidSoloBaixo ? 'bg-yellow-500' : 'bg-slate-300 dark:bg-slate-800'}"></span>
          <span class="${alertaUmidSoloBaixo ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'}">Umid. solo baixa</span>
        </div>
        <div class="flex items-center gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-900">
          <span class="h-2 w-2 rounded-full ${alertaTemperaturaAlta ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-800'}"></span>
          <span class="${alertaTemperaturaAlta ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-400 dark:text-slate-600'}">Temperatura elevada</span>
        </div>
        <div class="flex items-center gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-900 ${isOffline ? 'text-slate-400 dark:text-slate-600' : 'text-emerald-600 dark:text-emerald-500 font-bold'}">
          <span class="h-2 w-2 rounded-full ${isOffline ? 'bg-slate-300 dark:bg-slate-800' : 'bg-emerald-500'}"></span>
          <span>Sistema normal</span>
        </div>
        <a href="#/alertas" class="text-[9px] text-blue-500 dark:text-blue-400 hover:underline cursor-pointer pt-1 block">Ver todos os alertas →</a>
      </div>
    </div>

    <!-- Passo 9 — Tabela de erros acumulada -->
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/80 p-4 rounded-lg shadow-md flex flex-col justify-between h-36">
      <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tabela de Erros (sistema)</div>
      <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded p-2 h-20 overflow-y-auto font-mono text-[9px] text-slate-500 space-y-1">
        ${logHtml}
      </div>
    </div>

    <!-- Passo 7 — Status dispositivo com uptime calculado e último comando -->
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/80 p-4 rounded-lg shadow-md text-[11px] font-mono space-y-1 text-slate-500 dark:text-slate-400">
      <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-sans mb-1">⚙️ Status Dispositivo</div>
      <div class="flex justify-between border-b border-slate-200 dark:border-slate-900 pb-0.5">
        <span>Estado:</span>
        <span class="text-slate-900 dark:text-white font-bold">${isOffline ? 'OFFLINE' : modoBombaAtivo ? 'IRRIGANDO' : 'IDLE'}</span>
      </div>
      <div class="flex justify-between border-b border-slate-200 dark:border-slate-900 pb-0.5">
        <span>Conexão:</span>
        <span class="text-slate-700 dark:text-slate-300">${isOffline ? 'Offline' : 'Online'}</span>
      </div>
      <div class="flex justify-between border-b border-slate-200 dark:border-slate-900 pb-0.5">
        <span>MQTT:</span>
        <span class="text-slate-700 dark:text-slate-300">${isOffline ? 'Desconectado' : 'Conectado'}</span>
      </div>
      <div class="flex justify-between border-b border-slate-200 dark:border-slate-900 pb-0.5">
        <span>Últ. cmd:</span>
        <span class="text-slate-500 truncate max-w-[70%]" title="${ultimoComando}">${ultimoComando}</span>
      </div>
      <div class="flex justify-between">
        <span>Ligado há:</span>
        <span class="text-slate-500">${uptimeTexto}</span>
      </div>
    </div>

    <!-- Passo 8 — Ação rápida com duração configurável -->
    <div class="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/80 p-4 rounded-lg shadow-md flex flex-col justify-between h-36">
      <div>
        <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">💧 Ação Rápida</div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-[10px] text-slate-500">Duração:</span>
          <select id="select-duracao-irrigacao" ${controlesDesabilitados ? 'disabled' : ''}
            class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded px-1 py-0.5 text-[10px] font-mono focus:outline-none disabled:opacity-30">
            ${opcoesHtml}
          </select>
        </div>
      </div>
      <button id="btn-toggle-bomba" ${controlesDesabilitados ? 'disabled' : ''} class="w-full py-1.5 rounded font-mono text-[11px] font-bold uppercase tracking-wider transition-all border ${
        modoBombaAtivo
          ? 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-20'
      }">
        [ ${modoBombaAtivo ? '■ Parar' : '► Iniciar'} ]
      </button>
      <div class="border-t border-slate-200 dark:border-slate-900 pt-1.5 flex justify-between items-center text-[10px]">
        <span class="text-slate-500 font-mono">Status Válvula:</span>
        <span class="font-bold uppercase tracking-tight ${modoBombaAtivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}">
          ${modoBombaAtivo ? 'Bomba ligada' : 'Bomba deslig.'}
        </span>
      </div>
    </div>
  `;
}

export function renderControlesTeste(cenarioAtual, simularErroConexao) {
  return `
    <div class="bg-slate-950 border border-slate-900 p-4 rounded-lg space-y-2">
      <div class="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">Mecanismo de Homologação (Simular Estados do Dispositivo)</div>
      <div class="flex flex-wrap gap-2">
        ${['normal', 'pico', 'offline', 'parcial'].map(c => `
          <button data-cenario="${c}" class="btn-cenario px-2.5 py-1 text-[10px] font-mono rounded border ${cenarioAtual === c && !simularErroConexao ? 'bg-blue-950 text-blue-400 border-blue-800' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}">${c.toUpperCase()}</button>
        `).join('')}
        <button id="btn-toggle-error" class="px-2.5 py-1 text-[10px] font-mono rounded border ${simularErroConexao ? 'bg-red-950 text-red-400 border-red-800' : 'bg-slate-900/40 text-red-900/60 border-red-950 hover:bg-red-950/20'}">SIMULAR ERRO HTTP API</button>
      </div>
    </div>`;
}

