// DONE: Comunicaciones Etapa A (requerimiento Fabián): seguimiento de pacientes
// que CANCELARON o NO LLEGARON, para recontactarlos por WhatsApp y reagendar
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { dayRangeISO, daysAgoLocal, todayLocal } from '@/lib/dates';
import { fetchPatientInfo, PatientInfo } from '@/lib/lookups';
import {
  Appointment,
  APPT_STATUS_ICONS,
  APPT_STATUS_LABELS,
  fmtDate,
  fmtTime,
  titleCase,
} from '@/lib/types';
import { fillTemplate, MessageTemplate, waLink } from '@/lib/whatsapp';

const input =
  'mt-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

interface CancelledAppt extends Appointment {
  cancelReason?: string;
}

export default function SeguimientoPage() {
  const session = getSession();
  const [from, setFrom] = useState(daysAgoLocal(30));
  const [to, setTo] = useState(todayLocal());
  const [rows, setRows] = useState<CancelledAppt[]>([]);
  const [patients, setPatients] = useState<Record<string, PatientInfo>>({});
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [contacted, setContacted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api<MessageTemplate[]>('/templates')
      .then((ts) => setTemplate(ts.find((t) => t.key === 'seguimiento_reagendar') ?? null))
      .catch(() => null);
  }, []);

  const load = useCallback(async () => {
    const { from: f } = dayRangeISO(from);
    const { to: t } = dayRangeISO(to);
    const q = `from=${f}&to=${t}`;
    const [cancelled, noShow] = await Promise.all([
      api<CancelledAppt[]>(`/appointments?status=cancelled&${q}`),
      api<CancelledAppt[]>(`/appointments?status=no_show&${q}`),
    ]);
    const all = [...cancelled, ...noShow].sort((a, b) => b.startAt.localeCompare(a.startAt));
    setRows(all);
    setPatients(await fetchPatientInfo(all.map((a) => a.patientId)));
  }, [from, to]);
  useEffect(() => { void load().catch(() => null); }, [load]);

  const buildMsg = (a: CancelledAppt) =>
    fillTemplate(template?.body ?? '', {
      paciente: titleCase(patients[a.patientId]?.firstName ?? 'paciente'),
      clinica: titleCase(session?.user.tenantName ?? 'la clínica'),
    });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Seguimiento</h1>
          <p className="text-sm text-slate-500">
            Pacientes que cancelaron o no llegaron — contáctalos para reagendar
          </p>
        </div>
        <div className="flex gap-2">
          <label className="text-sm">Desde
            <input type="date" className={`${input} block`} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">Hasta
            <input type="date" className={`${input} block`} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Cita original</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Motivo cita</th>
              <th className="px-4 py-3">Qué pasó</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                🎉 Sin cancelaciones ni inasistencias en el periodo
              </td></tr>
            ) : rows.map((a) => {
              const info = patients[a.patientId];
              const link = waLink(info?.phone, buildMsg(a));
              return (
                <tr key={a._id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{fmtDate(a.startAt)} {fmtTime(a.startAt)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/pacientes/${a.patientId}`} className="font-semibold text-sky-700 hover:underline">
                      {info?.name ?? '…'}
                    </Link>
                  </td>
                  <td className="max-w-40 truncate px-4 py-2" title={a.reason}>{a.reason ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}
                      title={a.cancelReason ? `Motivo: ${a.cancelReason}` : undefined}>
                      {APPT_STATUS_ICONS[a.status]} {APPT_STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2">{info?.phone ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {contacted[a._id] ? (
                      <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">✔ contactado</span>
                    ) : link ? (
                      <a href={link} target="_blank" rel="noreferrer"
                        onClick={() => setContacted((c) => ({ ...c, [a._id]: true }))}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                        📲 Contactar para reagendar
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">sin teléfono</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
