import { describe, expect, it } from 'vitest';
import { LEVEL_EMOJI, buildAirShareText, townUrl } from './share.js';

describe('buildAirShareText', () => {
  const base = {
    townName: 'Kraków', when: '1 paź, 17:00', level: 4 as const, levelLabel: 'Dostateczny',
    pm25Line: 'PM2,5: 48 µg/m³', trendLine: 'gorzej niż wczoraj ↑',
    percentileLine: 'Lepiej niż 36% miast w Polsce', slug: 'krakow',
  };

  it('builds the five-line card', () => {
    expect(buildAirShareText(base)).toBe(
      [
        'paczkom.at · Kraków · 1 paź, 17:00',
        '🟠 Dostateczny (4/6)',
        'PM2,5: 48 µg/m³ · gorzej niż wczoraj ↑',
        'Lepiej niż 36% miast w Polsce',
        'https://paczkom.at/krakow',
      ].join('\n'),
    );
  });

  it('omits what it does not know', () => {
    expect(buildAirShareText({ ...base, pm25Line: null, percentileLine: null }).split('\n')).toEqual([
      'paczkom.at · Kraków · 1 paź, 17:00',
      '🟠 Dostateczny (4/6)',
      'gorzej niż wczoraj ↑',
      'https://paczkom.at/krakow',
    ]);
    expect(buildAirShareText({ ...base, trendLine: null }).split('\n')[2]).toBe('PM2,5: 48 µg/m³');
  });
});

describe('emoji and URL', () => {
  it('has an emoji per level and a path URL per town', () => {
    expect(Object.keys(LEVEL_EMOJI)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(townUrl('nowy-targ')).toBe('https://paczkom.at/nowy-targ');
  });
});
