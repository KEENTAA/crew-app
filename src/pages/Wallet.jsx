// src/pages/Wallet.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import {
    doc, setDoc, runTransaction, collection, query,
    where, orderBy, onSnapshot, serverTimestamp,
    addDoc, getDocs, limit 
} from 'firebase/firestore';
import { notifyAdminsCardRequested } from '../services/notifications';
import { 
    FaCreditCard, 
    FaWallet, 
    FaHistory, 
    FaCheckCircle, 
    FaExclamationTriangle,
    FaSpinner,
    FaArrowUp,
    FaArrowDown
} from 'react-icons/fa';
import styles from './Wallet.module.css';

// LÍMITES DE RECARGA
const MIN_RECHARGE = 100;
const MAX_RECHARGE = 5000;

const normalizeStatus = (s) => {
    if (!s) return 'none';
    const x = String(s).toLowerCase();
    if (['activa', 'aprobada', 'approved'].includes(x)) return 'approved';
    if (['pendiente', 'pending'].includes(x)) return 'pending';
    if (['rechazada', 'rejected'].includes(x)) return 'rejected';
    return 'none';
};

const getCardFromDoc = (userDoc) => (userDoc?.virtualCard || userDoc?.card || null);

export default function Wallet() {
    const { currentUser, loading: authLoading } = useAuth();

    const [balance, setBalance] = useState(0);
    const [userDoc, setUserDoc] = useState(null);
    const [cardStatusNorm, setCardStatusNorm] = useState('none');
    const [transactions, setTransactions] = useState([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const [rechargeMonto, setRechargeMonto] = useState(MIN_RECHARGE);
    const [rechargeInput, setRechargeInput] = useState({
        cardNumber: '',
        expiryDate: '',
        cvv: '',
    });

    const ensureUserDoc = async (uid, email) => {
        try {
            await setDoc(doc(db, 'usuarios', uid), {
                email: email || '',
                balance: 0,
                cardStatus: 'none',
                isIDVerified: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.warn('ensureUserDoc error:', e);
        }
    };

    // 1) Listener del usuario
    useEffect(() => {
        if (!currentUser || authLoading) return;

        const un = onSnapshot(
            doc(db, 'usuarios', currentUser.uid),
            async (snap) => {
                try {
                    if (!snap.exists()) {
                        await ensureUserDoc(currentUser.uid, currentUser.email);
                        setUserDoc({ balance: 0, cardStatus: 'none', email: currentUser.email || '' });
                        setBalance(0);
                        setCardStatusNorm('none');
                        setLoadingUser(false);
                        return;
                    }

                    const data = snap.data();
                    setUserDoc(data);
                    setBalance(Number(data.balance || 0));
                    const norm = normalizeStatus(data.cardStatus);
                    setCardStatusNorm(norm);

                    if (norm === 'pending') {
                        const qPend = query(
                            collection(db, 'solicitudesTarjeta'),
                            where('userId', '==', currentUser.uid),
                            where('status', 'in', ['pending', 'Pendiente']),
                            limit(1)
                        );
                        const s = await getDocs(qPend);
                        if (s.empty) {
                            await setDoc(
                                doc(db, 'usuarios', currentUser.uid),
                                { cardStatus: 'none', updatedAt: serverTimestamp() },
                                { merge: true }
                            );
                            setCardStatusNorm('none');
                        }
                    }

                    const card = getCardFromDoc(data);
                    setRechargeInput((prev) => ({
                        ...prev,
                        cardNumber: norm === 'approved' ? (card?.cardNumber || '') : '',
                    }));
                } catch (e) {
                    console.error('Wallet listener error:', e);
                } finally {
                    setLoadingUser(false);
                }
            },
            (e) => {
                console.error('Error al leer usuario:', e);
                setError('Error al cargar tu billetera.');
                setLoadingUser(false);
            }
        );
        return un;
    }, [currentUser, authLoading]);

    // 2) Historial de transacciones
    useEffect(() => {
        if (!currentUser || authLoading) return;
        const col = collection(db, 'transacciones');
        const uid = currentUser.uid;
        const cache = new Map();

        const pushSnap = (snap) => {
            snap.docs.forEach((d) => cache.set(d.id, { id: d.id, ...d.data() }));
            const arr = Array.from(cache.values()).sort(
                (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
            );
            setTransactions(arr);
        };

        const qA = query(col, where('origenID', '==', uid), orderBy('timestamp', 'desc'));
        const qB = query(col, where('destinoID', '==', uid), orderBy('timestamp', 'desc'));

        const unA = onSnapshot(qA, pushSnap, (e) => console.error('Txns origen:', e));
        const unB = onSnapshot(qB, pushSnap, (e) => console.error('Txns destino:', e));

        return () => { unA(); unB(); };
    }, [currentUser, authLoading]);

    // 3) Solicitar tarjeta
    const handleCardRequest = async () => {
        if (!currentUser) return;
        setBusy(true);
        setError('');
        setMessage('');

        try {
            if (!['none', 'rejected'].includes(cardStatusNorm)) {
                setMessage('Ya tienes una solicitud en curso o una tarjeta activa.');
                return;
            }

            const qPend = query(
                collection(db, 'solicitudesTarjeta'),
                where('userId', '==', currentUser.uid),
                where('status', 'in', ['pending', 'Pendiente']),
                limit(1)
            );
            const s = await getDocs(qPend);
            if (!s.empty) {
                await setDoc(
                    doc(db, 'usuarios', currentUser.uid),
                    { cardStatus: 'pending', updatedAt: serverTimestamp() },
                    { merge: true }
                );
                setCardStatusNorm('pending');
                setMessage('Ya tienes una solicitud de tarjeta pendiente.');
                return;
            }

            await addDoc(collection(db, 'solicitudesTarjeta'), {
                userId: currentUser.uid,
                email: currentUser.email || '',
                createdAt: serverTimestamp(),
                status: 'Pendiente', 
            });

            await setDoc(
                doc(db, 'usuarios', currentUser.uid),
                { cardStatus: 'pending', updatedAt: serverTimestamp() },
                { merge: true }
            );

            await notifyAdminsCardRequested({
                userId: currentUser.uid,
                email: currentUser.email || ''
            });

            setMessage('✅ Solicitud enviada. Un administrador la revisará.');
            setCardStatusNorm('pending');
        } catch (e) {
            console.error(e);
            setError(e.message || 'No se pudo enviar la solicitud.');
        } finally {
            setBusy(false);
        }
    };

    // 4) Recargar saldo
    const handleRecharge = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        const amount = Number(rechargeMonto); 
        if (!amount || isNaN(amount) || amount < MIN_RECHARGE || amount > MAX_RECHARGE) {
            setError(`El monto debe estar entre $${MIN_RECHARGE} y ${MAX_RECHARGE}.`);
            return;
        }

        if (cardStatusNorm !== 'approved') {
            setError('Tu tarjeta aún no está aprobada por el administrador.');
            return;
        }

        const card = getCardFromDoc(userDoc);
        if (!card) { setError('No se encontró tarjeta en tu cuenta.'); return; }

        const bad =
            rechargeInput.cardNumber !== card.cardNumber ||
            rechargeInput.expiryDate !== card.expiryDate ||
            rechargeInput.cvv !== card.cvv;
        if (bad) { setError('Datos de tarjeta simulada inválidos.'); return; }

        setBusy(true);
        try {
            await runTransaction(db, async (tx) => {
                const uref = doc(db, 'usuarios', currentUser.uid);
                const usnap = await tx.get(uref);
                if (!usnap.exists()) throw new Error('Usuario no encontrado');

                const newBal = Number(usnap.data().balance || 0) + amount;
                tx.update(uref, { balance: newBal, updatedAt: serverTimestamp() });
            });

            await addDoc(collection(db, 'transacciones'), {
                monto: amount,
                tipo: 'Recarga',
                type: 'CREDITO',
                origenID: 'Tarjeta Virtual',
                destinoID: currentUser.uid,
                timestamp: serverTimestamp(),
            });

            setMessage(`Recarga de $${amount.toFixed(2)} exitosa.`);
            setRechargeInput((p) => ({ ...p, expiryDate: '', cvv: '' }));
        } catch (e) {
            console.error(e);
            setError(e.message || 'Error al procesar la recarga.');
        } finally {
            setBusy(false);
        }
    };

    const handleExpiryDateChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.substring(0, 4);
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2);
        }
        if (value.length > 5) {
            value = value.substring(0, 5);
        }
        setRechargeInput((p) => ({ ...p, expiryDate: value }));
    };

    const tsToString = (t) => {
        try { 
            return t?.toDate?.().toLocaleString?.('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) || ''; 
        } catch { 
            return ''; 
        }
    };

    // Módulo 1: Información de Tarjeta y Saldo
    const renderCardSection = () => {
        if (cardStatusNorm === 'pending') {
            return (
                <div className={styles.cardRequestBox}>
                    <div className={styles.iconContainer}>
                        <FaSpinner className={styles.spinner} />
                    </div>
                    <h3 className={styles.cardRequestTitle}>
                        Solicitud de tarjeta pendiente
                    </h3>
                    <p className={styles.cardRequestText}>
                        Un administrador revisará tu solicitud en breve.
                    </p>
                </div>
            );
        }

        if (cardStatusNorm === 'none' || cardStatusNorm === 'rejected') {
            return (
                <div className={styles.cardRequestBox}>
                    <div className={styles.iconContainer}>
                        <FaCreditCard className={styles.icon} />
                    </div>
                    <h3 className={styles.cardRequestTitle}>
                        {cardStatusNorm === 'rejected' 
                            ? 'Tu solicitud fue rechazada' 
                            : 'Paso 1: Solicitar tarjeta virtual'}
                    </h3>
                    <p className={styles.cardRequestText}>
                        {cardStatusNorm === 'rejected' 
                            ? 'Puedes volver a solicitarla cuando quieras.' 
                            : 'Para recargar tu Wallet, primero solicita una tarjeta virtual.'}
                    </p>
                    <button 
                        onClick={handleCardRequest} 
                        disabled={busy} 
                        className={styles.actionButton}
                    >
                        {busy ? (
                            <>
                                <FaSpinner className={styles.buttonSpinner} />
                                Enviando…
                            </>
                        ) : (
                            'Solicitar tarjeta al Admin'
                        )}
                    </button>
                </div>
            );
        }

        // approved
        const card = getCardFromDoc(userDoc);
        return (
            <>
                <div className={styles.cardHeaderContainer}>
                    <div className={styles.iconContainer}>
                        <FaCreditCard className={styles.icon} />
                    </div>
                    <h3 className={styles.cardHeader}>Mi Tarjeta Virtual</h3>
                </div>
                
                <div className={styles.cardBox}>
                    <div className={styles.cardContent}>
                        <div className={styles.cardChip}></div>
                        <p className={styles.cardName}>
                            <strong>{card?.nameOnCard || currentUser.displayName || currentUser.email}</strong>
                        </p>
                        <p className={styles.cardNumber}>
                            {card?.cardNumber || 'XXXX XXXX XXXX XXXX'}
                        </p>
                        <div className={styles.cardDetails}>
                            <div>
                                <span className={styles.cardLabel}>Vencimiento</span>
                                <span>{card?.expiryDate || 'MM/YY'}</span>
                            </div>
                            <div>
                                <span className={styles.cardLabel}>CVV</span>
                                <span>{card?.cvv || 'XXX'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.balanceCard}>
                    <div className={styles.balanceHeaderContainer}>
                        <div className={styles.iconContainer}>
                            <FaWallet className={styles.icon} />
                        </div>
                        <h2 className={styles.balanceHeader}>Saldo actual</h2>
                    </div>
                    <p className={styles.balanceAmount}>${Number(balance || 0).toFixed(2)}</p>

                    <form onSubmit={handleRecharge} className={styles.rechargeForm}>
                        <p className={styles.rechargeInfo}>
                            Recarga un monto entre ${MIN_RECHARGE} y ${MAX_RECHARGE}.
                        </p>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Monto a recargar</label>
                            <input
                                type="number"
                                placeholder={`${MIN_RECHARGE}-${MAX_RECHARGE}`}
                                value={rechargeMonto}
                                onChange={(e) => setRechargeMonto(e.target.value)}
                                min={MIN_RECHARGE}
                                max={MAX_RECHARGE}
                                step="1"
                                className={styles.rechargeInput}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Número de tarjeta</label>
                            <input
                                type="text"
                                placeholder="1234 5678 9012 3456"
                                value={rechargeInput.cardNumber}
                                onChange={(e) => setRechargeInput({
                                    ...rechargeInput,
                                    cardNumber: e.target.value
                                })}
                                className={styles.rechargeInput}
                                required
                            />
                        </div>

                        <div className={styles.cardInputRow}>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>Vencimiento</label>
                                <input
                                    type="text"
                                    placeholder="MM/YY"
                                    value={rechargeInput.expiryDate}
                                    onChange={handleExpiryDateChange}
                                    className={styles.rechargeInput}
                                    required
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>CVV</label>
                                <input
                                    type="text"
                                    placeholder="123"
                                    value={rechargeInput.cvv}
                                    onChange={(e) => setRechargeInput({
                                        ...rechargeInput,
                                        cvv: e.target.value
                                    })}
                                    className={styles.rechargeInput}
                                    required
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className={styles.rechargeButton} 
                            disabled={busy}
                        >
                            {busy ? (
                                <>
                                    <FaSpinner className={styles.buttonSpinner} />
                                    Procesando…
                                </>
                            ) : (
                                `Recargar $${Number(rechargeMonto || 0).toFixed(2)}`
                            )}
                        </button>
                    </form>
                </div>
            </>
        );
    };

    // Módulo 2: Historial de Transacciones
    const renderTransactionHistory = () => (
        <div className={styles.historyContainer}>
            <div className={styles.historyHeader}>
                <div className={styles.iconContainer}>
                    <FaHistory className={styles.icon} />
                </div>
                <h3 className={styles.historyTitle}>Historial de Movimientos</h3>
            </div>
            
            <div className={styles.historyList}>
                {transactions.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FaHistory className={styles.emptyIcon} />
                        <p className={styles.emptyText}>No hay transacciones registradas</p>
                        <p className={styles.emptySubtext}>
                            Tus recargas y transferencias aparecerán aquí
                        </p>
                    </div>
                ) : (
                    transactions.map((tx) => (
                        <div key={tx.id} className={styles.transactionItem}>
                            <div className={styles.transactionIcon}>
                                {tx.type === 'CREDITO' ? (
                                    <FaArrowUp className={styles.creditIcon} />
                                ) : (
                                    <FaArrowDown className={styles.debitIcon} />
                                )}
                            </div>
                            <div className={styles.transactionDetails}>
                                <span className={styles.transactionType}>
                                    {tx.tipo}
                                </span>
                                <span className={styles.transactionDate}>
                                    {tsToString(tx.timestamp)}
                                </span>
                            </div>
                            <div className={styles.transactionAmountContainer}>
                                <span className={`${styles.transactionAmount} ${styles[tx.type]}`}>
                                    {tx.type === 'CREDITO' ? '+' : '-'}${Number(tx.monto || 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    if (authLoading || loadingUser) {
        return (
            <div className={styles.centerContainer}>
                <FaSpinner className={styles.spinner} />
                <span>Cargando billetera…</span>
            </div>
        );
    }
    
    if (!currentUser) {
        return (
            <div className={styles.centerContainer}>
                Inicia sesión para ver tu billetera.
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Mi Billetera Virtual</h1>
            </div>

            {message && (
                <div className={styles.messageContainer}>
                    <div className={styles.successMessage}>
                        <FaCheckCircle className={styles.messageIcon} />
                        {message}
                    </div>
                </div>
            )}
            
            {error && (
                <div className={styles.messageContainer}>
                    <div className={styles.errorMessage}>
                        <FaExclamationTriangle className={styles.messageIcon} />
                        {error}
                    </div>
                </div>
            )}

            <div className={styles.mainContent}>
                <div className={styles.cardSection}>
                    {renderCardSection()}
                </div>
                
                <div className={styles.historySection}>
                    {renderTransactionHistory()}
                </div>
            </div>
        </div>
    );
}