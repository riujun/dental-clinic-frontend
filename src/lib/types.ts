// DONE: Paso 11.5 - tipos del API (espejo de los schemas del backend)
export interface MedicalHistory {
  allergies?: { substance: string; reaction?: string; severity?: string }[];
  medications?: { name: string; dose?: string; frequency?: string }[];
  conditions?: string[];
  bisphosphonates?: boolean;
  requiresPremedication?: boolean;
  isPregnant?: boolean;
  smoker?: 'no' | 'current' | 'former';
  lastMedicalReview?: string;
  freeNotes?: string;
}

export interface Address {
  street?: string; city?: string; state?: string; zip?: string; country?: string;
}
export interface EmergencyContact {
  name?: string; phone?: string; relation?: string;
}

export const TOOTH_CONDITIONS = [
  'ausente', 'cariado', 'obturado', 'corona', 'implante', 'endodoncia',
  'protesis_fija', 'protesis_removible', 'fracturado', 'extraccion_indicada', 'otro',
] as const;
export type ToothConditionValue = (typeof TOOTH_CONDITIONS)[number];

export const TOOTH_CONDITION_LABELS: Record<ToothConditionValue, string> = {
  ausente: 'Ausente',
  cariado: 'Cariado',
  obturado: 'Obturado',
  corona: 'Corona',
  implante: 'Implante',
  endodoncia: 'Endodoncia previa',
  protesis_fija: 'Prótesis fija',
  protesis_removible: 'Prótesis removible',
  fracturado: 'Fracturado',
  extraccion_indicada: 'Extracción indicada',
  otro: 'Otro',
};

export const TOOTH_CONDITION_SHORT: Record<ToothConditionValue, string> = {
  ausente: '∅',
  cariado: 'Ca',
  obturado: 'Ob',
  corona: 'Co',
  implante: 'Im',
  endodoncia: 'En',
  protesis_fija: 'PF',
  protesis_removible: 'PR',
  fracturado: 'Fr',
  extraccion_indicada: 'Ex',
  otro: '?',
};

export interface ToothCondition {
  toothFdi: string;
  condition: ToothConditionValue;
  notes?: string;
  updatedAt?: string;
}

export interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  documentType?: string;
  documentNumber?: string;
  birthDate?: string;
  sex?: string;
  occupation?: string;
  email?: string;
  phone?: string;
  address?: Address;
  emergencyContact?: EmergencyContact;
  status: 'active' | 'inactive' | 'archived';
  medicalHistory?: MedicalHistory;
  toothConditions?: ToothCondition[];
  createdAt?: string;
}

export interface PatientProfile {
  patient: Patient;
  medicalAlerts: {
    allergies: string[];
    requiresPremedication: boolean;
    bisphosphonates: boolean;
    isPregnant: boolean;
  };
  anamnesisOutdated: boolean;
}

export interface Professional {
  _id: string;
  fullName: string;
  specialties: string[];
  active: boolean;
  color?: string;
}

export interface Appointment {
  _id: string;
  patientId: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  reason?: string;
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  requiredSpecialty?: string;
  lastReminderAt?: string;
}

export const WAITLIST_STATUSES = ['waiting', 'contacted', 'scheduled', 'cancelled'] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  waiting: '⏳ Esperando',
  contacted: '📞 Contactado',
  scheduled: '✅ Agendado',
  cancelled: '✕ Cancelado',
};

export interface WaitlistEntry {
  _id: string;
  patientId: string;
  professionalId?: string;
  reason?: string;
  notes?: string;
  preferredFrom?: string;
  preferredTo?: string;
  status: WaitlistStatus;
  resolvedAppointmentId?: string;
  createdAt?: string;
}

export interface TreatmentPlan {
  _id: string;
  title?: string;
  status: string;
  total: number;
  items: { code: string; description: string; status: string; subtotal: number }[];
  createdAt: string;
}

export interface ProcedureRow {
  _id: string;
  code: string;
  description: string;
  toothFdi?: string;
  value: number;
  status: string;
  completedAt?: string;
  clinicalNote?: string;
  clinicalNoteAt?: string;
}

export interface AccountStatement {
  totalCharges: number;
  totalPayments: number;
  balance: number;
  charges: { date?: string; code: string; description: string; value: number; isRefund: boolean }[];
  payments: { date: string; method: string; amount: number }[];
}

export const PLAN_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PRESENTED: 'Presentado', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado',
  IN_PROGRESS: 'En ejecución', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};

export const PLAN_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-200 text-slate-700', PRESENTED: 'bg-sky-100 text-sky-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-emerald-200 text-emerald-900',
  CANCELLED: 'bg-red-100 text-red-700',
};

export const APPT_STATUS_LABELS: Record<Appointment['status'], string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  completed: 'Atendida',
  cancelled: 'Cancelada',
  no_show: 'No vino',
};

/** Simbología de estados (pedido de Fabián: iconos + colores + leyenda) */
export const APPT_STATUS_ICONS: Record<Appointment['status'], string> = {
  scheduled: '🕐',
  confirmed: '✔️',
  completed: '✅',
  cancelled: '✖️',
  no_show: '🚫',
};

/** "carolina ponce" → "Carolina Ponce" — nombres bien escritos en pantalla y
 *  en los mensajes de WhatsApp (pedido de Fabián) */
export function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** "carolina" → "Dr(a). Carolina" — prefijo genérico ya que no registramos
 *  género/título formal del profesional */
export function withDrPrefix(name: string): string {
  const clean = titleCase(name.replace(/^dr\.?a?\.?\s+/i, ''));
  return `Dr(a). ${clean}`;
}

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(n);

export const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('es-CL') : '—');

export const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
