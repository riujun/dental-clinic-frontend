// DONE: Paso 11.5c - comisiones (HU-C2): generar liquidación por doctor/periodo,
// cerrar → pagar, y descargar el Excel de la lista congelada
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, apiDownload } from '@/lib/api';
import { fmtDate, fmtMoney, Professional } from '@/lib/types';

interface Settlement {
  _id: string; providerId: string; periodFrom: string; periodTo: string;
  totalProduction: number; totalCommission: number;
  procedureIds: string[]; status: 'draft' | 'closed' | 'paid';
}

const STATUS_LABELS = { draft: 'Borrador', closed: 'Cerrada', paid: 'Pagada' };
const STATUS_STYLES = {
  draft: 'bg-slate-200 text-slate-700',
  closed: 'bg-sky-100 text-sky-800',
  paid: 'bg-emerald-100 text-emerald-800',
};

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export default function ComisionesPage() {
  const [doctors, setDoctors] = useState<Professional[]>([]);
  const [providerId, setProviderId] = useState('');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Professional[]>('/professionals').then((ds) => {
      setDoctors(ds);
      if (ds.length > 0) setProviderId((prev) => prev || ds[0]._id);
    });
  }, []);

  const load = useCallback(async () => {
    setSettlements(await api<Settlement[]>('/commissions/settlements'));
  }, []);
  useEffect(() => { void load().catch(() => null); }, [load]);

  const doctorName = (id: string) => doctors.find((d) => d._id === id)?.fullName ?? '…';

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Comisiones / Liquidaciones</h1>
      {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-white p-5 shadow">
        <label className="text-sm">Doctor
          <select className={input} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            {doctors.map((d) => <option key={d._id} value={d._id}>{d.fullName}</option>)}
          </select>
        </label>
        <label className="text-sm">Desde
          <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">Hasta
          <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button
          onClick={() => void run(() => api('/commissions/settlements', {
            method: 'POST',
            body: { providerId, from: `${from}T00:00:00`, to: `${to}T23:59:59` },
          }))}
          className="rounded bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700">
          Generar liquidación
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Doctor</th><th className="px-4 py-3">Periodo</th>
              <th className="px-4 py-3">Procs.</th><th className="px-4 py-3 text-right">Producción</th>
              <th className="px-4 py-3 text-right">Comisión</th><th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {settlements.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Sin liquidaciones aún</td></tr>
            ) : settlements.map((s) => (
              <tr key={s._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-semibold">{doctorName(s.providerId)}</td>
                <td className="px-4 py-2">{fmtDate(s.periodFrom)} — {fmtDate(s.periodTo)}</td>
                <td className="px-4 py-2">{s.procedureIds.length}</td>
                <td className="px-4 py-2 text-right">${fmtMoney(s.totalProduction)}</td>
                <td className="px-4 py-2 text-right font-bold text-emerald-700">${fmtMoney(s.totalCommission)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[s.status]}`}>
                    {STATUS_LABELS[s.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-xs">
                  {s.status === 'draft' && (
                    <button onClick={() => void run(() => api(`/commissions/settlements/${s._id}/close`, { method: 'POST' }))}
                      className="rounded bg-sky-600 px-2 py-1 text-white hover:bg-sky-700">Cerrar</button>
                  )}
                  {s.status === 'closed' && (
                    <button onClick={() => void run(() => api(`/commissions/settlements/${s._id}/pay`, { method: 'POST' }))}
                      className="rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700">Marcar pagada</button>
                  )}
                  <button
                    onClick={() => void apiDownload(`/commissions/settlements/${s._id}/export.xlsx`, 'liquidacion.xlsx')}
                    className="ml-1 rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100">
                    ⬇ Excel
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
