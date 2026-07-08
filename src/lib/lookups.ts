// DONE: Paso 11.5b - lookup de nombres de pacientes por id (agenda, presupuestos)
// DONE: Comunicaciones Etapa A - también teléfono (para enlaces de WhatsApp)
import { api } from './api';
import { Patient } from './types';

export interface PatientInfo {
  name: string;
  firstName: string;
  phone?: string;
}

export async function fetchPatientInfo(ids: string[]): Promise<Record<string, PatientInfo>> {
  const unique = [...new Set(ids)];
  const entries = await Promise.all(
    unique.map(async (id) => {
      try {
        const p = await api<{ patient: Patient }>(`/patients/${id}`);
        return [id, {
          name: `${p.patient.lastName}, ${p.patient.firstName}`,
          firstName: p.patient.firstName,
          phone: p.patient.phone,
        }] as const;
      } catch {
        return [id, { name: '(paciente)', firstName: 'paciente' }] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export async function fetchPatientNames(ids: string[]): Promise<Record<string, string>> {
  const info = await fetchPatientInfo(ids);
  return Object.fromEntries(Object.entries(info).map(([id, i]) => [id, i.name]));
}
