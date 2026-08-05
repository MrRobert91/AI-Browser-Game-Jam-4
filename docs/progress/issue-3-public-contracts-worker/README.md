# Evidencia de la issue #3

## Estado inicial

`dev` local y `origin/dev` coincidían en `148a3f8b3751ff27c5b1d6bde829db6bef1eda1b`.
La issue #2 ya estaba cerrada y en **Done**; #3 aparecía desbloqueada en **Backlog**.

![Project inicial](./project-initial.webp)

## Contrato local

La build estática carga el worker como un bundle local separado y muestra el eco del primer tick
numerado. La calibración existente sigue funcionando y no inicia el reloj.

![Eco del worker en local](./worker-echo-local.webp)

- Estado visible: `CONTRATO #000001 // ECO` y `data-contract-state="ready"`.
- Consola: cero warnings o errores en una carga limpia.
- Recursos de producción: JS principal, CSS y worker; los tres pertenecen al mismo origen local.
- Interacción: `Calibrar mirada` cambia a `CALIBRADA`, deshabilita el botón y conserva el eco.
- Vídeo WebM: N/A; el cambio de esta issue es un handshake instantáneo de infraestructura, no un
  flujo visual temporal. La prueba reproducible es la combinación de test, consola y captura.

## Validación automatizada

- `npm run typecheck`: verde.
- `npm run test:contracts`: dos archivos, cuatro tests, todos verdes.
- `npm run build`: verde; worker separado de 1,68 kB.
- `npm audit --omit=dev`: cero vulnerabilidades.
- `git diff --check`: verde.

## Preview y publicación

Se completará en esta misma rama después del primer commit y despliegue de Sliplane.
