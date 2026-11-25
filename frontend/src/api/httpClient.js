import { limpiarSesion, refrescarAccessToken } from './client';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}, reintentar = true) {
  const { body, headers, ...rest } = options;
  const token = localStorage.getItem('access_token');

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && token && reintentar) {
    const renovado = await refrescarAccessToken();
    if (renovado) return request(path, options, false);
    limpiarSesion();
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || (payload && payload.success === false)) {
    const message = payload?.message || `Error HTTP ${response.status}`;
    throw new ApiError(message, response.status, payload?.error?.details ?? null);
  }

  return payload;
}

export const httpClient = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
};
