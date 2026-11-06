import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

let refreshRequest;

export async function withAuthRefresh(request) {
  try {
    return await request();
  } catch (error) {
    if (error.response?.status !== 401) throw error;

    refreshRequest ??= api.post('/auth/refresh').finally(() => {
      refreshRequest = undefined;
    });
    await refreshRequest;
    return request();
  }
}

export function getApiErrorMessage(error, fallback) {
  const status = error.response?.status;
  if (status >= 400 && status < 500 && typeof error.response.data?.message === 'string') {
    return error.response.data.message;
  }
  return fallback;
}
