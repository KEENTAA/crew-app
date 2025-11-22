// src/routes/ProtectedRoute.jsx

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext'; // Asumiendo que AuthContext está en ../AuthContext

const ProtectedRoute = ({ children }) => {
    const { currentUser, loading } = useAuth();

    if (loading) {
        // Muestra un loader mientras Firebase verifica el estado de autenticación
        return <div style={{textAlign: 'center', padding: '100px'}}>Cargando usuario...</div>;
    }

    if (!currentUser) {
        // Si no está logueado, redirige a la página de autenticación
        return <Navigate to="/auth" replace />;
    }

    return children;
};

export default ProtectedRoute;