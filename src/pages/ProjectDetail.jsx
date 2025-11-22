// src/pages/ProjectDetail.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import { 
    doc, 
    getDoc,
    runTransaction, 
    updateDoc, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    where, 
    onSnapshot,
    orderBy,
    getDocs
} from 'firebase/firestore';

// 🌟 IMPORTACIONES PARA ICONOS 🌟
import { 
    FaChartLine, FaFilter, FaSync, FaSearch, FaExclamationTriangle, 
    FaStar, FaWallet, FaMoneyBillWave, FaUsers, FaCalendarDay, 
    FaCheck, FaClock, FaLock, FaChartBar, FaChartArea, 
    FaExpandArrowsAlt, FaHandHoldingUsd, FaArrowLeft,
    FaComment, FaDollarSign, FaChartPie, FaFlag, FaHeart
} from 'react-icons/fa';

// 🌟 IMPORTACIONES PARA GRÁFICOS CON ZOOM 🌟
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';

// 🌟 IMPORTAR CSS 🌟
import './ProjectDetail.css';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  zoomPlugin
);

const ProjectDetail = () => {
    const { id: projectId } = useParams();
    const navigate = useNavigate();
    const { currentUser, currentUserRole } = useAuth();

    // Estados
    const [activeTooltip, setActiveTooltip] = useState(null);
    const [project, setProject] = useState(null);
    const [userBalance, setUserBalance] = useState(0);
    const [donationAmount, setDonationAmount] = useState('');
    const [comments, setComments] = useState([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [newRating, setNewRating] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('descripcion'); 
    
    // 🌟 NUEVOS ESTADOS PARA FINANCIACIÓN 🌟
    const [creatorName, setCreatorName] = useState('Cargando...'); 
    const [transactions, setTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: ''
    });
    const [stats, setStats] = useState({
        totalDonations: 0,
        averageDonation: 0,
        uniqueDonors: 0,
        recentActivity: 0
    });

    // 🌟 NUEVOS ESTADOS PARA GRÁFICOS 🌟
    const [chartData, setChartData] = useState({
        daily: null,
        cumulative: null,
        monthly: null,
        combined: null
    });

    // Referencias para los gráficos
    const combinedChartRef = useRef(null);

    // --- FUNCIÓN DE CARGA DE DATOS EN TIEMPO REAL ---
    useEffect(() => {
        if (!projectId) return;

        const projectDocRef = doc(db, 'proyectos', projectId);

        // 1. Listener para el Proyecto (Tiempo Real)
        const unsubscribeProject = onSnapshot(projectDocRef, (projectSnap) => {
            if (!projectSnap.exists()) {
                setError('Proyecto no encontrado.');
                setLoading(false);
                return;
            }
            const projectData = { 
                id: projectSnap.id, 
                ...projectSnap.data(),
                recaudado: projectSnap.data().recaudado || 0,
                projectWalletBalance: projectSnap.data().projectWalletBalance || 0,
                withdrawableBalance: projectSnap.data().withdrawableBalance || 0,
                metaTotal: projectSnap.data().metaTotal || 0,
                estado: projectSnap.data().estado || 'Publicado',
                ratingAvg: projectSnap.data().ratingAvg || 0,
                ratingCount: projectSnap.data().ratingCount || 0,
                brechas: projectSnap.data().brechas || [] // Asegurar que brechas esté definido
            };
            setProject(projectData);
            setLoading(false);
            
            if (projectData.creadorNombre) {
                setCreatorName(projectData.creadorNombre);
            } else if (projectData.creadorID) {
                setCreatorName(projectData.creadorID.substring(0, 8) + '...');
            }
        }, (err) => {
            console.error("Error al escuchar proyecto:", err);
            setError('Error al cargar los detalles del proyecto.');
            setLoading(false);
        });

        // 2. Listener para Comentarios (Tiempo Real)
        const commentsQuery = query(
            collection(db, `proyectos/${projectId}/comentarios`),
            orderBy('timestamp', 'desc')
        );
        const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
            const commentsArray = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setComments(commentsArray);
        }, (err) => {
            console.error("Error al cargar comentarios:", err);
        });

        // 3. Cargar Saldo del Usuario 
        let unsubscribeUser = () => {};
        if (currentUser) {
            const userDocRef = doc(db, 'usuarios', currentUser.uid);
            unsubscribeUser = onSnapshot(userDocRef, (userSnap) => {
                if (userSnap.exists()) {
                    setUserBalance(userSnap.data().balance || 0);
                }
            }, (err) => {
                console.error("Error al cargar saldo:", err);
            });
        }
        
        return () => {
            unsubscribeProject();
            unsubscribeComments();
            unsubscribeUser();
        };
    }, [projectId, currentUser]);

    // --- FUNCIÓN: CARGAR TRANSACCIONES CON FILTROS ---
    const loadTransactions = async (startDate = null, endDate = null) => {
        if (!projectId || !currentUser || !project || currentUser.uid !== project.creadorID) return;
        
        setLoadingTransactions(true);
        setError('');
        try {
            // Query con ordenamiento en el cliente como solución temporal
            let transactionsQuery = query(
                collection(db, 'transacciones'),
                where('destinoID', '==', projectId),
                where('tipo', '==', 'Donacion')
            );

            const snapshot = await getDocs(transactionsQuery);
            let transactionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp // Mantener el timestamp de Firestore
            }));

            // Ordenar en el cliente como solución temporal
            transactionsData.sort((a, b) => {
                const dateA = a.timestamp?.toDate?.() || new Date(0);
                const dateB = b.timestamp?.toDate?.() || new Date(0);
                return dateB - dateA; // Orden descendente
            });

            // Aplicar filtro de fecha si existe
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);

                transactionsData = transactionsData.filter(transaction => {
                    const transactionDate = transaction.timestamp?.toDate();
                    return transactionDate >= start && transactionDate <= end;
                });
            }

            setTransactions(transactionsData);
            calculateStats(transactionsData);
            
            // 🌟 GENERAR DATOS PARA GRÁFICOS 🌟
            generateChartData(transactionsData);
            
        } catch (error) {
            console.error('Error cargando transacciones:', error);
            
            if (error.code === 'permission-denied') {
                setError('Error de permisos: No tienes acceso para ver las transacciones.');
            } else if (error.code === 'failed-precondition') {
                setError('Se está creando un índice en Firestore. La función estará disponible en unos minutos.');
            } else {
                setError('Error al cargar el historial de transacciones: ' + error.message);
            }
            
            setTransactions([]);
            setStats({
                totalDonations: 0,
                averageDonation: 0,
                uniqueDonors: 0,
                recentActivity: 0
            });
        } finally {
            setLoadingTransactions(false);
        }
    };

    // 🌟 FUNCIÓN: GENERAR DATOS PARA GRÁFICOS COMBINADOS 🌟
    const generateChartData = (transactionsData) => {
        if (!transactionsData || transactionsData.length === 0) {
            setChartData({ daily: null, cumulative: null, monthly: null, combined: null });
            return;
        }

        // Ordenar por fecha
        const sortedTransactions = [...transactionsData].sort((a, b) => {
            const dateA = a.timestamp?.toDate() || new Date(0);
            const dateB = b.timestamp?.toDate() || new Date(0);
            return dateA - dateB;
        });

        // Datos para gráficos
        const dailyData = {};
        const cumulativeData = {};
        const monthlyData = {};
        
        let cumulativeTotal = 0;

        sortedTransactions.forEach(transaction => {
            const date = transaction.timestamp?.toDate();
            if (!date) return;

            const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`; // YYYY-MM
            
            const amount = transaction.monto || 0;

            // Datos diarios
            dailyData[dateKey] = (dailyData[dateKey] || 0) + amount;
            
            // Datos acumulados
            cumulativeTotal += amount;
            cumulativeData[dateKey] = cumulativeTotal;
            
            // Datos mensuales
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
        });

        // Preparar datos para gráficos
        const dailyLabels = Object.keys(dailyData).sort();
        const monthlyLabels = Object.keys(monthlyData).sort();

        // 🌟 GRÁFICO COMBINADO: Donaciones + Acumulado
        const combinedData = {
            labels: dailyLabels,
            datasets: [
                {
                    label: 'Donaciones Diarias',
                    data: dailyLabels.map(date => dailyData[date]),
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    borderWidth: 3,
                    fill: false
                },
                {
                    label: 'Total Acumulado',
                    data: dailyLabels.map(date => cumulativeData[date]),
                    borderColor: 'rgb(118, 75, 162)',
                    backgroundColor: 'rgba(118, 75, 162, 0.1)',
                    yAxisID: 'y1',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    borderWidth: 2,
                    borderDash: [5, 5]
                }
            ]
        };

        setChartData({
            daily: {
                labels: dailyLabels,
                datasets: [
                    {
                        label: 'Donaciones Diarias',
                        data: dailyLabels.map(date => dailyData[date]),
                        borderColor: 'rgb(102, 126, 234)',
                        backgroundColor: 'rgba(102, 126, 234, 0.2)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            cumulative: {
                labels: Object.keys(cumulativeData).sort(),
                datasets: [
                    {
                        label: 'Total Acumulado',
                        data: Object.keys(cumulativeData).sort().map(date => cumulativeData[date]),
                        borderColor: 'rgb(118, 75, 162)',
                        backgroundColor: 'rgba(118, 75, 162, 0.2)',
                        fill: true,
                        tension: 0.2
                    }
                ]
            },
            monthly: {
                labels: monthlyLabels,
                datasets: [
                    {
                        label: 'Donaciones Mensuales',
                        data: monthlyLabels.map(month => monthlyData[month]),
                        backgroundColor: 'rgba(102, 126, 234, 0.7)',
                        borderColor: 'rgb(102, 126, 234)',
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false,
                    }
                ]
            },
            combined: combinedData
        });
    };

    // --- FUNCIÓN: CALCULAR ESTADÍSTICAS ---
    const calculateStats = (transactionsData) => {
        if (!transactionsData || transactionsData.length === 0) {
            setStats({
                totalDonations: 0,
                averageDonation: 0,
                uniqueDonors: 0,
                recentActivity: 0
            });
            return;
        }

        const totalDonations = transactionsData.reduce((sum, transaction) => sum + (transaction.monto || 0), 0);
        const averageDonation = transactionsData.length > 0 ? totalDonations / transactionsData.length : 0;
        
        // Donantes únicos
        const uniqueDonors = new Set(
            transactionsData
                .map(t => t.origenID)
                .filter(id => id != null)
        ).size;
        
        // Actividad reciente (últimos 7 días)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentActivity = transactionsData.filter(t => 
            t.timestamp?.toDate() >= oneWeekAgo
        ).length;

        setStats({
            totalDonations,
            averageDonation: Math.round(averageDonation * 100) / 100,
            uniqueDonors,
            recentActivity
        });
    };

    // --- EFECTO: Cargar transacciones cuando el usuario es el creador ---
    useEffect(() => {
        if (project && currentUser && currentUser.uid === project.creadorID) {
            loadTransactions();
        }
    }, [project, currentUser]);

    // --- FUNCIÓN: APLICAR FILTROS ---
    const handleFilter = () => {
        if (dateRange.startDate && dateRange.endDate) {
            const start = new Date(dateRange.startDate);
            const end = new Date(dateRange.endDate);
            
            if (start > end) {
                setError('La fecha de inicio no puede ser mayor a la fecha final');
                return;
            }
        }
        loadTransactions(dateRange.startDate, dateRange.endDate);
    };

    // --- FUNCIÓN: LIMPIAR FILTROS ---
    const handleClearFilter = () => {
        setDateRange({ startDate: '', endDate: '' });
        loadTransactions();
    };

    // --- FUNCIÓN: RESETEAR ZOOM DEL GRÁFICO ---
    const handleResetZoom = () => {
        if (combinedChartRef.current) {
            combinedChartRef.current.resetZoom();
        }
    };

    // 🌟 FUNCIÓN: CALCULAR POSICIÓN DE BRECHAS EN LA BARRA 🌟
    const calculateBrechaPosition = (brechaIndex) => {
        if (!project || !project.metaTotal || !project.brechas || project.metaTotal <= 0) return 0;
        
        let acumulado = 0;
        for (let i = 0; i <= brechaIndex; i++) {
            acumulado += project.brechas[i].monto;
        }
        
        return (acumulado / project.metaTotal) * 100;
    };

    // 🌟 FUNCIÓN: VERIFICAR SI UNA BRECHA FUE ALCANZADA 🌟
    const isBrechaAlcanzada = (brechaIndex) => {
        if (!project || !project.brechas) return false;
        
        let acumulado = 0;
        for (let i = 0; i <= brechaIndex; i++) {
            acumulado += project.brechas[i].monto;
        }
        
        return project.recaudado >= acumulado;
    };

    // 🌟 OPCIONES DE CONFIGURACIÓN PARA GRÁFICOS CON ZOOM 🌟
    const combinedChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        stacked: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        size: 12,
                        family: "'Inter', sans-serif"
                    }
                }
            },
            title: {
                display: true,
                text: 'Evolución de Donaciones vs Total Acumulado',
                font: {
                    size: 16,
                    weight: 'bold',
                    family: "'Inter', sans-serif"
                },
                padding: 20
            },
            tooltip: {
                backgroundColor: 'rgba(30, 41, 59, 0.95)',
                titleFont: {
                    family: "'Inter', sans-serif"
                },
                bodyFont: {
                    family: "'Inter', sans-serif"
                },
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD'
                            }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x',
                    modifierKey: 'ctrl',
                },
                zoom: {
                    wheel: {
                        enabled: true,
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x',
                }
            }
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'day',
                    displayFormats: {
                        day: 'MMM dd'
                    }
                },
                title: {
                    display: true,
                    text: 'Fecha',
                    font: {
                        family: "'Inter', sans-serif",
                        size: 12
                    }
                },
                grid: {
                    color: 'rgba(226, 232, 240, 0.5)'
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Donaciones Diarias ($)',
                    font: {
                        family: "'Inter', sans-serif",
                        size: 12
                    }
                },
                ticks: {
                    callback: function(value) {
                        return '$' + value;
                    }
                },
                grid: {
                    color: 'rgba(226, 232, 240, 0.5)'
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Total Acumulado ($)',
                    font: {
                        family: "'Inter', sans-serif",
                        size: 12
                    }
                },
                ticks: {
                    callback: function(value) {
                        return '$' + value;
                    }
                },
                grid: {
                    drawOnChartArea: false,
                },
            },
        },
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    font: {
                        family: "'Inter', sans-serif"
                    }
                }
            },
            title: {
                display: true,
                text: 'Evolución de Donaciones',
                font: {
                    size: 14,
                    weight: 'bold',
                    family: "'Inter', sans-serif"
                }
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return '$' + value;
                    }
                },
                grid: {
                    color: 'rgba(226, 232, 240, 0.5)'
                }
            },
            x: {
                grid: {
                    color: 'rgba(226, 232, 240, 0.5)'
                }
            }
        }
    };

    const barChartOptions = {
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            title: {
                display: true,
                text: 'Donaciones Mensuales',
                font: {
                    size: 14,
                    weight: 'bold',
                    family: "'Inter', sans-serif"
                }
            },
        }
    };

    // --- FUNCIÓN: TRANSACCIÓN ATÓMICA DE DONACIÓN ---
    const handleDonation = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        const amount = Number(donationAmount);
        if (!currentUser) return setError('Debes iniciar sesión para donar.');
        if (amount <= 0 || isNaN(amount)) return setError('El monto debe ser un número positivo.');
        
        if (project.recaudado >= project.metaTotal) {
             return setError('¡Felicidades! La meta del proyecto ya fue alcanzada y ya no acepta donaciones.');
        }

        if (amount > userBalance) return setError('Saldo insuficiente en tu billetera virtual.');
        
        setLoading(true);

        try {
            await runTransaction(db, async (transaction) => {
                const donorRef = doc(db, 'usuarios', currentUser.uid);
                const projectRef = doc(db, 'proyectos', projectId);

                const donorDoc = await transaction.get(donorRef);
                const projectDoc = await transaction.get(projectRef);

                if (!donorDoc.exists() || !projectDoc.exists()) {
                    throw new Error("Documento no encontrado");
                }

                const newDonorBalance = (donorDoc.data().balance || 0) - amount;
                const newRecaudado = (projectDoc.data().recaudado || 0) + amount;
                const newProjectWalletBalance = (projectDoc.data().projectWalletBalance || 0) + amount;
                
                if (newDonorBalance < 0) {
                    throw new Error("Transacción fallida: Fondos insuficientes.");
                }
                
                transaction.update(donorRef, { balance: newDonorBalance });

                transaction.update(projectRef, { 
                    recaudado: newRecaudado,
                    projectWalletBalance: newProjectWalletBalance,
                    estado: newRecaudado >= projectDoc.data().metaTotal ? 'Meta Alcanzada' : 'Publicado'
                });

                const transactionData = {
                    monto: amount,
                    tipo: 'Donacion',
                    origenID: currentUser.uid,
                    destinoID: projectId,
                    timestamp: serverTimestamp(),
                };
                
                await addDoc(collection(db, 'transacciones'), { ...transactionData, type: 'DEBITO' });
                await addDoc(collection(db, 'transacciones'), { ...transactionData, type: 'CREDITO' });
                
                if (project.creadorID) {
                    await addDoc(collection(db, 'notificaciones'), {
                        targetUserId: project.creadorID,
                        type: 'donation_received',
                        title: '¡Nueva donación!',
                        message: `${currentUser.email} donó $${amount.toFixed(2)} a tu proyecto "${project.titulo}".`,
                        read: false,
                        timestamp: serverTimestamp(),
                    });
                }
            });

            setMessage(`¡Donación de $${amount} exitosa! Gracias por tu apoyo.`);
            setUserBalance(prev => prev - amount); 
            setDonationAmount('');
            
            // Recargar transacciones si es el creador
            if (currentUser.uid === project.creadorID) {
                loadTransactions(dateRange.startDate, dateRange.endDate);
            }
            
        } catch (err) {
            console.error("Fallo la Transacción:", err);
            setError(err.message || "Fallo la donación por error de sistema o fondos insuficientes.");
        } finally {
            setLoading(false);
        }
    };

    // --- FUNCIÓN: RETIRO DE FONDOS ---
    const handleWithdraw = async () => {
        if (!currentUser || currentUser.uid !== project.creadorID) {
            return setError('Solo el creador del proyecto puede retirar fondos.');
        }
        
        if (project.recaudado < project.metaTotal) {
            return setError('El retiro total solo es posible una vez que se cumple la meta total.');
        }
        
        const amountToWithdraw = project.projectWalletBalance; 
        if (amountToWithdraw <= 0) return setError('No hay fondos disponibles para retirar.');

        setLoading(true);
        setError('');

        try {
            await runTransaction(db, async (transaction) => {
                const projectRef = doc(db, 'proyectos', projectId);
                const creatorRef = doc(db, 'usuarios', currentUser.uid);

                const projectDoc = await transaction.get(projectRef);
                const creatorDoc = await transaction.get(creatorRef);
                
                if (!projectDoc.exists() || !creatorDoc.exists()) {
                    throw new Error("Documento no encontrado");
                }
                
                const currentProjectWalletBalance = projectDoc.data().projectWalletBalance || 0;
                const currentWithdrawableBalance = creatorDoc.data().withdrawableBalance || 0; 
                
                if (currentProjectWalletBalance < amountToWithdraw) {
                    throw new Error("Error de fondos: El saldo del proyecto es insuficiente.");
                }

                transaction.update(projectRef, { 
                    projectWalletBalance: currentProjectWalletBalance - amountToWithdraw,
                    estado: 'Cerrado' 
                });

                transaction.update(creatorRef, { 
                    withdrawableBalance: currentWithdrawableBalance + amountToWithdraw 
                });

                await addDoc(collection(db, 'transacciones'), {
                    monto: amountToWithdraw,
                    tipo: 'Retiro',
                    origenID: projectId, 
                    destinoID: currentUser.uid, 
                    type: 'DEBITO_PROYECTO',
                    timestamp: serverTimestamp(),
                });
            });

            setMessage(`¡Retiro exitoso! $${amountToWithdraw.toFixed(2)} movidos a tu saldo retirable.`);
            
        } catch (err) {
            console.error("Fallo la Transacción de Retiro:", err);
            setError(err.message || "Fallo el retiro por error de sistema.");
        } finally {
            setLoading(false);
        }
    };

    // --- FUNCIÓN: COMENTARIOS Y CALIFICACIÓN ---
    const handleCommentAndRate = async (e) => {
        e.preventDefault();
        if (!currentUser) return setError('Debes iniciar sesión para comentar y calificar.');
        if (!newCommentText.trim() && newRating === 0) return setError('Ingresa un comentario o una calificación.');
        
        setLoading(true);

        try {
            const commentsRef = collection(db, `proyectos/${projectId}/comentarios`);
            
            await addDoc(commentsRef, {
                userId: currentUser.uid,
                email: currentUser.email,
                text: newCommentText.trim(),
                rating: newRating > 0 ? newRating : null,
                timestamp: serverTimestamp(),
            });

            if (project.creadorID) {
                await addDoc(collection(db, 'notificaciones'), {
                    targetUserId: project.creadorID,
                    type: 'new_comment',
                    title: 'Nuevo comentario',
                    message: `El usuario ${currentUser.email} dejó un comentario en tu proyecto.`,
                    read: false,
                    timestamp: serverTimestamp(),
                });
            }

            setNewCommentText('');
            setNewRating(0);
            setMessage('¡Comentario y/o calificación enviados con éxito!');
            setError('');

        } catch (err) {
            console.error("Error al enviar comentario:", err);
            setError('Fallo al enviar comentario/calificación.');
        } finally {
            setLoading(false);
        }
    };

    // --- FUNCIÓN: REPORTAR PROYECTO ---
    const handleReportProject = async () => {
        if (!currentUser) return alert('Debes iniciar sesión para reportar un proyecto.');
        const reason = prompt('Por favor, indica la razón del reporte (Ej: Contenido inapropiado, Estafa, etc.):');
        if (!reason) return;

        try {
            const reportsRef = collection(db, 'reportes');
            await addDoc(reportsRef, {
                projectId: projectId,
                projectTitle: project?.titulo || 'Proyecto sin título',
                reporterId: currentUser.uid,
                reporterEmail: currentUser.email || '',
                reason: reason,
                status: 'Pendiente', 
                timestamp: serverTimestamp(),
            });
            
            await addDoc(collection(db, 'notificaciones'), {
                audience: 'mods',
                type: 'project_reported',
                title: 'Proyecto Reportado',
                message: `El proyecto "${project?.titulo}" ha sido reportado.`,
                link: `/admin/moderacion?project=${projectId}`,
                read: false,
                timestamp: serverTimestamp(),
            });
            
            alert('Proyecto reportado con éxito. Gracias por tu ayuda.');
        } catch (err) {
            console.error('Error al reportar:', err);
            alert('Fallo al reportar el proyecto.');
        }
    };
    
    // --- FUNCIÓN: REPORTAR COMENTARIO ---
    const handleReportComment = async (commentId, commentText) => {
        if (!currentUser) return alert('Debes iniciar sesión para reportar un comentario.');
        const reason = prompt('Motivo del reporte del comentario:');
        if (!reason) return;

        try {
            await addDoc(collection(db, 'reportes'), {
                type: 'comment',
                projectId: String(projectId || ''),
                projectTitle: String(project?.titulo || ''),
                commentId: String(commentId || ''),
                commentText: String(commentText || ''),
                reporterId: String(currentUser.uid || ''),
                reporterEmail: String(currentUser.email || ''),
                status: 'Pendiente',
                reason: String(reason || ''),
                timestamp: serverTimestamp(),
            });
            
            await addDoc(collection(db, 'notificaciones'), {
                audience: 'mods',
                type: 'comment_reported',
                title: 'Comentario Reportado',
                message: `Un comentario en "${project?.titulo}" fue reportado.`,
                link: `/admin/moderacion?project=${projectId}&comment=${commentId}`,
                read: false,
                timestamp: serverTimestamp(),
            });

            alert('Comentario reportado con éxito. Un moderador lo revisará.');
        } catch (err) {
            console.error('Error al reportar comentario:', err);
            alert('Fallo al reportar el comentario.');
        }
    };

    // --- FUNCIÓN: RENDERIZADO CONDICIONAL DEL CONTENIDO DE LA PESTAÑA ---
    const renderTabContent = () => {
        switch (activeTab) {
            case 'descripcion':
                return (
                    <div className="project-detail-section-box">
                        <h3><FaChartPie /> Sobre este proyecto</h3>
                        <p className="project-detail-description">{project.descripcion}</p>
                    </div>
                );
            case 'comentarios':
                return (
                    <div className="project-detail-section-box">
                        <h3><FaComment /> Comentarios y Calificación</h3>
                        
                        <form onSubmit={handleCommentAndRate} className="project-detail-comment-form">
                            <textarea
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                                placeholder="Comparte tu opinión sobre este proyecto..."
                                className="project-detail-comment-input"
                                disabled={!currentUser || loading}
                            />
                            <div className="project-detail-rating-and-button">
                                <div className="project-detail-stars">
                                    <span className="project-detail-stars-label">Califica:</span>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span 
                                            key={star} 
                                            onClick={() => setNewRating(star)} 
                                            className={`project-detail-star ${star <= newRating ? 'project-detail-star-active' : ''}`}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>
                                <button 
                                    type="submit" 
                                    className="project-detail-comment-button" 
                                    disabled={!currentUser || loading}
                                >
                                    <FaComment /> Enviar
                                </button>
                            </div>
                        </form>

                        <h4 className="project-detail-comments-title">
                            Opiniones de la comunidad ({comments.length})
                        </h4>
                        {comments.length === 0 ? (
                            <div className="project-detail-no-comments">
                                <FaComment className="project-detail-no-comments-icon" />
                                <p>Sé el primero en dejar un comentario.</p>
                            </div>
                        ) : (
                            comments.map(c => (
                                <div key={c.id} className="project-detail-comment-item">
                                    <div className="project-detail-comment-header">
                                        <div className="project-detail-comment-user">
                                            <strong>{c.email}</strong> 
                                            {c.rating && (
                                                <span className="project-detail-comment-rating">
                                                    {c.rating} <FaStar />
                                                </span>
                                            )}
                                        </div>
                                        {currentUser && currentUser.uid !== c.userId && (
                                            <button 
                                                onClick={() => handleReportComment(c.id, c.text)} 
                                                className="project-detail-comment-report-button"
                                            >
                                                <FaFlag /> Reportar
                                            </button>
                                        )}
                                    </div>
                                    <p className="project-detail-comment-text">{c.text}</p>
                                    <p className="project-detail-comment-date">
                                        {c.timestamp?.toDate().toLocaleString()}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                );
            case 'financiacion':
                return (
                    <div className="project-detail-section-box">
                        <h3><FaDollarSign /> Detalle de Brechas de Financiación</h3>
                        {project.brechas && project.brechas.length > 0 ? (
                            <div className="project-detail-brechas-container">
                                <table className="project-detail-brechas-table">
                                    <thead>
                                        <tr>
                                            <th className="project-detail-table-header">Objetivo</th>
                                            <th className="project-detail-table-header">Monto</th>
                                            <th className="project-detail-table-header">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {project.brechas.map((brecha, index) => (
                                            <tr key={index} className="project-detail-table-row">
                                                <td className="project-detail-table-cell">{brecha.title}</td>
                                                <td className="project-detail-table-cell project-detail-amount-cell">
                                                    ${Number(brecha.monto).toFixed(2)}
                                                </td>
                                                <td className="project-detail-table-cell">
                                                    {isBrechaAlcanzada(index) ? (
                                                        <span className="project-detail-brecha-alcanzada">
                                                            <FaCheck /> Alcanzada
                                                        </span>
                                                    ) : (
                                                        <span className="project-detail-brecha-pendiente">
                                                            <FaClock /> Pendiente
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="project-detail-no-brechas">
                                <p>No se definieron brechas específicas para este proyecto.</p>
                            </div>
                        )}
                        <div className="project-detail-total-goal">
                            <h4>Meta Total: ${project.metaTotal.toFixed(2)}</h4>
                        </div>
                    </div>
                );
            case 'dashboard':
                return (
                    <div className="project-detail-section-box">
                        <h3><FaChartLine /> Dashboard de Financiación</h3>
                        
                        {/* Solo visible para el creador del proyecto */}
                        {currentUser && currentUser.uid === project.creadorID ? (
                            <>
                                {/* Filtros por fecha */}
                                <div className="project-detail-filter-container">
                                    <h4><FaFilter /> Filtrar por Fecha</h4>
                                    <div className="project-detail-date-inputs">
                                        <input
                                            type="date"
                                            value={dateRange.startDate}
                                            onChange={(e) => setDateRange(prev => ({...prev, startDate: e.target.value}))}
                                            className="project-detail-date-input"
                                        />
                                        <span className="project-detail-date-separator">a</span>
                                        <input
                                            type="date"
                                            value={dateRange.endDate}
                                            onChange={(e) => setDateRange(prev => ({...prev, endDate: e.target.value}))}
                                            className="project-detail-date-input"
                                        />
                                        <button onClick={handleFilter} className="project-detail-filter-button">
                                            <FaSearch /> Aplicar Filtro
                                        </button>
                                        <button onClick={handleClearFilter} className="project-detail-clear-filter-button">
                                            <FaSync /> Limpiar
                                        </button>
                                    </div>
                                </div>

                                {/* Estadísticas */}
                                <div className="project-detail-stats-grid">
                                    <div className="project-detail-stat-card">
                                        <div className="project-detail-stat-icon">
                                            <FaMoneyBillWave />
                                        </div>
                                        <h4>Total Recaudado</h4>
                                        <p className="project-detail-stat-value">
                                            ${stats.totalDonations.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="project-detail-stat-card">
                                        <div className="project-detail-stat-icon">
                                            <FaChartBar />
                                        </div>
                                        <h4>Donación Promedio</h4>
                                        <p className="project-detail-stat-value">
                                            ${stats.averageDonation.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="project-detail-stat-card">
                                        <div className="project-detail-stat-icon">
                                            <FaUsers />
                                        </div>
                                        <h4>Donantes Únicos</h4>
                                        <p className="project-detail-stat-value">{stats.uniqueDonors}</p>
                                    </div>
                                    <div className="project-detail-stat-card">
                                        <div className="project-detail-stat-icon">
                                            <FaCalendarDay />
                                        </div>
                                        <h4>Actividad (7 días)</h4>
                                        <p className="project-detail-stat-value">{stats.recentActivity}</p>
                                    </div>
                                </div>

                                {/* 🌟 SECCIÓN: GRÁFICO COMBINADO CON ZOOM 🌟 */}
                                <div className="project-detail-charts-section">
                                    <h4><FaChartArea /> Visualización Avanzada de Donaciones</h4>
                                    
                                    {loadingTransactions ? (
                                        <div className="project-detail-loading-container">
                                            <div className="project-detail-loading-spinner"></div>
                                            <p>Cargando gráficos...</p>
                                        </div>
                                    ) : transactions.length === 0 ? (
                                        <div className="project-detail-no-data">
                                            <FaChartLine className="project-detail-no-data-icon" />
                                            <p>No hay datos para mostrar gráficos.</p>
                                        </div>
                                    ) : (
                                        <div className="project-detail-charts-grid">
                                            {/* 🌟 GRÁFICO COMBINADO PRINCIPAL CON ZOOM 🌟 */}
                                            <div className="project-detail-combined-chart-container">
                                                <div className="project-detail-chart-header">
                                                    <h5><FaChartLine /> Donaciones vs Total Acumulado (Con Zoom)</h5>
                                                    <div className="project-detail-zoom-instructions">
                                                        <span className="project-detail-zoom-hint">
                                                            <FaSearch /> Rueda del mouse para zoom | 
                                                            📱 Pellizca para zoom en móvil | 
                                                            ⌨️ Ctrl + arrastrar para panorámica
                                                        </span>
                                                        <button 
                                                            onClick={handleResetZoom} 
                                                            className="project-detail-reset-zoom-button"
                                                        >
                                                            <FaExpandArrowsAlt /> Resetear Zoom
                                                        </button>
                                                    </div>
                                                </div>
                                                {chartData.combined && (
                                                    <div className="project-detail-combined-chart-wrapper">
                                                        <Line 
                                                            ref={combinedChartRef}
                                                            data={chartData.combined} 
                                                            options={combinedChartOptions}
                                                            redraw
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Gráficos secundarios */}
                                            <div className="project-detail-chart-container">
                                                <h5><FaChartBar /> Donaciones Mensuales</h5>
                                                {chartData.monthly && (
                                                    <div className="project-detail-chart-wrapper">
                                                        <Bar 
                                                            data={chartData.monthly} 
                                                            options={barChartOptions}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="project-detail-chart-container">
                                                <h5><FaChartLine /> Donaciones Diarias</h5>
                                                {chartData.daily && (
                                                    <div className="project-detail-chart-wrapper">
                                                        <Line 
                                                            data={chartData.daily} 
                                                            options={chartOptions}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Tabla de Transacciones */}
                                <div className="project-detail-transactions-section">
                                    <h4>Historial de Donaciones</h4>
                                    {loadingTransactions ? (
                                        <div className="project-detail-loading-container">
                                            <div className="project-detail-loading-spinner"></div>
                                            <p>Cargando transacciones...</p>
                                        </div>
                                    ) : transactions.length === 0 ? (
                                        <div className="project-detail-no-data">
                                            <FaMoneyBillWave className="project-detail-no-data-icon" />
                                            <p>No hay transacciones en el período seleccionado.</p>
                                        </div>
                                    ) : (
                                        <div className="project-detail-table-container">
                                            <table className="project-detail-transactions-table">
                                                <thead>
                                                    <tr>
                                                        <th className="project-detail-table-header">Fecha y Hora</th>
                                                        <th className="project-detail-table-header">Donante</th>
                                                        <th className="project-detail-table-header">Monto</th>
                                                        <th className="project-detail-table-header">Tipo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {transactions.map((transaction) => (
                                                        <tr key={transaction.id} className="project-detail-table-row">
                                                            <td className="project-detail-table-cell">
                                                                {transaction.timestamp?.toDate().toLocaleString()}
                                                            </td>
                                                            <td className="project-detail-table-cell">
                                                                {transaction.origenID?.substring(0, 8)}...
                                                            </td>
                                                            <td className="project-detail-table-cell project-detail-amount-cell">
                                                                ${transaction.monto?.toFixed(2)}
                                                            </td>
                                                            <td className="project-detail-table-cell">
                                                                <span className="project-detail-type-badge">
                                                                    {transaction.type}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="project-detail-access-denied">
                                <FaLock className="project-detail-access-denied-icon" />
                                <h4>Acceso Restringido</h4>
                                <p>Esta sección solo está disponible para el creador del proyecto.</p>
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    // --- Lógica de Renderizado ---
    if (loading) return (
        <div className="project-detail-center-container">
            <div className="project-detail-loading-spinner-large"></div>
            <p>Cargando detalles del proyecto...</p>
        </div>
    );
    
    if (error && !project) return (
        <div className="project-detail-center-container">
            <FaExclamationTriangle className="project-detail-error-icon" />
            <h3>{error}</h3>
            <button onClick={() => navigate('/')} className="project-detail-home-button">
                Volver al Inicio
            </button>
        </div>
    );
    
    if (!project) return (
        <div className="project-detail-center-container">
            <FaExclamationTriangle className="project-detail-error-icon" />
            <h3>Proyecto no disponible</h3>
            <p>El proyecto que buscas no existe o ha sido eliminado.</p>
            <button onClick={() => navigate('/')} className="project-detail-home-button">
                Volver al Inicio
            </button>
        </div>
    );

    const percentageAchieved = project.metaTotal > 0 ? (project.recaudado / project.metaTotal) * 100 : 0;
    const isFundingComplete = project.recaudado >= project.metaTotal;
    const isCreator = currentUser && currentUser.uid === project.creadorID;
    
    const creatorDisplay = project.creadorNombre || project.creadorID?.substring(0, 8) + '...';

    return (
        <div className="project-detail-container">
            <button onClick={() => navigate(-1)} className="project-detail-back-button">
                <FaArrowLeft /> Volver
            </button>

            <div className="project-detail-grid">
                {/* Columna Izquierda: Contenido y Pestañas */}
                <div className="project-detail-main-content">
                    {/* Imagen Base64 */}
                    {project.imagenBase64 && (
                        <div className="project-detail-image-container">
                            <img 
                                src={project.imagenBase64} 
                                alt={project.titulo} 
                                className="project-detail-image" 
                            />
                        </div>
                    )}
                    
                    <div className="project-detail-header">
                        <h1 className="project-detail-title">{project.titulo}</h1>
                        <div className="project-detail-creator-info">
                            <span className="project-detail-creator">
                                <strong>{creatorDisplay}</strong>
                            </span>
                            <span className="project-detail-rating">
                                <FaStar className="project-detail-rating-icon" />
                                {project.ratingAvg ? project.ratingAvg.toFixed(1) : 'Sin calificar'} 
                                ({project.ratingCount || 0})
                            </span>
                            
                            {/* Botón de Reporte de Proyecto */}
                            {currentUser && !isCreator && (
                                <button onClick={handleReportProject} className="project-detail-report-button">
                                    <FaFlag /> Reportar Proyecto
                                </button>
                            )}
                        </div>
                    </div>

                    {/* NAVEGACIÓN POR PESTAÑAS */}
                    <div className="project-detail-tab-container">
                        <button 
                            onClick={() => setActiveTab('descripcion')} 
                            className={activeTab === 'descripcion' ? 'project-detail-tab-active' : 'project-detail-tab'}
                        >
                            <FaChartPie /> Descripción
                        </button>
                        <button 
                            onClick={() => setActiveTab('comentarios')} 
                            className={activeTab === 'comentarios' ? 'project-detail-tab-active' : 'project-detail-tab'}
                        >
                            <FaComment /> Comentarios ({comments.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('financiacion')} 
                            className={activeTab === 'financiacion' ? 'project-detail-tab-active' : 'project-detail-tab'}
                        >
                            <FaDollarSign /> Financiación
                        </button>
                        {/* Nueva pestaña de Dashboard - Solo visible para el creador */}
                        {isCreator && (
                            <button 
                                onClick={() => setActiveTab('dashboard')} 
                                className={activeTab === 'dashboard' ? 'project-detail-tab-active' : 'project-detail-tab'}
                            >
                                <FaChartLine /> Dashboard
                            </button>
                        )}
                    </div>

                    {/* RENDERIZAR EL CONTENIDO ACTIVO */}
                    {renderTabContent()}
                </div>

                {/* Columna Derecha: Donación y Métricas */}
                <div className="project-detail-sidebar">
                    {/* Tarjeta de Progreso */}
                    <div className="project-detail-donation-card">
                        <div className="project-detail-amount-container">
                            <h3 className="project-detail-amount-text">
                                ${project.recaudado.toFixed(2)}
                            </h3>
                            <p className="project-detail-goal-text">
                                de ${project.metaTotal.toFixed(2)} recaudado
                            </p>
                        </div>
                        
                        {/* 🌟 BARRA DE PROGRESO CON BRECHAS 🌟 */}
                        <div className="project-detail-progress-section">
                            <div className="project-detail-progress-container">
                                <div 
                                    className="project-detail-progress-bar" 
                                    style={{ width: `${Math.min(100, percentageAchieved)}%` }}
                                ></div>
                                
                                {/* 🌟 MARCADORES DE BRECHAS ACUMULATIVOS 🌟 */}
                                {project.brechas && project.brechas.map((brecha, index) => {
                                    const brechaPosition = calculateBrechaPosition(index);
                                    const isAlcanzada = isBrechaAlcanzada(index);
                                    
                                    // Calcular el monto acumulado hasta esta brecha
                                    let acumuladoHastaAhora = 0;
                                    for (let i = 0; i <= index; i++) {
                                        acumuladoHastaAhora += project.brechas[i].monto;
                                    }
                                    
                                    return (
                                        <div 
                                            key={index}
                                            className="project-detail-brecha-marker"
                                            style={{
                                                left: `${brechaPosition}%`,
                                                backgroundColor: isAlcanzada ? '#10b981' : '#f59e0b'
                                            }}
                                            onMouseEnter={() => setActiveTooltip(index)}
                                            onMouseLeave={() => setActiveTooltip(null)}
                                        >
                                            <div 
                                                className="project-detail-brecha-tooltip"
                                                style={{
                                                    opacity: activeTooltip === index ? 1 : 0,
                                                    pointerEvents: activeTooltip === index ? 'auto' : 'none'
                                                }}
                                            >
                                                <strong>{brecha.title}</strong>
                                                <br />
                                                Meta: ${acumuladoHastaAhora.toFixed(2)} 
                                                <br />
                                                ({brechaPosition.toFixed(1)}% del total)
                                                <br />
                                                {isAlcanzada ? <><FaCheck /> Alcanzada</> : <><FaClock /> Pendiente</>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <p className="project-detail-percentage-text">
                                {percentageAchieved.toFixed(1)}% alcanzado
                            </p>
                        </div>
                        
                        {/* 🌟 LEYENDA DE BRECHAS 🌟 */}
                        {project.brechas && project.brechas.length > 0 && (
                            <div className="project-detail-brechas-legend">
                                <h4 className="project-detail-brechas-legend-title">
                                    <FaChartPie /> Objetivos de Financiación:
                                </h4>
                                {project.brechas.map((brecha, index) => {
                                    // Calcular monto acumulado
                                    let acumuladoHastaAhora = 0;
                                    for (let i = 0; i <= index; i++) {
                                        acumuladoHastaAhora += project.brechas[i].monto;
                                    }
                                    
                                    const isAlcanzada = isBrechaAlcanzada(index);
                                    return (
                                        <div key={index} className="project-detail-brecha-legend-item">
                                            <div 
                                                className="project-detail-brecha-legend-color"
                                                style={{
                                                    backgroundColor: isAlcanzada ? '#10b981' : '#f59e0b'
                                                }}
                                            ></div>
                                            <span className="project-detail-brecha-legend-text">
                                                {brecha.title}: ${acumuladoHastaAhora.toFixed(2)} 
                                                <span className={isAlcanzada ? 'project-detail-brecha-alcanzada-text' : 'project-detail-brecha-pendiente-text'}>
                                                    {isAlcanzada ? <><FaCheck /> Alcanzada</> : <><FaClock /> Pendiente</>}
                                                </span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        
                        <div className="project-detail-wallet-info">
                            <p className="project-detail-wallet-text">
                                <FaWallet /> Wallet del proyecto: <strong>${project.projectWalletBalance.toFixed(2)}</strong>
                            </p>
                            
                            {/* 🌟 SOLO MOSTRAR SALDO RETIRABLE AL CREADOR 🌟 */}
                            {isCreator && (
                                <p className="project-detail-retirable-text">
                                    <FaHandHoldingUsd /> Disponible para retirar: <strong>${project.withdrawableBalance.toFixed(2)}</strong>
                                </p>
                            )}
                        </div>
                        
                        {/* Botón de Retiro (Solo visible para el Creador) */}
                        {isCreator && (
                            <button 
                                onClick={handleWithdraw} 
                                className="project-detail-withdraw-button" 
                                disabled={!isFundingComplete || loading || project.estado === 'Cerrado'}
                            >
                                <FaHandHoldingUsd /> 
                                {project.estado === 'Cerrado' ? 'Fondos Retirados' : 
                                 (!isFundingComplete ? 'Meta no Alcanzada' : 'Retirar Fondos')}
                            </button>
                        )}
                    </div>
                    
                    {/* Formulario de Donación */}
                    <div className="project-detail-form-container">
                        <h4><FaWallet /> Mi Saldo: ${userBalance.toFixed(2)}</h4>
                        {message && <p className="project-detail-success-message">{message}</p>}
                        {error && <p className="project-detail-error-message">{error}</p>}
                        
                        <form onSubmit={handleDonation} className="project-detail-donation-form">
                            <div className="project-detail-input-container">
                                <input
                                    type="number"
                                    placeholder="Monto a Donar ($)"
                                    value={donationAmount}
                                    onChange={(e) => setDonationAmount(e.target.value)}
                                    min="1"
                                    step="0.01"
                                    required
                                    disabled={!currentUser || loading || isFundingComplete}
                                    className="project-detail-input-field"
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={!currentUser || loading || isFundingComplete} 
                                className="project-detail-donate-button"
                            >
                                <FaHeart />
                                {isFundingComplete ? 'Meta Alcanzada' : 
                                 (loading ? 'Procesando...' : 'Donar Ahora')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectDetail;