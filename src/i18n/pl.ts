/**
 * Polish catalogue — the default language.
 *
 * Wording note: the operator's registered mark for parcel lockers must not
 * appear in copy; the machine is an "automat paczkowy".
 */
export const pl = {
  'meta.tagline': 'Łap rzucane paczki i noś je do automatu. Gra w stylu konsolek LCD.',
  'lang.toggle': 'EN',
  'btn.left': 'W lewo',
  'btn.right': 'W prawo',
  'unit.one': 'pkt',
  'unit.many': 'pkt',
  'live.hearts': 'Serca: {count}',
  'btn.gameA': 'GRA A',
  'btn.gameB': 'GRA B',
  'btn.clock': 'CZAS',
  'btn.sound': 'Dźwięk',
  'lcd.game': 'GRA',
  'lcd.label': 'Ekran gry',
  'slip.over': 'Koniec zmiany: {points} {unit} · rekord: {record}',
  'slip.newRecord': 'Nowy rekord!',
  'slip.share': 'Udostępnij',
  'slip.shared': 'Udostępniono.',
  'slip.copied': 'Skopiowano do schowka.',
  'slip.manual': 'Skopiuj tekst poniżej.',
  'share.game': 'Gra {mode}',
  'live.score': 'Punkty: {score}',
  'live.over': 'Koniec zmiany.',
  'help.keys': 'Klawisze: A/D lub ←/→ — w lewo i w prawo, 1–5 na klawiaturze numerycznej. Automat jest na prawym końcu. Spacja: gra A, B: gra B.',
} as const;

export type MessageKey = keyof typeof pl;
