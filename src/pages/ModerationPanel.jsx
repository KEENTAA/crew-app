// src/pages/ModerationPanel.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

export default function ModerationPanel() {
  const { currentUser, currentUserRole, loading: authLoading } = useAuth();

  const [projectReports, setProjectReports] = useState([]);
  const [commentReports, setCommentReports] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const isStaff =
    currentUserRole === 'Administrador' || currentUserRole === 'Moderador';

  const short = (s = '', n = 28) => (s?.length > n ? s.slice(0, n - 1) + '…' : s);
  const safeDate = (ts) => {
    try {
      return ts?.toDate?.().toLocaleString?.() || '';
    } catch {
      return '';
    }
  };

  // ---------- CARGA DE REPORTES ----------
  useEffect(() => {
    if (!currentUser || !isStaff) return;

    const col = collection(db, 'reportes');
    const unsub = onSnapshot(
      col,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const isPending = (s) => {
          const v = (s ?? '').toString().trim().toLowerCase();
          return v === 'pendiente' || v === 'pending';
        };

        // Proyectos: type === 'project' O sin type (compatibilidad)
        const proj = all
          .filter((r) => !r.type || r.type === 'project')
          .filter((r) => isPending(r.status))
          .sort(
            (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
          );

        // Comentarios: type === 'comment' O (compat) que tenga commentId
        const comm = all
          .filter((r) => r.type === 'comment' || !!r.commentId)
          .filter((r) => isPending(r.status))
          .sort(
            (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
          );

        setProjectReports(proj);
        setCommentReports(comm);
      },
      (e) => {
        console.error('Error al leer reportes:', e);
        setProjectReports([]);
        setCommentReports([]);
      }
    );

    return unsub;
  }, [currentUser?.uid, isStaff]);

  // ---------- ACCIONES: PROYECTO ----------
  const handleProjectAction = async (report, action) => {
    if (!isStaff || !report?.id || !report?.projectId) return;

    setBusyId(report.id);
    setError('');

    try {
      if (action === 'hide') {
        // Ocultar (soft)
        const pRef = doc(db, 'proyectos', report.projectId);
        await updateDoc(pRef, {
          oculto: true,
          estado: 'Oculto',
          updatedAt: serverTimestamp(),
          moderadoPor: currentUser.uid,
        });
      }

      if (action === 'delete') {
        // "Eliminar" seguro (soft delete).
        const pRef = doc(db, 'proyectos', report.projectId);
        await updateDoc(pRef, {
          eliminado: true,
          estado: 'Eliminado',
          oculto: true,
          deletedAt: serverTimestamp(),
          moderadoPor: currentUser.uid,
        });
        // 🔥 BORRADO DURO (opcional y bajo responsabilidad):
        // await deleteDoc(pRef);
      }

      // Cerrar el reporte
      const rRef = doc(db, 'reportes', report.id);
      await updateDoc(rRef, {
        status: action === 'reject' ? 'Rechazado' : 'Resuelto',
        action,
        actionBy: currentUser.uid,
        actionAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Error en acción de proyecto:', e);
      setError(e?.message || 'No se pudo ejecutar la acción.');
    } finally {
      setBusyId('');
    }
  };

  // ---------- ACCIONES: COMENTARIO ----------
  const handleCommentAction = async (report, action) => {
    if (!isStaff || !report?.id || !report?.projectId || !report?.commentId) return;

    setBusyId(report.id);
    setError('');

    try {
      if (action === 'delete') {
        const cRef = doc(
          db,
          `proyectos/${report.projectId}/comentarios/${report.commentId}`
        );
        await deleteDoc(cRef);
      }

      // Cerrar el reporte
      const rRef = doc(db, 'reportes', report.id);
      await updateDoc(rRef, {
        status: action === 'reject' ? 'Rechazado' : 'Resuelto',
        action,
        actionBy: currentUser.uid,
        actionAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Error en acción de comentario:', e);
      setError(e?.message || 'No se pudo ejecutar la acción.');
    } finally {
      setBusyId('');
    }
  };

  // ---------- GUARDS ----------
  if (authLoading) return <div style={styles.center}>Cargando autenticación…</div>;
  if (!currentUser) return <div style={styles.center}>Inicia sesión</div>;
  if (!isStaff) {
    return (
      <div style={styles.center}>
        <h3 style={{ color: '#b91c1c' }}>Permiso denegado</h3>
      </div>
    );
  }

  // ---------- RENDER ----------
  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Panel de Moderación</h1>
      <p style={styles.subtitle}>Revisa y actúa sobre el contenido reportado</p>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.tabs}>
        <span style={styles.tabActive}>Proyectos ({projectReports.length})</span>
        <span style={styles.tabMuted}>Comentarios ({commentReports.length})</span>
      </div>

      {/* Proyectos reportados */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Proyecto</th>
              <th style={styles.th}>Motivo</th>
              <th style={styles.th}>Solicitante</th>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {projectReports.length === 0 ? (
              <tr>
                <td colSpan={5} style={styles.emptyRow}>
                  No hay reportes de proyectos.
                </td>
              </tr>
            ) : (
              projectReports.map((r) => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Link
                        to={`/proyectos/${r.projectId}`}
                        style={styles.link}
                        title="Abrir proyecto"
                      >
                        {short(r.projectTitle || r.projectId)}
                      </Link>
                      <a
                        href={`/proyectos/${r.projectId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.openIcon}
                        title="Abrir en nueva pestaña"
                      >
                        ↗
                      </a>
                    </div>
                  </td>
                  <td style={styles.td}>{r.reason || '-'}</td>
                  <td style={styles.td}>{r.reporterEmail || r.reporterId || '-'}</td>
                  <td style={styles.td}>{safeDate(r.timestamp)}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        style={styles.hideBtn}
                        disabled={busyId === r.id}
                        onClick={() => handleProjectAction(r, 'hide')}
                      >
                        {busyId === r.id ? 'Aplicando…' : 'Ocultar'}
                      </button>
                      <button
                        style={styles.deleteBtn}
                        disabled={busyId === r.id}
                        onClick={() => handleProjectAction(r, 'delete')}
                      >
                        Eliminar
                      </button>
                      <button
                        style={styles.rejectBtn}
                        disabled={busyId === r.id}
                        onClick={() => handleProjectAction(r, 'reject')}
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Comentarios reportados */}
      <h3 style={{ ...styles.section, marginTop: 28 }}>Comentarios reportados</h3>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Comentario</th>
              <th style={styles.th}>Proyecto</th>
              <th style={styles.th}>Motivo</th>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {commentReports.length === 0 ? (
              <tr>
                <td colSpan={5} style={styles.emptyRow}>
                  No hay reportes de comentarios.
                </td>
              </tr>
            ) : (
              commentReports.map((r) => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td}>{short(r.commentText || r.commentId || '-', 64)}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* 👇 Enlace directo al comentario reportado */}
                      <Link
                        to={`/proyectos/${r.projectId}#comment-${r.commentId}`}
                        style={styles.link}
                        title="Ver comentario en el proyecto"
                      >
                        {short(r.projectTitle || r.projectId)}
                      </Link>
                      <a
                        href={`/proyectos/${r.projectId}#comment-${r.commentId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.openIcon}
                        title="Abrir en nueva pestaña"
                      >
                        ↗
                      </a>
                    </div>
                  </td>
                  <td style={styles.td}>{r.reason || '-'}</td>
                  <td style={styles.td}>{safeDate(r.timestamp)}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        style={styles.deleteBtn}
                        disabled={busyId === r.id}
                        onClick={() => handleCommentAction(r, 'delete')}
                      >
                        Eliminar comentario
                      </button>
                      <button
                        style={styles.rejectBtn}
                        disabled={busyId === r.id}
                        onClick={() => handleCommentAction(r, 'reject')}
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
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
  header: { fontSize: 28, margin: 0 },
  subtitle: { color: '#667085', marginTop: 6, marginBottom: 18 },

  tabs: { display: 'flex', gap: 16, margin: '8px 0 12px' },
  tabActive: { fontWeight: 700, color: '#111827' },
  tabMuted: { color: '#9CA3AF' },

  section: { fontSize: 20, margin: '16px 0 10px' },

  error: {
    color: '#b91c1c',
    background: '#fee2e2',
    padding: 10,
    border: '1px solid #fecaca',
    borderRadius: 8,
    marginBottom: 12,
  },

  tableWrap: { overflowX: 'auto', marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    background: '#1f2937',
    color: '#fff',
    fontWeight: 600,
    borderTop: '1px solid #1f2937',
    borderBottom: '1px solid #1f2937',
  },
  tr: { borderBottom: '1px solid #e5e7eb' },
  td: { padding: '10px 12px', fontSize: 14 },
  emptyRow: { padding: 14, color: '#6b7280' },

  link: { textDecoration: 'underline', color: '#111827', fontWeight: 600 },
  openIcon: {
    textDecoration: 'none',
    display: 'inline-block',
    padding: '0 6px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    lineHeight: 1.2,
    color: '#374151',
  },

  hideBtn: {
    background: '#F59E0B',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  deleteBtn: {
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  rejectBtn: {
    background: '#6b7280',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 12px',
    cursor: 'pointer',
  },
};
