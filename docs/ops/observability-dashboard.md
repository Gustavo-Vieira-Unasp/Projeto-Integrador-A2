# Observabilidade — Dashboard PHorta (A1.8)

Instrumentação **real** no frontend via `src/services/observabilityService.js`.

---

## 1. Logs estruturados

Cada evento é emitido como **JSON em uma linha** no console do browser:

```json
{
  "timestamp": "2026-06-14T15:30:00.000Z",
  "level": "info",
  "event": "fetch_success",
  "requestId": "req_1718376600000_abc123",
  "screen": null,
  "durationMs": null,
  "records": 1500,
  "cenario": "normal"
}
```

### Eventos instrumentados

| Evento | Quando |
|--------|--------|
| `app_boot` | Inicialização do dashboard |
| `fetch_start` / `fetch_success` / `fetch_failed` | Ciclo de dados (`dataService`) |
| `route_change` | Troca de hash route |
| `screen_render` | Fim do render de cada tela (com `durationMs`) |
| `alerts_displayed` | Tela Alertas carregada |
| `csv_export` | Export CSV do Histórico |
| `reading_rejected` | Leitura UC-01 rejeitada na ingestão (`apiService.normalizarRegistro`) |

### Request ID

Gerado em `gerarRequestId()` no início de cada fetch. Propagado em todos os logs subsequentes até o próximo fetch.

---

## 2. Métricas

Expostas via `window.__PHORTA_METRICS__()` no console:

| Métrica | Tipo | Descrição |
|---------|------|-----------|
| `fetch_error_total` | Counter | Falhas de fetch acumuladas |
| `reading_rejected_total` | Counter | Leituras UC-01 rejeitadas na ingestão |
| `screen_render_ms` | Gauge map | Tempo de render por tela (`principal`, `alertas`, `historico`, `canteiros`) |
| `alerts_displayed_total` | Counter | Total de alertas exibidos |

### Como inspecionar (local)

```bash
npm run preview
# Abrir http://localhost:3000/#/principal
# DevTools → Console:
window.__PHORTA_METRICS__()
```

---

## 3. Runbook — erro persistente em produção

### Sintoma: dashboard mostra "Erro ao carregar" ou fica offline

| Passo | Ação | O que verificar |
|-------|------|-----------------|
| 1 | Verificar rede do cliente | API Azure/Render acessível? `curl https://horta-api-.../api/historico/completo?minutosAtras=60` |
| 2 | Verificar cache local | DevTools → Application → IndexedDB `phorta-dashboard` ou localStorage `phorta-snapshot` |
| 3 | Forçar cenário mock | `localStorage.setItem('phorta-cenario-forcado','offline')` + reload — UI deve mostrar simulação |
| 4 | Correlacionar logs | Filtrar console por `requestId` do último `fetch_failed` |
| 5 | Rollback | Promover deploy anterior no Vercel; tag estável: `v0.2.0-dashboard-rc` |
| 6 | Escalar | Se API OK mas dashboard falha → issue com `requestId`, screenshot, `__PHORTA_METRICS__()` |

### Sintoma: tela específica vazia

- **Alertas:** verificar filtros (canteiro/tipo/período); resetar para 7 dias
- **Histórico:** ampliar intervalo de datas; export CSV para validar dados
- **Canteiros:** verificar `localStorage phorta-canteiros`; reset via DevTools se corrompido

---

## 4. Evidência de funcionamento

Log de exemplo capturado em ambiente local (`npm run preview`):

Ver: [`evidencias/observability-local.txt`](evidencias/observability-local.txt)

```
{"timestamp":"2026-06-14T...","level":"info","event":"app_boot","requestId":null,"version":"0.2.0-dashboard-rc"}
{"timestamp":"2026-06-14T...","level":"info","event":"fetch_start","requestId":"req_...","source":"api"}
{"timestamp":"2026-06-14T...","level":"info","event":"fetch_success","requestId":"req_...","records":N,"cenario":"normal"}
{"timestamp":"2026-06-14T...","level":"info","event":"screen_render","requestId":"req_...","screen":"principal","durationMs":45.2}
```

Para screenshot: DevTools → Console com logs JSON visíveis após navegar Principal → Alertas → Histórico.
