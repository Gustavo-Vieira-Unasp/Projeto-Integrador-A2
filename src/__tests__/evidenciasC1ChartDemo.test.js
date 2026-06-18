jest.mock('../services/observabilityService.js', () => ({
  logLeituraRejeitada: jest.fn(),
}));

import {
  montarSerieDemonstracao,
  construirPathTemperatura,
  renderGraficosDemonstracaoErros,
} from '../services/evidenciasC1ChartDemo.js';

describe('evidenciasC1ChartDemo', () => {
  test('montarSerieDemonstracao — 85 e 213 viram null (rejeitada)', () => {
    const serie = montarSerieDemonstracao([20, 85, 213, 20]);
    expect(serie[0].valor).toBe(20);
    expect(serie[0].cls).toBe('normal');
    expect(serie[1].valor).toBeNull();
    expect(serie[1].cls).toBe('rejeitada');
    expect(serie[2].valor).toBeNull();
    expect(serie[2].cls).toBe('rejeitada');
  });

  test('montarSerieDemonstracao — 50 °C é improvável mas numérico', () => {
    const serie = montarSerieDemonstracao([20, 50, 20]);
    expect(serie[1].valor).toBe(50);
    expect(serie[1].cls).toBe('improvavel');
  });

  test('construirPathTemperatura gera lacuna entre segmentos com null', () => {
    const pontos = [
      { valor: 20, cls: 'normal' },
      { valor: null, cls: 'rejeitada' },
      { valor: 22, cls: 'normal' },
    ];
    const paths = construirPathTemperatura(pontos, 40, 600, 16, 132);
    expect(paths.length).toBe(2);
    expect(paths[0]).toMatch(/^M /);
    expect(paths[1]).toMatch(/^M /);
  });

  test('renderGraficosDemonstracaoErros inclui os 3 painéis', () => {
    const html = renderGraficosDemonstracaoErros();
    expect(html).toContain('Normal — linha contínua no gráfico');
    expect(html).toContain('Improvável — picos aceitos (card amber)');
    expect(html).toContain('Rejeitado — lacuna (null) no gráfico');
    expect(html).toContain('null');
    expect(html).toContain('Entrada bruta → gráfico');
  });
});
