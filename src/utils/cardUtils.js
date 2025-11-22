// src/utils/cardUtils.js

// Función para generar un número de tarjeta de 16 dígitos simulado
const generateCardNumber = () => {
    let prefix = Math.random() < 0.5 ? '4' : '5'; // Visa (4) o Mastercard (5)
    let number = prefix;
    for (let i = 0; i < 15; i++) {
        number += Math.floor(Math.random() * 10);
    }
    return number;
};

// Función para generar una fecha de vencimiento (4 años en el futuro)
const generateExpiryDate = () => {
    const today = new Date();
    const year = (today.getFullYear() + 4).toString().substring(2); 
    const month = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0');
    return `${month}/${year}`; // Formato MM/YY
};

// Función para generar el código de seguridad (CVV/CVC)
const generateCVV = () => {
    return Math.floor(100 + Math.random() * 900).toString(); // Número de 3 dígitos
};

// Función principal para exportar los datos de la tarjeta
export const generateVirtualCard = (userName) => {
    return {
        cardNumber: generateCardNumber(),
        expiryDate: generateExpiryDate(),
        cvv: generateCVV(),
        status: 'Activa',
        nameOnCard: userName
    };
};