// DONE: Fix bug crítico de zona horaria (Fabián 2026-07-08): construir fechas
// SIEMPRE con el constructor local de Date + toISOString(), nunca con
// template strings "YYYY-MM-DDTHH:mm:00" crudos. Esos strings sin offset se
// interpretan según la zona horaria del RUNTIME que los parsea — el navegador
// al mostrarlos, pero el SERVIDOR al recibirlos. Railway corre en UTC; una
// clínica en Chile (UTC-4/-3) agendando "10:30" terminaba guardado como
// 10:30 UTC = 06:30 hora de Chile. Reproducido y confirmado antes de este fix.
//
// Regla de la casa: el navegador SIEMPRE sabe la hora local real del usuario
// (Date() la lee del sistema operativo) — por eso construir el Date ahí y
// convertir a ISO/UTC con toISOString() es correcto sin importar en qué zona
// horaria corra el backend.

/** "2026-07-07" + "10:30" (hora LOCAL del navegador) → ISO UTC correcto */
export function localToISO(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm, ss] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm ?? 0, ss ?? 0).toISOString();
}

/** Rango [00:00:00.000, 23:59:59.999] de un día LOCAL, en ISO UTC correcto —
 *  usar para filtros "citas/producción/pagos de tal día o rango" */
export function dayRangeISO(dateStr: string): { from: string; to: string } {
  return {
    from: localToISO(dateStr, '00:00:00'),
    to: localToISO(dateStr, '23:59:59'),
  };
}

/** "Hoy" en fecha LOCAL del navegador como YYYY-MM-DD. NUNCA usar
 *  `new Date().toISOString().slice(0,10)` para esto: toISOString() primero
 *  convierte a UTC, así que de noche en Chile (UTC-4/-3) ya muestra la
 *  fecha de MAÑANA. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD de "hace n días" en fecha LOCAL del navegador */
export function daysAgoLocal(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
