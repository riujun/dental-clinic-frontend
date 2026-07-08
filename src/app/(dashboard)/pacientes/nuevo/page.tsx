// DONE: Paso 11.5 - alta de paciente (HU-P1: nombre y apellido obligatorios,
// anamnesis parcial permitida; documento duplicado → el backend responde 409)
'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Patient } from '@/lib/types';

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

export default function NuevoPacientePage() {
  const router = useRouter();
  const [f, setF] = useState({
    firstName: '', lastName: '', documentType: 'DNI', documentNumber: '',
    birthDate: '', sex: '', email: '', phone: '',
    allergies: '', medications: '', conditions: '',
    bisphosphonates: false, requiresPremedication: false, isPregnant: false,
    smoker: 'no', freeNotes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: unknown) => setF((prev) => ({ ...prev, [k]: v }));
  const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await api<Patient>('/patients', {
        method: 'POST',
        body: {
          firstName: f.firstName, lastName: f.lastName,
          documentType: f.documentType || undefined,
          documentNumber: f.documentNumber || undefined,
          birthDate: f.birthDate || undefined,
          sex: f.sex || undefined,
          email: f.email || undefined,
          phone: f.phone || undefined,
          medicalHistory: {
            allergies: csv(f.allergies).map((substance) => ({ substance })),
            medications: csv(f.medications).map((name) => ({ name })),
            conditions: csv(f.conditions),
            bisphosphonates: f.bisphosphonates,
            requiresPremedication: f.requiresPremedication,
            isPregnant: f.isPregnant,
            smoker: f.smoker,
            freeNotes: f.freeNotes || undefined,
          },
        },
      });
      router.push(`/pacientes/${created._id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-800">Nuevo paciente</h1>

      <section className="mt-4 rounded-xl bg-white p-5 shadow">
        <h2 className="font-semibold text-sky-800">Datos personales</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <label className="text-sm">Nombre *
            <input required className={input} value={f.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </label>
          <label className="text-sm">Apellido *
            <input required className={input} value={f.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </label>
          <label className="text-sm">Tipo doc.
            <select className={input} value={f.documentType} onChange={(e) => set('documentType', e.target.value)}>
              <option>DNI</option><option>CI</option><option>RUT</option><option>Pasaporte</option>
            </select>
          </label>
          <label className="text-sm">N° documento
            <input className={input} value={f.documentNumber} onChange={(e) => set('documentNumber', e.target.value)} />
          </label>
          <label className="text-sm">Nacimiento
            <input type="date" className={input} value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
          </label>
          <label className="text-sm">Sexo
            <select className={input} value={f.sex} onChange={(e) => set('sex', e.target.value)}>
              <option value="">—</option><option value="F">F</option><option value="M">M</option>
              <option value="X">X</option><option value="ND">Prefiere no decir</option>
            </select>
          </label>
          <label className="text-sm">Email
            <input type="email" className={input} value={f.email} onChange={(e) => set('email', e.target.value)} />
          </label>
          <label className="text-sm">Teléfono (+56…)
            <input className={input} value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="mt-4 rounded-xl bg-white p-5 shadow">
        <h2 className="font-semibold text-sky-800">Anamnesis (puede completarse después)</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm">Alergias (separadas por coma)
            <input className={input} placeholder="penicilina, látex" value={f.allergies} onChange={(e) => set('allergies', e.target.value)} />
          </label>
          <label className="text-sm">Medicamentos (coma)
            <input className={input} value={f.medications} onChange={(e) => set('medications', e.target.value)} />
          </label>
          <label className="text-sm">Condiciones (coma)
            <input className={input} placeholder="hipertensión, diabetes" value={f.conditions} onChange={(e) => set('conditions', e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.bisphosphonates} onChange={(e) => set('bisphosphonates', e.target.checked)} />
            Bifosfonatos
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.requiresPremedication} onChange={(e) => set('requiresPremedication', e.target.checked)} />
            Requiere premedicación
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.isPregnant} onChange={(e) => set('isPregnant', e.target.checked)} />
            Embarazo
          </label>
          <label className="flex items-center gap-2">
            Fumador:
            <select className="rounded border border-slate-300 px-2 py-1" value={f.smoker} onChange={(e) => set('smoker', e.target.value)}>
              <option value="no">No</option><option value="current">Sí</option><option value="former">Ex fumador</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm">Notas
          <textarea className={input} rows={2} value={f.freeNotes} onChange={(e) => set('freeNotes', e.target.value)} />
        </label>
      </section>

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex gap-3">
        <button type="submit" disabled={saving}
          className="rounded bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar paciente'}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded px-4 py-2 text-slate-500 hover:bg-slate-200">
          Cancelar
        </button>
      </div>
    </form>
  );
}
