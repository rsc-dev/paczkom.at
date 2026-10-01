/** "Today" on the card is the Polish calendar day, whatever the server's zone. */
const ZONE = 'Europe/Warsaw';

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function parts(ms: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of PARTS.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') {
      out[part.type] = Number(part.value);
    }
  }
  return out;
}

const pad = (n: number | undefined): string => String(n ?? 0).padStart(2, '0');

export function warsawDay(ms: number): string {
  const p = parts(ms);
  return `${String(p['year'])}-${pad(p['month'])}-${pad(p['day'])}`;
}

export function warsawHour(ms: number): string {
  return `${pad(parts(ms)['hour'])}:00`;
}

/** Warsaw's UTC offset at an instant, in ms (3 600 000 or 7 200 000). */
function offsetAt(ms: number): number {
  const p = parts(ms);
  const asUtc = Date.UTC(p['year'] ?? 0, (p['month'] ?? 1) - 1, p['day'] ?? 1, p['hour'] ?? 0, p['minute'] ?? 0, p['second'] ?? 0);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** `2026-10-01 17:20:21` in Warsaw time → epoch ms. GIOŚ timestamps look like this. */
export function warsawLocalToMs(local: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (match === null) {
    return null;
  }
  const [, y, mo, d, h, mi, s] = match;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  // Two passes settle the offset on either side of a DST switch.
  const first = naive - offsetAt(naive);
  return naive - offsetAt(first);
}
