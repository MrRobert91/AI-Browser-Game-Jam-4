# Issue #6 — PRNG, hash y cuantización deterministas

## Trazabilidad

- Base: `dev` = `origin/dev` en `2adebf247afdc184db65b378f127f10eeacf156f`.
- `main`: `7be4649ece2a9a8f4bed40ff72653ef6cbf06478`, última promoción de WP0.
- Rama: `codex/issue-6-deterministic-rng`.
- Commit de implementación: `127c9e5ab0d90e268d3f33af3c1523d254e79d3d`.
- Dependencia cerrada: #3; #5 también está integrada en `dev`.
- Desbloquea: #7 cuando la PR de #6 se integre y la issue se reconcilie.

## Diseño verificable

- Mulberry32 mantiene un único estado `uint32` por stream y no usa estado global.
- `deriveSeed` separa mundo, sistema y chunk con campos etiquetados.
- `simulationTickAt` fija el avance del solver a 10 Hz y el consumidor recupera todos los ticks completos.
- `hashFinalWorld` canoniza por `cellId`; la inserción o el orden de colapso no cambian el resultado.
- `null` y feature `0` se codifican de forma distinta.
- El hash queda versionado como `WFC1`/1.

## Vectores y rendimiento

- PRNG seed `0`: `1144304738, 1416247, 958946056, 627933444, 2007157716`.
- Seed derivada `0xA91F42C0 / terrain / (2,-3)`: `1907926411`.
- Hash final `0xA91F42C0` y tres celdas canónicas: `3069527348`.
- Anterior: N/A; el proyecto todavía no tenía función de hash final.
- Benchmark Node 24: 1.000.000 pasos PRNG en 9,741 ms; hash de 4.096 celdas en 0,2648 ms de media.

## Validación

- `npm run format:check`.
- `npm run check` — typecheck, ESLint, 4 archivos y 21 tests.
- `npm run build` — Vite y worker estático.
- `npm audit --omit=dev` — 0 vulnerabilidades.
- `git diff --check`.
- Secuencias idénticas a 30/60/144 FPS durante 20 ticks.
- Guardia ejecutable: ningún archivo de `src/wfc/` contiene `Math.random`.
- `FIXED` preservado: las utilidades no mutan celdas y el hash solo lee una copia canónica.

## Sliplane y navegador

- Proyecto `project_3o4wtis2vnhk`; servicio `service_qi0aluudq024`.
- Rama `codex/issue-6-deterministic-rng`; commit `127c9e5ab0d90e268d3f33af3c1523d254e79d3d`.
- Evento `service_event_x0j48sgyco36`: `Service deployed successfully`.
- Servicio `live`, 20 logs recientes sin coincidencias de error, `/` y `/health` HTTP 200.
- URL: `https://la-ultima-observacion-web.sliplane.app/?rev=127c9e5`.
- Build local y remoto: calibración, eco `#000001` y consola limpia.

## Evidencia visual

![Project con #6 en In progress](./project-initial.webp)

![Build local tras calibración](./local-browser.webp)

![Preview Sliplane de la rama](./sliplane-browser.webp)

WebM es N/A: la implementación es infraestructura determinista pura y no añade una interacción visual temporal.

## Reversión

Revertir los commits de #6 y apuntar el preview de nuevo a `dev`. No existen datos, migraciones, assets ni cambios normativos que restaurar.
