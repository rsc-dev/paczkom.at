// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CARD } from '../core/testing.js';
import { setLang } from '../i18n/index.js';
import { cardModel, cardNodes, isStale, renderCard, shareTextFor } from './card.js';
import { mountApp } from './testing.js';

beforeEach(() => {
  setLang('pl');
  mountApp();
});

describe('cardModel', () => {
  it('describes a graded town in Polish', () => {
    expect(cardModel(CARD, 'pl')).toEqual({
      town: 'Kraków', level: 4, levelLabel: 'Dostateczny', levelOf: '4/6',
      pm: 'PM2,5: 48 µg/m³ · PM10: 70 µg/m³', trend: 'gorzej niż wczoraj ↑',
      worst: 'Najgorzej dziś: Zły o 08:00', percentile: 'Lepiej niż 36% miast w Polsce',
      source: 'Mediana 7 czujników obywatelskich · aktualizacja 17:25', noData: false,
    });
  });

  it('handles GIOŚ with citizen PM, one sensor, low confidence and no history', () => {
    // CARD has pm25/pm10 and sensorCount 7: a GIOŚ town whose PM values come
    // from the median of its citizen sensors must say so (spec §1).
    expect(cardModel({ ...CARD, source: 'gios' }, 'en').source).toBe(
      'Official GIOŚ station · PM: median of 7 citizen sensors · updated 17:25',
    );
    expect(cardModel({ ...CARD, sensorCount: 1, lowConfidence: true }, 'pl').source).toBe(
      'Jeden czujnik obywatelski · niska pewność · aktualizacja 17:25',
    );
    const fresh = cardModel({ ...CARD, levelYesterday: null, worstToday: null }, 'pl');
    expect([fresh.trend, fresh.worst]).toEqual([null, null]);
    expect(cardModel({ ...CARD, levelYesterday: 4 }, 'pl').trend).toBe('tak samo jak wczoraj =');
    expect(cardModel({ ...CARD, levelYesterday: 6 }, 'pl').trend).toBe('lepiej niż wczoraj ↓');
  });

  it('says there is no data instead of guessing', () => {
    const model = cardModel({ ...CARD, level: null, pm25: null, pm10: null, source: 'none', percentileBetter: null }, 'pl');
    expect(model).toMatchObject({ noData: true, levelLabel: 'Brak danych dla tego miasta w tej godzinie.', levelOf: '', pm: null, percentile: null });
  });
});

describe('sourceLine on GIOŚ towns measured by citizen sensors', () => {
  it('labels the PM line as a citizen-sensor median, in both languages', () => {
    expect(cardModel({ ...CARD, source: 'gios' }, 'pl').source).toBe(
      'Oficjalna stacja GIOŚ · PM: mediana 7 czujników obywatelskich · aktualizacja 17:25',
    );
    expect(cardModel({ ...CARD, source: 'gios' }, 'en').source).toBe(
      'Official GIOŚ station · PM: median of 7 citizen sensors · updated 17:25',
    );
  });

  it('uses the one-sensor variant', () => {
    expect(cardModel({ ...CARD, source: 'gios', sensorCount: 1 }, 'pl').source).toBe(
      'Oficjalna stacja GIOŚ · PM: jeden czujnik obywatelski · aktualizacja 17:25',
    );
    expect(cardModel({ ...CARD, source: 'gios', sensorCount: 1 }, 'en').source).toBe(
      'Official GIOŚ station · PM: one citizen sensor · updated 17:25',
    );
  });

  it('says nothing extra when a GIOŚ town has no citizen PM data', () => {
    expect(cardModel({ ...CARD, source: 'gios', pm25: null, pm10: null, sensorCount: 0 }, 'en').source).toBe(
      'Official GIOŚ station · updated 17:25',
    );
    expect(cardModel({ ...CARD, source: 'gios', sensorCount: 0 }, 'en').source).toBe('Official GIOŚ station · updated 17:25');
  });
});

describe('renderCard', () => {
  it('writes the level as data, label and number — never colour alone', () => {
    const nodes = cardNodes(document);
    renderCard(nodes, cardModel(CARD, 'pl'));
    expect(nodes.level.dataset['level']).toBe('4');
    expect(nodes.levelLabel.textContent).toBe('Dostateczny');
    expect(nodes.levelOf.textContent).toBe('4/6');
    expect(nodes.trend.hidden).toBe(false);
    renderCard(nodes, cardModel({ ...CARD, levelYesterday: null }, 'pl'));
    expect(nodes.trend.hidden).toBe(true);
  });
});

describe('shareTextFor', () => {
  it('builds the share text, and none without a level', () => {
    expect(shareTextFor(CARD, 'pl')).toBe(
      'paczkom.at · Kraków · 1 paź, 17:25\n🟠 Dostateczny (4/6)\nPM2,5: 48 µg/m³ · gorzej niż wczoraj ↑\nLepiej niż 36% miast w Polsce\nhttps://paczkom.at/krakow',
    );
    expect(shareTextFor({ ...CARD, level: null }, 'pl')).toBeNull();
  });
});

describe('isStale', () => {
  it('is true only after 3 hours', () => {
    const at = Date.parse(CARD.updatedAt);
    expect(isStale(CARD.updatedAt, at + 3 * 3_600_000)).toBe(false);
    expect(isStale(CARD.updatedAt, at + 3 * 3_600_000 + 1)).toBe(true);
  });
});
