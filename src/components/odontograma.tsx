// DONE: Ideas de mejora #1 - Odontograma FDI interactivo (docs/ideas-mejoras.md)
// Mapa visual de los 32 dientes (notación FDI adulto). Colores:
//   petróleo = con tratamientos REALIZADOS · ámbar = con PLANIFICADOS ·
//   mitad/mitad = ambos · blanco = sin registros. Click → historial del diente.
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/types';

// Cuadrantes FDI como los lee un dentista (derecha del paciente a la izquierda)
const UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

interface ToothRecord {
  date?: string;
  code: string;
  description: string;
  value?: number;
  kind: 'completed' | 'planned';
  source: string; // "Realizado" | "Presupuesto: Plan A"
}

interface ProcedureApi {
  code: string; description: string; toothFdi?: string; value: number;
  status: string; completedAt?: string; createdAt?: string;
}
interface PlanApi {
  title?: string; status: string;
  items: { code: string; description: string; toothFdi?: string; subtotal: number; status: string }[];
}

const ACTIVE_PLAN_STATES = ['DRAFT', 'PRESENTED', 'ACCEPTED', 'IN_PROGRESS'];

export function Odontograma({ patientId }: { patientId: string }) {
  const [byTooth, setByTooth] = useState<Record<string, ToothRecord[]> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [procs, plans] = await Promise.all([
        api<ProcedureApi[]>(`/procedures?patientId=${patientId}`).catch(() => []),
        api<PlanApi[]>(`/treatment-plans?patientId=${patientId}`).catch(() => []),
      ]);
      const map: Record<string, ToothRecord[]> = {};
      const push = (tooth: string | undefined, rec: ToothRecord) => {
        const t = (tooth ?? '').trim();
        if (!/^\d{2}$/.test(t)) return; // solo dientes FDI puntuales
        (map[t] = map[t] ?? []).push(rec);
      };
      for (const p of procs) {
        if (p.status === 'cancelled') continue;
        push(p.toothFdi, {
          date: p.completedAt ?? p.createdAt,
          code: p.code,
          description: p.description,
          value: p.value,
          kind: p.status === 'completed' ? 'completed' : 'planned',
          source: p.status === 'completed' ? 'Realizado' : 'Pendiente',
        });
      }
      for (const plan of plans) {
        if (!ACTIVE_PLAN_STATES.includes(plan.status)) continue;
        for (const i of plan.items) {
          if (i.status !== 'planned') continue; // los completados ya vienen como procedimiento
          push(i.toothFdi, {
            code: i.code,
            description: i.description,
            value: i.subtotal,
            kind: 'planned',
            source: `Presupuesto: ${plan.title ?? 'Plan'}`,
          });
        }
      }
      // Orden: realizados por fecha desc, planificados al final
      for (const t of Object.keys(map)) {
        map[t].sort((a, b) => (b.date ?? '9999').localeCompare(a.date ?? '9999'));
      }
      setByTooth(map);
    })();
  }, [patientId]);

  if (!byTooth) return <p className="text-slate-400">Cargando odontograma…</p>;

  const toothClass = (t: string) => {
    const recs = byTooth[t] ?? [];
    const done = recs.some((r) => r.kind === 'completed');
    const plan = recs.some((r) => r.kind === 'planned');
    const sel = selected === t ? ' ring-2 ring-sky-500 ring-offset-1' : '';
    if (done && plan)
      return `bg-gradient-to-b from-sky-600 from-50% to-amber-400 to-50% text-white${sel}`;
    if (done) return `bg-sky-600 text-white${sel}`;
    if (plan) return `bg-amber-400 text-amber-950${sel}`;
    return `bg-white text-slate-500 hover:bg-slate-100${sel}`;
  };

  const Row = ({ teeth }: { teeth: string[] }) => (
    <div className="flex justify-center gap-1">
      {teeth.map((t, i) => (
        <span key={t} className="flex items-center">
          {i === 8 && <span className="mx-1 w-px self-stretch bg-slate-300" />}
          <button
            onClick={() => setSelected(selected === t ? null : t)}
            title={`Diente ${t}: ${(byTooth[t] ?? []).length} registro(s)`}
            className={`h-9 w-8 rounded-lg border border-slate-300 text-xs font-bold shadow-sm transition ${toothClass(t)}`}
          >
            {t}
          </button>
        </span>
      ))}
    </div>
  );

  const recs = selected ? byTooth[selected] ?? [] : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sky-800">🦷 Odontograma (FDI)</h3>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-sky-600 px-2 py-0.5 font-semibold text-white">Realizado</span>
          <span className="rounded-full bg-amber-400 px-2 py-0.5 font-semibold text-amber-950">Planificado</span>
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-slate-500">Sin registros</span>
        </div>
      </div>

      <div className="mt-4 space-y-1 overflow-x-auto rounded-xl bg-slate-50 p-4">
        <p className="text-center text-[10px] uppercase tracking-wide text-slate-400">Superior</p>
        <Row teeth={UPPER} />
        <div className="py-1" />
        <Row teeth={LOWER} />
        <p className="text-center text-[10px] uppercase tracking-wide text-slate-400">Inferior</p>
      </div>

      {selected && (
        <div className="mt-3 rounded-xl border border-sky-200 bg-white p-4">
          <h4 className="font-semibold text-slate-700">
            Diente {selected}
            <button onClick={() => setSelected(null)} className="float-right text-xs text-slate-400 hover:text-slate-600">✕</button>
          </h4>
          {recs.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">Sin tratamientos registrados en este diente.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="py-1">Fecha</th><th>Código</th><th>Tratamiento</th><th>Origen</th><th className="text-right">Valor</th></tr>
              </thead>
              <tbody>
                {recs.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5">{fmtDate(r.date)}</td>
                    <td className="font-mono">{r.code}</td>
                    <td>{r.description}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.kind === 'completed' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="text-right">{r.value !== undefined ? `$${fmtMoney(r.value)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
