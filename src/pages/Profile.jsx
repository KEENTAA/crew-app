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

// 1. AÑADIMOS LOS ICONOS QUE FALTABAN (FaFire, FaStar)
import { 
    FaUser, FaEnvelope, FaUserShield, FaCalendarAlt, FaCheckCircle, FaClock,
    FaTimesCircle, FaEdit, FaSave, FaTimes, FaCamera, FaIdCard, FaUpload,
    FaMoneyBillWave, FaShieldAlt, FaRocket, FaUsers, FaDollarSign, FaArrowLeft,
    FaCrown, FaUserTie, FaCog, FaUserCheck, FaFileSignature, FaFire, FaStar
} from 'react-icons/fa';
import { MdVerifiedUser, MdPendingActions, MdPhotoCamera, MdAttachFile } from 'react-icons/md';
import { FiUser, FiCalendar, FiDollarSign, FiEdit, FiCamera, FiUpload, FiCheck, FiArrowLeft } from 'react-icons/fi';

// =========================================================
// 2. COMPONENTE PROJECT CARD (Integrado desde tu código)
// =========================================================
const ProjectCard = ({ project }) => {
    const creatorDisplay = project.creadorNombre || project.creadorID?.substring(0, 8) + '...';
    // Aseguramos fallback si no hay imagen
    const imageSource = project.imagenBase64 || project.imagenURL || 'https://via.placeholder.com/300x200?text=Proyecto';
    const percentage = project.metaTotal > 0 ? (project.recaudado / project.metaTotal) * 100 : 0;
    const isFunded = percentage >= 100;
    const isPopular = project.recaudado > project.metaTotal * 0.7;

    const shortDescription = project.descripcion.length > 80 
        ? project.descripcion.substring(0, 80) + '...' 
        : project.descripcion;

    return (
        <div style={cardStyles.cardWrapper}>
            <Link to={`/proyectos/${project.id}`} style={cardStyles.link}>
                <div style={cardStyles.card}>
                    {/* Imagen */}
                    <div style={cardStyles.imageContainer}>
                        <img 
                            src={imageSource} 
                            alt={project.titulo} 
                            style={cardStyles.image}
                        />
                        <div style={cardStyles.badgesContainer}>
                            {isFunded && (
                                <div style={cardStyles.fundedBadge}>
                                    <FaCheckCircle />
                                </div>
                            )}
                            {isPopular && !isFunded && (
                                <div style={cardStyles.popularBadge}>
                                    <FaFire />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contenido */}
                    <div style={cardStyles.content}>
                        <h4 style={cardStyles.title}>{project.titulo}</h4>
                        <div style={cardStyles.metaInfo}>
                            <span style={cardStyles.creator}>
                                <FaUser style={cardStyles.creatorIcon} />
                                {creatorDisplay}
                            </span>
                            {project.ratingAvg > 0 && (
                                <span style={cardStyles.rating}>
                                    <FaStar /> {project.ratingAvg?.toFixed(1)}
                                </span>
                            )}
                        </div>
                        <div style={cardStyles.descriptionContainer}>
                            <p style={cardStyles.description}>{shortDescription}</p>
                        </div>
                        <div style={cardStyles.progressSection}>
                            <div style={cardStyles.progressContainer}>
                                <div 
                                    style={{
                                        ...cardStyles.progressBar,
                                        width: `${Math.min(100, percentage)}%`,
                                        background: isFunded ? '#10b981' : '#667eea'
                                    }}
                                ></div>
                            </div>
                            <div style={cardStyles.progressText}>
                                <span style={cardStyles.percentage}>{percentage.toFixed(0)}%</span>
                                <span style={cardStyles.amount}>
                                    ${project.recaudado?.toLocaleString()} de ${project.metaTotal?.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div style={cardStyles.tagsContainer}>
                            {project.tags && project.tags.length > 0 ? (
                                project.tags.slice(0, 2).map((tag, index) => (
                                    <span key={index} style={cardStyles.tag}>#{tag}</span>
                                ))
                            ) : (
                                <div style={cardStyles.emptyTags}></div>
                            )}
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
};

// =========================================================
// 3. COMPONENTE PRINCIPAL PROFILE
// =========================================================
const Profile = () => {
    const { userId } = useParams();
    const { currentUser, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    
    const [profileUserData, setProfileUserData] = useState({});
    const [userProjects, setUserProjects] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    
    // Estados para subida de imágenes y verificación
    const [ciNumberInput, setCiNumberInput] = useState(''); 
    const [ciPhotoFile, setCiPhotoFile] = useState(null); 
    const [newPhotoFile, setNewPhotoFile] = useState(null); 
    const [photoPreview, setPhotoPreview] = useState(null); 
    
    const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; 

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
                    setProfileUserData(userData);
                    setDisplayName(userData.displayName || userData.nombre || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuario');
                    setCiNumberInput(userData.ciNumber || '');
                    setPhotoPreview(userData.customPhotoBase64 || userData.photoURL);
                } else {
                    const publicUserData = {
                        id: userDocSnap.id,
                        displayName: userData.displayName || userData.nombre || userData.email?.split('@')[0] || 'Usuario',
                        email: '••••@•••••',
                        rol: userData.rol || 'Cliente',
                        photoURL: userData.photoURL || userData.avatarUrl || DEFAULT_AVATAR,
                        customPhotoBase64: userData.customPhotoBase64,
                        createdAt: userData.createdAt,
                        bio: userData.bio,
                        website: userData.website,
                        socialLinks: userData.socialLinks,
                        isIDVerified: userData.isIDVerified
                    };
                    setProfileUserData(publicUserData);
                }

                // Cargar Proyectos
                
                const projectsRef = collection(db, 'proyectos');
                console.log("🔍 Buscando proyectos para ID:", targetUserId);
                const userProjectsQuery = query(
                    projectsRef, 
                    where('creadorID', '==', targetUserId),
                    where('estado', 'in', ['Publicado', 'Meta Alcanzada', 'Activo']),
                    orderBy('createdAt', 'desc')
                );

                const projectsSnapshot = await getDocs(userProjectsQuery);
                const projectsData = projectsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

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

    // Listener para perfil propio
    useEffect(() => {
        if (!isOwnProfile || !currentUser) return;
        
        const userDocRef = doc(db, 'usuarios', currentUser.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfileUserData(data);
                // No sobrescribimos inputs de edición si el usuario está escribiendo
                if (!isEditing) {
                    setCiNumberInput(data.ciNumber || '');
                    setPhotoPreview(data.customPhotoBase64 || data.photoURL);
                }
            }
        });
        return () => unsubscribe();
    }, [isOwnProfile, currentUser, isEditing]);

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
        if (!ciNumberInput || ciNumberInput.length < 5) return setError('Ingresa tu número de Carnet (CI).');
        if (!ciPhotoFile && !profileUserData.ciFrontBase64) return setError('Sube una foto de tu carnet.');

        setLoading(true);
        setError(null);
        
        try {
            const updates = {
                ciNumber: ciNumberInput,
                isIDVerified: 'Pending',
                updatedAt: new Date()
            };

            if (ciPhotoFile) updates.ciFrontBase64 = ciPhotoFile;
            
            await updateDoc(doc(db, 'usuarios', currentUser.uid), updates);
            
            await addDoc(collection(db, 'notificaciones'), {
                type: 'id_verification_request',
                title: 'Nueva Solicitud de Verificación',
                message: `Usuario ${currentUser.email} solicitó verificación.`,
                read: false,
                timestamp: serverTimestamp(),
            });

            setMessage('✅ Solicitud enviada al Administrador.');
        } catch (e) {
            setError('Fallo al enviar solicitud.');
        } finally {
            setLoading(false);
        }
    };

    // Funciones visuales
    const getRoleIcon = () => {
        if (!profileUserData.rol) return <FaUser className={styles.roleIcon} />;
        switch (profileUserData.rol) {
            case 'Administrador': return <FaCrown className={styles.roleIcon} />;
            case 'Moderador': return <FaUserTie className={styles.roleIcon} />;
            default: return <FaUser className={styles.roleIcon} />;
        }
    };

    const getRoleColor = () => {
        if (!profileUserData.rol) return '#6c757d';
        switch (profileUserData.rol) {
            case 'Administrador': return '#ff6b6b';
            case 'Moderador': return '#667eea';
            default: return '#00cc66';
        }
    };

    const getVerificationIcon = () => {
        if (profileUserData.isIDVerified === true) return <FaCheckCircle className={styles.statusIcon} />;
        if (profileUserData.isIDVerified === 'Pending') return <FaClock className={styles.statusIcon} />;
        return <FaTimesCircle className={styles.statusIcon} />;
    };

    const finalPhotoURL = profileUserData.customPhotoBase64 || profileUserData.photoURL || DEFAULT_AVATAR;
    const isVerificationPending = profileUserData.isIDVerified === 'Pending';
    const isVerified = profileUserData.isIDVerified === true;

    if (authLoading || loading) return <div className={styles.centerContainer}><div className={styles.loadingSpinner}></div></div>;
    if (error && !profileUserData.id) return <div className={styles.centerContainer}><p>{error}</p></div>;

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerSection}>
                <div className={styles.profileHeader}>
                    {!isOwnProfile && (
                        <button onClick={() => navigate(-1)} className={styles.backButton}>
                            <FiArrowLeft /> Volver
                        </button>
                    )}
                    <h1 className={styles.header}>
                        {isOwnProfile ? 'Mi Perfil' : `Perfil de ${profileUserData.displayName}`}
                    </h1>
                    {isOwnProfile && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className={styles.editButton}>
                            <FiEdit /> Editar
                        </button>
                    )}
                </div>
            </div>

            {/* Mensajes */}
            {error && <div className={styles.errorMessage}>{error}</div>}
            {message && <div className={styles.successMessage}>{message}</div>}

            {/* Tarjeta de Información Principal */}
            <div className={styles.profileCard}>
                <div className={styles.avatarSection}>
                    <div className={styles.avatarContainer}>
                        <img src={finalPhotoURL} alt="Avatar" className={styles.avatarImage} />
                        {isOwnProfile && (
                            <label className={styles.avatarOverlay}>
                                <input type="file" accept="image/*" onChange={handlePhotoChange} className={styles.fileInputHidden} />
                                <FaCamera />
                            </label>
                        )}
                        <div className={styles.roleBadge} style={{ backgroundColor: getRoleColor() }}>
                            {getRoleIcon()}
                        </div>
                    </div>
                    <h1 className={styles.userName}>{profileUserData.displayName}</h1>
                    <div className={styles.roleTag} style={{ color: getRoleColor() }}>
                        {profileUserData.rol}
                    </div>
                </div>

                <div className={styles.infoSection}>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <FaEnvelope className={styles.infoIcon} />
                            <div><label>Email</label><span>{isOwnProfile ? currentUser?.email : profileUserData.email}</span></div>
                        </div>
                        <div className={styles.infoItem}>
                            <MdVerifiedUser className={styles.infoIcon} />
                            <div>
                                <label>Verificación</label>
                                <span className={isVerified ? styles.verifiedStatus : styles.notVerifiedStatus}>
                                    {getVerificationIcon()} {isVerified ? 'Verificado' : 'No Verificado'}
                                </span>
                            </div>
                        </div>
                        <div className={styles.infoItem}>
                            <FaRocket className={styles.infoIcon} />
                            <div><label>Proyectos</label><span>{userProjects.length}</span></div>
                        </div>
                        <div className={styles.infoItem}>
                            <FiCalendar className={styles.infoIcon} />
                            <div><label>Miembro desde</label><span>{profileUserData.createdAt?.toDate ? profileUserData.createdAt.toDate().toLocaleDateString() : 'N/A'}</span></div>
                        </div>
                    </div>
                    {profileUserData.bio && (
                        <div className={styles.bioSection}>
                            <h3>Sobre mí</h3>
                            <p>{profileUserData.bio}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ======================================================= */}
            {/* 4. NUEVA SECCIÓN DE PROYECTOS DEL USUARIO */}
            {/* ======================================================= */}
            <div className={styles.section} style={{ marginTop: '2rem' }}>
                <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaRocket /> 
                    {isOwnProfile ? 'Mis Proyectos Publicados' : `Proyectos de ${profileUserData.displayName}`}
                </h2>
                
                {userProjects.length > 0 ? (
                    <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '20px', 
                        justifyContent: 'center',
                        marginTop: '20px'
                    }}>
                        {userProjects.map(project => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666', background: 'white', borderRadius: '12px' }}>
                        <p>{isOwnProfile ? 'Aún no has publicado ningún proyecto.' : 'Este usuario aún no tiene proyectos publicados.'}</p>
                        {isOwnProfile && (
                            <button 
                                onClick={() => navigate('/crear-proyecto')}
                                style={{ marginTop: '10px', padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                            >
                                ¡Crear mi primer proyecto!
                            </button>
                        )}
                    </div>
                )}
            </div>
            {/* ======================================================= */}


            {/* Secciones de Edición y Verificación (Solo Owner) */}
            {isOwnProfile && (
                <>
                    {/* Verificación */}
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}><FaUserCheck /> Verificación de Identidad</h2>
                        <div className={styles.verificationCard}>
                            {isVerified ? (
                                <div className={styles.verifiedStatusContainer}>
                                    <FaCheckCircle color="#10b981" size={40} />
                                    <h3>¡Identidad Verificada!</h3>
                                </div>
                            ) : (
                                <>
                                    <p className={styles.verificationText}>Para publicar proyectos, verifica tu identidad.</p>
                                    <div className={styles.ciForm}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Número de CI:</label>
                                            <div className={styles.inputWithIcon}>
                                                <FaIdCard className={styles.inputIcon} />
                                                <input 
                                                    type="text" 
                                                    value={ciNumberInput} 
                                                    onChange={(e) => setCiNumberInput(e.target.value)} 
                                                    className={styles.inputField} 
                                                    disabled={isVerificationPending}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label className={styles.label}>Foto Frontal CI:</label>
                                            <input type="file" accept="image/*" onChange={handleCiPhotoChange} className={styles.fileInput} disabled={isVerificationPending} />
                                            {ciPhotoFile && <span style={{fontSize:'0.8rem', color:'green'}}>Foto seleccionada</span>}
                                        </div>
                                        <button 
                                            onClick={handleRequestVerification} 
                                            className={styles.verificationButton} 
                                            disabled={isVerificationPending || loading}
                                            style={{ opacity: isVerificationPending ? 0.7 : 1 }}
                                        >
                                            {isVerificationPending ? 'Solicitud Enviada' : 'Solicitar Verificación'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Editar Perfil */}
                    {isEditing && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}><FiEdit /> Editar Información</h2>
                            <form onSubmit={handleUpdateProfile} className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label>Nombre Público:</label>
                                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={styles.inputField} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Nueva Foto (Max 200KB):</label>
                                    <input type="file" onChange={handlePhotoChange} className={styles.fileInput} />
                                </div>
                                <div className={styles.formActions}>
                                    <button type="submit" className={styles.saveButton}><FaSave /> Guardar</button>
                                    <button type="button" onClick={() => setIsEditing(false)} className={styles.cancelButton}><FaTimes /> Cancelar</button>
                                </div>
                            </form>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// =========================================================
// 5. ESTILOS DE LA TARJETA (Copiados de tu código)
// =========================================================
const cardStyles = {
    cardWrapper: {
        width: '300px',
        height: '380px',
        flexShrink: 0,
    },
    link: {
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        height: '100%',
    },
    card: {
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
    },
    imageContainer: {
        position: 'relative',
        height: '140px',
        width: '100%',
        overflow: 'hidden',
        background: '#f8fafc',
        flexShrink: 0,
    },
    image: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    badgesContainer: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        display: 'flex',
        gap: '4px',
    },
    fundedBadge: {
        background: '#10b981',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '0.7rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
    },
    popularBadge: {
        background: '#f59e0b',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '0.7rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
    },
    content: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        gap: '8px',
        height: 'calc(100% - 140px)',
    },
    title: {
        fontSize: '1rem',
        fontWeight: '600',
        margin: '0',
        color: '#1e293b',
        lineHeight: '1.3',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        height: '2.6rem',
        minHeight: '2.6rem',
    },
    metaInfo: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.75rem',
        color: '#64748b',
        height: '1.2rem',
        minHeight: '1.2rem',
    },
    creator: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    creatorIcon: {
        fontSize: '0.7rem',
    },
    rating: {
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        color: '#f59e0b',
        fontWeight: '600',
    },
    descriptionContainer: {
        flex: '1 1 auto',
        minHeight: '2.4rem',
        maxHeight: '2.4rem',
        overflow: 'hidden',
    },
    description: {
        color: '#64748b',
        fontSize: '0.8rem',
        lineHeight: '1.4',
        margin: '0',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        height: '100%',
    },
    progressSection: {
        margin: '4px 0',
        height: '2.5rem',
        minHeight: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    progressContainer: {
        height: '6px',
        background: '#e2e8f0',
        borderRadius: '3px',
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: '3px',
        transition: 'width 0.3s ease',
    },
    progressText: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.75rem',
    },
    percentage: {
        fontWeight: '700',
        color: '#667eea',
    },
    amount: {
        color: '#64748b',
        fontWeight: '500',
    },
    tagsContainer: {
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        height: '1.5rem',
        minHeight: '1.5rem',
        alignItems: 'center',
    },
    tag: {
        background: 'rgba(102, 126, 234, 0.1)',
        color: '#667eea',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: '500',
        border: '1px solid rgba(102, 126, 234, 0.2)',
    },
    emptyTags: {
        height: '1rem',
    },
};

export default Profile;