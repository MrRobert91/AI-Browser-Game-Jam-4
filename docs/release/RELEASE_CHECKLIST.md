# Checklist release candidate

- [x] `npm run check` — 40 archivos, 159 tests
- [x] `npm run validate:tiles`
- [x] `npm run validate:assets`
- [x] `npm run test:sim:release` — 10.000 seeds; 100 replays WFC completos × 600 ticks
- [x] `npm run test:e2e` — Chromium/Firefox, cuatro casos
- [x] `npm run test:e2e:desktop` — Chrome estable 1920×1080, dos casos
- [x] `npm run build`
- [x] `npm run profile:release` — todos los objetivos y límites
- [x] `npm run package:release`
- [x] `quantum_void_debug = 0`
- [x] recorrido canónico llega al final sin consola/red fallida
- [x] MVP incluye base, Agua y Bosque
- [x] créditos, procedencia IA, privacidad e instrucciones itch revisados

Artefacto: `release/la-ultima-observacion-rc.zip` — 2.653.429 bytes — SHA-256 `f21400ed03f1286c1dc7bf0e1e6e350ac5a4b36333aa76292bffeff2770b6d79`.

Recortes: panorama PNG, modo diario, gamepad/táctil, biomas adicionales y haiku remoto siguen post-jam. Tormenta permanece como vocabulario/stretch y no es requisito del MVP base+Agua+Bosque.

## Extensión post-jam — final «Misión completada» (#107)

- [x] Clasificador puro: 1535/1536/1537, 3/4 Semillas, 0/1/3 vidas,
  tiempo/muerte y estándar/Breve/Contemplación.
- [x] Recuento final desde `WorldState`; `FRACTURED` no cuenta.
- [x] Ascensión de 8 s antes del vídeo local de 32 s.
- [x] Voz/subtítulos EN/ES sincronizados y omisión solo desde 3 s.
- [x] Fallback sin vídeo/voz llega una sola vez al resultado.
- [x] Replay determinista opt-in y cero solicitudes a orígenes externos.
- [x] Medios locales validados por firma, FFprobe, loudness, hashes y tamaño.
- [x] Evidencia Chromium y matriz Chromium/Firefox.
- [ ] Playtest humano real de diez minutos: **NO-GO / pendiente**; #112 sigue
  abierta y el umbral de 1536 no se recalibra sin actualizar `AGENTS.md`.

Evidencia: [`docs/progress/issue-112-mission-complete/`](../progress/issue-112-mission-complete/).
