/**
 * COPERT IV Emission calculations (server-side helpers).
 *
 * EF(v) in g CO₂/km:
 *   fuel_consumption(v) = 0.0667 + 0.0556/v + 0.000472·v²  [L/km]
 *   EF(v) = 2310 × fuel_consumption(v)  [g CO₂/km]
 */

export function fuelConsumption(speedKmh: number): number {
  const v = Math.max(speedKmh, 5);
  return 0.0667 + 0.0556 / v + 0.000472 * v * v;
}

export function emissionFactor(speedKmh: number, fuelType: string = 'petrol'): number {
  if (fuelType === 'electric') return 0;
  const fc = fuelConsumption(speedKmh);
  const co2PerLiter: Record<string, number> = {
    petrol: 2310,
    diesel: 2680,
    hybrid: 1155,
  };
  return (co2PerLiter[fuelType] ?? 2310) * fc;
}

export function calculateRideEmissions(
  segments: Array<{ distanceKm: number; avgSpeedKmh: number }>,
  fuelType: string = 'petrol'
): number {
  return segments.reduce((total, seg) => {
    return total + seg.distanceKm * emissionFactor(seg.avgSpeedKmh, fuelType);
  }, 0);
}

export function calculateCarpoolSavings(
  individualTrips: Array<{ distanceKm: number; avgSpeedKmh: number }>,
  sharedTrip: { distanceKm: number; avgSpeedKmh: number },
  fuelType: string = 'petrol'
): { co2SavedG: number; percentageSaved: number } {
  const individualTotal = individualTrips.reduce((total, trip) => {
    return total + trip.distanceKm * emissionFactor(trip.avgSpeedKmh, fuelType);
  }, 0);

  const sharedTotal = sharedTrip.distanceKm * emissionFactor(sharedTrip.avgSpeedKmh, fuelType);
  const saved = Math.max(individualTotal - sharedTotal, 0);
  const percentage = individualTotal > 0 ? (saved / individualTotal) * 100 : 0;

  return { co2SavedG: saved, percentageSaved: percentage };
}
