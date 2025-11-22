import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Componentes Home
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import HowItWorks from './components/HowItWorks';

// Vistas/Páginas
import AuthPage from './components/AuthPage';
import CreateProject from './pages/CreateProject';
import ProjectDetail from './pages/ProjectDetail';
import Wallet from './pages/Wallet';
import ModerationPanel from './pages/ModerationPanel';
import AdminPanel from './pages/AdminPanel';
import SearchResults from './pages/SearchResults';
import ProjectList from './pages/ProjectList';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard'; 
import DiscoverPage from './pages/DiscoverPage';

// Rutas protegidas
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';

// Componente para la página principal (Home)
const HomePage = () => (
    <>
        <HeroSection />
        <HowItWorks />
        
        {/* Sección de Proyectos Destacados con mejor estilo */}
        <section style={featuredProjectsStyles.section}>
            <div style={featuredProjectsStyles.container}>
                <div style={featuredProjectsStyles.header}>
                    <h2 style={featuredProjectsStyles.title}>Proyectos Destacados</h2>
                    <p style={featuredProjectsStyles.subtitle}>
                        Descubre las ideas más innovadoras que están buscando apoyo
                    </p>
                </div>
                <ProjectList />
                <div style={featuredProjectsStyles.ctaContainer}>
                    <a href="/proyectos" style={featuredProjectsStyles.ctaButton}>
                        Ver todos los proyectos
                    </a>
                </div>
            </div>
        </section>
    </>
);

// Estilos para la sección de proyectos destacados
const featuredProjectsStyles = {
    section: {
        padding: '80px 20px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    },
    container: {
        maxWidth: '1200px',
        margin: '0 auto',
    },
    header: {
        textAlign: 'center',
        marginBottom: '50px',
    },
    title: {
        fontSize: '2.5rem',
        fontWeight: '700',
        color: '#1e293b',
        margin: '0 0 15px 0',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },
    subtitle: {
        fontSize: '1.2rem',
        color: '#64748b',
        margin: '0',
        maxWidth: '600px',
        marginLeft: 'auto',
        marginRight: 'auto',
        lineHeight: '1.6',
    },
    ctaContainer: {
        textAlign: 'center',
        marginTop: '50px',
    },
    ctaButton: {
        display: 'inline-block',
        padding: '14px 32px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '12px',
        fontWeight: '600',
        fontSize: '1.1rem',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
        ':hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
        }
    },
};

// Aplicar hover effect
Object.assign(featuredProjectsStyles.ctaButton, {
    ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
    }
});

// Componente de página no encontrada
const NotFoundPage = () => (
    <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '60vh',
        padding: '40px 20px',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
        <div style={{ 
            textAlign: 'center', 
            background: 'white', 
            padding: '60px 40px', 
            borderRadius: '20px', 
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
            maxWidth: '500px',
            width: '100%'
        }}>
            <div style={{ 
                fontSize: '4rem', 
                marginBottom: '20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
            }}>🚀</div>
            <h1 style={{ 
                fontSize: '2rem', 
                fontWeight: '700', 
                color: '#2d3748', 
                margin: '0 0 15px 0' 
            }}>
                Página no encontrada
            </h1>
            <p style={{ 
                fontSize: '1.1rem', 
                color: '#718096', 
                lineHeight: '1.6', 
                marginBottom: '30px' 
            }}>
                La página que buscas no existe o ha sido movida.
            </p>
            <a href="/" style={{ 
                display: 'inline-block',
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '12px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
            }}>
                Volver al Inicio
            </a>
        </div>
    </div>
);

export default function App() {
    return (
        <div className="App" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header />

            <main style={{ flex: 1 }}>
                <Routes>
                    {/* Rutas Públicas */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/proyectos/:id" element={<ProjectDetail />} />
                    <Route path="/proyectos" element={<DiscoverPage />} />
                    <Route path="/buscar" element={<SearchResults />} />
                    <Route path="/perfil/:userId" element={<Profile />} />
                    <Route path="/wallet" element={<Wallet />} />

                    {/* Rutas Protegidas */}
                    <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/crear-proyecto" element={<ProtectedRoute><CreateProject /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

                    {/* Rutas con Roles */}
                    <Route path="/moderacion" element={<RoleRoute allow={['Moderador', 'Administrador']}><ModerationPanel /></RoleRoute>} />
                    <Route path="/admin" element={<RoleRoute allow={['Administrador']}><AdminPanel /></RoleRoute>} />

                    {/* Ruta 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </main>

            {/* Footer con gradiente morado */}
            <footer style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '40px 20px 20px',
                marginTop: 'auto'
            }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '40px',
                    marginBottom: '30px'
                }}>
                    <div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: '600', margin: '0 0 15px 0', color: 'white' }}>
                            CREW Funding
                        </h4>
                        <p style={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.6', margin: '0' }}>
                            Conectando ideas con recursos
                        </p>
                    </div>
                    <div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: '600', margin: '0 0 15px 0', color: 'white' }}>
                            Enlaces rápidos
                        </h4>
                        <a href="/proyectos" style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none', marginBottom: '8px', transition: 'color 0.3s ease' }}>
                            Descubrir Proyectos
                        </a>
                        <a href="/crear-proyecto" style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none', marginBottom: '8px', transition: 'color 0.3s ease' }}>
                            Crear Proyecto
                        </a>
                        <a href="/auth" style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none', marginBottom: '8px', transition: 'color 0.3s ease' }}>
                            Iniciar Sesión
                        </a>
                    </div>
                    <div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: '600', margin: '0 0 15px 0', color: 'white' }}>
                            Legal
                        </h4>
                        <a href="/terminos" style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none', marginBottom: '8px', transition: 'color 0.3s ease' }}>
                            Términos
                        </a>
                        <a href="/privacidad" style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none', marginBottom: '8px', transition: 'color 0.3s ease' }}>
                            Privacidad
                        </a>
                    </div>
                </div>
                <div style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                    paddingTop: '20px',
                    textAlign: 'center'
                }}>
                    <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0', fontSize: '0.9rem' }}>
                        &copy; 2024 CREW Funding. Todos los derechos reservados.
                    </p>
                </div>
            </footer>
        </div>
    );
}