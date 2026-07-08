// DONE: Paso 11.5c - equipo: el admin de la clínica agrega a sus doctores
// (usuario + Professional vinculado — requerimiento de onboarding de Fabián)
'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface User {
  _id: string; email: string; fullName: string;
  role: string; active: boolean; professionalId?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador', doctor: 'Doctor/a', receptionist: 'Recepción', assistant: 'Asistente',
};

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

export default function EquipoPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setUsers(await api<User[]>('/users'));
  }, []);
  useEffect(() => { void load().catch(() => null); }, [load]);

  async function toggleActive(u: User) {
    setError(null);
    try {
      await api(`/users/${u._id}`, { method: 'PATCH', body: { active: !u.active } });
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Equipo</h1>
      {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <NuevoUsuarioForm onCreated={load} />

      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-semibold">{u.fullName}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{ROLE_LABELS[u.role] ?? u.role}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {u.active ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => void toggleActive(u)} className="text-xs text-sky-600 hover:underline">
                    {u.active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NuevoUsuarioForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [f, setF] = useState({
    fullName: '', email: '', password: '', role: 'doctor',
    licenseNumber: '', commissionRate: '50',
  });
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(['general']);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    api<string[]>('/professionals/specialties').then(setSpecialties).catch(() => null);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null); setOk(null);
    try {
      await api('/users', {
        method: 'POST',
        body: {
          fullName: f.fullName, email: f.email, password: f.password, role: f.role,
          ...(f.role === 'doctor' ? {
            professional: {
              licenseNumber: f.licenseNumber || undefined,
              specialties: selected,
              commissionRate: Number(f.commissionRate) / 100,
            },
          } : {}),
        },
      });
      setOk(`✔ ${f.fullName} creado — ya puede iniciar sesión con su email`);
      setF({ fullName: '', email: '', password: '', role: 'doctor', licenseNumber: '', commissionRate: '50' });
      setSelected(['general']);
      await onCreated();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 rounded-xl bg-white p-5 shadow">
      <h2 className="font-semibold text-sky-800">Agregar integrante</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-sm">Nombre completo *
          <input required className={input} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
        </label>
        <label className="text-sm">Email *
          <input required type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label className="text-sm">Contraseña * (mín. 8)
          <input required minLength={8} type="password" className={input} value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })} />
        </label>
        <label className="text-sm">Rol
          <select className={input} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      {f.role === 'doctor' && (
        <div className="mt-3 rounded-lg bg-sky-50 p-3">
          <p className="text-sm font-semibold text-sky-800">Datos del profesional (crea su ficha clínica)</p>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-sm">Matrícula
              <input className={input} value={f.licenseNumber} onChange={(e) => setF({ ...f, licenseNumber: e.target.value })} />
            </label>
            <label className="text-sm">% Comisión
              <input type="number" min={0} max={100} className={input} value={f.commissionRate}
                onChange={(e) => setF({ ...f, commissionRate: e.target.value })} />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {specialties.map((s) => (
              <label key={s} className="flex items-center gap-1">
                <input type="checkbox" checked={selected.includes(s)}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, s] : selected.filter((x) => x !== s))} />
                {s}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {ok && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}

      <button type="submit" className="mt-3 rounded bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700">
        Crear usuario
      </button>
    </form>
  );
}
