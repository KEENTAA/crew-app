// src/pages/ProjectList.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { FaUser, FaHeart, FaCheckCircle, FaFire, FaStar } from 'react-icons/fa';

// Componente para una tarjeta de proyecto CON TAMAÑO FIJO Y MEJOR DISEÑO
const ProjectCard = ({ project }) => {
    const creatorDisplay = project.creadorNombre || project.creadorID?.substring(0, 8) + '...';
    const imageSource = project.imagenBase64 || '/placeholder-project.jpg';
    const percentage = project.metaTotal > 0 ? (project.recaudado / project.metaTotal) * 100 : 0;
    const isFunded = percentage >= 100;
    const isPopular = project.recaudado > project.metaTotal * 0.7;

    // Descripción corta fija
    const shortDescription = project.descripcion.length > 80 
        ? project.descripcion.substring(0, 80) + '...' 
        : project.descripcion;

    return (
        <div style={cardStyles.cardWrapper}>
            <Link to={`/proyectos/${project.id}`} style={cardStyles.link}>
                <div style={cardStyles.card}>
                    {/* Imagen del proyecto */}
                    <div style={cardStyles.imageContainer}>
                        <img 
                            src={imageSource} 
                            alt={project.titulo} 
                            style={cardStyles.image}
                        />
                        
                        {/* Badges superpuestos */}
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

                    {/* Contenido de la tarjeta */}
                    <div style={cardStyles.content}>
                        {/* Título */}
                        <h4 style={cardStyles.title}>{project.titulo}</h4>

                        {/* Información rápida */}
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

                        {/* Descripción - ALTURA FIJA */}
                        <div style={cardStyles.descriptionContainer}>
                            <p style={cardStyles.description}>{shortDescription}</p>
                        </div>

                        {/* Progreso */}
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
                                    ${project.recaudado.toLocaleString()} de ${project.metaTotal.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Tags (si existen) - ALTURA FIJA */}
                        <div style={cardStyles.tagsContainer}>
                            {project.tags && project.tags.length > 0 ? (
                                project.tags.slice(0, 2).map((tag, index) => (
                                    <span key={index} style={cardStyles.tag}>#{tag}</span>
                                ))
                            ) : (
                                <div style={cardStyles.emptyTags}></div>
                            )}
                        </div>

                        {/* Botón de acción */}
                        
                    </div>
                </div>
            </Link>
        </div>
    );
};

const ProjectList = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const projectsRef = collection(db, 'proyectos');
        const q = query(projectsRef, where('estado', '==', 'Publicado')); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsArray = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProjects(projectsArray);
            setLoading(false);
        }, (err) => {
            console.error("Error al cargar proyectos:", err);
            setError("No se pudieron cargar los proyectos. Revisa las reglas de Firestore.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) return <div style={listStyles.message}>Cargando proyectos...</div>;
    if (error) return <div style={{...listStyles.message, color: 'red'}}>{error}</div>;
    if (projects.length === 0) return <div style={{...listStyles.message, color: '#666'}}>Aún no hay proyectos publicados. ¡Sé el primero!</div>;

    return (
        <div style={listStyles.container}>
            {projects.map(project => (
                <ProjectCard key={project.id} project={project} />
            ))}
        </div>
    );
};

// ==================== ESTILOS CON TAMAÑO FIJO Y GRID ====================

const listStyles = {
    container: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        justifyContent: 'center',
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
    },
    message: {
        textAlign: 'center',
        padding: '50px'
    }
};

const cardStyles = {
    cardWrapper: {
        width: '300px', // Ancho fijo para cada tarjeta
        height: '380px', // Altura fija
        flexShrink: 0, // Evita que se reduzca
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
        height: '100%', // Ocupa toda la altura del wrapper
        width: '100%', // Ocupa todo el ancho del wrapper
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
    },
    
    // Image Section - ALTURA FIJA
    imageContainer: {
        position: 'relative',
        height: '140px', // Altura fija
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
    
    // Content Section - DISTRIBUCIÓN FIJA
    content: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        gap: '8px',
        height: 'calc(100% - 140px)', // Altura restante después de la imagen
    },
    
    // Title - ALTURA FIJA
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
    
    // Meta Info - ALTURA FIJA
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
    
    // Description - ALTURA FIJA
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
    
    // Progress Section - ALTURA FIJA
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
    
    // Tags - ALTURA FIJA
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
    
    // Action Button - ALTURA FIJA
    actionButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        padding: '8px',
        background: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontWeight: '600',
        justifyContent: 'center',
        fontSize: '0.8rem',
        cursor: 'pointer',
        marginTop: 'auto',
        transition: 'background 0.2s ease',
        height: '2.2rem',
        minHeight: '2.2rem',
        flexShrink: 0,
    },
    buttonIcon: {
        fontSize: '0.8rem',
    },
};

// Aplicar hover effects
Object.assign(cardStyles.card, {
    ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    }
});

export default ProjectList;