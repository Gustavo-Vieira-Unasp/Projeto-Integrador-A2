import {
  gerarRequestId,
  logInfo,
  logError,
  logLeituraRejeitada,
  recordScreenRender,
  getMetrics,
  exporMetricsGlobais,
} from '../services/observabilityService.js';

describe('observabilityService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('gerarRequestId retorna id único', () => {
    const a = gerarRequestId();
    const b = gerarRequestId();
    expect(a).toMatch(/^req_/);
    expect(a).not.toBe(b);
  });

  test('logInfo emite JSON estruturado', () => {
    logInfo('test_event', { screen: 'principal' });
    expect(console.log).toHaveBeenCalled();
    const payload = JSON.parse(console.log.mock.calls[0][0]);
    expect(payload.event).toBe('test_event');
    expect(payload.level).toBe('info');
  });

  test('logError incrementa fetch_error_total', () => {
    const before = getMetrics().fetch_error_total;
    logError('fetch_failed', { error: 'timeout' });
    expect(getMetrics().fetch_error_total).toBe(before + 1);
  });

  test('logLeituraRejeitada emite reading_rejected e incrementa counter', () => {
    const before = getMetrics().reading_rejected_total;
    logLeituraRejeitada({
      campo: 'temperatura',
      valorOriginal: 213,
      motivo: 'OUT_OF_RANGE_HIGH',
    });
    expect(getMetrics().reading_rejected_total).toBe(before + 1);
    expect(console.warn).toHaveBeenCalled();
    const payload = JSON.parse(console.warn.mock.calls[0][0]);
    expect(payload.event).toBe('reading_rejected');
    expect(payload.campo).toBe('temperatura');
    expect(payload.motivo).toBe('OUT_OF_RANGE_HIGH');
  });

  test('recordScreenRender armazena durationMs', () => {
    recordScreenRender('alertas', 12.5);
    expect(getMetrics().screen_render_ms.alertas).toBe(12.5);
  });

  test('exporMetricsGlobais define window hook', () => {
    exporMetricsGlobais();
    expect(typeof window.__PHORTA_METRICS__).toBe('function');
  });
});
