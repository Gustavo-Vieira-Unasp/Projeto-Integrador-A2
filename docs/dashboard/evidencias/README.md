# Evidências de teste — C1 Integridade de dados

Arquivo gerado: `test-unit-c1.log`

## Como regenerar

Na raiz do projeto:

```bash
npm run test:evidencia-c1
```

Isso executa os testes de `apiService.test.js` e `observabilityService.test.js` (incluindo `unit.api.reading-boundary`) e grava o output em `test-unit-c1.log`.

## Como visualizar na entrega

```bash
npm run preview
```

Abra no navegador: [http://localhost:3000/#/evidencias-c1](http://localhost:3000/#/evidencias-c1)

A página faz fetch de `/docs/dashboard/evidencias/test-unit-c1.log` e exibe o conteúdo na seção **C · Evidência de testes**.

## Rastreabilidade

- UC-01 Passo 4 — faixas físicas
- Risco #11 — `docs/test-strategy/test-strategy.md`
- Decisões — `docs/decisions/c1-integridade-dados-decisoes.md`
