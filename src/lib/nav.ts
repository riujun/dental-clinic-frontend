// DONE: Paso 11.4 - navegación por rol (ver docs/auth-multitenancy.md)
import type { SessionUser } from './auth';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Ayuda corta mostrada en el inicio para que cualquier usuario entienda qué hace */
  hint: string;
  roles: SessionUser['role'][];
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Inicio', icon: '🏠', hint: 'Resumen del día', roles: ['admin', 'doctor', 'receptionist', 'assistant'] },
  { href: '/kpis', label: 'Dashboard', icon: '📊', hint: 'Los números de la clínica', roles: ['admin'] },
  { href: '/pacientes', label: 'Pacientes', icon: '🧑‍🤝‍🧑', hint: 'Fichas, anamnesis y alertas médicas', roles: ['admin', 'doctor', 'receptionist', 'assistant'] },
  { href: '/agenda', label: 'Agenda', icon: '📅', hint: 'Citas por día, semana o mes', roles: ['admin', 'doctor', 'receptionist', 'assistant'] },
  { href: '/seguimiento', label: 'Seguimiento', icon: '📞', hint: 'Recontactar cancelados y no-show', roles: ['admin', 'receptionist'] },
  { href: '/presupuestos', label: 'Presupuestos', icon: '📋', hint: 'Planes de tratamiento y su avance', roles: ['admin', 'doctor', 'receptionist'] },
  { href: '/produccion', label: 'Producción', icon: '📈', hint: 'Procedimientos realizados y Excel', roles: ['admin', 'doctor', 'receptionist'] },
  { href: '/pagos', label: 'Pagos', icon: '💳', hint: 'Abonos y estado de cuenta', roles: ['admin', 'receptionist'] },
  { href: '/caja', label: 'Caja diaria', icon: '🧾', hint: 'Cierre del día por método de pago', roles: ['admin', 'receptionist'] },
  { href: '/aranceles', label: 'Aranceles', icon: '💲', hint: 'Listas de precios e import Excel', roles: ['admin'] },
  { href: '/comisiones', label: 'Comisiones', icon: '🤝', hint: 'Liquidaciones por doctor', roles: ['admin'] },
  { href: '/equipo', label: 'Equipo', icon: '👩‍⚕️', hint: 'Doctores y usuarios de la clínica', roles: ['admin'] },
  // Panel de plataforma (solo super_admin)
  { href: '/plataforma', label: 'Clínicas', icon: '🏥', hint: 'Crear y gestionar clínicas', roles: ['super_admin'] },
];

export function navForRole(role: SessionUser['role']): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}
