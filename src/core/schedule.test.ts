import { describe, expect, it } from 'vitest';
import { generateParcels } from './parcel.js';
import { DAILY_PROFILE } from './profiles.js';
import { buildSchedule, isCustomerArrival } from './schedule.js';
import type { CustomerRequest, ScheduleEntry } from './schedule.js';

const scheduleFor = (seed: number) => {
  const [parcels, afterParcels] = generateParcels(seed, DAILY_PROFILE);
  const [arrivals, afterSchedule] = buildSchedule(afterParcels, DAILY_PROFILE, parcels);
  return { parcels, arrivals, rng: afterSchedule };
};

type Pickup = Extract<CustomerRequest, { kind: 'pickup' }>;
type Sender = Extract<CustomerRequest, { kind: 'sender' }>;

const pickups = (entries: readonly ScheduleEntry[]): Pickup[] =>
  entries
    .map((entry) => entry.request)
    .filter((request): request is Pickup => request.kind === 'pickup');

const senders = (entries: readonly ScheduleEntry[]): Sender[] =>
  entries
    .map((entry) => entry.request)
    .filter((request): request is Sender => request.kind === 'sender');

describe('buildSchedule', () => {
  it('is deterministic for the same seed', () => {
    expect(scheduleFor(12345).arrivals).toEqual(scheduleFor(12345).arrivals);
  });

  it('differs for different seeds', () => {
    expect(scheduleFor(1).arrivals).not.toEqual(scheduleFor(2).arrivals);
  });

  it('is a schedule of customer arrivals', () => {
    for (const entry of scheduleFor(7).arrivals) {
      expect(entry.kind).toBe('arrival');
      expect(isCustomerArrival(entry)).toBe(true);
    }
  });

  it('has one arrival per pickup parcel plus the profile senders', () => {
    const { parcels, arrivals } = scheduleFor(7);
    expect(arrivals).toHaveLength(parcels.length + DAILY_PROFILE.senders);
    expect(pickups(arrivals)).toHaveLength(parcels.length);
    expect(senders(arrivals)).toHaveLength(DAILY_PROFILE.senders);
  });

  it('covers every parcel exactly once', () => {
    const { parcels, arrivals } = scheduleFor(7);
    const parcelIds = pickups(arrivals).map((request) => request.parcelId);
    expect(new Set(parcelIds).size).toBe(parcels.length);
    expect(new Set(parcelIds)).toEqual(new Set(parcels.map((parcel) => parcel.id)));
  });

  it('gives pickups a parcel and senders a needed size', () => {
    const { arrivals } = scheduleFor(7);
    for (const entry of arrivals) {
      if (entry.request.kind === 'pickup') {
        expect(entry.request.parcelId).toMatch(/^p\d+$/);
      } else {
        expect(['A', 'B', 'C']).toContain(entry.request.needsSize);
      }
    }
  });

  it('never asks a sender for a size the profile weights out', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const request of senders(scheduleFor(seed).arrivals)) {
        expect(request.needsSize).not.toBe('C');
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
