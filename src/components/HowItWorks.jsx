// src/components/HowItWorks.jsx

import React from 'react';

const HowItWorks = () => {
    // Definición de los pasos (se mantiene igual)
    const steps = [
        {
            number: 1,
            title: "Crear proyecto",
            description: "Define tu idea, establece objetivos de financiación y comparte tu visión con la comunidad.",
            color: 'mediumslateblue'
        },
        {
            number: 2,
            title: "Donar",
            description: "Apoya proyectos que te inspiren con donaciones usando tu wallet virtual de la plataforma.",
            color: 'teal'
        },
        {
            number: 3,
            title: "Aprender",
            description: "Experimenta cómo funciona el crowdfunding, gestiona fondos y construye tu comunidad.",
            color: 'orange'
        }
    ];

    return (
        <div style={styles.container}>
            <p style={styles.title}>¿Cómo funciona?</p>
            <div style={styles.stepsGrid}>
                {steps.map((step) => (
                    <div key={step.number} style={styles.stepCard}>
                        {/* Icono (simulado) */}
                        <div style={{ ...styles.iconCircle, borderColor: step.color }}>
                            <span style={{ ...styles.iconText, color: step.color }}>$</span>
                        </div>
                        <p style={styles.stepTitle}>{step.number}. {step.title}</p>
                        <p style={styles.stepDescription}>{step.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const styles = {
    container: {
        textAlign: 'center',
        padding: '50px 20px',
        // 🌟 CORRECCIÓN CLAVE: Reducimos el margen superior de 50px a 20px 🌟
        marginTop: '20px' 
    },
    title: {
        fontSize: '18px',
        color: '#888',
        marginBottom: '30px',
    },
    stepsGrid: {
        display: 'flex',
        justifyContent: 'center',
        gap: '40px',
    },
    stepCard: {
        maxWidth: '250px',
    },
    iconCircle: {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        border: '2px solid',
        margin: '0 auto 20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        fontSize: '24px',
        fontWeight: 'bold',
    },
    stepTitle: {
        fontWeight: 'bold',
        fontSize: '16px',
        marginBottom: '10px',
    },
    stepDescription: {
        fontSize: '14px',
        color: '#666',
    }
};

export default HowItWorks;