/**
 * Polish catalogue — the default language.
 *
 * Wording note: the machine is an "automat paczkowy". "Paczkomat" is a
 * registered mark of a parcel-locker operator and must not appear in copy.
 */
export const pl = {
  'app.tagline': 'Ty jesteś pamięcią automatu paczkowego.',

  'title.play': 'Dzisiaj',
  'title.howto': 'Jak grać',
  'title.streak': 'Seria: {count}',
  'title.best': 'Rekord: {score}',
  'title.noStreak': 'Dziś jeszcze bez gry',
  'title.noStorage': 'Ta przeglądarka nie zapamięta serii',

  'howto.title': 'Jak grać',
  'howto.step1': 'Rozładunek: dotknij skrytki, w której zmieści się paczka.',
  'howto.step2': 'Obsługa: zapamiętaj, gdzie co leży, i otwórz właściwe drzwiczki.',
  'howto.step3': 'Sprzątanie: opróżnij oznaczone skrytki i zamknij dzień.',
  'howto.hintNote': 'Po pomyłce albo po chwili zwłoki podpowiemy kolor, a potem kolumnę.',
  'howto.back': 'Wróć',

  'hud.phase.load': 'Rozładunek',
  'hud.phase.serve': 'Obsługa',
  'hud.phase.sweep': 'Sprzątanie',
  'hud.parcelsLeft': 'Paczki: {count}',
  'hud.queue': 'Kolejka: {count}',
  'hud.sound': 'Dźwięk',

  'a11y.wall': 'Ściana skrytek',
  'door.label': 'Skrytka {id}, rozmiar {size}, {state}',
  'door.state.empty': 'pusta',
  'door.state.full': 'zajęta',
  'door.state.open': 'otwarta',
  'door.state.outgoing': 'paczka do nadania',
  'door.state.expired': 'paczka nieodebrana',
  'door.state.marked': 'do opróżnienia',

  'screen.pickup': 'Odbiór',
  'screen.sender': 'Nadanie',
  'screen.senderNeeds': 'Potrzebuje skrytki: {size}',
  'screen.nextUp': 'Następne',
  'screen.loadPrompt': 'Włóż paczkę do skrytki',
  'screen.sweepPrompt': 'Opróżnij oznaczone skrytki',
  'screen.sweepRemaining': 'Zostało: {count}',
  'screen.idle': 'Nikogo nie ma. Na razie.',
  'screen.thisParcel': 'Ta paczka',

  // The sticker half is a whole phrase per sticker, because Polish will not
  // take one preposition for all of them („z naklejką strzałka” is not Polish).
  'hint.colour': 'ten {colour}',
  'hint.colourSticker': 'ten {colour} {sticker}',
  'hint.sticker.fragile': 'z napisem „Ostrożnie”',
  'hint.sticker.arrow': 'ze strzałką',
  'hint.sticker.bang': 'z wykrzyknikiem',

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

  'result.time': 'Czas',
  'result.streak': 'Seria',
  'result.best': 'Rekord',
  'result.official': 'Dzisiejszy wynik',
  'result.practice': 'Trening — dzisiejszy wynik zostaje bez zmian',
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

  'title.week': 'Tydzień',
  'title.weekBest': 'Najlepszy tydzień: {score}',

  'day.mon': 'Pn',
  'day.tue': 'Wt',
  'day.wed': 'Śr',
  'day.thu': 'Cz',
  'day.fri': 'Pt',
  'day.sat': 'So',
  'day.full.mon': 'Poniedziałek',
  'day.full.tue': 'Wtorek',
  'day.full.wed': 'Środa',
  'day.full.thu': 'Czwartek',
  'day.full.fri': 'Piątek',
  'day.full.sat': 'Sobota',

  'hud.lateVan': 'Auto się spóźnia',
  'hud.stars': 'Gwiazdki: {count} z {total}',

  'screen.forgottenCode': 'Nie pamięta kodu',
  'screen.describes': '{size} · {look}',
  'screen.jammed': 'Zacięte drzwiczki',

  'week.dayDone': 'Koniec dnia',
  'week.nextDay': 'Następny dzień',
  'week.title': 'Niedziela',
  'week.total': 'Razem',
  'week.best': 'Najlepszy tydzień',
  'week.newBest': 'Nowy rekord tygodnia',
  'week.retry': 'Ten sam tydzień',
  'week.new': 'Nowy tydzień',
  'week.starsLost': 'Stracone gwiazdki: {count}',
  'week.noStarsLost': 'Bez strat',
  'week.share.mode': 'Tydzień',
  'week.incidents': 'Co kosztowało gwiazdki',
  'week.incident.unplaced': 'Paczki zostawione w aucie: {count}',
  'week.incident.refused': 'Nadania bez skrytki: {count}',
  'week.incident.walked': 'Odbiory, które odeszły: {count}',

  'fail.title': 'Reklamacja',
  'fail.lead': 'Gwiazdki się skończyły. Tydzień zamknięty.',
  'fail.dayReached': 'Koniec w dniu: {day}',

  'howto.step4': 'Od czwartku coś się psuje: drzwiczki się zacinają, ktoś gubi kod, deszcz rozmazuje cyfrę.',
  'howto.step5': 'W Tygodniu masz trzy gwiazdki. Każda paczka zostawiona w aucie, każda odmowa i każde odejście kosztuje jedną.',

  'lang.pl': 'Polski',
  'lang.en': 'English',
  'lang.switchTo': 'Przełącz na: {lang}',
} as const;

export type MessageKey = keyof typeof pl;
