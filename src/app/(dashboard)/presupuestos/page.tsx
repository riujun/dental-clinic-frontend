// DONE: Paso 11.5b - lista de presupuestos con estado y total
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fetchPatientNames } from '@/lib/lookups';
import { fmtDate, fmtMoney, PLAN_LABELS, PLAN_STYLES } from '@/lib/types';

interface PlanRow {
  _id: string;
  patientId: string;
  title?: string;
  status: string;
  total: number;
  isActive: boolean;
  items: unknown[];
  createdAt: string;
}

export default function PresupuestosPage() {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    api<PlanRow[]>('/treatment-plans').then(async (list) => {
      setPlans(list);
      setNames(await fetchPatientNames(list.map((p) => p.patientId)));
    }).catch(() => setPlans([]));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Presupuestos</h1>
        <Link href="/presupuestos/nuevo"
          className="rounded bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700">
          + Nuevo presupuesto
        </Link>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Ítems</th>
              <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {!plans ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>
            ) : plans.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin presupuestos aún</td></tr>
            ) : plans.map((p) => (
              <tr key={p._id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-4 py-3">{names[p.patientId] ?? '…'}</td>
                <td className="px-4 py-3">
                  <Link href={`/presupuestos/${p._id}`} className="font-semibold text-sky-700 hover:underline">
                    {p.title ?? 'Plan'}{p.isActive ? '' : ' (inactivo)'}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PLAN_STYLES[p.status]}`}>
                    {PLAN_LABELS[p.status] ?? p.status}
                  </span>
                </td>
                <td className="px-4 py-3">{p.items.length}</td>
                <td className="px-4 py-3 text-right font-semibold">${fmtMoney(p.total)}</td>
                <td className="px-4 py-3">{fmtDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
