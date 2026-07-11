// DONE: Paso 11.5b - reporte de producción (HU-R2): filtros fecha/doctor,
// tabla con comisiones y descarga del Excel para liquidaciones
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, apiDownload } from '@/lib/api';
import { dayRangeISO, todayLocal } from '@/lib/dates';
import { fmtDate, fmtMoney, Professional } from '@/lib/types';

interface ProdRow {
  _id: string;
  completedAt: string;
  code: string;
  description: string;
  toothFdi?: string;
  value: number;
  commissionRate?: number;
  commissionAmount?: number;
  patientId?: { firstName?: string; lastName?: string } | null;
  performedByProviderId?: { fullName?: string } | null;
}
interface Report {
  count: number;
  totalProduction: number;
  totalCommission: number;
  rows: ProdRow[];
}

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export default function ProduccionPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayLocal());
  const [doctors, setDoctors] = useState<Professional[]>([]);
  const [providerId, setProviderId] = useState('');
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    api<Professional[]>('/professionals').then(setDoctors).catch(() => null);
  }, []);

  const query = useCallback(() => {
    const { from: f } = dayRangeISO(from);
    const { to: t } = dayRangeISO(to);
    return `from=${f}&to=${t}${providerId ? `&providerId=${providerId}` : ''}`;
  }, [from, to, providerId]);

  useEffect(() => {
    api<Report>(`/reports/production?${query()}`).then(setReport).catch(() => setReport(null));
  }, [query]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Producción</h1>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Desde
            <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">Hasta
            <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="text-sm">Doctor
            <select className={input} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">Todos</option>
              {doctors.map((d) => <option key={d._id} value={d._id}>{d.fullName}</option>)}
            </select>
          </label>
          <button
            onClick={() => void apiDownload(`/reports/production.xlsx?${query()}`, 'produccion.xlsx')}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            ⬇ Descargar Excel
          </button>
        </div>
      </div>

      {report && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500">Procedimientos</p>
            <p className="text-2xl font-bold">{report.count}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500">Producción</p>
            <p className="text-2xl font-bold text-sky-700">${fmtMoney(report.totalProduction)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500">Comisiones</p>
            <p className="text-2xl font-bold text-emerald-700">${fmtMoney(report.totalCommission)}</p>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Doctor</th><th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descripción</th><th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">% Com.</th><th className="px-4 py-3 text-right">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {!report || report.rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                Sin producción en el periodo
              </td></tr>
            ) : report.rows.map((r) => (
              <tr key={r._id} className="border-t border-slate-100">
                <td className="px-4 py-2">{fmtDate(r.completedAt)}</td>
                <td className="px-4 py-2">
                  {r.patientId ? `${r.patientId.lastName ?? ''}, ${r.patientId.firstName ?? ''}` : '—'}
                </td>
                <td className="px-4 py-2">{r.performedByProviderId?.fullName ?? '—'}</td>
                <td className="px-4 py-2 font-mono">{r.code}</td>
                <td className="px-4 py-2">{r.description}</td>
                <td className={`px-4 py-2 text-right ${r.value < 0 ? 'text-red-600' : ''}`}>
                  ${fmtMoney(r.value)}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.commissionRate !== undefined ? `${Math.round(r.commissionRate * 100)}%` : '—'}
                </td>
                <td className={`px-4 py-2 text-right ${(r.commissionAmount ?? 0) < 0 ? 'text-red-600' : ''}`}>
                  ${fmtMoney(r.commissionAmount ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
