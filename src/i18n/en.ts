import type { MessageKey } from './pl.js';

export const en: Readonly<Record<MessageKey, string>> = {
  'app.tagline': 'Air quality in your town, every hour.',
  'lang.toggle': 'PL',

  'load.loading': 'Loading…',
  'load.failed': 'No data — try again in a moment.',
  'load.retry': 'Try again',

  'picker.title': 'Your town',
  'picker.placeholder': 'Type a town name',
  'picker.noMatch': 'We do not know that town. We cover towns of 5,000 people and up.',
  'picker.locate': 'Use my location',
  'picker.locating': 'Locating…',
  'picker.locateFailed': 'Could not find your location.',

  'level.1': 'Very good',
  'level.2': 'Good',
  'level.3': 'Moderate',
  'level.4': 'Sufficient',
  'level.5': 'Bad',
  'level.6': 'Very bad',
  'level.of': '{level}/6',

  'card.noData': 'No data for this town this hour.',
  'card.pm25': 'PM2.5: {value} µg/m³',
  'card.pm10': 'PM10: {value} µg/m³',
  'card.trend.worse': 'worse than yesterday ↑',
  'card.trend.better': 'better than yesterday ↓',
  'card.trend.same': 'same as yesterday =',
  'card.worstToday': 'Worst today: {level} at {hour}',
  'card.percentile': 'Better than {percent}% of towns in Poland',
  'card.source.gios': 'Official GIOŚ station',
  'card.source.giosPmOne': 'PM: one citizen sensor',
  'card.source.giosPm': 'PM: median of {count} citizen sensors',
  'card.source.citizenOne': 'One citizen sensor',
  'card.source.citizen': 'Median of {count} citizen sensors',
  'card.lowConfidence': 'low confidence',
  'card.updated': 'updated {time}',
  'card.share': 'Share',
  'card.change': 'Change town',
  'card.ranking': 'Poland ranking',
  'card.makeMine': 'Make this my town',
  'card.shared': 'Shared.',
  'card.copied': 'Copied to the clipboard.',
  'card.manual': 'Copy the text below.',

  'stale.warning': 'Data from {time} — the refresh is delayed.',

  'ranking.title': 'Poland now',
  'ranking.median': 'Median: {level}',
  'ranking.best': 'Cleanest',
  'ranking.worst': 'Worst',
  'ranking.count': '{level}: {count}',
  'ranking.back': 'Back',

  'game.retired': 'The game has been retired.',
  'footer.attribution':
    'Data: Chief Inspectorate of Environmental Protection (GIOŚ), Sensor.Community (ODbL), GeoNames (CC BY 4.0).',
};
