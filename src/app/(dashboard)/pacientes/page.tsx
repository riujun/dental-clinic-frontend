// DONE: Paso 11.5 - lista de pacientes con buscador (HU-P1: GET /patients?search=)
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate, Patient } from '@/lib/types';

export default function PacientesPage() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api<Patient[]>(`/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`)
        .then(setPatients)
        .catch(() => setPatients([]))
        .finally(() => setLoading(false));
    }, 300); // debounce
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
        <Link
          href="/pacientes/nuevo"
          className="rounded bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700"
        >
          + Nuevo paciente
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre, apellido o documento…"
        className="mt-4 w-full max-w-md rounded border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none"
      />

      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Registro</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>
            ) : patients.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                Sin resultados — crea el primer paciente
              </td></tr>
            ) : (
              patients.map((p) => (
                <tr key={p._id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-4 py-3">
                    <Link href={`/pacientes/${p._id}`} className="font-semibold text-sky-700 hover:underline">
                      {p.lastName}, {p.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.documentNumber ?? '—'}</td>
                  <td className="px-4 py-3">{p.phone ?? '—'}</td>
                  <td className="px-4 py-3">{fmtDate(p.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
