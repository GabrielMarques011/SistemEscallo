/**
 * Converte segundos para formato de tempo legível (HH:MM:SS ou MM:SS)
 * @param {number|string} seconds - Segundos a serem convertidos
 * @returns {string} Tempo formatado
 */
export const formatTMA = (seconds) => {
  if (!seconds && seconds !== 0) return '00:00';
  
  // Converte para número
  const secs = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
  
  // Se for NaN ou menor que 0, retorna 00:00
  if (isNaN(secs) || secs < 0) return '00:00';
  
  // Calcula horas, minutos e segundos
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const remainingSeconds = Math.floor(secs % 60);
  
  // Formata para HH:MM:SS se houver horas, senão MM:SS
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Converte segundos para minutos arredondados
 * @param {number|string} seconds - Segundos a serem convertidos
 * @returns {string} Minutos formatados
 */
export const formatToMinutes = (seconds) => {
  if (!seconds && seconds !== 0) return '0';
  
  const secs = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
  
  if (isNaN(secs) || secs < 0) return '0';
  
  // Converte para minutos e arredonda
  const minutes = Math.round(secs / 60 * 100) / 100; // 2 casas decimais
  
  // Se for menos de 0.1 minutos, mostra em segundos
  if (minutes < 0.1) {
    return `${Math.round(secs)}s`;
  }
  
  // Se for menos de 1 minuto, mostra com 1 casa decimal
  if (minutes < 1) {
    return `${minutes.toFixed(1)}min`;
  }
  
  // Remove .0 se for inteiro
  const roundedMinutes = Math.round(minutes);
  if (roundedMinutes === minutes) {
    return `${roundedMinutes}min`;
  }
  
  return `${minutes.toFixed(1)}min`;
};

/**
 * Formata o tempo de login/pausa (que está em segundos)
 * @param {number|string} seconds - Segundos a serem formatados
 * @returns {string} Tempo formatado
 */
export const formatTimeFromSeconds = (seconds) => {
  if (!seconds && seconds !== 0) return '00:00';
  
  const secs = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
  
  if (isNaN(secs) || secs < 0) return '00:00';
  
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};