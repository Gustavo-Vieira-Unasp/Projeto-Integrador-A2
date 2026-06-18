# Decisões de implementação — C1 Integridade de dados

**Tarefa:** Rejeitar leitura impossível na normalização  
**Cenário:** C1 · Integridade de dados  
**Autor:** Gustavo da Fonsêca Araujo Vieira · Grupo 1  
**Data:** 2026-06-16  
**Fonte de requisitos:** [UC-01 Passo 4](../requirements/casos_de_uso.md#uc-01-monitorar-dados-ambientais-em-tempo-real) e [FE-01-A](../requirements/casos_de_uso.md#fe-01-a-sensor-dht22-retorna-leitura-inválida-nan-85-°c-de-curto-ou-valor-fora-de-faixa)

Este documento registra **como** cada parte da entrega foi decidida antes da implementação, para rastreabilidade acadêmica e revisão de PR.

---

## 1. Problema identificado

A coordenadora observou **213 °C** no Canteiro Alface (Principal) e o valor passou a compor médias no Histórico. A causa raiz está em `normalizarRegistro()` ([`src/services/apiService.js`](../../src/services/apiService.js)): campos numéricos usam `?? 0` sem checagem de faixa física. A agregação em `appController.js` ainda usa `temperatura || 0`, o que distorceria médias mesmo se a ingestão passasse a retornar `null`.

---

## 2. Decisões por área

### 2.1 Semântica de rejeição

| Opção considerada | Decisão | Motivo |
| ----------------- | ------- | ------ |
| Manter número bruto + só flag | **Rejeitada** | Não impede poluição de gráficos/tabelas se algum consumidor ler o valor numérico |
| Remover registro inteiro do histórico | **Rejeitada** | Perde timestamp e demais sensores válidos (FE-01-A envia registro parcial com `null` nos campos afetados) |
| **`null` + `leituraSuspeita` + motivo estruturado** | **Adotada** | Alinhada ao ESP32/FE-01-A, ao `mockService` e ao `historicoView` existentes; permite UI e auditoria por campo |

**Substituição interna:** valor rejeitado vira `null`. O motivo fica em `errosLeitura[campo]` com taxonomia fixa (ver §2.2). `leituraSuspeita: true` quando qualquer campo UC-01 foi rejeitado por motivo diferente de `MISSING`.

### 2.2 Campos e faixas validadas

| Opção considerada | Decisão | Motivo |
| ----------------- | ------- | ------ |
| Só temperatura | **Rejeitada** | Enunciado cita UC-01 Passo 4 completo (temp + umidades) |
| Todos os numéricos (pH, luz, etc.) | **Rejeitada** | Fora do contrato UC-01 Passo 4; aumenta escopo sem requisito |
| **Temp (−10…80), umidadeAr (0…100), umidadeSolo (0…100) + NaN/Infinity + sentinel 85 °C só em temp** | **Adotada** | Espelha firmware e FE-01-A; umidade solo 85 % permanece **válida** (não confundir com mock `suspeito`) |

Constantes exportadas como `FAIXAS_UC01` e `TEMP_SENTINEL_DHT22` em `apiService.js`, com JSDoc apontando para UC-01.

**Taxonomia de motivos (`errosLeitura`):**

| Código | Condição | Log de observabilidade |
| ------ | -------- | ---------------------- |
| `MISSING` | Campo ausente na API | Não (comportamento esperado) |
| `NOT_A_NUMBER` | NaN, Infinity ou não-numérico | Sim (`reading_rejected`) |
| `DHT22_SENTINEL` | `temperatura === 85` | Sim |
| `OUT_OF_RANGE_LOW` | Valor &lt; mínimo UC-01 | Sim |
| `OUT_OF_RANGE_HIGH` | Valor &gt; máximo UC-01 (ex.: 213) | Sim |

### 2.3 Campos ausentes vs. rejeitados

| Opção considerada | Decisão | Motivo |
| ----------------- | ------- | ------ |
| Manter `?? 0` para ausentes | **Rejeitada** | Zero artificial distorce alertas e médias; contradiz ESP32 que envia `null` em falha |
| **`?? null` para os 3 campos UC-01** | **Adotada** | Consistente com FE-01-A; teste de regressão `"aplica valores padrão..."` será atualizado |

Demais campos (pH, luz, irrigação, estação) mantêm defaults existentes onde já havia fallback seguro.

### 2.4 Agregação para gráficos

| Opção considerada | Decisão | Motivo |
| ----------------- | ------- | ------ |
| Corrigir só `normalizarRegistro` | **Rejeitada** | `appController` usa `temperatura \|\| 0` — `null` viraria 0 na média |
| Corrigir agregação inline sem helper | **Rejeitada** | Menos testável; duplica lógica |
| **`agregarBucketLeituras()` exportado + uso em `appController`** | **Adotada** | Média só sobre valores finitos; denominador = contagem de válidos; provável em Jest com dados sintéticos |

### 2.5 Observabilidade

| Opção considerada | Decisão | Motivo |
| ----------------- | ------- | ------ |
| `console.warn` ad hoc | **Rejeitada** | Enunciado exige rastreabilidade via `observabilityService.js` |
| **`logLeituraRejeitada()` → `logWarn('reading_rejected', …)` + counter `reading_rejected_total`** | **Adotada** | Mesmo padrão JSON estruturado de `fetch_success` / `fetch_failed`; correlacionável por `requestId` |

Chamado em `normalizarRegistro` apenas quando motivo ≠ `MISSING`.

### 2.6 Feedback visual (Principal)

| Opção considerada | Decisão | Motivo |
| ----------------- | ------- | ------ |
| Só flag `suspeito` no Histórico | **Insuficiente** | Principal ainda mostraria card sem destaque claro |
| Amber `"Falha no Sensor"` (cenário `parcial`) | **Rejeitada para rejeição UC-01** | Reservado a mock offline/parcial; rejeição de integridade deve ser distinta |
| **Barra lateral vermelha + texto `"Leitura inválida"` + subtítulo do motivo em `renderCardSensor`** | **Adotada** | Padrão similar a badges chuva/irrigação; `motivoRejeicao` passado por `dashboardViewService` |

Histórico: manter célula `—` para `null` e flag `suspeito` (sem tooltip/CSV enriquecido nesta entrega — escopo ~4h).

### 2.7 Duas camadas: UC-01 vs plausibilidade horta (50 °C)

| Opção considerada | Decisão | Motivo |
| ----------------- | ------- | ------ |
| Rejeitar &gt;50 °C na ingestão | **Rejeitada** | Quebraria borda UC-01 de 80 °C exigida no enunciado e no firmware DHT22 |
| Tratar 80 °C como leitura normal na UI | **Rejeitada** | Absurdo para ar ambiente na horta (recorde BR ≈ 44,8 °C); confundia demo de evidências |
| **`temperaturaImprovavel` (≥50 °C) + card amber, sem rejeição** | **Adotada** | Duas camadas: UC-01 rejeita lixo (`null` + vermelho); plausibilidade horta avisa sem bloquear ingestão |

**Constante:** `TEMP_PLAUSIVEL_HORTA_MAX = 50` em `apiService.js` — **não** altera `FAIXAS_UC01.temperatura.max` (permanece **80**).

| Camada | Campo / sinal | UI |
| ------ | ------------- | -- |
| UC-01 ingestão | `leituraSuspeita` + `errosLeitura` | Vermelho — `"Leitura inválida"` |
| Plausibilidade horta | `temperaturaImprovavel` | Amber — `"Improvável p/ horta"`; valor numérico ainda exibido |

**80 °C permanece no contrato UC-01** (limite elétrico do sensor), não por realismo climático. Na UI, 50 °C e 80 °C aceitos são ambos `temperaturaImprovavel`; 85 °C e 213 °C continuam rejeitados.

Função auxiliar exportada: `classificarTemperaturaIntegridade()` → `'rejeitada' | 'improvavel' | 'normal'` (gráfico de faixas em `#/evidencias-c1`, seção D).

**Centro Analítico (Principal):** mini-escala vertical C1 (~10 px) desenhada no canvas `#analiseChart` via plugin Chart.js — decorativa/educativa, independente do eixo `y1` (0…40 °C); some quando a série Temperatura está desmarcada. Legenda compacta **Temp C1** junto a Chuva/Irrigação.

**Seção D (evidências):** três mini-gráficos estáticos SVG (normal / improvável / rejeitado) espelhando o Centro Analítico — mostram linha vermelha contínua, picos amber ou lacunas `null` após `normalizarRegistro`.

### 2.8 Testes e documentação

| Entregável | Decisão |
| ---------- | ------- |
| Evidência Jest | `test.each` em `apiService.test.js`, ID `unit.api.reading-boundary`: 213, 80, −10, 85, 0 % + casos NaN/out-of-range |
| Agregação | Teste sintético: bucket [20, null, 22] → média 21, não 85 |
| Fetch mock | Histórico misto sem `temperatura === 213` após normalização |
| Rastreabilidade | Nova linha **Risco #11** em `docs/test-strategy/test-strategy.md` §1.9 |
| Observabilidade | Teste em `observabilityService.test.js` para evento `reading_rejected` |

### 2.9 Fora de escopo (explícito)

- Backend Azure / Render e firmware ESP32  
- Validação de pH, luz solar e demais grandezas  
- E2E Playwright  
- Migração de snapshots antigos no IndexedDB (aceitável até próximo fetch)

---

## 3. Pontos de partida no código

| Arquivo | Papel |
| ------- | ----- |
| [`src/services/apiService.js`](../../src/services/apiService.js) | `normalizarRegistro()`, `obterHistoricoCompleto()` |
| [`src/services/observabilityService.js`](../../src/services/observabilityService.js) | Log estruturado |
| [`src/services/appController.js`](../../src/services/appController.js) | Agregação timeline |
| [`docs/test-strategy/test-strategy.md`](../test-strategy/test-strategy.md) | Matriz de riscos |

---

## 4. Branch de trabalho

Implementação na branch **`feat/c1-integridade-dados`**, derivada de `main`.

---

## 5. Referências cruzadas

- **Página de evidências (dashboard):** `#/evidencias-c1` — decisões, simulações visuais e log Jest embutido
- Plano de execução: [`.cursor/plans/c1_integridade_dados_c903fdb0.plan.md`](../../.cursor/plans/c1_integridade_dados_c903fdb0.plan.md)
- Casos de uso: [UC-01 Passo 4](../requirements/casos_de_uso.md), [FE-01-A](../requirements/casos_de_uso.md)
- Log de testes: [`docs/dashboard/evidencias/test-unit-c1.log`](../dashboard/evidencias/test-unit-c1.log) — regenere com `npm run test:evidencia-c1`
