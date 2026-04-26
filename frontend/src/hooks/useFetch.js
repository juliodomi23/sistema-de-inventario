import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';

/**
 * Hook para GET requests con loading/error state y AbortController automático.
 * Cancela la request en curso si el componente se desmonta o si cambian las deps.
 *
 * @param {string} url - Endpoint relativo (ej: '/api/products')
 * @param {Array}  deps - Dependencias adicionales (misma API que useEffect)
 * @returns {{ data, loading, error, refetch }}
 */
export function useFetch(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    api.get(url, { signal: ctrl.signal })
      .then(r => setData(r.data))
      .catch(err => {
        // Ignorar cancelaciones — son limpiezas normales, no errores reales
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setError(err);
        }
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, ...deps]);

  return { data, loading, error, refetch };
}
