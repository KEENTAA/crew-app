import React from 'react';
import { FaClipboardCheck, FaCheckCircle, FaWallet } from 'react-icons/fa';
import './CreateProjectStyles.css';

const Step3Confirm = ({ data, onPublish, onBack, loading, stepIcon }) => {
    const imageSource = data.imageFile || null;

    const getShortDescription = (description) => {
        if (!description) return 'Sin descripción';
        if (description.length <= 200) return description;
        return description.substring(0, 200) + '...';
    };

    return (
        <div className="create-project-form">
            <div className="section-header">
                <h2 className="section-title">
                    {stepIcon || <FaClipboardCheck className="section-icon" />}
                    Confirmar Publicación
                </h2>
                <p className="section-subtitle">
                    Revisa toda la información antes de publicar tu proyecto. ¡Estás a un paso de hacerlo realidad!
                </p>
            </div>

            <div className="confirmation-box">
                {imageSource && (
                    <img src={imageSource} alt="Vista previa del proyecto" className="confirmation-image" />
                )}
                
                <h3 className="confirmation-title">{data.title || 'Sin título'}</h3>
                <p className="confirmation-description">
                    {getShortDescription(data.description)}
                </p>

                <div className="meta-total-box" style={{ margin: '20px 0' }}>
                    <div className="meta-total-label">Meta total de financiación</div>
                    <div className="meta-total-amount">${data.metaTotal?.toLocaleString() || '0'}</div>
                </div>
                
                <h4 style={{ margin: '25px 0 15px 0', color: '#333', fontSize: '1.2rem' }}>
                    Objetivos de Financiación
                </h4>
                
                <div className="brechas-list">
                    {data.brechas?.map((brecha, index) => (
                        <div key={brecha.id || index} className="brecha-item-confirm">
                            <span className="brecha-title">{brecha.title || `Objetivo ${index + 1}`}</span>
                            <span className="brecha-amount">${Number(brecha.monto || 0).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="disclaimer-box">
                <div className="disclaimer-title">
                    <FaCheckCircle />
                    Información importante
                </div>
                <p className="disclaimer-text">
                    Al publicar tu proyecto, se creará automáticamente un wallet seguro donde se acumularán las donaciones. 
                    Solo podrás retirar los fondos una vez que se alcance la meta total del proyecto.
                </p>
            </div>

            <div className="button-group">
                <button 
                    type="button" 
                    onClick={onBack} 
                    className="nav-button back-button" 
                    disabled={loading}
                >
                    ← Anterior
                </button>
                <button 
                    onClick={onPublish} 
                    className="nav-button publish-button" 
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <div className="spinner"></div>
                            Publicando...
                        </>
                    ) : (
                        <>
                            <FaWallet />
                            Publicar Proyecto
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default Step3Confirm;