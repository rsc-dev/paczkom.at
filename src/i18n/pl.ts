/**
 * Polish catalogue — the default language.
 *
 * Wording note: the operator's registered mark for parcel lockers must not
 * appear in copy; this site uses no data of theirs.
 */
export const pl = {
  'app.tagline': 'Jakość powietrza w Twoim mieście, co godzinę.',
  'lang.toggle': 'EN',

  'load.loading': 'Wczytywanie…',
  'load.failed': 'Brak danych — spróbuj za chwilę.',
  'load.retry': 'Spróbuj ponownie',

  'picker.title': 'Twoje miasto',
  'picker.placeholder': 'Wpisz nazwę miasta',
  'picker.noMatch': 'Nie znamy takiego miasta. Mamy miasta od 5 000 mieszkańców.',
  'picker.locate': 'Użyj mojej lokalizacji',
  'picker.locating': 'Szukam…',
  'picker.locateFailed': 'Nie udało się ustalić lokalizacji.',

  'level.1': 'Bardzo dobry',
  'level.2': 'Dobry',
  'level.3': 'Umiarkowany',
  'level.4': 'Dostateczny',
  'level.5': 'Zły',
  'level.6': 'Bardzo zły',
  'level.of': '{level}/6',

  'card.noData': 'Brak danych dla tego miasta w tej godzinie.',
  'card.pm25': 'PM2,5: {value} µg/m³',
  'card.pm10': 'PM10: {value} µg/m³',
  'card.trend.worse': 'gorzej niż wczoraj ↑',
  'card.trend.better': 'lepiej niż wczoraj ↓',
  'card.trend.same': 'tak samo jak wczoraj =',
  'card.worstToday': 'Najgorzej dziś: {level} o {hour}',
  'card.percentile': 'Lepiej niż {percent}% miast w Polsce',
  'card.source.gios': 'Oficjalna stacja GIOŚ',
  'card.source.citizenOne': 'Jeden czujnik obywatelski',
  'card.source.citizen': 'Mediana {count} czujników obywatelskich',
  'card.lowConfidence': 'niska pewność',
  'card.updated': 'aktualizacja {time}',
  'card.share': 'Udostępnij',
  'card.change': 'Zmień miasto',
  'card.ranking': 'Ranking Polski',
  'card.makeMine': 'Ustaw jako moje miasto',
  'card.shared': 'Udostępniono.',
  'card.copied': 'Skopiowano do schowka.',
  'card.manual': 'Skopiuj tekst poniżej.',

  'stale.warning': 'Dane z {time} — odświeżanie się opóźnia.',

  'ranking.title': 'Polska teraz',
  'ranking.median': 'Mediana: {level}',
  'ranking.best': 'Najczyściej',
  'ranking.worst': 'Najgorzej',
  'ranking.count': '{level}: {count}',
  'ranking.back': 'Wróć',

  'game.retired': 'Gra została wyłączona.',
  'footer.attribution': 'Dane: GIOŚ, Sensor.Community (ODbL), GeoNames (CC BY 4.0).',
} as const;

export type MessageKey = keyof typeof pl;
