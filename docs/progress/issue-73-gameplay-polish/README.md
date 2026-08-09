# Evidencia de la issue #73

Evidencia capturada mediante Playwright sobre el build local de producción.

- `01-calibration-retry.png`: la primera solicitud de Pointer Lock se rechaza de forma sintética; la escena permanece visible y el botón ofrece reintento.
- `02-calibration-recovered.png`: la segunda solicitud obtiene Pointer Lock, la partida continúa y las posibilidades muestran porcentajes que suman 100 %; la esfera límite permanece deliberadamente lejana.
- `calibration-recovery.webm`: secuencia completa de 24,04 s, VP8, 800×450, 25 FPS.

La prueba usa Pointer Lock real en Chromium. La suite Firefox headless instala un shim limitado al contexto de Playwright porque ese entorno no concede Pointer Lock; la lógica de error y recuperación mantiene las mismas aserciones. La colisión del borde se valida aparte con Rapier real y las velocidades y porcentajes mediante pruebas unitarias deterministas.
