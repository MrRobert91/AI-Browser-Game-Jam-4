# La Última Observación

Juego 3D para navegador creado para AI Browser Game Jam 4.

La especificación completa y las reglas normativas de implementación se mantienen en [AGENTS.md](./AGENTS.md).

## Desarrollo

Requiere Node.js 24.14.0, fijado en `.nvmrc`. Las versiones de runtime y tooling están fijadas en
`package-lock.json`.

```powershell
npm.cmd ci
npm.cmd run dev
```

La puerta de calidad local reproduce el job obligatorio de CI:

```powershell
npm.cmd run check
npm.cmd run format:check
npm.cmd run build
```

`npm run check` ejecuta typecheck con TypeScript 7, ESLint y toda la suite Vitest. TypeScript 6 se
instala en paralelo únicamente como API compatible para `typescript-eslint`; el ejecutable `tsc`
sigue apuntando al compilador nativo 7.0. Para aplicar formato usa `npm.cmd run format` y para
servir la build localmente, `npm.cmd run preview`.

La build se genera en `dist/` y funciona como sitio estático. El contenedor de preview sirve
ese mismo directorio con Nginx en el puerto `8080`; el navegador no usa CDN ni realiza llamadas
de red después de cargar los archivos de la aplicación.
