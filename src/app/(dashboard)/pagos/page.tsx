// DONE: Paso 11.5c - pagos: registrar abono (con aplicación opcional a
// procedimientos), historial con anulación (los pagos no se borran)
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fetchPatientNames } from '@/lib/lookups';
import { AccountStatement, fmtDate, fmtMoney, Patient } from '@/lib/types';

interface Payment {
  _id: string; patientId: string; amount: number; method: string;
  paidAt: string; status: 'active' | 'voided'; notes?: string; voidReason?: string;
}
interface CompletedProc { procedureId: string; code: string; description: string; value: number; isRefund: boolean }

export const dynamic = 'force-dynamic';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', check: 'Cheque', other: 'Otro',
};

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

export default function PagosPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api<Payment[]>('/payments');
    setPayments(list);
    setNames(await fetchPatientNames(list.map((p) => p.patientId)));
  }, []);
  useEffect(() => { void load().catch(() => null); }, [load]);

  async function voidPayment(id: string) {
    const reason = prompt('Motivo de la anulación:');
    if (reason === null) return;
    setError(null);
    try {
      await api(`/payments/${id}/void`, { method: 'POST', body: { reason: reason || undefined } });
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Pagos</h1>
      {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <NuevoPagoForm onCreated={load} />

      <h2 className="mt-6 font-semibold text-slate-700">Historial</h2>
      <div className="mt-2 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Método</th><th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin pagos registrados</td></tr>
            ) : payments.map((p) => (
              <tr key={p._id} className={`border-t border-slate-100 ${p.status === 'voided' ? 'text-slate-400 line-through' : ''}`}>
                <td className="px-4 py-2">{fmtDate(p.paidAt)}</td>
                <td className="px-4 py-2">{names[p.patientId] ?? '…'}</td>
                <td className="px-4 py-2">{METHOD_LABELS[p.method] ?? p.method}</td>
                <td className="px-4 py-2 text-right font-semibold">${fmtMoney(p.amount)}</td>
                <td className="px-4 py-2 no-underline">
                  {p.status === 'voided'
                    ? <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 no-underline">Anulado{p.voidReason ? `: ${p.voidReason}` : ''}</span>
                    : <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Activo</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  {p.status === 'active' && (
                    <button onClick={() => void voidPayment(p._id)} className="text-xs text-red-500 hover:underline">
                      Anular
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NuevoPagoForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [patientSearch, setPatientSearch] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [account, setAccount] = useState<AccountStatement | null>(null);
  const [charges, setCharges] = useState<CompletedProc[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [apps, setApps] = useState<Record<string, string>>({}); // procedureId → monto
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (patient || patientSearch.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api<Patient[]>(`/patients?search=${encodeURIComponent(patientSearch)}`)
        .then((r) => setResults(r.slice(0, 5))).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch, patient]);

  useEffect(() => {
    if (!patient) { setAccount(null); setCharges([]); return; }
    api<AccountStatement>(`/patients/${patient._id}/account`).then((a) => {
      setAccount(a);
      setCharges((a.charges as CompletedProc[]).filter((c) => !c.isRefund && c.value > 0));
    }).catch(() => null);
  }, [patient]);

  async function submit() {
    if (!patient) { setError('Selecciona un paciente'); return; }
    setError(null); setOk(false);
    const applications = Object.entries(apps)
      .filter(([, v]) => Number(v) > 0)
      .map(([procedureId, v]) => ({ procedureId, amount: Number(v) }));
    try {
      await api('/payments', {
        method: 'POST',
        body: {
          patientId: patient._id,
          amount: Number(amount),
          method,
          applications: applications.length > 0 ? applications : undefined,
        },
      });
      setOk(true); setAmount(''); setApps({});
      const a = await api<AccountStatement>(`/patients/${patient._id}/account`);
      setAccount(a);
      await onCreated();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  return (
    <div className="mt-4 rounded-xl bg-white p-5 shadow">
      <h2 className="font-semibold text-sky-800">Registrar pago</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
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
                      {r.lastName}, {r.firstName}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <label className="text-sm">Monto *
          <input type="number" min="0.01" step="0.01" className={input} value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="text-sm">Método
          <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      {account && (
        <p className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm">
          Estado de cuenta: cargos <b>${fmtMoney(account.totalCharges)}</b> · abonos{' '}
          <b className="text-emerald-700">${fmtMoney(account.totalPayments)}</b> · saldo{' '}
          <b className={account.balance > 0 ? 'text-red-600' : 'text-emerald-600'}>${fmtMoney(account.balance)}</b>
        </p>
      )}

      {charges.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-sky-700">Aplicar a procedimientos (opcional)</summary>
          <div className="mt-2 space-y-1">
            {charges.map((c) => (
              <label key={c.procedureId} className="flex items-center gap-2">
                <span className="flex-1">{c.code} {c.description} (${fmtMoney(c.value)})</span>
                <input type="number" min="0" step="0.01" placeholder="0"
                  className="w-28 rounded border border-slate-300 px-2 py-1"
                  value={apps[c.procedureId] ?? ''}
                  onChange={(e) => setApps({ ...apps, [c.procedureId]: e.target.value })} />
              </label>
            ))}
          </div>
        </details>
      )}

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {ok && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✔ Pago registrado</p>}

      <button onClick={() => void submit()}
        className="mt-3 rounded bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700">
        Registrar pago
      </button>
    </div>
  );
}
