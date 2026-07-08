// DONE: Paso 11.5 - perfil 360° del paciente (HU-P2): alertas rojas prominentes,
// pestañas lazy (datos/anamnesis, presupuestos, procedimientos, cuenta) y
// actualización de anamnesis versionada (HU-P3)
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Odontograma } from '@/components/odontograma';
import { api, ApiError } from '@/lib/api';
import {
  AccountStatement,
  fmtDate,
  fmtMoney,
  PatientProfile,
  ProcedureRow,
  TreatmentPlan,
} from '@/lib/types';

const TABS = ['Datos y anamnesis', 'Odontograma', 'Presupuestos', 'Procedimientos', 'Cuenta'] as const;
const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

export default function FichaPacientePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Datos y anamnesis');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<PatientProfile>(`/patients/${id}`).then(setProfile).catch((e) => setError(String(e)));
    // Idea de mejora #2: saldo a la vista de recepción (chip en el encabezado)
    api<AccountStatement>(`/patients/${id}/account`)
      .then((a) => setBalance(a.balance))
      .catch(() => null);
  }, [id]);
  useEffect(load, [load]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!profile) return <p className="text-slate-400">Cargando ficha…</p>;

  const { patient, medicalAlerts, anamnesisOutdated } = profile;
  const hasAlerts =
    medicalAlerts.allergies.length > 0 || medicalAlerts.requiresPremedication ||
    medicalAlerts.bisphosphonates || medicalAlerts.isPregnant;

  return (
    <div>
      <Link href="/pacientes" className="text-sm text-sky-600 hover:underline">
        ← Volver a pacientes
      </Link>
      <h1 className="mt-1 text-2xl font-bold text-slate-800">
        {patient.lastName}, {patient.firstName}
        <span className="ml-3 align-middle text-sm font-normal text-slate-500">
          {patient.documentType ?? 'Doc'} {patient.documentNumber ?? '—'}
        </span>
        {balance !== null && (
          <button onClick={() => setTab('Cuenta')} title="Ver estado de cuenta"
            className={`ml-3 rounded-full px-3 py-1 align-middle text-sm font-semibold ${
              balance > 0
                ? 'bg-red-100 text-red-700'
                : balance < 0
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-emerald-100 text-emerald-700'
            }`}>
            {balance > 0 ? `💰 Debe $${fmtMoney(balance)}` : balance < 0 ? `💙 A favor $${fmtMoney(-balance)}` : '✔ Al día'}
          </button>
        )}
      </h1>

      {/* Alertas rojas prominentes (patrón Open Dental) */}
      {hasAlerts && (
        <div className="mt-3 rounded-lg border-2 border-red-400 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
          ⚠ {[
            medicalAlerts.allergies.length > 0 && `ALERGIAS: ${medicalAlerts.allergies.join(', ')}`,
            medicalAlerts.requiresPremedication && 'REQUIERE PREMEDICACIÓN',
            medicalAlerts.bisphosphonates && 'BIFOSFONATOS (riesgo osteonecrosis)',
            medicalAlerts.isPregnant && 'EMBARAZO',
          ].filter(Boolean).join(' · ')}
        </div>
      )}
      {anamnesisOutdated && (
        <div className="mt-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⏰ Anamnesis sin revisar hace más de 24 meses (o nunca) — actualizar en esta visita.
        </div>
      )}

      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-t px-4 py-2 text-sm ${tab === t ? 'bg-white font-semibold text-sky-700 shadow' : 'text-slate-500 hover:bg-slate-200'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-b-xl rounded-tr-xl bg-white p-5 shadow">
        {tab === 'Datos y anamnesis' && <DatosTab profile={profile} onSaved={load} />}
        {tab === 'Odontograma' && <Odontograma patientId={id} />}
        {tab === 'Presupuestos' && <PresupuestosTab patientId={id} />}
        {tab === 'Procedimientos' && <ProcedimientosTab patientId={id} />}
        {tab === 'Cuenta' && <CuentaTab patientId={id} />}
      </div>
    </div>
  );
}

function DatosTab({ profile, onSaved }: { profile: PatientProfile; onSaved: () => void }) {
  const { patient } = profile;
  const mh = patient.medicalHistory ?? {};
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    allergies: (mh.allergies ?? []).map((a) => a.substance).join(', '),
    medications: (mh.medications ?? []).map((m) => m.name).join(', '),
    conditions: (mh.conditions ?? []).join(', '),
    bisphosphonates: mh.bisphosphonates ?? false,
    requiresPremedication: mh.requiresPremedication ?? false,
    isPregnant: mh.isPregnant ?? false,
    smoker: mh.smoker ?? 'no',
    freeNotes: mh.freeNotes ?? '',
  });
  const [msg, setMsg] = useState<string | null>(null);
  const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api(`/patients/${patient._id}/anamnesis`, {
        method: 'PATCH',
        body: {
          allergies: csv(f.allergies).map((substance) => ({ substance })),
          medications: csv(f.medications).map((name) => ({ name })),
          conditions: csv(f.conditions),
          bisphosphonates: f.bisphosphonates,
          requiresPremedication: f.requiresPremedication,
          isPregnant: f.isPregnant,
          smoker: f.smoker,
          freeNotes: f.freeNotes || undefined,
        },
      });
      setEditing(false);
      onSaved();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error al guardar');
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="font-semibold text-sky-800">Contacto</h3>
        <dl className="mt-2 space-y-1 text-sm">
          <div><dt className="inline text-slate-500">Teléfono: </dt><dd className="inline">{patient.phone ?? '—'}</dd></div>
          <div><dt className="inline text-slate-500">Email: </dt><dd className="inline">{patient.email ?? '—'}</dd></div>
          <div><dt className="inline text-slate-500">Nacimiento: </dt><dd className="inline">{fmtDate(patient.birthDate)}</dd></div>
          <div><dt className="inline text-slate-500">Sexo: </dt><dd className="inline">{patient.sex ?? '—'}</dd></div>
        </dl>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sky-800">Anamnesis</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-sm text-sky-600 hover:underline">
              Actualizar (visita de hoy)
            </button>
          )}
        </div>
        {!editing ? (
          <dl className="mt-2 space-y-1 text-sm">
            <div><dt className="inline text-slate-500">Alergias: </dt><dd className="inline">{(mh.allergies ?? []).map((a) => a.substance).join(', ') || 'sin registro'}</dd></div>
            <div><dt className="inline text-slate-500">Medicamentos: </dt><dd className="inline">{(mh.medications ?? []).map((m) => m.name).join(', ') || 'sin registro'}</dd></div>
            <div><dt className="inline text-slate-500">Condiciones: </dt><dd className="inline">{(mh.conditions ?? []).join(', ') || 'sin registro'}</dd></div>
            <div><dt className="inline text-slate-500">Fumador: </dt><dd className="inline">{{ no: 'No', current: 'Sí', former: 'Ex fumador' }[mh.smoker ?? 'no']}</dd></div>
            <div><dt className="inline text-slate-500">Última revisión: </dt><dd className="inline">{fmtDate(mh.lastMedicalReview)}</dd></div>
            {mh.freeNotes && <div><dt className="inline text-slate-500">Notas: </dt><dd className="inline">{mh.freeNotes}</dd></div>}
          </dl>
        ) : (
          <form onSubmit={save} className="mt-2 space-y-2 text-sm">
            <label className="block">Alergias (coma)
              <input className={input} value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} />
            </label>
            <label className="block">Medicamentos (coma)
              <input className={input} value={f.medications} onChange={(e) => setF({ ...f, medications: e.target.value })} />
            </label>
            <label className="block">Condiciones (coma)
              <input className={input} value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1"><input type="checkbox" checked={f.bisphosphonates} onChange={(e) => setF({ ...f, bisphosphonates: e.target.checked })} /> Bifosfonatos</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={f.requiresPremedication} onChange={(e) => setF({ ...f, requiresPremedication: e.target.checked })} /> Premedicación</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={f.isPregnant} onChange={(e) => setF({ ...f, isPregnant: e.target.checked })} /> Embarazo</label>
            </div>
            <label className="block">Notas
              <textarea className={input} rows={2} value={f.freeNotes} onChange={(e) => setF({ ...f, freeNotes: e.target.value })} />
            </label>
            {msg && <p className="text-red-600">{msg}</p>}
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 font-semibold text-white hover:bg-sky-700">Guardar</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded px-3 py-1.5 text-slate-500 hover:bg-slate-100">Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const PLAN_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PRESENTED: 'Presentado', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado',
  IN_PROGRESS: 'En ejecución', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};

function PresupuestosTab({ patientId }: { patientId: string }) {
  const [plans, setPlans] = useState<TreatmentPlan[] | null>(null);
  useEffect(() => {
    api<TreatmentPlan[]>(`/treatment-plans?patientId=${patientId}`).then(setPlans).catch(() => setPlans([]));
  }, [patientId]);
  if (!plans) return <p className="text-slate-400">Cargando…</p>;
  if (plans.length === 0) return <p className="text-slate-400">Sin presupuestos aún.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-slate-500">
        <tr><th className="py-2">Título</th><th>Estado</th><th>Ítems</th><th className="text-right">Total</th><th>Fecha</th></tr>
      </thead>
      <tbody>
        {plans.map((p) => (
          <tr key={p._id} className="border-t border-slate-100">
            <td className="py-2 font-semibold">{p.title ?? 'Plan'}</td>
            <td>{PLAN_LABELS[p.status] ?? p.status}</td>
            <td>{p.items.length}</td>
            <td className="text-right">${fmtMoney(p.total)}</td>
            <td>{fmtDate(p.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProcedimientosTab({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<ProcedureRow[] | null>(null);
  useEffect(() => {
    api<ProcedureRow[]>(`/procedures?patientId=${patientId}`).then(setRows).catch(() => setRows([]));
  }, [patientId]);
  if (!rows) return <p className="text-slate-400">Cargando…</p>;
  if (rows.length === 0) return <p className="text-slate-400">Sin procedimientos aún.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-slate-500">
        <tr><th className="py-2">Código</th><th>Descripción</th><th>Diente</th><th>Estado</th><th className="text-right">Valor</th><th>Realizado</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r._id} className="border-t border-slate-100">
            <td className="py-2">{r.code}</td>
            <td>{r.description}</td>
            <td>{r.toothFdi ?? '—'}</td>
            <td>{{ planned: 'Planificado', completed: 'Realizado', cancelled: 'Cancelado' }[r.status] ?? r.status}</td>
            <td className={`text-right ${r.value < 0 ? 'text-red-600' : ''}`}>${fmtMoney(r.value)}</td>
            <td>{fmtDate(r.completedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CuentaTab({ patientId }: { patientId: string }) {
  const [acc, setAcc] = useState<AccountStatement | null>(null);
  useEffect(() => {
    api<AccountStatement>(`/patients/${patientId}/account`).then(setAcc).catch(() => null);
  }, [patientId]);
  if (!acc) return <p className="text-slate-400">Cargando…</p>;
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Cargos</p>
          <p className="text-xl font-bold">${fmtMoney(acc.totalCharges)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Abonos</p>
          <p className="text-xl font-bold text-emerald-600">${fmtMoney(acc.totalPayments)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Saldo</p>
          <p className={`text-xl font-bold ${acc.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            ${fmtMoney(acc.balance)}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-2 text-sm">
        <div>
          <h4 className="font-semibold text-sky-800">Cargos</h4>
          {acc.charges.length === 0 ? <p className="text-slate-400">—</p> : acc.charges.map((c, i) => (
            <p key={i} className="border-t border-slate-100 py-1">
              {fmtDate(c.date)} · {c.code} {c.description}
              <span className={`float-right ${c.isRefund ? 'text-red-600' : ''}`}>${fmtMoney(c.value)}</span>
            </p>
          ))}
        </div>
        <div>
          <h4 className="font-semibold text-sky-800">Abonos</h4>
          {acc.payments.length === 0 ? <p className="text-slate-400">—</p> : acc.payments.map((p, i) => (
            <p key={i} className="border-t border-slate-100 py-1">
              {fmtDate(p.date)} · {p.method}
              <span className="float-right text-emerald-700">${fmtMoney(p.amount)}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
