jest.mock('../services/observabilityService.js', () => ({
  logLeituraRejeitada: jest.fn(),
}));

import { renderEvidenciasC1View } from '../views/evidenciasC1View.js';

describe('evidenciasC1View', () => {
  test('renderiza seções de decisões, simulações, gráfico e testes C1', () => {
    const html = renderEvidenciasC1View({ logTestes: 'PASS unit.api.reading-boundary\n168 passed' });

    expect(html).toContain('Evidências C1');
    expect(html).toContain('Decisões de implementação');
    expect(html).toContain('Simulações do dashboard');
    expect(html).toContain('Faixas de temperatura e gráfico');
    expect(html).toContain('Como entra no gráfico da Principal — por tipo de erro');
    expect(html).toContain('Normal — linha contínua no gráfico');
    expect(html).toContain('Improvável — picos aceitos (card amber)');
    expect(html).toContain('Rejeitado — lacuna (null) no gráfico');
    expect(html).toContain('lacuna');
    expect(html).toContain('50 °C — improvável p/ horta');
    expect(html).toContain('Improvável p/ horta');
    expect(html).toContain('improvável');
    expect(html).toContain('aria-label="Faixas de temperatura UC-01 e plausibilidade horta"');
    expect(html).toContain('Na UI');
    expect(html).toContain('213');
    expect(html).toContain('unit.api.reading-boundary');
    expect(html).toContain('Leitura inválida');
    expect(html).toContain('agregarBucketLeituras');
    expect(html).toContain('normalizarRegistro');
  });
});
