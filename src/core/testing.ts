/** A sample card shared by tests. Imported only by tests. */
import type { TownCard } from './publish.js';

export const CARD: TownCard = {
  slug: 'krakow', name: 'Kraków', level: 4, pm25: 48, pm10: 70, source: 'citizen', sensorCount: 7,
  lowConfidence: false, worstToday: { level: 5, hour: '08:00' }, levelYesterday: 3, percentileBetter: 36,
  updatedAt: '2026-10-01T15:25:00.000Z',
};
