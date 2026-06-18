/**
 * Testes unitários para apiService.js.
 * Cobre: normalizarRegistro (puro) e buscarDadosDispositivo (com mock de fetch).
 */
import {
  normalizarRegistro,
  buscarDadosDispositivo,
  agregarBucketLeituras,
  classificarTemperaturaIntegridade,
  MOTIVOS_REJEICAO,
  enviarComandoIrrigacao,
} from '../services/apiService.js';

jest.mock('../services/observabilityService.js', () => ({
  logLeituraRejeitada: jest.fn(),
}));

jest.mock('../services/cacheService.js', () => ({
  carregarCacheSnapshot: jest.fn(),
  salvarCacheSnapshot: jest.fn().mockResolvedValue(undefined),
  toCachedResponse: jest.fn((snapshot) => ({
    telemetria: snapshot.telemetria,
    historico: snapshot.historico,
    cenario: `${(snapshot.cenario || 'normal').replace(/-cached$/, '')}-cached`,
    fetchedAt: snapshot.fetchedAt,
    fromCache: true,
  })),
}));

import {
  carregarCacheSnapshot,
  salvarCacheSnapshot,
} from '../services/cacheService.js';
import { logLeituraRejeitada } from '../services/observabilityService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de mock
// ─────────────────────────────────────────────────────────────────────────────

const mockRegistro = {
  id: 1,
  dataHora: '2026-06-13T14:00:00.000Z',
  umidadeSoloPorcentagem: 63.5,
  temperatura: 19.5,
  umidadeAr: 61.2,
  pHSolo: 6.2,
  luzSolar: 72,
  statusIrrigacao: 'DESLIGADO',
  estaChovendo: false,
  vazaoGotejamentoLh: 0,
  controleManualAtivo: false,
  estacao: 'INVERNO',
  condicaoCeu: 'ENSOLARADO',
};

function criarFetchMock(dados, ok = true, status = 200) {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => dados,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// buscarDadosDispositivo — testes com mock de fetch
// ─────────────────────────────────────────────────────────────────────────────
describe('buscarDadosDispositivo', () => {
  beforeEach(() => {
    carregarCacheSnapshot.mockResolvedValue(null);
    salvarCacheSnapshot.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retorna dados da API principal (Azure) quando disponível', async () => {
    global.fetch = criarFetchMock([mockRegistro]);

    const resultado = await buscarDadosDispositivo();

    expect(resultado.cenario).toBe('normal');
    expect(resultado.historico).toHaveLength(1);
    expect(resultado.telemetria.umidadeSoloPorcentagem).toBe(63.5);
  });

  test('retorna dados do fallback (Render) quando Azure falha', async () => {
    let chamadas = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      chamadas++;
      if (chamadas === 1) return Promise.reject(new Error('Azure timeout'));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [mockRegistro],
      });
    });

    const resultado = await buscarDadosDispositivo();

    expect(resultado.cenario).toBe('render-live');
    expect(resultado.historico).toHaveLength(1);
  });

  test('retorna cenário offline quando ambas as APIs falham', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Sem conexão'));

    const resultado = await buscarDadosDispositivo();

    expect(resultado.cenario).toBe('offline');
    expect(resultado.historico).toHaveLength(0);
    expect(resultado.telemetria).toBeNull();
  });

  test('retorna cache quando APIs falham mas snapshot existe', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Sem conexão'));
    carregarCacheSnapshot.mockResolvedValue({
      telemetria: mockRegistro,
      historico: [mockRegistro],
      cenario: 'normal',
      fetchedAt: Date.now(),
    });

    const resultado = await buscarDadosDispositivo();

    expect(resultado.cenario).toBe('normal-cached');
    expect(resultado.fromCache).toBe(true);
    expect(resultado.historico).toHaveLength(1);
  });

  test('salva snapshot após fetch bem-sucedido', async () => {
    global.fetch = criarFetchMock([mockRegistro]);

    await buscarDadosDispositivo();

    expect(salvarCacheSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        cenario: 'normal',
        historico: expect.any(Array),
      })
    );
  });

  test('retorna offline quando API retorna HTTP 500', async () => {
    global.fetch = criarFetchMock({}, false, 500);

    const resultado = await buscarDadosDispositivo();

    expect(resultado.cenario).toBe('offline');
  });

  test('retorna offline quando histórico está vazio em ambas as APIs', async () => {
    global.fetch = criarFetchMock([]);

    const resultado = await buscarDadosDispositivo();

    expect(resultado.cenario).toBe('offline');
  });

  test('aceita formato { dashboardData: [...] } da API', async () => {
    global.fetch = criarFetchMock({ dashboardData: [mockRegistro] });

    const resultado = await buscarDadosDispositivo();

    expect(resultado.cenario).toBe('normal');
    expect(resultado.historico).toHaveLength(1);
  });
});

describe('normalizarRegistro', () => {
  beforeEach(() => {
    logLeituraRejeitada.mockClear();
  });
  test('normaliza campos nested do formato avançado da API', () => {
    const log = {
      id: 10,
      dataHora: '2026-06-13T14:00:00.000Z',
      condicoes_ambientais: {
        temperaturaCelsius: 22.5,
        umidadeArPorcentagem: 65.0,
        luminosidadeSolarPorcentagem: 80,
        estaChovendo: false,
        estacao: 'INVERNO',
        condicaoCeu: 'ENSOLARADO',
      },
      sensores_solo: {
        umidadeSoloPorcentagem: 70.0,
        pHSolo: 6.3,
      },
      atuadores: {
        statusIrrigacao: 'DESLIGADO',
        vazaoGotejamentoLh: 0,
        controleManualAtivo: false,
      },
    };

    const result = normalizarRegistro(log);

    expect(result.id).toBe(10);
    expect(result.temperatura).toBe(22.5);
    expect(result.umidadeAr).toBe(65.0);
    expect(result.luzSolar).toBe(80);
    expect(result.umidadeSoloPorcentagem).toBe(70.0);
    expect(result.pHSolo).toBe(6.3);
    expect(result.statusIrrigacao).toBe('DESLIGADO');
    expect(result.vazaoGotejamentoLh).toBe(0);
    expect(result.estaChovendo).toBe(false);
    expect(result.estacao).toBe('INVERNO');
    expect(result.condicaoCeu).toBe('ENSOLARADO');
    expect(result.controleManualAtivo).toBe(false);
  });

  test('normaliza campos flat (formato legado)', () => {
    const log = {
      id: 5,
      dataHora: '2026-06-13T10:00:00.000Z',
      umidadeSoloPorcentagem: 55.0,
      temperatura: 19.5,
      umidadeAr: 60.0,
      pHSolo: 6.1,
      luzSolar: 72,
      statusIrrigacao: 'LIGADO',
      estaChovendo: false,
      vazaoGotejamentoLh: 2.5,
      controleManualAtivo: true,
      estacao: 'INVERNO',
      condicaoCeu: 'NUBLADO',
    };

    const result = normalizarRegistro(log);

    expect(result.umidadeSoloPorcentagem).toBe(55.0);
    expect(result.temperatura).toBe(19.5);
    expect(result.umidadeAr).toBe(60.0);
    expect(result.pHSolo).toBe(6.1);
    expect(result.luzSolar).toBe(72);
    expect(result.statusIrrigacao).toBe('LIGADO');
  });

  test('aplica null quando campos UC-01 estão ausentes', () => {
    const result = normalizarRegistro({ id: 1, dataHora: '2026-01-01T00:00:00Z' });

    expect(result.umidadeSoloPorcentagem).toBeNull();
    expect(result.temperatura).toBeNull();
    expect(result.umidadeAr).toBeNull();
    expect(result.errosLeitura).toEqual({
      temperatura: MOTIVOS_REJEICAO.MISSING,
      umidadeAr: MOTIVOS_REJEICAO.MISSING,
      umidadeSoloPorcentagem: MOTIVOS_REJEICAO.MISSING,
    });
    expect(result.leituraSuspeita).toBe(false);
    expect(result.pHSolo).toBe(7.0);
    expect(result.luzSolar).toBe(0);
    expect(result.statusIrrigacao).toBe('DESLIGADO');
    expect(result.estaChovendo).toBe(false);
    expect(result.controleManualAtivo).toBe(false);
    expect(result.estacao).toBe('---');
    expect(result.condicaoCeu).toBe('---');
  });

  test('statusIrrigacao: converte inteiro 1 para "LIGADO"', () => {
    const result = normalizarRegistro({ id: 1, dataHora: '2026-01-01T00:00:00Z', statusIrrigacao: 1 });
    expect(result.statusIrrigacao).toBe('LIGADO');
  });

  test('statusIrrigacao: converte inteiro 0 para "DESLIGADO"', () => {
    const result = normalizarRegistro({ id: 1, dataHora: '2026-01-01T00:00:00Z', statusIrrigacao: 0 });
    expect(result.statusIrrigacao).toBe('DESLIGADO');
  });

  test('estaChovendo: converte inteiro 1 para true', () => {
    const result = normalizarRegistro({ id: 1, dataHora: '2026-01-01T00:00:00Z', estaChovendo: 1 });
    expect(result.estaChovendo).toBe(true);
  });

  test('preserva dataHora original', () => {
    const data = '2026-06-13T14:30:00.000Z';
    const result = normalizarRegistro({ id: 1, dataHora: data });
    expect(result.dataHora).toBe(data);
  });

  test('campos nested têm prioridade sobre campos flat', () => {
    const log = {
      id: 1,
      dataHora: '2026-01-01T00:00:00Z',
      temperatura: 10,
      condicoes_ambientais: { temperaturaCelsius: 25 },
    };
    const result = normalizarRegistro(log);
    expect(result.temperatura).toBe(25);
  });

  describe('unit.api.reading-boundary — UC-01 Passo 4', () => {
    test.each([
      [213, null, true, MOTIVOS_REJEICAO.OUT_OF_RANGE_HIGH],
      [80, 80, false, undefined],
      [-10, -10, false, undefined],
      [85, null, true, MOTIVOS_REJEICAO.DHT22_SENTINEL],
    ])('temperatura %p → valor %p, suspeita=%p', (input, esperado, suspeita, motivo) => {
      const result = normalizarRegistro({
        id: 1,
        dataHora: '2026-01-01T00:00:00Z',
        temperatura: input,
        umidadeAr: 50,
        umidadeSoloPorcentagem: 50,
      });

      expect(result.temperatura).toBe(esperado);
      expect(result.leituraSuspeita).toBe(suspeita);
      if (motivo) {
        expect(result.errosLeitura.temperatura).toBe(motivo);
        expect(logLeituraRejeitada).toHaveBeenCalledWith(
          expect.objectContaining({ campo: 'temperatura', motivo, valorOriginal: input })
        );
      }
    });

    test('umidade solo 0 % é aceita na borda inferior', () => {
      const result = normalizarRegistro({
        id: 1,
        dataHora: '2026-01-01T00:00:00Z',
        temperatura: 20,
        umidadeAr: 50,
        umidadeSoloPorcentagem: 0,
      });

      expect(result.umidadeSoloPorcentagem).toBe(0);
      expect(result.leituraSuspeita).toBe(false);
    });

    test.each([
      [NaN, MOTIVOS_REJEICAO.NOT_A_NUMBER],
      [81, MOTIVOS_REJEICAO.OUT_OF_RANGE_HIGH],
      [-10.1, MOTIVOS_REJEICAO.OUT_OF_RANGE_LOW],
    ])('rejeita temperatura inválida %p', (input, motivo) => {
      const result = normalizarRegistro({
        id: 1,
        dataHora: '2026-01-01T00:00:00Z',
        temperatura: input,
      });
      expect(result.temperatura).toBeNull();
      expect(result.errosLeitura.temperatura).toBe(motivo);
    });

    test.each([
      [50, true],
      [80, true],
      [22, false],
    ])('temperatura %p °C → temperaturaImprovavel=%p (plausibilidade horta)', (input, improvavel) => {
      const result = normalizarRegistro({
        id: 1,
        dataHora: '2026-01-01T00:00:00Z',
        temperatura: input,
        umidadeAr: 50,
        umidadeSoloPorcentagem: 50,
      });

      expect(result.leituraSuspeita).toBe(false);
      expect(result.temperatura).toBe(input);
      expect(result.temperaturaImprovavel === true).toBe(improvavel);
    });

    test.each([
      [22, 'normal'],
      [50, 'improvavel'],
      [80, 'improvavel'],
      [null, 'rejeitada'],
    ])('classificarTemperaturaIntegridade(%p) → %p', (temp, esperado) => {
      expect(classificarTemperaturaIntegridade(temp, temp === null ? { temperatura: 'OUT_OF_RANGE_HIGH' } : {})).toBe(esperado);
    });

    test.each([
      [101, 'umidadeAr'],
      [-1, 'umidadeSoloPorcentagem'],
    ])('rejeita umidade fora de faixa %p em %s', (valor, campo) => {
      const log = {
        id: 1,
        dataHora: '2026-01-01T00:00:00Z',
        temperatura: 20,
        umidadeAr: 50,
        umidadeSoloPorcentagem: 50,
      };
      log[campo] = valor;
      const result = normalizarRegistro(log);
      expect(result[campo]).toBeNull();
      expect(result.errosLeitura[campo]).toBe(
        valor > 100 ? MOTIVOS_REJEICAO.OUT_OF_RANGE_HIGH : MOTIVOS_REJEICAO.OUT_OF_RANGE_LOW
      );
    });
  });
});

describe('agregarBucketLeituras', () => {
  test('unit.api.reading-boundary — média ignora leituras rejeitadas (null)', () => {
    const bucket = [
      { temperatura: 20, umidadeAr: 60, umidadeSoloPorcentagem: 50 },
      { temperatura: null, umidadeAr: 60, umidadeSoloPorcentagem: 50 },
      { temperatura: 22, umidadeAr: 60, umidadeSoloPorcentagem: 50 },
    ];

    const medias = agregarBucketLeituras(bucket);

    expect(medias.temperatura).toBe(21);
    expect(medias.umidadeAr).toBe(60);
  });
});

describe('buscarDadosDispositivo — histórico sanitizado', () => {
  beforeEach(() => {
    carregarCacheSnapshot.mockResolvedValue(null);
    logLeituraRejeitada.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('não propaga temperatura 213 °C após normalização', async () => {
    const registros = [
      { id: 1, dataHora: '2026-06-13T10:00:00.000Z', temperatura: 20, umidadeAr: 50, umidadeSoloPorcentagem: 50 },
      { id: 2, dataHora: '2026-06-13T11:00:00.000Z', temperatura: 213, umidadeAr: 50, umidadeSoloPorcentagem: 50 },
      { id: 3, dataHora: '2026-06-13T12:00:00.000Z', temperatura: 22, umidadeAr: 50, umidadeSoloPorcentagem: 50 },
    ];
    global.fetch = criarFetchMock(registros);

    const resultado = await buscarDadosDispositivo();

    expect(resultado.historico.every((r) => r.temperatura !== 213)).toBe(true);
    expect(resultado.historico[1].temperatura).toBeNull();
    expect(resultado.telemetria.temperatura).toBe(22);
  });
});

describe('enviarComandoIrrigacao', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('envia ligar:true na API principal quando disponível', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ statusAtual: 'LIGADO', mensagem: 'ok' }),
    });

    const resultado = await enviarComandoIrrigacao(true);

    expect(resultado.ok).toBe(true);
    expect(resultado.statusAtual).toBe('LIGADO');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/api/controle/irrigacao');
    expect(global.fetch.mock.calls[0][1].body).toBe(JSON.stringify({ ligar: true }));
  });

  test('envia ligar:false para desligar a bomba', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ statusAtual: 'DESLIGADO' }),
    });

    const resultado = await enviarComandoIrrigacao(false);

    expect(resultado.ok).toBe(true);
    expect(resultado.statusAtual).toBe('DESLIGADO');
    expect(global.fetch.mock.calls[0][1].body).toBe(JSON.stringify({ ligar: false }));
  });

  test('tenta fallback quando a API principal falha', async () => {
    let chamadas = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      chamadas += 1;
      if (chamadas === 1) return Promise.reject(new Error('Azure timeout'));
      return Promise.resolve({
        ok: true,
        json: async () => ({ statusAtual: 'DESLIGADO' }),
      });
    });

    const resultado = await enviarComandoIrrigacao(false);

    expect(resultado.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(resultado.baseUrl).toContain('onrender.com');
  });

  test('retorna erro quando ambas as APIs falham', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    const resultado = await enviarComandoIrrigacao(true);

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toContain('offline');
  });

  test('rejeita parâmetro ligar inválido', async () => {
    global.fetch = jest.fn();
    const resultado = await enviarComandoIrrigacao('sim');

    expect(resultado.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
