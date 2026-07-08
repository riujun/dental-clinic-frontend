// DONE: Paso 11.2 - sesión del lado cliente (token JWT + usuario)
// TODO: pendiente Fase 2 - migrar a cookies httpOnly + refresh tokens
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'doctor' | 'receptionist' | 'assistant';
  tenantId: string;
  /** Nombre de la clínica — usado en las plantillas de mensajes ({clinica}) */
  tenantName?: string;
  professionalId?: string;
}

export interface Session {
  accessToken: string;
  user: SessionUser;
}

const TOKEN_KEY = 'dental.token';
const USER_KEY = 'dental.user';

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!accessToken || !rawUser) return null;
  try {
    return { accessToken, user: JSON.parse(rawUser) as SessionUser };
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
