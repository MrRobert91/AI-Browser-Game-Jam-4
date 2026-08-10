# Créditos

La Última Observación fue diseñada y construida para AI Browser Game Jam 4.

- Dirección, diseño y revisión: David / MrRobert91.
- Implementación asistida: OpenAI Codex, siempre bajo instrucciones, revisión y validación humana.
- Motor 3D: Three.js.
- Física: Rapier (`@dimforge/rapier3d-compat`).
- Tooling: TypeScript, Vite, Vitest y Playwright.
- Modelos y materiales durante la partida: proxies y generación procedural local.
- Canción original «La función que nos mira»: letra con `openai/gpt-5.4-mini` y música con `google/lyria-3-pro-preview`, generadas previamente mediante OpenRouter y distribuidas como MP3 local.
- Voces narrativas: Microsoft Helena Desktop (`es-ES`) mediante SAPI de Windows, dirigidas y procesadas localmente con FFmpeg; 20 MP3 incluidos en el build sin TTS de runtime.
- Efectos: síntesis local de eventos breves con Web Audio API; no existen osciladores continuos de ambiente.

La procedencia detallada está en `ASSET_PROVENANCE.json`. El juego no recopila telemetría, no contiene credenciales y no envía datos a modelos durante la partida.
