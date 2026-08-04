# Memoria técnica del proyecto

Este documento conserva la historia de implementación de **La Última Observación**. `AGENTS.md` es la autoridad normativa; esta memoria registra decisiones, evidencia y estado operativo sin sustituir ni borrar entradas anteriores.

## Vista de pájaro

Actualizado: 2026-08-04 (Europe/Madrid)

| Fase | Issues | Estado | Gate o dependencia principal |
|---|---:|---|---|
| WP0 — Fundación y contratos | #1–#4 | En curso | #1 cerrada; #2 publicada desde `dev`; #3/#4 dependen de #2 |
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
- Issue actual: #2 — scaffold Vite + TypeScript estricto y shell offline.
- Siguiente issue desbloqueable: #3 — contratos públicos y worker eco; #4 queda igualmente desbloqueada cuando #2 se integre y cierre.
- Dependencias críticas: #1 → #2 → #3/#4; ninguna fase posterior puede promoverse antes de completar sus gates.
- Arquitectura vigente: TypeScript estricto + Vite + Three.js; contratos públicos en `src/contracts/`; worker WFC separado del main thread; runtime offline tras la carga.
- `dev`: `fcd18f692ec464a905cd42927c88501081bfee94` al iniciar la ejecución de #2.
- `main`: `7190c837dcb1f4b4566273a785ea2948130e0d40` al iniciar esta ejecución.
- Preview Sliplane: proyecto `La Ultima Observacion Preview` (`project_3o4wtis2vnhk`), servicio `service_qi0aluudq024` y URL `https://la-ultima-observacion-web.sliplane.app`.

## Registro cronológico

### 2026-08-04 — Issue #2 — Scaffold Vite y shell offline

- Issue / PR / commits: issue #2; PR #58 (`dev` ← `codex/issue-2-vite-shell`); `da6f3c50a33323b644195ae0644df350ae9d219d`, `4cca6639716a28719fb197f4152604109dcb3ad0` y el commit documental final de publicación.
- Objetivo: establecer una aplicación Vite + TypeScript estricta, reproducible, estática y sin dependencias de red en runtime.
- Decisiones: `bootstrap.ts` posee estados de carga/error y composición de la shell; `game-loop.ts` aporta un RAF pausable sin conocer render ni solver; Three.js y Rapier se fijan en lockfile pero no se importan hasta sus issues propietarias; el mismo `dist/` se sirve localmente con Vite preview y en Sliplane con Nginx.
- Alternativas descartadas: iniciar ya un renderer Three.js, porque invadiría WP2; usar fuentes/CDN o assets remotos, porque rompería el contrato offline; usar Vite preview como servidor de producción, porque Nginx ofrece un artefacto estático explícito y healthcheck real.
- Trade-offs: la shell usa geometría CSS como identidad visual temporal; será sustituible sin alterar el contrato de bootstrap. Se añade Docker/Nginx ahora para poder validar el primer preview, aunque CI se configura en #4.
- Impacto: desbloquea #3 y #4; establece `src/app/`, scripts reproducibles y el primer artefacto desplegable sin congelar aún contratos WFC.
- Riesgos / deuda: Docker Desktop local no estaba disponible, por lo que el contenedor se validó mediante build y arranque remotos de Sliplane; lint, tests y CI pertenecen a #4.
- Pruebas: Node 24.14.0 / npm 11.9.0; `npm run typecheck`, `npm run build`, `npm audit --omit=dev` y `git diff --check` en verde; build de 0,92 kB HTML + 7,09 kB CSS + 4,41 kB JS; servidor estático local HTTP 200; recursos del navegador limitados a los assets relativos generados por Vite; consola sin warnings/errores.
- Deploy: Sliplane `project_3o4wtis2vnhk`, servidor existente `server_rlryp6tqmxz6`, servicio `service_qi0aluudq024`, rama `codex/issue-2-vite-shell`, commit `da6f3c5`; evento terminal “Service deployed successfully”; `/` y `/health` responden 200; Nginx 1.29.5 inicia sin errores.
- Navegador: shell local y URL Sliplane verificadas; “Calibrar mirada” cambia el estado a `CALIBRADA`, deshabilita el botón y mantiene consola limpia. La captura del preview desplegado falló por timeout de la herramienta después de que la prueba funcional ya pasara; no se sustituyó por una evidencia engañosa. PR #58 quedó no draft, `MERGEABLE/CLEAN`, base `dev`; Project #2 quedó en **In review**.
- Evidencia: [`docs/progress/issue-2-vite-shell/`](./progress/issue-2-vite-shell/).
- Reversión: revertir los commits de #2 y retirar o pausar `service_qi0aluudq024`; no hay datos, volúmenes, migraciones ni secretos que restaurar.

### 2026-08-04 — Issue #1 — Fuente normativa del producto

- Issue / PR / commits: issue #1; PR #57 (`dev` ← `codex/issue-1-publish-agents`); `b204f4e6eed958b9e81b840bf1fbe3f877265ba9`, `421280dc0ec4452efd53d7faf0e4309adb709c94` y el commit documental final de esta entrada.
- Objetivo: incorporar la especificación de diseño 1.0 completa y enlazarla desde el README como autoridad de implementación.
- Decisiones: conservar íntegramente el documento preparado; `AGENTS.md` define DEBE/DEBERÍA/PUEDE, invariantes y proceso de cambios; `PROJECT_MEMORY.md` queda como registro histórico acumulativo.
- Alternativas descartadas: resumir la especificación en el README, porque duplicaría y podría desalinear la fuente normativa.
- Trade-off: un documento normativo extenso exige disciplina de actualización, pero reduce ambigüedad entre fases y agentes.
- Impacto: desbloquea #2 y establece los contratos de coordinación para WP0–WP8.
- Riesgos / deuda: todavía no existe aplicación, suite de pruebas, CI ni artefacto desplegable; se incorporarán en #2–#4.
- Pruebas: comprobación UTF-8 de título, frase final, niveles normativos e invariantes; enlace relativo del README; `git diff --check` en verde. No existe todavía `package.json`, por lo que `npm run check/build` es N/A hasta #2.
- Deploy: proyecto preview Sliplane creado; servicio, dominio, logs y HTTP N/A por ausencia de artefacto web.
- Navegador: Project #2 verificado en sesión autenticada; #1 pasó de In progress a In review y #2 permanece bloqueada. PR #57 publicada contra `dev`, no draft, `MERGEABLE/CLEAN` y sin checks configurados. Aplicación local N/A.
- Evidencia: [`docs/progress/issue-1-publish-agents/`](./progress/issue-1-publish-agents/).
- Reversión: revertir el commit de la PR de #1; no existe migración, estado de runtime ni recurso de servicio que restaurar.
