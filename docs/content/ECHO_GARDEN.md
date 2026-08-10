# Jardín de Eco — pack post-jam

Jardín de Eco amplía Tormenta después de recoger su cuarta Semilla; no crea una quinta ancla ni cambia el cierre 0–4. Solo entra en chunks inicializados a partir de ese `paletteEpoch`, por lo que el mundo ya propagado permanece intacto.

## Vocabulario

| Capa | Definiciones | Papel |
|---|---|---|
| Terreno | Echo Moss, Prism Soil, Echo Clearing | Manchas frías, reflejos bajos y adaptador seguro |
| Feature | Bell Flower, Mirror Reed, Memory Stone | Detalle, silueta vertical y monumento raro |

Las tres tiles de terreno usan `OPEN_FLAT`; Echo Clearing se etiqueta como adaptador y pradera. El pack no añade sockets, letalidad, flashes, música, anclas ni nuevas reglas de progresión.

## Presupuesto y procedencia

- Variantes activas tras compilar: 43 terreno / 22 feature, por debajo de 64/64.
- Seis proxies JSON locales: menos de 10 KiB en conjunto, dos niveles LOD cada uno.
- Aparición: zona exterior, 38–42 m mínimo; pesos positivos y curvas de distancia.
- Autoría: diseño y parámetros originales dirigidos para este proyecto; detalle en `docs/release/ASSET_PROVENANCE.json`.
- Runtime: sin red y sin regeneración de assets.
