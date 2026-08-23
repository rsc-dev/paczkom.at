import { describe, expect, it } from 'vitest';
import { generateParcels } from './parcel.js';
import { DAILY_PROFILE } from './profiles.js';
import { buildSchedule } from './schedule.js';

const scheduleFor = (seed: number) => {
  const [parcels, afterParcels] = generateParcels(seed, DAILY_PROFILE);
  const [arrivals, afterSchedule] = buildSchedule(afterParcels, DAILY_PROFILE, parcels);
  return { parcels, arrivals, rng: afterSchedule };
};

describe('buildSchedule', () => {
  it('is deterministic for the same seed', () => {
    expect(scheduleFor(12345).arrivals).toEqual(scheduleFor(12345).arrivals);
  });

  it('differs for different seeds', () => {
    expect(scheduleFor(1).arrivals).not.toEqual(scheduleFor(2).arrivals);
  });

  it('has one arrival per pickup parcel plus the profile senders', () => {
    const { parcels, arrivals } = scheduleFor(7);
    expect(arrivals).toHaveLength(parcels.length + DAILY_PROFILE.senders);
    expect(arrivals.filter((arrival) => arrival.kind === 'pickup')).toHaveLength(parcels.length);
    expect(arrivals.filter((arrival) => arrival.kind === 'sender')).toHaveLength(
      DAILY_PROFILE.senders,
    );
  });

  it('covers every parcel exactly once', () => {
    const { parcels, arrivals } = scheduleFor(7);
    const parcelIds = arrivals
      .filter((arrival) => arrival.kind === 'pickup')
      .map((arrival) => arrival.parcelId);
    expect(new Set(parcelIds).size).toBe(parcels.length);
    expect(new Set(parcelIds)).toEqual(new Set(parcels.map((parcel) => parcel.id)));
  });

  it('gives pickups a parcel and senders a needed size', () => {
    const { arrivals } = scheduleFor(7);
    for (const arrival of arrivals) {
      if (arrival.kind === 'pickup') {
        expect(arrival.parcelId).not.toBeNull();
        expect(arrival.needsSize).toBeNull();
      } else {
        expect(arrival.parcelId).toBeNull();
        expect(arrival.needsSize).not.toBeNull();
      }
    }
  });

  it('never asks a sender for a size the profile weights out', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const senders = scheduleFor(seed).arrivals.filter((arrival) => arrival.kind === 'sender');
      for (const sender of senders) {
        expect(sender.needsSize).not.toBe('C');
      }
    }
  });

  it('is sorted by arrival time inside the arrival window', () => {
    const { arrivals } = scheduleFor(7);
    for (const arrival of arrivals) {
      expect(arrival.atMs).toBeGreaterThanOrEqual(0);
      expect(arrival.atMs).toBeLessThanOrEqual(DAILY_PROFILE.arrivalWindowMs);
      expect(Number.isInteger(arrival.atMs)).toBe(true);
    }
    const times = arrivals.map((arrival) => arrival.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('gives every arrival a unique id in arrival order', () => {
    const { arrivals } = scheduleFor(7);
    expect(new Set(arrivals.map((arrival) => arrival.id)).size).toBe(arrivals.length);
    expect(arrivals.map((arrival) => arrival.id).slice(0, 3)).toEqual(['k0', 'k1', 'k2']);
  });

  it('spreads arrivals rather than bunching them at the start', () => {
    const { arrivals } = scheduleFor(7);
    const last = arrivals.at(-1);
    expect(last?.atMs).toBeGreaterThan(DAILY_PROFILE.arrivalWindowMs / 2);
  });

  it('advances the RNG state', () => {
    const [parcels, afterParcels] = generateParcels(3, DAILY_PROFILE);
    const [, afterSchedule] = buildSchedule(afterParcels, DAILY_PROFILE, parcels);
    expect(afterSchedule).not.toBe(afterParcels);
  });
});
