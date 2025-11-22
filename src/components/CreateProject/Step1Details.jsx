import React, { useState } from 'react';
import { FaLightbulb, FaCloudUploadAlt, FaAsterisk } from 'react-icons/fa';
import './CreateProjectStyles.css';

const Step1Details = ({ data, onNext, stepIcon }) => {
    const [formData, setFormData] = useState({
        title: data.title,
        description: data.description,
        imageFile: data.imageFile,
        tags: data.tags
    });
    const [imagePreview, setImagePreview] = useState(data.imageFile || null);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 800 * 1024) {
                alert("La imagen es demasiado grande. Máximo 800KB.");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                setFormData(prev => ({ ...prev, imageFile: base64String }));
                setImagePreview(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            const inputEvent = {
                target: { files: [file] }
            };
            handleFileChange(inputEvent);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.title.length < 5 || formData.description.length < 20 || !formData.imageFile) {
            alert("Completa el Título, Descripción y sube una Imagen.");
            return;
        }
        onNext(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="create-project-form">
            <div className="section-header">
                <h2 className="section-title">
                    {stepIcon || <FaLightbulb className="section-icon" />}
                    Detalles del Proyecto
                </h2>
                <p className="section-subtitle">
                    Describe tu proyecto de manera clara y atractiva para captar la atención de potenciales donantes.
                </p>
            </div>

            {/* Título */}
            <div className="form-group">
                <label className="form-label">
                    Título del proyecto <span className="required-star">*</span>
                </label>
                <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    maxLength={100}
                    className="form-input"
                    placeholder="Ej: Plataforma educativa con IA para niños"
                    required
                />
                <p className="char-count">{formData.title.length}/100 caracteres</p>
            </div>

            {/* Descripción */}
            <div className="form-group">
                <label className="form-label">
                    Descripción <span className="required-star">*</span>
                </label>
                <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    maxLength={1000}
                    className="form-textarea"
                    placeholder="Describe tu proyecto de forma clara y detallada. Explica el problema que resuelve, tu solución y el impacto que tendrá..."
                    required
                />
                <p className="char-count">{formData.description.length}/1000 caracteres</p>
            </div>

            {/* Imagen del Proyecto */}
            <div className="form-group">
                <label className="form-label">
                    Imagen del proyecto <span className="required-star">*</span>
                </label>
                <div 
                    className={`image-upload-container ${isDragOver ? 'drag-over' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {imagePreview ? (
                        <img src={imagePreview} alt="Vista previa" className="image-preview" />
                    ) : (
                        <div className="image-placeholder">
                            <FaCloudUploadAlt className="upload-icon" />
                            <div>
                                <p style={{ fontWeight: '600', marginBottom: '5px' }}>Haz clic o arrastra una imagen</p>
                                <p style={{ fontSize: '0.9rem', opacity: '0.8' }}>PNG, JPG • Máximo 800KB</p>
                            </div>
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="file-input"
                    />
                </div>
            </div>

            {/* Etiquetas */}
            <div className="form-group">
                <label className="form-label">
                    Etiquetas
                </label>
                <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Ej: educación, IA, tecnología, innovación"
                />
                <p className="char-count">Separa las etiquetas con comas</p>
            </div>

            {/* Botones */}
            <div className="button-group">
                <button type="button" className="nav-button back-button" onClick={() => window.history.back()}>
                    ← Cancelar
                </button>
                <button type="submit" className="nav-button next-button">
                    Siguiente →
                </button>
            </div>
        </form>
    );
};

export default Step1Details;