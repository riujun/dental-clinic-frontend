// DONE: Auditoría UX A1 - buscador global de pacientes en la barra superior
// (la acción más frecuente de recepción: 1 tecleo → ficha del paciente)
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Patient } from '@/lib/types';

export function PatientQuickSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(() => {
      api<Patient[]>(`/patients?search=${encodeURIComponent(q)}`)
        .then((r) => { setResults(r.slice(0, 6)); setOpen(true); })
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(id: string) {
    setQ(''); setOpen(false);
    router.push(`/pacientes/${id}`);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0]._id); }}
        placeholder="🔍 Buscar paciente por nombre o documento…"
        className="w-full rounded-full border border-sky-700 bg-sky-800/60 px-4 py-1.5 text-sm text-white placeholder-sky-300 focus:border-sky-300 focus:bg-white focus:text-slate-800 focus:placeholder-slate-400 focus:outline-none"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">Sin resultados</p>
          ) : (
            results.map((r) => (
              <button key={r._id} onClick={() => go(r._id)}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-sky-50">
                <b>{r.lastName}, {r.firstName}</b>
                <span className="ml-2 text-slate-400">{r.documentNumber ?? ''}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
