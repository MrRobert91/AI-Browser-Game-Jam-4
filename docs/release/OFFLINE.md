# Contrato offline y privacidad

La build estática carga únicamente rutas relativas empaquetadas en `dist/`, incluido el favicon. No contiene analytics, telemetría, CDN, fuentes remotas, fetch de contenido ni llamadas a modelos. Web Audio se sintetiza localmente y los datos persistidos se limitan a opciones, último resultado, retrato anterior y seed.

Los E2E recorren calibración, colapso, progresión y final con listeners de consola y red: Chromium, Firefox y Chrome estable terminan sin errores ni requests fallidas. El resultado se registra en la matriz QA y la evidencia visual.

La candidata se genera con `npm run package:release`; `release/manifest.json` registra archivos, bytes y SHA-256 del ZIP.
