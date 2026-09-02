// app.js
// App de control de stock de insumos. React sin build, vía Babel standalone.
// Depende de: firebase-config.js y permissions.js (deben cargarse antes que este archivo).

const { useState, useEffect, useMemo, useRef } = React;

// Versión de la app: se actualiza a mano en cada tanda de cambios que se sube.
// Ver CHANGELOG.md para el detalle de qué cambió en cada versión.
const APP_VERSION = '1.5.1';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function formatFecha(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stockDocId(insumoId, depositoId) {
  return `${insumoId}_${depositoId}`;
}

function claseNivelStock(cantidad, minimo) {
  if (cantidad <= minimo) return 'low';
  if (cantidad <= minimo * 1.5) return 'mid';
  return '';
}

// Formatea montos en guaraníes: sin decimales, con puntos de miles (Gs. x.xxx.xxx).
function formatGs(numero) {
  const redondeado = Math.round(Number(numero) || 0);
  return `Gs. ${redondeado.toLocaleString('es-PY')}`;
}

// ---------------------------------------------------------------------------
// Componentes genéricos
// ---------------------------------------------------------------------------

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

// ---------------------------------------------------------------------------
// Pantalla de Login
// ---------------------------------------------------------------------------

function LoginScreen({ configuracion }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      setError('No pudimos iniciar sesión. Revisá el email y la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        {configuracion.logoBase64 ? (
          <img src={configuracion.logoBase64} alt="Logo" style={{ maxHeight: 40, marginBottom: 8 }} />
        ) : (
          <div className="mark">CONTROL DE STOCK</div>
        )}
        {configuracion.nombreEmpresa && <div className="mark">{configuracion.nombreEmpresa.toUpperCase()}</div>}
        <h1>Iniciar sesión</h1>
        <p className="sub">Ingresá con el email y contraseña que te asignó el administrador.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout: Sidebar + navegación
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Panel general', permiso: null },
  { id: 'movimientos', label: 'Movimientos', permiso: null },
  { id: 'compras', label: 'Compras', permiso: 'registrarCompra' },
  { id: 'insumos', label: 'Insumos', permiso: null },
  { id: 'depositos', label: 'Depósitos', permiso: null },
  { id: 'sectores', label: 'Sectores', permiso: null },
  { id: 'proveedores', label: 'Proveedores', permiso: null },
  { id: 'reportes', label: 'Reportes', permiso: 'exportarReportes' },
  { id: 'tomaInventario', label: 'Toma de Inventario', permiso: 'imprimirTomaInventario' },
  { id: 'ajusteInventario', label: 'Ajuste de Inventario', permiso: 'ajustarInventario' },
  { id: 'activos', label: 'Activos', permiso: null },
  { id: 'catalogosActivos', label: 'Catálogos de Activos', permiso: 'gestionarCatalogosActivos' },
  { id: 'usuarios', label: 'Usuarios', permiso: 'gestionarUsuarios' },
  { id: 'configuracion', label: 'Configuración', permiso: 'gestionarConfiguracion' },
];

function Sidebar({ vista, setVista, usuario, configuracion, colapsado, onToggleColapso }) {
  const itemsVisibles = NAV_ITEMS.filter((item) => !item.permiso || tienePermiso(usuario.rol, item.permiso));

  return (
    <div className={`sidebar ${colapsado ? 'sidebar-colapsado' : ''}`}>
      <div className="sidebar-brand">
        {!colapsado && (
          configuracion.logoBase64 ? (
            <img src={configuracion.logoBase64} alt="Logo" style={{ height: 26, width: 'auto', borderRadius: 4 }} />
          ) : (
            <span className="mark">#</span>
          )
        )}
        {!colapsado && <span className="name">{configuracion.nombreEmpresa || 'Stock Ops'}</span>}
        <button
          className="sidebar-toggle"
          onClick={onToggleColapso}
          title={colapsado ? 'Expandir menú' : 'Ocultar menú'}
        >
          {colapsado ? '»' : '«'}
        </button>
      </div>

      <nav>
        {itemsVisibles.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${vista === item.id ? 'active' : ''}`}
            onClick={() => setVista(item.id)}
            title={colapsado ? item.label : undefined}
          >
            {colapsado ? item.label.charAt(0) : item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!colapsado && (
          <React.Fragment>
            <div>{usuario.nombre || usuario.email}</div>
            <span className="role-tag">{ROLE_LABELS[usuario.rol] || usuario.rol}</span>
          </React.Fragment>
        )}
        <button onClick={() => auth.signOut()} title={colapsado ? 'Cerrar sesión' : undefined}>
          {colapsado ? '⏻' : 'Cerrar sesión'}
        </button>
        {!colapsado && <div style={{ marginTop: 10, fontSize: 10.5, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>v{APP_VERSION}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function DashboardView({ usuario, insumos, depositos, stock }) {
  const depositosVisiblesList = useMemo(() => depositosVisibles(usuario, depositos), [usuario, depositos]);

  const filas = useMemo(() => {
    const out = [];
    insumos.forEach((insumo) => {
      depositosVisiblesList.forEach((dep) => {
        const s = stock[stockDocId(insumo.id, dep.id)];
        const cantidad = s ? s.cantidad : 0;
        out.push({ insumo, deposito: dep, cantidad });
      });
    });
    return out;
  }, [insumos, depositosVisiblesList, stock]);

  const bajoMinimo = filas.filter((f) => f.cantidad <= f.insumo.stockMinimo);
  const totalInsumos = insumos.length;
  const totalDepositos = depositosVisiblesList.length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Panel general</h1>
          <p>Estado del stock en los depósitos que podés ver.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="label">Insumos activos</div>
          <div className="value">{totalInsumos}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Depósitos</div>
          <div className="value">{totalDepositos}</div>
        </div>
        <div className={`card stat-card ${bajoMinimo.length > 0 ? 'warn' : ''}`}>
          <div className="label">Alertas de stock mínimo</div>
          <div className="value">{bajoMinimo.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Insumos por debajo del mínimo</h2>
        {bajoMinimo.length === 0 ? (
          <EmptyState text="No hay insumos por debajo del mínimo en este momento." />
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr><th>Insumo</th><th>Depósito</th><th>Stock actual</th><th>Mínimo</th></tr>
              </thead>
              <tbody>
                {bajoMinimo.map((f) => (
                  <tr key={f.insumo.id + f.deposito.id}>
                    <td>{f.insumo.nombre}</td>
                    <td>{f.deposito.nombre}</td>
                    <td className="qty">
                      <span className={`bin-tag ${claseNivelStock(f.cantidad, f.insumo.stockMinimo)}`}>{f.cantidad} {f.insumo.unidadMedida}</span>
                    </td>
                    <td className="qty">{f.insumo.stockMinimo} {f.insumo.unidadMedida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categorías (gestión simple: nombre + lista de subcategorías)
// ---------------------------------------------------------------------------

function CategoriasModal({ categorias, onClose }) {
  const [nombreNueva, setNombreNueva] = useState('');
  const [subNueva, setSubNueva] = useState({});

  async function crearCategoria() {
    if (!nombreNueva.trim()) return;
    await db.collection('categorias').add({ nombre: nombreNueva.trim(), subcategorias: [] });
    setNombreNueva('');
  }

  async function eliminarCategoria(cat) {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Los insumos que la usan quedarán sin categoría.`)) return;
    await db.collection('categorias').doc(cat.id).delete();
  }

  async function agregarSubcategoria(cat) {
    const nombre = (subNueva[cat.id] || '').trim();
    if (!nombre) return;
    await db.collection('categorias').doc(cat.id).update({
      subcategorias: [...(cat.subcategorias || []), nombre],
    });
    setSubNueva({ ...subNueva, [cat.id]: '' });
  }

  async function quitarSubcategoria(cat, sub) {
    await db.collection('categorias').doc(cat.id).update({
      subcategorias: (cat.subcategorias || []).filter((s) => s !== sub),
    });
  }

  return (
    <Modal title="Categorías y subcategorías" onClose={onClose}>
      <div className="field" style={{ display: 'flex', gap: 8 }}>
        <input placeholder="Nueva categoría" value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)} />
        <button className="btn btn-outline" onClick={crearCategoria}>Agregar</button>
      </div>

      {categorias.length === 0 && <EmptyState text="Todavía no hay categorías creadas." />}

      {categorias.map((cat) => (
        <div key={cat.id} className="card" style={{ marginBottom: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13.5 }}>{cat.nombre}</strong>
            <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => eliminarCategoria(cat)}>Eliminar</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
            {(cat.subcategorias || []).map((sub) => (
              <span key={sub} className="role-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {sub}
                <span style={{ cursor: 'pointer', color: 'var(--danger)' }} onClick={() => quitarSubcategoria(cat, sub)}>×</span>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              placeholder="Nueva subcategoría"
              style={{ padding: '6px 9px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 6, flex: 1 }}
              value={subNueva[cat.id] || ''}
              onChange={(e) => setSubNueva({ ...subNueva, [cat.id]: e.target.value })}
            />
            <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => agregarSubcategoria(cat)}>+</button>
          </div>
        </div>
      ))}

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Insumos
// ---------------------------------------------------------------------------

const UNIDADES_MEDIDA = ['unidad', 'kg', 'g', 'litro', 'ml', 'caja', 'paquete', 'metro'];

function InsumoForm({ insumo, categorias, onClose }) {
  const [form, setForm] = useState(insumo || {
    nombre: '', categoriaId: '', subcategoria: '', unidadMedida: 'unidad', stockMinimo: 0, proveedor: '', activo: true,
  });
  const [guardando, setGuardando] = useState(false);
  const categoriaSeleccionada = categorias.find((c) => c.id === form.categoriaId);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    const data = { ...form, stockMinimo: Number(form.stockMinimo) || 0 };
    if (insumo) {
      await db.collection('insumos').doc(insumo.id).update(data);
    } else {
      await db.collection('insumos').add(data);
    }
    setGuardando(false);
    onClose();
  }

  return (
    <Modal title={insumo ? 'Editar insumo' : 'Nuevo insumo'} onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Nombre</label>
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div className="field">
          <label>Categoría</label>
          <select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value, subcategoria: '' })}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        {categoriaSeleccionada && (categoriaSeleccionada.subcategorias || []).length > 0 && (
          <div className="field">
            <label>Subcategoría</label>
            <select value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })}>
              <option value="">Sin subcategoría</option>
              {categoriaSeleccionada.subcategorias.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label>Unidad de medida</label>
          <select value={form.unidadMedida} onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })}>
            {UNIDADES_MEDIDA.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Stock mínimo (dispara la alerta)</label>
          <input type="number" min="0" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} />
        </div>
        <div className="field">
          <label>Proveedor (opcional)</label>
          <input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function InsumosView({ usuario, insumos, categorias }) {
  const [modalInsumo, setModalInsumo] = useState(null); // null | 'nuevo' | insumoObj
  const [modalCategorias, setModalCategorias] = useState(false);
  const puedeEscribir = tienePermiso(usuario.rol, 'gestionarInsumos');

  async function eliminarInsumo(insumo) {
    if (!confirm(`¿Eliminar "${insumo.nombre}"? Esto no borra su historial de movimientos.`)) return;
    await db.collection('insumos').doc(insumo.id).delete();
  }

  function nombreCategoria(id) {
    const c = categorias.find((c) => c.id === id);
    return c ? c.nombre : '-';
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Insumos</h1>
          <p>Catálogo de insumos, organizados por categoría y subcategoría.</p>
        </div>
        {puedeEscribir && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setModalCategorias(true)}>Categorías</button>
            <button className="btn btn-accent" onClick={() => setModalInsumo('nuevo')}>+ Nuevo insumo</button>
          </div>
        )}
      </div>

      <div className="table-wrap">
        {insumos.length === 0 ? <EmptyState text="No hay insumos cargados todavía." /> : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th><th>Categoría</th><th>Subcategoría</th><th>Unidad</th><th>Mínimo</th>
                {puedeEscribir && <th></th>}
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => (
                <tr key={i.id}>
                  <td>{i.nombre}</td>
                  <td>{nombreCategoria(i.categoriaId)}</td>
                  <td>{i.subcategoria || '-'}</td>
                  <td>{i.unidadMedida}</td>
                  <td className="qty">{i.stockMinimo}</td>
                  {puedeEscribir && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setModalInsumo(i)}>Editar</button>
                      <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => eliminarInsumo(i)}>Eliminar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalInsumo && (
        <InsumoForm
          insumo={modalInsumo === 'nuevo' ? null : modalInsumo}
          categorias={categorias}
          onClose={() => setModalInsumo(null)}
        />
      )}
      {modalCategorias && <CategoriasModal categorias={categorias} onClose={() => setModalCategorias(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Depósitos
// ---------------------------------------------------------------------------

function DepositoForm({ deposito, onClose }) {
  const [form, setForm] = useState(deposito || { nombre: '', direccion: '', activo: true });
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    if (deposito) {
      await db.collection('depositos').doc(deposito.id).update(form);
    } else {
      await db.collection('depositos').add(form);
    }
    setGuardando(false);
    onClose();
  }

  return (
    <Modal title={deposito ? 'Editar depósito' : 'Nuevo depósito'} onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Nombre</label>
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div className="field">
          <label>Dirección / referencia (opcional)</label>
          <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DepositosView({ usuario, depositos, stock }) {
  const [modal, setModal] = useState(null);
  const puedeEscribir = tienePermiso(usuario.rol, 'gestionarDepositos');
  const puedeEliminar = tienePermiso(usuario.rol, 'eliminarDepositos');

  function tieneStock(dep) {
    return Object.values(stock).some((s) => s.depositoId === dep.id && s.cantidad > 0);
  }

  async function eliminarDeposito(dep) {
    if (tieneStock(dep)) {
      alert(`No se puede eliminar "${dep.nombre}" porque todavía tiene stock cargado. Vaciá el stock (con salidas) antes de eliminarlo.`);
      return;
    }
    if (!confirm(`¿Eliminar el depósito "${dep.nombre}"? El historial de movimientos se conserva.`)) return;
    await db.collection('depositos').doc(dep.id).delete();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Depósitos</h1>
          <p>Ubicaciones donde se almacena el stock.</p>
        </div>
        {puedeEscribir && <button className="btn btn-accent" onClick={() => setModal('nuevo')}>+ Nuevo depósito</button>}
      </div>

      <div className="table-wrap">
        {depositos.length === 0 ? <EmptyState text="No hay depósitos creados todavía." /> : (
          <table>
            <thead><tr><th>Nombre</th><th>Dirección</th>{(puedeEscribir || puedeEliminar) && <th></th>}</tr></thead>
            <tbody>
              {depositos.map((d) => (
                <tr key={d.id}>
                  <td>{d.nombre}</td>
                  <td>{d.direccion || '-'}</td>
                  {(puedeEscribir || puedeEliminar) && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {puedeEscribir && <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setModal(d)}>Editar</button>}
                      {puedeEliminar && <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => eliminarDeposito(d)}>Eliminar</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && <DepositoForm deposito={modal === 'nuevo' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sectores (destino del gasto en cada salida: Cocina, Limpieza general, etc.)
// ---------------------------------------------------------------------------

function SectorForm({ sector, onClose }) {
  const [form, setForm] = useState(sector || { nombre: '', activo: true });
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    if (sector) {
      await db.collection('sectores').doc(sector.id).update(form);
    } else {
      await db.collection('sectores').add(form);
    }
    setGuardando(false);
    onClose();
  }

  return (
    <Modal title={sector ? 'Editar sector' : 'Nuevo sector'} onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Nombre</label>
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Cocina, Recepción, Mantenimiento" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SectoresView({ sectores }) {
  const [modal, setModal] = useState(null);

  async function eliminar(s) {
    if (!confirm(`¿Eliminar el sector "${s.nombre}"? El historial de gastos se conserva.`)) return;
    await db.collection('sectores').doc(s.id).delete();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sectores</h1>
          <p>Áreas que consumen insumos, usadas para reportar el gasto de cada salida.</p>
        </div>
        <button className="btn btn-accent" onClick={() => setModal('nuevo')}>+ Nuevo sector</button>
      </div>

      <div className="table-wrap">
        {sectores.length === 0 ? <EmptyState text="No hay sectores creados todavía." /> : (
          <table>
            <thead><tr><th>Nombre</th><th></th></tr></thead>
            <tbody>
              {sectores.map((s) => (
                <tr key={s.id}>
                  <td>{s.nombre}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setModal(s)}>Editar</button>
                    <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => eliminar(s)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && <SectorForm sector={modal === 'nuevo' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

function ProveedorForm({ proveedor, onClose }) {
  const [form, setForm] = useState(proveedor || { nombre: '', ruc: '', telefono: '', email: '', direccion: '', activo: true });
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    if (proveedor) {
      await db.collection('proveedores').doc(proveedor.id).update(form);
    } else {
      await db.collection('proveedores').add(form);
    }
    setGuardando(false);
    onClose();
  }

  return (
    <Modal title={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Nombre / Razón social</label>
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div className="field">
          <label>RUC (opcional)</label>
          <input value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
        </div>
        <div className="field">
          <label>Teléfono (opcional)</label>
          <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
        </div>
        <div className="field">
          <label>Email (opcional)</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label>Dirección (opcional)</label>
          <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ProveedoresView({ proveedores }) {
  const [modal, setModal] = useState(null);

  async function eliminar(p) {
    if (!confirm(`¿Eliminar el proveedor "${p.nombre}"? El historial de compras se conserva.`)) return;
    await db.collection('proveedores').doc(p.id).delete();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Proveedores</h1>
          <p>Empresas a las que se les compran insumos.</p>
        </div>
        <button className="btn btn-accent" onClick={() => setModal('nuevo')}>+ Nuevo proveedor</button>
      </div>

      <div className="table-wrap">
        {proveedores.length === 0 ? <EmptyState text="No hay proveedores cargados todavía." /> : (
          <table>
            <thead><tr><th>Nombre</th><th>RUC</th><th>Teléfono</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{p.ruc || '-'}</td>
                  <td>{p.telefono || '-'}</td>
                  <td>{p.email || '-'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setModal(p)}>Editar</button>
                    <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => eliminar(p)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && <ProveedorForm proveedor={modal === 'nuevo' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movimientos (entradas / salidas / ajustes) + transacción de stock
// ---------------------------------------------------------------------------

// Registra un movimiento y actualiza el documento de stock correspondiente
// (cantidad + costo promedio ponderado) dentro de una transacción, para evitar
// condiciones de carrera si dos personas cargan movimientos del mismo insumo
// al mismo tiempo.
//
// Costo promedio ponderado: cuando entra stock CON precioUnitario (ej: desde
// una factura de compra), se recalcula el costo promedio del insumo en ESE
// depósito. Las salidas usan ese costo promedio para calcular el gasto real,
// y no lo modifican. Los ajustes (anulaciones) tampoco lo modifican, para no
// distorsionar el promedio con correcciones administrativas.
async function registrarMovimiento({
  insumo, deposito, tipo, cantidad, motivo, usuario,
  precioUnitario, sector, esAjuste, movimientoOriginalId, proveedorId, facturaCompraId, solicitante,
}) {
  if (tipo === 'salida' && !esAjuste && !sector) {
    throw new Error('El sector es obligatorio para registrar una salida.');
  }

  const stockId = stockDocId(insumo.id, deposito.id);
  const stockRef = db.collection('stock').doc(stockId);
  const movRef = db.collection('movimientos').doc();
  const contadorRef = db.collection('contadores').doc('movimientos');

  await db.runTransaction(async (tx) => {
    // Todas las lecturas de una transacción van antes que cualquier escritura.
    const stockSnap = await tx.get(stockRef);
    const contadorSnap = await tx.get(contadorRef);
    const numeroMovimiento = (contadorSnap.exists ? contadorSnap.data().ultimo : 0) + 1;

    const stockData = stockSnap.exists ? stockSnap.data() : {};
    const cantidadActual = stockData.cantidad || 0;
    const costoPromedioActual = stockData.costoPromedio || 0;

    let nuevaCantidad;
    let nuevoCostoPromedio = costoPromedioActual;
    let costoUnitarioMovimiento = costoPromedioActual;
    let gasto = null;

    if (tipo === 'entrada') {
      nuevaCantidad = cantidadActual + cantidad;
      if (!esAjuste && precioUnitario > 0) {
        // Recalcula el promedio ponderado incorporando la nueva entrada.
        nuevoCostoPromedio = ((cantidadActual * costoPromedioActual) + (cantidad * precioUnitario)) / nuevaCantidad;
        costoUnitarioMovimiento = precioUnitario;
      }
    } else {
      // salida (incluye la salida generada al anular una entrada)
      nuevaCantidad = cantidadActual - cantidad;
      if (nuevaCantidad < 0) {
        throw new Error('La salida deja el stock en negativo. Revisá la cantidad.');
      }
      costoUnitarioMovimiento = costoPromedioActual;
      if (!esAjuste) {
        gasto = Number((cantidad * costoPromedioActual).toFixed(2));
      }
    }

    tx.set(stockRef, {
      insumoId: insumo.id,
      depositoId: deposito.id,
      cantidad: nuevaCantidad,
      costoPromedio: nuevoCostoPromedio,
    }, { merge: true });

    tx.set(contadorRef, { ultimo: numeroMovimiento }, { merge: true });

    tx.set(movRef, {
      numero: numeroMovimiento,
      insumoId: insumo.id,
      insumoNombre: insumo.nombre,
      depositoId: deposito.id,
      depositoNombre: deposito.nombre,
      tipo,
      cantidad,
      costoUnitario: Number(costoUnitarioMovimiento.toFixed(4)),
      gasto,
      sectorId: sector ? sector.id : null,
      sectorNombre: sector ? sector.nombre : null,
      motivo: motivo || '',
      solicitante: solicitante || '',
      usuarioId: usuario.uid,
      usuarioNombre: usuario.nombre || usuario.email,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      movimientoOriginalId: movimientoOriginalId || null,
      proveedorId: proveedorId || null,
      facturaCompraId: facturaCompraId || null,
    });
  });
}

// Anula un movimiento generando el contramovimiento inverso (nunca se borra el original).
// Se marca esAjuste para que NO afecte el costo promedio ponderado del insumo.
async function anularMovimiento(movimiento, insumos, depositos, usuario) {
  const insumo = insumos.find((i) => i.id === movimiento.insumoId);
  const deposito = depositos.find((d) => d.id === movimiento.depositoId);
  if (!insumo || !deposito) throw new Error('No se encontró el insumo o depósito original.');

  const tipoInverso = movimiento.tipo === 'entrada' ? 'salida' : 'entrada';
  // Conservamos el sector original como referencia si lo tenía, solo a modo informativo
  // (no es obligatorio: es un ajuste, no una salida real).
  const sector = movimiento.sectorId ? { id: movimiento.sectorId, nombre: movimiento.sectorNombre } : null;

  await registrarMovimiento({
    insumo, deposito,
    tipo: tipoInverso,
    cantidad: movimiento.cantidad,
    motivo: `Anulación de la operación #${movimiento.numero || movimiento.id}`,
    usuario,
    esAjuste: true,
    sector,
    movimientoOriginalId: movimiento.id,
  });
}

// Salida múltiple: una sola operación (un depósito, un sector) puede sacar varios
// insumos distintos a la vez, con el mismo formato tabla que Compras. Sin precio:
// el gasto se calcula solo con el costo promedio ya guardado en el stock.
function RegistrarSalidaForm({ usuario, insumos, depositos, sectores, onClose }) {
  const depositosOperables = depositos.filter((d) => puedeOperarDeposito(usuario, d.id));
  const [cabecera, setCabecera] = useState({
    depositoId: depositosOperables[0]?.id || '', sectorId: '',
    fecha: new Date().toISOString().slice(0, 10), motivo: '', solicitante: '',
  });
  const [lineas, setLineas] = useState([{ key: Math.random().toString(36).slice(2), insumoTexto: '', cantidad: '' }]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function actualizarLinea(key, campo, valor) {
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  function agregarLinea() {
    setLineas((ls) => [...ls, { key: Math.random().toString(36).slice(2), insumoTexto: '', cantidad: '' }]);
  }

  function quitarLinea(key) {
    setLineas((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  function insumoPorNombre(texto) {
    const t = texto.trim().toLowerCase();
    return insumos.find((i) => i.nombre.trim().toLowerCase() === t);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');

    const deposito = depositos.find((d) => d.id === cabecera.depositoId);
    const sector = sectores.find((s) => s.id === cabecera.sectorId);

    if (!deposito || !sector) {
      setError('Completá el depósito y el sector.');
      return;
    }

    const lineasConTexto = lineas.filter((l) => l.insumoTexto.trim() && Number(l.cantidad) > 0);
    if (lineasConTexto.length === 0) {
      setError('Agregá al menos una línea con insumo y cantidad.');
      return;
    }

    // A diferencia de Compras, en una salida el insumo TIENE que existir en el
    // catálogo (no se puede sacar stock de algo que nunca entró).
    const lineasSinMatch = lineasConTexto.filter((l) => !insumoPorNombre(l.insumoTexto));
    if (lineasSinMatch.length > 0) {
      setError(`No encontramos "${lineasSinMatch[0].insumoTexto}" en el catálogo de insumos. Elegí una opción de la lista.`);
      return;
    }

    setGuardando(true);
    try {
      const salidaRef = db.collection('salidas').doc();
      const detalleGuardado = [];

      for (const linea of lineasConTexto) {
        const insumo = insumoPorNombre(linea.insumoTexto);
        const cantidad = Number(linea.cantidad);

        await registrarMovimiento({
          insumo, deposito, tipo: 'salida', cantidad,
          motivo: cabecera.motivo, solicitante: cabecera.solicitante, usuario, sector,
        });

        detalleGuardado.push({ insumoId: insumo.id, insumoNombre: insumo.nombre, cantidad });
      }

      await salidaRef.set({
        depositoId: deposito.id, depositoNombre: deposito.nombre,
        sectorId: sector.id, sectorNombre: sector.nombre,
        fecha: cabecera.fecha, motivo: cabecera.motivo, solicitante: cabecera.solicitante,
        detalle: detalleGuardado,
        usuarioId: usuario.uid, usuarioNombre: usuario.nombre || usuario.email,
        fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
      });

      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar la salida.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Registrar salida" onClose={onClose} wide>
      <form onSubmit={guardar}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Depósito</label>
            <select required value={cabecera.depositoId} onChange={(e) => setCabecera({ ...cabecera, depositoId: e.target.value })}>
              <option value="">Seleccioná un depósito</option>
              {depositosOperables.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Sector que retira</label>
            <select required value={cabecera.sectorId} onChange={(e) => setCabecera({ ...cabecera, sectorId: e.target.value })}>
              <option value="">Seleccioná un sector</option>
              {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Fecha</label>
            <input type="date" required value={cabecera.fecha} onChange={(e) => setCabecera({ ...cabecera, fecha: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Motivo (opcional)</label>
            <input value={cabecera.motivo} onChange={(e) => setCabecera({ ...cabecera, motivo: e.target.value })} placeholder="Ej: reposición semanal" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Solicitante (opcional)</label>
            <input value={cabecera.solicitante} onChange={(e) => setCabecera({ ...cabecera, solicitante: e.target.value })} placeholder="Ej: Juan Pérez" />
          </div>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 500, display: 'block', marginBottom: 6 }}>Detalle de insumos</label>

        <datalist id="lista-insumos-catalogo-salida">
          {insumos.map((i) => <option key={i.id} value={i.nombre} />)}
        </datalist>

        <table className="detalle-table">
          <thead>
            <tr>
              <th className="col-item">Ítem</th>
              <th>Descripción</th>
              <th className="col-cantidad">Cantidad</th>
              <th className="col-quitar"></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => {
              const existe = !!insumoPorNombre(l.insumoTexto);
              return (
                <tr key={l.key}>
                  <td className="col-item">{idx + 1}</td>
                  <td>
                    <input
                      list="lista-insumos-catalogo-salida"
                      placeholder="Escribí para buscar un insumo del catálogo"
                      value={l.insumoTexto}
                      onChange={(e) => actualizarLinea(l.key, 'insumoTexto', e.target.value)}
                    />
                    {l.insumoTexto.trim() && !existe && (
                      <div className="hint" style={{ color: 'var(--danger)' }}>No existe en el catálogo.</div>
                    )}
                  </td>
                  <td className="col-cantidad">
                    <input type="number" min="0.01" step="0.01" value={l.cantidad} onChange={(e) => actualizarLinea(l.key, 'cantidad', e.target.value)} />
                  </td>
                  <td className="col-quitar">
                    <button type="button" className="btn btn-danger" style={{ padding: '5px 8px', fontSize: 12 }} onClick={() => quitarLinea(l.key)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" className="btn btn-outline" style={{ marginBottom: 14 }} onClick={agregarLinea}>+ Agregar línea</button>

        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar salida'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SalidaDetalleModal({ salida, onClose }) {
  return (
    <Modal title={`Salida - ${salida.sectorNombre}`} onClose={onClose} wide>
      <div className="filters-row" style={{ marginBottom: 6 }}>
        <div><strong>Depósito:</strong> {salida.depositoNombre}</div>
        <div><strong>Sector:</strong> {salida.sectorNombre}</div>
        <div><strong>Fecha:</strong> {salida.fecha}</div>
      </div>
      {(salida.motivo || salida.solicitante) && (
        <div className="filters-row" style={{ marginBottom: 14 }}>
          {salida.motivo && <div style={{ fontSize: 13.5 }}><strong>Motivo:</strong> {salida.motivo}</div>}
          {salida.solicitante && <div style={{ fontSize: 13.5 }}><strong>Solicitante:</strong> {salida.solicitante}</div>}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Insumo</th><th>Cantidad</th></tr></thead>
          <tbody>
            {(salida.detalle || []).map((d, idx) => (
              <tr key={idx}><td>{d.insumoNombre}</td><td className="qty">{d.cantidad}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

// Genera un comprobante imprimible de la salida, con el detalle de insumos y un
// espacio de firma al pie mostrando el sector/solicitante cargado en "Motivo".
function exportarSalidaPDF(salida, configuracion) {
  const doc = new jspdf.jsPDF();
  let y = 16;

  if (configuracion.logoBase64) {
    try { doc.addImage(configuracion.logoBase64, 'JPEG', 150, 8, 40, 20); } catch (e) { /* logo inválido, seguimos sin él */ }
  }

  doc.setFontSize(13);
  doc.text(configuracion.nombreEmpresa || 'Comprobante de salida', 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text('Comprobante de salida de stock', 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.text(`Fecha: ${salida.fecha}`, 14, y);
  doc.text(`Depósito: ${salida.depositoNombre}`, 90, y);
  y += 5;
  doc.text(`Sector: ${salida.sectorNombre}`, 14, y);
  doc.text(`Registrado por: ${salida.usuarioNombre}`, 90, y);
  y += 5;
  if (salida.motivo) {
    doc.text(`Motivo: ${salida.motivo}`, 14, y);
    y += 5;
  }
  if (salida.solicitante) {
    doc.text(`Solicitante: ${salida.solicitante}`, 14, y);
    y += 5;
  }
  y += 4;

  doc.autoTable({
    startY: y,
    head: [['Insumo', 'Cantidad']],
    body: (salida.detalle || []).map((d) => [d.insumoNombre, d.cantidad]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 27, 51] },
  });

  const finalY = doc.lastAutoTable.finalY + 26;
  doc.setFontSize(10);
  doc.line(14, finalY, 110, finalY);
  doc.text('Firma de conformidad', 14, finalY + 5);
  doc.setFontSize(9);
  doc.text(salida.solicitante || salida.sectorNombre, 14, finalY + 11);

  doc.save(`Salida_${salida.fecha}_${salida.sectorNombre.replace(/ /g, '_')}.pdf`);
}

function SalidasRegistradasTabla({ usuario, depositos, configuracion }) {
  const [salidas, setSalidas] = useState([]);
  const [verSalida, setVerSalida] = useState(null);

  useEffect(() => {
    const unsub = db.collection('salidas').orderBy('fechaRegistro', 'desc').limit(100)
      .onSnapshot((snap) => setSalidas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const visibles = salidas.filter((s) => puedeVerDeposito(usuario, s.depositoId));

  return (
    <div className="table-wrap">
      {visibles.length === 0 ? <EmptyState text="No hay salidas registradas todavía." /> : (
        <table>
          <thead><tr><th>Fecha</th><th>Depósito</th><th>Sector</th><th>Ítems</th><th>Motivo</th><th>Solicitante</th><th>Registrado por</th><th></th></tr></thead>
          <tbody>
            {visibles.map((s) => (
              <tr key={s.id}>
                <td>{s.fecha}</td>
                <td>{s.depositoNombre}</td>
                <td>{s.sectorNombre}</td>
                <td className="qty">{(s.detalle || []).length}</td>
                <td>{s.motivo || '-'}</td>
                <td>{s.solicitante || '-'}</td>
                <td>{s.usuarioNombre}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setVerSalida(s)}>Ver</button>
                  <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => exportarSalidaPDF(s, configuracion)}>PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {verSalida && <SalidaDetalleModal salida={verSalida} onClose={() => setVerSalida(null)} />}
    </div>
  );
}

function MovimientosView({ usuario, insumos, depositos, sectores, configuracion }) {
  const [modalSalida, setModalSalida] = useState(false);
  const [tab, setTab] = useState('movimientos');
  const [movimientos, setMovimientos] = useState([]);
  const [filtros, setFiltros] = useState({
    tipo: '', insumoId: '', depositoId: '', sectorId: '', usuario: '', motivo: '', solicitante: '',
  });
  const puedeRegistrar = tienePermiso(usuario.rol, 'registrarMovimiento');
  const puedeAnular = tienePermiso(usuario.rol, 'anularMovimiento');

  useEffect(() => {
    const unsub = db.collection('movimientos').orderBy('fecha', 'desc').limit(200)
      .onSnapshot((snap) => setMovimientos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  function setFiltro(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  const visibles = movimientos
    .filter((m) => puedeVerDeposito(usuario, m.depositoId))
    .filter((m) => !filtros.tipo || m.tipo === filtros.tipo)
    .filter((m) => !filtros.insumoId || m.insumoId === filtros.insumoId)
    .filter((m) => !filtros.depositoId || m.depositoId === filtros.depositoId)
    .filter((m) => !filtros.sectorId || m.sectorId === filtros.sectorId)
    .filter((m) => !filtros.usuario || (m.usuarioNombre || '').toLowerCase().includes(filtros.usuario.toLowerCase()))
    .filter((m) => !filtros.motivo || (m.motivo || '').toLowerCase().includes(filtros.motivo.toLowerCase()))
    .filter((m) => !filtros.solicitante || (m.solicitante || '').toLowerCase().includes(filtros.solicitante.toLowerCase()));

  const depositosVisiblesList = depositosVisibles(usuario, depositos);

  // IDs de movimientos que YA tienen un ajuste de anulación generado (para no
  // permitir anular dos veces el mismo movimiento y para marcarlo visualmente).
  const idsAnulados = useMemo(
    () => new Set(movimientos.filter((m) => m.movimientoOriginalId).map((m) => m.movimientoOriginalId)),
    [movimientos]
  );

  async function handleAnular(m) {
    if (idsAnulados.has(m.id)) {
      alert('Este movimiento ya fue anulado antes. No se puede anular dos veces.');
      return;
    }
    if (!confirm('¿Anular este movimiento? Se va a generar un movimiento inverso para dejar el stock correcto.')) return;
    try {
      await anularMovimiento(m, insumos, depositos, usuario);
    } catch (err) {
      alert(err.message || 'No se pudo anular el movimiento.');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Movimientos</h1>
          <p>Historial de stock y registro de salidas. Las entradas se cargan desde "Compras".</p>
        </div>
        {puedeRegistrar && <button className="btn btn-accent" onClick={() => setModalSalida(true)}>+ Salida</button>}
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'movimientos' ? 'active' : ''}`} onClick={() => setTab('movimientos')}>Movimientos (línea por línea)</div>
        <div className={`tab ${tab === 'salidas' ? 'active' : ''}`} onClick={() => setTab('salidas')}>Salidas registradas</div>
      </div>

      {tab === 'movimientos' && (
        <div className="table-wrap">
          {movimientos.length === 0 ? <EmptyState text="No hay movimientos todavía." /> : (
            <table>
              <thead>
                <tr><th>N°</th><th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Depósito</th><th>Cantidad</th><th>Sector</th><th>Gasto</th><th>Usuario</th><th>Motivo</th><th>Solicitante</th>{puedeAnular && <th></th>}</tr>
                <tr className="filter-row">
                  <th></th>
                  <th></th>
                  <th>
                    <select value={filtros.tipo} onChange={(e) => setFiltro('tipo', e.target.value)}>
                      <option value="">Todos</option>
                      <option value="entrada">Entrada</option>
                      <option value="salida">Salida</option>
                    </select>
                  </th>
                  <th>
                    <select value={filtros.insumoId} onChange={(e) => setFiltro('insumoId', e.target.value)}>
                      <option value="">Todos</option>
                      {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                    </select>
                  </th>
                  <th>
                    <select value={filtros.depositoId} onChange={(e) => setFiltro('depositoId', e.target.value)}>
                      <option value="">Todos</option>
                      {depositosVisiblesList.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                  </th>
                  <th></th>
                  <th>
                    <select value={filtros.sectorId} onChange={(e) => setFiltro('sectorId', e.target.value)}>
                      <option value="">Todos</option>
                      {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </th>
                  <th></th>
                  <th>
                    <input placeholder="Buscar..." value={filtros.usuario} onChange={(e) => setFiltro('usuario', e.target.value)} />
                  </th>
                  <th>
                    <input placeholder="Buscar..." value={filtros.motivo} onChange={(e) => setFiltro('motivo', e.target.value)} />
                  </th>
                  <th>
                    <input placeholder="Buscar..." value={filtros.solicitante} onChange={(e) => setFiltro('solicitante', e.target.value)} />
                  </th>
                  {puedeAnular && <th></th>}
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 ? (
                  <tr><td colSpan={puedeAnular ? 12 : 11}><EmptyState text="No hay movimientos que coincidan con los filtros." /></td></tr>
                ) : visibles.map((m) => (
                  <tr key={m.id} style={idsAnulados.has(m.id) ? { opacity: 0.6 } : undefined}>
                    <td className="qty">{m.numero || '-'}</td>
                    <td>{formatFecha(m.fecha)}</td>
                    <td>
                      <span className={`bin-tag ${m.tipo === 'salida' ? 'low' : ''}`}>{m.tipo}</span>
                      {idsAnulados.has(m.id) && <span className="role-badge" style={{ marginLeft: 6 }}>Anulado</span>}
                    </td>
                    <td>{m.insumoNombre}</td>
                    <td>{m.depositoNombre}</td>
                    <td className="qty">{m.cantidad}</td>
                    <td>{m.sectorNombre || '-'}</td>
                    <td className="qty">{m.gasto != null ? formatGs(m.gasto) : '-'}</td>
                    <td>{m.usuarioNombre}</td>
                    <td>{m.motivo || '-'}{m.movimientoOriginalId ? ' (ajuste)' : ''}</td>
                    <td>{m.solicitante || '-'}</td>
                    {puedeAnular && (
                      <td>
                        {!m.movimientoOriginalId && !idsAnulados.has(m.id) && (
                          <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleAnular(m)}>Anular</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'salidas' && <SalidasRegistradasTabla usuario={usuario} depositos={depositos} configuracion={configuracion} />}

      {modalSalida && (
        <RegistrarSalidaForm
          usuario={usuario}
          insumos={insumos}
          depositos={depositos.filter((d) => puedeOperarDeposito(usuario, d.id))}
          sectores={sectores}
          onClose={() => setModalSalida(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compras (factura de compra: cabecera + detalle -> genera entradas de stock)
// ---------------------------------------------------------------------------

function RegistrarFacturaCompraForm({ usuario, insumos, depositos, proveedores, onClose }) {
  const depositosOperables = depositos.filter((d) => puedeOperarDeposito(usuario, d.id));
  const [cabecera, setCabecera] = useState({
    proveedorId: '', numeroFactura: '', timbrado: '', fecha: new Date().toISOString().slice(0, 10),
    depositoId: depositosOperables[0]?.id || '',
  });
  // Cada línea guarda lo que el usuario escribió (insumoTexto) y, si coincide con
  // un insumo existente, insumoId ya resuelto para no tener que buscarlo de nuevo.
  const [lineas, setLineas] = useState([{ key: Math.random().toString(36).slice(2), insumoTexto: '', cantidad: '', precioUnitario: '' }]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function actualizarLinea(key, campo, valor) {
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  function agregarLinea() {
    setLineas((ls) => [...ls, { key: Math.random().toString(36).slice(2), insumoTexto: '', cantidad: '', precioUnitario: '' }]);
  }

  function quitarLinea(key) {
    setLineas((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  function insumoPorNombre(texto) {
    const t = texto.trim().toLowerCase();
    return insumos.find((i) => i.nombre.trim().toLowerCase() === t);
  }

  const total = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0);

  async function guardar(e) {
    e.preventDefault();
    setError('');

    const proveedor = proveedores.find((p) => p.id === cabecera.proveedorId);
    const deposito = depositos.find((d) => d.id === cabecera.depositoId);

    if (!proveedor || !deposito || !cabecera.numeroFactura) {
      setError('Completá proveedor, depósito y número de factura.');
      return;
    }

    const lineasValidas = lineas.filter((l) => l.insumoTexto.trim() && Number(l.cantidad) > 0 && Number(l.precioUnitario) >= 0);
    if (lineasValidas.length === 0) {
      setError('Agregá al menos una línea de detalle válida (insumo, cantidad y precio).');
      return;
    }

    setGuardando(true);
    try {
      const facturaRef = db.collection('facturasCompra').doc();
      const detalleGuardado = [];

      for (const linea of lineasValidas) {
        let insumo = insumoPorNombre(linea.insumoTexto);

        // Si el nombre escrito no coincide con ningún insumo del catálogo, se crea uno nuevo.
        if (!insumo) {
          const nuevoRef = await db.collection('insumos').add({
            nombre: linea.insumoTexto.trim(),
            categoriaId: '', subcategoria: '', unidadMedida: 'unidad', stockMinimo: 0, proveedor: proveedor.nombre, activo: true,
          });
          insumo = { id: nuevoRef.id, nombre: linea.insumoTexto.trim() };
        }

        const cantidad = Number(linea.cantidad);
        const precioUnitario = Number(linea.precioUnitario);

        await registrarMovimiento({
          insumo, deposito, tipo: 'entrada', cantidad, precioUnitario,
          motivo: `Compra factura ${cabecera.numeroFactura} - ${proveedor.nombre}`,
          usuario, proveedorId: proveedor.id, facturaCompraId: facturaRef.id,
        });

        detalleGuardado.push({
          insumoId: insumo.id, insumoNombre: insumo.nombre, cantidad, precioUnitario,
          subtotal: Number((cantidad * precioUnitario).toFixed(2)),
        });
      }

      await facturaRef.set({
        proveedorId: proveedor.id, proveedorNombre: proveedor.nombre,
        numeroFactura: cabecera.numeroFactura, timbrado: cabecera.timbrado,
        fecha: cabecera.fecha, depositoId: deposito.id, depositoNombre: deposito.nombre,
        total: Number(total.toFixed(2)),
        detalle: detalleGuardado,
        usuarioId: usuario.uid, usuarioNombre: usuario.nombre || usuario.email,
        fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
      });

      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar la factura de compra.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Registrar factura de compra" onClose={onClose} wide>
      <form onSubmit={guardar}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Proveedor</label>
            <select required value={cabecera.proveedorId} onChange={(e) => setCabecera({ ...cabecera, proveedorId: e.target.value })}>
              <option value="">Seleccioná un proveedor</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Depósito destino</label>
            <select required value={cabecera.depositoId} onChange={(e) => setCabecera({ ...cabecera, depositoId: e.target.value })}>
              <option value="">Seleccioná un depósito</option>
              {depositosOperables.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>N° de factura</label>
            <input required value={cabecera.numeroFactura} onChange={(e) => setCabecera({ ...cabecera, numeroFactura: e.target.value })} placeholder="172-003-0250121" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Fecha</label>
            <input type="date" required value={cabecera.fecha} onChange={(e) => setCabecera({ ...cabecera, fecha: e.target.value })} />
          </div>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 500, display: 'block', marginBottom: 6 }}>Detalle de insumos</label>

        <datalist id="lista-insumos-catalogo">
          {insumos.map((i) => <option key={i.id} value={i.nombre} />)}
        </datalist>

        <table className="detalle-table">
          <thead>
            <tr>
              <th className="col-item">Ítem</th>
              <th>Descripción</th>
              <th className="col-cantidad">Cantidad</th>
              <th className="col-precio">Precio unitario</th>
              <th className="col-subtotal">Subtotal</th>
              <th className="col-quitar"></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => {
              const subtotal = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
              const existe = !!insumoPorNombre(l.insumoTexto);
              return (
                <tr key={l.key}>
                  <td className="col-item">{idx + 1}</td>
                  <td>
                    <input
                      list="lista-insumos-catalogo"
                      placeholder="Escribí para buscar o crear un insumo"
                      value={l.insumoTexto}
                      onChange={(e) => actualizarLinea(l.key, 'insumoTexto', e.target.value)}
                    />
                    {l.insumoTexto.trim() && !existe && (
                      <div className="hint">Insumo nuevo: se va a crear en el catálogo.</div>
                    )}
                  </td>
                  <td className="col-cantidad">
                    <input type="number" min="0.01" step="0.01" value={l.cantidad} onChange={(e) => actualizarLinea(l.key, 'cantidad', e.target.value)} />
                  </td>
                  <td className="col-precio">
                    <input type="number" min="0" step="1" value={l.precioUnitario} onChange={(e) => actualizarLinea(l.key, 'precioUnitario', e.target.value)} />
                  </td>
                  <td className="col-subtotal">{formatGs(subtotal)}</td>
                  <td className="col-quitar">
                    <button type="button" className="btn btn-danger" style={{ padding: '5px 8px', fontSize: 12 }} onClick={() => quitarLinea(l.key)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" className="btn btn-outline" style={{ marginBottom: 4 }} onClick={agregarLinea}>+ Agregar línea</button>

        <div className="detalle-total-row">
          <span>Total</span>
          <span className="monto">{formatGs(total)}</span>
        </div>

        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar factura'}</button>
        </div>
      </form>
    </Modal>
  );
}

function FacturaCompraDetalleModal({ factura, onClose }) {
  return (
    <Modal title={`Factura ${factura.numeroFactura}`} onClose={onClose} wide>
      <div className="filters-row" style={{ marginBottom: 6 }}>
        <div><strong>Proveedor:</strong> {factura.proveedorNombre}</div>
        <div><strong>Depósito:</strong> {factura.depositoNombre}</div>
        <div><strong>Fecha:</strong> {factura.fecha}</div>
      </div>
      {factura.timbrado && <div style={{ marginBottom: 14, fontSize: 13.5 }}><strong>Timbrado:</strong> {factura.timbrado}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Insumo</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead>
          <tbody>
            {(factura.detalle || []).map((d, idx) => (
              <tr key={idx}>
                <td>{d.insumoNombre}</td>
                <td className="qty">{d.cantidad}</td>
                <td className="qty">{formatGs(d.precioUnitario)}</td>
                <td className="qty">{formatGs(d.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="detalle-total-row">
        <span>Total</span>
        <span className="monto">{formatGs(factura.total || 0)}</span>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

function ComprasView({ usuario, insumos, depositos, proveedores }) {
  const [modal, setModal] = useState(false);
  const [verFactura, setVerFactura] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const puedeRegistrar = tienePermiso(usuario.rol, 'registrarCompra');

  useEffect(() => {
    const unsub = db.collection('facturasCompra').orderBy('fechaRegistro', 'desc').limit(100)
      .onSnapshot((snap) => setFacturas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Compras</h1>
          <p>Registro de facturas de compra: cada línea genera una entrada de stock.</p>
        </div>
        {puedeRegistrar && proveedores.length > 0 && (
          <button className="btn btn-accent" onClick={() => setModal(true)}>+ Registrar factura</button>
        )}
      </div>

      {puedeRegistrar && proveedores.length === 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          Todavía no hay proveedores cargados. Andá a "Proveedores" y creá al menos uno antes de registrar una factura.
        </div>
      )}

      <div className="table-wrap">
        {facturas.length === 0 ? <EmptyState text="No hay facturas de compra registradas todavía." /> : (
          <table>
            <thead><tr><th>Fecha</th><th>N° Factura</th><th>Proveedor</th><th>Depósito</th><th>Total</th><th>Registrado por</th><th></th></tr></thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id}>
                  <td>{f.fecha}</td>
                  <td>{f.numeroFactura}</td>
                  <td>{f.proveedorNombre}</td>
                  <td>{f.depositoNombre}</td>
                  <td className="qty">{formatGs(f.total || 0)}</td>
                  <td>{f.usuarioNombre}</td>
                  <td><button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setVerFactura(f)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {verFactura && <FacturaCompraDetalleModal factura={verFactura} onClose={() => setVerFactura(null)} />}

      {modal && (
        <RegistrarFacturaCompraForm
          usuario={usuario} insumos={insumos}
          depositos={depositos.filter((d) => puedeOperarDeposito(usuario, d.id))}
          proveedores={proveedores}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toma de Inventario: planilla imprimible por depósito, para contar en mano.
// ---------------------------------------------------------------------------

function exportarTomaInventarioPDF(deposito, filasInsumos, configuracion) {
  const doc = new jspdf.jsPDF();
  let y = 16;

  if (configuracion.logoBase64) {
    try { doc.addImage(configuracion.logoBase64, 'JPEG', 150, 8, 40, 20); } catch (e) { /* logo inválido */ }
  }

  doc.setFontSize(13);
  doc.text(configuracion.nombreEmpresa || 'Toma de Inventario', 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(`Toma de inventario — ${deposito.nombre}`, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-PY')}`, 14, y);
  doc.text('Responsable del conteo: _______________________', 90, y);
  y += 8;

  doc.autoTable({
    startY: y,
    head: [['Insumo', 'Unidad', 'Stock sistema', 'Cantidad contada', 'Diferencia']],
    body: filasInsumos.map((i) => [i.nombre, i.unidadMedida, i.stockSistema, '', '']),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [16, 27, 51] },
    columnStyles: {
      3: { cellWidth: 30 },
      4: { cellWidth: 26 },
    },
  });

  const finalY = doc.lastAutoTable.finalY + 16;
  doc.setFontSize(9);
  doc.text('Firma del responsable: _______________________', 14, finalY);

  doc.save(`Toma_inventario_${deposito.nombre.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function TomaInventarioView({ usuario, insumos, depositos, stock, configuracion }) {
  const depositosVisiblesList = depositosVisibles(usuario, depositos);
  const [depositoId, setDepositoId] = useState(depositosVisiblesList[0]?.id || '');
  const deposito = depositos.find((d) => d.id === depositoId);

  const filasInsumos = useMemo(() => {
    if (!deposito) return [];
    return insumos
      .map((i) => ({
        id: i.id,
        nombre: i.nombre,
        unidadMedida: i.unidadMedida,
        stockSistema: (stock[stockDocId(i.id, deposito.id)] || {}).cantidad || 0,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [insumos, stock, deposito]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Toma de Inventario</h1>
          <p>Generá la planilla de un depósito para contar físicamente, y descargala en PDF.</p>
        </div>
        {deposito && (
          <button className="btn btn-accent" onClick={() => exportarTomaInventarioPDF(deposito, filasInsumos, configuracion)}>
            Descargar PDF para contar
          </button>
        )}
      </div>

      <div className="filters-row">
        <select value={depositoId} onChange={(e) => setDepositoId(e.target.value)}>
          {depositosVisiblesList.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        {filasInsumos.length === 0 ? <EmptyState text="No hay insumos para este depósito." /> : (
          <table>
            <thead><tr><th>Insumo</th><th>Unidad</th><th>Stock sistema</th></tr></thead>
            <tbody>
              {filasInsumos.map((i) => (
                <tr key={i.id}>
                  <td>{i.nombre}</td>
                  <td>{i.unidadMedida}</td>
                  <td className="qty">{i.stockSistema}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ajuste de Inventario: corrige el stock del sistema con lo contado en mano.
// Genera movimientos de tipo "ajuste" (no afectan el costo promedio) y deja
// un registro agrupado (cabecera + detalle) para auditoría, igual que
// Compras y Salidas.
// ---------------------------------------------------------------------------

function ConteoCompletoForm({ usuario, insumos, depositos, stock, onClose }) {
  const depositosOperables = depositos.filter((d) => puedeOperarDeposito(usuario, d.id));
  const [depositoId, setDepositoId] = useState(depositosOperables[0]?.id || '');
  const deposito = depositos.find((d) => d.id === depositoId);
  const [contados, setContados] = useState({}); // insumoId -> valor tipeado (string)
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const filas = useMemo(() => {
    if (!deposito) return [];
    return insumos
      .map((i) => ({
        id: i.id,
        nombre: i.nombre,
        unidadMedida: i.unidadMedida,
        stockSistema: (stock[stockDocId(i.id, deposito.id)] || {}).cantidad || 0,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [insumos, stock, deposito]);

  function actualizarContado(insumoId, valor) {
    setContados((c) => ({ ...c, [insumoId]: valor }));
  }

  const filasConDiferencia = filas
    .filter((f) => contados[f.id] !== undefined && contados[f.id] !== '')
    .map((f) => ({ ...f, contado: Number(contados[f.id]), diferencia: Number(contados[f.id]) - f.stockSistema }))
    .filter((f) => f.diferencia !== 0);

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (!deposito) { setError('Elegí un depósito.'); return; }
    if (filasConDiferencia.length === 0) { setError('No cargaste ninguna diferencia para ajustar (todo lo contado coincide con el sistema, o no cargaste nada).'); return; }

    setGuardando(true);
    try {
      const ajusteRef = db.collection('ajustesInventario').doc();
      const detalleGuardado = [];

      for (const f of filasConDiferencia) {
        const insumo = { id: f.id, nombre: f.nombre };
        await registrarMovimiento({
          insumo, deposito,
          tipo: f.diferencia > 0 ? 'entrada' : 'salida',
          cantidad: Math.abs(f.diferencia),
          esAjuste: true,
          motivo: 'Ajuste por toma de inventario',
          usuario,
        });
        detalleGuardado.push({ insumoId: f.id, insumoNombre: f.nombre, stockSistema: f.stockSistema, stockContado: f.contado, diferencia: f.diferencia });
      }

      await ajusteRef.set({
        depositoId: deposito.id, depositoNombre: deposito.nombre,
        tipo: 'conteo_completo',
        detalle: detalleGuardado,
        usuarioId: usuario.uid, usuarioNombre: usuario.nombre || usuario.email,
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
      });

      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar el ajuste.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Conteo completo de depósito" onClose={onClose} wide>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Depósito</label>
          <select required value={depositoId} onChange={(e) => { setDepositoId(e.target.value); setContados({}); }}>
            <option value="">Seleccioná un depósito</option>
            {depositosOperables.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </div>
        <div className="hint" style={{ marginBottom: 10 }}>
          Cargá la cantidad contada solo en los insumos donde encontraste una diferencia. Los que dejes vacíos no se tocan.
        </div>

        {deposito && (
          <table className="detalle-table">
            <thead>
              <tr><th>Insumo</th><th className="col-cantidad">Stock sistema</th><th className="col-cantidad">Cantidad contada</th><th className="col-cantidad">Diferencia</th></tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const valor = contados[f.id];
                const diferencia = valor !== undefined && valor !== '' ? Number(valor) - f.stockSistema : null;
                return (
                  <tr key={f.id}>
                    <td>{f.nombre} <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>({f.unidadMedida})</span></td>
                    <td className="col-cantidad" style={{ paddingTop: 9 }}>{f.stockSistema}</td>
                    <td className="col-cantidad">
                      <input type="number" min="0" step="0.01" value={valor === undefined ? '' : valor} onChange={(e) => actualizarContado(f.id, e.target.value)} />
                    </td>
                    <td className="col-cantidad" style={{ paddingTop: 9, color: diferencia > 0 ? 'var(--success)' : diferencia < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {diferencia !== null ? (diferencia > 0 ? `+${diferencia}` : diferencia) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando || filasConDiferencia.length === 0}>
            {guardando ? 'Guardando...' : `Registrar ${filasConDiferencia.length} ajuste(s)`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AjusteRapidoForm({ usuario, insumos, depositos, stock, onClose }) {
  const depositosOperables = depositos.filter((d) => puedeOperarDeposito(usuario, d.id));
  const [depositoId, setDepositoId] = useState(depositosOperables[0]?.id || '');
  const [insumoTexto, setInsumoTexto] = useState('');
  const [cantidadReal, setCantidadReal] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const deposito = depositos.find((d) => d.id === depositoId);
  const insumo = insumos.find((i) => i.nombre.trim().toLowerCase() === insumoTexto.trim().toLowerCase());
  const stockSistema = insumo && deposito ? ((stock[stockDocId(insumo.id, deposito.id)] || {}).cantidad || 0) : null;
  const diferencia = stockSistema !== null && cantidadReal !== '' ? Number(cantidadReal) - stockSistema : null;

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (!deposito || !insumo || cantidadReal === '') {
      setError('Completá depósito, un insumo que exista en el catálogo, y la cantidad real.');
      return;
    }
    if (diferencia === 0) {
      setError('La cantidad contada es igual a la del sistema, no hay nada que ajustar.');
      return;
    }
    setGuardando(true);
    try {
      await registrarMovimiento({
        insumo, deposito,
        tipo: diferencia > 0 ? 'entrada' : 'salida',
        cantidad: Math.abs(diferencia),
        esAjuste: true,
        motivo: 'Ajuste rápido de inventario',
        usuario,
      });

      await db.collection('ajustesInventario').add({
        depositoId: deposito.id, depositoNombre: deposito.nombre,
        tipo: 'ajuste_rapido',
        detalle: [{ insumoId: insumo.id, insumoNombre: insumo.nombre, stockSistema, stockContado: Number(cantidadReal), diferencia }],
        usuarioId: usuario.uid, usuarioNombre: usuario.nombre || usuario.email,
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
      });

      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar el ajuste.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Ajuste rápido de un insumo" onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Depósito</label>
          <select required value={depositoId} onChange={(e) => setDepositoId(e.target.value)}>
            <option value="">Seleccioná un depósito</option>
            {depositosOperables.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Insumo</label>
          <datalist id="lista-insumos-ajuste">
            {insumos.map((i) => <option key={i.id} value={i.nombre} />)}
          </datalist>
          <input list="lista-insumos-ajuste" placeholder="Escribí para buscar" value={insumoTexto} onChange={(e) => setInsumoTexto(e.target.value)} />
        </div>
        {stockSistema !== null && (
          <div className="hint" style={{ marginBottom: 10 }}>Stock actual en el sistema: <strong>{stockSistema}</strong></div>
        )}
        <div className="field">
          <label>Cantidad real (contada)</label>
          <input type="number" min="0" step="0.01" value={cantidadReal} onChange={(e) => setCantidadReal(e.target.value)} />
        </div>
        {diferencia !== null && (
          <div className="hint" style={{ marginBottom: 10, color: diferencia > 0 ? 'var(--success)' : diferencia < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            Diferencia: {diferencia > 0 ? `+${diferencia}` : diferencia}
          </div>
        )}
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar ajuste'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AjusteDetalleModal({ ajuste, onClose }) {
  return (
    <Modal title={`Ajuste — ${ajuste.depositoNombre}`} onClose={onClose} wide>
      <div className="filters-row" style={{ marginBottom: 14 }}>
        <div><strong>Depósito:</strong> {ajuste.depositoNombre}</div>
        <div><strong>Tipo:</strong> {ajuste.tipo === 'conteo_completo' ? 'Conteo completo' : 'Ajuste rápido'}</div>
        <div><strong>Registrado por:</strong> {ajuste.usuarioNombre}</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Insumo</th><th>Stock sistema</th><th>Stock contado</th><th>Diferencia</th></tr></thead>
          <tbody>
            {(ajuste.detalle || []).map((d, idx) => (
              <tr key={idx}>
                <td>{d.insumoNombre}</td>
                <td className="qty">{d.stockSistema}</td>
                <td className="qty">{d.stockContado}</td>
                <td className="qty" style={{ color: d.diferencia > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {d.diferencia > 0 ? `+${d.diferencia}` : d.diferencia}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

function AjusteInventarioView({ usuario, insumos, depositos, stock }) {
  const [modalConteo, setModalConteo] = useState(false);
  const [modalRapido, setModalRapido] = useState(false);
  const [ajustes, setAjustes] = useState([]);
  const [verAjuste, setVerAjuste] = useState(null);

  useEffect(() => {
    const unsub = db.collection('ajustesInventario').orderBy('fecha', 'desc').limit(100)
      .onSnapshot((snap) => setAjustes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const visibles = ajustes.filter((a) => puedeVerDeposito(usuario, a.depositoId));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Ajuste de Inventario</h1>
          <p>Corregí el stock del sistema según lo contado físicamente. Genera un ajuste auditado, sin afectar el costo promedio.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setModalRapido(true)}>Ajuste rápido</button>
          <button className="btn btn-accent" onClick={() => setModalConteo(true)}>+ Conteo completo</button>
        </div>
      </div>

      <div className="table-wrap">
        {visibles.length === 0 ? <EmptyState text="No hay ajustes de inventario registrados todavía." /> : (
          <table>
            <thead><tr><th>Fecha</th><th>Depósito</th><th>Tipo</th><th>Ítems ajustados</th><th>Registrado por</th><th></th></tr></thead>
            <tbody>
              {visibles.map((a) => (
                <tr key={a.id}>
                  <td>{formatFecha(a.fecha)}</td>
                  <td>{a.depositoNombre}</td>
                  <td>{a.tipo === 'conteo_completo' ? 'Conteo completo' : 'Ajuste rápido'}</td>
                  <td className="qty">{(a.detalle || []).length}</td>
                  <td>{a.usuarioNombre}</td>
                  <td><button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setVerAjuste(a)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalConteo && <ConteoCompletoForm usuario={usuario} insumos={insumos} depositos={depositos} stock={stock} onClose={() => setModalConteo(false)} />}
      {modalRapido && <AjusteRapidoForm usuario={usuario} insumos={insumos} depositos={depositos} stock={stock} onClose={() => setModalRapido(false)} />}
      {verAjuste && <AjusteDetalleModal ajuste={verAjuste} onClose={() => setVerAjuste(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catálogos simples reutilizables (Tipos de activo, Pisos, Racks, Filas, Columnas)
// Todos son colecciones planas con un solo campo "nombre" — se reutiliza el
// mismo formulario/tabla para las cinco, cambiando solo la colección y la
// etiqueta que se muestra.
// ---------------------------------------------------------------------------

function CatalogoSimpleForm({ coleccion, item, etiqueta, placeholder, onClose }) {
  const [nombre, setNombre] = useState(item ? item.nombre : '');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    if (item) {
      await db.collection(coleccion).doc(item.id).update({ nombre });
    } else {
      await db.collection(coleccion).add({ nombre, activo: true });
    }
    setGuardando(false);
    onClose();
  }

  return (
    <Modal title={item ? `Editar ${etiqueta}` : `Nuevo ${etiqueta}`} onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Nombre</label>
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={placeholder} autoFocus />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function CatalogoSimpleView({ coleccion, etiqueta, etiquetaPlural, placeholder, items, puedeEscribir }) {
  const [modal, setModal] = useState(null);

  async function eliminar(item) {
    if (!confirm(`¿Eliminar "${item.nombre}"? Los activos que ya lo usan conservan el nombre guardado, pero no vas a poder elegirlo de nuevo.`)) return;
    await db.collection(coleccion).doc(item.id).delete();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{etiquetaPlural}</h1>
        </div>
        {puedeEscribir && <button className="btn btn-accent" onClick={() => setModal('nuevo')}>+ Nuevo {etiqueta}</button>}
      </div>

      <div className="table-wrap">
        {items.length === 0 ? <EmptyState text={`No hay ${etiquetaPlural.toLowerCase()} creados todavía.`} /> : (
          <table>
            <thead><tr><th>Nombre</th>{puedeEscribir && <th></th>}</tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.nombre}</td>
                  {puedeEscribir && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setModal(it)}>Editar</button>
                      <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => eliminar(it)}>Eliminar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <CatalogoSimpleForm
          coleccion={coleccion} etiqueta={etiqueta} placeholder={placeholder}
          item={modal === 'nuevo' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function CatalogosActivosView({ usuario, tiposActivo, pisos, racks, filas, columnas }) {
  const [tab, setTab] = useState('tipos');
  const puedeEscribir = tienePermiso(usuario.rol, 'gestionarCatalogosActivos');

  const TABS = [
    { id: 'tipos', label: 'Tipos de activo', coleccion: 'tiposActivo', etiqueta: 'tipo', items: tiposActivo, placeholder: 'Ej: Silla, Mueble, Cortina' },
    { id: 'pisos', label: 'Pisos', coleccion: 'pisos', etiqueta: 'piso', items: pisos, placeholder: 'Ej: Planta baja, Piso 1' },
    { id: 'racks', label: 'Racks', coleccion: 'racks', etiqueta: 'rack', items: racks, placeholder: 'Ej: Rack A' },
    { id: 'filas', label: 'Filas', coleccion: 'filas', etiqueta: 'fila', items: filas, placeholder: 'Ej: Fila 3' },
    { id: 'columnas', label: 'Columnas', coleccion: 'columnas', etiqueta: 'columna', items: columnas, placeholder: 'Ej: Columna 2' },
  ];
  const actual = TABS.find((t) => t.id === tab);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Catálogos de Activos</h1>
          <p>Tipos y ubicación (Piso / Rack / Fila / Columna) que se usan al registrar un activo.</p>
        </div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>
      <CatalogoSimpleView
        coleccion={actual.coleccion} etiqueta={actual.etiqueta} etiquetaPlural={actual.label}
        placeholder={actual.placeholder} items={actual.items} puedeEscribir={puedeEscribir}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activos (muebles, sillas, cortinas y demás bienes con seguimiento por QR)
// ---------------------------------------------------------------------------

const ESTADOS_ACTIVO = ['activo', 'mantenimiento', 'baja'];
const ESTADO_LABELS = { activo: 'Activo', mantenimiento: 'En mantenimiento', baja: 'De baja' };

// Genera la imagen del QR (como PNG en base64) enteramente en el navegador,
// sin depender de ningún servicio externo. QRCode.js dibuja en un <canvas>
// oculto y de ahí se extrae la imagen.
function generarQRDataURL(texto, tamano) {
  return new Promise((resolve) => {
    const contenedor = document.createElement('div');
    contenedor.style.position = 'fixed';
    contenedor.style.left = '-9999px';
    document.body.appendChild(contenedor);
    new QRCode(contenedor, { text: texto, width: tamano || 240, height: tamano || 240, correctLevel: QRCode.CorrectLevel.M });
    setTimeout(() => {
      const canvas = contenedor.querySelector('canvas');
      const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
      document.body.removeChild(contenedor);
      resolve(dataUrl);
    }, 80);
  });
}

// URL base de la página pública del QR. Se arma a partir de dónde está
// corriendo la app ahora mismo, así funciona igual en local y en producción
// sin tener que hardcodear el dominio de GitHub Pages.
function urlBaseActivos() {
  return window.location.href.replace(/index\.html?$/, '').replace(/\/?$/, '/') + 'activo.html';
}

async function exportarFichaActivoPDF(activo, configuracion) {
  const url = `${urlBaseActivos()}?id=${activo.id}`;
  const qrDataUrl = await generarQRDataURL(url, 300);

  const doc = new jspdf.jsPDF();
  let y = 16;
  if (configuracion.logoBase64) {
    try { doc.addImage(configuracion.logoBase64, 'JPEG', 150, 8, 40, 20); } catch (e) { /* logo inválido */ }
  }
  doc.setFontSize(13);
  doc.text(configuracion.nombreEmpresa || 'Ficha de activo', 14, y);
  y += 10;
  doc.setFontSize(15);
  doc.text(activo.nombre, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(activo.codigo || '', 14, y);
  doc.setTextColor(0);
  y += 8;

  if (activo.fotoBase64) {
    try {
      doc.addImage(activo.fotoBase64, 'JPEG', 14, y, 180, 55);
      y += 60;
    } catch (e) { /* foto inválida, seguimos sin ella */ }
  }

  doc.addImage(qrDataUrl, 'PNG', 14, y, 55, 55);

  const xTexto = 78;
  let yTexto = y + 6;
  doc.setFontSize(10);
  const lineas = [
    ['Tipo', activo.tipoNombre || '-'],
    ['Cantidad', String(activo.cantidad || 1)],
    ['Estado', ESTADO_LABELS[activo.estado] || activo.estado],
    ['Fecha de ingreso', activo.fechaIngreso || '-'],
    ['Piso', activo.pisoNombre || '-'],
    ['Depósito', activo.depositoNombre || '-'],
    ['Rack', activo.rackNombre || '-'],
    ['Fila', activo.filaNombre || '-'],
    ['Columna', activo.columnaNombre || '-'],
  ];
  lineas.forEach(([label, valor]) => {
    doc.setFont(undefined, 'bold');
    doc.text(`${label}:`, xTexto, yTexto);
    doc.setFont(undefined, 'normal');
    doc.text(String(valor), xTexto + 32, yTexto);
    yTexto += 6;
  });

  y += 62;
  if (activo.descripcion) {
    doc.setFontSize(9);
    doc.text('Descripción:', 14, y);
    const partido = doc.splitTextToSize(activo.descripcion, 180);
    doc.text(partido, 14, y + 5);
    y += 5 + partido.length * 4.5;
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Escaneá el código QR para ver esta ficha desde el celular.', 14, 285);

  doc.save(`Activo_${activo.nombre.replace(/ /g, '_')}.pdf`);
}

async function exportarPlanchaQRPDF(activos, configuracion) {
  const doc = new jspdf.jsPDF();
  const cols = 3;
  const marginX = 12;
  const marginY = 16;
  const cellW = 62;
  const cellH = 68;
  let col = 0;
  let row = 0;
  let y = marginY;

  doc.setFontSize(12);
  doc.text(configuracion.nombreEmpresa || 'Etiquetas de activos', marginX, 10);

  for (const activo of activos) {
    const url = `${urlBaseActivos()}?id=${activo.id}`;
    const qrDataUrl = await generarQRDataURL(url, 200);

    const x = marginX + col * cellW;
    const yPos = marginY + row * cellH;

    doc.setDrawColor(210);
    doc.rect(x, yPos, cellW - 4, cellH - 4);
    doc.addImage(qrDataUrl, 'PNG', x + (cellW - 4 - 40) / 2, yPos + 4, 40, 40);
    doc.setFontSize(8);
    doc.setTextColor(20);
    const nombreCorto = doc.splitTextToSize(activo.nombre, cellW - 8);
    doc.text(nombreCorto, x + 2, yPos + 48);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(activo.codigo || '', x + 2, yPos + 48 + nombreCorto.length * 3.5);
    doc.setTextColor(20);

    col++;
    if (col >= cols) {
      col = 0;
      row++;
      if (marginY + (row + 1) * cellH > 280) {
        doc.addPage();
        row = 0;
        y = marginY;
      }
    }
  }

  doc.save(`Etiquetas_QR_activos_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function ActivoForm({ activo, usuario, depositos, tiposActivo, pisos, racks, filas, columnas, onClose }) {
  const depositosOperables = depositos.filter((d) => puedeOperarDeposito(usuario, d.id));
  const [form, setForm] = useState(activo || {
    nombre: '', tipoId: '', cantidad: 1, descripcion: '', estado: 'activo',
    fechaIngreso: new Date().toISOString().slice(0, 10),
    pisoId: '', depositoId: depositosOperables[0]?.id || '', rackId: '', filaId: '', columnaId: '',
    costo: '',
  });
  const [fotoBase64, setFotoBase64] = useState(activo ? activo.fotoBase64 || '' : '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // El costo vive en "activosCosto" (documento aparte, de lectura restringida),
  // así que si estamos editando hay que traerlo aparte para no mostrar el
  // campo vacío como si nunca se hubiera cargado un costo.
  useEffect(() => {
    if (!activo) return;
    db.collection('activosCosto').doc(activo.id).get().then((snap) => {
      if (snap.exists) setForm((f) => ({ ...f, costo: snap.data().costo }));
    });
  }, [activo]);

  async function manejarFoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      alert('Solo se aceptan imágenes PNG o JPG.');
      return;
    }
    const dataUrl = await redimensionarImagen(file, 500);
    setFotoBase64(dataUrl);
  }

  function nombreDe(lista, id) {
    const it = lista.find((x) => x.id === id);
    return it ? it.nombre : '';
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim() || !form.depositoId) {
      setError('Completá al menos el nombre y el depósito.');
      return;
    }
    setGuardando(true);
    try {
      const datosPublicos = {
        nombre: form.nombre.trim(),
        tipoId: form.tipoId, tipoNombre: nombreDe(tiposActivo, form.tipoId),
        cantidad: Number(form.cantidad) || 1,
        descripcion: form.descripcion || '',
        estado: form.estado,
        fechaIngreso: form.fechaIngreso,
        pisoId: form.pisoId, pisoNombre: nombreDe(pisos, form.pisoId),
        depositoId: form.depositoId, depositoNombre: nombreDe(depositos, form.depositoId),
        rackId: form.rackId, rackNombre: nombreDe(racks, form.rackId),
        filaId: form.filaId, filaNombre: nombreDe(filas, form.filaId),
        columnaId: form.columnaId, columnaNombre: nombreDe(columnas, form.columnaId),
        fotoBase64: fotoBase64 || '',
      };

      let activoId = activo ? activo.id : null;
      if (activo) {
        await db.collection('activos').doc(activo.id).update(datosPublicos);
      } else {
        // El código (ACT-00001, ACT-00002...) se asigna dentro de una
        // transacción con un contador atómico, igual que la numeración de
        // movimientos: así nunca se repite aunque se creen varios activos
        // al mismo tiempo desde distintas sesiones.
        const nuevoRef = db.collection('activos').doc();
        const contadorRef = db.collection('contadores').doc('activos');
        await db.runTransaction(async (tx) => {
          const contadorSnap = await tx.get(contadorRef);
          const numero = (contadorSnap.exists ? contadorSnap.data().ultimo : 0) + 1;
          const codigo = `ACT-${String(numero).padStart(5, '0')}`;
          tx.set(contadorRef, { ultimo: numero }, { merge: true });
          tx.set(nuevoRef, { ...datosPublicos, codigo });
        });
        activoId = nuevoRef.id;
      }

      // El costo vive en un documento aparte, de lectura restringida (ver firestore.rules).
      if (form.costo !== '' && form.costo != null) {
        await db.collection('activosCosto').doc(activoId).set({ costo: Number(form.costo) }, { merge: true });
      }

      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el activo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={activo ? 'Editar activo' : 'Nuevo activo'} onClose={onClose} wide>
      <form onSubmit={guardar}>
        {activo ? (
          <div className="hint" style={{ marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 13 }}>Código: {activo.codigo || '-'}</div>
        ) : (
          <div className="hint" style={{ marginBottom: 10 }}>El código (ACT-00001, etc.) se asigna automáticamente al guardar.</div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 2 }}>
            <label>Nombre</label>
            <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Silla giratoria negra" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Cantidad</label>
            <input type="number" min="1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            <div className="hint">1 si es un ítem único; más si agrupás varios iguales bajo un mismo registro/QR.</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Tipo</label>
            <select value={form.tipoId} onChange={(e) => setForm({ ...form, tipoId: e.target.value })}>
              <option value="">Sin tipo</option>
              {tiposActivo.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Estado</label>
            <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS_ACTIVO.map((e) => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Fecha de ingreso</label>
            <input type="date" value={form.fechaIngreso} onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })} />
          </div>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 500, display: 'block', marginBottom: 6 }}>Ubicación</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Piso</label>
            <select value={form.pisoId} onChange={(e) => setForm({ ...form, pisoId: e.target.value })}>
              <option value="">-</option>
              {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Depósito</label>
            <select required value={form.depositoId} onChange={(e) => setForm({ ...form, depositoId: e.target.value })}>
              <option value="">Seleccioná</option>
              {depositosOperables.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Rack</label>
            <select value={form.rackId} onChange={(e) => setForm({ ...form, rackId: e.target.value })}>
              <option value="">-</option>
              {racks.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Fila</label>
            <select value={form.filaId} onChange={(e) => setForm({ ...form, filaId: e.target.value })}>
              <option value="">-</option>
              {filas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Columna</label>
            <select value={form.columnaId} onChange={(e) => setForm({ ...form, columnaId: e.target.value })}>
              <option value="">-</option>
              {columnas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Descripción (opcional)</label>
          <textarea rows="2" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Foto (opcional)</label>
            <input type="file" accept="image/png, image/jpeg" onChange={manejarFoto} />
          </div>
          {fotoBase64 && (
            <div className="field">
              <label>Vista previa</label>
              <img src={fotoBase64} alt="Foto del activo" style={{ maxWidth: 140, maxHeight: 100, border: '1px solid var(--border)', borderRadius: 6, padding: 4 }} />
            </div>
          )}
        </div>

        <div className="field" style={{ maxWidth: 220 }}>
          <label>Costo / valor (opcional)</label>
          <input type="number" min="0" step="1" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
          <div className="hint">No se muestra en la ficha pública del QR — solo lo ve quien esté logueado en el sistema.</div>
        </div>

        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function QRActivoModal({ activo, configuracion, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const url = `${urlBaseActivos()}?id=${activo.id}`;

  useEffect(() => {
    generarQRDataURL(url, 220).then(setQrDataUrl);
  }, [url]);

  return (
    <Modal title={`QR — ${activo.nombre}`} onClose={onClose}>
      <div className="hint" style={{ marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 13 }}>Código: {activo.codigo || '-'}</div>
      {activo.fotoBase64 && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img src={activo.fotoBase64} alt={activo.nombre} style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, border: '1px solid var(--border)' }} />
        </div>
      )}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        {qrDataUrl ? <img src={qrDataUrl} alt="QR" style={{ width: 200, height: 200 }} /> : <div style={{ height: 200 }} />}
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, wordBreak: 'break-all' }}>{url}</div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
        <button className="btn btn-primary" onClick={() => exportarFichaActivoPDF(activo, configuracion)}>Descargar ficha PDF</button>
      </div>
    </Modal>
  );
}

function ActivosView({ usuario, activos, depositos, tiposActivo, pisos, racks, filas, columnas, configuracion }) {
  const [modal, setModal] = useState(null); // null | 'nuevo' | activo
  const [modalQR, setModalQR] = useState(null);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDeposito, setFiltroDeposito] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const puedeEscribir = tienePermiso(usuario.rol, 'gestionarActivos');
  const puedeEliminar = tienePermiso(usuario.rol, 'eliminarActivos');
  const depositosVisiblesList = depositosVisibles(usuario, depositos);

  const visibles = activos
    .filter((a) => puedeVerDeposito(usuario, a.depositoId))
    .filter((a) => !filtroTipo || a.tipoId === filtroTipo)
    .filter((a) => !filtroDeposito || a.depositoId === filtroDeposito)
    .filter((a) => !filtroEstado || a.estado === filtroEstado);

  function toggleSeleccion(id) {
    setSeleccionados((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  }

  async function eliminar(a) {
    if (!confirm(`¿Eliminar "${a.nombre}"? Esta acción no se puede deshacer.`)) return;
    await db.collection('activos').doc(a.id).delete();
  }

  async function imprimirSeleccionados() {
    const lista = visibles.filter((a) => seleccionados.has(a.id));
    if (lista.length === 0) return;
    await exportarPlanchaQRPDF(lista, configuracion);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Activos</h1>
          <p>Muebles, sillas, cortinas y otros bienes, con ubicación y QR para rastrearlos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {seleccionados.size > 0 && (
            <button className="btn btn-outline" onClick={imprimirSeleccionados}>Imprimir QR ({seleccionados.size})</button>
          )}
          {puedeEscribir && <button className="btn btn-accent" onClick={() => setModal('nuevo')}>+ Nuevo activo</button>}
        </div>
      </div>

      <div className="filters-row">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tiposActivo.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <select value={filtroDeposito} onChange={(e) => setFiltroDeposito(e.target.value)}>
          <option value="">Todos los depósitos</option>
          {depositosVisiblesList.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_ACTIVO.map((e) => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        {visibles.length === 0 ? <EmptyState text="No hay activos cargados todavía." /> : (
          <table>
            <thead>
              <tr>
                <th></th><th></th><th>Código</th><th>Nombre</th><th>Tipo</th><th>Cantidad</th><th>Ubicación</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <tr key={a.id}>
                  <td><input type="checkbox" checked={seleccionados.has(a.id)} onChange={() => toggleSeleccion(a.id)} /></td>
                  <td>
                    {a.fotoBase64 ? (
                      <img src={a.fotoBase64} alt={a.nombre} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: '#F0F1F5' }} />
                    )}
                  </td>
                  <td className="qty" style={{ fontSize: 12 }}>{a.codigo || '-'}</td>
                  <td>{a.nombre}</td>
                  <td>{a.tipoNombre || '-'}</td>
                  <td className="qty">{a.cantidad}</td>
                  <td style={{ fontSize: 12.5 }}>
                    {[a.pisoNombre, a.depositoNombre, a.rackNombre, a.filaNombre, a.columnaNombre].filter(Boolean).join(' / ')}
                  </td>
                  <td>
                    <span className={`bin-tag ${a.estado === 'baja' ? 'low' : a.estado === 'mantenimiento' ? 'mid' : ''}`}>{ESTADO_LABELS[a.estado] || a.estado}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setModalQR(a)}>QR</button>
                    {puedeEscribir && <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setModal(a)}>Editar</button>}
                    {puedeEliminar && <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => eliminar(a)}>Eliminar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <ActivoForm
          activo={modal === 'nuevo' ? null : modal}
          usuario={usuario} depositos={depositos}
          tiposActivo={tiposActivo} pisos={pisos} racks={racks} filas={filas} columnas={columnas}
          onClose={() => setModal(null)}
        />
      )}
      {modalQR && <QRActivoModal activo={modalQR} configuracion={configuracion} onClose={() => setModalQR(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configuración (logo de la empresa)
// ---------------------------------------------------------------------------

// Redimensiona y comprime una imagen en el navegador antes de guardarla como
// base64 en Firestore (no usamos Firebase Storage para no sumar otra pieza
// a configurar). Con esto el logo pesa unos pocos KB, bien lejos del límite
// de 1MB por documento de Firestore.
function redimensionarImagen(file, maxAncho) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxAncho / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ConfiguracionView({ configuracion }) {
  const [nombreEmpresa, setNombreEmpresa] = useState(configuracion.nombreEmpresa || '');
  const [logoPreview, setLogoPreview] = useState(configuracion.logoBase64 || '');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  async function manejarArchivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      alert('Solo se aceptan imágenes PNG o JPG.');
      return;
    }
    const dataUrl = await redimensionarImagen(file, 300);
    setLogoPreview(dataUrl);
  }

  async function guardar() {
    setGuardando(true);
    setMensaje('');
    try {
      await db.collection('configuracion').doc('empresa').set({
        nombreEmpresa, logoBase64: logoPreview,
      }, { merge: true });
      setMensaje('Guardado.');
    } catch (err) {
      setMensaje(`Error: ${err.message || 'no se pudo guardar. Revisá las reglas de Firestore.'}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Configuración</h1>
          <p>Nombre y logo de la empresa, usados en el login, el menú y los reportes.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 420 }}>
        <div className="field">
          <label>Nombre de la empresa</label>
          <input value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} placeholder="Ej: Biggie S.A." />
        </div>
        <div className="field">
          <label>Logo (PNG o JPG)</label>
          <input type="file" accept="image/png, image/jpeg" onChange={manejarArchivo} />
        </div>
        {logoPreview && (
          <div className="field">
            <label>Vista previa</label>
            <img src={logoPreview} alt="Logo" style={{ maxWidth: 160, maxHeight: 80, border: '1px solid var(--border)', borderRadius: 6, padding: 6 }} />
          </div>
        )}
        {mensaje && <div style={{ fontSize: 12.5, color: mensaje.startsWith('Error') ? 'var(--danger)' : 'var(--success)', marginBottom: 10 }}>{mensaje}</div>}
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reportes (stock actual + historial), exportables a Excel y PDF
// ---------------------------------------------------------------------------

function ReportesView({ usuario, insumos, depositos, sectores, stock, configuracion }) {
  const [tab, setTab] = useState('stock');
  const [movimientos, setMovimientos] = useState([]);
  const [filtroDeposito, setFiltroDeposito] = useState('');
  const [filtroInsumo, setFiltroInsumo] = useState('');
  const [filtroSector, setFiltroSector] = useState('');
  const [filtrosStock, setFiltrosStock] = useState({ insumo: '', cantidad: '', minimo: '', alerta: '' });
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  function setFiltroStock(campo, valor) {
    setFiltrosStock((f) => ({ ...f, [campo]: valor }));
  }

  useEffect(() => {
    const unsub = db.collection('movimientos').orderBy('fecha', 'desc').limit(1000)
      .onSnapshot((snap) => setMovimientos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const depositosVisiblesList = depositosVisibles(usuario, depositos);

  const filasStock = useMemo(() => {
    const out = [];
    insumos.forEach((insumo) => {
      depositosVisiblesList.forEach((dep) => {
        if (filtroDeposito && dep.id !== filtroDeposito) return;
        const s = stock[stockDocId(insumo.id, dep.id)];
        const cantidad = s ? s.cantidad : 0;
        const alerta = cantidad <= insumo.stockMinimo ? 'SI' : 'NO';

        if (filtrosStock.insumo && !insumo.nombre.toLowerCase().includes(filtrosStock.insumo.toLowerCase())) return;
        if (filtrosStock.cantidad !== '' && cantidad !== Number(filtrosStock.cantidad)) return;
        if (filtrosStock.minimo !== '' && insumo.stockMinimo !== Number(filtrosStock.minimo)) return;
        if (filtrosStock.alerta && alerta !== filtrosStock.alerta) return;

        out.push({
          Insumo: insumo.nombre,
          Deposito: dep.nombre,
          Cantidad: cantidad,
          Unidad: insumo.unidadMedida,
          Minimo: insumo.stockMinimo,
          Alerta: alerta,
        });
      });
    });
    return out;
  }, [insumos, depositosVisiblesList, stock, filtroDeposito, filtrosStock]);

  const filasHistorial = useMemo(() => {
    return movimientos
      .filter((m) => puedeVerDeposito(usuario, m.depositoId))
      .filter((m) => !filtroDeposito || m.depositoId === filtroDeposito)
      .filter((m) => !filtroInsumo || m.insumoId === filtroInsumo)
      .filter((m) => !filtroSector || m.sectorId === filtroSector)
      .filter((m) => {
        if (!m.fecha || !m.fecha.toDate) return true;
        const f = m.fecha.toDate();
        if (desde && f < new Date(desde)) return false;
        if (hasta && f > new Date(hasta + 'T23:59:59')) return false;
        return true;
      })
      .map((m) => ({
        Numero: m.numero || '',
        Fecha: formatFecha(m.fecha),
        Tipo: m.tipo,
        Insumo: m.insumoNombre,
        Deposito: m.depositoNombre,
        Sector: m.sectorNombre || '',
        Cantidad: m.cantidad,
        Gasto: m.gasto != null ? m.gasto : '',
        Usuario: m.usuarioNombre,
        Motivo: m.motivo || '',
        Solicitante: m.solicitante || '',
      }));
  }, [movimientos, usuario, filtroDeposito, filtroInsumo, filtroSector, desde, hasta]);

  // Gasto agrupado por sector, solo salidas reales (no ajustes)
  const filasGastoPorSector = useMemo(() => {
    const acumulado = {};
    movimientos
      .filter((m) => m.tipo === 'salida' && m.gasto != null && m.sectorId)
      .filter((m) => puedeVerDeposito(usuario, m.depositoId))
      .filter((m) => !filtroDeposito || m.depositoId === filtroDeposito)
      .filter((m) => !filtroSector || m.sectorId === filtroSector)
      .filter((m) => {
        if (!m.fecha || !m.fecha.toDate) return true;
        const f = m.fecha.toDate();
        if (desde && f < new Date(desde)) return false;
        if (hasta && f > new Date(hasta + 'T23:59:59')) return false;
        return true;
      })
      .forEach((m) => {
        if (!acumulado[m.sectorId]) acumulado[m.sectorId] = { Sector: m.sectorNombre, Movimientos: 0, GastoTotal: 0 };
        acumulado[m.sectorId].Movimientos += 1;
        acumulado[m.sectorId].GastoTotal += m.gasto;
      });
    return Object.values(acumulado)
      .map((f) => ({ ...f, GastoTotal: Number(f.GastoTotal.toFixed(2)) }))
      .sort((a, b) => b.GastoTotal - a.GastoTotal);
  }, [movimientos, usuario, filtroDeposito, filtroSector, desde, hasta]);

  function datosSegunTab() {
    if (tab === 'stock') return filasStock;
    if (tab === 'historial') return filasHistorial;
    return filasGastoPorSector;
  }

  function tituloSegunTab() {
    if (tab === 'stock') return 'Reporte de stock actual';
    if (tab === 'historial') return 'Historial de movimientos';
    return 'Gasto por sector';
  }

  function exportarExcel() {
    const datos = datosSegunTab();
    if (datos.length === 0) { alert('No hay datos para exportar.'); return; }
    const nombreHoja = tituloSegunTab();
    const encabezado = [[configuracion.nombreEmpresa || 'Reporte de stock'], [nombreHoja], [new Date().toLocaleString('es-PY')], []];
    const ws = XLSX.utils.aoa_to_sheet(encabezado);
    XLSX.utils.sheet_add_json(ws, datos, { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja.slice(0, 28));
    XLSX.writeFile(wb, `${nombreHoja.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportarPDF() {
    const datos = datosSegunTab();
    if (datos.length === 0) { alert('No hay datos para exportar.'); return; }
    const doc = new jspdf.jsPDF();
    let y = 16;
    if (configuracion.logoBase64) {
      try { doc.addImage(configuracion.logoBase64, 'JPEG', 150, 8, 40, 20); } catch (e) { /* logo inválido, seguimos sin él */ }
    }
    doc.setFontSize(13);
    doc.text(configuracion.nombreEmpresa || 'Reporte de stock', 14, y);
    y += 7;
    doc.setFontSize(11);
    doc.text(tituloSegunTab(), 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(new Date().toLocaleString('es-PY'), 14, y);
    doc.autoTable({
      startY: y + 6,
      head: [Object.keys(datos[0])],
      body: datos.map((row) => Object.values(row)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 27, 51] },
    });
    doc.save(`${tituloSegunTab().replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reportes</h1>
          <p>Stock actual, historial de movimientos y gasto por sector.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={exportarExcel}>Exportar Excel</button>
          <button className="btn btn-outline" onClick={exportarPDF}>Exportar PDF</button>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Stock actual</div>
        <div className={`tab ${tab === 'historial' ? 'active' : ''}`} onClick={() => setTab('historial')}>Historial de movimientos</div>
        <div className={`tab ${tab === 'gasto' ? 'active' : ''}`} onClick={() => setTab('gasto')}>Gasto por sector</div>
      </div>

      <div className="filters-row">
        {tab !== 'stock' && (
          <select value={filtroDeposito} onChange={(e) => setFiltroDeposito(e.target.value)}>
            <option value="">Todos los depósitos</option>
            {depositosVisiblesList.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        )}
        {tab === 'historial' && (
          <select value={filtroInsumo} onChange={(e) => setFiltroInsumo(e.target.value)}>
            <option value="">Todos los insumos</option>
            {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        )}
        {(tab === 'historial' || tab === 'gasto') && (
          <React.Fragment>
            <select value={filtroSector} onChange={(e) => setFiltroSector(e.target.value)}>
              <option value="">Todos los sectores</option>
              {sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </React.Fragment>
        )}
      </div>

      <div className="table-wrap">
        {tab === 'stock' && (
          filasStock.length === 0 ? <EmptyState text="No hay datos de stock." /> : (
            <table>
              <thead>
                <tr><th>Insumo</th><th>Depósito</th><th>Cantidad</th><th>Mínimo</th><th>Alerta</th></tr>
                <tr className="filter-row">
                  <th>
                    <input placeholder="Buscar..." value={filtrosStock.insumo} onChange={(e) => setFiltroStock('insumo', e.target.value)} />
                  </th>
                  <th>
                    <select value={filtroDeposito} onChange={(e) => setFiltroDeposito(e.target.value)}>
                      <option value="">Todos</option>
                      {depositosVisiblesList.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                  </th>
                  <th>
                    <input type="number" placeholder="Exacto" value={filtrosStock.cantidad} onChange={(e) => setFiltroStock('cantidad', e.target.value)} />
                  </th>
                  <th>
                    <input type="number" placeholder="Exacto" value={filtrosStock.minimo} onChange={(e) => setFiltroStock('minimo', e.target.value)} />
                  </th>
                  <th>
                    <select value={filtrosStock.alerta} onChange={(e) => setFiltroStock('alerta', e.target.value)}>
                      <option value="">Todos</option>
                      <option value="SI">Sí</option>
                      <option value="NO">No</option>
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filasStock.map((f, idx) => (
                  <tr key={idx}>
                    <td>{f.Insumo}</td><td>{f.Deposito}</td>
                    <td className="qty">{f.Cantidad} {f.Unidad}</td>
                    <td className="qty">{f.Minimo}</td>
                    <td>{f.Alerta === 'SI' ? <span className="bin-tag low">Sí</span> : <span className="bin-tag">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {tab === 'historial' && (
          filasHistorial.length === 0 ? <EmptyState text="No hay movimientos para este filtro." /> : (
            <table>
              <thead><tr><th>N°</th><th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Depósito</th><th>Sector</th><th>Cantidad</th><th>Gasto</th><th>Usuario</th><th>Motivo</th><th>Solicitante</th></tr></thead>
              <tbody>
                {filasHistorial.map((f, idx) => (
                  <tr key={idx}>
                    <td className="qty">{f.Numero || '-'}</td>
                    <td>{f.Fecha}</td><td>{f.Tipo}</td><td>{f.Insumo}</td><td>{f.Deposito}</td><td>{f.Sector || '-'}</td>
                    <td className="qty">{f.Cantidad}</td>
                    <td className="qty">{f.Gasto !== '' ? formatGs(f.Gasto) : '-'}</td>
                    <td>{f.Usuario}</td><td>{f.Motivo || '-'}</td><td>{f.Solicitante || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {tab === 'gasto' && (
          filasGastoPorSector.length === 0 ? <EmptyState text="No hay gasto registrado para este filtro." /> : (
            <table>
              <thead><tr><th>Sector</th><th>Movimientos</th><th>Gasto total</th></tr></thead>
              <tbody>
                {filasGastoPorSector.map((f, idx) => (
                  <tr key={idx}>
                    <td>{f.Sector}</td>
                    <td className="qty">{f.Movimientos}</td>
                    <td className="qty">{formatGs(f.GastoTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usuarios (solo Admin): alta de usuarios, rol y depósitos asignados
// ---------------------------------------------------------------------------

function NuevoUsuarioForm({ depositos, onClose }) {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: ROLES.CONSULTA, depositosAsignados: [] });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function toggleDeposito(id) {
    setForm((f) => ({
      ...f,
      depositosAsignados: f.depositosAsignados.includes(id)
        ? f.depositosAsignados.filter((x) => x !== id)
        : [...f.depositosAsignados, id],
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('La contraseña provisoria debe tener al menos 6 caracteres.'); return; }
    setGuardando(true);
    try {
      // Se crea con la app "secundaria" para no cerrar la sesión del Admin actual.
      const cred = await secondaryAuth.createUserWithEmailAndPassword(form.email, form.password);
      const uid = cred.user.uid;
      await db.collection('usuarios').doc(uid).set({
        nombre: form.nombre,
        email: form.email,
        rol: form.rol,
        depositosAsignados: form.rol === ROLES.ENCARGADO ? form.depositosAsignados : [],
        activo: true,
      });
      await secondaryAuth.signOut();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo crear el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Nombre</label>
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label>Contraseña provisoria</label>
          <input type="text" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div className="hint">Compartila con la persona; puede cambiarla luego desde su cuenta de Google/Firebase.</div>
        </div>
        <div className="field">
          <label>Rol</label>
          <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        {form.rol === ROLES.ENCARGADO && (
          <div className="field">
            <label>Depósitos asignados</label>
            {depositos.map((d) => (
              <label key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, fontSize: 13, marginBottom: 4 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={form.depositosAsignados.includes(d.id)} onChange={() => toggleDeposito(d.id)} />
                {d.nombre}
              </label>
            ))}
          </div>
        )}
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Creando...' : 'Crear usuario'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditarUsuarioForm({ usuario, depositos, onClose }) {
  const [form, setForm] = useState({
    nombre: usuario.nombre || '',
    rol: usuario.rol,
    depositosAsignados: usuario.depositosAsignados || [],
  });
  const [guardando, setGuardando] = useState(false);

  function toggleDeposito(id) {
    setForm((f) => ({
      ...f,
      depositosAsignados: f.depositosAsignados.includes(id)
        ? f.depositosAsignados.filter((x) => x !== id)
        : [...f.depositosAsignados, id],
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    await db.collection('usuarios').doc(usuario.id).update({
      nombre: form.nombre,
      rol: form.rol,
      depositosAsignados: form.rol === ROLES.ENCARGADO ? form.depositosAsignados : [],
    });
    setGuardando(false);
    onClose();
  }

  return (
    <Modal title="Editar usuario" onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Email</label>
          <input value={usuario.email} disabled style={{ background: '#F5F6F8', color: 'var(--text-muted)' }} />
          <div className="hint">El email no se puede cambiar desde acá (es la identidad de acceso en Firebase Authentication).</div>
        </div>
        <div className="field">
          <label>Nombre</label>
          <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div className="field">
          <label>Rol</label>
          <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        {form.rol === ROLES.ENCARGADO && (
          <div className="field">
            <label>Depósitos asignados</label>
            {depositos.map((d) => (
              <label key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, fontSize: 13, marginBottom: 4 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={form.depositosAsignados.includes(d.id)} onChange={() => toggleDeposito(d.id)} />
                {d.nombre}
              </label>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function UsuariosView({ depositos }) {
  const [usuarios, setUsuarios] = useState([]);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);

  useEffect(() => {
    const unsub = db.collection('usuarios').onSnapshot((snap) => setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  async function toggleActivo(u) {
    await db.collection('usuarios').doc(u.id).update({ activo: !u.activo });
  }

  function nombreDeposito(id) {
    return (depositos.find((d) => d.id === id) || {}).nombre || id;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Alta de usuarios y asignación de roles y depósitos.</p>
        </div>
        <button className="btn btn-accent" onClick={() => setModalNuevo(true)}>+ Nuevo usuario</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Depósitos</th><th>Activo</th><th></th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.rol] || u.rol}</td>
                <td style={{ fontSize: 12.5 }}>
                  {u.rol === ROLES.ENCARGADO ? (u.depositosAsignados || []).map(nombreDeposito).join(', ') || '-' : 'Todos'}
                </td>
                <td>{u.activo ? 'Sí' : 'No'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setModalEditar(u)}>Editar</button>
                  <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => toggleActivo(u)}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalNuevo && <NuevoUsuarioForm depositos={depositos} onClose={() => setModalNuevo(false)} />}
      {modalEditar && <EditarUsuarioForm usuario={modalEditar} depositos={depositos} onClose={() => setModalEditar(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// App raíz: autenticación, carga de datos en tiempo real y ruteo por rol
// ---------------------------------------------------------------------------

function AppShell({ authUser, configuracion }) {
  const [usuario, setUsuario] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [vista, setVista] = useState('dashboard');
  const [sidebarColapsado, setSidebarColapsado] = useState(() => {
    try { return localStorage.getItem('sidebarColapsado') === '1'; } catch (e) { return false; }
  });

  function toggleSidebar() {
    setSidebarColapsado((actual) => {
      const nuevo = !actual;
      try { localStorage.setItem('sidebarColapsado', nuevo ? '1' : '0'); } catch (e) { /* sin acceso a localStorage, no pasa nada */ }
      return nuevo;
    });
  }

  const [insumos, setInsumos] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [activos, setActivos] = useState([]);
  const [tiposActivo, setTiposActivo] = useState([]);
  const [pisos, setPisos] = useState([]);
  const [racks, setRacks] = useState([]);
  const [filas, setFilas] = useState([]);
  const [columnas, setColumnas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [stock, setStock] = useState({});

  // Perfil del usuario (rol, depósitos asignados)
  useEffect(() => {
    const unsub = db.collection('usuarios').doc(authUser.uid).onSnapshot((snap) => {
      if (snap.exists) {
        setUsuario({ uid: authUser.uid, email: authUser.email, ...snap.data() });
      } else {
        setUsuario(null);
      }
      setCargandoPerfil(false);
    });
    return unsub;
  }, [authUser.uid]);

  useEffect(() => {
    const unsub = db.collection('insumos').orderBy('nombre').onSnapshot((snap) => setInsumos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('depositos').orderBy('nombre').onSnapshot((snap) => setDepositos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('categorias').orderBy('nombre').onSnapshot((snap) => setCategorias(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('sectores').orderBy('nombre').onSnapshot((snap) => setSectores(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('proveedores').orderBy('nombre').onSnapshot((snap) => setProveedores(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('activos').orderBy('nombre').onSnapshot((snap) => setActivos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('tiposActivo').orderBy('nombre').onSnapshot((snap) => setTiposActivo(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('pisos').orderBy('nombre').onSnapshot((snap) => setPisos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('racks').orderBy('nombre').onSnapshot((snap) => setRacks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('filas').orderBy('nombre').onSnapshot((snap) => setFilas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('columnas').orderBy('nombre').onSnapshot((snap) => setColumnas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('stock').onSnapshot((snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = d.data(); });
      setStock(map);
    });
    return unsub;
  }, []);

  if (cargandoPerfil) {
    return <div className="loading-screen">Cargando...</div>;
  }

  if (!usuario) {
    return (
      <div className="loading-screen" style={{ flexDirection: 'column', gap: 10 }}>
        <div>Tu cuenta no tiene un perfil asignado todavía.</div>
        <div>Pedile a un administrador que te dé de alta en "Usuarios", o creá el primer perfil de Admin manualmente en Firestore (colección "usuarios", documento con id = {authUser.uid}).</div>
        <button className="btn btn-outline" onClick={() => auth.signOut()} style={{ marginTop: 10 }}>Cerrar sesión</button>
      </div>
    );
  }

  if (usuario.activo === false) {
    return (
      <div className="loading-screen" style={{ flexDirection: 'column', gap: 10 }}>
        <div>Tu cuenta está desactivada. Contactá a un administrador.</div>
        <button className="btn btn-outline" onClick={() => auth.signOut()} style={{ marginTop: 10 }}>Cerrar sesión</button>
      </div>
    );
  }

  let contenido;
  if (vista === 'dashboard') contenido = <DashboardView usuario={usuario} insumos={insumos} depositos={depositos} stock={stock} />;
  else if (vista === 'movimientos') contenido = <MovimientosView usuario={usuario} insumos={insumos} depositos={depositos} sectores={sectores} configuracion={configuracion} />;
  else if (vista === 'compras' && tienePermiso(usuario.rol, 'registrarCompra')) contenido = <ComprasView usuario={usuario} insumos={insumos} depositos={depositos} proveedores={proveedores} />;
  else if (vista === 'insumos') contenido = <InsumosView usuario={usuario} insumos={insumos} categorias={categorias} />;
  else if (vista === 'depositos') contenido = <DepositosView usuario={usuario} depositos={depositos} stock={stock} />;
  else if (vista === 'sectores') contenido = <SectoresView sectores={sectores} />;
  else if (vista === 'proveedores') contenido = <ProveedoresView proveedores={proveedores} />;
  else if (vista === 'reportes' && tienePermiso(usuario.rol, 'exportarReportes')) contenido = <ReportesView usuario={usuario} insumos={insumos} depositos={depositos} sectores={sectores} stock={stock} configuracion={configuracion} />;
  else if (vista === 'tomaInventario' && tienePermiso(usuario.rol, 'imprimirTomaInventario')) contenido = <TomaInventarioView usuario={usuario} insumos={insumos} depositos={depositos} stock={stock} configuracion={configuracion} />;
  else if (vista === 'ajusteInventario' && tienePermiso(usuario.rol, 'ajustarInventario')) contenido = <AjusteInventarioView usuario={usuario} insumos={insumos} depositos={depositos} stock={stock} />;
  else if (vista === 'activos') contenido = <ActivosView usuario={usuario} activos={activos} depositos={depositos} tiposActivo={tiposActivo} pisos={pisos} racks={racks} filas={filas} columnas={columnas} configuracion={configuracion} />;
  else if (vista === 'catalogosActivos' && tienePermiso(usuario.rol, 'gestionarCatalogosActivos')) contenido = <CatalogosActivosView usuario={usuario} tiposActivo={tiposActivo} pisos={pisos} racks={racks} filas={filas} columnas={columnas} />;
  else if (vista === 'usuarios' && tienePermiso(usuario.rol, 'gestionarUsuarios')) contenido = <UsuariosView depositos={depositos} />;
  else if (vista === 'configuracion' && tienePermiso(usuario.rol, 'gestionarConfiguracion')) contenido = <ConfiguracionView configuracion={configuracion} />;
  else contenido = <DashboardView usuario={usuario} insumos={insumos} depositos={depositos} stock={stock} />;

  return (
    <div className="app-shell">
      <Sidebar
        vista={vista} setVista={setVista} usuario={usuario} configuracion={configuracion}
        colapsado={sidebarColapsado} onToggleColapso={toggleSidebar}
      />
      <div className="main">{contenido}</div>
    </div>
  );
}

function App() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [configuracion, setConfiguracion] = useState({});

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => setAuthUser(user || null));
    return unsub;
  }, []);

  // Se carga a nivel raíz porque el logo debe verse incluso en la pantalla de login,
  // antes de que haya una sesión iniciada (por eso la regla de Firestore permite lectura pública).
  useEffect(() => {
    const unsub = db.collection('configuracion').doc('empresa').onSnapshot(
      (snap) => setConfiguracion(snap.exists ? snap.data() : {}),
      () => setConfiguracion({}),
    );
    return unsub;
  }, []);

  if (authUser === undefined) return <div className="loading-screen">Cargando...</div>;
  if (authUser === null) return <LoginScreen configuracion={configuracion} />;
  return <AppShell authUser={authUser} configuracion={configuracion} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
