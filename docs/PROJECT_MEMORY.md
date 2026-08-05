# Memoria técnica del proyecto

Este documento conserva la historia de implementación de **La Última Observación**. `AGENTS.md` es la autoridad normativa; esta memoria registra decisiones, evidencia y estado operativo sin sustituir ni borrar entradas anteriores.

## Vista de pájaro

Actualizado: 2026-08-05 (Europe/Madrid)

| Fase | Issues | Estado | Gate o dependencia principal |
|---|---:|---|---|
| WP0 — Fundación y contratos | #1–#4 | En curso | #1–#3 cerradas; #4 publicada en PR #60 contra `dev` |
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
- Issue actual: #4 — check, lint, format, tests y CI; PR #60 en validación.
- Siguiente trabajo desbloqueable: reconciliar #4 tras su merge en `dev` y ejecutar la promoción formal de WP0; #5/#12 no se seleccionan antes de esa puerta.
- Dependencias críticas: #1 → #2 → #3/#4; ninguna fase posterior puede promoverse antes de completar sus gates.
- Arquitectura vigente: TypeScript estricto + Vite + Three.js; contratos públicos en `src/contracts/`; worker WFC separado del main thread; runtime offline tras la carga.
- `dev`: `9de883f12f64644a2a3b596d36372dc55aca32d1` al iniciar la ejecución de #4; contiene la PR #59 de #3.
- `main`: `7190c837dcb1f4b4566273a785ea2948130e0d40`; está contenido en `dev` y WP0 aún no cumple gate de promoción.
- Preview Sliplane: proyecto `La Ultima Observacion Preview` (`project_3o4wtis2vnhk`), servicio live `service_qi0aluudq024`, rama `codex/issue-4-quality-gate-ci`, commit `d412bca2aad8c25e56f91efa7b365d1903a8acea` y URL `https://la-ultima-observacion-web.sliplane.app`.

## Registro cronológico

### 2026-08-05 — Issue #4 — Puerta reproducible de calidad y CI

- Issue / PR / commits: issue #4; PR #60 (`dev` ← `codex/issue-4-quality-gate-ci`); rama desde `dev` `9de883f12f64644a2a3b596d36372dc55aca32d1`; commit de implementación `d412bca2aad8c25e56f91efa7b365d1903a8acea` y commit documental posterior de evidencia/publicación.
- Objetivo: cerrar WP0 con un gate reproducible que bloquee cualquier cambio cuando fallen tipos, lint, tests, formato o build.
- Decisiones: Node 24.14.0 se fija en `.nvmrc`; ESLint usa flat config y `--max-warnings=0`; Prettier dispone de `format` y `format:check`; `npm run check` ejecuta TypeScript, ESLint y toda la suite Vitest; GitHub Actions usa un único job secuencial con `npm ci`; `.gitattributes` normaliza LF.
- Compatibilidad TypeScript: el compilador nativo TypeScript 7.0.2 permanece detrás de `tsc`; el paquete `typescript` apunta mediante el alias oficial a TypeScript 6.0.3 solo para la API que `typescript-eslint` importa. La instalación aislada desde lockfile demostró que ambos conviven sin `--force`.
- Alternativas descartadas: degradar todo el proyecto a TypeScript 6, porque perdería el compilador normativo ya fijado; omitir lint de TypeScript, porque dejaría el gate incompleto; separar check/build en jobs independientes, porque un único job expresa mejor la secuencia bloqueante de esta fase.
- Trade-offs: la primera adopción de Prettier normaliza mecánicamente archivos existentes sin cambiar semántica; el alias TS6 es deuda temporal hasta que `typescript-eslint` soporte la API de TS7.
- Impacto: integra las pruebas de contratos de #3 en el gate global y completa el alcance de implementación de WP0. WP1/WP2 siguen bloqueadas hasta que #4 se fusione en `dev` y la promoción WP0 `dev`→`main` supere sus gates.
- Riesgos / deuda: vigilar la compatibilidad del alias cuando TypeScript 7.1 exponga API. No cambian contratos, runtime, assets de juego ni reglas normativas.
- Pruebas: `npm run format:check`, `npm run check` (typecheck, ESLint, dos archivos/cuatro tests), `npm run build`, `npm ci --ignore-scripts` aislado, `npm audit --omit=dev` y `git diff --check` en verde.
- Deploy: Sliplane `project_3o4wtis2vnhk` / `service_qi0aluudq024`, rama `codex/issue-4-quality-gate-ci`, commit `d412bca`; evento terminal `service_event_t1lsbe334b0c` (`Service deployed successfully`); build remoto con `npm ci`/TypeScript 7/Vite verde; `/` y `/health` responden 200, health `ok`.
- Navegador: build estática local y preview Sliplane verificados; eco `#000001`, calibración, assets del mismo origen y cero warnings/errores. WebM N/A porque el cambio no añade una interacción temporal nueva. PR #60 quedó no draft, `MERGEABLE/CLEAN`, base `dev`, labels `codex`/`codex-automation` y CI verde; #4 pasó a **In review** en Project #2.
- Evidencia: [`docs/progress/issue-4-quality-gate-ci/`](./progress/issue-4-quality-gate-ci/).
- Reversión: revertir los commits de #4 y devolver Sliplane a la rama de #3; no hay datos, volúmenes, migraciones ni cambios normativos que restaurar.

### 2026-08-05 — Issue #3 — Contratos públicos y worker eco numerado

- Issue / PR / commits: issue #3; PR #59 (`dev` ← `codex/issue-3-public-contracts-worker`); rama desde `dev` `148a3f8b3751ff27c5b1d6bde829db6bef1eda1b`; commits `dcc1812ff1ca526c76f002e3b11119aea0176d7c`, `4bf712c60cfb3301d8f66b5347105fb834f64871` y el commit documental final de publicación.
- Objetivo: congelar la primera frontera pública entre main, solver, render y contenido, con mensajes verificables en runtime y un worker real que preserve el número de tick.
- Decisiones: `src/contracts/` posee los tipos de mundo, tiles y mensajes definidos en `AGENTS.md`; `runtime-validation.ts` valida defensivamente ambos sentidos del canal; `worker-runtime.ts` devuelve un `SolverWarning` `ECHO_ONLY` con el mismo tick; `transferables.ts` centraliza la lista de buffers de `ChunkBoundaryEvent`; una prueba de arquitectura impide imports internos entre `wfc`, `world`, `render` y `content`.
- Alternativas descartadas: añadir un evento `ECHO` a `WorkerOutput`, porque alteraría la unión normativa; fingir un `CollapseEvent` o `BoundaryUpdate` sin solver, porque mezclaría handshake y simulación; aceptar objetos tipados sin guardas de runtime, porque `postMessage` cruza una frontera no confiable.
- Trade-offs: Vitest entra como dependencia fijada antes de #4 porque el criterio de #3 exige un test ejecutable; #4 seguirá siendo propietaria de la configuración global de check, lint, format y CI. `ECHO_ONLY` es scaffolding explícito y deberá desaparecer cuando #11 conecte `SolverCore`.
- Impacto: desbloquea los contratos que consumirán #5, #6, #12 y #15 sin implementar todavía bitsets, PRNG, renderer, gramática, chunks ni colapsos.
- Riesgos / deuda: la forma interna de `SolverWarning` queda mínima y podrá ampliarse de forma compatible; no se ha congelado aún `CollapseEvent` como evento de gameplay. El test de límites cubre imports estáticos y deberá integrarse en `npm run check` en #4.
- Pruebas: `npm run typecheck`, `npm run test:contracts` (2 archivos, 4 tests), `npm run build`, `npm audit --omit=dev` y `git diff --check` en verde; build con worker separado de 1,68 kB.
- Deploy: Sliplane `project_3o4wtis2vnhk` / `service_qi0aluudq024`, rama `codex/issue-3-public-contracts-worker`, commit `dcc1812`; evento terminal `service_event_0sz5q0lycu8l` (`Service deployed successfully`); `/` y `/health` responden 200, health `ok`, y los logs desde el deploy no contienen errores. No se creó ningún recurso nuevo.
- Navegador: dev server, build estática y Sliplane verificados; tick `#000001` retorna `ECO`, estado `ready`, calibración funcional, worker local cargado como recurso separado y cero warnings/errores en cargas limpias. El primer acceso remoto reutilizó HTML cacheado de #2; `?rev=dcc1812` confirmó los hashes nuevos y el worker sin alterar el artefacto. Un error aislado de la extensión durante un reload local no se reprodujo en una pestaña nueva y no procede de la app. PR #59 quedó no draft, `MERGEABLE/CLEAN`, sin checks configurados, base `dev`; issue #3 y Project #2 quedaron en **In review**.
- Evidencia: [`docs/progress/issue-3-public-contracts-worker/`](./progress/issue-3-public-contracts-worker/). WebM N/A porque el handshake es instantáneo y no existe un flujo visual temporal nuevo.
- Reversión: revertir los commits de #3 y devolver Sliplane a la rama anterior; no hay datos, volúmenes, migraciones ni cambios normativos que restaurar.

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
