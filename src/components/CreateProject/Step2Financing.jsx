import React, { useState, useEffect } from 'react';
import { FaMoneyBillWave, FaPlus, FaTrash } from 'react-icons/fa';
import './CreateProjectStyles.css';

const Step2Financing = ({ data, onNext, onBack, stepIcon }) => {
    const [brechas, setBrechas] = useState(data.brechas);
    const [metaTotal, setMetaTotal] = useState(data.metaTotal);

    useEffect(() => {
        const total = brechas.reduce((sum, brecha) => sum + (Number(brecha.monto) || 0), 0);
        setMetaTotal(total);
    }, [brechas]);

    const handleBrechaChange = (id, field, value) => {
        setBrechas(brechas.map(b => 
            b.id === id ? { ...b, [field]: value } : b
        ));
    };

    const addBrecha = () => {
        setBrechas([...brechas, { 
            id: Date.now(), 
            title: `Objetivo ${brechas.length + 1}`, 
            monto: 0 
        }]);
    };

    const removeBrecha = (id) => {
        if (brechas.length > 1) {
            setBrechas(brechas.filter(b => b.id !== id));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (metaTotal <= 0) {
            alert("La meta total de financiación debe ser mayor a $0.");
            return;
        }
        
        // Validar que todas las brechas tengan título y monto
        const invalidBrechas = brechas.filter(b => !b.title.trim() || b.monto <= 0);
        if (invalidBrechas.length > 0) {
            alert("Por favor, completa todos los títulos y montos de las brechas.");
            return;
        }
        
        onNext({ brechas, metaTotal });
    };

    return (
        <form onSubmit={handleSubmit} className="create-project-form">
            <div className="section-header">
                <h2 className="section-title">
                    {stepIcon || <FaMoneyBillWave className="section-icon" />}
                    Financiación del Proyecto
                </h2>
                <p className="section-subtitle">
                    Define los objetivos de financiación para tu proyecto. Cada brecha representa un hito específico a alcanzar.
                </p>
            </div>

            <div className="brechas-container">
                {brechas.map((brecha, index) => (
                    <div key={brecha.id} className="brecha-row">
                        <div className="brecha-item">
                            <label className="form-label">
                                Objetivo {index + 1} <span className="required-star">*</span>
                            </label>
                            <input
                                type="text"
                                value={brecha.title}
                                onChange={(e) => handleBrechaChange(brecha.id, 'title', e.target.value)}
                                className="form-input"
                                placeholder={`Ej: Desarrollo del MVP`}
                                required
                            />
                        </div>
                        <div className="brecha-item">
                            <label className="form-label">
                                Monto ($) <span className="required-star">*</span>
                            </label>
                            <input
                                type="number"
                                value={brecha.monto}
                                onChange={(e) => handleBrechaChange(brecha.id, 'monto', e.target.value)}
                                className="form-input"
                                min="1"
                                step="1"
                                placeholder="0"
                                required
                            />
                        </div>
                        <div className="brecha-actions">
                            {brechas.length > 1 && (
                                <button 
                                    type="button" 
                                    onClick={() => removeBrecha(brecha.id)} 
                                    className="remove-button"
                                    title="Eliminar brecha"
                                >
                                    <FaTrash />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <button type="button" onClick={addBrecha} className="add-button">
                <FaPlus />
                Agregar objetivo
            </button>

            <div className="meta-total-box">
                <div className="meta-total-label">Meta total del proyecto</div>
                <div className="meta-total-amount">${metaTotal.toLocaleString()}</div>
            </div>

            <div className="button-group">
                <button type="button" onClick={onBack} className="nav-button back-button">
                    ← Anterior
                </button>
                <button type="submit" className="nav-button next-button">
                    Siguiente →
                </button>
            </div>
        </form>
    );
};

export default Step2Financing;