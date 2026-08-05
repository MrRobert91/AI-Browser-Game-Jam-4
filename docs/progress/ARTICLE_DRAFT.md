# Borrador técnico — Cómo se construyó La Última Observación

## Una especificación ejecutable antes que un prototipo

La construcción empezó fijando una fuente de verdad normativa. `AGENTS.md` no es una lista de ideas: define comportamiento observable, contratos públicos, presupuestos, gates y orden de implementación. Ese punto de partida evita que el prototipo derive hacia un WFC volumétrico, un mundo infinito o un render que solo funcione con WebGPU.

![La especificación entra en el repositorio](./issue-1-publish-agents/pr-57-published.webp)

## Un flujo autónomo con trazabilidad completa

Cada issue nace de la `dev` remota exacta, se reclama en GitHub Project, se implementa en una rama `codex/issue-*` y termina en una PR no draft contra `dev`. La automatización no fusiona PRs de issue: espera una integración externa, reconcilia la issue y solo entonces selecciona trabajo nuevo. Tests, navegador, Sliplane y memoria forman parte de la entrega, no son comprobaciones opcionales posteriores.

## WP0: de documento a artefacto desplegable

WP0 se dividió en cuatro cortes pequeños. Primero entró la autoridad de producto; después un shell Vite + TypeScript estricto y offline; a continuación, contratos públicos y un worker real con eco numerado; por último, un gate reproducible de formato, tipos, lint, tests, build y CI.

La decisión arquitectónica más importante fue mantener separadas las fronteras desde el principio. El main thread solo conoce `src/contracts/`; el worker valida mensajes en ambos sentidos y transfiere buffers sin copia. Todavía no existe solver, pero ya existe el canal por el que deberá comunicarse.

![Primer shell desplegable](./issue-2-vite-shell/shell-local.webp)

![Contrato worker visible](./issue-3-public-contracts-worker/worker-echo-local.webp)

## Preview continuo sin convertirlo en producción

Sliplane aloja un único servicio preview reutilizable, construido desde el Dockerfile del repositorio y servido por Nginx en el puerto 8080. Cada PR relevante apunta temporalmente el servicio a su rama; el gate de fase lo devuelve a `dev`. La verificación combina evento terminal de despliegue, logs, `/health`, HTTP real y una carga en navegador con consola limpia.

## El gate de fase como frontera de confianza

WP0 solo se promociona cuando #1–#4 están cerradas mediante PRs integradas en `dev`, no hay trabajo de la fase en revisión, CI termina verde, `dev` compila y el preview funciona. La promoción es una PR especial `dev` → `main` con merge commit; después ambas ramas vuelven a compartir el mismo SHA antes de iniciar WP1.

![WP0 completo en el tablero](./phase-WP0-promotion/project-wp0-done.webp)

![Preview de dev durante el gate](./phase-WP0-promotion/preview-dev-gate.webp)

## Próximo capítulo

WP1 sustituirá el eco por el núcleo determinista: bitsets de 64 variantes, PRNG/hash, entropía, propagación FIFO, transacciones, chunks y presupuesto incremental. El objetivo es que el solver sea verificable sin render antes de hacerlo visible en el mundo 3D.

## WP1 empieza por la representación, no por el algoritmo

El primer cambio de WP1 no intenta colapsar una celda. Define cómo se guardarán hasta 64 posibilidades sin crear un `Set` por terreno y otro por feature. Cada dominio usa `lo` y `hi`; las operaciones de set, clear, unión, intersección y copia mutan el objeto propiedad del solver. Un cursor `nextSetBit` permite recorrer candidatos sin construir arrays ni generadores.

La suite cubre todos los tamaños de máscara entre 0 y 64, cada bit individual y las fronteras donde JavaScript cambia de palabra o signo: 31, 32 y 63. Esta base pequeña importa porque propagación y entropía ejecutarán estas funciones miles de veces por segundo; una representación correcta evita que decisiones posteriores tengan que compensar deuda de memoria.

![Issue #5 reclamada en WP1](./issue-5-bitset-domains/project-initial.webp)

## El determinismo se diseña antes de observar

Con los dominios ya representados, el siguiente paso no fue calcular entropía: fue eliminar cualquier dependencia implícita del reloj y de la aleatoriedad ambiental. Cada subsistema y chunk deriva su propia seed de 32 bits a partir de la seed del mundo. El PRNG avanza únicamente en ticks completos de 100 ms; por eso una ruta renderizada a 30, 60 o 144 FPS produce la misma secuencia.

El hash final sigue una regla distinta a la generación: ordena las celdas fijadas por identidad y resume seed, terreno y feature. Así, el resultado describe el mundo final y no el orden accidental en el que sus celdas entraron en la colección. La versión del hash está etiquetada desde el inicio para que futuras ampliaciones no reinterpreten silenciosamente resultados antiguos.

![La issue determinista entra en progreso](./issue-6-deterministic-rng/project-initial.webp)

![El preview conserva el shell y el worker](./issue-6-deterministic-rng/sliplane-browser.webp)

![El cambio determinista queda listo para revisión](./issue-6-deterministic-rng/pr-63-published.webp)
