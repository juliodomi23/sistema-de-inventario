export const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount ?? 0);

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const normalized = /Z|[+-]\d{2}:?\d{2}$/.test(dateString) ? dateString : dateString + 'Z';
  return new Date(normalized).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  });
};
