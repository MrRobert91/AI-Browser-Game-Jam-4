# Issue #56 — Variante remota de haiku con consentimiento

## Resultado verificable

- Estado por defecto: endpoint ausente, control oculto y cero requests externos.
- Opt-in: checkbox desmarcado por partida y una única petición HTTPS manual.
- Payload: perfil y cinco métricas redondeadas; sin seed, ruta, coordenadas, muertes, panorama ni haiku local.
- Resiliencia: timeout de 4 s, validación estricta de tres líneas y fallback al resultado local ante cualquier fallo.
- Secretos: ninguna clave de modelo entra en Vite; la integración exige un proxy HTTPS.
- Operación: política de retención, proveedor y tope de coste obligatorios antes de configurar el endpoint.

## Evidencia

`tests/unit/remote-haiku.test.ts` cubre configuración, minimización, consentimiento, transporte, éxito, error y timeout. `tests/e2e/canonical-flow.spec.ts` mantiene el monitor que rechaza red externa en la build sin endpoint. El contrato completo está en [`docs/privacy/REMOTE_HAIKU.md`](../../privacy/REMOTE_HAIKU.md).

No se configura ni se invoca un proveedor real desde esta rama: hacerlo sin propietario, presupuesto y política publicados violaría el criterio de consentimiento informado.
