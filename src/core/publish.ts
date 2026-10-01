/**
 * The JSON files the collector writes and the browser reads. The guards run on
 * both sides: before deploy, and again on load, so a bad file shows "no data"
 * rather than a broken card.
 */
import { LEVELS } from './levels.js';
import type { Level } from './levels.js';
import type { Source } from './grade.js';

export interface TownCard {
  readonly slug: string;
  readonly name: string;
  readonly level: Level | null;
  readonly pm25: number | null;
  readonly pm10: number | null;
  readonly source: Source;
  readonly sensorCount: number;
  readonly lowConfidence: boolean;
  readonly worstToday: { readonly level: Level; readonly hour: string } | null;
  readonly levelYesterday: Level | null;
  readonly percentileBetter: number | null;
  readonly updatedAt: string;
}

export interface RankedTown {
  readonly slug: string;
  readonly name: string;
  readonly level: Level;
  readonly pm25: number | null;
}

export type LevelCounts = Readonly<Record<'1' | '2' | '3' | '4' | '5' | '6', number>>;

export interface NationalSummary {
  readonly updatedAt: string;
  readonly medianLevel: Level | null;
  readonly countByLevel: LevelCounts;
  readonly best: readonly RankedTown[];
  readonly worst: readonly RankedTown[];
  readonly withData: number;
  readonly total: number;
}

export interface TownIndexEntry {
  readonly slug: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly population: number;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown): boolean => v === null || isNum(v);
const isLevel = (v: unknown): v is Level => (LEVELS as readonly unknown[]).includes(v);
const isLevelOrNull = (v: unknown): boolean => v === null || isLevel(v);
const isSlug = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v);
const isIsoDate = (v: unknown): boolean => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const SOURCES: readonly unknown[] = ['gios', 'citizen', 'none'];

export function isTownCard(v: unknown): v is TownCard {
  if (!isObj(v)) {
    return false;
  }
  const worst = v['worstToday'];
  return (
    isSlug(v['slug']) &&
    typeof v['name'] === 'string' &&
    isLevelOrNull(v['level']) &&
    isNumOrNull(v['pm25']) &&
    isNumOrNull(v['pm10']) &&
    SOURCES.includes(v['source']) &&
    isNum(v['sensorCount']) &&
    typeof v['lowConfidence'] === 'boolean' &&
    (worst === null || (isObj(worst) && isLevel(worst['level']) && typeof worst['hour'] === 'string')) &&
    isLevelOrNull(v['levelYesterday']) &&
    isNumOrNull(v['percentileBetter']) &&
    isIsoDate(v['updatedAt'])
  );
}

const isRanked = (v: unknown): v is RankedTown =>
  isObj(v) && isSlug(v['slug']) && typeof v['name'] === 'string' && isLevel(v['level']) && isNumOrNull(v['pm25']);

export function isNationalSummary(v: unknown): v is NationalSummary {
  if (!isObj(v) || !isObj(v['countByLevel'])) {
    return false;
  }
  const counts = v['countByLevel'];
  return (
    isIsoDate(v['updatedAt']) &&
    isLevelOrNull(v['medianLevel']) &&
    LEVELS.every((level) => isNum(counts[String(level)])) &&
    Array.isArray(v['best']) && v['best'].every(isRanked) &&
    Array.isArray(v['worst']) && v['worst'].every(isRanked) &&
    isNum(v['withData']) &&
    isNum(v['total'])
  );
}

export function isTownIndex(v: unknown): v is TownIndexEntry[] {
  return (
    Array.isArray(v) &&
    v.every(
      (t) => isObj(t) && isSlug(t['slug']) && typeof t['name'] === 'string' && isNum(t['lat']) && isNum(t['lon']) && isNum(t['population']),
    )
  );
}
