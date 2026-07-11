// DONE: Paso 11.5c - caja diaria / Day Sheet (Módulo 8.2): cobros del día por
// método + detalle + producción del día
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dayRangeISO, todayLocal } from '@/lib/dates';
import { fetchPatientNames } from '@/lib/lookups';
import { fmtMoney, fmtTime } from '@/lib/types';

interface Daily {
  date: string;
  collections: {
    total: number;
    byMethod: { method: string; total: number; count: number }[];
    payments: { _id: string; patientId: string; amount: number; method: string; paidAt: string }[];
  };
  production: { total: number; count: number };
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', check: 'Cheque', other: 'Otro',
};

export default function CajaPage() {
  const [date, setDate] = useState(todayLocal());
  const [daily, setDaily] = useState<Daily | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const { from, to } = dayRangeISO(date);
    api<Daily>(`/cash-register/daily?from=${from}&to=${to}`).then(async (d) => {
      setDaily(d);
      setNames(await fetchPatientNames(d.collections.payments.map((p) => p.patientId)));
    }).catch(() => setDaily(null));
  }, [date]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Caja diaria</h1>
        <label className="text-sm">Día
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
        </label>
      </div>

      {daily && (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-white p-4 text-center shadow">
              <p className="text-xs text-slate-500">Total cobrado</p>
              <p className="text-3xl font-bold text-emerald-700">${fmtMoney(daily.collections.total)}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs text-slate-500">Por método de pago</p>
              {daily.collections.byMethod.length === 0 ? (
                <p className="mt-2 text-slate-400">Sin cobros</p>
              ) : daily.collections.byMethod.map((m) => (
                <p key={m.method} className="mt-1 flex justify-between text-sm">
                  <span>{METHOD_LABELS[m.method] ?? m.method} ({m.count})</span>
                  <b>${fmtMoney(m.total)}</b>
                </p>
              ))}
            </div>
            <div className="rounded-xl bg-white p-4 text-center shadow">
              <p className="text-xs text-slate-500">Producción del día</p>
              <p className="text-3xl font-bold text-sky-700">${fmtMoney(daily.production.total)}</p>
              <p className="text-xs text-slate-400">{daily.production.count} procedimientos</p>
            </div>
          </div>

          <h2 className="mt-6 font-semibold text-slate-700">Detalle de cobros</h2>
          <div className="mt-2 overflow-hidden rounded-xl bg-white shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Hora</th><th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Método</th><th className="px-4 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {daily.collections.payments.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Sin cobros este día</td></tr>
                ) : daily.collections.payments.map((p) => (
                  <tr key={p._id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono">{fmtTime(p.paidAt)}</td>
                    <td className="px-4 py-2">{names[p.patientId] ?? '…'}</td>
                    <td className="px-4 py-2">{METHOD_LABELS[p.method] ?? p.method}</td>
                    <td className="px-4 py-2 text-right font-semibold">${fmtMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
