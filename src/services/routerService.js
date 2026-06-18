/**
 * Hash router leve para navegação entre as 4 telas do dashboard A1.8.
 */

export const ROTAS = {
  principal: { path: '/principal', hash: '#/principal', label: 'Principal', navLabel: 'Principal' },
  alertas: { path: '/alertas', hash: '#/alertas', label: 'Alertas', navLabel: 'Alertas' },
  historico: { path: '/historico', hash: '#/historico', label: 'Histórico', navLabel: 'Histórico' },
  canteiros: { path: '/canteiros', hash: '#/canteiros', label: 'Canteiros', navLabel: 'Canteiros' },
  'evidencias-c1': { path: '/evidencias-c1', hash: '#/evidencias-c1', label: 'Evidências C1', navLabel: 'C1' },
};

const ALIAS = {
  '/': 'principal',
  '': 'principal',
  '/principal': 'principal',
  '/alertas': 'alertas',
  '/historico': 'historico',
  '/canteiros': 'canteiros',
  '/evidencias-c1': 'evidencias-c1',
};

let rotaAtual = 'principal';
let listeners = [];

export function parseHash(hash = window.location.hash) {
  const raw = (hash || '#/').replace(/^#/, '') || '/';
  const path = raw.split('?')[0];
  return ALIAS[path] || 'principal';
}

export function parseQueryParams(hash = window.location.hash) {
  const q = hash.split('?')[1];
  if (!q) return {};
  return Object.fromEntries(new URLSearchParams(q));
}

export function getRotaAtual() {
  return rotaAtual;
}

export function getRotaConfig(nome) {
  return ROTAS[nome] || ROTAS.principal;
}

export function navegarPara(nome, query = {}) {
  const cfg = getRotaConfig(nome);
  const qs = new URLSearchParams(query).toString();
  window.location.hash = qs ? `${cfg.path}?${qs}` : cfg.path;
}

export function onRouteChange(cb) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(l => l !== cb); };
}

function notificar() {
  rotaAtual = parseHash();
  listeners.forEach(cb => cb(rotaAtual, parseQueryParams()));
}

export function iniciarRouter() {
  rotaAtual = parseHash();
  window.addEventListener('hashchange', notificar);
  return rotaAtual;
}

export function pararRouter() {
  window.removeEventListener('hashchange', notificar);
}
