import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, auth } from '../firebaseConfig'; 
import { updateProfile } from 'firebase/auth'; 
import { 
    doc, 
    onSnapshot, 
    updateDoc, 
    addDoc, 
    collection, 
    serverTimestamp,
    getDoc,
    query,
    where,
    orderBy,
    getDocs
} from 'firebase/firestore'; 
import styles from './Profile.module.css';

// Importar iconos
import { 
    FaUser, FaEnvelope, FaUserShield, FaCalendarAlt, FaCheckCircle, FaClock,
    FaTimesCircle, FaEdit, FaSave, FaTimes, FaCamera, FaIdCard, FaUpload,
    FaMoneyBillWave, FaShieldAlt, FaRocket, FaUsers, FaDollarSign, FaArrowLeft,
    FaCrown, FaUserTie, FaCog, FaUserCheck, FaFileSignature
} from 'react-icons/fa';
import { MdVerifiedUser, MdPendingActions, MdCancel, MdPhotoCamera, MdAttachFile } from 'react-icons/md';
import { FiUser, FiMail, FiCalendar, FiDollarSign, FiEdit, FiCamera, FiUpload, FiCheck, FiArrowLeft } from 'react-icons/fi';

const Profile = () => {
    const { userId } = useParams();
    const { currentUser, currentUserRole, loading: authLoading, userDoc } = useAuth();
    const navigate = useNavigate();
    
    const [profileUserData, setProfileUserData] = useState({});
    const [userProjects, setUserProjects] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    
    const [ciNumberInput, setCiNumberInput] = useState(''); 
    const [ciPhotoFile, setCiPhotoFile] = useState(null); 
    const [newPhotoFile, setNewPhotoFile] = useState(null); 
    const [photoPreview, setPhotoPreview] = useState(null); 
    
    const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; 

    // Determinar si es el perfil propio o de otro usuario
    const isOwnProfile = !userId || (currentUser && currentUser.uid === userId);
    const targetUserId = userId || (currentUser ? currentUser.uid : null);

    useEffect(() => {
        if (!targetUserId) return;

        const loadProfileData = async () => {
            try {
                setLoading(true);
                
                // Cargar datos del usuario
                const userDocRef = doc(db, 'usuarios', targetUserId);
                const userDocSnap = await getDoc(userDocRef);

                if (!userDocSnap.exists()) {
                    setError('Usuario no encontrado');
                    setLoading(false);
                    return;
                }

                const userData = userDocSnap.data();
                
                if (isOwnProfile) {
                    // PERFIL PROPIO: Mostrar todos los datos
                    setProfileUserData(userData);
                    setDisplayName(userData.displayName || userData.nombre || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuario');
                    setCiNumberInput(userData.ciNumber || '');
                    setPhotoPreview(userData.customPhotoBase64 || userData.photoURL);
                } else {
                    // PERFIL DE OTRO USUARIO: Filtrar datos sensibles
                    const publicUserData = {
                        id: userDocSnap.id,
                        displayName: userData.displayName || userData.nombre || userData.email?.split('@')[0] || 'Usuario',
                        email: '••••@•••••',
                        rol: userData.rol || 'Cliente',
                        photoURL: userData.photoURL || userData.avatarUrl || DEFAULT_AVATAR,
                        createdAt: userData.createdAt,
                        bio: userData.bio,
                        website: userData.website,
                        socialLinks: userData.socialLinks,
                    };
                    setProfileUserData(publicUserData);
                }

                // ✅ CONSULTA FINAL DE PROYECTOS CON FILTRO
                const projectsRef = collection(db, 'proyectos');
                const userProjectsQuery = query(
                    projectsRef, 
                    where('creadorID', '==', targetUserId),
                    where('estado', 'in', ['Publicado', 'Meta Alcanzada', 'Activo']),
                    orderBy('fechaCreacion', 'desc')
                );

                const projectsSnapshot = await getDocs(userProjectsQuery);
                const projectsData = projectsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('✅ PROYECTOS FINALES:', {
                    cantidad: projectsData.length,
                    proyectos: projectsData.map(p => ({
                        titulo: p.titulo,
                        estado: p.estado
                    }))
                });

                setUserProjects(projectsData);
                setLoading(false);

            } catch (err) {
                console.error("Error cargando perfil:", err);
                setError("Error al cargar el perfil");
                setLoading(false);
            }
        };

        loadProfileData();
    }, [targetUserId, isOwnProfile, currentUser]);

    // Listener en tiempo real solo para el perfil propio
    useEffect(() => {
        if (!isOwnProfile || !currentUser) return;
        
        const userDocRef = doc(db, 'usuarios', currentUser.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfileUserData(data);
                setCiNumberInput(data.ciNumber || '');
                setPhotoPreview(data.customPhotoBase64 || data.photoURL);
            }
        }, (err) => {
            console.error("Error en listener de perfil:", err);
        });
        
        return () => unsubscribe();
    }, [isOwnProfile, currentUser]);

    const handlePhotoChange = (e) => {
        if (!isOwnProfile) return;
        
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 200 * 1024) { 
            alert("La imagen de perfil es demasiado grande. Máximo 200KB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setNewPhotoFile(reader.result); 
            setPhotoPreview(reader.result);
            setMessage('Foto de perfil lista para guardar.'); 
        };
        reader.readAsDataURL(file);
    };

    const handleCiPhotoChange = (e) => {
        if (!isOwnProfile) return;
        
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 250 * 1024) { 
            alert("La foto del carnet es demasiado grande. Máximo 250KB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setCiPhotoFile(reader.result);
            setMessage('Foto del carnet lista para enviar.');
        };
        reader.readAsDataURL(file);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!isOwnProfile || !currentUser) return;
        
        if (displayName.trim() === '') return;
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const updates = { updatedAt: new Date() };
            
            if (displayName.trim() !== (currentUser.displayName || '')) {
                 await updateProfile(auth.currentUser, { displayName: displayName.trim() });
                 updates.displayName = displayName.trim();
            }

            if (newPhotoFile) {
                updates.customPhotoBase64 = newPhotoFile;
            }

            await updateDoc(doc(db, 'usuarios', currentUser.uid), updates);

            setIsEditing(false);
            setNewPhotoFile(null); 
            setMessage('Perfil actualizado con éxito!');

        } catch (err) {
            console.error("Error al actualizar perfil:", err);
            setError("Fallo al actualizar. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleRequestVerification = async () => {
        if (!isOwnProfile || !currentUser) return;
        
        if (!ciNumberInput || ciNumberInput.length < 5) {
            return setError('Debes ingresar tu número de Carnet (CI).');
        }
        if (!ciPhotoFile && !profileUserData.ciFrontBase64) {
            return setError('Debes subir una foto frontal de tu carnet para la verificación.');
        }

        setLoading(true);
        setError(null);
        setMessage(null);
        
        try {
            const updates = {
                ciNumber: ciNumberInput,
                isIDVerified: 'Pending',
                updatedAt: new Date()
            };

            if (ciPhotoFile) {
                updates.ciFrontBase64 = ciPhotoFile;
            }
            
            await updateDoc(doc(db, 'usuarios', currentUser.uid), updates);
            
            await addDoc(collection(db, 'notificaciones'), {
                type: 'id_verification_request',
                title: 'Nueva Solicitud de Verificación PENDIENTE',
                message: `El usuario ${currentUser.email} ha solicitado verificación de identidad.`,
                read: false,
                timestamp: serverTimestamp(),
            });

            setMessage('✅ Solicitud de verificación enviada al Administrador.');

        } catch (e) {
            console.error("Error al solicitar verificación:", e);
            setError('Fallo al enviar la solicitud de verificación.');
        } finally {
            setLoading(false);
        }
    };

    // Funciones auxiliares
    const getRoleIcon = () => {
        if (!profileUserData.rol) return <FaUser className={styles.roleIcon} />;
        
        switch (profileUserData.rol) {
            case 'Administrador':
                return <FaCrown className={styles.roleIcon} />;
            case 'Moderador':
                return <FaUserTie className={styles.roleIcon} />;
            default:
                return <FaUser className={styles.roleIcon} />;
        }
    };

    const getRoleColor = () => {
        if (!profileUserData.rol) return '#6c757d';
        
        switch (profileUserData.rol) {
            case 'Administrador':
                return '#ff6b6b';
            case 'Moderador':
                return '#667eea';
            default:
                return '#00cc66';
        }
    };

    const getVerificationStatusClass = () => {
        if (profileUserData.isIDVerified === true) return styles.verifiedStatus;
        if (profileUserData.isIDVerified === 'Pending') return styles.pendingStatus;
        return styles.notVerifiedStatus;
    };

    const getVerificationIcon = () => {
        if (profileUserData.isIDVerified === true) return <FaCheckCircle className={styles.statusIcon} />;
        if (profileUserData.isIDVerified === 'Pending') return <FaClock className={styles.statusIcon} />;
        return <FaTimesCircle className={styles.statusIcon} />;
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'No disponible';
        return timestamp.toDate().toLocaleDateString('es-ES');
    };

    const finalPhotoURL = profileUserData.customPhotoBase64 || profileUserData.photoURL || DEFAULT_AVATAR;
    const isVerificationPending = profileUserData.isIDVerified === 'Pending';
    const isVerified = profileUserData.isIDVerified === true;

    if (authLoading || loading) {
        return (
            <div className={styles.centerContainer}>
                <div className={styles.loadingSpinner}>
                    <FaUser className={styles.spinnerIcon} />
                </div>
                <p>Cargando Perfil...</p>
            </div>
        );
    }
    
    if (error && !profileUserData.id) {
        return (
            <div className={styles.centerContainer}>
                <FaTimesCircle className={styles.errorIcon} />
                <p>{error}</p>
                <button 
                    onClick={() => navigate('/proyectos')}
                    className={styles.backButton}
                >
                    <FiArrowLeft />
                    Volver a Descubrir
                </button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header Section */}
            <div className={styles.headerSection}>
                <div className={styles.profileHeader}>
                    {!isOwnProfile && (
                        <button 
                            onClick={() => navigate(-1)}
                            className={styles.backButton}
                        >
                            <FiArrowLeft />
                            Volver
                        </button>
                    )}

                    <div className={styles.headerIcon}>
                        <FaUser />
                    </div>
                    
                    <h1 className={styles.header}>
                        {isOwnProfile ? 'Mi Perfil y Configuración' : `Perfil de ${profileUserData.displayName}`}
                    </h1>
                    
                    {isOwnProfile && !isEditing && (
                        <button 
                            onClick={() => setIsEditing(true)} 
                            className={styles.editButton}
                        >
                            <FiEdit className={styles.buttonIcon} />
                            Editar Perfil
                        </button>
                    )}
                </div>
                
                <p className={styles.subheader}>
                    <FaCog className={styles.subheaderIcon} />
                    {isOwnProfile 
                        ? 'Edita tu información pública y revisa tus datos de cuenta.'
                        : `Información pública de ${profileUserData.displayName}`
                    }
                </p>
            </div>
            
            {/* Mensajes */}
            {error && (
                <div className={styles.errorMessage}>
                    <FaTimesCircle className={styles.messageIcon} />
                    {error}
                </div>
            )}
            {message && (
                <div className={styles.successMessage}>
                    <FaCheckCircle className={styles.messageIcon} />
                    {message}
                </div>
            )}

            {/* Información del Perfil */}
            <div className={styles.profileCard}>
                <div className={styles.avatarSection}>
                    <div className={styles.avatarContainer}>
                        <img src={finalPhotoURL} alt="Foto de Perfil" className={styles.avatarImage} />
                        {isOwnProfile && (
                            <label className={styles.avatarOverlay}>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handlePhotoChange}
                                    className={styles.fileInputHidden}
                                />
                                <FaCamera className={styles.overlayIcon} />
                                <span>Cambiar</span>
                            </label>
                        )}
                        <div 
                            className={styles.roleBadge}
                            style={{ backgroundColor: getRoleColor() }}
                        >
                            {getRoleIcon()}
                        </div>
                    </div>
                    
                    <h1 className={styles.userName}>{profileUserData.displayName}</h1>
                    <div 
                        className={styles.roleTag}
                        style={{ color: getRoleColor() }}
                    >
                        {profileUserData.rol}
                    </div>
                </div>
                
                <div className={styles.infoSection}>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <FaEnvelope className={styles.infoIcon} />
                            <div>
                                <label>Email</label>
                                <span>
                                    {isOwnProfile ? currentUser?.email : profileUserData.email}
                                </span>
                            </div>
                        </div>

                        <div className={styles.infoItem}>
                            <FaUserShield className={styles.infoIcon} />
                            <div>
                                <label>Rol</label>
                                <span className={styles.roleBadge}>
                                    <FaShieldAlt className={styles.roleIcon} />
                                    {profileUserData.rol}
                                </span>
                            </div>
                        </div>

                        <div className={styles.infoItem}>
                            <MdVerifiedUser className={styles.infoIcon} />
                            <div>
                                <label>Verificación de ID</label>
                                <span className={`${styles.verificationStatus} ${getVerificationStatusClass()}`}>
                                    {getVerificationIcon()}
                                    {isVerified ? 'Verificado' : isVerificationPending ? 'Pendiente' : 'No Verificado'}
                                </span>
                            </div>
                        </div>

                        {isOwnProfile && (
                            <div className={styles.infoItem}>
                                <FiDollarSign className={styles.infoIcon} />
                                <div>
                                    <label>Saldo Retirable</label>
                                    <span className={styles.balance}>
                                        <FaMoneyBillWave className={styles.balanceIcon} />
                                        ${(profileUserData.withdrawableBalance || 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className={styles.infoItem}>
                            <FiCalendar className={styles.infoIcon} />
                            <div>
                                <label>Miembro desde</label>
                                <span>
                                    <FaCalendarAlt className={styles.calendarIcon} />
                                    {isOwnProfile 
                                        ? new Date(currentUser.metadata.creationTime).toLocaleDateString()
                                        : formatDate(profileUserData.createdAt)
                                    }
                                </span>
                            </div>
                        </div>

                        <div className={styles.infoItem}>
                            <FaRocket className={styles.infoIcon} />
                            <div>
                                <label>Proyectos Publicados</label>
                                <span>{userProjects.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Biografía (si existe) */}
                    {profileUserData.bio && (
                        <div className={styles.bioSection}>
                            <h3>Sobre mí</h3>
                            <p>{profileUserData.bio}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN SOLO PARA PERFIL PROPIO */}
            {isOwnProfile && (
                <>
                    {/* Verificación de Identidad */}
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            <FaUserCheck className={styles.sectionIcon} />
                            Verificación de Identidad
                        </h2>
                        <div className={styles.verificationCard}>
                            {isVerified ? (
                                <div className={styles.verifiedStatusContainer}>
                                    <div className={styles.verifiedIcon}>
                                        <FaCheckCircle />
                                    </div>
                                    <div>
                                        <h3 className={styles.verifiedTitle}>¡Identidad Verificada!</h3>
                                        <p>Tu identidad está verificada. ¡Puedes publicar proyectos!</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.verificationHeader}>
                                        <FaIdCard className={styles.verificationHeaderIcon} />
                                        <p className={styles.verificationText}>
                                            Para publicar proyectos, debes verificar tu identidad. Esto requiere tu CI y una foto del mismo.
                                        </p>
                                    </div>
                                    <div className={styles.ciForm}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>
                                                <FaFileSignature className={styles.labelIcon} />
                                                Número de Carnet (CI):
                                            </label>
                                            <div className={styles.inputWithIcon}>
                                                <FaIdCard className={styles.inputIcon} />
                                                <input
                                                    type="text"
                                                    value={ciNumberInput}
                                                    onChange={(e) => setCiNumberInput(e.target.value)}
                                                    placeholder="Tu Número de Carnet"
                                                    className={styles.inputField}
                                                    disabled={isVerificationPending || loading}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>
                                                <MdPhotoCamera className={styles.labelIcon} />
                                                Foto Frontal del CI (JPG/PNG):
                                            </label>
                                            <div className={styles.fileUpload}>
                                                <input
                                                    type="file"
                                                    accept="image/jpeg, image/png"
                                                    onChange={handleCiPhotoChange}
                                                    className={styles.fileInput}
                                                    disabled={isVerificationPending || loading}
                                                />
                                                <div className={styles.fileUploadLabel}>
                                                    <FiUpload className={styles.uploadIcon} />
                                                    {ciPhotoFile ? 'Archivo seleccionado' : 'Seleccionar archivo'}
                                                </div>
                                            </div>
                                            {profileUserData.ciFrontBase64 && !ciPhotoFile && (
                                                <p className={styles.fileInfo}>
                                                    <FiCheck className={styles.fileInfoIcon} />
                                                    Foto actual guardada.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={handleRequestVerification} 
                                        className={`${styles.verificationButton} ${
                                            isVerificationPending ? styles.verificationButtonPending : ''
                                        }`}
                                        disabled={isVerificationPending || loading}
                                    >
                                        {isVerificationPending ? (
                                            <>
                                                <MdPendingActions className={styles.buttonIcon} />
                                                Solicitud Enviada
                                            </>
                                        ) : (
                                            <>
                                                <FaUpload className={styles.buttonIcon} />
                                                Solicitar Verificación
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    
                    {/* Edición de Perfil */}
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            <FiEdit className={styles.sectionIcon} />
                            Editar Información Pública
                        </h2>

                        {!isEditing ? (
                            <div className={styles.editView}>
                                <div className={styles.currentInfo}>
                                    <label>
                                        <FaUser className={styles.infoIcon} />
                                        Nombre Público:
                                    </label>
                                    <span>{currentUser.displayName || profileUserData.displayName || 'No configurado'}</span>
                                </div>
                                <button 
                                    onClick={() => setIsEditing(true)} 
                                    className={styles.editButton}
                                >
                                    <FiEdit className={styles.buttonIcon} />
                                    Editar Nombre/Foto
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleUpdateProfile} className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        <FaUser className={styles.labelIcon} />
                                        Nombre Público:
                                    </label>
                                    <div className={styles.inputWithIcon}>
                                        <FiUser className={styles.inputIcon} />
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder="Ingresa tu nombre público"
                                            className={styles.inputField}
                                            disabled={loading}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        <FiCamera className={styles.labelIcon} />
                                        Cambiar Foto de Perfil (Max 200KB):
                                    </label>
                                    <div className={styles.fileUpload}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoChange}
                                            className={styles.fileInput}
                                            disabled={loading}
                                        />
                                        <div className={styles.fileUploadLabel}>
                                            <MdAttachFile className={styles.uploadIcon} />
                                            {newPhotoFile ? 'Nueva foto seleccionada' : 'Seleccionar foto'}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.formActions}>
                                    <button 
                                        type="submit" 
                                        className={styles.saveButton} 
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <div className={styles.spinner}></div>
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <FaSave className={styles.buttonIcon} />
                                                Guardar Cambios
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsEditing(false)} 
                                        className={styles.cancelButton} 
                                        disabled={loading}
                                    >
                                        <FaTimes className={styles.buttonIcon} />
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </>
            )}

            {/* Proyectos del Usuario (visible para todos) */}
            {userProjects.length > 0 && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <FaRocket className={styles.sectionIcon} />
                        Proyectos Publicados
                    </h2>
                    <div className={styles.projectsGrid}>
                        {userProjects.map(project => (
                            <Link 
                                key={project.id} 
                                to={`/proyectos/${project.id}`} 
                                className={styles.projectCard}
                            >
                                <div className={styles.projectImage}>
                                    <img 
                                        src={project.imagenBase64 || 'https://via.placeholder.com/300x180/667eea/ffffff?text=Proyecto'} 
                                        alt={project.titulo}
                                    />
                                </div>
                                <div className={styles.projectInfo}>
                                    <h3>{project.titulo}</h3>
                                    <p>{project.descripcion?.substring(0, 100)}...</p>
                                    <div className={styles.projectMeta}>
                                        <span className={styles.projectCategory}>{project.categoria}</span>
                                        <span className={styles.projectRaised}>
                                            ${project.recaudado?.toLocaleString() || 0} recaudados
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;