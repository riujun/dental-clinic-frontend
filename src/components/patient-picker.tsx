// DONE: Item #4 pedido por Fabián (agenda) - buscar paciente y, si no existe,
// poder crearlo ahí mismo sin salir del flujo (ej. al agendar una cita)
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Patient } from '@/lib/types';

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

export function PatientPicker({ patient, onSelect, placeholder }: {
  patient: Patient | null;
  onSelect: (p: Patient | null) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searched, setSearched] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (patient || search.trim().length < 2) { setResults([]); setSearched(false); return; }
    setSearched(false);
    const t = setTimeout(() => {
      api<Patient[]>(`/patients?search=${encodeURIComponent(search)}`)
        .then((r) => { setResults(r.slice(0, 5)); setSearched(true); })
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search, patient]);

  if (patient) {
    return (
      <p className="mt-1 flex items-center justify-between rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
        {patient.lastName}, {patient.firstName}
        <button type="button" className="text-xs text-slate-500 hover:underline"
          onClick={() => { onSelect(null); setSearch(''); setShowCreate(false); }}>cambiar</button>
      </p>
    );
  }

  if (showCreate) {
    return (
      <QuickCreatePatient
        initialName={search}
        onCreated={(p) => { onSelect(p); setShowCreate(false); }}
        onCancel={() => setShowCreate(false)}
      />
    );
  }

  const sinResultados = searched && results.length === 0 && search.trim().length >= 2;

  return (
    <div className="relative">
      <input className={input} placeholder={placeholder ?? 'Buscar paciente…'} value={search}
        onChange={(e) => setSearch(e.target.value)} />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow">
          {results.map((r) => (
            <button type="button" key={r._id} onClick={() => onSelect(r)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-sky-50">
              {r.lastName}, {r.firstName} {r.documentNumber ? `· ${r.documentNumber}` : ''}
            </button>
          ))}
        </div>
      )}
      {sinResultados && (
        <div className="absolute z-10 mt-1 w-full rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="text-amber-800">No se encontró a &quot;{search}&quot;.</p>
          <button type="button" onClick={() => setShowCreate(true)}
            className="mt-1 rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700">
            ➕ Crear paciente nuevo
          </button>
        </div>
      )}
    </div>
  );
}

function QuickCreatePatient({ initialName, onCreated, onCancel }: {
  initialName: string;
  onCreated: (p: Patient) => void;
  onCancel: () => void;
}) {
  const parts = initialName.trim().split(/\s+/);
  const [f, setF] = useState({
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    phone: '',
    documentNumber: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null); setSaving(true);
    try {
      const created = await api<Patient>('/patients', {
        method: 'POST',
        body: {
          firstName: f.firstName, lastName: f.lastName,
          phone: f.phone || undefined,
          documentNumber: f.documentNumber || undefined,
        },
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear el paciente');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 text-sm">
      <p className="font-semibold text-emerald-800">➕ Nuevo paciente</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input required placeholder="Nombre *" className={input} value={f.firstName}
          onChange={(e) => setF({ ...f, firstName: e.target.value })} />
        <input required placeholder="Apellido *" className={input} value={f.lastName}
          onChange={(e) => setF({ ...f, lastName: e.target.value })} />
        <input placeholder="Teléfono (+56…)" className={input} value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input placeholder="Documento" className={input} value={f.documentNumber}
          onChange={(e) => setF({ ...f, documentNumber: e.target.value })} />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={saving}
          className="rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? 'Creando…' : 'Crear y usar'}
        </button>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:underline">Cancelar</button>
      </div>
    </form>
  );
}
