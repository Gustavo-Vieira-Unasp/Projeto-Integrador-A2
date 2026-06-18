import {
  parseHash,
  parseQueryParams,
  getRotaConfig,
  ROTAS,
} from '../services/routerService.js';

describe('routerService', () => {
  test('parseHash mapeia rotas conhecidas', () => {
    expect(parseHash('#/alertas')).toBe('alertas');
    expect(parseHash('#/historico')).toBe('historico');
    expect(parseHash('#/canteiros')).toBe('canteiros');
    expect(parseHash('#/evidencias-c1')).toBe('evidencias-c1');
    expect(parseHash('#/')).toBe('principal');
    expect(parseHash('#/unknown')).toBe('principal');
  });

  test('parseQueryParams extrai query string', () => {
    expect(parseQueryParams('#/alertas?canteiro=A&tipo=umidade')).toEqual({
      canteiro: 'A',
      tipo: 'umidade',
    });
  });

  test('getRotaConfig retorna config da rota', () => {
    expect(getRotaConfig('alertas').hash).toBe('#/alertas');
    expect(ROTAS.canteiros.label).toBe('Canteiros');
  });
});
