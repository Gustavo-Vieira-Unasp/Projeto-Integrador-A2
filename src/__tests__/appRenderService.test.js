/**
 * Testes unitários para appRenderService.js
 * Verifica: sensor cards (passos 1, 3, 4, 5), painéis laterais (passos 6, 7, 8, 9).
 */
import { renderCardSensor, renderNavbar, renderSidePanels } from '../services/appRenderService.js';

// ─────────────────────────────────────────────────────────────────────────────
// renderNavbar
// ─────────────────────────────────────────────────────────────────────────────
describe('renderNavbar', () => {
  test('renderiza estado online corretamente', () => {
    const html = renderNavbar('normal');
    expect(html).toContain('Online');
    expect(html).toContain('bg-emerald-500');
    expect(html).not.toContain('bg-red-500');
  });

  test('renderiza estado offline corretamente', () => {
    const html = renderNavbar('offline');
    expect(html).toContain('Offline');
    expect(html).toContain('bg-red-500');
  });

  test('contém links de navegação', () => {
    const html = renderNavbar('normal', 'principal');
    expect(html).toContain('Principal');
    expect(html).toContain('Histórico');
    expect(html).toContain('Alertas');
    expect(html).toContain('Canteiros');
    expect(html).toContain('#/alertas');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// renderCardSensor — estado normal
// ─────────────────────────────────────────────────────────────────────────────
describe('renderCardSensor — estado normal', () => {
  const accent = { icone: '🌱', corValor: 'text-emerald-600', corBarra: 'bg-emerald-500' };

  test('exibe valor e unidade', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', accent);
    expect(html).toContain('63.5');
    expect(html).toContain('%');
  });

  test('exibe título em uppercase', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', accent);
    expect(html).toContain('Umid. Solo');
  });

  test('exibe descrição de status', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', accent);
    expect(html).toContain('"Umido"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// renderCardSensor — estado offline
// ─────────────────────────────────────────────────────────────────────────────
describe('renderCardSensor — estado offline', () => {
  test('exibe "Dispositivo Offline" no lugar do valor', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'offline', 'Umido');
    expect(html).toContain('Dispositivo Offline');
    expect(html).not.toContain('63.5');
  });

  test('exibe "Inacessivel" como status', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'offline', 'Umido');
    expect(html).toContain('Inacessivel');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// renderCardSensor — estado parcial (falha de sensor)
// ─────────────────────────────────────────────────────────────────────────────
describe('renderCardSensor — estado parcial / falha', () => {
  test('exibe "Falha no Sensor" quando valor é null e estado é parcial', () => {
    const html = renderCardSensor('Umid. Solo', null, '%', 'parcial', 'N/D');
    expect(html).toContain('Falha no Sensor');
  });

  test('exibe "Erro I2C" como status quando há falha', () => {
    const html = renderCardSensor('Umid. Solo', null, '%', 'parcial', 'N/D');
    expect(html).toContain('Erro I2C');
  });

  test('exibe valor normalmente quando parcial mas com valor presente', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'parcial', 'Umido');
    expect(html).toContain('63.5');
    expect(html).not.toContain('Falha no Sensor');
  });

  test('exibe estado vermelho de rejeição UC-01 com motivo estruturado', () => {
    const html = renderCardSensor('Temperatura', null, '°C', 'normal', 'Quente', {}, {
      motivoRejeicao: 'OUT_OF_RANGE_HIGH',
    });
    expect(html).toContain('Leitura inválida');
    expect(html).toContain('Fora de faixa física');
    expect(html).toContain('border-red-300');
    expect(html).toContain('bg-red-500');
  });

  test('exibe estado amber de temperatura improvável p/ horta', () => {
    const html = renderCardSensor('Temperatura', 50, '°C', 'normal', 'Critico', {}, {
      temperaturaImprovavel: true,
    });
    expect(html).toContain('Improvável p/ horta');
    expect(html).toContain('50');
    expect(html).toContain('border-amber-300');
    expect(html).toContain('bg-amber-500');
    expect(html).not.toContain('Leitura inválida');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passo 1 — Barra de progresso
// ─────────────────────────────────────────────────────────────────────────────
describe('renderCardSensor — Passo 1: barra de progresso', () => {
  test('exibe barra quando showProgressBar é true e estado é normal', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', {}, {
      showProgressBar: true,
      progressBarPct: 63.5,
    });
    expect(html).toContain('rounded-full');
    expect(html).toContain('width: 63.5%');
  });

  test('NÃO exibe barra quando showProgressBar é false', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', {}, {
      showProgressBar: false,
    });
    expect(html).not.toContain('width:');
  });

  test('NÃO exibe barra quando estado é offline', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'offline', 'Umido', {}, {
      showProgressBar: true,
      progressBarPct: 63.5,
    });
    expect(html).not.toContain('width: 63.5%');
  });

  test('clamp: progressBarPct > 100 renderiza como 100%', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', {}, {
      showProgressBar: true,
      progressBarPct: 150,
    });
    expect(html).toContain('width: 100%');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passo 3 — Timestamp
// ─────────────────────────────────────────────────────────────────────────────
describe('renderCardSensor — Passo 3: timestamp', () => {
  test('exibe timestamp quando fornecido', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', {}, {
      timestamp: '14:32',
    });
    expect(html).toContain('14:32');
  });

  test('NÃO exibe timestamp quando ausente', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido');
    expect(html).not.toContain('font-mono text-slate-400 shrink-0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passo 4 — Delta / tendência
// ─────────────────────────────────────────────────────────────────────────────
describe('renderCardSensor — Passo 4: delta', () => {
  test('exibe ▲ e cor verde para delta positivo', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', {}, {
      delta: 2.1,
    });
    expect(html).toContain('▲');
    expect(html).toContain('2.1');
    expect(html).toContain('text-emerald-500');
  });

  test('exibe ▼ e cor vermelha para delta negativo', () => {
    const html = renderCardSensor('Umid. Solo', 61.4, '%', 'normal', 'Umido', {}, {
      delta: -2.1,
    });
    expect(html).toContain('▼');
    expect(html).toContain('2.1');
    expect(html).toContain('text-red-400');
  });

  test('NÃO exibe delta quando é null', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', {}, {
      delta: null,
    });
    expect(html).not.toContain('▲');
    expect(html).not.toContain('▼');
  });

  test('NÃO exibe delta quando estado é offline', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'offline', 'Umido', {}, {
      delta: 5,
    });
    expect(html).not.toContain('▲');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passo 5 — Badge de chuva / irrigação
// ─────────────────────────────────────────────────────────────────────────────
describe('renderCardSensor — Passo 5: badge contextual', () => {
  test('exibe badge de irrigação quando fornecido', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', {}, {
      badge: '💧 Irrigando',
    });
    expect(html).toContain('💧 Irrigando');
  });

  test('exibe badge de chuva quando fornecido', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Umido', {}, {
      badge: '🌧 Chuva detectada',
    });
    expect(html).toContain('🌧 Chuva detectada');
  });

  test('badge não aparece quando estado é offline', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'offline', 'Umido', {}, {
      badge: '💧 Irrigando',
    });
    expect(html).not.toContain('💧 Irrigando');
  });

  test('sem badge exibe descricaoStatus normalmente', () => {
    const html = renderCardSensor('Umid. Solo', 63.5, '%', 'normal', 'Solo seco');
    expect(html).toContain('"Solo seco"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passo 6 — Alertas corrigidos
// ─────────────────────────────────────────────────────────────────────────────
describe('renderSidePanels — Passo 6: alertas', () => {
  const dadosNormal = { umidade_solo_pct: 70, temperatura_c: 22, irrigacao_ativa: false };
  const dadosSeco   = { umidade_solo_pct: 28, temperatura_c: 22, irrigacao_ativa: false };
  const dadosQuente = { umidade_solo_pct: 70, temperatura_c: 38, irrigacao_ativa: false };

  test('NÃO contém "Reservatório crit." hardcoded', () => {
    const html = renderSidePanels(dadosNormal, 'normal', false);
    expect(html).not.toContain('Reservatório crit.');
  });

  test('contém alerta "Temperatura elevada"', () => {
    const html = renderSidePanels(dadosNormal, 'normal', false);
    expect(html).toContain('Temperatura elevada');
  });

  test('alerta de umidade acende quando umidade <= 30', () => {
    const html = renderSidePanels(dadosSeco, 'normal', false);
    expect(html).toContain('bg-yellow-500');
  });

  test('alerta de temperatura acende quando temp > 35', () => {
    const html = renderSidePanels(dadosQuente, 'normal', false);
    expect(html).toContain('bg-red-500');
    expect(html).toContain('text-red-600');
  });

  test('sistema normal aparece em verde quando online', () => {
    const html = renderSidePanels(dadosNormal, 'normal', false);
    expect(html).toContain('bg-emerald-500');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passo 7 — Uptime calculado e último comando
// ─────────────────────────────────────────────────────────────────────────────
describe('renderSidePanels — Passo 7: uptime e último comando', () => {
  const dados = { umidade_solo_pct: 70, temperatura_c: 22, irrigacao_ativa: false };

  test('exibe uptime calculado a partir do timestampInicio', () => {
    const inicioOntemMs = Date.now() - (1 * 24 * 60 * 60 * 1000);
    const html = renderSidePanels(dados, 'normal', false, { timestampInicio: inicioOntemMs });
    expect(html).toContain('1d');
  });

  test('exibe "0d 0h" quando offline', () => {
    const html = renderSidePanels(dados, 'offline', false, { timestampInicio: Date.now() - 100000 });
    expect(html).toContain('0d 0h');
  });

  test('exibe último comando quando fornecido', () => {
    const html = renderSidePanels(dados, 'normal', false, {
      ultimoComando: 'Iniciar irrigação (60s)',
      timestampInicio: Date.now(),
    });
    expect(html).toContain('Iniciar irrigação (60s)');
  });

  test('exibe "Nenhum" quando último comando é null', () => {
    const html = renderSidePanels(dados, 'normal', false, { ultimoComando: null });
    expect(html).toContain('Nenhum');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passo 8 — Duração configurável
// ─────────────────────────────────────────────────────────────────────────────
describe('renderSidePanels — Passo 8: duração de irrigação', () => {
  const dados = { umidade_solo_pct: 70, temperatura_c: 22, irrigacao_ativa: false };

  test('renderiza select com opções de duração', () => {
    const html = renderSidePanels(dados, 'normal', false, {
      duracaoIrrigacaoSeg: 60,
      opcoesDuracao: [30, 60, 120, 300],
    });
    expect(html).toContain('select-duracao-irrigacao');
    expect(html).toContain('30s');
    expect(html).toContain('1m');
    expect(html).toContain('2m');
    expect(html).toContain('5m');
  });

  test('opção atual aparece como selected', () => {
    const html = renderSidePanels(dados, 'normal', false, {
      duracaoIrrigacaoSeg: 120,
      opcoesDuracao: [30, 60, 120, 300],
    });
    expect(html).toContain('value="120" selected');
  });

  test('select está desabilitado quando offline', () => {
    const html = renderSidePanels(dados, 'offline', false, {
      duracaoIrrigacaoSeg: 60,
    });
    expect(html).toContain('disabled');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passo 9 — Log de erros acumulado
// ─────────────────────────────────────────────────────────────────────────────
describe('renderSidePanels — Passo 9: log de erros acumulado', () => {
  const dados = { umidade_solo_pct: 70, temperatura_c: 22, irrigacao_ativa: false };

  test('exibe entradas do log quando fornecidas', () => {
    const log = [
      { nivel: 'ERR', mensagem: 'Falha na API', timestamp: '14:32:01' },
      { nivel: 'OK', mensagem: 'mqtt broker connected', timestamp: '14:30:00' },
    ];
    const html = renderSidePanels(dados, 'normal', false, { logErros: log });
    expect(html).toContain('[ERR]');
    expect(html).toContain('Falha na API');
    expect(html).toContain('[OK]');
    expect(html).toContain('mqtt broker connected');
  });

  test('limita exibição a 8 entradas mesmo com log maior', () => {
    const log = Array.from({ length: 15 }, (_, i) => ({
      nivel: 'OK', mensagem: `evento ${i}`, timestamp: '10:00:00'
    }));
    const html = renderSidePanels(dados, 'normal', false, { logErros: log });
    const matches = (html.match(/\[OK\]/g) || []).length;
    expect(matches).toBeLessThanOrEqual(8);
  });

  test('CMD aparece em azul no log', () => {
    const log = [{ nivel: 'CMD', mensagem: 'Iniciar irrigação', timestamp: '14:00:00' }];
    const html = renderSidePanels(dados, 'normal', false, { logErros: log });
    expect(html).toContain('text-blue-400');
    expect(html).toContain('Iniciar irrigação');
  });

  test('usa log padrão quando logErros está vazio e estado é normal', () => {
    const html = renderSidePanels(dados, 'normal', false, { logErros: [] });
    expect(html).toContain('[OK] mqtt broker connected');
  });

  test('usa log padrão de erro quando estado é offline e logErros vazio', () => {
    const html = renderSidePanels(dados, 'offline', false, { logErros: [] });
    expect(html).toContain('[ERR] esp32 timeout disconnect');
  });
});
