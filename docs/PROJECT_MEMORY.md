# Memoria técnica del proyecto

Este documento conserva la historia de implementación de **La Última Observación**. `AGENTS.md` es la autoridad normativa; esta memoria registra decisiones, evidencia y estado operativo sin sustituir ni borrar entradas anteriores.

## Vista de pájaro

Actualizado: 2026-08-14 (Europe/Madrid)

| Fase | Issues | Estado | Gate o dependencia principal |
|---|---:|---|---|
| WP0 — Fundación y contratos | #1–#4 | Completada y promovida | PR #61 fusionada; `main` y `dev` sincronizadas en `7be4649` |
| WP1 — Solver puro | #5–#11 | Integrada en `dev` | PR #66 fusionada; issues #5–#11 cerradas |
| WP2 — Render, cámara y física | #12–#14 | Integrada en `dev` | PR #66 fusionada; issues #12–#14 cerradas |
| WP3 — Gramática y tiles | #15–#22 | #15–#21 en `dev`; #22 en rama acumulativa | La release #51 ya permite revisar Tormenta |
| WP4 — Mundo observable | #23–#29 | Integrada en `dev` | PR #68 fusionada; dependencias WP6 cerradas |
| WP5 — Progresión y peligros | #30–#35 | Integrada en `dev` | PR #68 fusionada; Semillas, peligros y respawn disponibles |
| WP6 — Presentación | #36–#39 | Integrada en `dev` | PR #69 fusionada; audio, HUD, accesibilidad y narrativa local |
| WP7 — Final | #40–#43 | Integrada en `dev` | PR #70 fusionada; Reloj, retrato, haiku y ascenso final completos |
| WP8 — QA y entrega | #44–#51 | Integrada en `dev` | PR #70 fusionada; gates, evidencia y candidata reproducible |
| POST — Pulido de juego | #73 | Integrada en `dev` | PR #74 fusionada en `922f9e9` |
| POST — Seguridad física | #85 | Integrada en `dev` | `origin/dev` incluye `e7181d3` |
| POST — Limpieza del HUD | #87 | Integrada en `dev` | PR #88 fusionada en `423fc90` |
| POST — Rendimiento | #89 | Implementada en rama | `codex/issue-89-stable-fps` desde `origin/dev` `423fc90` |
| POST — Prólogo bilingüe | #91–#94 | Implementada en rama acumulativa | Localización, voz/ambientes y sala/briefing listos para PR a `dev` |
| POST — Media y mundo material | #96 | Implementada en rama | Audio autorizado, briefing 1080p, panorama completo, observación 20 m y texturas compartidas |
| POST — WFC2 integral | #98–#103 | Implementada en `codex/epic-98-wfc2-gameplay` | Solver real, fractura, vidas, arte, objetivos y QA hacia `dev` |
| POST — Biomas, detonación y portal | #105 | Implementada en rama | `codex/issue-105-visual-biomes-prologue` desde `origin/dev` `1f318b1` |
| POST — Final «Misión completada» | #107–#112 | Implementada; gate humano pendiente | Rama `codex/issue-107-mission-complete`; #112 permanece NO-GO |
| POST — Sala final, voz y fractura | #117 | Implementada en rama | `codex/issue-117-final-chamber-audio-fractures` desde `origin/dev` `e6553db` |
| POST — Tarjeta final y subtítulos | #120 | Implementada en rama | Captura previa a sala, captions centrados y PNG 1600 × 900 con resumen |
| POST — Expansiones | #52–#56 | En rama acumulativa salvo #54 | #54 ya estaba cerrada; #52, #53, #55 y #56 listas para revisión |

### Estado operativo actual

- Fase actual: épica #98 con issues #99–#103 desde `origin/dev` `cafe6b4`; la rama acumulativa es `codex/epic-98-wfc2-gameplay` y no se fusiona automáticamente.
- Contrato WFC2: terreno y feature salen de `COMPILED_GRAMMAR`, el worker publica dominios visibles, rotación y fracturas; los replays anteriores son intencionadamente incompatibles.
- Juego: una consecuencia forzada resuelve huecos visibles rodeados sin recursión; las bombas escalan del 1 % al 10 %, fracturan 15 m y consumen una de tres vidas. La tercera activa `LIVES_EXHAUSTED`.
- Presentación: Dr Alice Boole entrega la directiva bilingüe entre briefing y portal; HUD muestra cobertura, vidas y las cuatro Semillas en orden. Todas las voces y el retrato son assets locales.
- Arte/física: cinco variantes deterministas por familia frecuente, superposición alimentada por dominios reales y colliders próximos para rocas/features bloqueantes.

- Base integrada: #96 llegó a `dev` mediante PR #97; WFC2 parte del SHA `cafe6b4`.
- Trabajo en revisión: PR #84 reúne #22, #52, #53, #55, #56 y la revisión narrativa #76–#82, con un commit funcional por issue y destino `dev`.
- Arquitectura vigente: la build de jam sigue siendo offline. #56 solo muestra una variante remota si la publicación configura un proxy HTTPS y el jugador consiente en esa partida; ninguna clave de proveedor entra en el navegador.
- Evidencia actual: galerías/capturas locales, simulación de 10.000 seeds, WebM narrativo y QA automatizada bajo [`docs/progress/`](./progress/).
- Gate humano: #83 y el epic #75 permanecen abiertos y **NO-GO 0/5**; la rama no afirma sesiones que no se han realizado.
- Estado remoto verificado: PR #84 abierta y no draft; sus palabras de cierre excluyen deliberadamente #75 y #83.

### 2026-08-13 — Epic #107 / issues #108–#112 — Final «Misión completada»

- El clasificador concede la variante únicamente en modo estándar, por tiempo,
  con al menos una vida, Agua/Bosque/Ruina/Tormenta y 1536 celdas `FIXED` al
  finalizar. `FRACTURED` no cuenta y 1535 conserva el cierre normal.
- La ascensión de ocho segundos sigue intacta. Después, un vídeo VP9 local mudo
  de 32 segundos se sincroniza con Harper o Kore y captions HTML; puede omitirse
  desde tres segundos y degrada a cuatro WebP sin bloquear resultados.
- OpenRouter solo se usó para producción. Manifiestos locales registran prompts,
  IDs, hashes, loudness, descartes y coste acumulado de 4,573846 USD. La partida
  no contiene credenciales ni tráfico de runtime.
- El replay opt-in construye el límite exacto sobre `WorldState`. E2E completa
  EN/ES y fallback en Chromium/Firefox; vídeos y capturas viven en
  [`docs/progress/issue-112-mission-complete/`](./progress/issue-112-mission-complete/).
- `release:check` pasa 216 tests, validadores, 10.000 seeds/20.008 colapsos,
  build, 21 E2E y perfil dentro de límites; la auditoría informa cero
  vulnerabilidades. Docker Desktop no expone daemon local, así que el build de
  contenedor se delega a CI sin fingir una ejecución local.
- La automatización no sustituye calibración humana: #112 queda **NO-GO** hasta
  una partida real de diez minutos según
  [`docs/playtests/mission-complete/PROTOCOL.md`](./playtests/mission-complete/PROTOCOL.md).

### 2026-08-13 — Issue #117 — Sala de retorno, voz monofónica y cicatrices terminales

- `MISSION_VIDEO` deja de ser una capa a pantalla completa: tras el ascenso se
  crea una sala 3D de reintegración más tecnológica que la Cámara inicial y el
  VP9 local se reproduce en su pantalla física, con captions y omisión HTML.
- El reloj de la fase ya no finaliza la pieza por sí solo ni corrige
  continuamente `currentTime`. Vídeo y voz avanzan con sus relojes de medios y
  el resultado espera a que ambos terminen; fallos reales conservan WebP,
  captions y un watchdog acotado.
- `AudioDirector` no mantiene cola ni prioridad interruptiva. Si una voz está
  activa, el nuevo disparo se rechaza sin pausar ni encolar; `NarrativeDirector`
  no lo consume y una ocurrencia posterior puede volver a intentarlo. Las voces
  desactivadas siguen permitiendo subtítulos.
- `FRACTURED` queda excluido de la elegibilidad de superposición y la lista
  renderizada se purga en el mismo evento de fractura, sin esperar al muestreo
  visual de 10 Hz.

### 2026-08-14 — Issue #120 — Subtítulos y recuerdo final

- El caption del vídeo final conserva su franja inferior y añade centrado de
  layout, no solo centrado tipográfico dentro de una caja desplazada.
- La directiva inglesa visible cambia `fifteen metres` por `thirteen metres`
  para coincidir con la voz existente; audio y radio mecánico no cambian.
- La captura del mundo se congela al iniciar `ASCENDING`, mientras paisaje,
  frontera y detalles siguen visibles. La sala de retorno puede ocultarlos
  después sin aparecer como un cuadrado central en el resultado.
- El render descargable recupera su cámara ortográfica independiente. Un
  compositor Canvas 2D local añade el wordmark facetado aislado de la carátula,
  URL de itch.io, seed, cobertura sobre 4096 celdas, Semillas y muertes al PNG
  1600 × 900.
- El replay de evidencia materializa su umbral sintético con 1536 instancias
  repartidas por todos los biomas. La ruta normal no fabrica el paisaje: captura
  las celdas y features reales de la partida.
- Pruebas unitarias fijan el cálculo 1536/4096 = 37,5 %. La E2E Chromium mide
  el centro del caption, inspecciona las métricas y descarga el PNG real. La
  evidencia vive en
  [`docs/progress/issue-120-final-panorama-card/`](./progress/issue-120-final-panorama-card/).

### 2026-08-12 — Issue #105 — Biomas legibles, detonación y portal esférico

- La gramática compilada conserva `distanceCurve` y `neighborBias`. El contexto de pesos lee tags cardinales fijados; Agua recibe un multiplicador base de 1,5 y una búsqueda conectada acotada que favorece expansión hasta 16 celdas, cierre desde 17 y salida abierta desde 24. Bosque duplica como mínimo la afinidad entre árboles y frena al superar el 60 % local.
- Árboles, rocas y ruinas ofrecen cinco siluetas deterministas por definición. Las geometrías compuestas entran en lotes instanciados por familia/variante; árboles jóvenes y viejos, masas de roca, ruinas y detalles ocupan la mayor parte de sus celdas. Los colliders crecen con el volumen visual sin alterar reservas, corredores u origen.
- La bomba combina núcleo rojo y pinchos negros. `DETONATING` bloquea control durante 0,7 s y dibuja semiesferas/anillos amarillos, verdes y naranjas antes de fracturar y consumir una única vida. Movimiento reducido usa una cúpula y un anillo suaves.
- `livesExhausted` pasa por reproducción exclusiva de `AudioDirector`; la voz previa se cancela y el final por tercera muerte conserva texto sin lanzar una segunda voz.
- Alice Boole ocupa la pantalla 3D del briefing, comparte su filtro y deja de usar retrato superpuesto. El botón coral solo responde en `ROOM`, se apaga después, desaparece la repetición y una esfera blanca de radio 1,1 m inicia `RUN` sin abrir la pared.
- `release:check` pasa 209 tests, validadores, 10.000 seeds/20.008 colapsos, build, 15 E2E en Chromium/Firefox y perfil de 148 draw calls dentro de límites. La auditoría no encuentra vulnerabilidades. Docker Desktop no ofreció daemon local, pero la CI de la PR #106 construyó la imagen y terminó verde junto a simulación y recorrido Chromium.
- Evidencia real PNG/WebP y dos WebM reproducibles: [`docs/progress/issue-105-visual-biomes-prologue/`](./progress/issue-105-visual-biomes-prologue/).

### 2026-08-12 — Epic #98 / Issues #99–#103 — WFC2, fractura y objetivos operativos

- El solver simplificado se sustituye por dominios de terreno y feature derivados de la gramática compilada. La propagación cardinal, rollback de radio tres, rotación elegida y fallback compatible pertenecen al worker; el render ya no inventa resultados con un hash paralelo.
- Una celda visible dentro de 20 m rodeada por cuatro `FIXED` entra como una única consecuencia forzada. No genera una segunda búsqueda y `FRACTURED` nunca cuenta como borde fijado.
- `feature.consciousness-bomb` es el único enemigo. Su probabilidad marginal determinista sube por minutos completos de 1 % a 10 %, respeta origen/corredores/reservas y solo detona por contacto tras el 70 % del colapso.
- La explosión convierte los `FIXED` no protegidos a ≤15 m horizontales en `FRACTURED`, retira objetos/colliders, conserva Semillas y reduce cobertura. Las dos primeras muertes respawnean; la tercera congela el reloj y conserva panorama, perfil, haiku y seed.
- Seguridad de colapso: un feature bloqueante no activa su collider mientras el jugador permanezca a ≤2,5 m de su celda recién fijada; se activa al despejarla. La frontera no resuelta prioriza proxies y recibe todos los parches de dominio visibles, sin el antiguo recorte de 120 celdas.
- Cierre: el ascenso desactiva niebla, calcula una pose cenital desde los límites observados y reutiliza ese encuadre para el PNG local 1600 × 900 mostrado dentro de resultados.
- Narrativa v3: 60 cues por idioma, cadencia contextual de 20 s, avisos a cinco minutos, pistas tras Semillas, riesgo creciente de bombas, cobertura retrasada y saltos de roca. Los 32 clips nuevos conservan Harper/Kore, están normalizados y funcionan offline.
- Dr Alice Boole es un retrato original local con nombre HTML accesible. La directiva EN/ES, repetible y omitible tras tres segundos, precede al portal; la derrota reutiliza la transmisión. Cuatro clips nuevos se generaron con Harper/Kore, se normalizaron, transcribieron y registraron en el manifiesto.
- La presentación usa cinco variaciones visuales deterministas para árboles, rocas, arbustos, flores, setas y juncos; la superposición alterna todas las familias legales del `DOMAIN_PATCH`. Las rocas bloquean el paso a ras de suelo, admiten salto y no aparecen en corredores.
- Validación acumulada: 205 tests unitarios/integración, gramática/assets, 100 seeds con 20.011 colapsos sin vacíos/fallbacks/divergencias y E2E Chromium de inglés, español/fallback y final por tres vidas. La evidencia reproducible vive en [`docs/progress/wfc2-integral/`](./progress/wfc2-integral/).

### 2026-08-12 — Issue #96 — Audio, panorama completo y texturas ligeras

- El gesto inicial autoriza los elementos exactos de voz, briefing y cinco ambientes antes de cualquier `await`. La E2E ya no acepta un simple estado `ready`: comprueba reproducción, tiempo creciente y volumen efectivo.
- El vídeo local se recompone desde las siete láminas ya validadas como VP9 1920×1080, 50 s y 4,97 MB. Lanczos, sharpening y CRF 24 mejoran la lectura sin red, nuevas generaciones ni coste.
- La descarga final usa un render target ortográfico 1600×900. Sus límites salen de todas las celdas `FIXED`, por lo que ya no dependen de la posición o FOV de la cámara al terminar.
- La observación pasa de 10 a 20 m; carga y animación tardan la mitad. El vecindario sube a 11 celdas y la activación de chunks a 22 m para que el mundo se materialice delante del recorrido.
- Ocho texturas procedurales de 64×64 se comparten entre sala, terreno, agua, vegetación, roca, flores, semillas y peligros. El coste base es 128 KiB y el mundo fijado conserva un máximo de siete lotes instanciados.
- Validación local: 201 tests, TypeScript, ESLint, formato, build, gramática/assets, navegador Chromium/Firefox, PNG real y metadatos FFprobe. Evidencia: [`docs/progress/issue-96-media-panorama-textures/`](./progress/issue-96-media-panorama-textures/).

### 2026-08-11 — Epic #91 / issues #92–#94 — Prólogo bilingüe y nueva voz

- El arranque pasa por `LANGUAGE_SELECT → ROOM → BRIEFING → PORTAL → RUN`; el idioma se elige siempre, inglés es el valor inicial y el reloj permanece inmóvil hasta el primer colapso.
- La canción, 20 MP3 SAPI, generadores antiguos y registros de otros Colapsadores se retiran. `AudioDirector` usa master/voz/ambiente/efectos, expone estado y reintento y reproduce como máximo 22 de 44 cues por idioma, todos locales.
- OpenRouter produjo 44 voces EN con `microsoft/mai-voice-2`/Harper y 44 ES con `google/gemini-3.1-flash-tts-preview`/Kore. Dos narraciones segmentadas de 50 s comparten timeline; 90 clips de voz pasan transcripción y 95 assets pasan loudness.
- Veo 3.1 Lite generó siete planos sin audio. Tres tomas con texto accidental se rechazaron y sustituyeron tras inspección de hoja de contactos. El WebM final es VP9 1280×720, 50 s, sin audio, 5,49 MB; coste de vídeo reportado acumulado: 2,16 USD.
- El runtime final de audio+vídeo ocupa 12.649.765 bytes, no contiene credenciales ni llamadas remotas y conserva fallbacks WebP/captions. `check` pasa 51 archivos/199 tests y E2E pasa 12/12 en Chromium/Firefox, incluido fallo forzado del WebM en español.
- Evidencia reproducible: [`docs/progress/issue-94-bilingual-prologue/`](./progress/issue-94-bilingual-prologue/). #75/#83 permanecen abiertos en **NO-GO 0/5**; no se inventan playtests y #87 queda fuera del alcance de esta entrega.

### 2026-08-10 — Issue #89 — FPS estable y degradación adaptativa

- El perfil reproducible encontró el cuello real en GPU/postprocesado: Chromium con SwiftShader, 1440×900, DPR 1,5 y CPU 2× produjo 0,79 FPS en el automático anterior. El mismo escenario documentado termina en 49,39 FPS, con repeticiones de hasta 53,27 FPS; un arranque forzado en alto se degradó hasta bajo y alcanzó 56,92 FPS.
- La ruta baja limita DPR a 1×, puede reducir escala hasta 0,35 y evita enteramente `EffectComposer`, bloom y SSAO. Automático agota primero la resolución y después baja alto → medio → bajo si persisten frames de más de 30 ms.
- El mundo fijado ya no conserva geometría/material por celda: las animaciones siguen siendo meshes transitorios, pero cada commit completado entra en un máximo de siete lotes `InstancedMesh`. La prueba fija 256 celdas y mantiene ese límite.
- `WorldState` mantiene el recuento fijo en O(1), ofrece lectura caliente sin snapshots y reutiliza centros; el bridge cachea vecindarios. Superposición/HUD se actualizan solo cuando toca o cambia su valor, y el vector de cámara deja de asignarse por frame.
- La norma de render de `AGENTS.md` amplía el rango a 0,35–1,0 sobre DPR limitado por preset y exige que bajo no pague pases desactivados. No cambian solver, ticks, seed, física, contenido ni comportamiento offline.
- Validación: 189 tests, build, formato, lint, validadores, simulación de 100 seeds/5.100 colapsos con todos los fallos a cero, 12/12 E2E Chromium/Firefox y auditoría sin vulnerabilidades. Evidencia: [`docs/progress/issue-89-performance/`](./progress/issue-89-performance/).

### 2026-08-10 — Issue #87 — Mensajes solo abajo y centro despejado

- El panel de candidatos `SUPERPOSICIÓN` deja de ocupar la retícula. La carga y los proxies del mundo siguen comunicando el estado procedural sin cubrir el punto de atención.
- El HUD superior conserva únicamente tiempo y seed. Narrativa, registros del Colapsador y mensajes breves de gameplay comparten ahora un único subtítulo en la franja inferior, respetando la opción de subtítulos.
- La regresión de navegador exige cero paneles `.possibility-probabilities`, cero slots `[data-slice-message]`, dos bloques superiores y un subtítulo visible por debajo de la mitad del viewport.
- Evidencia: [`docs/progress/issue-87-hud-cleanup/hud-messages-bottom.jpg`](./progress/issue-87-hud-cleanup/hud-messages-bottom.jpg).

### 2026-08-10 — Issue #85 — Suelo y contención física continua

- La simulación del cuerpo ya no avanza durante la introducción: solo comienza tras una calibración válida y cada calibración completada recoloca cuerpo y cámara en el origen seguro.
- Rapier sigue resolviendo suelo, paredes y deslizamiento. Una envolvente final impide que un estado inválido deje la base de la cápsula bajo `y = 0` o que su borde exterior supere el radio interior de 62 m.
- El límite radial proyecta únicamente la componente exterior, por lo que conserva movimiento tangencial contra la cúpula. Las pruebas recorren 16 ángulos, incluidos los encuentros entre segmentos, y recuperación desde coordenadas fuera del suelo y del mapa.

### 2026-08-09 — Issue #56 — Variante remota de haiku

- La función está ausente por defecto y solo aparece con `VITE_REMOTE_HAIKU_ENDPOINT` HTTPS. El consentimiento es explícito, desmarcado y válido para una única petición al terminar la partida.
- El payload contiene perfil y métricas redondeadas; excluye seed, ruta, coordenadas, muertes, panorama y haiku local. El transporte omite credenciales/referrer, valida tres líneas y expira a los 4 s.
- Error, timeout o respuesta inválida conservan el expediente y el haiku local determinista. No hay clave de modelo en el cliente; la política operativa exige proxy, retención declarada y tope de coste.
- Evidencia y contrato: [`docs/progress/issue-56-remote-haiku/`](./progress/issue-56-remote-haiku/) y [`docs/privacy/REMOTE_HAIKU.md`](./privacy/REMOTE_HAIKU.md).

### 2026-08-09 — Issue #22 — Pack Tormenta post-release

- La candidata ya publicada desbloquea el stretch pack: Charged Soil, Glass Ground, Scorched Meadow, Crystal, Spikes y Uncertainty Nest entran como contenido local con LOD y sin red.
- Scorched Meadow conecta por `OPEN_FLAT`; los peligros solo aparecen desde 38 m y respetan corredores/anclas. Cristal usa un pulso suave de 2,5 s y queda estático con destellos reducidos.
- `validate:tiles`, `validate:assets` y la campaña de 10.000 seeds pasan sin vacíos, divergencias, commits fuera de radio, fallbacks, `quantum_void_debug` ni anclas inaccesibles. Evidencia: [`docs/progress/issue-22-storm-pack/`](./progress/issue-22-storm-pack/).

### 2026-08-09 — Issue #52 — Panorama PNG y galería local

- El panel final no espera a la captura: tras el render, el canvas produce un PNG descargable con seed, perfil y haiku asociados.
- IndexedDB conserva como máximo cinco panoramas de hasta 5 MiB, elimina el más antiguo y ofrece descarga/borrado. No hay subida, telemetría ni permiso externo.
- Playwright descargó y validó una captura real 1216×68 de 228.167 bytes y reabrió sus metadatos desde la galería. Evidencia: [`docs/progress/issue-52-local-panorama/`](./progress/issue-52-local-panorama/).

### 2026-08-09 — Issue #53 — Seed diaria compartida

- `?daily=1` deriva la seed exclusivamente de la fecha UTC con el hash estable del proyecto; la misma fecha produce el mismo mundo sin backend.
- La portada alterna de forma explícita entre diaria UTC y observación estándar aleatoria. Seed explícita y replay canónico tienen rutas deterministas separadas.
- HUD, expediente y copia etiquetan el modo diario con fecha UTC. Vitest cubre la medianoche y Playwright la recarga/replay. Evidencia: [`docs/progress/issue-53-daily-seed/`](./progress/issue-53-daily-seed/).

### 2026-08-09 — Issue #55 — Bioma Jardín de Eco

- Seis definiciones post-jam amplían Tormenta: Echo Moss, Prism Soil, Echo Clearing, Bell Flower, Mirror Reed y Memory Stone. No añaden quinta Semilla, sockets, peligros ni red.
- Las tres tiles conectan con `OPEN_FLAT`; la gramática queda en 43 variantes de terreno y 22 de feature. Seis proxies con LOD pesan menos de 10 KiB.
- El unlock Tormenta solo afecta chunks futuros: la prueba conserva `paletteEpoch`, packs y celdas de un chunk previo. La galería real y la campaña de 10.000 seeds están en [`docs/progress/issue-55-echo-garden/`](./progress/issue-55-echo-garden/).

### 2026-08-09 — Issue #76 — Canon QBista y límites científicos

- La narrativa separa QBism real, doctrina ficticia de la Agencia y WFC como metáfora procedural. El jugador elige una intervención; La Medida expresa expectativas y el resultado se incorpora a un expediente, sin afirmar que la conciencia cause un colapso físico.
- `AGENTS.md` 1.1 fija Agencia, Cámara de Silencio, Condensado de Posibilidad, Colapsador, cuerpo de campo, La Medida y resultado no reconciliado, además del tono administrativo-poético.
- [`docs/narrative/QBISM_CANON.md`](./narrative/QBISM_CANON.md) documenta referencias primarias, licencias científicas, glosario editorial y una prueba de consistencia para el copy posterior. No cambia solver, reloj, movimiento ni runtime.

### 2026-08-09 — Issue #77 — Introducción y calibración de conciencia

- La pantalla existente presenta Cámara, Condensado, cuerpo de campo, certificación provisional y el contrato “elige la pregunta, no la respuesta” en cuatro beats automáticos de 18 s como máximo.
- “Aceptar y calibrar” y “Omitir introducción y calibrar” nacen de un gesto real y entran directamente en el flujo transaccional de Pointer Lock. El fallo conserva el mundo visible y el reintento; el reloj sigue esperando al primer colapso.
- La máquina de estados y las pruebas cubren reproducción determinista, omisión, línea obligatoria y camino E2E de un solo gesto.

### 2026-08-09 — Issue #78 — Catálogo reactivo de La Medida

- `narrative.json` es ahora un catálogo localizable `es-ES` con evento, hablante, texto, fallback, prioridad, duración y política de repetición por cue.
- Colapso inicial, cuatro Semillas, primera muerte, respawn, detección/reconciliación de Incertidumbre, cuenta atrás y final se conectan por IDs tipados; progresión y respawn ya no contienen copy narrativo disperso.
- `NarrativeDirector` valida unicidad, orden, prioridades y fallback, emite subtítulo/audio con la misma duración y conserva una historia determinista para tests y replay.

### 2026-08-09 — Issue #79 — Registros automáticos de otros Colapsadores

- Cuatro registros locales se activan por celdas fijadas, Semillas y distancia. Dos describen resultados incompatibles en 64,58 y la Agencia los clasifica como “variabilidad de usuario”.
- Cada registro declara hablante, subtítulo, duración, prioridad y umbrales de replay; no añade coleccionables ni interacción obligatoria.
- La cola admite como máximo dos pendientes, reproduce una vez y omite/interrumpe de forma segura ante muerte, Semilla, últimos 30 s o final. La misma secuencia de métricas produce el mismo orden.

### 2026-08-09 — Issue #80 — La Incertidumbre como resultado no reconciliado

- Copy, HUD y canon presentan las tres siluetas como informes incompatibles de otro Colapsador. La etiqueta “Incidencia de actualización pendiente” evoluciona hasta “Resultado reconciliado” al fijarse como estatua.
- La línea de detección y la reconciliación ya pertenecen al catálogo tipado. No cambian estados, distancias 18/8 m, 1,2 s de observación, gracia 0,4 s, recompensa +3 s, pathfinding, spawn ni máximo cuatro.

### 2026-08-09 — Issue #81 — Expediente QBista del agente

- El panel final conserva ascenso de 8 s, bloqueo de commits, seed, perfil, haiku y cálculos. La presentación se renombra “Expediente de actualización del agente” y explica que La Medida registraba intervenciones, expectativas y experiencias.
- Resultados, formas, familias desbloqueadas y distancia se presentan como decisiones de atención, sin puntuación, ranking ni diagnóstico. La nota final de la Agencia conserva la ambigüedad con humor administrativo.
- El diálogo recibe foco, nombre accesible y botones de teclado; la copia incluye expediente, lectura, interpretación, seed, perfil, haiku y nota institucional.

### 2026-08-09 — Issue #82 — Voces locales, mezcla y procedencia

- 20 líneas aprobadas de introducción, eventos y Colapsadores se sintetizan reproduciblemente con Microsoft Helena Desktop `es-ES` y se procesan con FFmpeg a MP3 mono 24 kHz/56 kbps. El total es 1.030.044 bytes.
- `AudioDirector` añade bus de voz, cola máxima de dos, prioridad e interrupción, ducking suave de música y fallback silencioso a subtítulos. Las voces pueden desactivarse sin afectar texto, música ni efectos.
- [`docs/audio/narrative-voices.md`](./audio/narrative-voices.md), créditos y `ASSET_PROVENANCE` registran fuente, proceso, edición, licencia y verificación FFprobe. No hay TTS ni red en runtime.

### 2026-08-09 — Issue #83 — QA automatizada y gate humano

- La suite cubre catálogo, disparadores, introducción/omisión/reintento, Semillas, muerte, registros, Incertidumbre, expediente final, voces locales, consola y orígenes de red.
- El navegador embebido verificó visualmente introducción y recuperación real ante rechazo de Pointer Lock; Playwright ejecuta el recorrido determinista en Chromium y Firefox.
- La transición de cierre marca `ending` antes de deshabilitar el input para impedir que una pérdida de Pointer Lock abra la pausa durante el ascenso. El modo de evidencia evita solicitar Pointer Lock sin alterar la ruta normal.
- [`docs/progress/qbism-narrative/`](./progress/qbism-narrative/) conserva cuatro capturas reales y un WebM/VP8 verificado con FFprobe (800×450, 25 fps, 62,560 s, 3.641.437 bytes).
- El gate humano permanece **NO-GO 0/5** en [`docs/playtests/qbism-narrative/REPORT.md`](./playtests/qbism-narrative/REPORT.md). No se cierra #83 ni el epic #75 hasta alcanzar los umbrales con sesiones reales.

## Registro cronológico

### 2026-08-09 — Issue #73 — Calibración, música y legibilidad del recorrido

- Base: rama `codex/issue-73-gameplay-polish` creada desde la `origin/dev` exacta `9a82adedb36b67034d461d83e64788c095e78195`.
- Calibración: Pointer Lock es el único gate transaccional; si el navegador rechaza o no confirma la captura, la escena permanece visible, el botón pasa a reintento y una segunda pulsación puede completar el flujo. El arranque de audio es asíncrono y nunca deja una pantalla negra.
- Audio: se eliminan los osciladores musicales continuos y los stems sintéticos. «La función que nos mira» se generó en dos pasos con OpenRouter (letra y después Lyria), se seleccionó entre dos tomas y se empaqueta como MP3 local de 2:58. Las llamadas de runtime siguen siendo cero.
- Mundo y control: 64 colliders tangenciales forman un límite circular de 62 m, acompañado por una esfera visual sutil; caminar y correr bajan un 40 %, a 2,52 y 3,72 m/s.
- Superposición: las posibilidades visibles exponen porcentajes deterministas, ordenados y normalizados para sumar exactamente 100; calidad baja conserva dos candidatos y el resto hasta tres.
- QA: pruebas unitarias cubren audio sin oscilador de fondo, MP3 real, normalización de porcentajes, velocidades y colisión Rapier. Playwright reproduce rechazo, reintento y recuperación en Chromium real; Firefox headless usa un shim de Pointer Lock acotado al test y conserva las mismas aserciones de estado.
- Evidencia y procedencia: [`docs/progress/issue-73-gameplay-polish/`](./progress/issue-73-gameplay-polish/) y [`docs/audio/la-funcion-que-nos-mira.md`](./audio/la-funcion-que-nos-mira.md).

### 2026-08-06 — Issue #71 — Hotfix del build Docker tras WP8

- Incidente: el despliegue de `dev` en Sliplane falló durante `npm run build` con `TS5058` porque PR #70 añadió `tsconfig.tools.json` al typecheck, pero la etapa Docker seguía copiando solo `tsconfig.json`.
- Corrección: la etapa de build copia ambos proyectos TypeScript y todas sus entradas (`scripts`, `tests`, configuraciones Playwright y `public`) antes de ejecutar el mismo `npm run build` que en local.
- Prevención: CI construye también la imagen de despliegue después del build Vite, de modo que cualquier futura divergencia entre scripts y contexto Docker bloquee la PR.
- Validación local: `npm run check` (40 archivos, 159 tests), `validate:tiles`, `validate:assets`, `npm run build`, `format:check` y `git diff --check` en verde. Docker Desktop no está disponible en esta máquina; la construcción real de la imagen queda como evidencia del job remoto añadido.
- Alcance: no cambia gameplay, solver, contenido, assets ni configuración de Sliplane; solo repara y protege el artefacto de despliegue.

### 2026-08-06 — Entrega acumulativa WP7 y WP8

- Secuencia: #40 RunClock; #41 retrato; #42 haiku; #43 ending/resultados; #44 suite; #45 replay/debug; #46 simulación; #47 E2E/matriz; #48 rendimiento; #49 balance; #50 offline/créditos/itch; #51 checklist y candidata.
- Final: el reloj estándar dura 600 s desde el primer colapso, pausa por menú, pestaña oculta y Semilla, nunca por muerte, y bloquea observación/commits a cero. El ascenso dura ocho segundos y termina en perfil cualitativo, haiku local determinista, seed, copia y reinicio limpio.
- QA: 159 tests, fixtures rojos de gramática, límites de ending, replay headless a 10 Hz, F2/F3/F4 solo en desarrollo y campaña de 10.000 seeds con cinco rutas; 0 vacíos, 0 commits fuera de radio, 0 hashes divergentes, fallback 0 %, `quantum_void_debug = 0` y 0 Semillas inaccesibles.
- Navegador: Chromium 1440×900, Firefox 1280×720 y Chrome estable 1920×1080 completan el recorrido sin errores ni red fallida. Firefox compara el panel final con tolerancia 0,035. Edge y GPU integrada física quedan declarados no disponibles/pendientes, nunca aprobados sin ejecución.
- Rendimiento: harness de release con worker p95 2,88 ms, main p95 9,32 ms, 60 FPS estimados, 148 draw calls, 882.000 triángulos, 228 MB de texturas, `dist` 8,62 MB y TTI 3,1 s; cumple objetivos y conserva el orden normativo de degradación.
- Entrega: build estática offline, créditos/procedencia/privacidad/itch, ZIP y manifest SHA-256 reproducibles. Evidencia en [`docs/progress/wp7-wp8-release/`](./progress/wp7-wp8-release/) y documentación de release en [`docs/release/`](./release/).

### 2026-08-06 — Entrega acumulativa WP6

- Secuencia: #36 dirección visual y VFX; #37 `AudioDirector`, buses, pool y stems; #38 HUD, onboarding, pausa y opciones; #39 narrativa española local.
- Render: `WorldPostprocessing` aplica bloom por umbral en medio/alto y SSAO solo en alto; `ProceduralVegetationField` usa una única geometría/material instanciados y densidad 48/104/160; el colapso conserva su duración normativa y transita de emisión oro a material fijo.
- Audio: no se crea `AudioContext` antes del gesto; master, música y SFX tienen ganancias independientes; los cuatro packs desbloquean stems persistentes; observación, colapso, entorno, cuenta atrás e Incertidumbre tienen firmas separadas; el pool rechaza una novena voz.
- UX: Escape libera Pointer Lock y abre pausa, la pestaña oculta detiene loop/reloj, R exige dos segundos, los subtítulos y destellos reducidos vienen activos, y calidad/contraste/sensibilidad/volúmenes se aplican sin alterar el solver.
- Narrativa: inicio, primer unlock, primera muerte, últimos treinta segundos y final conservan literalmente el texto canónico; Bosque, Ruina y Tormenta añaden una sola línea cada uno; toda intervención funciona sin voz y no bloquea control.
- Validación: `npm run format:check`, `npm run check` (33 archivos, 138 tests), `npm run build`, `npm audit --omit=dev` (0 vulnerabilidades), `git diff --check`, replay local completo y consola sin warnings/errores.
- Evidencia: [`docs/progress/wp6-presentation/`](./progress/wp6-presentation/) contiene tres capturas WebP y WebM VP9 de 12 s verificado con `ffprobe`.

### 2026-08-05 — Implementación técnica WP5 detrás del gate #29

- Secuencia: #30 plan macro y corredores; #31 Semillas, HUD y epochs; #32 curvas de rareza/peligro; #33 peligros estáticos seguros; #34 La Incertidumbre; #35 muerte y respawn persistente.
- Integración: `Wp5PreviewRuntime` coordina los seis sistemas y `Wp5PreviewVisuals` los representa sin importar internals del solver/render. El recorrido normal no cambia; el preview exige `?wp5=preview` y mantiene visible `#29 NO-GO`.
- Verificación: 100 seeds del plan macro, unitarias e integración dedicadas, typecheck, lint, build de producción y navegador local sin errores ni warnings.
- Estado del gate: #30–#35 están implementadas para revisión técnica, pero #29 sigue en 0/5. No se afirma GO, no se fabrican sesiones y no se activa WP5 por defecto.
- Evidencia: cuatro capturas WebP y vídeo VP9 de 17 s en [`docs/progress/wp5-gameplay/`](./progress/wp5-gameplay/).

### 2026-08-05 — Entrega acumulativa WP4

- Secuencia: #23 estado/celdas/chunk views; #24 visibilidad/carga; #25 proxies; #26 commit físico; #27 integración worker/bordes/unlocks; #28 vertical slice; #29 instrumentación de playtest sin fabricar sesiones.
- Slice: 90 s desde la primera fijación, seed `A91F-42C0`, Agua futura, muerte/respawn persistente, ascenso de ocho segundos, cierre y haiku local.
- Verificación: typecheck, tests focalizados, build de producción, navegador a 1280×720 sin errores y WebM verificado con `ffprobe`.
- Estado del gate: #23–#28 listas para revisión; #29 permanece abierta en 0/5 y bloquea el avance dependiente.
- Evidencia: [`docs/progress/wp4-observable-world/`](./progress/wp4-observable-world/) y [`docs/playtests/wp4-vertical-slice/`](./playtests/wp4-vertical-slice/).

### 2026-08-05 — PR #67 — Pipeline acumulativo WP3

- Issues implementadas en orden: #15 schemas/compilación; #16 gramática base; #17 `validate:tiles`; #18 galería/`validate:assets`; #19 Agua; #20 Bosque; #21 Ruina. Cada issue corresponde a un commit funcional separado publicado sobre la misma PR.
- Contenido activo: 20 definiciones de terreno que compilan a 37 variantes rotadas y 16 features; Base, Agua, Bosque y Ruina permanecen por debajo del máximo de 64 por capa.
- Seguridad y continuidad: Meadow A/B comparten sockets pero no visual; Quantum Meadow/Slab son fallbacks caminables; Agua conserva Deep→Shallow→Shore→Marsh→`OPEN_FLAT`; Bosque y Ruina incluyen adaptadores, soporte y exclusión de corredores.
- Tooling: `npm run validate:tiles` y `npm run validate:assets` forman parte de CI; el visor offline filtra packs/capas, rota sockets y exporta un SVG determinista.
- Pruebas: `npm run check` (19 archivos, 95 tests), ambos validadores, `npm run format:check`, `npm run build` y `git diff --check` verdes. La galería de producción mostró 36 cards y cero errores.
- Alcance diferido: #22 sigue abierta/bloqueada por #51 y no se simula como completada; implementarla antes de la release violaría su propia dependencia y `AGENTS.md`.
- Evidencia: [`docs/progress/wp3-tile-grammar/`](./progress/wp3-tile-grammar/).

### 2026-08-05 — PR #66 — Cierre acumulativo de WP1 y WP2

- Alcance y secuencia: la rama `codex/wp1-wp2-foundations` nació de `origin/dev` `2ddb78d3023115173fa40f3686ec1b11866131a7`, que ya contenía #5–#8. Implementó en orden #9 (`d81837c`), #10 (`3bf658d`), #11 (`28e2930`), #12 (`ec9a0ab`), #13 (`725a9ac`) y #14 (`b23b22f`), actualizando una única PR #66 contra `dev` después de cada corte.
- #9 — transacciones: snapshots de la región mutable de radio tres que excluyen `FIXED`, hasta ocho candidatos ponderados, restauración exacta entre intentos, commit solo tras propagación válida y fallback compatible sin revelar candidatos deshechos.
- #10 — chunks: mapa lógico 64×64 dividido en chunks 16×16, activación a 18 m, descarga visual a más de 42 m sin borrar estado, `paletteEpoch` congelado al inicializar y restricciones cardinales serializadas para vecinos activos o futuros.
- #11 — solver incremental: `SolverCore` puro dentro del worker, entrada cuantizada a 10 Hz, máximo un commit principal cada 90 ms, elegibilidad validada contra la posición real a ≤10,01 m y trabajo pendiente reanudable con presupuesto de 4 ms. La simulación headless de 100 seeds no produce dominios vacíos ni `quantum_void_debug`.
- #12 — render: contexto WebGL2 explícito, cámara normativa a 70°/1,70 m, ACES, sombras, atmósfera, presets bajo/medio/alto/automático y DPR dinámico entre 0,7 y 1,0 sin alterar resultados del solver.
- #13 — jugador: WASD/flechas, correr, salto, sensibilidad/inversión Y, Pointer Lock, pausa y recuperación; cápsula Rapier, pendiente máxima de 38°, velocidades normativas y prueba de colisión real contra muro.
- #14 — visuales: `InstancedMesh` por familia con geometría/material compartidos, buffers marcados para actualización, pools reutilizables, leases de GLB local, streaming visual desacoplado del estado lógico y límite estable de 120 proxies. El shell usa 256 detalles de hierba deterministas en una familia instanciada.
- Validación acumulativa: `npm run check` (12 archivos, 71 tests), `npm run build`, `npm run format:check`, `npm audit --omit=dev` (0 vulnerabilidades) y `git diff --check` correctos. El benchmark de #14 actualiza 1.000 matrices en un único `InstancedMesh` con media de 0,3111 ms; la CI `Check and build` de PR #66 terminó `SUCCESS` en 24 s.
- Navegador y evidencia: build local cargado a 1280×720, campo instanciado visible, transición `EN ESPERA` → `CALIBRADA`, Pointer Lock adquirido y consola sin errores de aplicación. El vídeo VP9 dura 6 s a 1280×720; las dos capturas WebP conservan los estados anterior y posterior. Véase [`docs/progress/wp1-wp2-foundations/`](./progress/wp1-wp2-foundations/).
- Estado remoto: PR #66 abierta, no draft, base `dev`, `MERGEABLE/CLEAN`, head local/remoto idéntico. Las issues #9–#14 permanecen abiertas y enlazadas con `Closes`; se cerrarán al integrar la PR, no manualmente.
- Riesgos / deuda: el bundle de producción avisa de chunks superiores a 500 kB por Three.js/Rapier; el build es válido, pero WP8 deberá perfilar y dividir carga si compromete el tiempo hasta jugar. La escena visual sigue siendo una fundación: gramática, proxies de superposición y mundo observable pertenecen a WP3/WP4.
- Reversión: revertir los seis commits de PR #66 en orden inverso. No hay migraciones, datos persistentes ni infraestructura que restaurar; los artefactos de evidencia son documentación eliminable de forma independiente.

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
