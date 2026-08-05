# Issue #7 — Entropía, pesos y selección determinista

## Estado inicial

- `dev` local y `origin/dev`: `b6788e3da536ede060d7e680090be5707a217067`.
- Rama: `codex/issue-7-entropy-selection`.
- Dependencias #5 y #6 cerradas tras integración verificada en `dev`.
- Issue #7 reclamada con `status:in-progress` y tarjeta en **In progress**.
- #8 continúa bloqueada hasta que esta PR se integre en `dev`.

## Alcance implementado

- Entropía ponderada de Shannon sobre los bits legales del dominio.
- Peso efectivo con curva de distancia lineal, sesgos blandos de vecinos,
  multiplicador de progresión y ruido determinista acotado.
- Elección ponderada estable con el PRNG del solver.
- Prioridad normativa de observación y desempate por identidad estable.
- Rechazo defensivo de pesos y multiplicadores no positivos o no finitos.

## Evidencia

- `project-initial.webp`: #7 reclamada en **In progress** después de reconciliar #6.
- `local-browser.webp`: build local calibrada, worker eco operativo y consola limpia.
- `sliplane-browser.webp`: commit `3215de1` desplegado y validado en navegador.
- `pr-64-published.webp`: PR no draft abierta contra `dev`, con tres commits y CI verde.
- `project-final.webp`: #7 en **In review**; **In progress** vacío y #8 aún bloqueada.

## Validación reproducible

- `npm run check`: typecheck, ESLint y 31 tests verdes.
- `npm run build`: artefacto Vite estático generado sin errores.
- `npm audit --omit=dev`: cero vulnerabilidades.
- `git diff --check`: limpio.
- `npx vitest bench tests/benchmarks/entropy.bench.ts --run --no-color`:
  - entropía de 64 variantes: 100.481 ops/s, media 0,0100 ms, p99 0,0237 ms;
  - selección de 64 variantes: 76.871 ops/s, media 0,0130 ms, p99 0,0338 ms.
- Seed `0xA91F42C0`; hash canónico antes/después `3069527348`.

## Preview

- Proyecto `project_3o4wtis2vnhk`; servicio `service_qi0aluudq024`.
- Rama `codex/issue-7-entropy-selection`; commit `3215de13a02477cf09bc32f6c0f815ecfd06884a`.
- Evento terminal `service_event_gx0qh2t04i6x`: `Service deployed successfully`.
- `https://la-ultima-observacion-web.sliplane.app/?rev=3215de1` y `/health`: HTTP 200.
- Consola limpia, assets same-origin, calibración y eco `#000001` verificados.
- WebM N/A: la issue añade infraestructura matemática sin interacción temporal nueva.

## Publicación

- PR #64: `feat(WP1): add deterministic entropy and selection`.
- Base `dev`; head `codex/issue-7-entropy-selection`; no draft; no fusionada.
- Estado `MERGEABLE/CLEAN`; CI `Check and build` `SUCCESS` (run `30997263935`).
- Labels `codex` y `codex-automation`; issue #7 con `status:in-review`.
- Project #2: tarjeta de #7 en **In review**.
