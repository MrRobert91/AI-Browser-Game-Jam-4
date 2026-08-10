# Voces locales de la revisión QBista

## Producción

- Voz: Microsoft Helena Desktop (`es-ES`), sintetizador SAPI incluido en Windows.
- Dirección: La Medida usa ritmo `-1`, sereno y administrativo; los cuatro Colapsadores alternan ritmos `-1`, `0` y `1` para distinguir expedientes sin imitar personas reales.
- Fuente textual: `src/content/narrative.json`, `src/content/introduction.json` y `src/content/collapsador-records.json`.
- Script reproducible: `scripts/generate-narrative-voices.ps1`.
- Edición: filtro paso alto 90 Hz, paso bajo 12 kHz y normalización EBU R128 a -18 LUFS integrados mediante FFmpeg.
- Entrega: 20 MP3 mono a 24 kHz/56 kbps, 1.030.044 bytes en total.

## Integración

Los archivos se sirven desde `/assets/audio/narrative/`; no hay TTS ni red durante la partida. `AudioDirector` mantiene un bus de voz local, hace ducking suave de música mientras habla, limita la cola a dos clips y permite desactivar voces sin ocultar subtítulos. Si un MP3 falla, el catálogo textual sigue siendo el fallback completo.

La introducción conserva texto visible antes del gesto por las políticas de autoplay del navegador. Las voces solo intentan reproducirse después de que el jugador autoriza audio/calibración.

## Verificación

FFprobe confirmó para los 20 archivos codec MP3, un canal y 24.000 Hz. Las duraciones van de 5,13 a 9,78 s y el conjunto añade aproximadamente 1 MB, dentro del presupuesto de descarga. Las pruebas verifican firma ID3, recuento, tamaño total, ruta local, ducking/cola y que no se cree `AudioContext` antes del gesto.
