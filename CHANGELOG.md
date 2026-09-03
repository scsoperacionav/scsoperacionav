# Changelog — Control de Stock (Toku Importados)

Todas las versiones y qué cambió en cada una. El número de versión visible en
el pie del menú lateral de la app corresponde a la última entrada de acá.

## [1.5.2] - 2026-09-02
- **Corrección importante**: la ficha pública del QR (`activo.html`) no
  cargaba nunca — le faltaba el script de Firebase Authentication, que
  `firebase-config.js` necesita aunque esa página no pida login. Se agrega
  el script faltante, más un manejo de errores más robusto para que, si algo
  similar vuelve a pasar, se vea un aviso claro en vez de quedarse colgado en
  "Cargando..." sin ninguna pista.
- **Corrección**: la foto adjunta a un activo salía estirada/deformada en la
  ficha PDF descargable, porque se forzaba a un rectángulo de tamaño fijo.
  Ahora se calcula el tamaño respetando la proporción real de la imagen.

## [1.5.1] - 2026-07-27
- **Código automático por activo**: cada activo recibe un código secuencial
  (ACT-00001, ACT-00002...) asignado de forma atómica al crearlo, con el
  mismo mecanismo de contador que usa la numeración de movimientos. Visible
  en la tabla, el formulario, el modal de QR, la ficha PDF, la plancha de
  etiquetas y la ficha pública del QR.
- **Foto del activo** (opcional): se puede adjuntar una foto al cargar o
  editar un activo (se redimensiona y comprime en el navegador, igual que el
  logo de la empresa). Aparece como miniatura en la tabla, y completa en el
  modal de QR, la ficha PDF y la ficha pública.
- **Corrección**: al editar un activo, el campo "Costo" ahora sí carga el
  valor guardado anteriormente (antes aparecía vacío porque el costo vive en
  un documento aparte, de lectura restringida).
- Encabezado de versión agregado a `firestore.rules`, para poder confirmar
  de un vistazo si las reglas publicadas en Firebase Console están al día
  con la versión de la app.
- La ficha pública del QR ahora muestra el motivo real del error si algo
  falla al cargar (antes siempre mostraba el mismo mensaje genérico).

## [1.5.0] - 2026-07-27
- **Nuevo módulo "Activos"**: registro de bienes (muebles, sillas, cortinas y
  demás) con ubicación jerárquica (Piso / Depósito / Rack / Fila / Columna,
  todos catálogos dinámicos gestionables desde "Catálogos de Activos"). Cada
  activo puede representar un ítem único o un grupo (con cantidad).
- **QR automático por activo**: se genera en el navegador (sin depender de
  ningún servicio externo) y apunta a una ficha del activo. Se puede
  descargar una ficha individual en PDF (QR + datos + espacio para pegar), o
  seleccionar varios activos e imprimir una plancha de etiquetas QR juntas
  para recortar.
- **Página pública `activo.html`** (sin login): al escanear el QR desde
  cualquier celular se abre la ficha del activo — nombre, tipo, cantidad,
  estado, fecha de ingreso y ubicación. Instalable como PWA para acceso
  rápido del personal. El costo/valor del activo (si se carga) **no** es
  parte de esta página pública — vive en un documento aparte de lectura
  restringida, solo visible logueado en el sistema.
- Permisos nuevos: gestión de Activos (Admin, Supervisor y Encargado en sus
  depósitos), eliminación (solo Admin), y catálogos de tipos/ubicación
  (Admin y Supervisor).

## [1.4.0] - 2026-07-27
- **Nuevo módulo "Toma de Inventario"**: elegís un depósito y descargás un
  PDF con todos sus insumos, stock del sistema, y columnas en blanco para
  anotar la cantidad contada y la diferencia — listo para imprimir y usar en
  el conteo físico. Disponible también para Encargado de Depósito (solo
  lectura/impresión, no modifica nada).
- **Nuevo módulo "Ajuste de Inventario"** (Admin y Supervisor): permite
  corregir el stock del sistema según lo contado. Dos formas de cargarlo:
  - **Conteo completo**: tabla con todos los insumos de un depósito, cargás
    la cantidad contada donde haya diferencia, y el sistema genera todos los
    ajustes juntos.
  - **Ajuste rápido**: corrige un solo insumo puntual sin tener que recontar
    todo el depósito.
  Los ajustes se registran como movimientos tipo "ajuste" (no afectan el
  costo promedio ponderado, no piden sector) y quedan en un historial propio
  con botón "Ver", igual que Compras y Salidas.

## [1.3.2] - 2026-07-27
- **Corrección importante**: el botón "Anular" ya no queda disponible en un
  movimiento que ya fue anulado antes — evita generar dos correcciones sobre
  el mismo movimiento (lo que dejaría el stock mal calculado). Ahora, un
  movimiento ya anulado se ve atenuado en la tabla con una etiqueta
  "Anulado" al lado del tipo.

## [1.3.1] - 2026-07-27
- **Corrección**: las tablas con muchas columnas (Movimientos, Reportes) ya
  no recortan las últimas columnas cuando no entran en el ancho de la
  pantalla — ahora aparece una barra de scroll horizontal en la tabla en vez
  de tapar el contenido.

## [1.3.0] - 2026-07-27
- **Menú lateral colapsable**: nuevo botón (« / ») arriba del menú para
  ocultarlo o desplegarlo. Colapsado, muestra solo la inicial de cada
  sección (con el nombre completo al pasar el mouse). La preferencia se
  recuerda en el navegador, así que queda como lo dejaste la próxima vez
  que entrás.

## [1.2.0] - 2026-07-27
- **Numeración automática de operaciones**: cada movimiento (entrada, salida
  o ajuste) ahora tiene un número secuencial único (columna "N°"), asignado
  de forma atómica junto con la transacción de stock — no se pueden repetir
  ni saltear números aunque dos personas registren al mismo tiempo. Visible
  en el historial de "Movimientos" y en el historial de "Reportes". Las
  anulaciones ahora referencian el número de operación en vez del ID interno
  de Firestore, mucho más legible.
- **Reportes → Stock actual**: los filtros pasaron a estar directamente en el
  encabezado de la tabla (estilo planilla), uno por columna — Insumo (buscar
  por texto), Depósito (desplegable), Cantidad y Mínimo (valor exacto), y
  Alerta (Sí/No). Se pueden combinar varios filtros a la vez.

## [1.1.0] - 2026-07-23
- El campo único "Motivo / Solicitante" del formulario de Salida se separó en
  dos campos independientes: **Motivo** y **Solicitante**. Se reflejan por
  separado en el detalle, el PDF, el historial de movimientos y los reportes.
- El PDF de comprobante de salida ahora usa el campo **Solicitante** (no el
  Motivo) para el nombre impreso junto a la línea de firma.
- Se agregó el número de versión de la app, visible en el pie del menú lateral.

## [1.0.0] - 2026-07-23
Primera versión versionada, con el estado acumulado de todo lo construido
hasta acá:
- Control de stock multi-depósito con roles (Admin, Supervisor, Encargado de
  Depósito, Consulta) y permisos por rol.
- Catálogo de Insumos con categorías y subcategorías.
- Depósitos, Sectores y Proveedores (CRUD dinámico).
- **Compras**: registro de factura de compra (cabecera + detalle en tabla,
  con autocompletar de insumos), genera entradas de stock automáticamente y
  crea insumos nuevos al vuelo si no existen en el catálogo.
- **Salida**: registro de salida múltiple (varios insumos en una sola
  operación) con sector obligatorio, formato tabla con autocompletar.
- Costo promedio ponderado por insumo y depósito, recalculado en cada entrada
  con precio. Las salidas calculan el gasto real usando ese costo.
- Reportes: Stock actual, Historial de movimientos y Gasto por sector,
  exportables a Excel y PDF, con filtros por columna estilo planilla.
- Botón "Ver" con detalle de solo lectura para facturas de compra y salidas
  registradas, y exportación a PDF del comprobante de salida con espacio de
  firma.
- Gestión de usuarios con alta, edición de nombre/rol/depósitos asignados, y
  activar/desactivar.
- Configuración de logo y nombre de empresa (aparece en login, menú y PDF).
- Movimientos inmutables: los errores se corrigen con un movimiento inverso
  (ajuste), nunca se edita ni se borra el original. Solo Admin puede anular.
- Eliminar depósitos: restringido a Admin, y bloqueado si el depósito
  todavía tiene stock cargado.
