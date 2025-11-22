// src/pages/Dashboard.jsx

import React, { useState, useEffect } from 'react'; // <-- CORRECCIÓN: useState y useEffect deben estar importados
import { useAuth } from '../AuthContext';
import { db } from '../firebaseConfig';
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    runTransaction, 
    updateDoc, 
    addDoc, 
    serverTimestamp 
} from 'firebase/firestore';
import { Link } from 'react-router-dom';

// --- Componente auxiliar: Fila de Proyecto (Muestra el nombre del creador) ---
const ProjectRow = ({ project }) => {
    // Los hooks se usan dentro del componente
    const { currentUser } = useAuth(); 
    const [loadingWithdrawal, setLoadingWithdrawal] = useState(false); // Hook usado aquí
    
    const percentage = project.metaTotal > 0 ? (project.recaudado / project.metaTotal) * 100 : 0;
    const isFundingComplete = project.recaudado >= project.metaTotal;

    const handleManage = (action) => {
        alert(`Acción ${action} para el proyecto: ${project.titulo}`);
        // NOTA: La lógica real de Editar/Ocultar (updateDoc) iría aquí.
    };

    // 🌟 FUNCIÓN: Retiro de Fondos (RF-6) 🌟
    const handleWithdraw = async () => {
        if (!currentUser) return alert('Debes iniciar sesión para retirar.');
        if (project.recaudado < project.metaTotal) {
            return alert('El retiro solo es posible una vez que se cumple la meta total.');
        }
        
        const amountToWithdraw = project.projectWalletBalance; 
        if (amountToWithdraw <= 0) return alert('No hay fondos disponibles para retirar.');

        setLoadingWithdrawal(true);

        try {
            await runTransaction(db, async (transaction) => {
                const projectRef = doc(db, 'proyectos', project.id);
                const creatorRef = doc(db, 'usuarios', currentUser.uid);

                const projectDoc = await transaction.get(projectRef);
                const creatorDoc = await transaction.get(creatorRef);
                
                const currentProjectWalletBalance = projectDoc.data().projectWalletBalance || 0;
                const currentWithdrawableBalance = creatorDoc.data().withdrawableBalance || 0; 
                
                if (currentProjectWalletBalance < amountToWithdraw) {
                    throw new Error("Error de fondos: El saldo del proyecto es insuficiente.");
                }

                // 1. Decrementar el saldo del proyecto (a 0)
                transaction.update(projectRef, { 
                    projectWalletBalance: currentProjectWalletBalance - amountToWithdraw,
                    estado: 'Cerrado' // Marcar el proyecto como finalizado/retirado
                });

                // 2. Incrementar el saldo retirable del creador
                transaction.update(creatorRef, { 
                    withdrawableBalance: currentWithdrawableBalance + amountToWithdraw 
                });

                // 3. Registrar Transacción (RF-14)
                await addDoc(collection(db, 'transacciones'), {
                    monto: amountToWithdraw,
                    tipo: 'Retiro',
                    origenID: project.id, 
                    destinoID: currentUser.uid, 
                    type: 'DEBITO_PROYECTO',
                    timestamp: serverTimestamp(),
                });
            });

            alert(`✅ Retiro exitoso de $${amountToWithdraw.toFixed(2)}. Fondos movidos al saldo retirable.`);
        } catch (err) {
            console.error("Fallo la Transacción de Retiro:", err);
            alert(`❌ Fallo el retiro: ${err.message || 'Error desconocido'}`);
        } finally {
            setLoadingWithdrawal(false);
        }
    };


    return (
        <div style={styles.projectRow}>
            <Link to={`/proyectos/${project.id}`} style={styles.projectTitleLink}>
                {project.titulo}
            </Link>
            
            <div style={styles.metricsRow}>
                <span style={{color: '#4285F4'}}>Meta: ${project.metaTotal.toFixed(0)}</span>
                <span style={{color: '#00cc66'}}>Recaudado: ${project.recaudado.toFixed(0)}</span>
                <span style={{fontWeight: 'bold', color: percentage >= 100 ? '#28a745' : '#ffc107'}}>
                    {percentage.toFixed(1)}% ({project.estado})
                </span>
            </div>
            
            <div style={styles.actions}>
                <button onClick={() => handleManage('Editar')} style={styles.actionButton}>Editar</button>
                <button onClick={() => handleManage('Ocultar')} style={styles.actionButton}>Ocultar</button>
                
                {/* Botón de Retiro */}
                {isFundingComplete && project.estado !== 'Cerrado' && (
                    <button 
                        onClick={handleWithdraw} 
                        style={{...styles.actionButton, backgroundColor: '#00cc66', color: 'white'}}
                        disabled={loadingWithdrawal}
                    >
                        {loadingWithdrawal ? 'Procesando...' : 'Retirar Fondos'}
                    </button>
                )}
                {project.estado === 'Cerrado' && (
                    <span style={styles.retiradoStatus}>Retirado</span>
                )}
            </div>
        </div>
    );
};

// Componente principal del Dashboard
const Dashboard = () => {
    const { currentUser, currentUserRole, loading: authLoading } = useAuth();
    
    // Estados
    const [myProjects, setMyProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [walletBalance, setWalletBalance] = useState(0);
    const [withdrawableBalance, setWithdrawableBalance] = useState(0); // Saldo retirable
    const [totalProjects, setTotalProjects] = useState(0); // Para métrica Admin
    const [totalVolume, setTotalVolume] = useState(0); // Para métrica Admin
    const [claiming, setClaiming] = useState(false); // Estado para el botón de reclamar


    // 1. Obtener Datos y Proyectos Creados (RF-15)
    useEffect(() => {
        if (!currentUser || authLoading || currentUserRole !== 'Cliente') return;

        const unsubscribeProjects = fetchMyProjects();
        const unsubscribeWallet = fetchWalletBalance();

        return () => {
            unsubscribeProjects();
            unsubscribeWallet();
        };
    }, [currentUser, authLoading, currentUserRole]);


    // 2. Conectar Métricas (Volumen y Conteo) - Se ejecuta para cualquier usuario logueado, pero solo relevante para Admin
    useEffect(() => {
        if (!currentUser || currentUserRole !== 'Administrador' && currentUserRole !== 'Cliente') return;

        // 1. Contador de Proyectos
        const unsubProjects = onSnapshot(collection(db, 'proyectos'), (snapshot) => {
            setTotalProjects(snapshot.size); // El tamaño del snapshot es el conteo
        });

        // 2. Suma de Volumen de Transacciones
        const unsubVolume = onSnapshot(collection(db, 'transacciones'), (snapshot) => {
            let sum = 0;
            snapshot.forEach(doc => {
                // Sumamos el monto de cada transacción
                sum += doc.data().monto || 0; 
            });
            setTotalVolume(sum);
        });

        return () => {
            unsubProjects();
            unsubVolume();
        };
    }, [currentUser, currentUserRole]);


    // Función para obtener los proyectos del usuario actual
    const fetchMyProjects = () => {
        const projectsRef = collection(db, 'proyectos');
        const q = query(projectsRef, where('creadorID', '==', currentUser.uid)); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMyProjects(projectsList);
            setLoading(false);
        }, (err) => {
            console.error("Error al cargar mis proyectos:", err);
            setLoading(false);
        });

        return unsubscribe;
    };

    // Función para obtener el saldo de la Wallet y Retirable
    const fetchWalletBalance = () => {
        const userDocRef = doc(db, 'usuarios', currentUser.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                setWalletBalance(userData.balance || 0);
                setWithdrawableBalance(userData.withdrawableBalance || 0); 
            }
        });
        return unsubscribe;
    };


    // 🌟 FUNCIÓN CLAVE: Mover fondos retirables al saldo principal 🌟
    const handleClaimFunds = async () => {
        if (!currentUser) return;
        if (withdrawableBalance <= 0) return alert("No hay fondos retirables para mover a tu saldo principal.");

        setClaiming(true);

        try {
            const userRef = doc(db, 'usuarios', currentUser.uid);
            
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error("Documento de usuario no encontrado.");

                const currentBalance = userDoc.data().balance || 0;
                const currentWithdrawable = userDoc.data().withdrawableBalance || 0;

                if (currentWithdrawable <= 0) throw new Error("No hay fondos disponibles para reclamar.");

                // 1. Sumar a la billetera principal
                const newBalance = currentBalance + currentWithdrawable;
                // 2. Resetear el saldo retirable
                const newWithdrawable = 0;

                transaction.update(userRef, {
                    balance: newBalance,
                    withdrawableBalance: newWithdrawable
                });

                 // 3. Registrar Transacción
                 await addDoc(collection(db, 'transacciones'), {
                    monto: currentWithdrawable,
                    tipo: 'Reclamo',
                    origenID: 'WithdrawableFunds',
                    destinoID: currentUser.uid, 
                    type: 'CREDITO_PERSONAL',
                    timestamp: serverTimestamp(),
                });

            });

            alert(`✅ Reclamo exitoso. $${withdrawableBalance.toFixed(2)} añadidos a tu saldo principal.`);
        } catch (error) {
            console.error("Error al reclamar fondos:", error);
            alert(`❌ Fallo al reclamar fondos: ${error.message}`);
        } finally {
            setClaiming(false);
        }
    };


    if (authLoading || loading) {
        return <div style={styles.centerContainer}>Cargando Dashboard...</div>;
    }

    if (currentUserRole !== 'Cliente') {
        return <div style={styles.centerContainer}><h3 style={{color: '#dc3545'}}>Redireccionando al panel de gestión...</h3></div>;
    }

    // --- Renderizado Principal del Dashboard de Cliente ---
    return (
        <div style={styles.container}>
            <h1 style={styles.header}>Dashboard de Cliente / Creador</h1>
            <p style={styles.subtitle}>Gestiona tus proyectos y tu billetera virtual.</p>

            {/* 1. Resumen de Wallet */}
            <div style={styles.walletSummary}>
                <h3 style={styles.summaryTitle}>Mi Wallet y Fondos</h3>
                <div style={styles.metricsGrid}>
                    <MetricCard title="Saldo Disponible" value={walletBalance.toFixed(2)} prefix="$" color="#00cc66" linkTo="/wallet" />
                    
                    {/* 🌟 MÉTRICA: Fondo Retirable con Botón de Reclamo 🌟 */}
                    <div style={{...styles.metricCard, borderLeftColor: '#ffc107', position: 'relative'}}>
                        <p style={styles.metricLabel}>Fondo Retirable</p>
                        <h4 style={styles.metricValue}>$ {withdrawableBalance.toFixed(2)}</h4>
                        <button
                            onClick={handleClaimFunds}
                            style={{...styles.claimButton, opacity: withdrawableBalance > 0 ? 1 : 0.5}}
                            disabled={withdrawableBalance <= 0 || claiming}
                        >
                            {claiming ? 'Moviendo...' : 'Mover a Saldo'}
                        </button>
                    </div>
                    
                    {/* MÉTRICA: Proyectos Creados (sin signo $) */}
                    <MetricCard title="Proyectos Creados" value={myProjects.length} prefix="" color="#4285F4" /> 
                    
                    {/* MÉTRICA: Recaudación Total */}
                    <MetricCard title="Recaudación Total" value={myProjects.reduce((acc, p) => acc + (p.recaudado || 0), 0).toFixed(2)} prefix="$" color="#ffc107" />
                    
                    <Link to="/crear-proyecto" style={{...styles.metricCard, ...styles.createProjectCard}}>
                        <p style={{fontSize: '32px', margin: 0}}>+</p>
                        <p style={{fontSize: '16px', fontWeight: 'bold'}}>Crear Nuevo Proyecto</p>
                    </Link>
                </div>
            </div>

            {/* 2. Listado de Proyectos del Usuario (RF-15) */}
            <h3 style={styles.projectsHeader}>Mis Proyectos Creados ({myProjects.length})</h3>
            
            <div style={styles.projectList}>
                {myProjects.length === 0 ? (
                    <p style={{color: '#666'}}>Aún no has creado ningún proyecto. ¡Usa el botón "Crear Nuevo Proyecto"!</p>
                ) : (
                    myProjects.map(project => (
                        <ProjectRow key={project.id} project={project} />
                    ))
                )}
            </div>
        </div>
    );
};

// --- Componente auxiliar: Tarjeta de Métrica ---
const MetricCard = ({ title, value, color, linkTo, prefix = '$' }) => (
    <Link to={linkTo || '#'} style={{...styles.metricCard, borderLeftColor: color, textDecoration: 'none'}}>
        <p style={styles.metricLabel}>{title}</p>
        <h4 style={styles.metricValue}>{prefix} {value}</h4> 
    </Link>
);

// --- Estilos ---
const styles = {
    centerContainer: { textAlign: 'center', padding: '100px' },
    container: {
        padding: '40px',
        maxWidth: '1200px',
        margin: '40px auto',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    },
    header: { fontSize: '32px', borderBottom: '2px solid #eee', paddingBottom: '10px' },
    subtitle: { color: '#666', marginBottom: '30px' },
    summaryTitle: { fontSize: '24px', marginBottom: '20px' },
    projectsHeader: { fontSize: '24px', marginTop: '40px', marginBottom: '20px' },

    // Métricas (RF-4/RF-15)
    metricsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
    },
    metricCard: {
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        borderLeft: '4px solid', // Color dinámico
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100px',
        cursor: 'pointer'
    },
    metricLabel: { fontSize: '12px', color: '#6c757d', margin: 0 },
    metricValue: { fontSize: '30px', fontWeight: 'bold', color: '#333', margin: '5px 0 0 0' },
    createProjectCard: {
        textAlign: 'center',
        border: '2px dashed #4285F4',
        backgroundColor: '#e6f0ff',
        color: '#4285F4',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'background-color 0.2s'
    },
    // Botón de Reclamo
    claimButton: {
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        padding: '5px 10px',
        backgroundColor: '#ff9800', // Naranja
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '12px'
    },

    // Fila de Proyectos
    projectList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
    },
    projectRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 20px',
        border: '1px solid #eee',
        borderRadius: '8px',
        backgroundColor: '#fff'
    },
    projectTitleLink: {
        textDecoration: 'none',
        color: '#333',
        fontWeight: 'bold',
        fontSize: '16px',
        flex: 2
    },
    metricsRow: {
        flex: 3,
        display: 'flex',
        justifyContent: 'space-around',
        fontSize: '14px'
    },
    actions: {
        flex: 1,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px'
    },
    actionButton: {
        padding: '8px 12px',
        backgroundColor: '#f0f0f0',
        border: '1px solid #ccc',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s'
    },
    retiradoStatus: {
        padding: '8px 12px',
        backgroundColor: '#dc3545',
        color: 'white',
        borderRadius: '5px',
        fontSize: '12px',
        fontWeight: 'bold'
    }
};
export default Dashboard; // <-- ¡Esta línea es crucial!