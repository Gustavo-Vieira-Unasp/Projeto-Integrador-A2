import {
  ZONAS_TEMP_GRAFICO,
  tempParaYPixel,
  TEMP_GRAFICO_MIN,
  TEMP_GRAFICO_MAX,
  TEMP_PLAUSIVEL_HORTA_MAX,
} from '../services/temperaturaZonasChart.js';

describe('temperaturaZonasChart', () => {
  const top = 20;
  const bottom = 220;

  test('ZONAS_TEMP_GRAFICO cobre −10…85 sem lacunas', () => {
    expect(ZONAS_TEMP_GRAFICO[0].de).toBe(-10);
    expect(ZONAS_TEMP_GRAFICO[ZONAS_TEMP_GRAFICO.length - 1].ate).toBe(85);
    for (let i = 0; i < ZONAS_TEMP_GRAFICO.length - 1; i += 1) {
      expect(ZONAS_TEMP_GRAFICO[i].ate).toBe(ZONAS_TEMP_GRAFICO[i + 1].de);
    }
  });

  test('tempParaYPixel mapeia extremos da escala C1', () => {
    expect(tempParaYPixel(TEMP_GRAFICO_MIN, top, bottom)).toBe(bottom);
    expect(tempParaYPixel(TEMP_GRAFICO_MAX, top, bottom)).toBe(top);
  });

  test('fronteira 50 °C cai na zona amber', () => {
    const zona50 = ZONAS_TEMP_GRAFICO.find(z => z.de === TEMP_PLAUSIVEL_HORTA_MAX);
    expect(zona50).toBeDefined();
    expect(zona50.cor).toContain('245,158,11');
    expect(TEMP_PLAUSIVEL_HORTA_MAX).toBe(50);
  });
});
