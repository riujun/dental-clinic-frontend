// DONE: Paso 11.5c - panel de plataforma (solo super_admin): crear clínicas con
// su subdominio y entregar la contraseña temporal UNA sola vez
'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fmtDate } from '@/lib/types';

interface Tenant {
  _id: string; name: string; subdomain: string;
  status: 'active' | 'suspended'; contactEmail?: string; createdAt: string;
}
interface Provisioned {
  tenant: Tenant;
  loginUrl: string;
  temporaryPassword?: string;
  admin: { email: string };
}

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

export default function PlataformaPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setTenants(await api<Tenant[]>('/admin/tenants'));
  }, []);
  useEffect(() => { void load().catch(() => null); }, [load]);

  async function setStatus(t: Tenant) {
    if (t.status === 'active' &&
        !confirm(`¿Suspender "${t.name}"? Sus usuarios NO podrán iniciar sesión hasta reactivarla.`)) {
      return;
    }
    setError(null);
    try {
      await api(`/admin/tenants/${t._id}/status`, {
        method: 'PATCH',
        body: { status: t.status === 'active' ? 'suspended' : 'active' },
      });
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Clínicas (plataforma)</h1>
      {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <NuevaClinicaForm onCreated={load} />

      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Clínica</th><th className="px-4 py-3">Dominio de acceso</th>
              <th className="px-4 py-3">Contacto</th><th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin clínicas aún</td></tr>
            ) : tenants.map((t) => (
              <tr key={t._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-semibold">{t.name}</td>
                <td className="px-4 py-2 font-mono text-sky-700">{t.subdomain}.tuapp.com</td>
                <td className="px-4 py-2">{t.contactEmail ?? '—'}</td>
                <td className="px-4 py-2">{fmtDate(t.createdAt)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {t.status === 'active' ? 'Activa' : 'Suspendida'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => void setStatus(t)} className="text-xs text-sky-600 hover:underline">
                    {t.status === 'active' ? 'Suspender' : 'Reactivar'}
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

function NuevaClinicaForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [f, setF] = useState({ name: '', subdomain: '', adminEmail: '', adminFullName: '' });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Provisioned | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null); setResult(null);
    try {
      const r = await api<Provisioned>('/admin/tenants', { method: 'POST', body: f });
      setResult(r);
      setF({ name: '', subdomain: '', adminEmail: '', adminFullName: '' });
      await onCreated();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 rounded-xl bg-white p-5 shadow">
      <h2 className="font-semibold text-sky-800">Crear clínica</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-sm">Nombre *
          <input required className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="text-sm">Subdominio * (a-z, 0-9, -)
          <input required className={input} placeholder="sonrisas" value={f.subdomain}
            onChange={(e) => setF({ ...f, subdomain: e.target.value.toLowerCase() })} />
        </label>
        <label className="text-sm">Email del admin *
          <input required type="email" className={input} value={f.adminEmail}
            onChange={(e) => setF({ ...f, adminEmail: e.target.value })} />
        </label>
        <label className="text-sm">Nombre del admin *
          <input required className={input} value={f.adminFullName}
            onChange={(e) => setF({ ...f, adminFullName: e.target.value })} />
        </label>
      </div>

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="mt-3 rounded-lg border-2 border-emerald-400 bg-emerald-50 p-4 text-sm">
          <p className="font-bold text-emerald-800">✔ Clínica creada — entregar estos datos al cliente:</p>
          <p className="mt-1">Acceso: <b className="font-mono">{result.loginUrl}</b></p>
          <p>Usuario: <b>{result.admin.email}</b></p>
          {result.temporaryPassword && (
            <p>Contraseña temporal: <b className="font-mono text-lg">{result.temporaryPassword}</b>{' '}
              <span className="text-red-600">(se muestra UNA sola vez — guárdala ahora)</span></p>
          )}
        </div>
      )}

      <button type="submit" className="mt-3 rounded bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700">
        Crear clínica
      </button>
    </form>
  );
}
