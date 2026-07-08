// DONE: Comunicaciones Etapa A - enlaces wa.me con mensaje pre-escrito
// (ver docs/comunicaciones-y-seguimiento.md; Fase 2: envío automático Twilio)
export interface MessageTemplate {
  key: string;
  name: string;
  body: string;
  isCustom: boolean;
}

/** Rellena {variables} de una plantilla */
export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

/** Enlace de WhatsApp con mensaje listo (null si el paciente no tiene teléfono) */
export function waLink(phone: string | undefined | null, text: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
