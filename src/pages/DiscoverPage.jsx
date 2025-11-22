import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import styles from './DiscoverPage.module.css';

// Iconos para la interfaz
import { 
  FaSearch, 
  FaFilter, 
  FaFire, 
  FaClock, 
  FaStar,
  FaUsers,
  FaDollarSign,
  FaRocket,
  FaUser,
  FaUserTie,
  FaCrown
} from 'react-icons/fa';
import { MdTrendingUp, MdNewReleases } from 'react-icons/md';

// Componente para una tarjeta de proyecto
const ProjectCard = ({ project }) => {
    const creatorDisplay = project.creadorNombre || project.creadorID?.substring(0, 8) + '...';
    const imageSource = project.imagenBase64 || 'https://via.placeholder.com/300x180/667eea/ffffff?text=Proyecto';
    const percentage = project.metaTotal > 0 ? (project.recaudado / project.metaTotal) * 100 : 0;
    const shortDescription = project.descripcion?.substring(0, 70) + '...';

    const getDaysAgo = (timestamp) => {
        if (!timestamp) return 'Nuevo';
        const created = timestamp.toDate();
        const now = new Date();
        const diffTime = now - created;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return `Hace ${diffDays} días`;
        if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
        return `Hace ${Math.floor(diffDays / 30)} mes`;
    };

    return (
        <Link to={`/proyectos/${project.id}`} className={styles.projectLink}>
            <div className={styles.projectCard}>
                {percentage >= 100 && (
                    <div className={styles.fundedBadge}>
                        <FaStar />
                        Financiado
                    </div>
                )}
                {percentage >= 80 && percentage < 100 && (
                    <div className={styles.popularBadge}>
                        <FaFire />
                        Popular
                    </div>
                )}

                <div className={styles.imageContainer}>
                    <img src={imageSource} alt={project.titulo} />
                    <div className={styles.imageOverlay}>
                        <span className={styles.timeAgo}>
                            {getDaysAgo(project.fechaCreacion)}
                        </span>
                    </div>
                </div>

                <div className={styles.cardContent}>
                    <h3 className={styles.projectTitle}>{project.titulo}</h3>
                    <p className={styles.projectDescription}>{shortDescription}</p>

                    <div className={styles.progressSection}>
                        <div className={styles.progressHeader}>
                            <span className={styles.percentage}>{percentage.toFixed(0)}%</span>
                            <span className={styles.raised}>
                                ${project.recaudado?.toLocaleString() || 0} recaudados
                            </span>
                        </div>
                        <div className={styles.progressBar}>
                            <div 
                                className={styles.progressFill}
                                style={{ width: `${Math.min(100, percentage)}%` }}
                            ></div>
                        </div>
                        <div className={styles.progressGoal}>
                            Meta: ${project.metaTotal?.toLocaleString() || 0}
                        </div>
                    </div>

                    <div className={styles.creatorInfo}>
                        <FaUsers className={styles.creatorIcon} />
                        <span>Por {creatorDisplay}</span>
                    </div>

                    <div className={styles.actionButton}>
                        <FaRocket className={styles.buttonIcon} />
                        Ver Detalles
                    </div>
                </div>
            </div>
        </Link>
    );
};

// Componente para una tarjeta de usuario
const UserCard = ({ user }) => {
    const userAvatar = user.photoURL || user.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const userDisplayName = user.displayName || user.nombre || user.email?.split('@')[0] || 'Usuario';
    const userRole = user.role || 'Cliente';
    
    // Contar proyectos del usuario
    const projectsCount = user.projectsCount || 0;
    const isAdmin = userRole === 'Administrador';
    const isModerator = userRole === 'Moderador';

    const getRoleIcon = () => {
        if (isAdmin) return <FaCrown className={styles.roleIcon} />;
        if (isModerator) return <FaUserTie className={styles.roleIcon} />;
        return <FaUser className={styles.roleIcon} />;
    };

    const getRoleColor = () => {
        if (isAdmin) return '#ff6b6b';
        if (isModerator) return '#667eea';
        return '#00cc66';
    };

    return (
        <div className={styles.userCard}>
            <div className={styles.userAvatar}>
                <img src={userAvatar} alt={userDisplayName} />
                <div 
                    className={styles.roleBadge}
                    style={{ backgroundColor: getRoleColor() }}
                >
                    {getRoleIcon()}
                </div>
            </div>
            
            <div className={styles.userInfo}>
                <h3 className={styles.userName}>{userDisplayName}</h3>
                <p className={styles.userEmail}>{user.email}</p>
                <div className={styles.userStats}>
                    <div className={styles.stat}>
                        <span className={styles.statNumber}>{projectsCount}</span>
                        <span className={styles.statLabel}>Proyectos</span>
                    </div>
                    <div className={styles.roleTag} style={{ color: getRoleColor() }}>
                        {userRole}
                    </div>
                </div>
            </div>

            <div className={styles.userActions}>
                <Link 
                    to={`/perfil/${user.id}`} 
                    className={styles.profileButton}
                >
                    <FaUser className={styles.buttonIcon} />
                    Ver Perfil
                </Link>
            </div>
        </div>
    );
};

const DiscoverPage = () => {
    const [activeTab, setActiveTab] = useState('proyectos');
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [filteredProjects, setFilteredProjects] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Estados para filtros y búsqueda
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('todos');
    const [sortBy, setSortBy] = useState('nuevos');
    const [showFilters, setShowFilters] = useState(false);

    // Categorías disponibles
    const categories = [
        { value: 'todos', label: 'Todas las categorías' },
        { value: 'tecnologia', label: 'Tecnología' },
        { value: 'arte', label: 'Arte & Diseño' },
        { value: 'musica', label: 'Música' },
        { value: 'videojuegos', label: 'Videojuegos' },
        { value: 'cine', label: 'Cine & Video' },
        { value: 'moda', label: 'Moda' },
        { value: 'comida', label: 'Comida & Bebida' },
        { value: 'deportes', label: 'Deportes' },
        { value: 'educacion', label: 'Educación' }
    ];

    // Cargar proyectos
    useEffect(() => {
        const projectsRef = collection(db, 'proyectos');
        const q = query(projectsRef, where('estado', '==', 'Publicado'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsArray = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProjects(projectsArray);
            setFilteredProjects(projectsArray);
            setLoading(false);
        }, (err) => {
            console.error("Error al cargar proyectos:", err);
            setError("No se pudieron cargar los proyectos.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Cargar usuarios - VERSIÓN CORREGIDA
    const loadUsers = async () => {
        try {
            const usersRef = collection(db, 'usuarios');
            const usersSnapshot = await getDocs(usersRef);
            
            const usersArray = usersSnapshot.docs.map(doc => {
                const data = doc.data();
                console.log(`Usuario ${doc.id}:`, data); // Debug
                
                return {
                    id: doc.id,
                    // Múltiples fallbacks para name
                    displayName: data.displayName || data.nombre || data.username || 
                               data.email?.split('@')[0] || 'Usuario',
                    email: data.email || 'Sin email',
                    // 🔥 CORRECCIÓN: Usar 'rol' según tus reglas de Firestore
                    role: data.rol || 'Cliente',
                    photoURL: data.photoURL || data.avatarUrl || 
                             'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                    // Campos adicionales
                    ...data
                };
            });

            console.log('Usuarios cargados:', usersArray); // Debug

            // Contar proyectos por usuario
            const usersWithProjects = await Promise.all(
                usersArray.map(async (user) => {
                    try {
                        const projectsRef = collection(db, 'proyectos');
                        const userProjectsQuery = query(
                            projectsRef, 
                            where('creadorID', '==', user.id)
                        );
                        const userProjectsSnapshot = await getDocs(userProjectsQuery);
                        return {
                            ...user,
                            projectsCount: userProjectsSnapshot.size
                        };
                    } catch (error) {
                        console.error(`Error contando proyectos para ${user.id}:`, error);
                        return { ...user, projectsCount: 0 };
                    }
                })
            );

            setUsers(usersWithProjects);
            setFilteredUsers(usersWithProjects);
        } catch (err) {
            console.error("Error al cargar usuarios:", err);
            setError("Error al cargar la lista de usuarios. Verifica la consola para más detalles.");
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    // Aplicar filtros y búsqueda para proyectos
    useEffect(() => {
        if (activeTab === 'proyectos') {
            let result = [...projects];

            // Filtro por búsqueda
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                result = result.filter(project => 
                    project.titulo?.toLowerCase().includes(term) ||
                    project.descripcion?.toLowerCase().includes(term) ||
                    project.categoria?.toLowerCase().includes(term) ||
                    project.creadorNombre?.toLowerCase().includes(term)
                );
            }

            // Filtro por categoría
            if (selectedCategory !== 'todos') {
                result = result.filter(project => 
                    project.categoria === selectedCategory
                );
            }

            // Ordenar
            switch (sortBy) {
                case 'nuevos':
                    result.sort((a, b) => new Date(b.fechaCreacion?.toDate()) - new Date(a.fechaCreacion?.toDate()));
                    break;
                case 'populares':
                    result.sort((a, b) => (b.recaudado || 0) - (a.recaudado || 0));
                    break;
                case 'tendencia':
                    result.sort((a, b) => {
                        const scoreA = (a.recaudado || 0) * 0.7 + 
                                      (new Date() - new Date(a.fechaCreacion?.toDate())) / (1000 * 60 * 60 * 24) * 0.3;
                        const scoreB = (b.recaudado || 0) * 0.7 + 
                                      (new Date() - new Date(b.fechaCreacion?.toDate())) / (1000 * 60 * 60 * 24) * 0.3;
                        return scoreB - scoreA;
                    });
                    break;
                case 'financiados':
                    result.sort((a, b) => {
                        const progressA = (a.recaudado / a.metaTotal) * 100;
                        const progressB = (b.recaudado / b.metaTotal) * 100;
                        return progressB - progressA;
                    });
                    break;
                default:
                    break;
            }

            setFilteredProjects(result);
        }
    }, [projects, searchTerm, selectedCategory, sortBy, activeTab]);

    // Aplicar búsqueda para usuarios
    useEffect(() => {
        if (activeTab === 'usuarios') {
            let result = [...users];

            // Filtro por búsqueda
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                result = result.filter(user => 
                    user.displayName?.toLowerCase().includes(term) ||
                    user.nombre?.toLowerCase().includes(term) ||
                    user.email?.toLowerCase().includes(term) ||
                    user.role?.toLowerCase().includes(term)
                );
            }

            setFilteredUsers(result);
        }
    }, [users, searchTerm, activeTab]);

    // Estadísticas
    const stats = {
        totalProjects: filteredProjects.length,
        totalUsers: filteredUsers.length,
        funded: filteredProjects.filter(p => (p.recaudado / p.metaTotal) * 100 >= 100).length,
        new: filteredProjects.filter(p => {
            if (!p.fechaCreacion) return false;
            const created = p.fechaCreacion.toDate();
            const now = new Date();
            return (now - created) < (7 * 24 * 60 * 60 * 1000);
        }).length
    };

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>Buscando proyectos increíbles...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.errorContainer}>
                <h3>¡Ups! Algo salió mal</h3>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.heroTitle}>
                        Descubre y Conecta
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Explora proyectos innovadores y conoce a la comunidad CREW
                    </p>
                </div>
            </section>

            {/* Tabs de Navegación */}
            <section className={styles.tabsSection}>
                <div className={styles.tabsContainer}>
                    <button 
                        className={`${styles.tab} ${activeTab === 'proyectos' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('proyectos')}
                    >
                        <FaRocket className={styles.tabIcon} />
                        Proyectos
                        <span className={styles.tabBadge}>{stats.totalProjects}</span>
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'usuarios' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('usuarios')}
                    >
                        <FaUsers className={styles.tabIcon} />
                        Usuarios
                        <span className={styles.tabBadge}>{stats.totalUsers}</span>
                    </button>
                </div>
            </section>

            {/* Barra de Búsqueda y Filtros */}
            <section className={styles.filtersSection}>
                <div className={styles.searchBar}>
                    <div className={styles.searchInputContainer}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder={
                                activeTab === 'proyectos' 
                                    ? "Buscar proyectos por título, descripción o categoría..."
                                    : "Buscar usuarios por nombre, email o rol..."
                            }
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                    
                    {activeTab === 'proyectos' && (
                        <button 
                            className={`${styles.filterToggle} ${showFilters ? styles.active : ''}`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <FaFilter />
                            Filtros
                        </button>
                    )}
                </div>

                {/* Filtros Expandibles (solo para proyectos) */}
                {showFilters && activeTab === 'proyectos' && (
                    <div className={styles.expandedFilters}>
                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>Categoría</label>
                            <select 
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className={styles.filterSelect}
                            >
                                {categories.map(category => (
                                    <option key={category.value} value={category.value}>
                                        {category.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel}>Ordenar por</label>
                            <div className={styles.sortButtons}>
                                <button 
                                    className={`${styles.sortBtn} ${sortBy === 'nuevos' ? styles.active : ''}`}
                                    onClick={() => setSortBy('nuevos')}
                                >
                                    <MdNewReleases />
                                    Más nuevos
                                </button>
                                <button 
                                    className={`${styles.sortBtn} ${sortBy === 'populares' ? styles.active : ''}`}
                                    onClick={() => setSortBy('populares')}
                                >
                                    <FaDollarSign />
                                    Mayor recaudación
                                </button>
                                <button 
                                    className={`${styles.sortBtn} ${sortBy === 'tendencia' ? styles.active : ''}`}
                                    onClick={() => setSortBy('tendencia')}
                                >
                                    <MdTrendingUp />
                                    En tendencia
                                </button>
                                <button 
                                    className={`${styles.sortBtn} ${sortBy === 'financiados' ? styles.active : ''}`}
                                    onClick={() => setSortBy('financiados')}
                                >
                                    <FaStar />
                                    Casi financiados
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Estadísticas */}
            <section className={styles.stats}>
                {activeTab === 'proyectos' ? (
                    <>
                        <div className={styles.statItem}>
                            <span className={styles.statNumber}>{stats.totalProjects}</span>
                            <span className={styles.statLabel}>Proyectos encontrados</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statNumber}>{stats.new}</span>
                            <span className={styles.statLabel}>Proyectos nuevos</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statNumber}>{stats.funded}</span>
                            <span className={styles.statLabel}>Totalmente financiados</span>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.statItem}>
                            <span className={styles.statNumber}>{stats.totalUsers}</span>
                            <span className={styles.statLabel}>Usuarios encontrados</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statNumber}>
                                {users.filter(u => u.role === 'Cliente').length}
                            </span>
                            <span className={styles.statLabel}>Clientes</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statNumber}>
                                {users.filter(u => u.role === 'Administrador' || u.role === 'Moderador').length}
                            </span>
                            <span className={styles.statLabel}>Staff</span>
                        </div>
                    </>
                )}
            </section>

            {/* Contenido Dinámico */}
            {activeTab === 'proyectos' ? (
                /* Grid de Proyectos */
                <section className={styles.projectsGrid}>
                    {filteredProjects.length === 0 ? (
                        <div className={styles.noResults}>
                            <FaSearch className={styles.noResultsIcon} />
                            <h3>No se encontraron proyectos</h3>
                            <p>Intenta con otros términos de búsqueda o ajusta los filtros</p>
                        </div>
                    ) : (
                        filteredProjects.map(project => (
                            <ProjectCard key={project.id} project={project} />
                        ))
                    )}
                </section>
            ) : (
                /* Grid de Usuarios */
                <section className={styles.usersGrid}>
                    {filteredUsers.length === 0 ? (
                        <div className={styles.noResults}>
                            <FaUser className={styles.noResultsIcon} />
                            <h3>No se encontraron usuarios</h3>
                            <p>Intenta con otros términos de búsqueda</p>
                        </div>
                    ) : (
                        filteredUsers.map(user => (
                            <UserCard key={user.id} user={user} />
                        ))
                    )}
                </section>
            )}
        </div>
    );
};

export default DiscoverPage;