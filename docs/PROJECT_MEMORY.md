# Memoria técnica del proyecto

Este documento conserva la historia de implementación de **La Última Observación**. `AGENTS.md` es la autoridad normativa; esta memoria registra decisiones, evidencia y estado operativo sin sustituir ni borrar entradas anteriores.

## Vista de pájaro

Actualizado: 2026-08-04 (Europe/Madrid)

| Fase | Issues | Estado | Gate o dependencia principal |
|---|---:|---|---|
| WP0 — Fundación y contratos | #1–#4 | En curso | #1 en implementación; #2 es la siguiente raíz |
| WP1 — Solver puro | #5–#11 | Bloqueada | Requiere WP0 |
| WP2 — Render, cámara y física | #12–#14 | Bloqueada | Requiere WP0 |
| WP3 — Gramática y tiles | #15–#22 | Bloqueada | Requiere contratos y solver base |
| WP4 — Mundo observable | #23–#29 | Bloqueada | Requiere WP1, WP2 y WP3; termina con vertical slice |
| WP5 — Progresión y peligros | #30–#35 | Bloqueada | Requiere el gate del vertical slice |
| WP6 — Presentación | #36–#39 | Bloqueada | Requiere mundo observable estable |
| WP7 — Final | #40–#43 | Bloqueada | Requiere progresión y presentación |
| WP8 — QA y entrega | #44–#51 | Bloqueada | Requiere juego completo; termina en release candidate |
| POST — Expansiones | #52–#56 | Bloqueada | Solo después de la release de jam |

### Estado operativo actual

- Fase actual: WP0 — Fundación y contratos.
- Issue actual: #1 — publicar `AGENTS.md` como fuente de verdad.
- Siguiente issue desbloqueable: #2 — scaffold Vite + TypeScript estricto y shell offline, una vez integrada #1 en `dev`.
- Dependencias críticas: #1 → #2 → #3/#4; ninguna fase posterior puede promoverse antes de completar sus gates.
- Arquitectura vigente: TypeScript estricto + Vite + Three.js; contratos públicos en `src/contracts/`; worker WFC separado del main thread; runtime offline tras la carga.
- `dev`: `7190c837dcb1f4b4566273a785ea2948130e0d40` al iniciar esta ejecución.
- `main`: `7190c837dcb1f4b4566273a785ea2948130e0d40` al iniciar esta ejecución.
- Preview Sliplane: proyecto `La Ultima Observacion Preview` (`project_3o4wtis2vnhk`); servicio y URL N/A porque #1 no produce artefacto web.

## Registro cronológico

### 2026-08-04 — Issue #1 — Fuente normativa del producto

- Issue / PR / commits: issue #1; PR y commits pendientes de publicación en esta iteración.
- Objetivo: incorporar la especificación de diseño 1.0 completa y enlazarla desde el README como autoridad de implementación.
- Decisiones: conservar íntegramente el documento preparado; `AGENTS.md` define DEBE/DEBERÍA/PUEDE, invariantes y proceso de cambios; `PROJECT_MEMORY.md` queda como registro histórico acumulativo.
- Alternativas descartadas: resumir la especificación en el README, porque duplicaría y podría desalinear la fuente normativa.
- Trade-off: un documento normativo extenso exige disciplina de actualización, pero reduce ambigüedad entre fases y agentes.
- Impacto: desbloquea #2 y establece los contratos de coordinación para WP0–WP8.
- Riesgos / deuda: todavía no existe aplicación, suite de pruebas, CI ni artefacto desplegable; se incorporarán en #2–#4.
- Pruebas: comprobación UTF-8 de título, frase final, niveles normativos e invariantes; enlace relativo del README; `git diff --check`.
- Deploy: proyecto preview Sliplane creado; servicio, dominio, logs y HTTP N/A por ausencia de artefacto web.
- Navegador: Project #2 verificado en sesión autenticada; #1 figura In progress y #2 bloqueada. Aplicación local N/A.
- Evidencia: [`docs/progress/issue-1-publish-agents/`](./progress/issue-1-publish-agents/).
- Reversión: revertir el commit de la PR de #1; no existe migración, estado de runtime ni recurso de servicio que restaurar.
