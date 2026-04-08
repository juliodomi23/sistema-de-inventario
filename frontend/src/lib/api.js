import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
if (!API_URL) {
  throw new Error('REACT_APP_BACKEND_URL no está definida');
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
