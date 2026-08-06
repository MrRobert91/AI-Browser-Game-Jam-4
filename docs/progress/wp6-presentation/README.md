# WP6 — Presentación, audio y UX

Entrega acumulativa de las issues #36–#39 en `codex/wp6-presentation-audio-ux`, nacida de `dev` `8a95fa5`.

## Alcance verificado

- #36: materiales PBR estilizados, colapso oro/blanco, vegetación determinista instanciada, sol/niebla, bloom por luminancia y SSAO solo en alto. El preset bajo conserva la lectura frío/probable → cálido/material con 48 instancias, dos candidatos y sin postprocesado caro.
- #37: `AudioDirector` local y activado por gesto, buses master/música/SFX, cuatro stems, armónico de observación, firma de colapso, silencio de La Incertidumbre al mirarla, pulsos a 60/30 s y pool estricto de ocho voces.
- #38: HUD periférico, MIRA inicial, retícula, cuatro Semillas, pausa con liberación de Pointer Lock, R mantenida dos segundos, pausa por pestaña oculta y opciones persistentes de sensibilidad, Y, cabeceo, destellos, contraste, subtítulos, calidad y tres volúmenes.
- #39: `narrative.json` español local con inicio, cuatro unlocks, primera muerte, últimos 30 s y final. Los subtítulos están activos por defecto y el juego no depende de voz.

## Evidencia

- [`01-intro.webp`](./01-intro.webp): shell WP6, superposición fría, vegetación, HUD de Semillas y estado inicial.
- [`02-narrative-unlocks.webp`](./02-narrative-unlocks.webp): mundo fijado, cuatro stems desbloqueados, amenaza petrificada y subtítulo local.
- [`03-pause-options.webp`](./03-pause-options.webp): pausa completa, controles accesibles y reinicio mantenido.
- [`wp6-presentation-walkthrough.webm`](./wp6-presentation-walkthrough.webm): montaje VP9 de 12 s con calibración, colapsos, progresión, cierre y pausa.

## Validación

- `npm run format:check`
- `npm run check` — 33 archivos, 138 tests
- `npm run build`
- `npm audit --omit=dev` — 0 vulnerabilidades
- `git diff --check`
- Navegador local: replay `?wp6=preview&replay=wp5`, recorrido completo, pausa accesible, final canónico y cero warnings/errores de consola.
- `ffprobe`: WebM VP9, 12 s, 1055×856, 499.931 bytes.

Las capturas no demuestran sonido audible; la frontera de activación por gesto, buses, stems, cadencia y límite de fuentes está cubierta por tests y por la integración ejecutada sin errores. No se realizaron llamadas de red ni se añadió voz remota.
