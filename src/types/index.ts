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

export interface GeneratedRoute {
  geometry: RouteGeometry;
  distance: number; // meters
  duration: number; // seconds
}

export interface RouteGenerationResponse {
  success: boolean;
  route?: GeneratedRoute;
  error?: string;
  errorType?: string;
}

export type LocationMethod = 'current' | 'map' | null;

export type LoadingPhase = 'idle' | 'loading' | 'complete' | 'error';
