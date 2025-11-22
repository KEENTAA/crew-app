// src/components/NotificationSystem.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { useAuth } from '../AuthContext';

/**
 * Canales que este componente escucha:
 * - Cliente: where('targetUserId','==',uid)
 * - Admin:   where('audience','==','admins')  (+ directas a uid)
 * - Mod:     where('audience','==','mods')    (+ directas a uid)
 *
 * Importante: este componente NO crea notificaciones.
 * Asegúrate de emitirlas así:
 *   - Broadcast a admins: { audience:'admins', ... }
 *   - Broadcast a mods:   { audience:'mods', ... }
 *   - Directa a usuario:  { targetUserId:'<uid>', ... }
 */

export default function NotificationSystem() {
  const { currentUser, currentUserRole } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  // helpers seguros para timestamp y orden
  const getTSAny = (n) => n?.timestamp || n?.createdAt || null;
  const sortByTsDesc = (a, b) => {
    const tb = getTSAny(b)?.seconds || 0;
    const ta = getTSAny(a)?.seconds || 0;
    return tb - ta;
  };
  const tsToDate = (n) => {
    try { return getTSAny(n)?.toDate?.() ?? null; } catch { return null; }
  };

  // Construimos las queries según el rol
  const queries = useMemo(() => {
    if (!currentUser) return [];
    const base = collection(db, 'notificaciones');

    if (currentUserRole === 'Cliente') {
      return [ query(base, where('targetUserId', '==', currentUser.uid)) ];
    }

    if (currentUserRole === 'Administrador') {
      return [
        query(base, where('audience', '==', 'admins')),
        query(base, where('targetUserId', '==', currentUser.uid)),
      ];
    }

    if (currentUserRole === 'Moderador') {
      return [
        query(base, where('audience', '==', 'mods')),
        query(base, where('targetUserId', '==', currentUser.uid)),
      ];
    }

    return [];
  }, [currentUser?.uid, currentUserRole]);

  // Suscripción
  useEffect(() => {
    if (!queries.length) { setNotifications([]); return; }

    const cache = new Map();
    const push = () => {
      const arr = Array.from(cache.values()).sort(sortByTsDesc).slice(0, 50);
      setNotifications(arr);
    };

    const unsubs = queries.map((qRef) =>
      onSnapshot(
        qRef,
        (snap) => {
          snap.docs.forEach((d) => cache.set(d.id, { id: d.id, ...d.data() }));
          push();
        },
        (err) => console.error('Notifications listener error:', err)
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [queries]);

  // marcar como leída (una)
  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notificaciones', id), { read: true });
    } catch (e) {
      console.error('markAsRead error', e);
    }
  };

  // marcar todas
  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        updateDoc(doc(db, 'notificaciones', n.id), { read: true }).catch(() => {})
      )
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Etiqueta amigable por tipo (alineado con services/notifications.js)
  const friendlyTitle = (n) => {
    if (n.title) return n.title;
    switch (n.type) {
      case 'kyc_requested':           return 'Solicitud de verificación de identidad';
      case 'card_request':            return 'Solicitud de tarjeta virtual';
      case 'report_project':          return 'Reporte de proyecto';
      case 'report_comment':          return 'Reporte de comentario';
      case 'id_verification_status':  return 'Estado de verificación de identidad';
      case 'card_approved':           return 'Tarjeta aprobada';
      case 'card_rejected':           return 'Tarjeta rechazada';
      default:                        return 'Notificación';
    }
  };

  const onItemClick = (n) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) {
      try { window.location.href = n.link; } catch {}
    }
  };

  return (
    <div style={styles.container}>
      <button onClick={() => setOpen((o) => !o)} style={styles.bellBtn} title="Notificaciones">
        🔔 {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.header}>
            <strong>Notificaciones</strong>
            {notifications.length > 0 && (
              <button onClick={markAllAsRead} style={styles.markAllBtn}>
                Marcar todo como leído
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={styles.empty}>
              {currentUserRole === 'Cliente'
                ? 'No tienes notificaciones.'
                : 'No hay notificaciones nuevas.'}
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{ ...styles.item, background: n.read ? '#fff' : '#eef6ff' }}
                  onClick={() => onItemClick(n)}
                >
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{friendlyTitle(n)}</div>
                  <div style={{ fontSize: 13, color: '#4b5563' }}>
                    {n.body || n.message || ''}
                  </div>
                  {n.meta?.projectTitle && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      Proyecto: {n.meta.projectTitle}
                    </div>
                  )}
                  <div style={styles.time}>
                    {tsToDate(n)?.toLocaleString?.() ?? ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={styles.footer}>
            <a href="/notificaciones">Ver todo</a>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { position: 'relative', display: 'inline-block', zIndex: 50 },
  bellBtn: {
    background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
    position: 'relative', color: '#455A64', padding: '2px 6px'
  },
  badge: {
    position: 'absolute', top: -6, right: -4, background: '#ef4444', color: '#fff',
    borderRadius: 999, fontSize: 12, padding: '2px 6px', minWidth: 18, textAlign: 'center'
  },
  dropdown: {
    position: 'absolute', top: 38, right: 0, width: 340, background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 12px 24px rgba(0,0,0,0.1)'
  },
  header: {
    padding: 10, borderBottom: '1px solid #e5e7eb',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  markAllBtn: {
    border: '1px solid #d1d5db', background: '#fff', padding: '4px 8px',
    borderRadius: 6, fontSize: 12, cursor: 'pointer'
  },
  empty: { padding: 14, color: '#6b7280', textAlign: 'center' },
  item: { padding: 12, borderBottom: '1px solid #f3f4f6', cursor: 'pointer' },
  time: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  footer: { padding: 8, borderTop: '1px solid #e5e7eb', textAlign: 'center' }
};
