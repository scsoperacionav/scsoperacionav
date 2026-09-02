# Control de Stock — App interna

App de control de stock de insumos con múltiples depósitos, roles y auditoría.
React vía CDN (sin build), Firebase Firestore + Auth, hosting en GitHub Pages.

## Archivos

- `index.html` — carga todas las librerías y la app.
- `firebase-config.js` — configuración de tu proyecto Firebase (hay que completarla).
- `permissions.js` — matriz de roles y permisos.
- `app.js` — toda la app en React (pantallas, formularios, lógica de stock).
- `styles.css` — estilos.
- `firestore.rules` — reglas de seguridad (se suben desde la consola de Firebase, no desde acá).

## Roles

| Rol | Puede |
|---|---|
| **Admin** | Todo, incluida gestión de usuarios, configuración (logo) y anulación de movimientos |
| **Supervisor** | Insumos, depósitos, sectores, proveedores, compras, movimientos, reportes — no gestiona usuarios ni configuración |
| **Encargado de Depósito** | Registrar entradas/salidas y facturas de compra solo en sus depósitos asignados |
| **Consulta** | Solo lectura y exportación de reportes |

## Funcionalidades de costos y compras

- **Proveedores**: catálogo simple (nombre, RUC, teléfono, email).
- **Sectores**: áreas que consumen insumos (Cocina, Recepción, etc.), se crean dinámicamente.
- **Compras**: se carga una factura de compra (cabecera + detalle de líneas). Cada línea genera
  automáticamente una entrada de stock. Si el insumo de una línea no existe todavía en el
  catálogo, se crea solo con el nombre (después se puede completar categoría, mínimo, etc.
  desde "Insumos").
- **Costo promedio ponderado**: cada vez que entra stock con un precio unitario (manual o desde
  una factura), se recalcula el costo promedio del insumo **en ese depósito**. Las salidas usan
  ese costo promedio para calcular el gasto real, y **no lo modifican**. Las anulaciones tampoco
  lo modifican, para no distorsionar el promedio con correcciones administrativas.
- **Sector obligatorio en salidas**: toda salida de stock pide elegir a qué sector se le imputa,
  lo que permite el reporte de "Gasto por sector".
- **Logo de la empresa**: se sube como PNG/JPG, se redimensiona en el navegador y se guarda como
  texto (base64) en Firestore — no usa Firebase Storage, para no sumar otra pieza a configurar.
  Aparece en el login, el menú lateral y el PDF exportado. **No aparece como imagen en el Excel**
  exportado (la librería gratuita que usamos no soporta imágenes en celdas); ahí se muestra el
  nombre de la empresa como texto en el encabezado.

## Puesta en marcha (paso a paso)

### 1. Crear el proyecto en Firebase
1. Andá a https://console.firebase.google.com y creá un proyecto nuevo.
2. En **Authentication > Sign-in method**, habilitá **Email/Password**.
3. En **Firestore Database**, creá la base (modo producción).

### 2. Completar `firebase-config.js`
En Firebase Console: ⚙️ **Configuración del proyecto > Tus apps > Web (`</>`)**.
Copiá el objeto `firebaseConfig` y pegalo reemplazando los valores de ejemplo en `firebase-config.js`.

### 3. Subir las reglas de seguridad
En Firestore Database > **Reglas**, pegá el contenido de `firestore.rules` y publicá.
(Esto es lo que impide que alguien sin el rol correcto pueda escribir datos, aunque conozca la URL de la app).

### 4. Crear el primer usuario Admin
Como todavía no hay ningún Admin que pueda crear usuarios desde la app, el primero se crea a mano:
1. En **Authentication > Users**, agregá un usuario manualmente (email + contraseña).
2. Copiá su **UID**.
3. En **Firestore Database**, creá la colección `usuarios` con un documento cuyo **ID sea ese UID**, con estos campos:
   ```
   nombre: "Tu nombre"
   email: "tu@empresa.com"
   rol: "admin"
   depositosAsignados: []
   activo: true
   ```
4. Listo: ese usuario ya puede loguearse en la app y desde "Usuarios" dar de alta al resto del equipo.

### 5. Cargar datos base
Iniciá sesión como Admin y cargá, en este orden:
1. **Depósitos** (al menos uno).
2. **Categorías** (opcional, desde Insumos > Categorías).
3. **Insumos** (con su stock mínimo).
4. Desde "Usuarios", el resto del equipo con su rol y, si son Encargados, sus depósitos.

### 6. Publicar en GitHub Pages
1. Creá un repositorio en GitHub y subí estos archivos (`index.html`, `app.js`, `firebase-config.js`, `permissions.js`, `styles.css`).
   **No hace falta subir `firestore.rules`** al hosting — eso vive solo en Firebase Console, pero convenía versionarlo igual dentro del repo como referencia.
2. En el repo: **Settings > Pages > Source**, elegí la rama principal (`main`) y carpeta raíz (`/`).
3. GitHub te va a dar una URL pública (`https://tu-usuario.github.io/tu-repo/`) en uno o dos minutos.

### 7. Autorizar el dominio en Firebase
En **Authentication > Settings > Authorized domains**, agregá el dominio de GitHub Pages
(`tu-usuario.github.io`), si no, el login va a fallar en producción aunque funcione en local.

## Cómo probarlo en local
No hace falta servidor: podés abrir `index.html` directo en el navegador, o servirlo con
cualquier servidor estático simple (por ejemplo `npx serve .`), solo para evitar restricciones
del navegador con `file://`.

## Notas de diseño importantes
- El **stock se guarda por insumo + depósito** (no es un número único global).
- Los **movimientos nunca se editan ni se borran**: un error se corrige con un movimiento
  inverso ("ajuste"), así el historial de auditoría queda intacto. Solo el Admin puede anular.
- Las **alertas de stock mínimo son visuales** dentro de la app (no se manda email).
- Crear un usuario nuevo usa una instancia "secundaria" de Firebase para no cerrar la sesión
  del Admin que lo está dando de alta.

## Módulo de Activos: archivos nuevos y pasos extra

Este módulo agrega archivos que **no** son parte de la app principal (no
cargan React ni Babel, son deliberadamente livianos para que abran rápido
en un celular al escanear el QR):

- `activo.html` — la ficha pública que se abre al escanear el QR.
- `manifest.json` y `sw.js` — hacen que `activo.html` se pueda "instalar"
  como PWA en el celular.
- `icon-192.png` / `icon-512.png` — íconos de esa PWA (son un placeholder
  genérico con una "A"; reemplazalos por el logo real de la empresa cuando
  quieras, manteniendo esos mismos nombres de archivo).

**Pasos extra al desplegar este módulo:**
1. Subí estos archivos nuevos al repo, junto a los demás (mismo nivel que
   `index.html`).
2. Volvé a publicar `firestore.rules` — la colección `activos` pasa a tener
   **lectura pública a propósito** (para que la ficha del QR funcione sin
   login), y se agregan los catálogos de tipos/pisos/racks/filas/columnas y
   la colección `activosCosto` (donde vive el costo, de lectura restringida).
3. No hace falta ningún dominio ni configuración extra en Firebase para
   `activo.html` — usa el mismo proyecto y las mismas credenciales que el
   resto de la app.
