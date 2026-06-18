/**
 * Conteúdo estático da página de evidências C1 — Integridade de dados.
 */

export const METADADOS = {
  titulo: 'Evidências C1 — Integridade de dados',
  subtitulo: 'Rejeitar leitura impossível na normalização · UC-01 Passo 4',
  autor: 'Gustavo da Fonsêca Araujo Vieira · Grupo 1',
  data: '2026-06-16',
  docDecisoes: 'docs/decisions/c1-integridade-dados-decisoes.md',
  testStrategy: 'docs/test-strategy/test-strategy.md',
  riscoId: '#11',
  testId: 'unit.api.reading-boundary',
};

export const LOG_TESTES_URL = '/docs/dashboard/evidencias/test-unit-c1.log';

export const DECISOES_RESUMO = [
  {
    titulo: 'Semântica de rejeição',
    linhas: [
      { opcao: 'Manter número bruto + só flag', decisao: 'Rejeitada', motivo: 'Não impede poluição de gráficos/tabelas' },
      { opcao: 'Remover registro inteiro', decisao: 'Rejeitada', motivo: 'Perde timestamp e sensores válidos (FE-01-A parcial)' },
      { opcao: 'null + leituraSuspeita + errosLeitura', decisao: 'Adotada', motivo: 'Alinhada ao ESP32/FE-01-A e UI existente' },
    ],
  },
  {
    titulo: 'Campos e faixas (UC-01 Passo 4)',
    linhas: [
      { opcao: 'Só temperatura', decisao: 'Rejeitada', motivo: 'Enunciado cita temp + umidades' },
      { opcao: 'Todos os numéricos (pH, luz)', decisao: 'Rejeitada', motivo: 'Fora do contrato UC-01' },
      { opcao: 'Temp −10…80, umid. 0…100 + NaN + sentinel 85 °C', decisao: 'Adotada', motivo: 'Limite elétrico DHT22 — não clima BR' },
    ],
  },
  {
    titulo: 'Plausibilidade horta (>50 °C)',
    linhas: [
      { opcao: 'Rejeitar >50 °C na ingestão', decisao: 'Rejeitada', motivo: 'Quebraria borda UC-01 de 80 °C no enunciado' },
      { opcao: 'temperaturaImprovavel + card amber', decisao: 'Adotada', motivo: 'Aceito pelo sensor; absurdo p/ ar ambiente na horta' },
    ],
  },
  {
    titulo: 'Campos ausentes',
    linhas: [
      { opcao: 'Manter ?? 0', decisao: 'Rejeitada', motivo: 'Zero artificial distorce alertas e médias' },
      { opcao: '?? null nos 3 campos UC-01', decisao: 'Adotada', motivo: 'Consistente com ESP32 em falha de sensor' },
    ],
  },
  {
    titulo: 'Agregação para gráficos',
    linhas: [
      { opcao: 'Corrigir só normalizarRegistro', decisao: 'Rejeitada', motivo: 'null viraria 0 com temperatura || 0' },
      { opcao: 'agregarBucketLeituras() + appController', decisao: 'Adotada', motivo: 'Média só sobre valores finitos; testável em Jest' },
    ],
  },
  {
    titulo: 'Observabilidade',
    linhas: [
      { opcao: 'console.warn ad hoc', decisao: 'Rejeitada', motivo: 'Enunciado exige observabilityService' },
      { opcao: 'logLeituraRejeitada → reading_rejected', decisao: 'Adotada', motivo: 'JSON estruturado + reading_rejected_total' },
    ],
  },
  {
    titulo: 'Feedback visual (Principal)',
    linhas: [
      { opcao: 'Amber parcial mock', decisao: 'Rejeitada p/ UC-01', motivo: 'Reservado a cenário offline/parcial' },
      { opcao: 'Vermelho rejeição + amber improvável', decisao: 'Adotada', motivo: 'Duas camadas distintas na UI' },
    ],
  },
];

export const TABELA_BOUNDARY = [
  { campo: 'temperatura', input: '213 °C', esperado: 'null', suspeita: true, motivo: 'OUT_OF_RANGE_HIGH', naUi: 'rejeitado (vermelho)' },
  { campo: 'temperatura', input: '80 °C', esperado: '80', suspeita: false, motivo: '—', naUi: 'improvável (amber) — limite UC-01, não clima' },
  { campo: 'temperatura', input: '50 °C', esperado: '50', suspeita: false, motivo: '—', naUi: 'improvável (amber)' },
  { campo: 'temperatura', input: '−10 °C', esperado: '−10', suspeita: false, motivo: '—', naUi: 'normal' },
  { campo: 'temperatura', input: '85 °C (sentinel)', esperado: 'null', suspeita: true, motivo: 'DHT22_SENTINEL', naUi: 'rejeitado (vermelho)' },
  { campo: 'umidade solo', input: '0 %', esperado: '0', suspeita: false, motivo: '—', naUi: 'normal' },
];

export const CENARIOS_SIMULACAO = [
  {
    id: 'bug-213',
    titulo: 'Bug original — 213 °C',
    descricao: 'Leitura impossível da API; após normalizarRegistro() não entra no valor exibido.',
    payload: {
      id: 1,
      dataHora: '2026-06-13T14:00:00.000Z',
      temperatura: 213,
      umidadeAr: 61,
      umidadeSoloPorcentagem: 63,
    },
  },
  {
    id: 'sentinel-85',
    titulo: 'Sentinel DHT22 — 85 °C',
    descricao: 'Curto no pino DATA do DHT22; rejeitado como DHT22_SENTINEL.',
    payload: {
      id: 2,
      dataHora: '2026-06-13T14:15:00.000Z',
      temperatura: 85,
      umidadeAr: 60,
      umidadeSoloPorcentagem: 62,
    },
  },
  {
    id: 'improvavel-50',
    titulo: '50 °C — improvável p/ horta',
    descricao: 'Acima do recorde BR (~44,8 °C), mas aceito pelo contrato UC-01; card amber, entra no gráfico.',
    payload: {
      id: 3,
      dataHora: '2026-06-13T14:30:00.000Z',
      temperatura: 50,
      umidadeAr: 55,
      umidadeSoloPorcentagem: 58,
    },
  },
  {
    id: 'borda-m10',
    titulo: 'Borda válida — −10 °C',
    descricao: 'Limite inferior UC-01 inclusivo; leitura normal.',
    payload: {
      id: 4,
      dataHora: '2026-06-13T14:45:00.000Z',
      temperatura: -10,
      umidadeAr: 50,
      umidadeSoloPorcentagem: 55,
    },
  },
  {
    id: 'umid-zero',
    titulo: 'Umidade solo 0 %',
    descricao: 'Borda inferior de umidade; valor 0 é válido.',
    payload: {
      id: 5,
      dataHora: '2026-06-13T15:00:00.000Z',
      temperatura: 22,
      umidadeAr: 48,
      umidadeSoloPorcentagem: 0,
    },
  },
];

export const NOTA_BORDA_80 = '80 °C permanece aceito na ingestão (limite elétrico DHT22/UC-01), mas seria climaticamente absurdo — classificado como temperaturaImprovavel na UI, igual a 50 °C.';

/** Mini-gráficos estáticos seção D — estilo Centro Analítico. */
export const PAINELS_GRAFICO_DEMO = [
  {
    id: 'demo-normal',
    classe: 'normal',
    titulo: 'Normal — linha contínua no gráfico',
    descricao: 'Leituras plausíveis (~18–22 °C); após normalizarRegistro entram como pontos na série vermelha.',
    temperaturasBrutas: [18, 20, 22, 21, 19, 20, 22, 21],
    rotulos: ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  },
  {
    id: 'demo-improvavel',
    classe: 'improvavel',
    titulo: 'Improvável — picos aceitos (card amber)',
    descricao: '50 °C e 80 °C passam UC-01; entram no gráfico numérico, mas card amber na Principal.',
    temperaturasBrutas: [20, 20, 50, 20, 20, 80, 20, 20],
    rotulos: ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  },
  {
    id: 'demo-rejeitada',
    classe: 'rejeitada',
    titulo: 'Rejeitado — lacuna (null) no gráfico',
    descricao: '85 °C (sentinel) e 213 °C viram null; Chart.js não liga o segmento — lacuna visível.',
    temperaturasBrutas: [20, 20, 85, 20, 20, 213, 20, 20],
    rotulos: ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  },
];

export const FALLBACK_LOG = `Log de testes não encontrado.

Para gerar o arquivo de evidência, execute na raiz do projeto:

  npm run test:evidencia-c1

Depois recarregue esta página (#/evidencias-c1).
O arquivo será servido em: ${LOG_TESTES_URL}
`;

export async function carregarLogTestes() {
  try {
    const res = await fetch(LOG_TESTES_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const texto = await res.text();
    if (!texto.trim()) throw new Error('empty');
    return texto;
  } catch {
    return FALLBACK_LOG;
  }
}
