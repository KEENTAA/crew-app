// src/pages/AdminPanel.jsx

import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import {
  collection,
  query,
  getDocs,
  onSnapshot,
  where,
  doc,
  getDoc,
  getCountFromServer,
  updateDoc as firestoreUpdateDoc,
} from 'firebase/firestore';

// Panel de verificación de identidad (KYC)
import IDVerificationPanel from '../components/Admin/IDVerificationPanel';

// Servicios de tarjetas (genera tarjeta + notifica)
import { aprobarTarjeta, rechazarTarjeta } from '../services/cards';

const ROLES = ['Cliente', 'Moderador', 'Administrador'];

export default function AdminPanel() {
  const { currentUser, currentUserRole, loading: authLoading } = useAuth();

  // Estado
  const [users, setUsers] = useState([]);
  const [pendingCards, setPendingCards] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCards, setLoadingCards] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Métricas (BD)
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  // Loading por fila para aprobar/rechazar
  const [loadingApprovals, setLoadingApprovals] = useState({});

  // Utils
  const safeDate = (d) => {
    try { return d?.toDate?.().toLocaleString?.() || ''; } catch { return ''; }
  };

  // 1) Cargar usuarios (gestión de roles)
  useEffect(() => {
    if (!currentUser || currentUserRole !== 'Administrador') return;

    const load = async () => {
      try {
        setLoadingUsers(true);
        const snap = await getDocs(query(collection(db, 'usuarios')));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(list);
      } catch (e) {
        console.error('Error al cargar usuarios:', e);
        setError('No se pudo cargar la lista de usuarios.');
      } finally {
        setLoadingUsers(false);
      }
    };
    load();
  }, [currentUser, currentUserRole]);

  // 2) Escuchar solicitudes de tarjeta PENDIENTES
  useEffect(() => {
    if (!currentUser || currentUserRole !== 'Administrador') return;

    // Cubrimos 'pending' y 'Pendiente'
    const base = collection(db, 'solicitudesTarjeta');
    const qRef = query(base, where('status', 'in', ['pending', 'Pendiente']));

    const unsub = onSnapshot(
      qRef,
      async (snap) => {
        const items = [];
        for (const d of snap.docs) {
          const data = d.data();
          let { email } = data;
          const userId = data.userId || data.uid || '';

          // buscamos también el nombre para mostrarlo
          let displayName = '';
          if (userId) {
            try {
              const uSnap = await getDoc(doc(db, 'usuarios', userId));
              if (uSnap.exists()) {
                const ud = uSnap.data();
                email = email || ud?.email || ud?.correo || '';
                displayName =
                  ud?.nombre ||
                  ud?.name ||
                  ud?.displayName ||
                  '';
              }
            } catch {/* ignore */}
          }

          items.push({
            id: d.id,
            ...data,
            userId,
            email: email || '(sin email)',
            displayName, // 👈 nombre si existe
          });
        }

        // Orden en cliente por createdAt/requestedAt (desc)
        items.sort((a, b) => {
          const ta = (a.createdAt || a.requestedAt)?.seconds || 0;
          const tb = (b.createdAt || b.requestedAt)?.seconds || 0;
          return tb - ta;
        });

        setPendingCards(items);
        setLoadingCards(false);
      },
      (e) => {
        console.error('Error al cargar solicitudes de tarjeta:', e);
        setLoadingCards(false);
      }
    );

    return unsub;
  }, [currentUser, currentUserRole]);

  // 3) Métricas reales (conteos)
  useEffect(() => {
    if (!currentUser || currentUserRole !== 'Administrador') return;

    const loadCounts = async () => {
      try {
        const projSnap = await getCountFromServer(collection(db, 'proyectos'));
        setTotalProjects(projSnap.data().count || 0);

        const txSnap = await getCountFromServer(collection(db, 'transacciones'));
        setTotalTransactions(txSnap.data().count || 0);
      } catch (e) {
        console.warn('Conteo de métricas falló:', e?.message || e);
      }
    };

    loadCounts();
  }, [currentUser, currentUserRole]);

  // Cambiar rol
  const handleRoleChange = async (userId, newRole) => {
    try {
      if (userId === auth.currentUser.uid) {
        setError('No puedes cambiar tu propio rol por seguridad.');
        return;
      }
      await firestoreUpdateDoc(doc(db, 'usuarios', userId), { rol: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, rol: newRole } : u));
      setMessage(`Rol de ${userId.substring(0, 5)}… actualizado a ${newRole}`);
      setError('');
    } catch (e) {
      console.error('Error al cambiar rol:', e);
      setError('Fallo al actualizar el rol en la base de datos.');
      setMessage('');
    }
  };

  // Aprobar / Rechazar tarjeta
  const handleApproveCard = async (requestId, userId) => {
    setLoadingApprovals(prev => ({ ...prev, [requestId]: true }));
    try {
      // si tu servicio solo acepta (requestId, adminUid), este 3er param se ignora sin problema
      await aprobarTarjeta(requestId, currentUser.uid, userId);
      setMessage('Tarjeta aprobada y usuario notificado.');
      setError('');
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo aprobar la tarjeta.');
      setMessage('');
    } finally {
      setLoadingApprovals(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleRejectCard = async (requestId, userId) => {
    setLoadingApprovals(prev => ({ ...prev, [requestId]: true }));
    try {
      const reason = prompt('Motivo del rechazo (opcional):') || '';
      await rechazarTarjeta(requestId, currentUser.uid, reason, userId);
      setMessage('Solicitud rechazada y usuario notificado.');
      setError('');
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo rechazar la solicitud.');
      setMessage('');
    } finally {
      setLoadingApprovals(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // Guards
  if (authLoading || loadingUsers || loadingCards) return <div style={styles.center}>Cargando panel…</div>;
  if (!currentUser) return <div style={styles.center}>Inicia sesión</div>;
  if (currentUserRole !== 'Administrador') {
    return (
      <div style={styles.center}>
        <h3 style={{ color: '#b91c1c' }}>Permiso denegado</h3>
      </div>
    );
  }

  // Render
  const totalUsers = users.length;
  const totalPendingCards = pendingCards.length;

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Panel de Administración</h1>
      <p style={styles.subtitle}>Gestión de roles, solicitudes de tarjeta, verificación de identidad y métricas.</p>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      {/* Métricas */}
      <h3 style={styles.section}>Métricas del Sistema</h3>
      <div style={styles.metricsGrid}>
        <div style={{ ...styles.metricCard, borderLeftColor: '#3B82F6' }}>
          <p style={styles.metricLabel}>USUARIOS</p>
          <h4 style={styles.metricValue}>{totalUsers}</h4>
        </div>
        <div style={{ ...styles.metricCard, borderLeftColor: '#F59E0B' }}>
          <p style={styles.metricLabel}>SOLIC. TARJETA PENDIENTES</p>
          <h4 style={styles.metricValue}>{totalPendingCards}</h4>
        </div>
        <div style={{ ...styles.metricCard, borderLeftColor: '#10B981' }}>
          <p style={styles.metricLabel}>TOTAL PROYECTOS</p>
          <h4 style={styles.metricValue}>{totalProjects}</h4>
        </div>
        <div style={{ ...styles.metricCard, borderLeftColor: '#EF4444' }}>
          <p style={styles.metricLabel}>TOTAL TRANSACCIONES</p>
          <h4 style={styles.metricValue}>{totalTransactions}</h4>
        </div>
      </div>

      {/* Panel de verificación de identidad (KYC) */}
      <IDVerificationPanel />

      {/* Solicitudes de tarjeta */}
      <h3 style={styles.section}>Solicitudes de Tarjeta Pendientes ({totalPendingCards})</h3>
      {totalPendingCards === 0 ? (
        <p style={{ color: '#6b7280' }}>No hay solicitudes pendientes.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Usuario</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Fecha de solicitud</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendingCards.map((r) => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td}>
                    {r.displayName?.trim()
                      ? r.displayName
                      : (r.userId ? `${r.userId.substring(0, 10)}…` : '(desconocido)')}
                  </td>
                  <td style={styles.td}>{r.email}</td>
                  <td style={styles.td}>{safeDate(r.createdAt || r.requestedAt)}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={styles.approveBtn}
                        onClick={() => handleApproveCard(r.id, r.userId)}
                        disabled={!!loadingApprovals[r.id]}
                      >
                        {loadingApprovals[r.id] ? 'Procesando…' : 'Aprobar'}
                      </button>
                      <button
                        style={styles.rejectBtn}
                        onClick={() => handleRejectCard(r.id, r.userId)}
                        disabled={!!loadingApprovals[r.id]}
                      >
                        {loadingApprovals[r.id] ? 'Procesando…' : 'Rechazar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gestión de roles */}
      <h3 style={styles.section}>Gestión de Roles (Total: {totalUsers})</h3>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Rol actual</th>
              <th style={styles.th}>Cambiar rol</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={styles.tr}>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>
                  <span style={styles.roleBadge(u.rol)}>{u.rol}</span>
                </td>
                <td style={styles.td}>
                  <select
                    value={u.rol}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    style={styles.select}
                    disabled={u.id === auth.currentUser.uid}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Estilos ---------- */
const styles = {
  center: { textAlign: 'center', padding: '100px' },
  container: {
    padding: 32,
    maxWidth: 1200,
    margin: '40px auto',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
  },
  header: { fontSize: 32, margin: 0, borderBottom: '2px solid #eee', paddingBottom: 10 },
  subtitle: { color: '#667085', marginTop: 8, marginBottom: 24 },
  section: { fontSize: 22, margin: '28px 0 12px' },

  success: {
    color: '#065f46', background: '#d1fae5', padding: 10, border: '1px solid #a7f3d0',
    borderRadius: 8, marginBottom: 12,
  },
  error: {
    color: '#b91c1c', background: '#fee2e2', padding: 10, border: '1px solid #fecaca',
    borderRadius: 8, marginBottom: 12,
  },

  metricsGrid: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' },
  metricCard: {
    background: '#f8fafc', padding: 16, borderRadius: 10, borderLeft: '5px solid',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)', minHeight: 80,
  },
  metricLabel: { fontSize: 12, color: '#6b7280', margin: 0 },
  metricValue: { fontSize: 28, fontWeight: 700, margin: '6px 0 0' },

  tableWrap: { overflowX: 'auto', marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', background: '#1f2937', color: '#fff', fontWeight: 600 },
  tr: { borderBottom: '1px solid #e5e7eb' },
  td: { padding: '10px 12px', fontSize: 14 },

  approveBtn: {
    background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  rejectBtn: {
    background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer',
    transition: 'background-color 0.2s',
  },

  roleBadge: (role) => {
    let bg = '#6b7280';
    if (role === 'Administrador') bg = '#dc2626';
    else if (role === 'Moderador') bg = '#f59e0b';
    else if (role === 'Cliente') bg = '#16a34a';
    return { background: bg, color: '#fff', padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 };
  },
  select: { padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' },
};
