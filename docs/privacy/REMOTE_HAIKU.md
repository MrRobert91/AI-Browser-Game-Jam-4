# Variante remota de haiku: privacidad, coste y operación

La variante remota es una expansión post-jam opcional. La build publicada por defecto no configura `VITE_REMOTE_HAIKU_ENDPOINT`: no muestra el control, no ejecuta `fetch` y conserva íntegro el recorrido offline. El haiku local determinista continúa siendo el resultado oficial y siempre se calcula antes de cualquier red.

## Consentimiento y datos

Cuando una operadora decide configurar un endpoint HTTPS, el panel final explica la transferencia y exige un checkbox desmarcado en cada partida. El botón permanece deshabilitado hasta que el jugador consiente. No hay consentimiento persistente ni petición automática.

La única petición contiene este JSON de estadísticas reducidas:

```json
{
  "locale": "es-ES",
  "profile": "Cartógrafo",
  "fixedCellsBucket": 150,
  "maxDistanceBucket": 45,
  "water10": 2,
  "forest10": 3,
  "ruin10": 1
}
```

No se envían seed, ruta, coordenadas, muertes, imagen, haiku local, identificadores ni contenido guardado. Los buckets reducen precisión, pero la conexión expone necesariamente la dirección IP al servidor y a su infraestructura. El cliente omite credenciales y referrer.

## Contrato del proxy

El navegador nunca debe contener una clave de proveedor. `VITE_REMOTE_HAIKU_ENDPOINT` debe apuntar a un proxy HTTPS controlado por quien publique la build. Antes de habilitarlo, esa persona debe documentar proveedor/modelo, región, subencargados, plazo de retención, política de entrenamiento y mecanismo de borrado. La configuración de referencia exige no registrar cuerpos, no reutilizar datos para entrenamiento y descartar petición y respuesta al terminar.

El proxy acepta el esquema mínimo anterior y devuelve exclusivamente `{ "lines": ["…", "…", "…"] }`. Debe limitar tamaño, frecuencia y origen. El cliente hace como máximo una petición por final completado y consentido, con timeout de 4 s; la operadora puede acotar coste como `partidas consentidas × coste máximo por petición` y fijar un límite duro en el proveedor.

## Fallos y retirada

Error HTTP, desconexión, timeout o respuesta inválida muestran un aviso no bloqueante y conservan el haiku local sin modificar seed, perfil, expediente, panorama ni replay. Retirar la función consiste en publicar sin `VITE_REMOTE_HAIKU_ENDPOINT`; no requiere migración de datos.

Las pruebas unitarias verifican HTTPS, payload mínimo, ausencia de llamada sin consentimiento, transporte sin credenciales, respuesta válida, error y timeout. El E2E de la build por defecto falla si detecta cualquier request externo.
