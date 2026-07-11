// app.js
// App de control de stock de insumos. React sin build, vía Babel standalone.
// Depende de: firebase-config.js y permissions.js (deben cargarse antes que este archivo).

const { useState, useEffect, useMemo, useRef } = React;

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

// ---------------------------------------------------------------------------
// Componentes genéricos
// ---------------------------------------------------------------------------

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
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

function LoginScreen() {
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
        <div className="mark">CONTROL DE STOCK</div>
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
  { id: 'movimientos', label: 'Entradas / Salidas', permiso: null },
  { id: 'insumos', label: 'Insumos', permiso: null },
  { id: 'depositos', label: 'Depósitos', permiso: null },
  { id: 'reportes', label: 'Reportes', permiso: 'exportarReportes' },
  { id: 'usuarios', label: 'Usuarios', permiso: 'gestionarUsuarios' },
];

function Sidebar({ vista, setVista, usuario }) {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <span className="mark">#</span>
        <span className="name">Stock Ops</span>
      </div>
      <nav>
        {NAV_ITEMS.filter((item) => !item.permiso || tienePermiso(usuario.rol, item.permiso)).map((item) => (
          <button
            key={item.id}
            className={`nav-item ${vista === item.id ? 'active' : ''}`}
            onClick={() => setVista(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div>{usuario.nombre || usuario.email}</div>
        <span className="role-tag">{ROLE_LABELS[usuario.rol] || usuario.rol}</span>
        <button onClick={() => auth.signOut()}>Cerrar sesión</button>
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

function DepositosView({ usuario, depositos }) {
  const [modal, setModal] = useState(null);
  const puedeEscribir = tienePermiso(usuario.rol, 'gestionarDepositos');

  async function eliminarDeposito(dep) {
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
            <thead><tr><th>Nombre</th><th>Dirección</th>{puedeEscribir && <th></th>}</tr></thead>
            <tbody>
              {depositos.map((d) => (
                <tr key={d.id}>
                  <td>{d.nombre}</td>
                  <td>{d.direccion || '-'}</td>
                  {puedeEscribir && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setModal(d)}>Editar</button>
                      <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => eliminarDeposito(d)}>Eliminar</button>
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
// Movimientos (entradas / salidas / ajustes) + transacción de stock
// ---------------------------------------------------------------------------

// Registra un movimiento y actualiza el documento de stock correspondiente
// dentro de una transacción, para evitar condiciones de carrera si dos
// personas cargan movimientos del mismo insumo al mismo tiempo.
async function registrarMovimiento({ insumo, deposito, tipo, cantidad, motivo, usuario, movimientoOriginalId }) {
  const stockId = stockDocId(insumo.id, deposito.id);
  const stockRef = db.collection('stock').doc(stockId);
  const movRef = db.collection('movimientos').doc();

  await db.runTransaction(async (tx) => {
    const stockSnap = await tx.get(stockRef);
    const actual = stockSnap.exists ? stockSnap.data().cantidad : 0;
    const delta = tipo === 'salida' ? -cantidad : cantidad;
    const nuevaCantidad = actual + delta;

    if (nuevaCantidad < 0) {
      throw new Error('La salida deja el stock en negativo. Revisá la cantidad.');
    }

    tx.set(stockRef, { insumoId: insumo.id, depositoId: deposito.id, cantidad: nuevaCantidad }, { merge: true });

    tx.set(movRef, {
      insumoId: insumo.id,
      insumoNombre: insumo.nombre,
      depositoId: deposito.id,
      depositoNombre: deposito.nombre,
      tipo,
      cantidad,
      motivo: motivo || '',
      usuarioId: usuario.uid,
      usuarioNombre: usuario.nombre || usuario.email,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      movimientoOriginalId: movimientoOriginalId || null,
    });
  });
}

// Anula un movimiento generando el contramovimiento inverso (nunca se borra el original).
async function anularMovimiento(movimiento, insumos, depositos, usuario) {
  const insumo = insumos.find((i) => i.id === movimiento.insumoId);
  const deposito = depositos.find((d) => d.id === movimiento.depositoId);
  if (!insumo || !deposito) throw new Error('No se encontró el insumo o depósito original.');

  const tipoInverso = movimiento.tipo === 'entrada' ? 'salida' : 'entrada';

  await registrarMovimiento({
    insumo, deposito,
    tipo: tipoInverso,
    cantidad: movimiento.cantidad,
    motivo: `Anulación del movimiento ${movimiento.id}`,
    usuario,
    movimientoOriginalId: movimiento.id,
  });
}

function RegistrarMovimientoForm({ usuario, insumos, depositos, onClose }) {
  const depositosOperables = depositos.filter((d) => puedeOperarDeposito(usuario, d.id));
  const [form, setForm] = useState({ insumoId: '', depositoId: depositosOperables[0]?.id || '', tipo: 'entrada', cantidad: '', motivo: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError('');
    const insumo = insumos.find((i) => i.id === form.insumoId);
    const deposito = depositos.find((d) => d.id === form.depositoId);
    const cantidad = Number(form.cantidad);

    if (!insumo || !deposito || !cantidad || cantidad <= 0) {
      setError('Completá insumo, depósito y una cantidad mayor a cero.');
      return;
    }
    setGuardando(true);
    try {
      await registrarMovimiento({ insumo, deposito, tipo: form.tipo, cantidad, motivo: form.motivo, usuario });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Registrar movimiento" onClose={onClose}>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Tipo</label>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="entrada">Entrada (ingreso de stock)</option>
            <option value="salida">Salida (consumo de stock)</option>
          </select>
        </div>
        <div className="field">
          <label>Depósito</label>
          <select required value={form.depositoId} onChange={(e) => setForm({ ...form, depositoId: e.target.value })}>
            <option value="">Seleccioná un depósito</option>
            {depositosOperables.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Insumo</label>
          <select required value={form.insumoId} onChange={(e) => setForm({ ...form, insumoId: e.target.value })}>
            <option value="">Seleccioná un insumo</option>
            {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidadMedida})</option>)}
          </select>
        </div>
        <div className="field">
          <label>Cantidad</label>
          <input type="number" min="0.01" step="0.01" required value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
        </div>
        <div className="field">
          <label>Motivo / referencia (opcional)</label>
          <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ej: OC 1234, consumo obra X" />
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function MovimientosView({ usuario, insumos, depositos }) {
  const [modalNuevo, setModalNuevo] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const [filtroDeposito, setFiltroDeposito] = useState('');
  const [filtroInsumo, setFiltroInsumo] = useState('');
  const puedeRegistrar = tienePermiso(usuario.rol, 'registrarMovimiento');
  const puedeAnular = tienePermiso(usuario.rol, 'anularMovimiento');

  useEffect(() => {
    const unsub = db.collection('movimientos').orderBy('fecha', 'desc').limit(200)
      .onSnapshot((snap) => setMovimientos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const visibles = movimientos
    .filter((m) => puedeVerDeposito(usuario, m.depositoId))
    .filter((m) => !filtroDeposito || m.depositoId === filtroDeposito)
    .filter((m) => !filtroInsumo || m.insumoId === filtroInsumo);

  const depositosVisiblesList = depositosVisibles(usuario, depositos);

  async function handleAnular(m) {
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
          <h1>Entradas / Salidas</h1>
          <p>Historial de movimientos de stock.</p>
        </div>
        {puedeRegistrar && <button className="btn btn-accent" onClick={() => setModalNuevo(true)}>+ Registrar movimiento</button>}
      </div>

      <div className="filters-row">
        <select value={filtroDeposito} onChange={(e) => setFiltroDeposito(e.target.value)}>
          <option value="">Todos los depósitos</option>
          {depositosVisiblesList.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <select value={filtroInsumo} onChange={(e) => setFiltroInsumo(e.target.value)}>
          <option value="">Todos los insumos</option>
          {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        {visibles.length === 0 ? <EmptyState text="No hay movimientos para este filtro." /> : (
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Depósito</th><th>Cantidad</th><th>Usuario</th><th>Motivo</th>{puedeAnular && <th></th>}</tr>
            </thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.id}>
                  <td>{formatFecha(m.fecha)}</td>
                  <td>
                    <span className={`bin-tag ${m.tipo === 'salida' ? 'low' : ''}`}>{m.tipo}</span>
                  </td>
                  <td>{m.insumoNombre}</td>
                  <td>{m.depositoNombre}</td>
                  <td className="qty">{m.cantidad}</td>
                  <td>{m.usuarioNombre}</td>
                  <td>{m.motivo || '-'}{m.movimientoOriginalId ? ' (ajuste)' : ''}</td>
                  {puedeAnular && (
                    <td>
                      {!m.movimientoOriginalId && (
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

      {modalNuevo && (
        <RegistrarMovimientoForm
          usuario={usuario}
          insumos={insumos}
          depositos={depositos.filter((d) => puedeOperarDeposito(usuario, d.id))}
          onClose={() => setModalNuevo(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reportes (stock actual + historial), exportables a Excel y PDF
// ---------------------------------------------------------------------------

function ReportesView({ usuario, insumos, depositos, stock }) {
  const [tab, setTab] = useState('stock');
  const [movimientos, setMovimientos] = useState([]);
  const [filtroDeposito, setFiltroDeposito] = useState('');
  const [filtroInsumo, setFiltroInsumo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

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
        out.push({
          Insumo: insumo.nombre,
          Deposito: dep.nombre,
          Cantidad: s ? s.cantidad : 0,
          Unidad: insumo.unidadMedida,
          Minimo: insumo.stockMinimo,
          Alerta: (s ? s.cantidad : 0) <= insumo.stockMinimo ? 'SI' : 'NO',
        });
      });
    });
    return out;
  }, [insumos, depositosVisiblesList, stock, filtroDeposito]);

  const filasHistorial = useMemo(() => {
    return movimientos
      .filter((m) => puedeVerDeposito(usuario, m.depositoId))
      .filter((m) => !filtroDeposito || m.depositoId === filtroDeposito)
      .filter((m) => !filtroInsumo || m.insumoId === filtroInsumo)
      .filter((m) => {
        if (!m.fecha || !m.fecha.toDate) return true;
        const f = m.fecha.toDate();
        if (desde && f < new Date(desde)) return false;
        if (hasta && f > new Date(hasta + 'T23:59:59')) return false;
        return true;
      })
      .map((m) => ({
        Fecha: formatFecha(m.fecha),
        Tipo: m.tipo,
        Insumo: m.insumoNombre,
        Deposito: m.depositoNombre,
        Cantidad: m.cantidad,
        Usuario: m.usuarioNombre,
        Motivo: m.motivo || '',
      }));
  }, [movimientos, usuario, filtroDeposito, filtroInsumo, desde, hasta]);

  function exportarExcel() {
    const datos = tab === 'stock' ? filasStock : filasHistorial;
    const nombreHoja = tab === 'stock' ? 'Stock actual' : 'Historial';
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
    XLSX.writeFile(wb, `${nombreHoja.replace(' ', '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportarPDF() {
    const datos = tab === 'stock' ? filasStock : filasHistorial;
    if (datos.length === 0) { alert('No hay datos para exportar.'); return; }
    const doc = new jspdf.jsPDF();
    const titulo = tab === 'stock' ? 'Reporte de stock actual' : 'Historial de movimientos';
    doc.setFontSize(14);
    doc.text(titulo, 14, 16);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleString('es-AR'), 14, 22);
    doc.autoTable({
      startY: 28,
      head: [Object.keys(datos[0])],
      body: datos.map((row) => Object.values(row)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 27, 51] },
    });
    doc.save(`${titulo.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reportes</h1>
          <p>Stock actual e historial de movimientos, exportables a Excel o PDF.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={exportarExcel}>Exportar Excel</button>
          <button className="btn btn-outline" onClick={exportarPDF}>Exportar PDF</button>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Stock actual</div>
        <div className={`tab ${tab === 'historial' ? 'active' : ''}`} onClick={() => setTab('historial')}>Historial de movimientos</div>
      </div>

      <div className="filters-row">
        <select value={filtroDeposito} onChange={(e) => setFiltroDeposito(e.target.value)}>
          <option value="">Todos los depósitos</option>
          {depositosVisiblesList.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        {tab === 'historial' && (
          <React.Fragment>
            <select value={filtroInsumo} onChange={(e) => setFiltroInsumo(e.target.value)}>
              <option value="">Todos los insumos</option>
              {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </React.Fragment>
        )}
      </div>

      <div className="table-wrap">
        {tab === 'stock' ? (
          filasStock.length === 0 ? <EmptyState text="No hay datos de stock." /> : (
            <table>
              <thead><tr><th>Insumo</th><th>Depósito</th><th>Cantidad</th><th>Mínimo</th><th>Alerta</th></tr></thead>
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
        ) : (
          filasHistorial.length === 0 ? <EmptyState text="No hay movimientos para este filtro." /> : (
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Depósito</th><th>Cantidad</th><th>Usuario</th><th>Motivo</th></tr></thead>
              <tbody>
                {filasHistorial.map((f, idx) => (
                  <tr key={idx}>
                    <td>{f.Fecha}</td><td>{f.Tipo}</td><td>{f.Insumo}</td><td>{f.Deposito}</td>
                    <td className="qty">{f.Cantidad}</td><td>{f.Usuario}</td><td>{f.Motivo || '-'}</td>
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

function UsuariosView({ depositos }) {
  const [usuarios, setUsuarios] = useState([]);
  const [modalNuevo, setModalNuevo] = useState(false);

  useEffect(() => {
    const unsub = db.collection('usuarios').onSnapshot((snap) => setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  async function toggleActivo(u) {
    await db.collection('usuarios').doc(u.id).update({ activo: !u.activo });
  }

  async function cambiarRol(u, rol) {
    await db.collection('usuarios').doc(u.id).update({ rol, depositosAsignados: rol === ROLES.ENCARGADO ? (u.depositosAsignados || []) : [] });
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
                <td>
                  <select value={u.rol} onChange={(e) => cambiarRol(u, e.target.value)} style={{ padding: '5px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 6 }}>
                    {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td style={{ fontSize: 12.5 }}>
                  {u.rol === ROLES.ENCARGADO ? (u.depositosAsignados || []).map(nombreDeposito).join(', ') || '-' : 'Todos'}
                </td>
                <td>{u.activo ? 'Sí' : 'No'}</td>
                <td>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// App raíz: autenticación, carga de datos en tiempo real y ruteo por rol
// ---------------------------------------------------------------------------

function AppShell({ authUser }) {
  const [usuario, setUsuario] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [vista, setVista] = useState('dashboard');

  const [insumos, setInsumos] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [categorias, setCategorias] = useState([]);
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
  else if (vista === 'movimientos') contenido = <MovimientosView usuario={usuario} insumos={insumos} depositos={depositos} />;
  else if (vista === 'insumos') contenido = <InsumosView usuario={usuario} insumos={insumos} categorias={categorias} />;
  else if (vista === 'depositos') contenido = <DepositosView usuario={usuario} depositos={depositos} />;
  else if (vista === 'reportes' && tienePermiso(usuario.rol, 'exportarReportes')) contenido = <ReportesView usuario={usuario} insumos={insumos} depositos={depositos} stock={stock} />;
  else if (vista === 'usuarios' && tienePermiso(usuario.rol, 'gestionarUsuarios')) contenido = <UsuariosView depositos={depositos} />;
  else contenido = <DashboardView usuario={usuario} insumos={insumos} depositos={depositos} stock={stock} />;

  return (
    <div className="app-shell">
      <Sidebar vista={vista} setVista={setVista} usuario={usuario} />
      <div className="main">{contenido}</div>
    </div>
  );
}

function App() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = cargando, null = sin sesión

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => setAuthUser(user || null));
    return unsub;
  }, []);

  if (authUser === undefined) return <div className="loading-screen">Cargando...</div>;
  if (authUser === null) return <LoginScreen />;
  return <AppShell authUser={authUser} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
