// src/services/verification.js
import { db, storage } from '../firebaseConfig';
import {
  addDoc, collection, doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendNotificationToRole, sendNotification } from './notifications';

/**
 * Crea/actualiza la solicitud de verificación de identidad de un usuario.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.email
 * @param {string} params.idNumber           // número de carnet
 * @param {File|Blob|string} params.frontImage // file Blob o dataURL; si ya tienes URL pásala como string
 */
export async function solicitarVerificacion({ userId, email, idNumber, frontImage }) {
  if (!userId || !idNumber) throw new Error('Faltan datos');

  // 1) Subimos la imagen (si no es URL)
  let frontUrl = typeof frontImage === 'string' ? frontImage : '';
  if (frontImage && typeof frontImage !== 'string') {
    const path = `verificaciones/${userId}/frontal_${Date.now()}.jpg`;
    const r = ref(storage, path);
    await uploadBytes(r, frontImage);
    frontUrl = await getDownloadURL(r);
  }

  // 2) Creamos la solicitud
  const payload = {
    userId,
    email: email || '',
    idNumber,
    frontUrl,
    status: 'pending',          // 👈 importante
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, 'verificaciones'), payload);

  // 3) Marcamos estado KYC en el usuario
  await setDoc(
    doc(db, 'usuarios', userId),
    { kycStatus: 'pending', kycRequestedAt: serverTimestamp() },
    { merge: true }
  );

  // 4) Notificamos a todos los administradores (broadcast visible por NotificationSystem)
  await sendNotificationToRole('Administrador', {
    audience: 'admins', // 👈 CLAVE: para que el NotificationSystem del admin lo muestre
    type: 'kyc_request',
    title: 'Nueva solicitud de verificación',
    body: `${email || userId} envió su carnet para verificación.`,
    actorUserId: userId,
  });
}

/**
 * Aprueba la verificación: marca al usuario como verificado y notifica.
 */
export async function aprobarVerificacion({ requestId, userId }) {
  await setDoc(doc(db, 'usuarios', userId), {
    kycStatus: 'verified',
    kycVerifiedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(doc(db, 'verificaciones', requestId), {
    status: 'approved',
    resolvedAt: serverTimestamp()
  }, { merge: true });

  await sendNotification({
    targetUserId: userId,
    type: 'kyc_approved',
    title: '✅ Verificación aprobada',
    body: 'Tu verificación de identidad fue aprobada. ¡Ya puedes publicar proyectos!',
  });
}

/**
 * Rechaza la verificación: guarda motivo y notifica.
 */
export async function rechazarVerificacion({ requestId, userId, reason = '' }) {
  await setDoc(doc(db, 'usuarios', userId), {
    kycStatus: 'rejected',
    kycRejectedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(doc(db, 'verificaciones', requestId), {
    status: 'rejected',
    reason,
    resolvedAt: serverTimestamp()
  }, { merge: true });

  await sendNotification({
    targetUserId: userId,
    type: 'kyc_rejected',
    title: '❌ Verificación rechazada',
    body: reason ? `Motivo: ${reason}` : 'Tu verificación fue rechazada.',
  });
}
