// src/services/notifications.js
import { db } from '../firebaseConfig';
import {
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  getDocs,
} from 'firebase/firestore';

/* ============================================================
 * ESCRITURA DE NOTIFICACIONES
 * ============================================================ */

/**
 * Notificación directa a UN usuario.
 * @param {{targetUserId:string, type?:string, title?:string, body?:string, meta?:object}} payload
 */
export async function sendNotification(payload) {
  if (!payload?.targetUserId) return;
  await addDoc(collection(db, 'notificaciones'), {
    read: false,
    timestamp: serverTimestamp(),
    ...payload,
  });
}

/**
 * (LEGACY) Enviar una copia a todos los usuarios con rol = role.
 * Solo funciona si el caller puede leer /usuarios (normalmente, un Admin).
 * @param {'Administrador'|'Moderador'|'Cliente'} role
 * @param {{type?:string, title?:string, body?:string, meta?:object}} payload
 */
export async function sendNotificationToRole(role, payload) {
  // ⚠️ Requiere permisos de lectura en /usuarios por reglas.
  const snap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', role)));
  const writes = [];
  snap.forEach((u) => {
    writes.push(
      addDoc(collection(db, 'notificaciones'), {
        targetUserId: u.id,
        read: false,
        timestamp: serverTimestamp(),
        ...payload,
      })
    );
  });
  await Promise.all(writes);
}

/**
 * Broadcast general para ADMINISTRADORES (no copia por usuario).
 * Los admin podrán leerlo gracias a audience:'admins'.
 */
export async function sendAdminsBroadcast(payload) {
  await addDoc(collection(db, 'notificaciones'), {
    audience: 'admins',
    read: false,
    timestamp: serverTimestamp(),
    ...payload,
  });
}

/**
 * Broadcast general para MODERADORES (no copia por usuario).
 * Los mods podrán leerlo gracias a audience:'mods'.
 */
export async function sendModsBroadcast(payload) {
  await addDoc(collection(db, 'notificaciones'), {
    audience: 'mods',
    read: false,
    timestamp: serverTimestamp(),
    ...payload,
  });
}

/** Marca una notificación como leída */
export async function markAsRead(id) {
  await updateDoc(doc(db, 'notificaciones', id), { read: true });
}

/* ============================================================
 * SUSCRIPCIONES EN TIEMPO REAL (lectura)
 * ============================================================ */

/**
 * Suscribirse a notificaciones DIRECTAS de un usuario.
 * @param {string} uid
 * @param {{onlyUnread?:boolean,onData?:(items:any[])=>void}} opts
 * @returns {() => void} unsubscribe
 */
export function subscribeNotifications(uid, { onlyUnread = false, onData } = {}) {
  if (!uid) return () => {};
  const qRef = query(
    collection(db, 'notificaciones'),
    where('targetUserId', '==', uid),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(
    qRef,
    (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Compatibilidad: algunos docs antiguos pueden tener createdAt
      const items = raw.map((n) => ({ ...n, _ts: n.timestamp || n.createdAt || null }));
      onData?.(onlyUnread ? items.filter((n) => !n.read) : items);
    },
    (err) => {
      console.error('subscribeNotifications error:', err);
      onData?.([]);
    }
  );
}

/**
 * Suscribirse a BROADCASTS de ADMIN.
 * Requiere índice compuesto para (audience == 'admins') + orderBy(timestamp).
 */
export function subscribeAdminBroadcasts({ onlyUnread = false, onData } = {}) {
  const qRef = query(
    collection(db, 'notificaciones'),
    where('audience', '==', 'admins'),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(
    qRef,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData?.(onlyUnread ? items.filter((n) => !n.read) : items);
    },
    (err) => {
      console.error('subscribeAdminBroadcasts error:', err);
      onData?.([]);
    }
  );
}

/**
 * Suscribirse a BROADCASTS de MODERADORES.
 * Requiere índice compuesto para (audience == 'mods') + orderBy(timestamp).
 */
export function subscribeModBroadcasts({ onlyUnread = false, onData } = {}) {
  const qRef = query(
    collection(db, 'notificaciones'),
    where('audience', '==', 'mods'),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(
    qRef,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData?.(onlyUnread ? items.filter((n) => !n.read) : items);
    },
    (err) => {
      console.error('subscribeModBroadcasts error:', err);
      onData?.([]);
    }
  );
}

/* ============================================================
 * HELPERS ESPECÍFICOS DE TU APP (tarjeta / KYC / reportes)
 * ============================================================ */

/* ---------- Tarjeta virtual ---------- */

/** Cliente → Admin: avisar que el usuario solicitó tarjeta */
export async function notifyAdminsCardRequested({ userId, email, mode = 'broadcast' }) {
  const payload = {
    type: 'card_request',
    title: '🪪 Nueva solicitud de tarjeta',
    body: `El usuario ${email || userId} solicitó una tarjeta virtual.`,
    requesterId: userId,
  };
  if (mode === 'role') {
    await sendNotificationToRole('Administrador', payload); // requiere ser admin
  } else {
    await sendAdminsBroadcast(payload); // seguro para cualquier usuario autenticado
  }
}

/** Admin → Usuario: aprobada */
export async function notifyUserCardApproved({ userId }) {
  await sendNotification({
    targetUserId: userId,
    type: 'card_approved',
    title: '✅ Tarjeta aprobada',
    body: '¡Tu tarjeta virtual ha sido aprobada! Ya puedes recargar tu Wallet.',
  });
}

/** Admin → Usuario: rechazada */
export async function notifyUserCardRejected({ userId, reason = '' }) {
  await sendNotification({
    targetUserId: userId,
    type: 'card_rejected',
    title: '❌ Tarjeta rechazada',
    body: reason ? `Motivo: ${reason}` : 'Tu solicitud de tarjeta fue rechazada.',
  });
}

/* ---------- Verificación de identidad (KYC) ---------- */

/** Cliente → Admin: solicitó verificación de identidad */
export async function notifyAdminsKycRequested({ userId, email }) {
  await sendAdminsBroadcast({
    type: 'kyc_requested',
    title: '🪪 Nueva verificación de identidad',
    body: `El usuario ${email || userId} pidió verificación de identidad.`,
    requesterId: userId,
  });
}

/** Admin → Usuario: KYC aprobado */
export async function notifyUserKycApproved({ userId }) {
  await sendNotification({
    targetUserId: userId,
    type: 'id_verification_status',
    title: '✅ Verificación aprobada',
    body: '¡Tu identidad ha sido verificada! Ya puedes publicar proyectos.',
  });
}

/** Admin → Usuario: KYC rechazado */
export async function notifyUserKycRejected({ userId, reason = '' }) {
  await sendNotification({
    targetUserId: userId,
    type: 'id_verification_status',
    title: '❌ Verificación rechazada',
    body: reason ? `Motivo: ${reason}` : 'Tu solicitud de verificación fue rechazada.',
  });
}

/* ---------- Reportes (para Moderadores) ---------- */

/** Cualquier usuario → Mods: nuevo REPORTE de PROYECTO */
export async function notifyModsNewProjectReport({ projectId, projectTitle, reason, reporterId }) {
  await sendModsBroadcast({
    type: 'report_project',
    title: '⚠️ Reporte de proyecto',
    body: reason || 'Nuevo reporte de proyecto.',
    meta: { projectId, projectTitle, reporterId },
  });
}

/** Cualquier usuario → Mods: nuevo REPORTE de COMENTARIO */
export async function notifyModsNewCommentReport({ projectId, commentId, reason, reporterId }) {
  await sendModsBroadcast({
    type: 'report_comment',
    title: '⚠️ Reporte de comentario',
    body: reason || 'Nuevo reporte de comentario.',
    meta: { projectId, commentId, reporterId },
  });
}
