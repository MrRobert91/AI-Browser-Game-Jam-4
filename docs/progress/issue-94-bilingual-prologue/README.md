# Issue #94 — Sala, briefing y portal bilingües

## Evidencia reproducible

- `01-language.png`: selector obligatorio con inglés preseleccionado.
- `02-room.png`: sala Three.js/Rapier y botón coral tras autorizar audio/control.
- `03-briefing.png`: vídeo local, pantalla gigante y captions HTML visibles.
- `04-collapse.png`: mundo inicializado únicamente después de cruzar el portal.
- `room-briefing-portal-collapse.webm`: recorrido real Chromium 800×450, VP8,
  17,68 s; selector → sala → botón → briefing omitido → portal → primer colapso.
- `video-contact-sheet.webp`: inspección de los siete planos finales. Las tomas
  1, 4 y 5 son sustituciones sin rótulos legibles tras rechazar la primera tanda.

Reproducir la evidencia:

```powershell
npm.cmd run build
$env:PLAYWRIGHT_EVIDENCE='1'
npm.cmd exec playwright test -- --grep canonical --project chromium-16x10
```

Validación de medios:

```powershell
ffprobe -v error -show_streams -show_format -of json public/assets/video/agency-briefing.webm
npm.cmd exec tsx scripts/validate-audio-loudness.ts
npm.cmd exec tsx scripts/validate-voice-transcriptions.ts
```

## Resultados comprobados

- Vídeo de briefing: VP9, 1280×720, 50,000 s, cero pistas de audio, 5.493.689 bytes.
- Runtime audio+vídeo: 12.649.765 bytes, por debajo de 15 MB.
- Coste TTS reportado en el manifiesto de audio: 0,273016 USD.
- Coste de vídeo acumulado reportado: 2,16 USD, incluidas tres sustituciones.
- Transcripción del briefing: EN 100 %, ES 98,6 %.
- Loudness: 95/95 assets válidos; voces ≈ −16 LUFS y ambientes ≈ −24 LUFS.
- `npm run check`: 51 archivos, 199 tests.
- `npm run test:e2e`: 12/12, Chromium y Firefox; incluye fallback del WebM en ES.

No se realizaron ni inventaron sesiones humanas: #75/#83 siguen en **NO-GO 0/5**.
