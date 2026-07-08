// DONE: Paso 11.5b - armado de presupuesto (HU-B1): ítems desde el arancel con
// precio autocompletado pero EDITABLE (snapshot), total en vivo, guarda como DRAFT
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { fmtMoney, Patient } from '@/lib/types';

interface FeeSchedule { _id: string; name: string; isDefault: boolean }
interface FeeItem { _id: string; code: string; name: string; category?: string; price: number }
interface CartItem {
  feeItemId?: string; code: string; description: string; category?: string;
  unitPrice: number; quantity: number; discount: number; toothFdi: string; priority: number;
}

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

export default function NuevoPresupuestoPage() {
  const router = useRouter();
  const [patientSearch, setPatientSearch] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [title, setTitle] = useState('Plan de tratamiento');
  const [scheduleId, setScheduleId] = useState('');
  const [feeSearch, setFeeSearch] = useState('');
  const [feeResults, setFeeResults] = useState<FeeItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<FeeSchedule[]>('/fee-schedules').then((list) => {
      setScheduleId((list.find((s) => s.isDefault) ?? list[0])?._id ?? '');
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (patient || patientSearch.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api<Patient[]>(`/patients?search=${encodeURIComponent(patientSearch)}`)
        .then((r) => setResults(r.slice(0, 5))).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch, patient]);

  useEffect(() => {
    if (!scheduleId || feeSearch.trim().length < 1) { setFeeResults([]); return; }
    const t = setTimeout(() => {
      api<FeeItem[]>(`/fee-schedules/${scheduleId}/items?search=${encodeURIComponent(feeSearch)}`)
        .then((r) => setFeeResults(r.slice(0, 6))).catch(() => setFeeResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [feeSearch, scheduleId]);

  const addFromFee = (f: FeeItem) => {
    setCart((c) => [...c, {
      feeItemId: f._id, code: f.code, description: f.name, category: f.category,
      unitPrice: f.price, quantity: 1, discount: 0, toothFdi: '', priority: 1,
    }]);
    setFeeSearch(''); setFeeResults([]);
  };

  const setItem = (i: number, patch: Partial<CartItem>) =>
    setCart((c) => c.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const total = cart.reduce((s, i) => s + i.unitPrice * i.quantity - i.discount, 0);

  async function save() {
    if (!patient) { setError('Selecciona un paciente'); return; }
    if (cart.length === 0) { setError('Agrega al menos un ítem'); return; }
    setError(null); setSaving(true);
    try {
      const created = await api<{ _id: string }>('/treatment-plans', {
        method: 'POST',
        body: {
          patientId: patient._id,
          title,
          items: cart.map((i) => ({
            feeItemId: i.feeItemId, code: i.code, description: i.description,
            category: i.category, unitPrice: i.unitPrice, quantity: i.quantity,
            discount: i.discount, toothFdi: i.toothFdi || undefined, priority: i.priority,
          })),
        },
      });
      router.push(`/presupuestos/${created._id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-800">Nuevo presupuesto</h1>

      <div className="mt-4 grid gap-3 rounded-xl bg-white p-5 shadow md:grid-cols-2">
        <div className="relative text-sm">
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
        <label className="text-sm">Título
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
      </div>

      <div className="mt-4 rounded-xl bg-white p-5 shadow">
        <h2 className="font-semibold text-sky-800">Ítems del plan</h2>
        <div className="relative mt-2 max-w-md text-sm">
          <input className={input} placeholder="Buscar procedimiento en el arancel…"
            value={feeSearch} onChange={(e) => setFeeSearch(e.target.value)} />
          {feeResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow">
              {feeResults.map((f) => (
                <button type="button" key={f._id} onClick={() => addFromFee(f)}
                  className="block w-full px-3 py-2 text-left hover:bg-sky-50">
                  <span className="font-mono">{f.code}</span> {f.name}
                  <span className="float-right font-semibold">${fmtMoney(f.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">Código</th><th>Descripción</th><th>Diente</th>
                <th>Cant.</th><th>Precio unit.</th><th>Desc.</th>
                <th className="text-right">Subtotal</th><th />
              </tr>
            </thead>
            <tbody>
              {cart.map((i, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="py-2 font-mono">{i.code}</td>
                  <td>{i.description}</td>
                  <td><input className="w-16 rounded border border-slate-300 px-2 py-1" value={i.toothFdi}
                    placeholder="11" onChange={(e) => setItem(idx, { toothFdi: e.target.value })} /></td>
                  <td><input type="number" min={1} className="w-16 rounded border border-slate-300 px-2 py-1"
                    value={i.quantity} onChange={(e) => setItem(idx, { quantity: Number(e.target.value) || 1 })} /></td>
                  <td><input type="number" min={0} step="0.01" className="w-24 rounded border border-slate-300 px-2 py-1"
                    value={i.unitPrice} onChange={(e) => setItem(idx, { unitPrice: Number(e.target.value) || 0 })} /></td>
                  <td><input type="number" min={0} step="0.01" className="w-20 rounded border border-slate-300 px-2 py-1"
                    value={i.discount} onChange={(e) => setItem(idx, { discount: Number(e.target.value) || 0 })} /></td>
                  <td className="text-right font-semibold">
                    ${fmtMoney(i.unitPrice * i.quantity - i.discount)}
                  </td>
                  <td className="text-right">
                    <button onClick={() => setCart((c) => c.filter((_, x) => x !== idx))}
                      className="text-red-500 hover:underline">quitar</button>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold">
                <td colSpan={6} className="py-2 text-right">TOTAL</td>
                <td className="text-right">${fmtMoney(total)}</td><td />
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex gap-3">
        <button onClick={save} disabled={saving}
          className="rounded bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar borrador'}
        </button>
        <button onClick={() => router.back()} className="rounded px-4 py-2 text-slate-500 hover:bg-slate-200">
          Cancelar
        </button>
      </div>
    </div>
  );
}
