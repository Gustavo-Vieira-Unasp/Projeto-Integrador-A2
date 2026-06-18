import {
  carregarCacheSnapshot,
  salvarCacheSnapshot,
  toCachedResponse,
} from './cacheService.js';
import { logLeituraRejeitada } from './observabilityService.js';

const PRIMARY_API = 'https://horta-api-htggarb3eagagpgm.brazilsouth-01.azurewebsites.net';
const FALLBACK_API = 'https://server-horta.onrender.com';

export const JANELA_HISTORICO_MINUTOS = 10080;

/**
 * Faixas físicas UC-01 Passo 4 — docs/requirements/casos_de_uso.md
 */
export const FAIXAS_UC01 = {
  temperatura: { min: -10, max: 80 },
  umidadeAr: { min: 0, max: 100 },
  umidadeSoloPorcentagem: { min: 0, max: 100 },
};

/** Sentinel de curto do DHT22 — UC-01 FE-01-A */
export const TEMP_SENTINEL_DHT22 = 85;

/**
 * Limiar de plausibilidade para horta (clima BR ~44,8 °C recorde).
 * Não altera FAIXAS_UC01 — leituras >50 °C permanecem aceitas na ingestão.
 */
export const TEMP_PLAUSIVEL_HORTA_MAX = 50;

export const MOTIVOS_REJEICAO = {
  MISSING: 'MISSING',
  NOT_A_NUMBER: 'NOT_A_NUMBER',
  DHT22_SENTINEL: 'DHT22_SENTINEL',
  OUT_OF_RANGE_LOW: 'OUT_OF_RANGE_LOW',
  OUT_OF_RANGE_HIGH: 'OUT_OF_RANGE_HIGH',
};


async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function extrairValorBruto(valorNested, valorFlat) {
  if (valorNested !== undefined && valorNested !== null) return valorNested;
  if (valorFlat !== undefined && valorFlat !== null) return valorFlat;
  return undefined;
}

/**
 * Valida um campo de sensor contra FAIXAS_UC01.
 * @returns {{ valor: number|null, motivo: string|null }}
 */
export function validarCampoSensor(valorBruto, campo) {
  if (valorBruto === undefined || valorBruto === null) {
    return { valor: null, motivo: MOTIVOS_REJEICAO.MISSING };
  }

  if (typeof valorBruto !== 'number' || !Number.isFinite(valorBruto)) {
    return { valor: null, motivo: MOTIVOS_REJEICAO.NOT_A_NUMBER };
  }

  if (campo === 'temperatura' && valorBruto === TEMP_SENTINEL_DHT22) {
    return { valor: null, motivo: MOTIVOS_REJEICAO.DHT22_SENTINEL };
  }

  const faixa = FAIXAS_UC01[campo];
  if (!faixa) {
    return { valor: valorBruto, motivo: null };
  }

  if (valorBruto < faixa.min) {
    return { valor: null, motivo: MOTIVOS_REJEICAO.OUT_OF_RANGE_LOW };
  }
  if (valorBruto > faixa.max) {
    return { valor: null, motivo: MOTIVOS_REJEICAO.OUT_OF_RANGE_HIGH };
  }

  return { valor: valorBruto, motivo: null };
}

/**
 * Classifica temperatura já normalizada para UI/gráficos.
 * @returns {'rejeitada'|'improvavel'|'normal'}
 */
export function classificarTemperaturaIntegridade(temperatura, errosLeitura = {}) {
  if (temperatura === null || temperatura === undefined || errosLeitura?.temperatura) {
    return 'rejeitada';
  }
  if (typeof temperatura === 'number' && temperatura >= TEMP_PLAUSIVEL_HORTA_MAX) {
    return 'improvavel';
  }
  return 'normal';
}

function mediaCampoNumerico(lista, campo, casas = 1) {
  const validos = lista
    .map((r) => r[campo])
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!validos.length) return null;
  const media = validos.reduce((a, b) => a + b, 0) / validos.length;
  return parseFloat(media.toFixed(casas));
}

/**
 * Agrega leituras de um bucket temporal ignorando null/inválidos nos campos UC-01.
 */
export function agregarBucketLeituras(lista) {
  if (!lista?.length) {
    return {
      umidadeSoloPorcentagem: null,
      umidadeAr: null,
      temperatura: null,
      luzSolar: null,
      pHSolo: null,
    };
  }

  const luzValidos = lista
    .map((r) => r.luzSolar)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  const phValidos = lista
    .map((r) => r.pHSolo)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));

  return {
    umidadeSoloPorcentagem: mediaCampoNumerico(lista, 'umidadeSoloPorcentagem'),
    umidadeAr: mediaCampoNumerico(lista, 'umidadeAr'),
    temperatura: mediaCampoNumerico(lista, 'temperatura'),
    luzSolar: luzValidos.length
      ? parseFloat((luzValidos.reduce((a, b) => a + b, 0) / luzValidos.length).toFixed(1))
      : null,
    pHSolo: phValidos.length
      ? parseFloat((phValidos.reduce((a, b) => a + b, 0) / phValidos.length).toFixed(2))
      : null,
  };
}

function aplicarValidacaoCampo(valorBruto, campo, meta) {
  const { valor, motivo } = validarCampoSensor(valorBruto, campo);
  if (motivo && motivo !== MOTIVOS_REJEICAO.MISSING) {
    meta.errosLeitura[campo] = motivo;
    meta.leituraSuspeita = true;
    logLeituraRejeitada({
      campo,
      valorOriginal: valorBruto,
      motivo,
      registroId: meta.id,
      dataHora: meta.dataHora,
    });
  } else if (motivo === MOTIVOS_REJEICAO.MISSING) {
    meta.errosLeitura[campo] = motivo;
  }
  return valor;
}

export function normalizarRegistro(log) {
  const ca = log.condicoes_ambientais || {};
  const ss = log.sensores_solo || {};
  const at = log.atuadores || {};

  const meta = {
    id: log.id,
    dataHora: log.dataHora,
    errosLeitura: {},
    leituraSuspeita: false,
  };

  const tempBruta = extrairValorBruto(ca.temperaturaCelsius, log.temperatura);
  const umidArBruta = extrairValorBruto(ca.umidadeArPorcentagem, log.umidadeAr);
  const umidSoloBruta = extrairValorBruto(ss.umidadeSoloPorcentagem, log.umidadeSoloPorcentagem);

  const temperatura = aplicarValidacaoCampo(tempBruta, 'temperatura', meta);
  const umidadeAr = aplicarValidacaoCampo(umidArBruta, 'umidadeAr', meta);
  const umidadeSoloPorcentagem = aplicarValidacaoCampo(umidSoloBruta, 'umidadeSoloPorcentagem', meta);

  const registro = {
    id: meta.id,
    dataHora: meta.dataHora,
    umidadeSoloPorcentagem,
    temperatura,
    umidadeAr,
    pHSolo: ss.pHSolo ?? log.pHSolo ?? 7.0,
    luzSolar: ca.luminosidadeSolarPorcentagem ?? log.luzSolar ?? 0,
    statusIrrigacao: at.statusIrrigacao ?? (
      log.statusIrrigacao === 1 || log.statusIrrigacao === 'LIGADO' ? 'LIGADO' : 'DESLIGADO'
    ),
    estaChovendo: ca.estaChovendo ?? (log.estaChovendo === 1 || log.estaChovendo === true),
    vazaoGotejamentoLh: at.vazaoGotejamentoLh ?? (log.statusIrrigacao === 1 ? 2.0 : 0),
    controleManualAtivo: at.controleManualAtivo ?? false,
    estacao: ca.estacao ?? log.estacao ?? '---',
    condicaoCeu: ca.condicaoCeu ?? log.condicaoCeu ?? '---',
    leituraSuspeita: meta.leituraSuspeita,
  };

  if (Object.keys(meta.errosLeitura).length > 0) {
    registro.errosLeitura = meta.errosLeitura;
  }

  if (typeof temperatura === 'number' && temperatura >= TEMP_PLAUSIVEL_HORTA_MAX) {
    registro.temperaturaImprovavel = true;
  }

  return registro;
}

async function obterHistoricoCompleto(baseUrl) {
  const url = `${baseUrl}/api/historico/completo?minutosAtras=${JANELA_HISTORICO_MINUTOS}`;
  console.log(`📡 Buscando histórico completo: ${url}`);

  const resposta = await fetchWithTimeout(url);

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status} em ${baseUrl}`);
  }

  const dados = await resposta.json();

  let lista = [];
  if (Array.isArray(dados)) {
    lista = dados;
  } else if (Array.isArray(dados.dashboardData)) {
    lista = dados.dashboardData;
  }

  if (lista.length === 0) {
    throw new Error(`Histórico vazio em ${baseUrl}`);
  }

  console.log(`✅ ${lista.length} registros recebidos de ${baseUrl}`);
  return lista.map(normalizarRegistro);
}

async function tentarBuscarApis() {
  try {
    const historico = await obterHistoricoCompleto(PRIMARY_API);
    const ultimaLeitura = historico[historico.length - 1];
    return {
      telemetria: ultimaLeitura,
      historico,
      cenario: 'normal',
    };
  } catch (err) {
    console.warn(`⚠️ Azure falhou: ${err.message}. Tentando Render...`);
  }

  try {
    const historico = await obterHistoricoCompleto(FALLBACK_API);
    const ultimaLeitura = historico[historico.length - 1];
    return {
      telemetria: ultimaLeitura,
      historico,
      cenario: 'render-live',
    };
  } catch (err) {
    console.error(`💥 Render também falhou: ${err.message}.`);
  }

  return null;
}

export async function buscarDadosDispositivo(options = {}) {
  const { preferCache = false } = options;
  const cached = await carregarCacheSnapshot();

  if (preferCache && cached) {
    return toCachedResponse(cached);
  }

  const fresh = await tentarBuscarApis();
  if (fresh) {
    const fetchedAt = Date.now();
    await salvarCacheSnapshot({ ...fresh, fetchedAt });
    return { ...fresh, fetchedAt, fromCache: false };
  }

  if (cached) {
    console.warn('APIs indisponíveis — usando último snapshot em cache');
    return toCachedResponse(cached);
  }

  return {
    telemetria: null,
    historico: [],
    cenario: 'offline',
    fromCache: false,
  };
}

const API_BASES = [PRIMARY_API, FALLBACK_API];

async function postControleIrrigacao(baseUrl, body) {
  const resposta = await fetchWithTimeout(`${baseUrl}/api/controle/irrigacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status} em ${baseUrl}`);
  }

  return resposta.json();
}

/**
 * Envia comando de irrigação manual ao backend (UC-02).
 * Tenta Azure e, se falhar, Render — mesma ordem de buscarDadosDispositivo.
 *
 * @param {boolean} ligar - true para ligar a bomba; false para desligar.
 * @returns {Promise<{ ok: true, statusAtual: string, mensagem?: string, baseUrl: string } | { ok: false, erro: string }>}
 */
export async function enviarComandoIrrigacao(ligar) {
  if (typeof ligar !== 'boolean') {
    return { ok: false, erro: "Parâmetro 'ligar' inválido." };
  }

  const body = { ligar };
  const falhas = [];

  for (const baseUrl of API_BASES) {
    try {
      const dados = await postControleIrrigacao(baseUrl, body);
      return {
        ok: true,
        statusAtual: dados.statusAtual ?? (ligar ? 'LIGADO' : 'DESLIGADO'),
        mensagem: dados.mensagem,
        baseUrl,
      };
    } catch (err) {
      falhas.push(`${baseUrl}: ${err.message}`);
    }
  }

  return { ok: false, erro: falhas.join(' | ') };
}
