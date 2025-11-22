// src/services/firestore.js
import { db } from '../firebaseConfig';
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  updateDoc,
  serverTimestamp,
  runTransaction,
  query,
  orderBy,
} from 'firebase/firestore';

/** Depositar saldo (simple) */
export async function depositarSaldo(uid, amount) {
  const usuarioRef = doc(db, 'usuarios', uid);
  const monto = Number(amount);
  if (!monto || monto <= 0) throw new Error('Monto inválido');

  await runTransaction(db, async (tx) => {
    const uSnap = await tx.get(usuarioRef);
    if (!uSnap.exists()) {
      // si el usuario no tiene doc todavía, créalo mínimo
      tx.set(usuarioRef, { balance: monto, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return;
    }
    const balance = uSnap.data().balance ?? 0;
    tx.update(usuarioRef, { balance: balance + monto, updatedAt: serverTimestamp() });
  });

  await addDoc(collection(db, 'transacciones'), {
    type: 'deposito',
    origenID: uid,
    destinoID: uid,
    amount: monto,
    timestamp: serverTimestamp(),
  });
}

/** Donar a un proyecto: transacción + notificación (FUERA del tx) */
export async function donarAProyecto(uid, projectId, amount) {
  const usuarioRef = doc(db, 'usuarios', uid);
  const proyectoRef = doc(db, 'proyectos', projectId);
  const monto = Number(amount);
  if (!monto || monto <= 0) throw new Error('Monto inválido');

  let creadorID = null;
  let nuevoRecaudado = 0;
  let metaTotal = 0;

  // 1) Actualizaciones atómicas
  await runTransaction(db, async (tx) => {
    const [uSnap, pSnap] = await Promise.all([tx.get(usuarioRef), tx.get(proyectoRef)]);
    if (!uSnap.exists()) throw new Error('Usuario no encontrado');
    if (!pSnap.exists()) throw new Error('Proyecto no encontrado');

    const user = uSnap.data();
    const proyecto = pSnap.data();
    creadorID = proyecto.creadorID;
    metaTotal = Number(proyecto.metaTotal || 0);

    if ((user.balance ?? 0) < monto) throw new Error('Fondos insuficientes');
    if (proyecto.estado === 'Completado') throw new Error('El proyecto ya está completado');

    nuevoRecaudado = (proyecto.recaudado ?? 0) + monto;

    tx.update(usuarioRef, {
      balance: (user.balance ?? 0) - monto,
      updatedAt: serverTimestamp(),
    });

    tx.update(proyectoRef, {
      recaudado: nuevoRecaudado,
      projectWalletBalance: (proyecto.projectWalletBalance ?? 0) + monto,
      updatedAt: serverTimestamp(),
      ...(metaTotal > 0 && nuevoRecaudado >= metaTotal ? { estado: 'Completado' } : {}),
    });
  });

  // 2) Registrar transacción (puede ir fuera del tx)
  await addDoc(collection(db, 'transacciones'), {
    type: 'donacion',
    origenID: uid,
    destinoID: projectId,
    amount: monto,
    timestamp: serverTimestamp(),
  });

  // 3) 🔔 Crear NOTIFICACIÓN (FUERA del tx)
  if (creadorID) {
    await addDoc(collection(db, 'notificaciones'), {
      targetUserId: creadorID,          // <-- quién debe verla
      actorUserId: uid,                 // quién la generó
      type: 'donation',
      title: '¡Nueva donación!',
      body: `Tu proyecto recibió ${monto}.`,
      projectId,
      read: false,
      timestamp: serverTimestamp(),
    });
  }
}

/** Comentar + calificar + notificación al creador */
export async function comentarYCalificar(projectId, uid, { rating, comment, userName }) {
  const r = Number(rating);
  if (!(r >= 1 && r <= 5)) throw new Error('Rating inválido');

  const proyectoRef = doc(db, 'proyectos', projectId);
  const commentsCol = collection(db, 'proyectos', projectId, 'comentarios');

  let creadorID = null;

  await runTransaction(db, async (tx) => {
    const pSnap = await tx.get(proyectoRef);
    if (!pSnap.exists()) throw new Error('Proyecto no encontrado');
    const proyecto = pSnap.data();
    creadorID = proyecto.creadorID;

    // crear comentario en subcolección (fuera del tx sería también válido)
    await addDoc(commentsCol, {
      userId: uid,
      userName: userName || 'Anónimo',
      rating: r,
      comment: comment || '',
      createdAt: serverTimestamp(),
      isDeleted: false,
    });

    const { ratingAvg = 0, ratingCount = 0 } = proyecto;
    const nuevoCount = ratingCount + 1;
    const nuevoAvg = (ratingAvg * ratingCount + r) / nuevoCount;

    tx.update(proyectoRef, {
      ratingAvg: nuevoAvg,
      ratingCount: nuevoCount,
      updatedAt: serverTimestamp(),
    });
  });

  // 🔔 Notificación al creador
  if (creadorID) {
    await addDoc(collection(db, 'notificaciones'), {
      targetUserId: creadorID,
      actorUserId: uid,
      type: 'comment',
      title: 'Nuevo comentario',
      body: 'Han comentado y calificado tu proyecto.',
      projectId,
      read: false,
      timestamp: serverTimestamp(),
    });
  }
}

/** (Helper) Query para comentarios en tiempo real */
export function getCommentsQuery(projectId) {
  return query(collection(db, 'proyectos', projectId, 'comentarios'), orderBy('createdAt', 'desc'));
}
