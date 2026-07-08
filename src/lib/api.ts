// DONE: Paso 11.2 - cliente API: base URL de env, Bearer token automático,
// 401 → limpia sesión y redirige a /login, errores del backend legibles
import { clearSession, getSession } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** FormData (import Excel): no fijar Content-Type, el browser pone el boundary */
  formData?: FormData;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  if (!opts.formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });

  // 401 en el LOGIN = credenciales malas (mostrar el mensaje real del backend);
  // 401 en cualquier otra ruta = sesión vencida (limpiar y volver al login)
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Sesión expirada — vuelve a iniciar sesión');
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(data?.message) ? data.message.join(' · ') : data?.message;
    throw new ApiError(res.status, msg ?? `Error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Descargas binarias (Excel de producción/liquidación/plantilla) */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const session = getSession();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, `No se pudo descargar (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
