# Créditos

La Última Observación fue diseñada y construida para AI Browser Game Jam 4.

- Dirección, diseño y revisión: David / MrRobert91.
- Implementación asistida: OpenAI Codex, siempre bajo instrucciones, revisión y validación humana.
- Motor 3D: Three.js.
- Física: Rapier (`@dimforge/rapier3d-compat`).
- Tooling: TypeScript, Vite, Vitest y Playwright.
- Modelos y materiales durante la partida: proxies y generación procedural local.
- Voz inglesa de La Medida: `microsoft/mai-voice-2`, Harper (`en-US`), generada una vez mediante OpenRouter.
- Voz española de La Medida: `google/gemini-3.1-flash-tts-preview`, Kore, dirigida en castellano peninsular y generada una vez mediante OpenRouter.
- Briefing visual: siete planos de `google/veo-3.1-lite` generados sin audio ni texto intencional; montaje, fallbacks y control de calidad locales con FFmpeg.
- Ambientes no musicales y efectos: assets originales locales y eventos breves con Web Audio API. La canción y las voces SAPI anteriores no forman parte del build.

La procedencia detallada está en `ASSET_PROVENANCE.json`. El juego no recopila telemetría, no contiene credenciales y no envía datos a modelos durante la partida.
