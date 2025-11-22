// src/components/HeroSection.jsx

import React from 'react';

const HeroSection = () => {
  return (
    <div style={styles.hero}>
      <h1 style={styles.title}>Financia ideas, aprende haciéndolo</h1>
      <p style={styles.subtitle}>
        Una plataforma educativa de crowdfunding donde estudiantes y emprendedores
        aprenden cómo funciona el financiamiento colaborativo mientras apoyan proyectos reales.
      </p>
      <div style={styles.actions}>
        <button style={styles.exploreButton}>
          Explorar proyectos →
        </button>
        <button style={styles.secondaryButton}>Crear cuenta</button>
      </div>
      <div style={styles.searchBar}>
        <input
          type="text"
          placeholder="Buscar proyectos por nombre, categoría..."
          style={styles.searchInput}
        />
      </div>
    </div>
  );
};

const styles = {
    hero: {
        textAlign: 'center',
        // 🌟 CORRECCIÓN CLAVE: Reducimos el padding inferior (de 100px a 60px) 🌟
        padding: '100px 20px 60px', 
        background: 'linear-gradient(180deg, #F0F5FF, #FFFFFF)', 
    },
    title: {
        fontSize: '48px',
        fontWeight: '300',
        marginBottom: '20px',
    },
    subtitle: {
        fontSize: '18px',
        color: '#666',
        maxWidth: '700px',
        margin: '0 auto 30px', // Reducimos de 40px a 30px
    },
    actions: {
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        marginBottom: '30px', // Reducimos de 40px a 30px
    },
    exploreButton: {
        backgroundColor: '#4285F4', 
        color: 'white',
        border: 'none',
        padding: '15px 30px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
    },
    secondaryButton: {
        backgroundColor: '#f0f0f0',
        color: '#333',
        border: '1px solid #ccc',
        padding: '15px 30px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
    },
    searchBar: {
        display: 'inline-block',
        width: '500px',
        padding: '0 0', // Eliminamos el padding interno, el input lo maneja
        border: 'none', // El input manejará el borde ahora
        borderRadius: '30px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
        textAlign: 'left',
    },
    searchInput: {
        width: '500px', // Corregimos el width aquí
        padding: '15px 20px',
        border: '1px solid #ccc',
        borderRadius: '30px',
        outline: 'none',
        fontSize: '16px',
        paddingLeft: '10px'
    }
};

export default HeroSection;