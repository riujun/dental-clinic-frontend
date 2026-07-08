// DONE: Paso 11.5 - layout del dashboard: guard de sesión + sidebar por rol + logout
// DONE: Paso 11.6 (pulido UX) - iconos, responsive (hamburguesa en móvil), print
// DONE: Auditoría UX - marca propia (brand.ts) + buscador global de pacientes (A1)
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { PatientQuickSearch } from '@/components/patient-search';
import { clearSession, getSession, Session } from '@/lib/auth';
import { APP_ICON, APP_NAME } from '@/lib/brand';
import { navForRole } from '@/lib/nav';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  doctor: 'Doctor/a',
  receptionist: 'Recepción',
  assistant: 'Asistente',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    setSessionState(s);
    setReady(true);
  }, [router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Cargando…
      </div>
    );
  }

  const items = navForRole(session.user.role);
  const showSearch = session.user.role !== 'super_admin';

  const sidebar = (
    <>
      <div className="px-4 py-5">
        <p className="text-lg font-bold">{APP_ICON} {APP_NAME}</p>
        <p className="truncate text-xs text-sky-300">{session.user.fullName}</p>
        <p className="text-xs text-sky-400">
          {ROLE_LABELS[session.user.role]}
          {session.user.tenantName && session.user.role !== 'super_admin'
            ? ` · ${session.user.tenantName}` : ''}
        </p>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.hint}
            className={`block rounded px-3 py-2 text-sm hover:bg-sky-800 ${
              pathname === item.href ? 'bg-sky-700 font-semibold' : ''
            }`}
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <button
        onClick={() => {
          clearSession();
          router.replace('/login');
        }}
        className="m-2 rounded px-3 py-2 text-left text-sm text-sky-200 hover:bg-sky-800"
      >
        ⏻ Cerrar sesión
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar escritorio */}
      <aside className="print:hidden hidden w-56 flex-col bg-sky-900 text-white md:flex">
        {sidebar}
      </aside>

      {/* Menú móvil */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <aside className="flex w-64 flex-col bg-sky-900 text-white shadow-xl">{sidebar}</aside>
          <button aria-label="Cerrar menú" className="flex-1 bg-black/40" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {/* Barra superior: buscador global (A1) + cerrar sesión siempre visible */}
        <header className="print:hidden flex items-center gap-3 bg-sky-900 px-4 py-2.5 text-white">
          <button aria-label="Abrir menú" onClick={() => setMenuOpen(true)} className="text-xl md:hidden">☰</button>
          <p className="font-bold md:hidden">{APP_ICON} {APP_NAME}</p>
          {showSearch && <PatientQuickSearch />}
          <button
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
            title={`Cerrar la sesión de ${session.user.fullName}`}
            className="ml-auto shrink-0 rounded-full border border-sky-700 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-800 hover:text-white"
          >
            ⏻ Salir
          </button>
        </header>
        <main className="flex-1 overflow-x-auto p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
