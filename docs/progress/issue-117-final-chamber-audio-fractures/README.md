# Issue #117 — sala final, voz monofónica y fractura terminal

## Alcance verificado

- El final cualificado vuelve a una sala 3D de reintegración y reproduce el
  vídeo local sobre la pantalla física.
- La fase espera a que vídeo y voz terminen realmente; no fuerza saltos
  periódicos de `currentTime` y conserva skip/fallbacks.
- `AudioDirector` rechaza un nuevo disparo mientras otra voz está activa, sin
  interrumpirla ni encolarlo; una ocurrencia posterior puede intentarlo de
  nuevo.
- Las celdas `FRACTURED` se excluyen y se purgan inmediatamente del render de
  superposición.

## Evidencia reproducible

- `return-chamber-recorded-seeds.png`: captura real de Chromium con la sala y
  el primer capítulo en la pantalla.
- `return-chamber-final-chapter.png`: el cuarto capítulo sigue mostrando vídeo
  con `currentTime >= 24`, antes de presentar resultados.
- `return-chamber-playback.webm`: recorrido real grabado por Playwright desde
  la Cámara inicial hasta los cuatro capítulos y el resultado.

FFprobe verifica el WebM de evidencia como VP8, 800×450, 25 fps, 60,680 s y
6.030.887 bytes. SHA-256:
`31CB2B2707C2FA1F35DE0FD6704A8118B1789BC97B7EA4DB28B53F2E4CBE8F45`.

```powershell
npm.cmd run build
$env:PLAYWRIGHT_EVIDENCE='1'
npm.cmd exec playwright -- test tests/e2e/release-journey.spec.ts `
  --project=chromium-16x10 `
  --grep "qualified EN replay reaches mission video after ascent"
Remove-Item Env:PLAYWRIGHT_EVIDENCE
```

## Gates

- `npm.cmd run check`: 51 archivos / 223 tests, tipos y lint verdes.
- Gramática: 7/7; assets: 2/2; auditoría npm: 0 vulnerabilidades.
- Simulación: 100 seeds, 20.008 colapsos y cero dominios vacíos, fallbacks,
  divergencias, commits fuera de radio, `quantum_void_debug` o Semillas
  inaccesibles.
- E2E focalizado: EN, ES y fallo simultáneo de vídeo/voz pasan en Chromium y
  Firefox. Los medios siguen siendo locales y el recorrido no realiza
  peticiones a orígenes externos.
