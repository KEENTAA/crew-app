// src/pages/CreateProject.jsx (DISEÑO PROFESIONAL)

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  doc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';

import Stepper from '../components/Stepper';
import Step1Details from '../components/CreateProject/Step1Details';
import Step2Financing from '../components/CreateProject/Step2Financing';
import Step3Confirm from '../components/CreateProject/Step3Confirm';
import { db, auth } from '../firebaseConfig';

// Importar iconos
import { 
  FaRocket, 
  FaExclamationTriangle, 
  FaCheckCircle,
  FaArrowLeft,
  FaLightbulb,
  FaMoneyBillWave,
  FaClipboardCheck
} from 'react-icons/fa';

// Importar CSS
import './CreateProject.css';

const toKeywords = (str = '') =>
  str
    .toLowerCase()
    .split(/[\s,.;:!¡¿?]+/)
    .filter(Boolean)
    .slice(0, 20);

// 7 días en ms + tope por semana
const PROJECT_LIMIT_WEEKS = 7 * 24 * 60 * 60 * 1000;
const MAX_PROJECTS_PER_WEEK = 3;

export default function CreateProject() {
  const navigate = useNavigate();
  const { currentUser, userDoc } = useAuth();

  const [step, setStep] = useState(1);
  const [projectData, setProjectData] = useState({
    title: '',
    description: '',
    imageFile: null,
    tags: '',
    brechas: [{ id: Date.now(), title: 'Desarrollo MVP', monto: 0 }],
    metaTotal: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNext = (newData) => {
    setProjectData((prev) => {
      const merged = { ...prev, ...newData };
      if (Array.isArray(merged.brechas)) {
        merged.metaTotal = merged.brechas.reduce(
          (acc, b) => acc + Number(b.monto || 0),
          0
        );
      }
      return merged;
    });
    setStep((s) => Math.min(3, s + 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  // Publicar
  const handlePublish = async () => {
    setLoading(true);
    setError('');

    try {
      if (!auth.currentUser) throw new Error('Debes iniciar sesión para publicar.');

      // 1) KYC + Nombre obligatorio
      const isVerified = userDoc?.isIDVerified === true;
      const hasDisplayName = !!userDoc?.displayName?.trim();
      if (!isVerified || !hasDisplayName) {
        alert(
          'ERROR: Para publicar, debes completar tu Nombre y obtener la Verificación de Identidad del Administrador.'
        );
        navigate('/perfil');
        return;
      }

      // 2) Límite semanal
      const now = Date.now();
      const oneWeekAgo = now - PROJECT_LIMIT_WEEKS;

      const projectsRef = collection(db, 'proyectos');
      const q = query(
        projectsRef,
        where('creadorID', '==', currentUser.uid),
        where('createdAt', '>=', new Date(oneWeekAgo))
      );
      const snapshot = await getDocs(q);
      const recentProjectsCount = snapshot.size;

      if (recentProjectsCount >= MAX_PROJECTS_PER_WEEK) {
        throw new Error(
          `Límite de publicación alcanzado. Solo puedes publicar ${MAX_PROJECTS_PER_WEEK} proyectos por semana.`
        );
      }

      // 3) Validación de datos del proyecto
      if (
        !projectData.title?.trim() ||
        !projectData.description?.trim() ||
        !projectData.imageFile ||
        !Array.isArray(projectData.brechas) ||
        projectData.brechas.length === 0
      ) {
        throw new Error('Todos los campos del proyecto son obligatorios.');
      }

      // 4) Crear proyecto
      const imageBase64 = projectData.imageFile;
      const tagsArray = (projectData.tags || '')
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const metaTotal =
        projectData.metaTotal ||
        projectData.brechas.reduce((acc, b) => acc + Number(b.monto || 0), 0);

      const searchKeywords = Array.from(
        new Set([
          ...toKeywords(projectData.title),
          ...toKeywords(projectData.description),
          ...tagsArray,
        ])
      ).slice(0, 20);

      const creatorName = userDoc.displayName;

      const docRef = await addDoc(collection(db, 'proyectos'), {
        titulo: projectData.title,
        descripcion: projectData.description,
        imagenBase64: imageBase64,
        creadorID: currentUser.uid,
        creadorNombre: creatorName,
        brechas: projectData.brechas.map((b, idx) => ({
          id: b.id || `${idx}-${Date.now()}`,
          title: b.title || `Brecha ${idx + 1}`,
          monto: Number(b.monto || 0),
        })),
        metaTotal,
        recaudado: 0,
        estado: 'Publicado',
        projectWalletBalance: 0,
        withdrawableBalance: 0,
        searchKeywords,
        tags: tagsArray,
        createdAt: serverTimestamp(),
      });

      // 5) Registrar fecha en el usuario
      const userRef = doc(db, 'usuarios', currentUser.uid);
      await updateDoc(userRef, {
        projectDates: arrayUnion(new Date()),
        lastProjectAt: serverTimestamp(),
      });

      alert('¡Proyecto publicado exitosamente!');
      navigate(`/proyectos/${docRef.id}`);
    } catch (err) {
      console.error('Error al publicar:', err);
      setError(err.message || 'Error al publicar el proyecto. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (stepNumber) => {
    switch (stepNumber) {
      case 1: return <FaLightbulb className="step-icon" />;
      case 2: return <FaMoneyBillWave className="step-icon" />;
      case 3: return <FaClipboardCheck className="step-icon" />;
      default: return <FaRocket className="step-icon" />;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Step1Details 
            data={projectData} 
            onNext={handleNext} 
            stepIcon={getStepIcon(1)}
          />
        );
      case 2:
        return (
          <Step2Financing
            data={projectData}
            onNext={handleNext}
            onBack={handleBack}
            stepIcon={getStepIcon(2)}
          />
        );
      case 3:
        return (
          <Step3Confirm
            data={projectData}
            onPublish={handlePublish}
            onBack={handleBack}
            loading={loading}
            stepIcon={getStepIcon(3)}
          />
        );
      default:
        return <div>Paso no encontrado.</div>;
    }
  };

  return (
    <div className="create-project-container">
      {/* Header Section */}
      <div className="create-project-header">
        <div className="header-content">
          <div className="header-icon">
            <FaRocket />
          </div>
          <h1 className="header-title">Crear Nuevo Proyecto</h1>
          <p className="header-subtitle">
            Comparte tu idea con la comunidad y hazla realidad
          </p>
        </div>
      </div>

      {/* Stepper Section */}
      <div className="stepper-section">
        <Stepper currentStep={step} />
      </div>

      {/* Main Content */}
      <div className="create-project-content">
        {/* Navigation */}
        <div className="navigation-section">
          <button 
            onClick={() => navigate('/proyectos')}
            className="back-button"
          >
            <FaArrowLeft className="button-icon" />
            Volver a Proyectos
          </button>
          
          <div className="step-indicator">
            {getStepIcon(step)}
            <span className="step-text">Paso {step} de 3</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <FaExclamationTriangle className="error-icon" />
            <div className="error-content">
              <strong>Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Success Message (if any) */}
        {!error && step === 3 && (
          <div className="success-message">
            <FaCheckCircle className="success-icon" />
            <div className="success-content">
              <strong>¡Todo listo!</strong>
              <p>Revisa la información y publica tu proyecto</p>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="step-content">
          {renderStep()}
        </div>

        {/* Progress Info */}
        <div className="progress-info">
          <div className="progress-item">
            <span className="progress-label">Verificación:</span>
            <span className={`progress-status ${userDoc?.isIDVerified ? 'verified' : 'pending'}`}>
              {userDoc?.isIDVerified ? 'Completada' : 'Pendiente'}
            </span>
          </div>
          <div className="progress-item">
            <span className="progress-label">Límite semanal:</span>
            <span className="progress-status">
              {MAX_PROJECTS_PER_WEEK} proyectos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}