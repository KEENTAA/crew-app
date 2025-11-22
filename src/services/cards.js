// src/services/cards.js
import { db } from '../firebaseConfig';
import {
  addDoc, collection, serverTimestamp, doc, runTransaction, getDoc
} from 'firebase/firestore';
import { sendNotification, sendNotificationToRole } from './notifications';
import { generateVirtualCard } from '../utils/cardUtils';

/**
 * Usuario solicita tarjeta virtual:
 * - crea doc en /solicitudesTarjeta (status: 'Pendiente')
 * - notifica a TODOS los Admins
 */
export async function solicitarTarjeta(uid) {
  const ref = await addDoc(collection(db, 'solicitudesTarjeta'), {
    userId: uid,
    status: 'Pendiente',               // Cambiado a 'Pendiente' para consistencia
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Notifica a Admins
  await sendNotificationToRole('Administrador', {
    actorUserId: uid,
    type: 'card_request',
    title: 'Nueva solicitud de tarjeta',
    body: 'Un usuario ha solicitado una tarjeta virtual.',
    extra: { requestId: ref.id },
  });

  return ref.id;
}

/**
 * Admin aprueba solicitud:
 * - actualiza /solicitudesTarjeta -> Aprobada
 * - genera tarjeta y la guarda en usuarios/{uid}
 * - notifica al usuario
 */
export async function aprobarTarjeta(requestId, adminUid, userId = null) {
  const reqRef = doc(db, 'solicitudesTarjeta', requestId);

  let finalUserId = userId;
  let userName = 'Usuario CREW';

  await runTransaction(db, async (tx) => {
    // Lee solicitud
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error('Solicitud no encontrada');
    const req = reqSnap.data();
    
    // Verificar que esté en estado Pendiente (en español)
    if (req.status !== 'Pendiente') throw new Error('La solicitud ya fue resuelta');
    
    // Usar el userId proporcionado o el de la solicitud
    finalUserId = finalUserId || req.userId;

    // Lee usuario para nombre
    const userRef = doc(db, 'usuarios', finalUserId);
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists()) throw new Error('Usuario no encontrado');
    const uData = uSnap.data();
    userName = uData?.nombre || uData?.displayName || 'Usuario CREW';

    // Genera tarjeta virtual con tu util existente
    const card = generateVirtualCard(userName);
    const last4 = card.cardNumber.slice(-4);

    // Marca solicitud aprobada (en español)
    tx.update(reqRef, {
      status: 'Aprobada',
      approvedBy: adminUid,
      updatedAt: serverTimestamp(),
      cardLast4: last4,
    });

    // Guarda tarjeta en usuarios/{uid}
    tx.update(userRef, {
      cardStatus: 'approved',
      virtualCard: {
        ...card,
        createdAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });
  });

  // Notifica al usuario (fuera del tx)
  await sendNotification({
    targetUserId: finalUserId,
    actorUserId: adminUid,
    type: 'card_approved',
    title: 'Tarjeta aprobada',
    body: 'Tu tarjeta virtual ha sido aprobada. Ya puedes cargar saldo.',
    extra: { requestId },
  });
}

/**
 * Admin rechaza solicitud:
 * - actualiza /solicitudesTarjeta -> Rechazada
 * - marca cardStatus en usuarios/{uid}
 * - notifica al usuario
 */
export async function rechazarTarjeta(requestId, adminUid, reason = '', userId = null) {
  const reqRef = doc(db, 'solicitudesTarjeta', requestId);

  let finalUserId = userId;

  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error('Solicitud no encontrada');
    const req = reqSnap.data();
    
    // Verificar que esté en estado Pendiente (en español)
    if (req.status !== 'Pendiente') throw new Error('La solicitud ya fue resuelta');
    
    // Usar el userId proporcionado o el de la solicitud
    finalUserId = finalUserId || req.userId;

    // Marca solicitud rechazada (en español)
    tx.update(reqRef, {
      status: 'Rechazada',
      rejectedBy: adminUid,
      rejectReason: reason,
      updatedAt: serverTimestamp(),
    });

    // Actualiza estado del usuario
    const userRef = doc(db, 'usuarios', finalUserId);
    tx.update(userRef, {
      cardStatus: 'rejected',
      updatedAt: serverTimestamp(),
    });
  });

  await sendNotification({
    targetUserId: finalUserId,
    actorUserId: adminUid,
    type: 'card_rejected',
    title: 'Tarjeta rechazada',
    body: reason ? `Motivo: ${reason}` : 'Tu tarjeta virtual fue rechazada.',
    extra: { requestId },
  });
}

/**
 * Función auxiliar para migrar estados existentes (OPCIONAL)
 * Ejecutar una sola vez en la consola del navegador
 */
export async function migrarEstadosTarjetas() {
  console.log('Migrando estados de solicitudes de tarjeta...');
  
  const querySnapshot = await getDocs(collection(db, 'solicitudesTarjeta'));
  const batch = writeBatch(db);
  
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.status === 'pending') {
      batch.update(doc.ref, { status: 'Pendiente' });
    } else if (data.status === 'approved') {
      batch.update(doc.ref, { status: 'Aprobada' });
    } else if (data.status === 'rejected') {
      batch.update(doc.ref, { status: 'Rechazada' });
    }
  });
  
  await batch.commit();
  console.log('Migración completada');
}