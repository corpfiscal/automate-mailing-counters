export const getCurrentMonthName = (): string =>
  new Date().toLocaleDateString('es-MX', { month: 'long' });

// Reemplaza caracteres ilegales en filenames (: y .) con guiones
export const getTimestamp = (): string =>
  new Date().toISOString().replace(/[:.]/g, '-');

export const getTodayFormatted = (): string =>
  new Date().toLocaleDateString('es-MX');
