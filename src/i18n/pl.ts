/**
 * Polish catalogue — the default language.
 *
 * Wording note: the machine is an "automat paczkowy". "Paczkomat" is a
 * registered mark of a parcel-locker operator and must not appear in copy.
 */
export const pl = {
  'app.title': 'paczkom.at',
  'app.tagline': 'Ty jesteś pamięcią automatu paczkowego.',

  'title.play': 'Dzisiaj',
  'title.howto': 'Jak grać',
  'title.streak': 'Seria: {count}',
  'title.best': 'Rekord: {score}',
  'title.noStreak': 'Dziś jeszcze nie grałeś',

  'howto.title': 'Jak grać',
  'howto.step1': 'Rozładunek: dotknij skrytki, w której zmieści się paczka.',
  'howto.step2': 'Obsługa: zapamiętaj, gdzie co leży, i otwórz właściwe drzwiczki.',
  'howto.step3': 'Sprzątanie: opróżnij oznaczone skrytki i zamknij dzień.',
  'howto.hintNote': 'Po pomyłce albo po chwili zwłoki podpowiemy kolor, a potem kolumnę.',
  'howto.back': 'Wróć',

  'hud.phase.load': 'Rozładunek',
  'hud.phase.serve': 'Obsługa',
  'hud.phase.sweep': 'Sprzątanie',
  'hud.score': 'Punkty',
  'hud.time': 'Czas',
  'hud.parcelsLeft': 'Paczki: {count}',
  'hud.queue': 'Kolejka: {count}',
  'hud.mute': 'Wycisz',
  'hud.unmute': 'Włącz dźwięk',
  'hud.language': 'Język',

  'screen.pickup': 'Odbiór',
  'screen.sender': 'Nadanie',
  'screen.code': 'Kod',
  'screen.senderNeeds': 'Potrzebuje skrytki: {size}',
  'screen.nextUp': 'Następne',
  'screen.loadPrompt': 'Włóż paczkę do skrytki',
  'screen.sweepPrompt': 'Opróżnij oznaczone skrytki',
  'screen.idle': 'Nikogo nie ma. Na razie.',

  'hint.colour': 'ten {colour}',
  'hint.colourSticker': 'ten {colour} z naklejką {sticker}',

  'colour.red': 'czerwony',
  'colour.orange': 'pomarańczowy',
  'colour.yellow': 'żółty',
  'colour.green': 'zielony',
  'colour.blue': 'niebieski',
  'colour.violet': 'fioletowy',

  'sticker.none': 'bez naklejki',
  'sticker.fragile': 'ostrożnie',
  'sticker.arrow': 'strzałka',
  'sticker.bang': 'wykrzyknik',

  'size.A': 'mała',
  'size.B': 'średnia',
  'size.C': 'duża',

  'result.title': 'Dzień zamknięty',
  'result.daily': 'Dzisiaj #{number}',
  'result.score': 'Wynik',
  'result.time': 'Czas',
  'result.streak': 'Seria',
  'result.best': 'Rekord',
  'result.official': 'Dzisiejszy wynik',
  'result.practice': 'Trening — dzisiejszy wynik zostaje bez zmian',
  'result.practiceScore': 'Trening: {score}',
  'result.playAgain': 'Zagraj jeszcze raz',
  'result.served': 'Obsłużeni: {count}',
  'result.hinted': 'Z podpowiedzią: {count}',
  'result.walked': 'Odeszli: {count}',
  'result.refused': 'Bez skrytki: {count}',
  'result.unplaced': 'Zostały w aucie: {count}',
  'result.wrongTaps': 'Pomyłki: {count}',
  'result.home': 'Na start',

  'share.button': 'Udostępnij',
  'share.mode.daily': 'Dzisiaj',
  'share.points': 'pkt',
  'share.shared': 'Udostępniono',
  'share.copied': 'Skopiowano do schowka',
  'share.manual': 'Skopiuj tekst poniżej',

  'lang.pl': 'Polski',
  'lang.en': 'English',
  'lang.toggle': 'PL / EN',
} as const;

export type MessageKey = keyof typeof pl;
