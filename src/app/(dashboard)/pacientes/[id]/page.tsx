// DONE: Paso 11.5 - perfil 360° del paciente (HU-P2): alertas rojas prominentes,
// pestañas lazy (datos/anamnesis, presupuestos, procedimientos, cuenta) y
// actualización de anamnesis versionada (HU-P3)
// DONE: Feedback de Fabián (2026-07-08, fotos 3/4/5 + texto):
//   - Pestaña "Citas" con historial COMPLETO (pasadas y agendadas) del paciente
//   - "+ Nuevo presupuesto" desde la ficha (evita re-buscar al paciente)
//   - Datos y anamnesis: 3 columnas, muestra dirección/contacto de emergencia/
//     ocupación (existían en el backend, no se mostraban) + ahora editables
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Odontograma } from '@/components/odontograma';
import { api, ApiError } from '@/lib/api';
import {
  AccountStatement,
  Appointment,
  APPT_STATUS_ICONS,
  APPT_STATUS_LABELS,
  fmtDate,
  fmtMoney,
  fmtTime,
  PatientProfile,
  ProcedureRow,
  TreatmentPlan,
} from '@/lib/types';

const TABS = ['Datos y anamnesis', 'Odontograma', 'Citas', 'Presupuestos', 'Procedimientos', 'Cuenta'] as const;
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

      <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
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
        {tab === 'Citas' && <CitasTab patientId={id} />}
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
  const addr = patient.address ?? {};
  const emerg = patient.emergencyContact ?? {};

  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingAnamnesis, setEditingAnamnesis] = useState(false);

  const [pf, setPf] = useState({
    phone: patient.phone ?? '', email: patient.email ?? '', occupation: patient.occupation ?? '',
    street: addr.street ?? '', city: addr.city ?? '', state: addr.state ?? '', country: addr.country ?? '',
    emergName: emerg.name ?? '', emergPhone: emerg.phone ?? '', emergRelation: emerg.relation ?? '',
  });
  const [af, setAf] = useState({
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

  async function savePersonal(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api(`/patients/${patient._id}`, {
        method: 'PATCH',
        body: {
          phone: pf.phone || undefined,
          email: pf.email || undefined,
          occupation: pf.occupation || undefined,
          address: {
            street: pf.street || undefined, city: pf.city || undefined,
            state: pf.state || undefined, country: pf.country || undefined,
          },
          emergencyContact: {
            name: pf.emergName || undefined, phone: pf.emergPhone || undefined,
            relation: pf.emergRelation || undefined,
          },
        },
      });
      setEditingPersonal(false);
      onSaved();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error al guardar');
    }
  }

  async function saveAnamnesis(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api(`/patients/${patient._id}/anamnesis`, {
        method: 'PATCH',
        body: {
          allergies: csv(af.allergies).map((substance) => ({ substance })),
          medications: csv(af.medications).map((name) => ({ name })),
          conditions: csv(af.conditions),
          bisphosphonates: af.bisphosphonates,
          requiresPremedication: af.requiresPremedication,
          isPregnant: af.isPregnant,
          smoker: af.smoker,
          freeNotes: af.freeNotes || undefined,
        },
      });
      setEditingAnamnesis(false);
      onSaved();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error al guardar');
    }
  }

  return (
    <div>
      {msg && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna 1: contacto + dirección + emergencia (antes vacía, ahora con datos reales) */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sky-800">Contacto y dirección</h3>
            {!editingPersonal && (
              <button onClick={() => setEditingPersonal(true)} className="text-xs text-sky-600 hover:underline">
                ✏️ Editar
              </button>
            )}
          </div>
          {!editingPersonal ? (
            <dl className="mt-2 space-y-1.5 text-sm">
              <Field label="Teléfono" value={patient.phone} />
              <Field label="Email" value={patient.email} />
              <Field label="Nacimiento" value={fmtDate(patient.birthDate)} />
              <Field label="Sexo" value={patient.sex} />
              <Field label="Ocupación" value={patient.occupation} />
              <Field label="Dirección" value={[addr.street, addr.city, addr.state, addr.country].filter(Boolean).join(', ')} />
              <Field label="Contacto emergencia"
                value={emerg.name ? `${emerg.name}${emerg.relation ? ` (${emerg.relation})` : ''} · ${emerg.phone ?? ''}` : undefined} />
            </dl>
          ) : (
            <form onSubmit={savePersonal} className="mt-2 space-y-2 text-sm">
              <label className="block">Teléfono
                <input className={input} value={pf.phone} onChange={(e) => setPf({ ...pf, phone: e.target.value })} />
              </label>
              <label className="block">Email
                <input className={input} value={pf.email} onChange={(e) => setPf({ ...pf, email: e.target.value })} />
              </label>
              <label className="block">Ocupación
                <input className={input} value={pf.occupation} onChange={(e) => setPf({ ...pf, occupation: e.target.value })} />
              </label>
              <label className="block">Calle
                <input className={input} value={pf.street} onChange={(e) => setPf({ ...pf, street: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">Ciudad
                  <input className={input} value={pf.city} onChange={(e) => setPf({ ...pf, city: e.target.value })} />
                </label>
                <label className="block">Región/País
                  <input className={input} value={pf.country} onChange={(e) => setPf({ ...pf, country: e.target.value })} />
                </label>
              </div>
              <p className="pt-1 text-xs font-semibold text-slate-500">Contacto de emergencia</p>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Nombre" className={input} value={pf.emergName} onChange={(e) => setPf({ ...pf, emergName: e.target.value })} />
                <input placeholder="Teléfono" className={input} value={pf.emergPhone} onChange={(e) => setPf({ ...pf, emergPhone: e.target.value })} />
              </div>
              <input placeholder="Relación (madre, pareja…)" className={input} value={pf.emergRelation} onChange={(e) => setPf({ ...pf, emergRelation: e.target.value })} />
              <div className="flex gap-2 pt-1">
                <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 font-semibold text-white hover:bg-sky-700">Guardar</button>
                <button type="button" onClick={() => setEditingPersonal(false)} className="rounded px-3 py-1.5 text-slate-500 hover:bg-slate-100">Cancelar</button>
              </div>
            </form>
          )}
        </div>

        {/* Columna 2: anamnesis */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sky-800">Anamnesis</h3>
            {!editingAnamnesis && (
              <button onClick={() => setEditingAnamnesis(true)} className="text-xs text-sky-600 hover:underline">
                Actualizar (visita de hoy)
              </button>
            )}
          </div>
          {!editingAnamnesis ? (
            <dl className="mt-2 space-y-1.5 text-sm">
              <Field label="Alergias" value={(mh.allergies ?? []).map((a) => a.substance).join(', ')} />
              <Field label="Medicamentos" value={(mh.medications ?? []).map((m) => m.name).join(', ')} />
              <Field label="Condiciones" value={(mh.conditions ?? []).join(', ')} />
              <Field label="Fumador" value={{ no: 'No', current: 'Sí', former: 'Ex fumador' }[mh.smoker ?? 'no']} />
              <Field label="Última revisión" value={fmtDate(mh.lastMedicalReview)} />
              {mh.freeNotes && <Field label="Notas" value={mh.freeNotes} />}
            </dl>
          ) : (
            <form onSubmit={saveAnamnesis} className="mt-2 space-y-2 text-sm">
              <label className="block">Alergias (coma)
                <input className={input} value={af.allergies} onChange={(e) => setAf({ ...af, allergies: e.target.value })} />
              </label>
              <label className="block">Medicamentos (coma)
                <input className={input} value={af.medications} onChange={(e) => setAf({ ...af, medications: e.target.value })} />
              </label>
              <label className="block">Condiciones (coma)
                <input className={input} value={af.conditions} onChange={(e) => setAf({ ...af, conditions: e.target.value })} />
              </label>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1"><input type="checkbox" checked={af.bisphosphonates} onChange={(e) => setAf({ ...af, bisphosphonates: e.target.checked })} /> Bifosfonatos</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={af.requiresPremedication} onChange={(e) => setAf({ ...af, requiresPremedication: e.target.checked })} /> Premedicación</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={af.isPregnant} onChange={(e) => setAf({ ...af, isPregnant: e.target.checked })} /> Embarazo</label>
              </div>
              <label className="block">Notas
                <textarea className={input} rows={2} value={af.freeNotes} onChange={(e) => setAf({ ...af, freeNotes: e.target.value })} />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 font-semibold text-white hover:bg-sky-700">Guardar</button>
                <button type="button" onClick={() => setEditingAnamnesis(false)} className="rounded px-3 py-1.5 text-slate-500 hover:bg-slate-100">Cancelar</button>
              </div>
            </form>
          )}
        </div>

        {/* Columna 3: resumen rápido — llena el espacio con accesos directos */}
        <div>
          <h3 className="font-semibold text-sky-800">Accesos rápidos</h3>
          <div className="mt-2 space-y-2 text-sm">
            <Link href={`/presupuestos/nuevo?patientId=${patient._id}`}
              className="block rounded-lg bg-sky-50 px-3 py-2 font-semibold text-sky-700 hover:bg-sky-100">
              📋 Nuevo presupuesto
            </Link>
            <Link href="/agenda" className="block rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-700 hover:bg-emerald-100">
              📅 Ir a la agenda
            </Link>
            <Link href="/pagos" className="block rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-700 hover:bg-amber-100">
              💳 Registrar pago
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fila compacta etiqueta:valor — solo se muestra si hay valor (evita "—" en cascada) */
function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-50 py-0.5">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="truncate text-right font-medium text-slate-700">{value || '—'}</dd>
    </div>
  );
}

/** Historial completo de citas del paciente: pasadas y agendadas (pedido de Fabián) */
function CitasTab({ patientId }: { patientId: string }) {
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  useEffect(() => {
    api<Appointment[]>(`/appointments?patientId=${patientId}`)
      .then((list) => setAppts(list.sort((a, b) => b.startAt.localeCompare(a.startAt))))
      .catch(() => setAppts([]));
  }, [patientId]);

  if (!appts) return <p className="text-slate-400">Cargando…</p>;
  if (appts.length === 0) return <p className="text-slate-400">Sin citas registradas aún.</p>;

  const proximas = appts.filter((a) => a.status === 'scheduled' || a.status === 'confirmed');
  const historial = appts.filter((a) => a.status !== 'scheduled' && a.status !== 'confirmed');

  const Row = ({ a }: { a: Appointment }) => (
    <tr className="border-t border-slate-100">
      <td className="py-2">{fmtDate(a.startAt)} · {fmtTime(a.startAt)}</td>
      <td>{a.reason ?? '—'}</td>
      <td>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">
          {APPT_STATUS_ICONS[a.status]} {APPT_STATUS_LABELS[a.status]}
        </span>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sky-800">Próximas ({proximas.length})</h3>
        {proximas.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">Sin citas agendadas.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-slate-500"><tr><th className="py-1">Fecha</th><th>Motivo</th><th>Estado</th></tr></thead>
            <tbody>{proximas.map((a) => <Row key={a._id} a={a} />)}</tbody>
          </table>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-slate-600">Historial ({historial.length})</h3>
        {historial.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">Sin citas pasadas.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-slate-500"><tr><th className="py-1">Fecha</th><th>Motivo</th><th>Estado</th></tr></thead>
            <tbody>{historial.map((a) => <Row key={a._id} a={a} />)}</tbody>
          </table>
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
  return (
    <div>
      <div className="mb-3 flex justify-end">
        {/* Item G: evita tener que re-buscar al paciente en /presupuestos/nuevo */}
        <Link href={`/presupuestos/nuevo?patientId=${patientId}`}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
          + Nuevo presupuesto
        </Link>
      </div>
      {plans.length === 0 ? (
        <p className="text-slate-400">Sin presupuestos aún.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr><th className="py-2">Título</th><th>Estado</th><th>Ítems</th><th className="text-right">Total</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p._id} className="border-t border-slate-100">
                <td className="py-2 font-semibold">
                  <Link href={`/presupuestos/${p._id}`} className="text-sky-700 hover:underline">{p.title ?? 'Plan'}</Link>
                </td>
                <td>{PLAN_LABELS[p.status] ?? p.status}</td>
                <td>{p.items.length}</td>
                <td className="text-right">${fmtMoney(p.total)}</td>
                <td>{fmtDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProcedimientosTab({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<ProcedureRow[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<ProcedureRow[]>(`/procedures?patientId=${patientId}`).then(setRows).catch(() => setRows([]));
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  function startEdit(r: ProcedureRow) {
    setEditingId(r._id);
    setNoteDraft(r.clinicalNote ?? '');
  }

  async function saveNote(id: string) {
    setSaving(true);
    try {
      await api(`/procedures/${id}/clinical-note`, { method: 'PATCH', body: { clinicalNote: noteDraft } });
      setEditingId(null);
      load();
    } catch { /* noop */ }
    finally { setSaving(false); }
  }

  if (!rows) return <p className="text-slate-400">Cargando…</p>;
  if (rows.length === 0) return <p className="text-slate-400">Sin procedimientos aún.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-slate-500">
        <tr><th className="py-2">Código</th><th>Descripción</th><th>Diente</th><th>Estado</th><th className="text-right">Valor</th><th>Realizado</th><th /></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <>
            <tr key={r._id} className="border-t border-slate-100 align-top">
              <td className="py-2">{r.code}</td>
              <td>{r.description}</td>
              <td>{r.toothFdi ?? '—'}</td>
              <td>{{ planned: 'Planificado', completed: 'Realizado', cancelled: 'Cancelado' }[r.status] ?? r.status}</td>
              <td className={`text-right ${r.value < 0 ? 'text-red-600' : ''}`}>${fmtMoney(r.value)}</td>
              <td>{fmtDate(r.completedAt)}</td>
              <td className="text-right">
                {r.status === 'completed' && editingId !== r._id && (
                  <button onClick={() => startEdit(r)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                    {r.clinicalNote ? '📝 Editar' : '📝 Agregar historial'}
                  </button>
                )}
              </td>
            </tr>
            {r.status === 'completed' && editingId !== r._id && r.clinicalNote && (
              <tr className="border-t border-dashed border-slate-100 bg-slate-50/60">
                <td />
                <td colSpan={6} className="py-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500">Historial clínico:</span> {r.clinicalNote}
                </td>
              </tr>
            )}
            {editingId === r._id && (
              <tr className="border-t border-slate-100 bg-slate-50">
                <td />
                <td colSpan={6} className="py-2">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder="Qué se le hizo al paciente…"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => void saveNote(r._id)} disabled={saving}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </>
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
