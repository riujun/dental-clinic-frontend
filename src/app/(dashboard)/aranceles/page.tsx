// DONE: Paso 11.5b - aranceles: listas de precios, import Excel (HU-A1),
// plantilla descargable, aumento % con preview (HU-A3)
// DONE: Ajustes finos (Fabián 2026-07-03, ver docs/manual-operacion.md):
//   - Onboarding guiado: sin lista aún → "Crea tu primera lista de precios"
//     (antes las cajas de import quedaban ocultas y no se veía el botón)
//   - Edición por ítem ✏️ (nombre/categoría/precio/activo) — PATCH con audit
'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, apiDownload } from '@/lib/api';
import { fmtMoney } from '@/lib/types';

interface FeeSchedule { _id: string; name: string; type: string; isDefault: boolean }
interface FeeItem { _id: string; code: string; name: string; category?: string; price: number; active: boolean }
interface ImportResult { processed: number; upserted: number; modified: number; errors: { row: number; error: string }[] }

const input =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

export default function ArancelesPage() {
  const [schedules, setSchedules] = useState<FeeSchedule[] | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [items, setItems] = useState<FeeItem[]>([]);
  const [search, setSearch] = useState('');
  const [showNewList, setShowNewList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    setConnectionError(false);
    const list = await api<FeeSchedule[]>('/fee-schedules');
    setSchedules(list);
    setCurrentId((prev) => prev || (list.find((s) => s.isDefault) ?? list[0])?._id || '');
    return list;
  }, []);
  useEffect(() => {
    // Distinguir "sin listas" (onboarding) de "servidor caído" (error claro)
    void loadSchedules().catch(() => { setConnectionError(true); setSchedules(null); });
  }, [loadSchedules]);

  if (connectionError) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Aranceles</h1>
        <div className="mx-auto mt-10 max-w-lg rounded-xl border-2 border-red-300 bg-red-50 p-8 text-center">
          <p className="text-4xl">🔌</p>
          <h2 className="mt-2 text-lg font-bold text-red-800">No se pudo conectar con el servidor</h2>
          <p className="mt-1 text-sm text-red-700">
            El backend (puerto 4000) no está respondiendo. Inicia el sistema con
            <b> INICIAR.bat</b> (carpeta del proyecto) y reintenta.
          </p>
          <button onClick={() => void loadSchedules().catch(() => setConnectionError(true))}
            className="mt-4 rounded bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const loadItems = useCallback(async () => {
    if (!currentId) { setItems([]); return; }
    setItems(await api<FeeItem[]>(
      `/fee-schedules/${currentId}/items${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ));
  }, [currentId, search]);
  useEffect(() => {
    const t = setTimeout(() => void loadItems().catch(() => setItems([])), 300);
    return () => clearTimeout(t);
  }, [loadItems]);

  if (schedules === null) return <p className="text-slate-400">Cargando…</p>;

  // Onboarding: clínica sin listas todavía → guiar el primer paso
  if (schedules.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Aranceles</h1>
        <div className="mx-auto mt-10 max-w-lg rounded-xl border-2 border-dashed border-sky-300 bg-white p-8 text-center shadow">
          <p className="text-4xl">💲</p>
          <h2 className="mt-2 text-lg font-bold text-sky-800">Crea tu primera lista de precios</h2>
          <p className="mt-1 text-sm text-slate-500">
            Aquí vivirán tus procedimientos y valores. Después de crearla podrás
            <b> subir tu Excel</b> con todo el arancel de una vez (o cargar ítems a mano).
          </p>
          <NewListForm onCreated={async (id) => { await loadSchedules(); setCurrentId(id); }} autoFocus />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Aranceles</h1>
        <div className="flex items-end gap-2">
          <label className="text-sm">Lista de precios
            <select className={input} value={currentId} onChange={(e) => setCurrentId(e.target.value)}>
              {schedules.map((s) => (
                <option key={s._id} value={s._id}>{s.name}{s.isDefault ? ' ★' : ''}</option>
              ))}
            </select>
          </label>
          <button onClick={() => setShowNewList((v) => !v)}
            className="rounded border border-sky-600 px-3 py-2 text-sm text-sky-700 hover:bg-sky-50">
            + Nueva lista
          </button>
        </div>
      </div>

      {showNewList && (
        <div className="mt-3 max-w-md rounded-xl bg-white p-4 shadow">
          <NewListForm onCreated={async (id) => {
            await loadSchedules();
            setCurrentId(id);
            setShowNewList(false);
          }} />
        </div>
      )}

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {currentId && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <ImportBox scheduleId={currentId} onImported={loadItems} />
          <IncreaseBox scheduleId={currentId} onApplied={loadItems} />
          <AddItemBox scheduleId={currentId} onAdded={loadItems} />
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por código, nombre o categoría…"
        className="mt-4 w-full max-w-md rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
      />

      <div className="mt-3 overflow-hidden rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Procedimiento</th>
              <th className="px-4 py-3">Categoría</th><th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                Sin ítems — usa 📥 Importar Excel (arriba) o agrega uno manual
              </td></tr>
            ) : items.map((i) => (
              <ItemRow key={i._id} item={i} onSaved={loadItems} onError={setError} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Crear lista de precios (reemplaza el prompt() — más claro y funciona siempre) */
function NewListForm({ onCreated, autoFocus }: { onCreated: (id: string) => Promise<void>; autoFocus?: boolean }) {
  const [name, setName] = useState('Lista general');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null); setSaving(true);
    try {
      const created = await api<FeeSchedule>('/fee-schedules', { method: 'POST', body: { name } });
      await onCreated(created._id);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo conectar con el servidor — inicia el sistema con INICIAR.bat y reintenta',
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3">
      <div className="flex gap-2">
        <input autoFocus={autoFocus} required value={name} onChange={(e) => setName(e.target.value)}
          placeholder='Ej: "Lista general"'
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
        <button type="submit" disabled={saving}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
          {saving ? 'Creando…' : 'Crear lista'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}

/** Fila con edición inline ✏️ (todo editable por el admin — pedido de Fabián) */
function ItemRow({ item, onSaved, onError }: {
  item: FeeItem; onSaved: () => Promise<void>; onError: (e: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ name: item.name, category: item.category ?? '', price: String(item.price), active: item.active });
  const [saving, setSaving] = useState(false);

  async function save() {
    onError(null); setSaving(true);
    try {
      await api(`/fee-schedules/items/${item._id}`, {
        method: 'PATCH',
        body: { name: f.name, category: f.category || undefined, price: Number(f.price), active: f.active },
      });
      setEditing(false);
      await onSaved();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  if (!editing) {
    return (
      <tr className={`border-t border-slate-100 ${item.active ? '' : 'text-slate-300'}`}>
        <td className="px-4 py-2 font-mono">{item.code}</td>
        <td className="px-4 py-2">{item.name}{item.active ? '' : ' (inactivo)'}</td>
        <td className="px-4 py-2">{item.category ?? '—'}</td>
        <td className="px-4 py-2 text-right font-semibold">${fmtMoney(item.price)}</td>
        <td className="px-4 py-2 text-right">
          <button onClick={() => { setF({ name: item.name, category: item.category ?? '', price: String(item.price), active: item.active }); setEditing(true); }}
            title="Editar nombre, categoría, precio o desactivar"
            className="text-sky-600 hover:underline">✏️ Editar</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100 bg-sky-50">
      <td className="px-4 py-2 font-mono">{item.code}</td>
      <td className="px-4 py-2">
        <input className="w-full rounded border border-slate-300 px-2 py-1" value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })} />
      </td>
      <td className="px-4 py-2">
        <input className="w-full rounded border border-slate-300 px-2 py-1" value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })} />
      </td>
      <td className="px-4 py-2 text-right">
        <input type="number" min={0} step="0.01" className="w-24 rounded border border-slate-300 px-2 py-1 text-right"
          value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      </td>
      <td className="px-4 py-2 text-right text-xs">
        <label className="mr-2 inline-flex items-center gap-1">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          activo
        </label>
        <button onClick={() => void save()} disabled={saving}
          className="rounded bg-sky-600 px-2 py-1 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
          Guardar
        </button>
        <button onClick={() => setEditing(false)} className="ml-1 text-slate-500 hover:underline">Cancelar</button>
      </td>
    </tr>
  );
}

function ImportBox({ scheduleId, onImported }: { scheduleId: string; onImported: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Selecciona un archivo .xlsx'); return; }
    setError(null); setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      setResult(await api<ImportResult>(`/fee-schedules/${scheduleId}/import`, { method: 'POST', formData: fd }));
      await onImported();
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al importar');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border-2 border-sky-200 bg-white p-4 shadow">
      <h3 className="font-semibold text-sky-800">📥 Importar Excel</h3>
      <p className="mt-1 text-xs text-slate-500">
        Sube todo tu arancel de una vez. Headers: code, name, category, price, specialties ·{' '}
        <button className="font-semibold text-sky-600 hover:underline"
          onClick={() => void apiDownload('/fee-schedules/template.xlsx', 'plantilla-aranceles.xlsx')}>
          ⬇ descargar plantilla
        </button>
      </p>
      <input ref={fileRef} type="file" accept=".xlsx" className="mt-2 w-full text-xs" />
      <button onClick={upload} disabled={busy}
        className="mt-2 rounded bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
        {busy ? 'Importando…' : 'Importar y guardar'}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {result && (
        <div className="mt-2 rounded bg-slate-50 p-2 text-xs">
          <p>✔ Procesados: {result.processed} · Nuevos: {result.upserted} · Actualizados: {result.modified}</p>
          {result.errors.length > 0 && (
            <ul className="mt-1 text-red-600">
              {result.errors.map((e, i) => <li key={i}>Fila {e.row}: {e.error}</li>)}
            </ul>
          )}
          <p className="mt-1 text-slate-400">Re-subir el mismo Excel actualiza por código (no duplica).</p>
        </div>
      )}
    </div>
  );
}

function IncreaseBox({ scheduleId, onApplied }: { scheduleId: string; onApplied: () => Promise<void> }) {
  const [percent, setPercent] = useState('10');
  const [preview, setPreview] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(confirm: boolean) {
    setMsg(null);
    try {
      const r = await api<{ affected: number; applied: boolean }>(
        `/fee-schedules/${scheduleId}/increase`,
        { method: 'POST', body: { percent: Number(percent), confirm } },
      );
      if (!confirm) { setPreview(r.affected); return; }
      setPreview(null);
      setMsg(`✔ Aplicado ${percent}% a ${r.affected} ítems (los presupuestos emitidos NO cambian)`);
      await onApplied();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error');
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <h3 className="font-semibold text-sky-800">% Aumento masivo</h3>
      <div className="mt-2 flex items-end gap-2">
        <label className="text-sm">Porcentaje
          <input type="number" className={input} value={percent} onChange={(e) => { setPercent(e.target.value); setPreview(null); }} />
        </label>
        <button onClick={() => void run(false)}
          className="rounded border border-sky-600 px-3 py-2 text-sm text-sky-700 hover:bg-sky-50">
          Previsualizar
        </button>
      </div>
      {preview !== null && (
        <div className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-800">
          Afectará a <b>{preview}</b> ítems activos. ¿Confirmar?
          <button onClick={() => void run(true)}
            className="ml-2 rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700">
            Confirmar aumento
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}
    </div>
  );
}

function AddItemBox({ scheduleId, onAdded }: { scheduleId: string; onAdded: () => Promise<void> }) {
  const [f, setF] = useState({ code: '', name: '', category: '', price: '' });
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api(`/fee-schedules/${scheduleId}/items`, {
        method: 'POST',
        body: { code: f.code, name: f.name, category: f.category || undefined, price: Number(f.price) },
      });
      setF({ code: '', name: '', category: '', price: '' });
      await onAdded();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error');
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-white p-4 shadow">
      <h3 className="font-semibold text-sky-800">➕ Agregar ítem manual</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input required placeholder="Código" className={input} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <input required placeholder="Precio" type="number" step="0.01" className={input} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <input required placeholder="Nombre" className={`${input} col-span-2`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input placeholder="Categoría" className={`${input} col-span-2`} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
      </div>
      <button type="submit" className="mt-2 rounded bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700">
        Agregar
      </button>
      {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
    </form>
  );
}
