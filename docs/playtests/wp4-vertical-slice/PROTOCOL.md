# Protocolo ciego — Gate WP4 (#29)

Estado: **pendiente de cinco sesiones humanas**. Este protocolo no sustituye
las respuestas de testers y no autoriza WP5, enemigos ni packs adicionales.

## Preparación

1. Usar un build procedente de la PR WP4 o de `dev` después de integrarla.
2. Abrir `/?replay=canonical` solo para comprobar que el build funciona; cada
   tester debe jugar el slice normal, sin `evidence`, `start` ni `speed`.
3. Restablecer la página y la seed entre sesiones.
4. Identificar sesiones como T01–T05, sin recopilar nombres ni datos personales.
5. Solicitar consentimiento antes de grabar pantalla o voz. Una negativa no
   invalida la sesión: se pueden tomar notas anónimas.

## Instrucción única al tester

> Juega hasta que aparezca el cierre. Piensa en voz alta si te resulta cómodo.
> No hay una forma correcta de recorrer el espacio.

No explicar mirada, carga, posibilidades, persistencia, agua ni muerte antes o
durante la sesión. Solo resolver problemas técnicos de entrada o navegador.

## Preguntas posteriores, en orden

1. ¿Qué crees que hacía aparecer el mundo?
2. ¿Qué ocurría con las formas posibles mientras mirabas?
3. ¿Qué cambió y qué permaneció después de morir?
4. ¿Notaste alguna diferencia al alejarte del origen?
5. ¿Qué fue confuso o te hizo dudar?

No reformular una pregunta con vocabulario del juego hasta registrar la primera
respuesta literal.

## Regla de codificación

- **Aparición — PASS:** atribuye la fijación a mirar, sostener la mirada o
  prestar atención. Caminar por sí solo no cuenta.
- **Permanencia — PASS:** explica que terreno/features ya observados sobreviven
  a la muerte y al respawn.
- **Mirada/posibilidades — PASS:** relaciona atención sostenida con reducción o
  elección entre alternativas visuales.
- **Distancia — observación:** registra si detecta vocabulario nuevo; no es
  criterio de go/no-go del gate actual.

## Decisión

`GO` exige 5/5 en Aparición, 5/5 en Permanencia y reconocimiento consistente de
Mirada/posibilidades. Cualquier fallo produce `NO-GO`: se abre una issue de
claridad de superposición/colapso, se corrige y se repiten las sesiones
afectadas. Hasta `GO`, #30, #33 y #36 permanecen bloqueadas y no se implementan
enemigos ni packs extra.
