// DONE: Paso 11.6 - inicio con resumen del día
// DONE: Auditoría UX A2/A3 - inicio POR ROL:
//   · Doctor → "Mi día": SUS citas de hoy con link a cada ficha + SU producción
//   · Recepción/Admin → botonera de acciones núcleo + resumen general
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSession, Session } from '@/lib/auth';
import { dayRangeISO } from '@/lib/dates';
import { fetchPatientInfo, PatientInfo } from '@/lib/lookups';
import { navForRole } from '@/lib/nav';
import {
  Appointment,
  APPT_STATUS_ICONS,
  APPT_STATUS_LABELS,
  fmtMoney,
  fmtTime,
  Patient,
  titleCase,
} from '@/lib/types';
import { fillTemplate, MessageTemplate, waLink } from '@/lib/whatsapp';

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const QUICK_ACTIONS = [
  { href: '/pacientes/nuevo', icon: '➕', label: 'Nuevo paciente', roles: ['admin', 'receptionist'] },
  { href: '/agenda', icon: '📅', label: 'Agendar cita', roles: ['admin', 'receptionist', 'doctor'] },
  { href: '/pagos', icon: '💳', label: 'Registrar pago', roles: ['admin', 'receptionist'] },
  { href: '/caja', icon: '🧾', label: 'Caja del día', roles: ['admin', 'receptionist'] },
];

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [stats, setStats] = useState<{ citasHoy: number; produccionMes: number; pacientes: number } | null>(null);
  const [citasHoy, setCitasHoy] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Record<string, PatientInfo>>({});
  const [cumpleaneros, setCumpleaneros] = useState<Patient[]>([]);
  const [tplCumple, setTplCumple] = useState<MessageTemplate | null>(null);

  useEffect(() => {
    const s = getSession();
    setSession(s);
    if (!s || s.user.role === 'super_admin') return;

    const esDoctor = s.user.role === 'doctor' && !!s.user.professionalId;
    const hoy = toYMD(new Date());
    const inicioMes = `${hoy.slice(0, 8)}01`;
    const filtroDoctor = esDoctor ? `&professionalId=${s.user.professionalId}` : '';
    const filtroProv = esDoctor ? `&providerId=${s.user.professionalId}` : '';
    const hoyRange = dayRangeISO(hoy);
    const mesRange = { from: dayRangeISO(inicioMes).from, to: hoyRange.to };

    void (async () => {
      const [citas, prod, pacientes, templates] = await Promise.all([
        api<Appointment[]>(`/appointments?from=${hoyRange.from}&to=${hoyRange.to}${filtroDoctor}`).catch(() => []),
        api<{ totalProduction: number }>(`/reports/production?from=${mesRange.from}&to=${mesRange.to}${filtroProv}`).catch(() => ({ totalProduction: 0 })),
        api<Patient[]>('/patients').catch(() => [] as Patient[]),
        api<MessageTemplate[]>('/templates').catch(() => [] as MessageTemplate[]),
      ]);
      const activas = citas.filter((c) => c.status === 'scheduled' || c.status === 'confirmed');
      setStats({ citasHoy: activas.length, produccionMes: prod.totalProduction, pacientes: pacientes.length });
      setCitasHoy(citas.filter((c) => c.status !== 'cancelled'));
      setPatients(await fetchPatientInfo(citas.map((a) => a.patientId)));

      // Idea #3: cumpleaños de HOY. Se compara el TEXTO "MM-DD" del ISO (no el
      // objeto Date: medianoche UTC retrocede un día en zonas UTC-)
      const mmddHoy = hoy.slice(5); // "MM-DD" local
      setCumpleaneros(
        pacientes.filter((p) => p.birthDate && p.birthDate.slice(5, 10) === mmddHoy),
      );
      setTplCumple(templates.find((t) => t.key === 'cumpleanos') ?? null);
    })();
  }, []);

  if (!session) return null;
  const role = session.user.role;
  const esSuperAdmin = role === 'super_admin';
  const esDoctor = role === 'doctor';
  const shortcuts = navForRole(role).filter((i) => i.href !== '/');
  const acciones = QUICK_ACTIONS.filter((a) => a.roles.includes(role));

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">
        Hola, {session.user.fullName.split(' ')[0]} 👋
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {esSuperAdmin ? 'Panel de plataforma' : esDoctor ? 'Tu día de hoy:' : 'Así viene el día:'}
      </p>

      {/* A3: acciones núcleo de recepción, botones grandes */}
      {!esSuperAdmin && acciones.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {acciones.map((a) => (
            <Link key={a.href} href={a.href}
              className="rounded-xl bg-sky-600 px-5 py-3 text-lg font-semibold text-white shadow transition hover:bg-sky-700">
              {a.icon} {a.label}
            </Link>
          ))}
        </div>
      )}

      {!esSuperAdmin && stats && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href="/agenda" className="rounded-xl bg-white p-4 shadow transition hover:shadow-md">
            <p className="text-xs text-slate-500">📅 {esDoctor ? 'Mis citas activas hoy' : 'Citas activas hoy'}</p>
            <p className="text-3xl font-bold text-sky-700">{stats.citasHoy}</p>
          </Link>
          <Link href="/produccion" className="rounded-xl bg-white p-4 shadow transition hover:shadow-md">
            <p className="text-xs text-slate-500">📈 {esDoctor ? 'Mi producción del mes' : 'Producción del mes'}</p>
            <p className="text-3xl font-bold text-emerald-700">${fmtMoney(stats.produccionMes)}</p>
          </Link>
          <Link href="/pacientes" className="rounded-xl bg-white p-4 shadow transition hover:shadow-md">
            <p className="text-xs text-slate-500">🧑‍🤝‍🧑 Pacientes</p>
            <p className="text-3xl font-bold text-slate-700">{stats.pacientes}</p>
          </Link>
        </div>
      )}

      {/* Idea #3: cumpleaños del día con saludo por WhatsApp (fideliza gratis) */}
      {!esSuperAdmin && (role === 'admin' || role === 'receptionist') && cumpleaneros.length > 0 && (
        <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-800">🎂 Cumpleaños de hoy</h2>
          <div className="mt-2 space-y-1 text-sm">
            {cumpleaneros.map((p) => {
              const edad = p.birthDate
                ? new Date().getFullYear() - Number(p.birthDate.slice(0, 4))
                : null;
              const msg = fillTemplate(tplCumple?.body ?? '¡Feliz cumpleaños, {paciente}! 🎂', {
                paciente: titleCase(p.firstName),
                clinica: titleCase(session.user.tenantName ?? 'la clínica'),
              });
              const link = waLink(p.phone, msg);
              return (
                <div key={p._id} className="flex items-center justify-between border-t border-amber-200 py-1.5 first:border-0">
                  <span>
                    <Link href={`/pacientes/${p._id}`} className="font-semibold text-sky-700 hover:underline">
                      {p.lastName}, {p.firstName}
                    </Link>
                    {edad !== null && <span className="ml-2 text-amber-700">cumple {edad} 🎉</span>}
                  </span>
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer"
                      className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                      📲 Saludar por WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">sin teléfono</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* A2: "Mi día" — la lista de trabajo del doctor con acceso directo a cada ficha */}
      {!esSuperAdmin && citasHoy.length > 0 && (
        <div className="mt-4 rounded-xl bg-white p-4 shadow">
          <h2 className="text-sm font-semibold text-slate-600">
            {esDoctor ? '🩺 Mi día — pacientes de hoy' : 'Citas de hoy'}
          </h2>
          <div className="mt-2 space-y-1 text-sm">
            {citasHoy.map((a) => (
              <div key={a._id} className="flex items-center justify-between border-t border-slate-100 py-1.5 first:border-0">
                <span>
                  <b className="font-mono">{fmtTime(a.startAt)}</b> ·{' '}
                  <Link href={`/pacientes/${a.patientId}`} className="font-semibold text-sky-700 hover:underline">
                    {patients[a.patientId]?.name ?? '…'}
                  </Link>
                  {a.reason && <span className="ml-2 text-slate-400">{a.reason}</span>}
                </span>
                <span className="text-xs">{APPT_STATUS_ICONS[a.status]} {APPT_STATUS_LABELS[a.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mt-6 text-sm font-semibold text-slate-600">Todos los módulos</h2>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href}
            className="rounded-xl bg-white p-4 shadow transition hover:shadow-md">
            <p className="font-semibold text-sky-800">{s.icon} {s.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
