// permissions.js
// Define los roles del sistema y qué puede hacer cada uno.
// Este archivo se carga ANTES que app.js y expone todo como variables globales.

const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  ENCARGADO: 'encargado',
  CONSULTA: 'consulta',
};

const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.ENCARGADO]: 'Encargado de Depósito',
  [ROLES.CONSULTA]: 'Consulta',
};

// Matriz de permisos: acción -> lista de roles habilitados
const PERMISSIONS = {
  gestionarInsumos: [ROLES.ADMIN, ROLES.SUPERVISOR],
  gestionarDepositos: [ROLES.ADMIN, ROLES.SUPERVISOR],
  eliminarDepositos: [ROLES.ADMIN],
  gestionarCategorias: [ROLES.ADMIN, ROLES.SUPERVISOR],
  registrarMovimiento: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.ENCARGADO],
  anularMovimiento: [ROLES.ADMIN],
  exportarReportes: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CONSULTA],
  gestionarUsuarios: [ROLES.ADMIN],
  configurarMinimos: [ROLES.ADMIN, ROLES.SUPERVISOR],
  gestionarProveedores: [ROLES.ADMIN, ROLES.SUPERVISOR],
  gestionarSectores: [ROLES.ADMIN, ROLES.SUPERVISOR],
  registrarCompra: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.ENCARGADO],
  gestionarConfiguracion: [ROLES.ADMIN],
};

function tienePermiso(rolUsuario, permiso) {
  if (!rolUsuario) return false;
  return (PERMISSIONS[permiso] || []).includes(rolUsuario);
}

// Roles que ven y operan TODOS los depósitos sin restricción
const ROLES_ACCESO_TOTAL_DEPOSITOS = [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CONSULTA];

function puedeVerDeposito(usuario, depositoId) {
  if (!usuario) return false;
  if (ROLES_ACCESO_TOTAL_DEPOSITOS.includes(usuario.rol)) return true;
  return (usuario.depositosAsignados || []).includes(depositoId);
}

function puedeOperarDeposito(usuario, depositoId) {
  if (!usuario) return false;
  if (usuario.rol === ROLES.ADMIN || usuario.rol === ROLES.SUPERVISOR) return true;
  if (usuario.rol === ROLES.ENCARGADO) {
    return (usuario.depositosAsignados || []).includes(depositoId);
  }
  return false;
}

function depositosVisibles(usuario, todosLosDepositos) {
  if (!usuario) return [];
  if (ROLES_ACCESO_TOTAL_DEPOSITOS.includes(usuario.rol)) return todosLosDepositos;
  return todosLosDepositos.filter((d) => (usuario.depositosAsignados || []).includes(d.id));
}
