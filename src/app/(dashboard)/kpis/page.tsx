// DONE: Idea #5 - Dashboard de KPIs del dueño (docs/ideas-mejoras.md)
// Producción · cobranza · aceptación de presupuestos · no-show · por doctor ·
// producción por día (barras CSS, sin librerías) · top procedimientos
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, apiDownload } from '@/lib/api';
import { dayRangeISO } from '@/lib/dates';
import { fmtMoney } from '@/lib/types';

interface Dashboard {
  production: {
    total: number; commission: number; count: number;
    byProvider: { providerId: string; name: string; total: number; commission: number; count: number }[];
    byDay: { date: string; total: number }[];
    topProcedures: { code: string; description: string; count: number; total: number }[];
  };
  collected: { total: number; count: number };
  appointments: {
    total: number; completed: number; cancelled: number; noShow: number;
    pending: number; noShowRate: number; cancelRate: number;
  };
  plans: { created: number; accepted: number; rejected: number; awaiting: number; acceptanceRate: number };
  newPatients: number;
}

const input =
  'mt-1 block rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function KpisPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [d, setD] = useState<Dashboard | null>(null);

  const load = useCallback(() => {
    const { from: f } = dayRangeISO(from);
    const { to: t } = dayRangeISO(to);
    api<Dashboard>(`/reports/dashboard?from=${f}&to=${t}`)
      .then(setD)
      .catch(() => setD(null));
  }, [from, to]);
  useEffect(load, [load]);

  const maxDay = Math.max(1, ...(d?.production.byDay.map((x) => x.total) ?? [1]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">📊 Dashboard</h1>
          <p className="text-sm text-slate-500">Los números de tu clínica, de un vistazo</p>
        </div>
        <div className="flex gap-2">
          <label className="text-sm">Desde
            <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">Hasta
            <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {/* Idea #9: los datos de la clínica son del cliente — respaldo total */}
          <button
            onClick={() => void apiDownload('/reports/backup.xlsx', 'respaldo-clinica.xlsx')}
            title="Descarga TODO: pacientes, procedimientos, citas, pagos y presupuestos (5 hojas)"
            className="self-end rounded border border-sky-600 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50">
            ⬇ Respaldo completo
          </button>
        </div>
      </div>

      {!d ? (
        <p className="mt-6 text-slate-400">Cargando indicadores…</p>
      ) : (
        <>
          {/* Fila 1: los 4 números que el dueño mira primero */}
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card label="💰 Producción" value={`$${fmtMoney(d.production.total)}`}
              hint={`${d.production.count} procedimientos`} color="text-sky-700" />
            <Card label="💵 Cobrado" value={`$${fmtMoney(d.collected.total)}`}
              hint={`${d.collected.count} pagos`} color="text-emerald-700" />
            <Card label="🤝 Comisiones" value={`$${fmtMoney(d.production.commission)}`}
              hint="a liquidar a doctores" color="text-amber-700" />
            <Card label="🧑‍🤝‍🧑 Pacientes nuevos" value={String(d.newPatients)}
              hint="en el periodo" color="text-slate-700" />
          </div>

          {/* Fila 2: aceptación de presupuestos + salud de la agenda */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow">
              <h3 className="text-sm font-semibold text-slate-600">📋 Aceptación de presupuestos</h3>
              <div className="mt-2 flex items-center gap-4">
                <p className={`text-4xl font-bold ${d.plans.acceptanceRate >= 50 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {d.plans.acceptanceRate}%
                </p>
                <div className="text-sm text-slate-500">
                  <p>✔ Aceptados: <b>{d.plans.accepted}</b></p>
                  <p>✖ Rechazados: <b>{d.plans.rejected}</b></p>
                  <p>⏳ En espera: <b>{d.plans.awaiting}</b> · Creados: {d.plans.created}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <h3 className="text-sm font-semibold text-slate-600">📅 Salud de la agenda ({d.appointments.total} citas)</h3>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center text-sm">
                <div><p className="text-2xl font-bold text-slate-700">{d.appointments.completed}</p><p className="text-xs text-slate-400">✅ atendidas</p></div>
                <div><p className="text-2xl font-bold text-sky-700">{d.appointments.pending}</p><p className="text-xs text-slate-400">🕐 pendientes</p></div>
                <div>
                  <p className={`text-2xl font-bold ${d.appointments.noShowRate > 15 ? 'text-red-600' : 'text-amber-600'}`}>{d.appointments.noShowRate}%</p>
                  <p className="text-xs text-slate-400">🚫 no-show ({d.appointments.noShow})</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{d.appointments.cancelRate}%</p>
                  <p className="text-xs text-slate-400">✖ canceladas ({d.appointments.cancelled})</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fila 3: producción por día (barras) */}
          {d.production.byDay.length > 0 && (
            <div className="mt-4 rounded-xl bg-white p-4 shadow">
              <h3 className="text-sm font-semibold text-slate-600">📈 Producción por día</h3>
              <div className="mt-3 flex h-32 items-end gap-1 overflow-x-auto">
                {d.production.byDay.map((day) => (
                  <div key={day.date} className="flex min-w-8 flex-1 flex-col items-center gap-1"
                    title={`${day.date}: $${fmtMoney(day.total)}`}>
                    <span className="text-[10px] text-slate-500">${fmtMoney(day.total)}</span>
                    <div className="w-full rounded-t bg-sky-500 transition hover:bg-sky-600"
                      style={{ height: `${Math.max(6, (day.total / maxDay) * 100)}%` }} />
                    <span className="text-[10px] text-slate-400">{day.date.slice(8)}/{day.date.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fila 4: por doctor + top procedimientos */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow">
              <h3 className="text-sm font-semibold text-slate-600">👩‍⚕️ Producción por doctor</h3>
              {d.production.byProvider.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">Sin producción en el periodo</p>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs text-slate-400">
                    <tr><th className="py-1">Doctor</th><th>Procs.</th><th className="text-right">Producción</th><th className="text-right">Comisión</th></tr>
                  </thead>
                  <tbody>
                    {d.production.byProvider.map((p) => (
                      <tr key={p.providerId} className="border-t border-slate-100">
                        <td className="py-1.5 font-semibold">{p.name}</td>
                        <td>{p.count}</td>
                        <td className="text-right">${fmtMoney(p.total)}</td>
                        <td className="text-right text-amber-700">${fmtMoney(p.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <h3 className="text-sm font-semibold text-slate-600">🏆 Top procedimientos</h3>
              {d.production.topProcedures.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">Sin datos en el periodo</p>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs text-slate-400">
                    <tr><th className="py-1">Código</th><th>Tratamiento</th><th>Veces</th><th className="text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {d.production.topProcedures.map((t) => (
                      <tr key={t.code} className="border-t border-slate-100">
                        <td className="py-1.5 font-mono">{t.code}</td>
                        <td>{t.description}</td>
                        <td>{t.count}</td>
                        <td className="text-right font-semibold">${fmtMoney(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400">{hint}</p>
    </div>
  );
}
