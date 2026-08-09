# Contrato offline y privacidad

La build estática publicada por defecto carga únicamente rutas relativas empaquetadas en `dist/`, incluido el favicon. No contiene analytics, telemetría, CDN, fuentes remotas ni llamadas a modelos. Los datos persistidos se limitan a opciones, último resultado, retrato anterior, seed y una galería IndexedDB optativa de cinco panoramas PNG de hasta 5 MiB cada uno; se pueden descargar o borrar localmente.

La expansión post-jam de haiku remoto permanece deshabilitada mientras `VITE_REMOTE_HAIKU_ENDPOINT` esté vacío. Solo una publicación que configure expresamente ese proxy HTTPS muestra un opt-in en el resultado; aun entonces no hay petición sin consentimiento por partida y todo fallo conserva el haiku local. El payload, la exposición inevitable de IP, la retención exigida y el modelo de coste están en [`docs/privacy/REMOTE_HAIKU.md`](../privacy/REMOTE_HAIKU.md).

El modo diario usa la fecha de calendario UTC del dispositivo para derivar una seed compartida. No sincroniza hora ni consulta un servidor. La observación estándar sigue generando una seed aleatoria local y todo resultado conserva la seed necesaria para replay.

Los E2E recorren calibración, colapso, progresión y final con listeners de consola y red: Chromium, Firefox y Chrome estable terminan sin errores ni requests fallidas. El resultado se registra en la matriz QA y la evidencia visual.

La candidata se genera con `npm run package:release`; `release/manifest.json` registra archivos, bytes y SHA-256 del ZIP.
