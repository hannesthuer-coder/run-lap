import { useState, useEffect, useCallback, useRef } from 'react';

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GpsTrackingState {
  position: GpsPosition | null;
  positionHistory: GpsPosition[];
  isTracking: boolean;
  error: string | null;
  permissionStatus: 'pending' | 'granted' | 'denied' | 'unavailable';
  accuracy: 'high' | 'medium' | 'low' | 'unknown';
}

interface UseGpsTrackingOptions {
  enableHighAccuracy?: boolean;
  maxAge?: number;
  timeout?: number;
  historyLimit?: number;
}

const DEFAULT_OPTIONS: UseGpsTrackingOptions = {
  enableHighAccuracy: true,
  maxAge: 0,
  timeout: 10000,
  historyLimit: 100,
};

export const useGpsTracking = (options: UseGpsTrackingOptions = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<GpsTrackingState>({
    position: null,
    positionHistory: [],
    isTracking: false,
    error: null,
    permissionStatus: 'pending',
    accuracy: 'unknown',
  });

  const watchIdRef = useRef<number | null>(null);
  const positionHistoryRef = useRef<GpsPosition[]>([]);

  const getAccuracyLevel = (accuracy: number): 'high' | 'medium' | 'low' => {
    if (accuracy <= 10) return 'high';
    if (accuracy <= 30) return 'medium';
    return 'low';
  };

  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const newPosition: GpsPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
    };

    // Update history
    positionHistoryRef.current = [
      ...positionHistoryRef.current.slice(-(opts.historyLimit! - 1)),
      newPosition,
    ];

    setState(prev => ({
      ...prev,
      position: newPosition,
      positionHistory: positionHistoryRef.current,
      accuracy: getAccuracyLevel(newPosition.accuracy),
      error: null,
    }));
  }, [opts.historyLimit]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage: string;
    let permissionStatus: GpsTrackingState['permissionStatus'] = 'pending';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access.';
        permissionStatus = 'denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable.';
        permissionStatus = 'unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out.';
        break;
      default:
        errorMessage = 'An unknown error occurred.';
    }

    setState(prev => ({
      ...prev,
      error: errorMessage,
      permissionStatus,
    }));
  }, []);

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser.',
        permissionStatus: 'unavailable',
      }));
      return false;
    }

    // Check permission status if available
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'denied') {
          setState(prev => ({
            ...prev,
            error: 'Location permission denied. Please enable it in your browser settings.',
            permissionStatus: 'denied',
          }));
          return false;
        }
      } catch (e) {
        // Permissions API not fully supported, continue anyway
      }
    }

    setState(prev => ({ ...prev, isTracking: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleError,
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        maximumAge: opts.maxAge,
        timeout: opts.timeout,
      }
    );

    setState(prev => ({ ...prev, permissionStatus: 'granted' }));
    return true;
  }, [handlePositionUpdate, handleError, opts]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState(prev => ({ ...prev, isTracking: false }));
  }, []);

  const clearHistory = useCallback(() => {
    positionHistoryRef.current = [];
    setState(prev => ({ ...prev, positionHistory: [] }));
  }, []);

  // Calculate current pace from recent positions (minutes per km)
  const calculatePace = useCallback((): number | null => {
    const history = positionHistoryRef.current;
    if (history.length < 2) return null;

    // Use last 10 positions or all if less
    const recentPositions = history.slice(-10);
    if (recentPositions.length < 2) return null;

    let totalDistance = 0;
    for (let i = 1; i < recentPositions.length; i++) {
      totalDistance += haversineDistance(
        recentPositions[i - 1].lat,
        recentPositions[i - 1].lng,
        recentPositions[i].lat,
        recentPositions[i].lng
      );
    }

    const timeSpan = (recentPositions[recentPositions.length - 1].timestamp - recentPositions[0].timestamp) / 1000 / 60; // minutes
    if (totalDistance === 0 || timeSpan === 0) return null;

    return timeSpan / (totalDistance / 1000); // min/km
  }, []);

  // Calculate total distance traveled
  const calculateTotalDistance = useCallback((): number => {
    const history = positionHistoryRef.current;
    if (history.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < history.length; i++) {
      totalDistance += haversineDistance(
        history[i - 1].lat,
        history[i - 1].lng,
        history[i].lat,
        history[i].lng
      );
    }

    return totalDistance;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
    clearHistory,
    calculatePace,
    calculateTotalDistance,
  };
};

// Haversine distance formula (returns meters)
export const haversineDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number): number => deg * (Math.PI / 180);
