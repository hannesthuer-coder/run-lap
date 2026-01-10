import { haversineDistance } from '@/hooks/useGpsTracking';

export type TurnType = 'straight' | 'slight-left' | 'left' | 'sharp-left' | 'slight-right' | 'right' | 'sharp-right' | 'u-turn' | 'finish';

export interface NavigationInstruction {
  turnType: TurnType;
  distanceToTurn: number; // meters
  description: string;
}

export interface NavigationState {
  currentSegmentIndex: number;
  distanceCompleted: number; // meters
  distanceRemaining: number; // meters
  distanceToRoute: number; // meters (how far off-route)
  isOffRoute: boolean;
  nextInstruction: NavigationInstruction | null;
  progress: number; // 0-100
  isComplete: boolean;
}

// Configuration - TUNED FOR SMOOTH EXPERIENCE
const OFF_ROUTE_THRESHOLD = 75; // meters (increased from 50 for GPS drift tolerance)
const TURN_DETECTION_ANGLE = 40; // degrees (increased from 20 to filter minor curves)
const MIN_DISTANCE_BETWEEN_TURNS = 50; // meters - don't announce turns closer than this
const WAYPOINT_REACHED_DISTANCE = 15; // meters
const MIN_PROGRESS_FOR_COMPLETION = 0.8; // 80% of route must be completed
const MIN_SEGMENT_PROGRESS = 0.7; // Must pass 70% of route waypoints

/**
 * Calculate bearing between two points (in degrees)
 */
export const calculateBearing = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  const bearing = Math.atan2(y, x);
  return (toDeg(bearing) + 360) % 360;
};

/**
 * Determine turn type based on angle change
 */
export const getTurnType = (angleDifference: number): TurnType => {
  // Normalize angle to -180 to 180
  let angle = angleDifference;
  if (angle > 180) angle -= 360;
  if (angle < -180) angle += 360;

  if (Math.abs(angle) < TURN_DETECTION_ANGLE) return 'straight';
  if (angle >= 150 || angle <= -150) return 'u-turn';
  if (angle >= 70) return 'sharp-right';
  if (angle >= 35) return 'right';
  if (angle >= TURN_DETECTION_ANGLE) return 'slight-right';
  if (angle <= -70) return 'sharp-left';
  if (angle <= -35) return 'left';
  if (angle <= -TURN_DETECTION_ANGLE) return 'slight-left';
  return 'straight';
};

/**
 * Get human-readable turn description
 */
export const getTurnDescription = (turnType: TurnType, distance: number): string => {
  const distanceStr = distance < 100 
    ? `${Math.round(distance)}m` 
    : `${Math.round(distance / 100) * 100}m`;

  switch (turnType) {
    case 'straight':
      return `Continue straight for ${distanceStr}`;
    case 'slight-left':
      return `Slight left in ${distanceStr}`;
    case 'left':
      return `Turn left in ${distanceStr}`;
    case 'sharp-left':
      return `Sharp left in ${distanceStr}`;
    case 'slight-right':
      return `Slight right in ${distanceStr}`;
    case 'right':
      return `Turn right in ${distanceStr}`;
    case 'sharp-right':
      return `Sharp right in ${distanceStr}`;
    case 'u-turn':
      return `U-turn in ${distanceStr}`;
    case 'finish':
      return `Finish in ${distanceStr}`;
    default:
      return `Continue for ${distanceStr}`;
  }
};

/**
 * Find the closest point on the route to the current position
 */
export const findClosestPointOnRoute = (
  currentLat: number,
  currentLng: number,
  routeCoordinates: [number, number][] // [lng, lat]
): { index: number; distance: number; point: [number, number] } => {
  let closestIndex = 0;
  let closestDistance = Infinity;
  let closestPoint: [number, number] = routeCoordinates[0];

  for (let i = 0; i < routeCoordinates.length; i++) {
    const [lng, lat] = routeCoordinates[i];
    const distance = haversineDistance(currentLat, currentLng, lat, lng);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
      closestPoint = routeCoordinates[i];
    }
  }

  return { index: closestIndex, distance: closestDistance, point: closestPoint };
};

/**
 * Calculate the total route distance
 */
export const calculateRouteDistance = (routeCoordinates: [number, number][]): number => {
  let total = 0;
  for (let i = 1; i < routeCoordinates.length; i++) {
    const [lng1, lat1] = routeCoordinates[i - 1];
    const [lng2, lat2] = routeCoordinates[i];
    total += haversineDistance(lat1, lng1, lat2, lng2);
  }
  return total;
};

/**
 * Calculate distance from start to a specific index
 */
export const calculateDistanceToIndex = (
  routeCoordinates: [number, number][],
  targetIndex: number
): number => {
  let total = 0;
  for (let i = 1; i <= targetIndex && i < routeCoordinates.length; i++) {
    const [lng1, lat1] = routeCoordinates[i - 1];
    const [lng2, lat2] = routeCoordinates[i];
    total += haversineDistance(lat1, lng1, lat2, lng2);
  }
  return total;
};

/**
 * Find the next significant turn in the route
 * Now respects MIN_DISTANCE_BETWEEN_TURNS to avoid announcing too many turns
 */
export const findNextTurn = (
  routeCoordinates: [number, number][],
  currentIndex: number
): { index: number; turnType: TurnType; distance: number } | null => {
  if (currentIndex >= routeCoordinates.length - 2) {
    // Near the end - return finish instruction
    const distanceToEnd = calculateDistanceToIndex(
      routeCoordinates.slice(currentIndex),
      routeCoordinates.length - currentIndex - 1
    );
    return { index: routeCoordinates.length - 1, turnType: 'finish', distance: distanceToEnd };
  }

  let accumulatedDistance = 0;
  let lastSignificantTurnDistance = 0;

  for (let i = currentIndex; i < routeCoordinates.length - 2; i++) {
    const [lng1, lat1] = routeCoordinates[i];
    const [lng2, lat2] = routeCoordinates[i + 1];
    const [lng3, lat3] = routeCoordinates[i + 2];

    accumulatedDistance += haversineDistance(lat1, lng1, lat2, lng2);

    const bearing1 = calculateBearing(lat1, lng1, lat2, lng2);
    const bearing2 = calculateBearing(lat2, lng2, lat3, lng3);
    const angleDifference = bearing2 - bearing1;

    const turnType = getTurnType(angleDifference);

    // Only report turn if it's significant AND far enough from the last turn
    if (turnType !== 'straight') {
      const distanceSinceLastTurn = accumulatedDistance - lastSignificantTurnDistance;
      
      // Return this turn only if it's the first one OR far enough from last
      if (lastSignificantTurnDistance === 0 || distanceSinceLastTurn >= MIN_DISTANCE_BETWEEN_TURNS) {
        return { index: i + 1, turnType, distance: accumulatedDistance };
      }
      
      // Track this turn position for spacing calculation
      lastSignificantTurnDistance = accumulatedDistance;
    }
  }

  // No turn found, return distance to finish
  const distanceToEnd = calculateDistanceToIndex(
    routeCoordinates.slice(currentIndex),
    routeCoordinates.length - currentIndex - 1
  );
  return { index: routeCoordinates.length - 1, turnType: 'finish', distance: distanceToEnd };
};

/**
 * Main navigation state calculator
 */
export const calculateNavigationState = (
  currentLat: number,
  currentLng: number,
  routeCoordinates: [number, number][],
  previousSegmentIndex: number = 0,
  hasStartedRunning: boolean = false
): NavigationState => {
  if (routeCoordinates.length < 2) {
    return {
      currentSegmentIndex: 0,
      distanceCompleted: 0,
      distanceRemaining: 0,
      distanceToRoute: 0,
      isOffRoute: false,
      nextInstruction: null,
      progress: 0,
      isComplete: true,
    };
  }

  // Find closest point on route
  const { index, distance: distanceToRoute } = findClosestPointOnRoute(
    currentLat,
    currentLng,
    routeCoordinates
  );

  // Prevent going backwards (only allow forward progress or small backtracking)
  const currentSegmentIndex = Math.max(index, previousSegmentIndex - 5);

  // Calculate distances
  const totalDistance = calculateRouteDistance(routeCoordinates);
  const distanceCompleted = calculateDistanceToIndex(routeCoordinates, currentSegmentIndex);
  const distanceRemaining = totalDistance - distanceCompleted;

  // Check if off-route (using increased threshold)
  const isOffRoute = distanceToRoute > OFF_ROUTE_THRESHOLD;

  // Check if complete - must be near finish AND have completed most of the route
  // This prevents false completion on loop routes where start = finish
  const [finishLng, finishLat] = routeCoordinates[routeCoordinates.length - 1];
  const distanceToFinish = haversineDistance(currentLat, currentLng, finishLat, finishLng);
  const isNearFinish = distanceToFinish < WAYPOINT_REACHED_DISTANCE;
  const hasAdvancedThroughRoute = currentSegmentIndex > routeCoordinates.length * MIN_SEGMENT_PROGRESS;
  const hasCompletedMinimumDistance = distanceCompleted >= totalDistance * MIN_PROGRESS_FOR_COMPLETION;
  // Must have actually started running AND moved away from start before completion can trigger
  const isComplete = hasStartedRunning && isNearFinish && hasAdvancedThroughRoute && hasCompletedMinimumDistance;

  // Find next instruction
  let nextInstruction: NavigationInstruction | null = null;
  if (!isComplete) {
    const nextTurn = findNextTurn(routeCoordinates, currentSegmentIndex);
    if (nextTurn) {
      nextInstruction = {
        turnType: nextTurn.turnType,
        distanceToTurn: nextTurn.distance,
        description: getTurnDescription(nextTurn.turnType, nextTurn.distance),
      };
    }
  }

  // Calculate progress percentage
  const progress = totalDistance > 0 ? Math.min(100, (distanceCompleted / totalDistance) * 100) : 0;

  return {
    currentSegmentIndex,
    distanceCompleted,
    distanceRemaining,
    distanceToRoute,
    isOffRoute,
    nextInstruction,
    progress,
    isComplete,
  };
};

// Helper functions
const toRad = (deg: number): number => deg * (Math.PI / 180);
const toDeg = (rad: number): number => rad * (180 / Math.PI);
