/**
 * Genera un código aleatorio de 6 caracteres (mayúsculas y números)
 * Ejemplo: "A3B9C2", "X7K4M1"
 */
export const generateCoupleCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

/**
 * Valida que el código tenga el formato correcto
 */
export const isValidCoupleCode = (code: string): boolean => {
  return /^[A-Z0-9]{6}$/.test(code);
};