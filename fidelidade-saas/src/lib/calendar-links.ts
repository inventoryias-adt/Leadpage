/** Links para o cliente levar o agendamento para o calendário do celular (arquivo .ics e Google Agenda) e a rota até o lugar. */

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeIcs = (t: string) => t.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Corta linhas longas em 75 caracteres, como pede o formato (continuação começa com um espaço). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

export type CalendarEvent = { uid: string; title: string; startsAt: Date; endsAt: Date; location?: string | null; description?: string | null };

/** Arquivo .ics de um único compromisso, com um alerta 1 hora antes. */
export function buildIcs(e: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fidelize//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}@fidelize`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    ...(e.location ? [`LOCATION:${escapeIcs(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${escapeIcs(e.description)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(e.title)}`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Link "Adicionar ao Google Agenda". */
export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${stamp(e.startsAt)}/${stamp(e.endsAt)}` });
  if (e.location) q.set('location', e.location);
  if (e.description) q.set('details', e.description);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Link "Como chegar" (abre o mapa do celular já com o endereço). */
export const directionsUrl = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
