# Changelog — Control de Stock (Toku Importados)

Todas las versiones y qué cambió en cada una. El número de versión visible en
el pie del menú lateral de la app corresponde a la última entrada de acá.

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
