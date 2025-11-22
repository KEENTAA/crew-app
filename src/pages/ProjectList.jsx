// src/pages/ProjectList.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth'; // Necesario para obtener la referencia a Auth

// Componente para una tarjeta de proyecto
const ProjectCard = ({ project }) => {
    // Si el proyecto fue creado después de la corrección, usará creadorNombre.
    const creatorDisplay = project.creadorNombre || project.creadorID?.substring(0, 8) + '...';
    const imageSource = project.imagenBase64 || 'placeholder.png'; 
    const percentage = project.metaTotal > 0 ? (project.recaudado / project.metaTotal) * 100 : 0;

    // Lógica para limitar la descripción
    const shortDescription = project.descripcion.substring(0, 70) + '...';

    return (
        // ENVUELVE LA TARJETA COMPLETA EN EL COMPONENTE Link
        <Link to={`/proyectos/${project.id}`} style={cardStyles.link}> 
            <div style={cardStyles.card}>
                <img src={imageSource} alt={project.titulo} style={cardStyles.image} />
                <div style={cardStyles.content}>
                    {/* 🌟 MANTENEMOS TÍTULO EN UNA LÍNEA FIJA PARA ALTURA CONSISTENTE 🌟 */}
                    <h4 style={cardStyles.title}>{project.titulo}</h4> 
                    
                    {/* Usamos la descripción corta que ya definimos */}
                    <p style={cardStyles.description}>{shortDescription}</p>
                    
                    {/* Indicador de progreso */}
                    <div style={cardStyles.progressContainer}>
                        <div style={{...cardStyles.progressBar, width: `${Math.min(100, percentage)}%`}}></div>
                    </div>
                    <p style={cardStyles.fundingText}>
                        ${project.recaudado.toFixed(0)} de ${project.metaTotal.toFixed(0)}
                    </p>
                    
                    {/* 🌟 CORRECCIÓN: Muestra el nombre legible 🌟 */}
                    <p style={cardStyles.creator}>Creador: {creatorDisplay}</p>
                </div>
            </div>
        </Link>
    );
};


const ProjectList = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // 1. Crear la consulta: Solo proyectos en estado 'Publicado'
        const projectsRef = collection(db, 'proyectos');
        // Consulta: Proyectos Públicos y Ordenados (requiere índice si se usa orderBy)
        const q = query(projectsRef, where('estado', '==', 'Publicado')); 

        // 2. Escuchar cambios en tiempo real (onSnapshot)
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

// --- Estilos Básicos para la lista y la tarjeta ---
const listStyles = {
    container: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        justifyContent: 'center',
        padding: '20px'
    },
    message: {
        textAlign: 'center',
        padding: '50px'
    }
};

const cardStyles = {
    link: {
        textDecoration: 'none',
        color: 'inherit',
        display: 'block', 
        transition: 'transform 0.2s',
        // Asegurar que el link tenga un tamaño fijo si la tarjeta está flotando
    },
    // 🌟 CORRECCIÓN CLAVE: Altura fija y overflow para contenido 🌟
    card: {
        width: '300px',
        height: '420px', // Altura fija para todas las tarjetas
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        backgroundColor: 'white',
        margin: 0, // Asegura que no haya margen interno
        padding: 0,
    },
    image: {
        width: '100%',
        height: '180px',
        objectFit: 'cover'
    },
    content: {
        padding: '15px',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1, // Permite que el contenido se expanda
    },
    title: {
        fontSize: '18px',
        marginBottom: '5px',
        fontWeight: 'bold',
        // Aseguramos que el título no rompa el diseño si es muy largo
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minHeight: '20px' // Altura mínima para el título
    },
    description: {
        fontSize: '14px',
        color: '#666',
        marginBottom: '10px',
        // Altura fija para la descripción
        height: '36px', 
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2, // Limita a 2 líneas (para navegadores Webkit)
        WebkitBoxOrient: 'vertical',
    },
    progressContainer: {
        height: '8px',
        backgroundColor: '#eee',
        borderRadius: '4px',
        marginBottom: '5px',
        marginTop: 'auto', // Empuja el progreso hacia abajo si el texto es corto
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#4285F4',
        borderRadius: '4px',
        transition: 'width 0.5s'
    },
    fundingText: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#333'
    },
    creator: {
        fontSize: '12px',
        color: '#999',
        marginTop: '5px'
    }
};

export default ProjectList;