// src/components/Header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { auth, db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import NotificationSystem from './NotificationSystem';
import styles from './Header.module.css';

// Importar iconos de React Icons
import { 
  FaUser, 
  FaSignOutAlt, 
  FaCog, 
  FaTachometerAlt,
  FaPlus,
  FaChevronDown,
  FaHome,
  FaChartLine,
  FaUserCog,
  FaRocket
} from 'react-icons/fa';
import { 
  MdAdminPanelSettings, 
  MdAccountBalanceWallet
} from 'react-icons/md';
import { FiLogIn, FiUserPlus } from 'react-icons/fi';

// Avatar por defecto
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// MODIFICACIÓN CLAVE: Aceptar la prop isUserVerified
const Header = ({ isUserVerified }) => {
  const { currentUser, currentUserRole, userDoc } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Estado
  const [userBalance, setUserBalance] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef(null);

  // Efecto para detectar scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listener de balance (solo Cliente)
  useEffect(() => {
    if (!currentUser) { setUserBalance(0); return; }
    if (currentUserRole === 'Administrador' || currentUserRole === 'Moderador') {
      setUserBalance(0);
      return;
    }

    const userDocRef = doc(db, 'usuarios', currentUser.uid);
    const unsub = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) setUserBalance(snap.data().balance || 0);
      },
      (err) => console.error('Error al escuchar saldo en Header:', err)
    );
    return () => unsub();
  }, [currentUser, currentUserRole]);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isMenuOpen]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setIsMenuOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const profileImageUrl = userDoc?.photoURL || currentUser?.photoURL || DEFAULT_AVATAR;
  const canUseFunds = currentUserRole === 'Cliente';
  const isAdmin = currentUserRole === 'Administrador';
  const isModerator = currentUserRole === 'Moderador';

  // NUEVA LÓGICA CLAVE: Determinar si la creación de proyectos está deshabilitada
  // Está deshabilitada si es Cliente y NO está verificado.
  const isProjectCreationDisabled = canUseFunds && !isUserVerified; 

  // FUNCIÓN CLAVE: Manejar clic en el botón de Crear Proyecto
  const handleCreateProjectClick = (e) => {
    if (isProjectCreationDisabled) {
      e.preventDefault(); // Evita la navegación a /crear-proyecto
      
      // Redirige al perfil para que complete la verificación
      navigate('/perfil'); 
      alert("⚠️ Debes verificar tu identidad (CI) en tu perfil para publicar proyectos.");
    }
  };

  // Texto de Tooltip para el botón
  const tooltipMessage = isProjectCreationDisabled 
    ? "Debes verificar tu identidad (CI) en tu perfil para publicar proyectos." 
    : "Comenzar un nuevo proyecto de crowdfunding";
  
  // Enlace de destino del botón
  const createProjectTarget = isProjectCreationDisabled ? "/perfil" : "/crear-proyecto";


  const AccountMenu = () => (
    <div className={`${styles.headerMenu} ${isMenuOpen ? styles.open : ''}`} ref={menuRef}>
      <div className={styles.menuHeader}>
        <div className={styles.menuAvatar}>
          <img src={profileImageUrl} alt="Avatar" />
        </div>
        <div className={styles.menuUserInfo}>
          <p className={styles.menuName}>{userDoc?.displayName || currentUser?.email}</p>
          <p className={styles.menuRole}>
            <FaUser className={styles.menuRoleIcon} />
            {currentUserRole || '—'}
          </p>
        </div>
      </div>

      <div className={styles.menuDivider}></div>

      <Link to="/perfil" onClick={() => setIsMenuOpen(false)} className={styles.menuItem}>
        <FaCog className={styles.menuIcon} />
        <span>Mi Perfil</span>
      </Link>

      <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className={styles.menuItem}>
        <FaTachometerAlt className={styles.menuIcon} />
        <span>Dashboard</span>
      </Link>

      {isAdmin && (
        <Link to="/admin" onClick={() => setIsMenuOpen(false)} className={styles.menuItem}>
          <MdAdminPanelSettings className={styles.menuIcon} />
          <span>Panel Admin</span>
        </Link>
      )}

      {(isModerator || isAdmin) && (
        <Link to="/moderacion" onClick={() => setIsMenuOpen(false)} className={styles.menuItem}>
          <FaUserCog className={styles.menuIcon} />
          <span>Panel Moderador</span>
        </Link>
      )}

      <div className={styles.menuDivider}></div>

      <button onClick={handleLogout} className={styles.menuLogout}>
        <FaSignOutAlt className={styles.menuIcon} />
        <span>Cerrar Sesión</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Header Fijo */}
      <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
        <div className={styles.headerContainer}>
          {/* Logo y Navegación */}
          <div className={styles.headerLeft}>
            <Link to="/" className={styles.logo}>
              <div className={styles.logoIcon}>
                <FaRocket className={styles.rocketIcon} />
              </div>
              <div className={styles.logoText}>
                <span className={styles.logoPrimary}>CREW</span>
              </div>
            </Link>

            {/* Navegación principal */}
            <nav className={styles.mainNav}>
              <Link 
                to="/" 
                className={`${styles.navLink} ${location.pathname === '/' ? styles.active : ''}`}
              >
                <FaHome className={styles.navIcon} />
                Inicio
              </Link>
              <Link 
                to="/proyectos" 
                className={`${styles.navLink} ${location.pathname === '/proyectos' ? styles.active : ''}`}
              >
                <FaChartLine className={styles.navIcon} />
                Descubrir
              </Link>
            </nav>
          </div>

          {/* Acciones derecha */}
          <div className={styles.headerRight}>
            {/* Wallet solo para Cliente */}
            {canUseFunds && (
              <Link to={currentUser ? '/wallet' : '/auth'} className={styles.walletBtn}>
                <MdAccountBalanceWallet className={styles.btnIcon} />
                <span className={styles.btnText}>
                  {currentUser ? `$${Number(userBalance || 0).toFixed(0)}` : 'Wallet'}
                </span>
              </Link>
            )}

            {/* Crear proyecto solo Cliente (AHORA CONDICIONAL A VERIFICACIÓN) */}
            {canUseFunds && (
              <Link 
                to={createProjectTarget} 
                // Aplicar clase 'disabled' si no está verificado
                className={`${styles.createProjectBtn} ${isProjectCreationDisabled ? styles.disabled : ''}`}
                onClick={handleCreateProjectClick}
                title={tooltipMessage} // Tooltip al pasar el mouse
              >
                <FaPlus className={styles.btnIcon} />
                <span className={styles.btnText}>Crear Proyecto</span>
              </Link>
            )}

            {/* Notificaciones */}
            {currentUser && (
              <div className={styles.notificationsWrapper}>
                <NotificationSystem />
              </div>
            )}

            {/* Perfil / Login */}
            {currentUser ? (
              <div className={styles.profileMenuWrapper}>
                <button
                  onClick={() => setIsMenuOpen((v) => !v)}
                  className={`${styles.profileBtn} ${isMenuOpen ? styles.active : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={isMenuOpen}
                >
                  <div className={styles.profileAvatar}>
                    <img src={profileImageUrl} alt="Avatar" />
                  </div>
                  <FaChevronDown className={styles.chevronIcon} />
                </button>
                {isMenuOpen && <AccountMenu />}
              </div>
            ) : (
              <div className={styles.authButtons}>
                <Link to="/auth" className={styles.loginBtn}>
                  <FiLogIn className={styles.btnIcon} />
                  <span>Ingresar</span>
                </Link>
                <Link to="/auth" className={styles.signupBtn}>
                  <FiUserPlus className={styles.btnIcon} />
                  <span>Registrarse</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 🔥 ESPACIO RESERVADO - Esto evita el desfase */}
      <div className={styles.headerSpacer}></div>
    </>
  );
};

export default Header;