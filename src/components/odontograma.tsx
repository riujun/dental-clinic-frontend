// DONE: Ideas de mejora #1 - Odontograma FDI interactivo (docs/ideas-mejoras.md)
// DONE: Idea #7 - estado inicial del odontograma (editable por el doctor)
// Mapa visual de los 32 dientes (notación FDI adulto). Colores:
//   petróleo = con tratamientos REALIZADOS · ámbar = con PLANIFICADOS ·
//   mitad/mitad = ambos · blanco = sin registros. Click → historial del diente.
// Insignia violeta en la esquina = estado inicial (caries/ausente/corona previa/etc,
// idea #7) — independiente de los tratamientos, se edita con el modo "✏️ Editar estado".
'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  fmtDate, fmtMoney, PatientProfile, ToothCondition, ToothConditionValue,
  TOOTH_CONDITIONS, TOOTH_CONDITION_LABELS, TOOTH_CONDITION_SHORT,
} from '@/lib/types';

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
  const [conditions, setConditions] = useState<Record<string, ToothCondition>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [conditionDraft, setConditionDraft] = useState<ToothConditionValue | ''>('');
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConditions = () => {
    api<PatientProfile>(`/patients/${patientId}`).then((p) => {
      const map: Record<string, ToothCondition> = {};
      for (const c of p.patient.toothConditions ?? []) map[c.toothFdi] = c;
      setConditions(map);
    }).catch(() => setConditions({}));
  };

  useEffect(() => {
    loadConditions();
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

  function handleToothClick(t: string) {
    setError(null);
    if (editMode) {
      setSelected(t);
      setConditionDraft(conditions[t]?.condition ?? '');
      setNotesDraft(conditions[t]?.notes ?? '');
      return;
    }
    setSelected(selected === t ? null : t);
  }

  async function saveCondition() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      if (conditionDraft === '') {
        await api(`/patients/${patientId}/tooth-conditions/${selected}`, { method: 'DELETE' });
      } else {
        await api(`/patients/${patientId}/tooth-conditions/${selected}`, {
          method: 'PATCH',
          body: { condition: conditionDraft, notes: notesDraft || undefined },
        });
      }
      loadConditions();
      setSelected(null);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
    finally { setSaving(false); }
  }

  const Row = ({ teeth }: { teeth: string[] }) => (
    <div className="flex justify-center gap-1">
      {teeth.map((t, i) => {
        const cond = conditions[t];
        return (
          <span key={t} className="flex items-center">
            {i === 8 && <span className="mx-1 w-px self-stretch bg-slate-300" />}
            <button
              onClick={() => handleToothClick(t)}
              title={`Diente ${t}${cond ? ` — ${TOOTH_CONDITION_LABELS[cond.condition]}${cond.notes ? `: ${cond.notes}` : ''}` : ''}: ${(byTooth[t] ?? []).length} registro(s)`}
              className={`relative h-9 w-8 rounded-lg border border-slate-300 text-xs font-bold shadow-sm transition ${toothClass(t)} ${cond?.condition === 'ausente' ? 'opacity-40 line-through' : ''}`}
            >
              {t}
              {cond && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-0.5 text-[9px] font-bold text-white">
                  {TOOTH_CONDITION_SHORT[cond.condition]}
                </span>
              )}
            </button>
          </span>
        );
      })}
    </div>
  );

  const recs = selected ? byTooth[selected] ?? [] : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sky-800">🦷 Odontograma (FDI)</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-sky-600 px-2 py-0.5 font-semibold text-white">Realizado</span>
          <span className="rounded-full bg-amber-400 px-2 py-0.5 font-semibold text-amber-950">Planificado</span>
          <span className="rounded-full bg-violet-600 px-2 py-0.5 font-semibold text-white">Estado inicial</span>
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-slate-500">Sin registros</span>
          <button
            onClick={() => { setEditMode((v) => !v); setSelected(null); }}
            className={`rounded-full px-3 py-0.5 font-semibold ${editMode ? 'bg-violet-600 text-white' : 'border border-violet-300 text-violet-700 hover:bg-violet-50'}`}>
            {editMode ? '✓ Editando estado inicial' : '✏️ Editar estado inicial'}
          </button>
        </div>
      </div>
      {editMode && (
        <p className="mt-1 text-xs text-slate-500">
          Click en un diente para marcar su condición de base (caries, ausente, corona previa, etc.) — no es un tratamiento realizado acá, es el estado con el que llegó el paciente.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <div className="mt-4 space-y-1 overflow-x-auto rounded-xl bg-slate-50 p-4">
        <p className="text-center text-[10px] uppercase tracking-wide text-slate-400">Superior</p>
        <Row teeth={UPPER} />
        <div className="py-1" />
        <Row teeth={LOWER} />
        <p className="text-center text-[10px] uppercase tracking-wide text-slate-400">Inferior</p>
      </div>

      {selected && editMode && (
        <div className="mt-3 rounded-xl border border-violet-200 bg-white p-4">
          <h4 className="font-semibold text-slate-700">
            Estado inicial — Diente {selected}
            <button onClick={() => setSelected(null)} className="float-right text-xs text-slate-400 hover:text-slate-600">✕</button>
          </h4>
          <label className="mt-3 block text-sm">
            Condición
            <select value={conditionDraft} onChange={(e) => setConditionDraft(e.target.value as ToothConditionValue | '')}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">Sin condición (quitar)</option>
              {TOOTH_CONDITIONS.map((c) => <option key={c} value={c}>{TOOTH_CONDITION_LABELS[c]}</option>)}
            </select>
          </label>
          <label className="mt-2 block text-sm">
            Notas (opcional)
            <input value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Ej: corona metal-porcelana, buen estado"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <div className="mt-3 flex gap-2">
            <button onClick={() => void saveCondition()} disabled={saving}
              className="rounded bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setSelected(null)}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {selected && !editMode && (
        <div className="mt-3 rounded-xl border border-sky-200 bg-white p-4">
          <h4 className="font-semibold text-slate-700">
            Diente {selected}
            <button onClick={() => setSelected(null)} className="float-right text-xs text-slate-400 hover:text-slate-600">✕</button>
          </h4>
          {conditions[selected] && (
            <p className="mt-1 text-sm text-violet-700">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold">Estado inicial: {TOOTH_CONDITION_LABELS[conditions[selected].condition]}</span>
              {conditions[selected].notes && <span className="ml-2 text-slate-500">{conditions[selected].notes}</span>}
            </p>
          )}
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
