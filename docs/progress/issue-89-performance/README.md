# Issue #89 — FPS estable en equipos modestos

## Escenario reproducible

`npm run profile:browser` levanta la build de producción y ejecuta el replay local en Chromium a 1440×900, DPR 1,5, 8 cores/8 GiB declarados y throttling de CPU 2×. El renderer detectado fue SwiftShader, por lo que la prueba fuerza el camino más desfavorable: WebGL2 ejecutado por CPU, sin una GPU física.

| Medida | Antes | Después documentado |
|---|---:|---:|
| FPS medios | 0,79 | 49,39 |
| Frame p50 | 1.666,6 ms | 16,7 ms |
| Frame p95 | 1.716,6 ms | 33,4 ms |
| Draw calls finales | No instrumentado | 17 |
| Triángulos finales | No instrumentado | 4.226 |
| Buffer interno | No instrumentado | 503×315 |

La mejora medida en el mismo escenario es de **62,5×**. Otra repetición sin grabación alcanzó 53,27 FPS. Al declarar 16 cores/16 GiB para obligar al arranque en alto, el gobernador detectó que la GPU real seguía siendo SwiftShader, degradó alto → medio → bajo y terminó en 56,92 FPS con p95 de 16,8 ms.

## Cambios relevantes

- El preset automático es conservador con las pistas CPU/RAM y puede degradar efectos después de agotar el DPR del nivel actual.
- Los frames de emergencia reducen resolución inmediatamente; bajo puede llegar a 0,35× sobre un DPR limitado a 1×.
- Bajo evita por completo `EffectComposer`, bloom y SSAO y llama al renderer directo.
- Las celdas fijadas pasan de meshes permanentes por celda a un máximo de siete `InstancedMesh` compartidos.
- El bucle reutiliza vectores, centros y vecindarios, consulta celdas sin snapshots, mantiene el contador `FIXED` en O(1), actualiza superposición a 10 Hz y evita escrituras DOM sin cambios.

## Evidencia

- [`profile.json`](./profile.json): salida máquina-legible del perfil documentado.
- [`optimized-gameplay.png`](./optimized-gameplay.png): frame real del replay ya degradado a bajo.
- [`optimized-gameplay.webm`](./optimized-gameplay.webm): 11,12 s, VP8, 1440×900, 25 FPS de captura.

La captura de vídeo tiene cadencia propia de 25 FPS y no se usa para calcular el perfil; las métricas proceden de `requestAnimationFrame` dentro del navegador durante una ventana separada de cinco segundos.

## Validación

- `npm run check`: 49 archivos, 189 tests.
- `npm run build`, `npm run format:check`, `npm run validate:tiles`, `npm run validate:assets`.
- `npm run test:sim`: 100 seeds, 5.100 colapsos y todos los contadores de fallo a cero.
- `npm run test:e2e`: 12/12 en Chromium y Firefox.
- `npm audit --omit=dev`: 0 vulnerabilidades.

