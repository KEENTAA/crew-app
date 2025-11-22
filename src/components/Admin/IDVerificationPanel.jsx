// src/components/Admin/IDVerificationPanel.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../AuthContext';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';

// 🔧 Storage: usa el storage exportado por tu app si existe, o getStorage() como fallback
import { storage as appStorage } from '../../firebaseConfig';
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';

const storageInstance = appStorage || getStorage();

const getDisplayName = (u) => u?.nombre || u?.name || u?.displayName || 'N/A';

export default function IDVerificationPanel() {
  const { currentUser, currentUserRole } = useAuth();
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [loadingAction, setLoadingAction] = useState({}); // carga por usuario

  const moderatorId = currentUser?.uid;

  // 1) Escuchar solicitudes de verificación de ID Pendientes
  useEffect(() => {
    if (currentUserRole !== 'Administrador' && currentUserRole !== 'Moderador') {
      setLoading(false);
      return;
    }

    const qRef = query(
      collection(db, 'usuarios'),
      where('isIDVerified', '==', 'Pending')
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPendingVerifications(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error al cargar verificaciones de ID:', err);
        setError('Error al cargar solicitudes de verificación.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUserRole]);

  // 2) Aprobar Identidad
  const handleApprove = async (userId, userEmail) => {
    setLoadingAction((p) => ({ ...p, [userId]: true }));
    try {
      await updateDoc(doc(db, 'usuarios', userId), {
        isIDVerified: true,
        verificationStatusNote: `Aprobado por ${moderatorId}`,
        verifiedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notificaciones'), {
        targetUserId: userId,
        type: 'id_verification_status',
        title: '✅ Verificación Aprobada',
        message: '¡Tu identidad ha sido verificada! Ya puedes publicar proyectos.',
        read: false,
        timestamp: serverTimestamp(),
      });

      setMessage(`Identidad de ${userEmail} aprobada.`);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('Falló la aprobación del ID.');
    } finally {
      setLoadingAction((p) => ({ ...p, [userId]: false }));
    }
  };

  // 3) Rechazar Identidad
  const handleReject = async (userId, userEmail) => {
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;

    setLoadingAction((p) => ({ ...p, [userId]: true }));
    try {
      await updateDoc(doc(db, 'usuarios', userId), {
        isIDVerified: false,
        verificationStatusNote: `Rechazado: ${reason}`,
        rejectedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notificaciones'), {
        targetUserId: userId,
        type: 'id_verification_status',
        title: '❌ Verificación Rechazada',
        message: `Tu solicitud de verificación fue rechazada. Motivo: ${reason}.`,
        read: false,
        timestamp: serverTimestamp(),
      });

      setMessage(`Identidad de ${userEmail} rechazada.`);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('Falló el rechazo del ID.');
    } finally {
      setLoadingAction((p) => ({ ...p, [userId]: false }));
    }
  };

  // --- Helpers para abrir imagen sin bloqueo ---
  const dataURLtoBlob = (dataUrl) => {
    const [meta, b64] = dataUrl.split(',');
    const mimeMatch = /data:(.*?);base64/.exec(meta);
    const mime = mimeMatch?.[1] || 'image/jpeg';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const base64ToBlob = (b64, mime = 'image/jpeg') => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const openUrlInNewTab = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // 4) Abrir imagen: dataURL/base64 → Blob; http/https; gs:///path → getDownloadURL
  const openIdImage = async (user) => {
    const raw = user?.ciFrontBase64 || ''; // base64 o dataURL
    const urlField = user?.ciFrontUrl || user?.ciFrontPath || user?.ciFront || '';

    try {
      // a) data URL
      if (raw && typeof raw === 'string' && raw.startsWith('data:')) {
        const blob = dataURLtoBlob(raw);
        const obj = URL.createObjectURL(blob);
        openUrlInNewTab(obj);
        setTimeout(() => URL.revokeObjectURL(obj), 10_000);
        return;
      }

      // b) base64 pelado
      if (
        raw &&
        typeof raw === 'string' &&
        !raw.startsWith('http') &&
        !raw.startsWith('gs://') &&
        !raw.startsWith('data:')
      ) {
        const blob = base64ToBlob(raw, 'image/jpeg');
        const obj = URL.createObjectURL(blob);
        openUrlInNewTab(obj);
        setTimeout(() => URL.revokeObjectURL(obj), 10_000);
        return;
      }

      // c) http/https directo
      if (urlField && /^https?:\/\//i.test(urlField)) {
        openUrlInNewTab(urlField);
        return;
      }

      // d) gs:// o path → getDownloadURL
      if (urlField && typeof urlField === 'string') {
        const fileRef = storageRef(storageInstance, urlField);
        const publicUrl = await getDownloadURL(fileRef);
        openUrlInNewTab(publicUrl);
        return;
      }

      alert('No hay imagen de CI disponible.');
    } catch (err) {
      console.error('openIdImage error:', err);
      alert('No se pudo abrir la imagen del CI (revisa reglas de Storage y la ruta).');
    }
  };

  if (loading) return <div style={styles.center}>Cargando verificaciones...</div>;

  return (
    <div style={styles.panelContainer}>
      <h3 style={styles.panelHeader}>
        Verificación de Identidad (KYC) ({pendingVerifications.length})
      </h3>
      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      {pendingVerifications.length === 0 ? (
        <p>No hay solicitudes de verificación de CI pendientes.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>CI N°</th>
                <th style={styles.th}>Foto CI</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendingVerifications.map((user) => (
                <tr key={user.id} style={styles.tr}>
                  <td style={styles.td}>{user.email}</td>
                  <td style={styles.td}>{getDisplayName(user)}</td>
                  <td style={styles.td}>{user.ciNumber || 'N/A'}</td>
                  <td style={styles.td}>
                    {(user.ciFrontBase64 || user.ciFrontUrl || user.ciFrontPath || user.ciFront) ? (
                      <button onClick={() => openIdImage(user)} style={styles.viewButton}>
                        Ver Foto
                      </button>
                    ) : (
                      'No Subida'
                    )}
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleApprove(user.id, user.email)}
                      style={styles.approveBtn}
                      disabled={!!loadingAction[user.id]}
                    >
                      {loadingAction[user.id] ? 'Procesando...' : 'Aprobar'}
                    </button>
                    <button
                      onClick={() => handleReject(user.id, user.email)}
                      style={styles.rejectBtn}
                      disabled={!!loadingAction[user.id]}
                    >
                      {loadingAction[user.id] ? 'Procesando...' : 'Rechazar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Estilos ---
const styles = {
  center: { textAlign: 'center', padding: '50px' },
  panelContainer: {
    marginBottom: '30px',
    border: '1px solid #ddd',
    padding: '20px',
    borderRadius: '8px',
  },
  panelHeader: {
    fontSize: '20px',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
  },
  tableWrap: { overflowX: 'auto', marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    background: '#1f2937',
    color: '#fff',
    fontWeight: 600,
  },
  tr: { borderBottom: '1px solid #e5e7eb' },
  td: { padding: '10px 12px', fontSize: 14 },
  approveBtn: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 12px',
    cursor: 'pointer',
    marginRight: '5px',
    transition: 'background-color 0.2s',
  },
  rejectBtn: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  viewButton: {
    padding: '6px 10px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  success: {
    color: '#065f46',
    background: '#d1fae5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  error: {
    color: '#b91c1c',
    background: '#fee2e2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
};
