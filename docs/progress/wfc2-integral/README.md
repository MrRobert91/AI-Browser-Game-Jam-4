# WFC2 integral — evidencia reproducible

Entrega acumulativa de la épica #98 y las issues #99–#103 sobre `origin/dev` `cafe6b4`.

## Evidencia visual

- `01-objectives.png`: fase `OBJECTIVES` real con el retrato local de Dr Alice Boole, nombre HTML y directiva inglesa visible.
- `02-lives-final.png`: transmisión de derrota tras la tercera bomba, tres vidas agotadas y final `LIVES_EXHAUSTED`.
- `wfc2-lives-final.webm`: captura temporal real del replay determinista `wfc2-lives`, desde la directiva hasta fractura y final.

Las capturas y el vídeo proceden de Playwright sobre la build local; no son mockups. La suite comprueba también el flujo español con fallback del briefing, el HUD, la ausencia de peticiones externas y la consola limpia del recorrido canónico.

## Gates

- `npm run check`: 49 archivos / 205 tests.
- `npm run validate:tiles` y `npm run validate:assets`.
- `npm run test:sim`: 100 seeds, 20.011 colapsos, cero dominios vacíos, commits fuera de radio, fallbacks, `quantum_void_debug`, Semillas inaccesibles o hashes divergentes.
- `npm run test:sim:release`: 10.000 seeds antes de publicación.
- `npm run build`, E2E Chromium/Firefox, perfil de release y Docker según disponibilidad local.

## Reproducción focalizada

```powershell
npm.cmd run build
npx.cmd playwright test tests/e2e/release-journey.spec.ts --grep "three consciousness bombs"
```

El replay de QA es opt-in mediante `?wp5=preview&replay=wfc2-lives&speed=8&evidence=1`; la partida normal conserva interacción manual y no detona bombas automáticamente.
