// DONE: Paso 11.5b - detalle del presupuesto: máquina de estados (HU-B2) y
// completar ítems indicando doctor → crea ProcedureInstance y el plan avanza solo
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fetchPatientNames } from '@/lib/lookups';
import { fmtDate, fmtMoney, PLAN_LABELS, PLAN_STYLES, Professional } from '@/lib/types';

interface PlanItem {
  _id: string; code: string; description: string; toothFdi?: string;
  unitPrice: number; quantity: number; discount: number; subtotal: number;
  priority: number; status: 'planned' | 'completed' | 'cancelled';
}
interface Plan {
  _id: string; patientId: string; title?: string; status: string; isActive: boolean;
  items: PlanItem[]; subtotal: number; totalDiscount: number; total: number;
  presentedAt?: string; acceptedAt?: string; createdAt: string;
}

export default function PresupuestoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [patientName, setPatientName] = useState('');
  const [doctors, setDoctors] = useState<Professional[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = await api<Plan>(`/treatment-plans/${id}`);
    setPlan(p);
    setPatientName((await fetchPatientNames([p.patientId]))[p.patientId]);
  }, [id]);

  useEffect(() => {
    void load().catch((e) => setError(String(e)));
    api<Professional[]>('/professionals').then((ds) => {
      setDoctors(ds);
      if (ds.length > 0) setDoctorId((prev) => prev || ds[0]._id);
    });
  }, [load]);

  async function changeStatus(status: string) {
    setError(null);
    try {
      await api(`/treatment-plans/${id}/status`, { method: 'POST', body: { status } });
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  async function completeItem(itemId: string) {
    setError(null);
    if (!doctorId) { setError('Selecciona el doctor que realizó el procedimiento'); return; }
    try {
      await api(`/treatment-plans/${id}/items/${itemId}/complete`, {
        method: 'POST',
        body: { performedByProviderId: doctorId },
      });
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  if (error && !plan) return <p className="text-red-600">{error}</p>;
  if (!plan) return <p className="text-slate-400">Cargando…</p>;

  const canExecute = plan.status === 'ACCEPTED' || plan.status === 'IN_PROGRESS';

  return (
    <div className="max-w-4xl">
      <Link href="/presupuestos" className="print:hidden text-sm text-sky-600 hover:underline">
        ← Volver a presupuestos
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{plan.title ?? 'Presupuesto'}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${PLAN_STYLES[plan.status]}`}>
          {PLAN_LABELS[plan.status] ?? plan.status}
        </span>
        {!plan.isActive && <span className="text-sm text-slate-400">(plan inactivo)</span>}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Paciente: <b>{patientName || '…'}</b> · Creado {fmtDate(plan.createdAt)}
        {plan.presentedAt && ` · Presentado ${fmtDate(plan.presentedAt)}`}
        {plan.acceptedAt && ` · Aceptado ${fmtDate(plan.acceptedAt)}`}
      </p>

      {/* Acciones de la máquina de estados */}
      <div className="print:hidden mt-3 flex flex-wrap gap-2">
        {/* HU-B2: imprimir/guardar como PDF desde el navegador */}
        <button onClick={() => window.print()}
          className="rounded border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          🖨 Imprimir / PDF
        </button>
        {plan.status === 'DRAFT' && (
          <button onClick={() => void changeStatus('PRESENTED')}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Presentar al paciente
          </button>
        )}
        {plan.status === 'PRESENTED' && (
          <>
            <button onClick={() => void changeStatus('ACCEPTED')}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Marcar ACEPTADO
            </button>
            <button onClick={() => void changeStatus('REJECTED')}
              className="rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">
              Marcar RECHAZADO
            </button>
          </>
        )}
        {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(plan.status) && (
          <button
            onClick={() => {
              if (confirm('¿Cancelar este presupuesto? Esta acción no se puede deshacer.')) {
                void changeStatus('CANCELLED');
              }
            }}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            Cancelar plan
          </button>
        )}
      </div>

      {canExecute && (
        <div className="print:hidden mt-3 flex items-end gap-2 rounded-lg bg-emerald-50 p-3 text-sm">
          <label>Doctor que realiza:
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}
              className="ml-2 rounded border border-slate-300 px-2 py-1">
              {doctors.map((d) => <option key={d._id} value={d._id}>{d.fullName}</option>)}
            </select>
          </label>
          <span className="text-slate-500">→ usa &quot;Completar&quot; en cada ítem realizado</span>
        </div>
      )}

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Pri.</th><th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descripción</th><th className="px-4 py-3">Diente</th>
              <th className="px-4 py-3">Cant.</th><th className="px-4 py-3 text-right">Subtotal</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {plan.items.map((i) => (
              <tr key={i._id} className="border-t border-slate-100">
                <td className="px-4 py-2">{i.priority}</td>
                <td className="px-4 py-2 font-mono">{i.code}</td>
                <td className="px-4 py-2">{i.description}</td>
                <td className="px-4 py-2">{i.toothFdi ?? '—'}</td>
                <td className="px-4 py-2">{i.quantity}</td>
                <td className="px-4 py-2 text-right">${fmtMoney(i.subtotal)}</td>
                <td className="px-4 py-2">
                  {{ planned: '⬜ Planificado', completed: '✅ Realizado', cancelled: '❌ Cancelado' }[i.status]}
                </td>
                <td className="px-4 py-2 text-right">
                  {canExecute && i.status === 'planned' && (
                    <button onClick={() => void completeItem(i._id)}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                      Completar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
              <td colSpan={5} className="px-4 py-2 text-right">
                Subtotal ${fmtMoney(plan.subtotal)} · Desc. ${fmtMoney(plan.totalDiscount)} · TOTAL
              </td>
              <td className="px-4 py-2 text-right">${fmtMoney(plan.total)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
