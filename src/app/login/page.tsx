// DONE: Paso 11.3 - login por clínica (subdominio) — ver docs/auth-multitenancy.md
// En producción el campo clínica se autocompleta del subdominio de la URL;
// en localhost se escribe manualmente (o queda vacío para super_admin).
'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Session, setSession } from '@/lib/auth';
import { APP_ICON, APP_NAME, APP_TAGLINE } from '@/lib/brand';

export default function LoginPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Autocompleta la clínica SOLO cuando hay un dominio propio real
  // (sonrisas.tudominio.com → "sonrisas"). Dominios de plataforma (Vercel,
  // localhost, IPs) NO tienen subdominio de clínica — ahí se recuerda la
  // última usada manualmente. Sin esto, "proyecto-hash.vercel.app" se leía
  // como si "proyecto-hash" fuera el nombre de la clínica.
  const [tenantFromUrl, setTenantFromUrl] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    const isPlatformDomain =
      host.endsWith('.vercel.app') ||
      host === 'localhost' ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(host); // IP directa (ej. preview local)
    const parts = host.split('.');
    if (!isPlatformDomain && parts.length >= 3 && parts[0] !== 'www') {
      setTenant(parts[0]);
      setTenantFromUrl(true);
    } else {
      setTenant(localStorage.getItem('dental.lastTenant') ?? '');
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await api<Session>('/auth/login', {
        method: 'POST',
        body: { email, password, tenant: tenant.trim() || undefined },
      });
      setSession(session);
      // Recordar la clínica para el próximo ingreso (solo en localhost)
      if (tenant.trim()) localStorage.setItem('dental.lastTenant', tenant.trim());
      router.push(session.user.role === 'super_admin' ? '/plataforma' : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-sky-700">{APP_ICON} {APP_NAME}</h1>
          <p className="text-sm text-slate-500">{APP_TAGLINE}</p>
        </div>

        {/* En producción el campo no se muestra: la clínica viene en la URL */}
        {tenantFromUrl ? (
          <p className="rounded bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Clínica: <b>{tenant}</b>
          </p>
        ) : (
          <label className="block text-sm">
            <span className="text-slate-600">Clínica</span>
            <input
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              placeholder="nombre corto de tu clínica (ej. sonrisas)"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Te lo entrega la plataforma al crear tu clínica. En producción viene en tu
              dirección web (sonrisas.tudominio.com) y no se pregunta. Déjalo vacío solo
              si eres administrador de la plataforma.
            </span>
          </label>
        )}

        <label className="block text-sm">
          <span className="text-slate-600">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-600">Contraseña</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none"
          />
        </label>

        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-sky-600 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
