# Memoria técnica del proyecto

Este documento conserva la historia de implementación de **La Última Observación**. `AGENTS.md` es la autoridad normativa; esta memoria registra decisiones, evidencia y estado operativo sin sustituir ni borrar entradas anteriores.

## Vista de pájaro

Actualizado: 2026-08-05 (Europe/Madrid)

| Fase | Issues | Estado | Gate o dependencia principal |
|---|---:|---|---|
| WP0 — Fundación y contratos | #1–#4 | Completada y promovida | PR #61 fusionada; `main` y `dev` sincronizadas en `7be4649` |
| WP1 — Solver puro | #5–#11 | En curso | #5–#7 integradas en `dev`; #8 implementa propagación y desbloqueará #9 al integrarse |
| WP2 — Render, cámara y física | #12–#14 | Pendiente | WP0 completada; se prioriza WP1 por orden del plan |
| WP3 — Gramática y tiles | #15–#22 | Bloqueada | Requiere contratos y solver base |
| WP4 — Mundo observable | #23–#29 | Bloqueada | Requiere WP1, WP2 y WP3; termina con vertical slice |
| WP5 — Progresión y peligros | #30–#35 | Bloqueada | Requiere el gate del vertical slice |
| WP6 — Presentación | #36–#39 | Bloqueada | Requiere mundo observable estable |
| WP7 — Final | #40–#43 | Bloqueada | Requiere progresión y presentación |
| WP8 — QA y entrega | #44–#51 | Bloqueada | Requiere juego completo; termina en release candidate |
| POST — Expansiones | #52–#56 | Bloqueada | Solo después de la release de jam |

### Estado operativo actual

- Fase actual: WP1 — Solver puro.
- Issue actual: #8 — compatibilidad cardinal y propagación FIFO; rama `codex/issue-8-cardinal-propagation` desde `dev` `4dd07958e6364e363ae611f2561b4a0deb4dbe9e`.
- Siguiente trabajo desbloqueable: #9 solo cuando #8 esté cerrada mediante una PR integrada en `dev`; #10–#11 continúan bloqueadas por sus relaciones nativas.
- Dependencias críticas: #5/#6 → #7 → #8 → #9; propagación consume bitsets y entropía, reduce dominios de forma monotónica y devuelve contradicción antes de tocar una celda `FIXED`.
- Arquitectura vigente: TypeScript estricto + Vite + Three.js; contratos públicos en `src/contracts/`; worker WFC separado; dominios internos en dos palabras `uint32`; PRNG/tick/hash explícitos; pesos y entropía deterministas; compatibilidad cardinal compilada y cola FIFO reutilizable en `src/wfc/`; runtime offline tras la carga.
- `dev`: `4dd07958e6364e363ae611f2561b4a0deb4dbe9e`, merge de #7; `main`: `7be4649ece2a9a8f4bed40ff72653ef6cbf06478`, última promoción WP0.
- Preview Sliplane: proyecto `La Ultima Observacion Preview` (`project_3o4wtis2vnhk`), servicio live `service_qi0aluudq024`, rama `codex/issue-8-cardinal-propagation`, commit `2eb97c7688bd09218a390146dc3223b0adf1a622`, evento `service_event_hhp2wsor9pql` y URL `https://la-ultima-observacion-web.sliplane.app`.

## Registro cronológico

### 2026-08-05 — Issue #8 — Compatibilidad cardinal y propagación FIFO

- Issue / PR / commits: issue #8; PR #65 (`dev` ← `codex/issue-8-cardinal-propagation`) desde `dev` exacta `4dd07958e6364e363ae611f2561b4a0deb4dbe9e`; implementación `2eb97c7688bd09218a390146dc3223b0adf1a622` y documentación/evidencia `39abaa6ca5da26a8ca6d8df1ef67fa3d68c90edb`.
- Objetivo: compilar restricciones de sockets para las cuatro direcciones y propagarlas por una cola FIFO reutilizable, detectando contradicciones sin recalcular entropía ni encolar trabajo cuando el dominio no cambia.
- Decisiones: `compatibility.ts` valida ids/sockets y reciprocidad antes de producir una máscara por variante/dirección; `ReusableCellQueue` usa `Int32Array` y marcas `Uint8Array` con capacidad fija; `propagateCardinalConstraints` recorre N/E/S/W, une compatibilidades del emisor, intersecta el vecino y solo recalcula/encola al reducirlo; `ascii.ts` representa `!`, `?` o una variante singleton en orden row-major.
- Alternativas descartadas: `Set<number>` o arrays crecientes para la cola, por asignaciones calientes; encolar duplicados y filtrarlos al extraer, porque aumenta latencia sin aportar información; recalcular toda la cuadrícula tras cada reducción, porque rompe el presupuesto incremental; y reparar una incompatibilidad sobrescribiendo `FIXED`, porque viola la inmutabilidad normativa.
- Trade-offs: la compilación usa `Map`/`Set` una sola vez para detectar reglas recíprocas y referencias desconocidas; el camino caliente conserva dos máscaras mutables y buffers fijos. La cola se limpia entre transacciones; #10 podrá ajustar su capacidad a la región/chunk sin cambiar esta semántica.
- Impacto: #9 puede tomar snapshots y reintentar candidatos sobre una propagación que informa contradicción sin rollback implícito; #10 podrá reutilizar las tablas y la cola por chunk; #11 conectará el presupuesto incremental al worker. No cambian `src/contracts/`, contenido, render, assets ni mensajes.
- Riesgos / deuda: `SocketCompatibility` todavía recibe strings y #15 será propietario del schema/compilación de gramática; la regla de dos salidas y el diagnóstico de camino mínimo pertenecen a #17. La propagación actual es síncrona; #11 conservará estado entre ticks para respetar 4 ms.
- Seed / hash / benchmark: seed canónica `0xA91F42C0`; hash canónico `3069527348` antes/después, ya que no se fijan ni serializan tiles. Un tablero 64×64 alterno completo alcanzó 1.094,92 propagaciones/s, media 0,9133 ms y p99 1,4249 ms en Node 24.
- Preservación de `FIXED`: una reducción incompatible dirigida a una celda marcada `fixed` devuelve `CONTRADICTION` con su `cellId` y conserva ambos words y su entropía; no existe rollback ni commit dentro de esta capa.
- Pruebas: `npm run format:check`, `npm run check` (6 archivos, 38 tests), `npm run build`, `npm audit --omit=dev`, `git diff --check`, unitarias dedicadas y benchmark verdes. Se cubren reciprocidad, regla desconocida, deduplicación de cola, mapa alterno exacto, segunda propagación estable sin recálculos, dominio vacío y contradicción contra `FIXED`.
- Deploy y navegador: Sliplane desplegó `2eb97c7` desde la rama con `service_event_hhp2wsor9pql`; los logs confirman el SHA clonado, `/` y `/health` responden 200. Local y remoto conservan shell, calibración y eco `#000001` con consola limpia. WebM N/A: solver puro sin flujo visual temporal nuevo.
- Publicación y Project: PR #65 no draft, base `dev`, `MERGEABLE/CLEAN`, labels `codex`/`codex-automation` y CI `Check and build` terminal `SUCCESS` (run `31001657952`). Los cuatro criterios están marcados; #8 permanece abierta con `status:in-review` y tarjeta en **In review**. La primera captura del tablero agotó dos veces el timeout; tras filtrar la tarjeta se guardó evidencia autenticada reproducible junto con navegador local/remoto y PR en [`docs/progress/issue-8-cardinal-propagation/`](./progress/issue-8-cardinal-propagation/).
- Reversión: revertir los commits de #8 y devolver el preview a `dev`; no hay datos, migraciones, assets, volúmenes ni decisiones normativas que restaurar.

### 2026-08-05 — Issue #7 — Entropía, pesos efectivos y selección determinista

- Issue / PR / commits: issue #7; PR #64 (`dev` ← `codex/issue-7-entropy-selection`) desde `dev` exacta `b6788e3da536ede060d7e680090be5707a217067`; implementación `3215de13a02477cf09bc32f6c0f815ecfd06884a`, benchmark `9973b756ce786f722bf8a2fbae7dee2e0161c05b` y documentación/evidencia `e45942cf65acde7e34e270485b50e49f7e2a879c`.
- Objetivo: calcular la entropía ponderada normativa y elegir variantes/celdas de manera reproducible, incorporando distancia, vecinos, progresión y ruido pequeño sin permitir que una preferencia blanda restaure una incompatibilidad.
- Decisiones: `src/wfc/entropy.ts` recorre únicamente bits presentes mediante `nextSetBit`; aplica la fórmula `log(sum(w)) - sum(w log(w))/sum(w)`; interpola curvas de distancia por tramos; compone sesgos por etiqueta observada; acepta ruido determinista por variante; consume `RngState` para elección ponderada; calcula prioridad `4 × carga + 1,5 × continuidad - 0,8 × entropía + ruido`; y desempata por menor `cellId`.
- Alternativas descartadas: construir arrays/`Set` de candidatos, porque duplicaría la representación caliente; aplicar sesgos antes de intersectar compatibilidad, porque podría rescatar tiles ilegales; usar `Math.random()`, porque rompería replay; y asignar desempates al orden de llegada, porque haría el resultado dependiente de la colección.
- Trade-offs: las curvas y multiplicadores se validan defensivamente en el camino público para fallar cerca del contenido inválido; una futura compilación de gramática puede precalcular esa validación si el perfil lo exige. El ruido de peso queda acotado a ±2 % y el de prioridad a ±0,000001, suficiente para estabilidad sin dominar carga, continuidad o entropía.
- Impacto: #8 recibe pesos, entropía y elección sobre dominios de 64 bits; #11 podrá conectarlos al worker sin nuevas dependencias. No cambian `src/contracts/`, tiles, mensajes, render, assets ni la semántica de `FIXED`.
- Riesgos / deuda: `neighborTagCounts` representa el resumen blando que construirá el solver; la compilación de contenido deberá mapear tags de vecinos de forma consistente. Las curvas vacías equivalen a multiplicador 1; puntos no ordenados, pesos no positivos, overflow y dominios habilitados sin definición fallan explícitamente.
- Seed / hash / benchmark: seed canónica `0xA91F42C0`; el hash de tres celdas permanece `3069527348` antes y después porque #7 no cambia serialización ni tiles. Con 64 variantes y todos los factores activos, Vitest/Node 24 midió entropía a 100.481 ops/s (media 0,0100 ms, p99 0,0237 ms) y selección a 76.871 ops/s (media 0,0130 ms, p99 0,0338 ms).
- Preservación de `FIXED`: las funciones reciben máscaras y metadatos de solo lectura, no exponen mutación y solo devuelven entropía, índice o candidato; rollback/commit siguen fuera de alcance. Una variante retirada del dominio nunca se evalúa ni puede ser elegida aunque tenga sesgo arbitrariamente alto.
- Pruebas: `npm run check` (5 archivos, 31 tests), `npm run build`, `npm audit --omit=dev`, `git diff --check` y benchmark dedicado verdes. La suite cubre fórmula, factores, pesos inválidos, curva mal ordenada, dominio vacío, exclusión por compatibilidad, secuencia idéntica por seed, prioridad y empate estable.
- Deploy y navegador: Sliplane desplegó `3215de1` desde la rama con `service_event_gx0qh2t04i6x`; build remoto 66 ms, cero logs de error, `/` y `/health` 200. Local y remoto conservan shell, calibración y eco `#000001`; assets relativos/same-origin y consola sin warnings/errores. WebM N/A: el cambio es solver puro y no añade un flujo temporal visible.
- Publicación y Project: PR #64 no draft, base `dev`, `MERGEABLE/CLEAN`, labels `codex`/`codex-automation` y CI `Check and build` terminal `SUCCESS` (run `30997263935`). Los cuatro criterios de #7 están marcados; la issue permanece abierta con `status:in-review` y su tarjeta está en **In review**. La PR de issue no se fusionó.
- Evidencia: [`docs/progress/issue-7-entropy-selection/`](./progress/issue-7-entropy-selection/).
- Reversión: revertir los commits de #7 y devolver el preview a `dev`; no hay datos, migraciones, assets ni decisiones normativas que restaurar.

### 2026-08-05 — Issue #6 — Determinismo temporal, de streams y del mundo final

- Issue / PR / commits: issue #6; PR #63 (`dev` ← `codex/issue-6-deterministic-rng`) desde `dev` exacta `2adebf247afdc184db65b378f127f10eeacf156f`; implementación `127c9e5ab0d90e268d3f33af3c1523d254e79d3d`, documentación/evidencia `46ae7c467338bb74adecf09ef002c0d586a0b7ea` y commit final de publicación.
- Objetivo: garantizar que seed, identidad del subsistema/chunk y ticks fijos produzcan la misma secuencia y el mismo hash final, sin depender del framerate ni de `Math.random()`.
- Decisiones: `src/wfc/rng.ts` implementa Mulberry32 con reducción explícita a `uint32`; `deriveSeed` combina `worldSeed`, nombre del sistema y coordenadas `int32` mediante FNV-1a etiquetado y avalancha; `simulationTickAt` proyecta tiempo real al último tick completo de 100 ms; `hashFinalWorld` ordena las celdas por `cellId` e incluye seed, terreno y presencia/ID de feature.
- Alternativas descartadas: `Math.random()`, por no ser sembrable ni reproducible; estado global compartido, porque acoplaría subsistemas y chunks; hash por orden de colapso, porque dos estados finales iguales podrían diferir por orden de inserción; redondear cada frame a un tick, porque avanzaría el RNG un número distinto de veces según FPS.
- Trade-offs: el hash final copia y ordena las celdas, una asignación aceptable al cierre/replay que evita coste durante cada commit; Mulberry32 prioriza estabilidad portable y velocidad para generación procedural, no seguridad criptográfica; el contrato exacto de serialización del solver se conectará en #11 sin cambiar estas primitivas.
- Impacto: #7 puede usar streams separados y avanzar una vez por tick normativo; replay y worker reciben una referencia estable para verificar resultados. No cambian `src/contracts/`, mensajes, tiles, render, `FIXED` ni comportamiento visible del shell.
- Riesgos / deuda: `hashFinalWorld` cubre la identidad disponible de celda/tiles; si una variante futura separa rotación del `numericId`, #15/#11 deberán añadir esa palabra con una nueva versión de hash. La versión actual queda etiquetada como `WFC1`/1 para no reinterpretarla silenciosamente.
- Seed / hash / benchmark: antes no existía hash de mundo (`N/A`); vector nuevo `worldSeed=0xA91F42C0`, tres celdas canónicas → `3069527348`. En Node 24, 1.000.000 pasos PRNG tardaron 9,741 ms; 100 hashes de 4.096 celdas tardaron 26,481 ms, 0,2648 ms/hash, con hash `943344579`.
- Preservación de `FIXED`: las utilidades son puras respecto al estado de celdas; el hash solo lee una copia ordenada y no expone ninguna operación de reescritura o rollback. La integración con commits permanece fuera de alcance hasta #8/#9/#11.
- Pruebas: `npm run format:check`, `npm run check` (4 archivos, 21 tests), `npm run build`, `npm audit --omit=dev` y `git diff --check` verdes. Vectores fijos para seeds 0/máximo, separación por sistema/chunk, frames 30/60/144 con secuencia idéntica, hash independiente del orden y guardia de ausencia de `Math.random` en `src/wfc/`.
- Deploy y navegador: Sliplane desplegó `127c9e5` desde la rama de issue con `service_event_x0j48sgyco36`; servicio live, 20 logs recientes sin coincidencias de error, `/` y `/health` 200. Build local y preview remoto conservan calibración y eco `#000001` con consola limpia. WebM N/A: no existe flujo visual nuevo.
- Publicación y Project: PR #63 no draft, base `dev`, `MERGEABLE/CLEAN`, labels `codex`/`codex-automation` y CI `Check and build` terminal verde. Los cuatro criterios de #6 se marcaron completados; la issue permanece abierta con `status:in-review` y su tarjeta está en **In review**. La PR de issue no se fusionó.
- Evidencia: [`docs/progress/issue-6-deterministic-rng/`](./progress/issue-6-deterministic-rng/).
- Reversión: revertir los commits de #6 y devolver el preview a `dev`; no hay datos, migraciones, assets ni decisiones normativas que restaurar.

### 2026-08-05 — Issue #5 — Bitsets de 64 variantes y dominios sin asignaciones calientes

- Issue / PR / commits: issue #5; PR #62 (`dev` ← `codex/issue-5-bitset-domains`) desde `dev`/`main` `7be4649ece2a9a8f4bed40ff72653ef6cbf06478`; implementación `f2cbe674fc5b402331cb5e8a3124cb689945abfb`, documentación/evidencia `f00ae442b68721d0ae349e7e8d4d35cfe6291590` y commit final de publicación.
- Objetivo: representar cada dominio de terreno o feature con dos palabras de 32 bits y ofrecer las primitivas que necesitarán entropía, propagación, rollback y chunks.
- Decisiones: `MutableDomainMask` extiende el contrato público de lectura `DomainMask`; los constructores son las únicas operaciones que asignan objetos; `setBit`, `clearBit`, `assignMask`, `intersectInto` y `unionInto` mutan en sitio; `nextSetBit` reemplaza un iterador/generador asignante por un cursor numérico; todos los resultados de palabras se normalizan con `>>> 0`.
- Alternativas descartadas: `bigint`, porque no coincide con las dos palabras normativas ni con buffers futuros; `Set<number>`, por coste por celda; generadores y arrays de índices, porque asignarían en el camino caliente; cambiar `DomainMask` a mutable, porque expondría mutación a consumidores de contratos.
- Trade-offs: las guardas de rango se ejecutan en cada acceso público y solo asignan si lanzan por entrada inválida; priorizan una frontera defensiva ahora y pueden dividirse en variantes internas unchecked si un perfil real lo exige.
- Impacto: #7 puede consumir popcount/singleton/iteración cuando #6 complete determinismo; #8–#10 reciben operaciones in-place y detección de cambios sin adoptar todavía política de solver. No cambian mensajes, render, tiles ni comportamiento visible.
- Riesgos / deuda: todavía no existe almacenamiento contiguo por chunk; `MutableDomainMask` es una unidad lógica y #10 decidirá el layout físico sin alterar estas semánticas. La suite no usa medición de heap frágil: demuestra identidad estable y el código no crea colecciones en operaciones calientes.
- Pruebas: `npm run check` (3 archivos, 11 tests), `npm run build`, `npm audit --omit=dev` y `git diff --check` verdes. Se recorren exhaustivamente los 65 tamaños válidos y los 64 bits; 31, 32 y 63 tienen aserciones explícitas.
- Deploy y navegador: Sliplane desplegó `f2cbe67` desde la rama de issue con `service_event_0p9k5b3x5bmu`; `/` y `/health` responden 200. Build local y preview remoto mantienen shell, calibración y eco `#000001` con consola limpia. WebM N/A: la issue no añade interacción visual.
- Publicación y Project: PR #62 no draft, base `dev`, `MERGEABLE/CLEAN`, labels `codex`/`codex-automation` y CI `Check and build` terminal `SUCCESS`. Los cuatro criterios de #5 se marcaron completados; la issue quedó abierta con `status:in-review` y su tarjeta se movió manualmente a **In review**. #6 permanece en Backlog y #7 sigue bloqueada.
- Evidencia: [`docs/progress/issue-5-bitset-domains/`](./progress/issue-5-bitset-domains/).
- Reversión: revertir los commits de #5 y devolver el preview a `dev`; no hay datos, migraciones, assets ni cambios normativos.

### 2026-08-05 — Gate de promoción WP0 — Fundación y contratos

- Issues incluidas: #1–#4, integradas en `dev` mediante PRs #57–#60; no quedan PRs de issue abiertas, draft o bloqueadas de WP0. Project #2 muestra las cuatro tarjetas en **Done** y cero elementos en **In progress**/**In review**.
- Gate: `npm run format:check`, `npm run check` (typecheck, ESLint y cuatro tests), `npm run build`, `npm audit --omit=dev` y `git diff --check` en verde sobre `dev` `85a25857134d34fe0bea1d9f4e0c88def4c750f0`. La CI terminal de PR #60 también concluyó `SUCCESS`.
- Deploy: el preview existente se reconfiguró de la rama de issue a `dev` sin cambiar repositorio, Docker context, Dockerfile, puerto ni healthcheck. Sliplane desplegó `85a2585` con evento terminal `service_event_vqczlcrtcptd`; `/` y `/health` responden 200.
- Navegador: preview de `dev` verificado con shell, eco `#000001`, recursos same-origin y consola sin warnings/errores. El tablero autenticado confirma #1–#4 en Done.
- Decisiones acumuladas: conservar un único artefacto Vite/Nginx offline, contratos públicos en `src/contracts/`, worker separado y gate secuencial reproducible. La promoción no cambia comportamiento ni decisiones normativas.
- Impacto siguiente: una promoción `dev` → `main` mediante merge commit desbloquea WP1; #5 debe nacer de la igualdad exacta entre `main` y `dev` posterior a la promoción.
- Riesgos / deuda: TypeScript 6 continúa solo como alias de API para ESLint mientras `tsc` usa TypeScript 7; el scaffold visual y el worker eco son temporales hasta WP2/WP1. No hay datos, migraciones ni volúmenes.
- Reversión: revertir el merge commit de promoción en `main`; `dev` conserva el historial validado de WP0 y el preview puede apuntarse de nuevo al SHA anterior sin cambios de infraestructura.
- PR de promoción: #61 (`main` ← `dev`), no draft, `MERGEABLE/CLEAN`, labels `codex`/`codex-automation` y CI terminal `SUCCESS` sobre `aea5643` tras incorporar toda la evidencia previa al merge.
- Cierre: fusionada exclusivamente mediante merge commit `7be4649ece2a9a8f4bed40ff72653ef6cbf06478`. El head promovido `aea564332565d686af9a6b7cb9f31fa1b2d05f91` es ancestro de `main`; después `dev` avanzó por fast-forward y se verificó `dev` local = `origin/dev` = `origin/main` = `7be4649`.
- Evidencia: [`docs/progress/phase-WP0-promotion/`](./progress/phase-WP0-promotion/).

### 2026-08-05 — Issue #4 — Puerta reproducible de calidad y CI

- Issue / PR / commits: issue #4; PR #60 (`dev` ← `codex/issue-4-quality-gate-ci`); rama desde `dev` `9de883f12f64644a2a3b596d36372dc55aca32d1`; commit de implementación `d412bca2aad8c25e56f91efa7b365d1903a8acea` y commit documental posterior de evidencia/publicación.
- Objetivo: cerrar WP0 con un gate reproducible que bloquee cualquier cambio cuando fallen tipos, lint, tests, formato o build.
- Decisiones: Node 24.14.0 se fija en `.nvmrc`; Actions usa `checkout@v7`/`setup-node@v7` para no depender del runtime Node 20 obsoleto de v4; ESLint usa flat config y `--max-warnings=0`; Prettier dispone de `format` y `format:check`; `npm run check` ejecuta TypeScript, ESLint y toda la suite Vitest; GitHub Actions usa un único job secuencial con `npm ci`; `.gitattributes` normaliza LF.
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
