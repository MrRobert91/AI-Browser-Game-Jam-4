# Evidencias — cierre acumulativo WP1/WP2

Fecha: 2026-08-05 (Europe/Madrid)

## Alcance publicado

- PR: #66, `dev` ← `codex/wp1-wp2-foundations`.
- Base exacta: `2ddb78d3023115173fa40f3686ec1b11866131a7`.
- Head capturado: `b23b22f776657a751bb7ff8b9e3da1e8278327e1`.
- Secuencia: #9 `d81837c`, #10 `3bf658d`, #11 `28e2930`, #12 `ec9a0ab`, #13 `725a9ac`, #14 `b23b22f`.
- Estado remoto observado: PR abierta, no draft, `MERGEABLE/CLEAN`; CI `Check and build` `SUCCESS`.

## Evidencia visual

| Archivo | Qué demuestra |
|---|---|
| [`game-current.webp`](./game-current.webp) | Estado inicial del build actual: canvas WebGL2, shell, campo de detalles instanciados y llamada a calibrar la mirada. |
| [`game-calibrated.webp`](./game-calibrated.webp) | Estado posterior a la interacción: `CALIBRADA`, Pointer Lock adquirido y shell preparada para que el primer colapso inicie el reloj. |
| [`game-calibration.webm`](./game-calibration.webm) | Transición temporal real entre ambos estados; VP9, 1280×720, 6 segundos, `yuv420p`. |

La captura se realizó contra `http://localhost:4173/` con la rama de PR #66. La consola solo registró la conexión de desarrollo de Vite; no hubo errores de aplicación. La evidencia es local y no se presenta como captura del preview Sliplane.

## Validación reproducible

```text
npm run check
  12 archivos de prueba, 71 tests correctos

npm run build
  build correcto

npm run format:check
  formato correcto

npx vitest bench --run tests/benchmarks/instancing.bench.ts
  1.000 matrices en un InstancedMesh
  media 0,3111 ms; 3.214,42 operaciones/s

npm audit --omit=dev
  0 vulnerabilidades

git diff --check
  correcto
```

FFprobe confirmó `game-calibration.webm`: VP9, 1280×720, duración `6.000000`, tamaño 165.238 bytes. Vite mantiene un aviso no bloqueante por chunks superiores a 500 kB; se conserva como deuda explícita de perfilado para WP8.
