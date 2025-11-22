// src/routes/RoleRoute.jsx

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const RoleRoute = ({ allow, children }) => {
    const { currentUser, currentUserRole, loading } = useAuth();

    if (loading) {
        return <div style={{textAlign: 'center', padding: '100px'}}>Cargando permisos...</div>;
    }

    // 1. Debe estar logueado (si no, ProtectedRoute se encarga, pero verificamos aquí por seguridad)
    if (!currentUser) {
        return <Navigate to="/auth" replace />;
    }

    // 2. Verifica si el rol del usuario está incluido en el array 'allow'
    const hasRequiredRole = allow.includes(currentUserRole);

    if (!hasRequiredRole) {
        // Redirige a la página principal o a una página de acceso denegado
        return <Navigate to="/" replace />;
    }

    return children;
};

export default RoleRoute;