import type { Level } from './levels.js';

/** One Sensor.Community location: PM from its dust sensor, humidity if it has one. */
export interface CitizenReading {
  readonly sensorId: number;
  readonly lat: number;
  readonly lon: number;
  readonly indoor: boolean;
  readonly at: number;
  readonly pm25: number | null;
  readonly pm10: number | null;
  readonly humidity: number | null;
}

export interface GiosStation {
  readonly stationId: number;
  readonly lat: number;
  readonly lon: number;
}

export interface GiosIndex {
  readonly stationId: number;
  readonly level: Level | null;
  readonly at: number;
}
