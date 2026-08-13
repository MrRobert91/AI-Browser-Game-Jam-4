# Gate humano — final «Misión completada» (#112)

Estado: **NO-GO — ninguna partida humana de diez minutos registrada**.

La automatización acredita el contrato y la reproducción, pero no demuestra
que 1536 celdas sea un objetivo exigente y alcanzable para una persona. La
issue #112 no se cierra hasta completar al menos una partida real del modo
estándar y registrar el resultado sin alterar la ejecución.

## Preparación

1. Usar la build de la PR del epic #107 o `dev` después de integrarla.
2. Abrir el juego sin `replay`, `evidence`, `start`, `speed` ni DevTools que
   cambien el tiempo.
3. Elegir cualquier idioma y jugar los diez minutos completos en modo estándar.
4. No dirigir el recorrido ni avisar de una bomba; se puede recordar el objetivo
   que presenta Alice Boole.
5. Registrar una sesión anónima. No recoger nombre, correo, voz, vídeo ni datos
   del dispositivo sin consentimiento expreso.

## Registro mínimo

- Navegador, resolución y preset.
- Duración observada y causa de cierre.
- `finalFixedCells`, Semillas y vidas restantes mostradas por el resultado.
- Si apareció `MISSION_COMPLETE` exactamente una vez.
- Bloqueos, fallos de subtítulos/audio/vídeo y percepción de dificultad.

| Sesión | Navegador/resolución | 10 min reales | FIXED final | Semillas | Vidas | Variante | Incidencias |
|---|---|---:|---:|---:|---:|---|---|
| Pendiente | — | — | — | — | — | — | — |

## Decisión

`GO` requiere una sesión íntegra sin ayudas de QA que confirme que 1536 es
exigente pero alcanzable y que el cierre especial no bloquea el resultado. Si
falla, no se cambia el número silenciosamente: primero se actualiza `AGENTS.md`,
se explica la calibración en #112 y se repiten las pruebas afectadas.
