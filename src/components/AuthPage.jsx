// src/components/AuthPage.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateVirtualCard } from '../utils/cardUtils'; 
import { updateProfile } from 'firebase/auth'; // Importamos para actualizar el nombre de usuario
import { auth, db } from '../firebaseConfig'; 
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup 
} from 'firebase/auth';
import { 
    doc, 
    setDoc, 
    getDoc 
} from 'firebase/firestore'; 

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true); 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // 🌟 NUEVO ESTADO: Campo para el Número de Carnet (CI) 🌟
    const [ciNumber, setCiNumber] = useState('');

    // Función auxiliar para manejar la creación del documento inicial en Firestore
    const createInitialUserDocument = async (user, ci = null) => {
        const virtualCard = generateVirtualCard(user.displayName || user.email.split('@')[0]);
        
        const userDocRef = doc(db, "usuarios", user.uid);
        await setDoc(userDocRef, {
            email: user.email,
            // Datos necesarios para la simulación
            rol: "Cliente", 
            balance: 0, 
            createdAt: new Date(),
            withdrawableBalance: 0, 
            
            // 🌟 NUEVOS CAMPOS DE VERIFICACIÓN Y DATOS PERSONALES 🌟
            displayName: user.displayName || user.email.split('@')[0], // Nombre inicial
            isProfileComplete: false, // Debe completar nombre y subir foto
            isIDVerified: false, // Debe ser verificado por el Admin
            ciNumber: ci, // Número de CI (solo para registro por email)
            ciFrontBase64: null, // Campo para la foto frontal del CI
            
            // Tarjeta Virtual
            cardStatus: ci ? 'Pendiente' : 'No Solicitada', // Inicia solicitud solo si tiene CI al registrar
            card: {
                cardNumber: virtualCard.cardNumber,
                expiryDate: virtualCard.expiryDate,
                cvv: virtualCard.cvv,
                status: virtualCard.status,
                nameOnCard: virtualCard.nameOnCard // Usar el nombre generado
            }
        });
    };

    // Lógica de Registro (Correo y Contraseña)
    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        // 🌟 VALIDACIÓN DE CI 🌟
        if (!isLogin && (!ciNumber || ciNumber.length < 5)) {
            setError('El número de Carnet (CI) es obligatorio y debe ser válido.');
            return;
        }
        setLoading(true);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Opcional: Actualizar el nombre de perfil de Firebase Auth al registrar (buena práctica)
            await updateProfile(user, { displayName: email.split('@')[0] });

            // Pasa el CI para que sea guardado
            await createInitialUserDocument(user, ciNumber); 

            // Mantienes este alert de registro para notificar que falta la verificación
            alert("¡Registro exitoso! Por favor, verifica tu identidad en la sección Perfil.");
            navigate('/'); 
        } catch (err) {
            const errorMessage = err.message.replace('Firebase: Error (auth/', '').replace(').', '');
            setError(`Error de registro: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    // Lógica de Inicio de Sesión (Correo y Contraseña)
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // 🗑️ LÍNEA ELIMINADA: alert("¡Inicio de sesión exitoso!");
            navigate('/'); 
        } catch (err) {
            setError('Credenciales inválidas o usuario no encontrado.');
        } finally {
            setLoading(false);
        }
    };

    // Lógica de Inicio de Sesión con Google
    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const userDocRef = doc(db, "usuarios", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // No pasamos CI aquí; se pedirá en la verificación de perfil.
                await createInitialUserDocument(user, null); 
            }
            
            // 🗑️ LÍNEA ELIMINADA: alert("Inicio de sesión con Google exitoso!");
            navigate('/'); 
        } catch (err) {
            setError('Error al iniciar sesión con Google. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.formBox}>
                <h2 style={styles.title}>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
                <button 
                    onClick={() => { setIsLogin(!isLogin); setError(''); }} 
                    style={styles.toggleButton}
                >
                    {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia Sesión'}
                </button>

                {error && <p style={styles.error}>{error}</p>}
                
                <form onSubmit={isLogin ? handleLogin : handleRegister} style={styles.form}>
                    <input
                        type="email"
                        placeholder="Correo Electrónico"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={styles.input}
                    />
                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={styles.input}
                    />

                    {!isLogin && (
                        <>
                            <input
                                type="password"
                                placeholder="Confirmar Contraseña"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                style={styles.input}
                            />
                            {/* 🌟 CAMPO ADICIONAL: Número de Carnet (CI) 🌟 */}
                            <input
                                type="text"
                                placeholder="Número de Carnet (CI)"
                                value={ciNumber}
                                onChange={(e) => setCiNumber(e.target.value)}
                                required={!isLogin}
                                style={styles.input}
                            />
                        </>
                    )}
                    
                    <button type="submit" style={styles.submitButton} disabled={loading}>
                        {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Registrar')}
                    </button>
                </form>

                {/* Botón de Google */}
                <button onClick={handleGoogleSignIn} style={styles.googleButton} disabled={loading}>
                    Continuar con Google
                </button>
            </div>
        </div>
    );
};

// ** ESTILOS RÁPIDOS PARA LA PÁGINA DE AUTENTICACIÓN **
const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f7fa',
        padding: '20px'
    },
    formBox: {
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
    },
    title: {
        marginBottom: '20px',
        color: '#333'
    },
    toggleButton: {
        background: 'none',
        border: 'none',
        color: '#4285F4',
        cursor: 'pointer',
        marginBottom: '20px',
        fontSize: '14px'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
    },
    input: {
        padding: '12px',
        borderRadius: '5px',
        border: '1px solid #ddd',
        fontSize: '16px'
    },
    submitButton: {
        padding: '12px',
        backgroundColor: '#4285F4',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold'
    },
    googleButton: {
        marginTop: '15px',
        padding: '12px',
        backgroundColor: 'white',
        color: '#4285F4',
        border: '1px solid #4285F4',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold'
    },
    error: {
        color: '#dc3545',
        backgroundColor: '#f8d7da',
        border: '1px solid #f5c6cb',
        padding: '10px',
        marginBottom: '10px',
        borderRadius: '5px'
    }
};

export default AuthPage;