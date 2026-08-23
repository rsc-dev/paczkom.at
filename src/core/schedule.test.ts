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

const requests = (entries: readonly ScheduleEntry[]): CustomerRequest[] =>
  entries.filter(isCustomerArrival).map((entry) => entry.request);

const pickups = (entries: readonly ScheduleEntry[]): Pickup[] =>
  requests(entries).filter((request): request is Pickup => request.kind === 'pickup');

const senders = (entries: readonly ScheduleEntry[]): Sender[] =>
  requests(entries).filter((request): request is Sender => request.kind === 'sender');

describe('buildSchedule', () => {
  it('is deterministic for the same seed', () => {
    expect(scheduleFor(12345).arrivals).toEqual(scheduleFor(12345).arrivals);
  });

  it('differs for different seeds', () => {
    expect(scheduleFor(1).arrivals).not.toEqual(scheduleFor(2).arrivals);
  });

  it('carries the day&#39;s events alongside its arrivals', () => {
    const { arrivals } = scheduleFor(7);
    expect(arrivals.filter(isCustomerArrival).length).toBeGreaterThan(0);
    // Daily is Thursday-grade, which means exactly one jam.
    expect(arrivals.filter((entry) => entry.kind === 'jam')).toHaveLength(DAILY_PROFILE.jams);
    expect(new Set(arrivals.map((entry) => entry.id)).size).toBe(arrivals.length);
  });

  it('has one arrival per pickup parcel plus the profile senders', () => {
    const { parcels, arrivals } = scheduleFor(7);
    expect(arrivals.filter(isCustomerArrival)).toHaveLength(parcels.length + DAILY_PROFILE.senders);
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
    for (const request of requests(arrivals)) {
      if (request.kind === 'pickup') {
        expect(request.parcelId).toMatch(/^p\d+$/);
      } else {
        expect(['A', 'B', 'C']).toContain(request.needsSize);
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
    const ids = scheduleFor(7)
      .arrivals.filter(isCustomerArrival)
      .map((arrival) => arrival.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 3)).toEqual(['k0', 'k1', 'k2']);
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
