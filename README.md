# La Última Observación

Juego 3D para navegador creado para AI Browser Game Jam 4.

La especificación completa y las reglas normativas de implementación se mantienen en [AGENTS.md](./AGENTS.md).

## Desarrollo

Requiere Node.js 22.12 o posterior. Las versiones de runtime y tooling están fijadas en
`package-lock.json`.

```powershell
npm.cmd install
npm.cmd run dev
```

Comprobaciones disponibles en el scaffold inicial:

```powershell
npm.cmd run typecheck
npm.cmd run test:contracts
npm.cmd run build
npm.cmd run preview
```

La build se genera en `dist/` y funciona como sitio estático. El contenedor de preview sirve
ese mismo directorio con Nginx en el puerto `8080`; el navegador no usa CDN ni realiza llamadas
de red después de cargar los archivos de la aplicación.
