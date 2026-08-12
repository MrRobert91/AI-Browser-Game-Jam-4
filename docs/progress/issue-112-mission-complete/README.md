# Epic #107 / issues #108–#112 — final «Misión completada»

La variante especial solo se concede al agotarse los diez minutos del modo
estándar con al menos una vida, las cuatro Semillas y 1536 celdas todavía
`FIXED`. El recuento se toma al final: una celda `FRACTURED` deja de contar.
Los modos Breve/Contemplación y el cierre por tres muertes conservan el final
normal.

Después de la ascensión normativa de ocho segundos, el cierre reproduce un
WebM local mudo de 32 segundos y una voz local sincronizada según el idioma.
Los subtítulos HTML permanecen disponibles; tras tres segundos puede omitirse.
Si falla vídeo o voz, cuatro WebP y los mismos subtítulos completan el flujo sin
red y sin duplicar el resultado.

## Evidencia reproducible

- [Recorrido completo EN](./mission-complete-en.webm) — Chromium 1440×900,
  entregado como VP9 960×540, 54,12 s.
- [Recorrido completo ES](./mission-complete-es.webm) — Chromium 1440×900,
  entregado como VP9 960×540, 54,60 s.
- [Fallback sin WebM ni voz](./mission-complete-fallback.webm) — VP9 960×540,
  30,56 s.
- Ascensión: [EN](./en-mission-ascent.png) / [ES](./es-mission-ascent.png).
- Capítulos EN: [1](./en-mission-1-recorded-seeds.png),
  [2](./en-mission-2-ending-uncertainty.png),
  [3](./en-mission-3-new-condensates.png),
  [4](./en-mission-4-provisional-reality.png).
- Capítulos ES: [1](./es-mission-1-recorded-seeds.png),
  [2](./es-mission-2-ending-uncertainty.png),
  [3](./es-mission-3-new-condensates.png),
  [4](./es-mission-4-provisional-reality.png).
- Resultado: [EN](./en-mission-results.png) / [ES](./es-mission-results.png).
- [Fallback visual](./mission-fallback.png).

Reproducción automatizada desde una build nueva:

```powershell
npm.cmd run build
$env:PLAYWRIGHT_EVIDENCE='1'
npm.cmd exec playwright -- test tests/e2e/release-journey.spec.ts --grep "qualified .* replay reaches mission video after ascent|mission video and voice failures"
```

El fixture solo existe tras `replay=mission-complete&evidence=1`; fija de forma
determinista 1536 celdas, las cuatro Semillas y una vida. No modifica una
partida normal ni sustituye el playtest humano.

## Medios y procedencia

- Vídeo final: VP9, 1920×1080, 30 fps, 32 s, sin audio, 1.302.595 bytes,
  SHA-256 `f5ef51f31223d5b79c465d0f2dc504f3c658f94b88731a0d3789904d5dfd7ea7`.
- Voz EN Harper: MP3 mono, 32 s, −15,98 LUFS, −1,54 dBTP.
- Voz ES Kore: MP3 mono, 32 s, −16,00 LUFS, −1,83 dBTP.
- Coste acumulado del proyecto registrado por OpenRouter: 4,573846 USD;
  incluye 2,16 USD de generaciones de vídeo y los intentos de audio rechazados.
- Los manifiestos conservan prompts, modelos, IDs, hashes, transformaciones,
  descartes y coste. El runtime no contiene credenciales ni llama a APIs.

## Validación acumulada

- `npm run format:check`: verde.
- `npm run release:check`: 51 archivos / 216 tests; gramática y assets;
  10.000 seeds, 20.008 colapsos y cero dominios vacíos, commits fuera de radio,
  divergencias, fallbacks, `quantum_void_debug` o Semillas inaccesibles.
- E2E: 21 recorridos verdes y una exclusión intencional de showcase en Firefox;
  los seis casos del cierre especial pasan completos en Chromium/Firefox.
- Perfil: 148 draw calls, 882.000 triángulos, 228 MB de texturas, 60 FPS
  estimados y todos los objetivos/límites del harness cumplidos.
- `npm audit --audit-level=high`: cero vulnerabilidades.
- Docker CLI 26.1.4 está presente, pero Docker Desktop no expone el daemon
  Linux local. El build de imagen queda para la CI remota y no se declara como
  ejecutado localmente.

## Estado del gate

La automatización prueba los límites 1535/1536/1537, Semillas, vidas, causa de
cierre, modos, migración de resultados, fractura, reproducción bilingüe,
fallback y ausencia de red externa. El playtest humano real de diez minutos
sigue **NO-GO / pendiente** según
[`docs/playtests/mission-complete/PROTOCOL.md`](../../playtests/mission-complete/PROTOCOL.md).
No se presenta el replay como evidencia humana ni se recalibra el umbral sin
cambiar antes `AGENTS.md`.
