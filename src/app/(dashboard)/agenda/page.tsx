// DONE: Paso 11.5c - agenda con 3 vistas (Día lista / Semana grilla / Mes calendario)
// DONE: Comunicaciones Etapa A (requerimientos Fabián):
//   - Leyenda de estados con iconos y colores (simbología)
//   - Burbuja (tooltip) con motivo al pasar el mouse
//   - Confirmación por WhatsApp al agendar (plantilla editable)
//   - 📣 Recordatorios masivos del día con mensaje predeterminado modificable
// TODO: pendiente Fase 2 - envío automático (Twilio+BullMQ), sillones/recursos
'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { fetchPatientInfo, PatientInfo } from '@/lib/lookups';
import {
  Appointment,
  APPT_STATUS_ICONS,
  APPT_STATUS_LABELS,
  fmtTime,
  Patient,
  Professional,
} from '@/lib/types';
import { fillTemplate, MessageTemplate, waLink } from '@/lib/whatsapp';

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

const STATUS_STYLES: Record<Appointment['status'], string> = {
  scheduled: 'bg-sky-100 text-sky-800 border-sky-300',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  completed: 'bg-slate-200 text-slate-600 border-slate-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
  no_show: 'bg-amber-100 text-amber-800 border-amber-300',
};

const VIEWS = ['Día', 'Semana', 'Mes'] as const;
type View = (typeof VIEWS)[number];

/** Idea #4: motivos frecuentes con duración típica — elegir uno rellena el
 *  motivo Y ajusta la hora de término automáticamente */
const REASON_PRESETS: { label: string; minutes: number }[] = [
  { label: 'Control', minutes: 15 },
  { label: 'Examen / Diagnóstico', minutes: 30 },
  { label: 'Destartraje / Limpieza', minutes: 45 },
  { label: 'Resina', minutes: 45 },
  { label: 'Extracción', minutes: 45 },
  { label: 'Endodoncia', minutes: 60 },
  { label: 'Corona / Prótesis', minutes: 60 },
  { label: 'Urgencia', minutes: 30 },
];

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const SLOT_MIN = 30;
const DAY_START = 8;
const DAY_END = 20;

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (s: string, n: number) => {
  const d = parseYMD(s);
  d.setDate(d.getDate() + n);
  return toYMD(d);
};
const mondayOf = (s: string) => {
  const d = parseYMD(s);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toYMD(d);
};

/** Burbuja informativa de una cita (paciente · horario · motivo · estado) */
const bubble = (a: Appointment, info?: PatientInfo) =>
  `${info?.name ?? 'Paciente'}\n${fmtTime(a.startAt)}–${fmtTime(a.endAt)}\nMotivo: ${a.reason || 'sin motivo'}\nEstado: ${APPT_STATUS_ICONS[a.status]} ${APPT_STATUS_LABELS[a.status]}`;

export default function AgendaPage() {
  const [view, setView] = useState<View>('Día');
  const [anchor, setAnchor] = useState(toYMD(new Date()));
  const [doctors, setDoctors] = useState<Professional[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Record<string, PatientInfo>>({});
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [form, setForm] = useState<{ date: string; start: string; end: string } | null>(null);
  const [showReminders, setShowReminders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Professional[]>('/professionals').then((ds) => {
      setDoctors(ds);
      if (ds.length > 0) setDoctorId((prev) => prev || ds[0]._id);
    });
    api<MessageTemplate[]>('/templates').then(setTemplates).catch(() => null);
  }, []);

  const range = useCallback((): { from: string; to: string } => {
    if (view === 'Día') return { from: anchor, to: anchor };
    if (view === 'Semana') {
      const mon = mondayOf(anchor);
      return { from: mon, to: addDays(mon, 6) };
    }
    const d = parseYMD(anchor);
    return {
      from: toYMD(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: toYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }, [view, anchor]);

  const load = useCallback(async () => {
    if (!doctorId) return;
    const { from, to } = range();
    const list = await api<Appointment[]>(
      `/appointments?professionalId=${doctorId}&from=${from}T00:00:00&to=${to}T23:59:59`,
    );
    setAppts(list);
    setPatients(await fetchPatientInfo(list.map((a) => a.patientId)));
  }, [doctorId, range]);
  useEffect(() => { void load().catch(() => null); }, [load]);

  function nav(dir: -1 | 1) {
    if (view === 'Día') setAnchor(addDays(anchor, dir));
    else if (view === 'Semana') setAnchor(addDays(anchor, dir * 7));
    else {
      const d = parseYMD(anchor);
      d.setMonth(d.getMonth() + dir);
      setAnchor(toYMD(d));
    }
  }

  async function changeStatus(id: string, status: string) {
    setError(null);
    try {
      await api(`/appointments/${id}/status`, { method: 'POST', body: { status } });
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  /** Idea #6: editar la nota interna de una cita existente */
  async function editNote(a: Appointment) {
    const notes = prompt('📝 Nota interna de la cita:', a.notes ?? '');
    if (notes === null) return;
    setError(null);
    try {
      await api(`/appointments/${a._id}`, { method: 'PATCH', body: { notes } });
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  const doctorName = doctors.find((d) => d._id === doctorId)?.fullName ?? '';
  const rangeLabel = (() => {
    const { from, to } = range();
    if (view === 'Día') return parseYMD(from).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    if (view === 'Semana') return `${parseYMD(from).getDate()} ${parseYMD(from).toLocaleDateString('es-CL', { month: 'short' })} — ${parseYMD(to).getDate()} ${parseYMD(to).toLocaleDateString('es-CL', { month: 'short' })}`;
    return parseYMD(anchor).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  })();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Agenda</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {VIEWS.map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 text-sm ${view === v ? 'bg-sky-600 font-semibold text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => nav(-1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">‹</button>
            <button onClick={() => setAnchor(toYMD(new Date()))}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100">Hoy</button>
            <button onClick={() => nav(1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">›</button>
          </div>
          <select className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
            value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => <option key={d._id} value={d._id}>{d.fullName}</option>)}
          </select>
          {view === 'Día' && (
            <button onClick={() => setShowReminders((s) => !s)}
              className="rounded bg-emerald-600 px-4 py-1.5 font-semibold text-white hover:bg-emerald-700">
              📣 Recordatorios del día
            </button>
          )}
          <button onClick={() => setForm(form ? null : { date: anchor, start: '10:00', end: '10:30' })}
            className="rounded bg-sky-600 px-4 py-1.5 font-semibold text-white hover:bg-sky-700">
            + Nueva cita
          </button>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm capitalize text-slate-500">{rangeLabel}</p>
        <Leyenda />
      </div>
      {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showReminders && view === 'Día' && (
        <RemindersPanel
          date={anchor} appts={appts} patients={patients} doctorName={doctorName}
          templates={templates} onTemplatesChange={setTemplates}
          onLogged={load} onClose={() => setShowReminders(false)}
        />
      )}

      {form && (
        <NuevaCitaForm
          doctors={doctors} defaultDoctorId={doctorId} prefill={form} templates={templates}
          onCreated={() => { setForm(null); void load(); }}
        />
      )}

      <div className="mt-4">
        {view === 'Día' && (
          <DiaView appts={appts} patients={patients} onStatus={changeStatus} onEditNote={editNote} />
        )}
        {view === 'Semana' && (
          <SemanaView monday={mondayOf(anchor)} appts={appts} patients={patients}
            onSlotClick={(date, start, end) => setForm({ date, start, end })} />
        )}
        {view === 'Mes' && (
          <MesView anchor={anchor} appts={appts}
            onDayClick={(d) => { setAnchor(d); setView('Día'); }} />
        )}
      </div>
    </div>
  );
}

/** Simbología visible: qué significa cada color/icono (pedido de Fabián) */
function Leyenda() {
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {(Object.keys(APPT_STATUS_LABELS) as Appointment['status'][]).map((s) => (
        <span key={s} className={`rounded-full border px-2 py-0.5 ${STATUS_STYLES[s]}`}>
          {APPT_STATUS_ICONS[s]} {APPT_STATUS_LABELS[s]}
        </span>
      ))}
    </div>
  );
}

function DiaView({ appts, patients, onStatus, onEditNote }: {
  appts: Appointment[]; patients: Record<string, PatientInfo>;
  onStatus: (id: string, status: string) => void;
  onEditNote: (a: Appointment) => void;
}) {
  if (appts.length === 0) {
    return <p className="rounded-xl bg-white p-6 text-center text-slate-400 shadow">Sin citas este día</p>;
  }
  return (
    <div className="space-y-2">
      {appts.map((a) => (
        <div key={a._id} title={bubble(a, patients[a.patientId])}
          className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow">
          <span className="font-mono font-semibold text-sky-800">{fmtTime(a.startAt)}–{fmtTime(a.endAt)}</span>
          <span className="flex-1 font-semibold">{patients[a.patientId]?.name ?? '…'}</span>
          <span className="max-w-40 truncate text-sm text-slate-500" title={a.reason}>{a.reason ?? ''}</span>
          <button onClick={() => onEditNote(a)}
            title={a.notes ? `Nota: ${a.notes}` : 'Agregar nota interna'}
            className={`max-w-48 truncate rounded px-2 py-0.5 text-xs ${a.notes ? 'bg-yellow-50 italic text-yellow-800' : 'text-slate-300 hover:text-slate-500'}`}>
            📝 {a.notes ?? 'nota'}
          </button>
          {a.lastReminderAt && (
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
              title={`Recordatorio enviado ${fmtTime(a.lastReminderAt)}`}>
              📣 {fmtTime(a.lastReminderAt)}
            </span>
          )}
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[a.status]}`}>
            {APPT_STATUS_ICONS[a.status]} {APPT_STATUS_LABELS[a.status]}
          </span>
          {(a.status === 'scheduled' || a.status === 'confirmed') && (
            <span className="flex gap-1 text-xs">
              {a.status === 'scheduled' && (
                <button onClick={() => onStatus(a._id, 'confirmed')} title="El paciente confirmó su asistencia"
                  className="rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700">✔️ Confirmó</button>
              )}
              <button onClick={() => onStatus(a._id, 'completed')} title="El paciente fue atendido"
                className="rounded bg-sky-600 px-2 py-1 text-white hover:bg-sky-700">✅ Atendida</button>
              <button onClick={() => { if (confirm('¿Marcar que el paciente NO se presentó?')) onStatus(a._id, 'no_show'); }}
                title="El paciente no llegó" className="rounded bg-amber-500 px-2 py-1 text-white hover:bg-amber-600">🚫 No vino</button>
              <button onClick={() => { if (confirm('¿Cancelar esta cita? El horario quedará libre.')) onStatus(a._id, 'cancelled'); }}
                title="Anular la cita" className="rounded bg-red-500 px-2 py-1 text-white hover:bg-red-600">✖️ Cancelar</button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function SemanaView({ monday, appts, patients, onSlotClick }: {
  monday: string; appts: Appointment[]; patients: Record<string, PatientInfo>;
  onSlotClick: (date: string, start: string, end: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const slots: string[] = [];
  for (let h = DAY_START; h < DAY_END; h++) {
    for (let m = 0; m < 60; m += SLOT_MIN) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  const hoy = toYMD(new Date());
  const cellAppts = (date: string, slot: string) =>
    appts.filter((a) => {
      const d = new Date(a.startAt);
      const local = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return toYMD(d) === date && local >= slot && local < addMinutes(slot, SLOT_MIN);
    });

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-14 border border-slate-100 bg-slate-50 px-1 py-2" />
            {days.map((d, i) => (
              <th key={d} className={`border border-slate-100 px-1 py-2 ${d === hoy ? 'bg-sky-100 text-sky-800' : 'bg-slate-50 text-slate-600'}`}>
                {DAY_NAMES[i]} {parseYMD(d).getDate()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot}>
              <td className="border border-slate-100 bg-slate-50 px-1 text-center font-mono text-slate-400">{slot}</td>
              {days.map((d) => {
                const cell = cellAppts(d, slot);
                return (
                  <td key={d} className="group h-8 border border-slate-100 p-0.5 align-top">
                    {cell.length > 0 ? (
                      cell.map((a) => (
                        <div key={a._id} title={bubble(a, patients[a.patientId])}
                          className={`cursor-help truncate rounded border px-1 py-0.5 font-semibold ${STATUS_STYLES[a.status]}`}>
                          {APPT_STATUS_ICONS[a.status]} {patients[a.patientId]?.name.split(',')[0] ?? '…'}
                        </div>
                      ))
                    ) : (
                      <button onClick={() => onSlotClick(d, slot, addMinutes(slot, SLOT_MIN))}
                        className="hidden h-full w-full items-center justify-center rounded bg-emerald-50 text-emerald-600 group-hover:flex"
                        title={`Agendar ${d} ${slot}`}>
                        +
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + min;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function MesView({ anchor, appts, onDayClick }: {
  anchor: string; appts: Appointment[]; onDayClick: (d: string) => void;
}) {
  const d = parseYMD(anchor);
  const start = mondayOf(toYMD(new Date(d.getFullYear(), d.getMonth(), 1)));
  const weeks: string[][] = [];
  let cursor = start;
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
    if (parseYMD(cursor).getMonth() !== d.getMonth() && w >= 4) break;
  }
  const hoy = toYMD(new Date());
  const countByDay: Record<string, { total: number; active: number }> = {};
  for (const a of appts) {
    const k = toYMD(new Date(a.startAt));
    countByDay[k] = countByDay[k] ?? { total: 0, active: 0 };
    countByDay[k].total++;
    if (a.status === 'scheduled' || a.status === 'confirmed') countByDay[k].active++;
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow">
      <table className="w-full text-sm">
        <thead>
          <tr>{DAY_NAMES.map((n) => <th key={n} className="border border-slate-100 bg-slate-50 py-2 text-slate-600">{n}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day) => {
                const inMonth = parseYMD(day).getMonth() === d.getMonth();
                const c = countByDay[day];
                return (
                  <td key={day} onClick={() => onDayClick(day)}
                    className={`h-20 cursor-pointer border border-slate-100 p-1 align-top hover:bg-sky-50 ${inMonth ? '' : 'bg-slate-50 text-slate-300'} ${day === hoy ? 'bg-sky-100' : ''}`}>
                    <p className="text-right font-semibold">{parseYMD(day).getDate()}</p>
                    {c && (
                      <span className="mt-1 inline-block rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {c.active > 0 ? `${c.active} citas` : `${c.total} (histór.)`}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 📣 Recordatorios masivos del día (mensaje predeterminado editable — Fabián) */
function RemindersPanel({ date, appts, patients, doctorName, templates, onTemplatesChange, onLogged, onClose }: {
  date: string;
  appts: Appointment[];
  patients: Record<string, PatientInfo>;
  doctorName: string;
  templates: MessageTemplate[];
  onTemplatesChange: (t: MessageTemplate[]) => void;
  onLogged: () => Promise<void>;
  onClose: () => void;
}) {
  const session = getSession();
  const isAdmin = session?.user.role === 'admin';
  const template = templates.find((t) => t.key === 'recordatorio_dia');
  const [editingTpl, setEditingTpl] = useState(false);
  const [tplBody, setTplBody] = useState(template?.body ?? '');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});

  // Solo citas que esperan al paciente (agendadas/confirmadas)
  const pending = appts.filter((a) => a.status === 'scheduled' || a.status === 'confirmed');

  const buildMsg = useCallback((a: Appointment) => {
    const info = patients[a.patientId];
    return fillTemplate(template?.body ?? '', {
      paciente: info?.firstName ?? 'paciente',
      clinica: session?.user.tenantName ?? 'la clínica',
      fecha: parseYMD(date).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }),
      hora: fmtTime(a.startAt),
      doctor: doctorName,
      motivo: a.reason ? ` Motivo: ${a.reason}.` : '',
    });
  }, [patients, template, session, date, doctorName]);

  async function persistTemplate() {
    await api('/templates/recordatorio_dia', { method: 'PUT', body: { body: tplBody } });
    onTemplatesChange(templates.map((t) => (t.key === 'recordatorio_dia' ? { ...t, body: tplBody, isCustom: true } : t)));
    setEditingTpl(false);
    setMessages({}); // regenera los mensajes con la plantilla nueva
  }

  async function markSent(a: Appointment) {
    setSent((s) => ({ ...s, [a._id]: true }));
    await api(`/appointments/${a._id}/reminder-sent`, { method: 'POST' }).catch(() => null);
    await onLogged();
  }

  return (
    <div className="mt-4 rounded-xl border-2 border-emerald-300 bg-white p-5 shadow">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-emerald-800">
          📣 Recordatorios del día — {pending.length} paciente(s) por recordar
        </h2>
        <div className="flex gap-2 text-sm">
          {isAdmin && !editingTpl && (
            <button onClick={() => { setTplBody(template?.body ?? ''); setEditingTpl(true); }}
              className="text-sky-600 hover:underline">✏️ Editar plantilla</button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕ Cerrar</button>
        </div>
      </div>

      {editingTpl && (
        <div className="mt-3 rounded-lg bg-sky-50 p-3">
          <p className="text-xs text-slate-500">
            Variables: {'{paciente} {clinica} {fecha} {hora} {doctor} {motivo}'}
          </p>
          <textarea rows={3} value={tplBody} onChange={(e) => setTplBody(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          <div className="mt-2 flex gap-2">
            <button onClick={() => void persistTemplate()}
              className="rounded bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700">
              Guardar plantilla
            </button>
            <button onClick={() => setEditingTpl(false)} className="text-sm text-slate-500">Cancelar</button>
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No hay citas agendadas/confirmadas pendientes hoy.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {pending.map((a) => {
            const info = patients[a.patientId];
            const msg = messages[a._id] ?? buildMsg(a);
            const link = waLink(info?.phone, msg);
            return (
              <div key={a._id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold">
                  {fmtTime(a.startAt)} · {info?.name ?? '…'}
                  <span className="ml-2 font-normal text-slate-400">{info?.phone ?? 'SIN TELÉFONO'}</span>
                  {(sent[a._id] || a.lastReminderAt) && (
                    <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">✔ enviado</span>
                  )}
                </p>
                <textarea rows={2} value={msg}
                  onChange={(e) => setMessages((m) => ({ ...m, [a._id]: e.target.value }))}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm" />
                <div className="mt-1 flex gap-2 text-xs">
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" onClick={() => void markSent(a)}
                      className="rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700">
                      📲 Enviar por WhatsApp
                    </a>
                  ) : (
                    <span className="rounded bg-slate-100 px-3 py-1.5 text-slate-400">Sin teléfono registrado</span>
                  )}
                  <button onClick={() => { void navigator.clipboard.writeText(msg); }}
                    className="rounded border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100">
                    📋 Copiar
                  </button>
                  <button onClick={() => void markSent(a)}
                    className="rounded border border-emerald-300 px-3 py-1.5 text-emerald-700 hover:bg-emerald-50">
                    ✔ Marcar enviado
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NuevaCitaForm({ doctors, defaultDoctorId, prefill, templates, onCreated }: {
  doctors: Professional[];
  defaultDoctorId: string;
  prefill: { date: string; start: string; end: string };
  templates: MessageTemplate[];
  onCreated: () => void;
}) {
  const session = getSession();
  const [patientSearch, setPatientSearch] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [f, setF] = useState({
    professionalId: defaultDoctorId,
    date: prefill.date, start: prefill.start, end: prefill.end,
    reason: '', requiredSpecialty: '', notes: '',
  });
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ warning: boolean; waUrl: string | null } | null>(null);

  useEffect(() => {
    setF((prev) => ({ ...prev, date: prefill.date, start: prefill.start, end: prefill.end }));
  }, [prefill]);

  useEffect(() => {
    api<string[]>('/professionals/specialties').then(setSpecialties).catch(() => null);
  }, []);

  useEffect(() => {
    if (patient || patientSearch.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api<Patient[]>(`/patients?search=${encodeURIComponent(patientSearch)}`)
        .then((r) => setResults(r.slice(0, 5))).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch, patient]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patient) { setError('Selecciona un paciente'); return; }
    setError(null);
    try {
      const res = await api<{ specialtyWarning: boolean }>('/appointments', {
        method: 'POST',
        body: {
          patientId: patient._id, professionalId: f.professionalId,
          startAt: `${f.date}T${f.start}:00`, endAt: `${f.date}T${f.end}:00`,
          reason: f.reason || undefined,
          notes: f.notes || undefined,
          requiredSpecialty: f.requiredSpecialty || undefined,
        },
      });
      // Requerimiento Fabián: enviar mensaje al paciente al agendar (wa.me)
      const tpl = templates.find((t) => t.key === 'cita_confirmacion');
      const msg = fillTemplate(tpl?.body ?? '', {
        paciente: patient.firstName,
        clinica: session?.user.tenantName ?? 'la clínica',
        fecha: parseYMD(f.date).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }),
        hora: f.start,
        doctor: doctors.find((d) => d._id === f.professionalId)?.fullName ?? '',
        motivo: f.reason ? ` Motivo: ${f.reason}.` : '',
      });
      setCreated({ warning: res.specialtyWarning, waUrl: waLink(patient.phone, msg) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  if (created) {
    return (
      <div className="mt-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5">
        <p className="font-semibold text-emerald-800">✔ Cita agendada</p>
        {created.warning && (
          <p className="mt-1 text-sm font-semibold text-amber-700">
            ⚠ El doctor NO tiene la especialidad requerida — revisar asignación.
          </p>
        )}
        <div className="mt-3 flex gap-2 text-sm">
          {created.waUrl ? (
            <a href={created.waUrl} target="_blank" rel="noreferrer"
              className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
              📲 Enviar confirmación por WhatsApp
            </a>
          ) : (
            <span className="rounded bg-white px-4 py-2 text-slate-400">Paciente sin teléfono registrado</span>
          )}
          <button onClick={onCreated} className="rounded border border-slate-300 bg-white px-4 py-2 hover:bg-slate-100">
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 rounded-xl bg-white p-5 shadow">
      <h2 className="font-semibold text-sky-800">Nueva cita — {f.date} {f.start}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="relative col-span-2 text-sm">
          Paciente *
          {patient ? (
            <p className="mt-1 flex items-center justify-between rounded border border-emerald-300 bg-emerald-50 px-3 py-2">
              {patient.lastName}, {patient.firstName}
              <button type="button" className="text-xs text-slate-500 hover:underline"
                onClick={() => { setPatient(null); setPatientSearch(''); }}>cambiar</button>
            </p>
          ) : (
            <>
              <input className={input} placeholder="Buscar paciente…" value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)} />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow">
                  {results.map((r) => (
                    <button type="button" key={r._id} onClick={() => setPatient(r)}
                      className="block w-full px-3 py-2 text-left hover:bg-sky-50">
                      {r.lastName}, {r.firstName} {r.documentNumber ? `· ${r.documentNumber}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <label className="text-sm">Doctor
          <select className={input} value={f.professionalId}
            onChange={(e) => setF({ ...f, professionalId: e.target.value })}>
            {doctors.map((d) => <option key={d._id} value={d._id}>{d.fullName}</option>)}
          </select>
        </label>
        <label className="text-sm">Especialidad requerida
          <select className={input} value={f.requiredSpecialty}
            onChange={(e) => setF({ ...f, requiredSpecialty: e.target.value })}>
            <option value="">—</option>
            {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm">Día
          <input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </label>
        <label className="text-sm">Desde
          <input type="time" className={input} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        </label>
        <label className="text-sm">Hasta
          <input type="time" className={input} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
        </label>
        <label className="text-sm">Motivo frecuente (ajusta duración)
          <select className={input} value=""
            onChange={(e) => {
              const preset = REASON_PRESETS.find((p) => p.label === e.target.value);
              if (preset) {
                setF({ ...f, reason: preset.label, end: addMinutes(f.start, preset.minutes) });
              }
            }}>
            <option value="">— elegir —</option>
            {REASON_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>{p.label} · {p.minutes} min</option>
            ))}
          </select>
        </label>
        <label className="text-sm">Motivo (editable)
          <input className={input} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </label>
        <label className="col-span-2 text-sm">📝 Nota interna (solo la ve el equipo)
          <input className={input} placeholder="ej. viene con su hija, traer radiografía…"
            value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </label>
      </div>

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" className="mt-4 rounded bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700">
        Agendar
      </button>
    </form>
  );
}
