/**
 * Encodes an array of coordinates into a polyline string for Mapbox Static API
 * Based on Google's Polyline Algorithm
 */
export function encodePolyline(coordinates: [number, number][]): string {
  if (!coordinates || coordinates.length === 0) return '';

  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const [lng, lat] of coordinates) {
    // Round to 5 decimal places and convert to integer
    const latInt = Math.round(lat * 1e5);
    const lngInt = Math.round(lng * 1e5);

    // Calculate deltas
    const dLat = latInt - prevLat;
    const dLng = lngInt - prevLng;

    prevLat = latInt;
    prevLng = lngInt;

    // Encode each delta
    encoded += encodeSignedNumber(dLat);
    encoded += encodeSignedNumber(dLng);
  }

  return encoded;
}

function encodeSignedNumber(num: number): string {
  // Left-shift the number and flip bits if negative
  let sgn_num = num << 1;
  if (num < 0) {
    sgn_num = ~sgn_num;
  }

  return encodeUnsignedNumber(sgn_num);
}

function encodeUnsignedNumber(num: number): string {
  let encoded = '';

  while (num >= 0x20) {
    // Take 5 bits at a time, add 0x20 to indicate more chunks follow
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }

  // Final chunk (no continuation bit)
  encoded += String.fromCharCode(num + 63);

  return encoded;
}

/**
 * Simplifies coordinates array by taking every nth point
 * This reduces the polyline length for the URL
 */
export function simplifyCoordinates(
  coordinates: [number, number][],
  maxPoints: number = 100
): [number, number][] {
  if (coordinates.length <= maxPoints) return coordinates;

  const step = Math.ceil(coordinates.length / maxPoints);
  const simplified: [number, number][] = [];

  for (let i = 0; i < coordinates.length; i += step) {
    simplified.push(coordinates[i]);
  }

  // Always include the last point
  if (simplified[simplified.length - 1] !== coordinates[coordinates.length - 1]) {
    simplified.push(coordinates[coordinates.length - 1]);
  }

  return simplified;
}
