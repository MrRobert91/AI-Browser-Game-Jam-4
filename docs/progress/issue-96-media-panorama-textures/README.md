# Issue #96 — Audio audible, panorama completo y mundo texturizado

## Evidencia reproducible

- `01-briefing-sharp.webp`: pantalla de la Agencia reproduciendo el montaje local
  1080p con captions obligatorios.
- `02-textured-collapse.webp`: suelo y detalle procedural texturizados durante una
  partida real.
- `03-full-observed-panorama.png`: PNG descargado por el propio juego; la vista
  ortográfica incluye desde el origen hasta la celda fijada más lejana.
- `media-panorama-textures.webm`: recorrido Chromium real de 26,16 s, VP8,
  800×450; idioma → sala → briefing audible → portal → colapsos → panorama.

Reproducir el recorrido sin interferir con otro servidor local:

```powershell
npm.cmd run build
$env:PLAYWRIGHT_PORT='4174'
$env:PLAYWRIGHT_EVIDENCE='1'
npm.cmd exec playwright -- test tests/e2e/release-journey.spec.ts --project=chromium-16x10 --grep "canonical offline English"
```

Regenerar el briefing nítido exclusivamente desde los siete WebP locales:

```powershell
npm.cmd run media:briefing:clarity
ffprobe -v error -show_streams -show_format -of json public/assets/video/agency-briefing.webm
```

## Resultados comprobados

- La narración del briefing usa el mismo elemento autorizado durante el gesto de
  calibración. La E2E exige `paused=false`, tiempo de reproducción creciente y
  volumen efectivo `0,585`.
- `AudioDirector` autoriza voz y cinco ambientes antes de ceder el gesto al
  `AudioContext`; los clips posteriores reutilizan esos elementos locales.
- Vídeo: VP9, 1920×1080, 50,000 s, sin pista de audio, 4.969.552 bytes. El
  pipeline Lanczos + unsharp queda registrado en el manifiesto.
- Audio + vídeo: 12.155.076 bytes, por debajo del límite de 15 MB.
- Observación: 20 m, carga 2,8/s, commit máximo 20,01 m, animación 225–350 ms y
  vecindario de 11 celdas; los chunks se activan a 22 m.
- Panorama: render target ortográfico 1600×900 y encuadre calculado desde todas
  las celdas `FIXED`, sin mover la cámara de juego.
- Texturas: ocho mapas procedurales compartidos de 64×64, 131.072 bytes antes de
  mipmaps; materiales y lotes instanciados se reutilizan sin aumentar el límite
  de siete batches del mundo fijado.
- `npm run check`: 51 archivos, 201 tests. Typecheck, ESLint, formato, build,
  validadores y auditoría de arquitectura verdes.

No se realizaron ni inventaron sesiones humanas: #75/#83 continúan en
**NO-GO 0/5**.
