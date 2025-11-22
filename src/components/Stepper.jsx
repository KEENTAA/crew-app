// src/components/Stepper.jsx (VERSIÓN MEJORADA - BARRA AJUSTADA)
import React from 'react';
import { 
  FaCheck, 
  FaLightbulb, 
  FaMoneyBillWave, 
  FaClipboardCheck 
} from 'react-icons/fa';
import './Stepper.css';

const steps = [
    { 
        number: 1, 
        title: 'Detalles', 
        icon: <FaLightbulb />,
        description: 'Información básica'
    },
    { 
        number: 2, 
        title: 'Financiación', 
        icon: <FaMoneyBillWave />,
        description: 'Metas y objetivos'
    },
    { 
        number: 3, 
        title: 'Confirmar', 
        icon: <FaClipboardCheck />,
        description: 'Revisión final'
    },
];

const Stepper = ({ currentStep }) => {
    return (
        <div className="stepper-container">
            <div className="stepper-line-background"></div>
            
            {steps.map((step, index) => {
                const isCompleted = step.number < currentStep;
                const isActive = step.number === currentStep;
                const isLast = index === steps.length - 1;

                return (
                    <div key={step.number} className="stepper-step">
                        {/* Línea de progreso */}
                        {!isLast && (
                            <div className="step-connector">
                                <div 
                                    className={`connector-line ${isCompleted ? 'completed-connector' : ''}`}
                                ></div>
                            </div>
                        )}
                        
                        {/* Círculo del paso */}
                        <div className={`step-circle ${isCompleted ? 'completed-circle' : ''} ${isActive ? 'active-circle' : ''}`}>
                            {isCompleted ? (
                                <FaCheck className="step-check-icon" />
                            ) : (
                                <span className="step-number">{step.number}</span>
                            )}
                            <div className="step-icon">
                                {step.icon}
                            </div>
                        </div>

                        {/* Información del paso */}
                        <div className="step-info">
                            <div className={`step-title ${isActive ? 'active-title' : ''} ${isCompleted ? 'completed-title' : ''}`}>
                                {step.title}
                            </div>
                            <div className="step-description">
                                {step.description}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default Stepper;