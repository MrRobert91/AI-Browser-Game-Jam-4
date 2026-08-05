# Issue #8 — Compatibilidad cardinal y propagación FIFO

Registro reproducible de implementación y evidencias de la issue #8.

## Estado inicial

- Base exacta: `dev` en `4dd07958e6364e363ae611f2561b4a0deb4dbe9e`.
- Dependencia #7 cerrada tras integrar la PR #64 en `dev`.
- Project #2: #7 en Done; #8 en Backlog antes de reclamarla.

## Implementación

- `src/wfc/compatibility.ts`: compilación y reciprocidad N/E/S/W.
- `src/wfc/propagation.ts`: cola circular reutilizable, intersección monotónica, entropía solo al cambiar y contradicción sin mutar `FIXED`.
- `src/wfc/ascii.ts`: mapa determinista de dominios para pruebas y depuración.
- `tests/unit/propagation.test.ts`: siete pruebas de compatibilidad, cola, propagación, contradicción y ASCII.
- `tests/benchmarks/propagation.bench.ts`: tablero alterno 64×64.

Commit de código: `2eb97c7688bd09218a390146dc3223b0adf1a622`.
Commit de memoria/evidencia inicial: `39abaa6ca5da26a8ca6d8df1ef67fa3d68c90edb`.

## Validación

- `npm run format:check`: verde.
- `npm run check`: 6 archivos, 38 tests, verde.
- `npm run build`: verde.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `git diff --check`: verde.
- Benchmark Node 24: 1.094,92 ops/s; media 0,9133 ms; p99 1,4249 ms.
- Seed/hash: `0xA91F42C0` / `3069527348`, sin cambios.
- GitHub Actions: `Check and build` `SUCCESS`, run `31001657952`.

## Sliplane y navegador

- Proyecto `project_3o4wtis2vnhk`; servicio `service_qi0aluudq024`.
- Rama `codex/issue-8-cardinal-propagation`; commit `2eb97c7`.
- Evento terminal `service_event_hhp2wsor9pql`: `Service deployed successfully`.
- `/` y `/health`: HTTP 200.
- Navegador local/remoto: calibración correcta, eco `#000001` y consola sin warnings/errores.
- WebM N/A: el cambio es solver puro y no crea un flujo visual temporal.

## Evidencias visuales

- [`project-in-progress.webp`](./project-in-progress.webp): tarjeta #8 filtrada en In progress. La captura previa al movimiento agotó dos veces el timeout del navegador y no se sustituyó por una imagen posterior mal etiquetada.
- [`project-final.webp`](./project-final.webp): tarjeta #8 filtrada en In review.
- [`pr-65-published.webp`](./pr-65-published.webp): PR #65 publicada contra `dev`.
- [`local-browser.webp`](./local-browser.webp): build local tras calibrar.
- [`sliplane-browser.webp`](./sliplane-browser.webp): preview desplegada tras calibrar.

## Publicación

- PR #65: `dev` ← `codex/issue-8-cardinal-propagation`, no draft.
- Estado comprobado: `MERGEABLE/CLEAN`.
- Labels: `codex`, `codex-automation`.
- Issue: cuatro criterios marcados, `status:in-review`.
- Project #2: In review.
