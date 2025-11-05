// Core application types

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RoutePreferences {
  distance: number;
  unit: 'km' | 'miles';
  startLocation: Coordinates;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat]
}

export interface AIWaypoint {
  lat: number;
  lng: number;
  description: string;
}

export interface GeneratedRoute {
  geometry: RouteGeometry;
  distance: number; // meters
  duration: number; // seconds
  waypoints?: AIWaypoint[];
  aiInsights?: {
    description: string;
    generationMethod: 'ai' | 'geometric';
    processingTimeMs: number;
    model?: string;
  };
}

export interface RouteGenerationResponse {
  success: boolean;
  route?: GeneratedRoute;
  error?: string;
  errorType?: string;
}

export type LocationMethod = 'current' | 'map' | null;

export type LoadingPhase = 'idle' | 'loading' | 'complete' | 'error';

export interface RouteLimitStatus {
  canGenerate: boolean;
  remainingRoutes: number;
  totalGenerated: number;
  isPremium: boolean;
  needsUpgrade: boolean;
}
