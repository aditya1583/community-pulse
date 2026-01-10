/**
 * Radius Constants - Single source of truth
 *
 * The 10-mile radius is the core geographic boundary for Community Pulse.
 * All distance calculations and API queries should reference these constants.
 */

export const RADIUS_CONFIG = {
  // Primary radius in miles (the "in-radius" boundary)
  PRIMARY_RADIUS_MILES: 10,

  // Extended radius for "nearby but out-of-radius" content
  // Events beyond PRIMARY but within EXTENDED get distance callouts
  EXTENDED_RADIUS_MILES: 50,

  // Conversion factors
  MILES_TO_KM: 1.60934,
  MILES_TO_METERS: 1609.34,

  // Derived values (computed once)
  get PRIMARY_RADIUS_KM() {
    return this.PRIMARY_RADIUS_MILES * this.MILES_TO_KM;
  },
  get PRIMARY_RADIUS_METERS() {
    return Math.round(this.PRIMARY_RADIUS_MILES * this.MILES_TO_METERS);
  },
  get EXTENDED_RADIUS_KM() {
    return this.EXTENDED_RADIUS_MILES * this.MILES_TO_KM;
  },
  get EXTENDED_RADIUS_METERS() {
    return Math.round(this.EXTENDED_RADIUS_MILES * this.MILES_TO_METERS);
  },
} as const;

// UI display values
export const RADIUS_DISPLAY = {
  label: "10-Mile Radius",
  shortLabel: "10mi",
} as const;
