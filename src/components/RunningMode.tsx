import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useGpsTracking } from '@/hooks/useGpsTracking';
import { calculateNavigationState, NavigationState } from '@/services/routeNavigation.service';
import { DirectionPanel } from './running/DirectionPanel';
import { StatsPanel } from './running/StatsPanel';
import { ProgressBar } from './running/ProgressBar';
import { createRunnerMarkerElement } from './running/RunnerMarker';
import { createMap, initializeMapbox } from '@/services/mapService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  X, 
  Pause, 
  Play, 
  MapPin, 
  Navigation, 
  AlertTriangle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RunningModeProps {
  routeCoordinates: [number, number][]; // [lng, lat][]
  distance: number;
  unit: 'km' | 'miles';
  onClose: () => void;
}

type RunState = 'preparing' | 'countdown' | 'running' | 'paused' | 'completed';

export const RunningMode = ({ routeCoordinates, distance, unit, onClose }: RunningModeProps) => {
  const [runState, setRunState] = useState<RunState>('preparing');
  const [countdown, setCountdown] = useState(3);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [navState, setNavState] = useState<NavigationState | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapboxglRef = useRef<any>(null);
  const runnerMarkerRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previousSegmentIndexRef = useRef(0);

  const {
    position,
    isTracking,
    error: gpsError,
    accuracy,
    permissionStatus,
    startTracking,
    stopTracking,
    calculatePace,
  } = useGpsTracking({ enableHighAccuracy: true });

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (!mapContainerRef.current || mapRef.current) return;

      try {
        // Fetch Mapbox token
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error || !data?.success) {
          toast.error('Failed to load map');
          return;
        }

        const startCoord = routeCoordinates[0];
        
        const mapInstance = await createMap(mapContainerRef.current, {
          center: [startCoord[0], startCoord[1]],
          zoom: 16,
          pitch: 45,
        }, data.token);

        const mapboxgl = await initializeMapbox(data.token);
        mapboxglRef.current = mapboxgl;

        mapInstance.on('load', () => {
          // Add route source with two layers (completed + remaining)
          mapInstance.addSource('route-remaining', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: routeCoordinates }
            }
          });

          mapInstance.addSource('route-completed', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [] }
            }
          });

          // Remaining route (blue)
          mapInstance.addLayer({
            id: 'route-remaining',
            type: 'line',
            source: 'route-remaining',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3B82F6', 'line-width': 6, 'line-opacity': 0.9 }
          });

          // Completed route (green)
          mapInstance.addLayer({
            id: 'route-completed',
            type: 'line',
            source: 'route-completed',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#22C55E', 'line-width': 6, 'line-opacity': 0.9 }
          });

          // Start marker
          new mapboxgl.Marker({ color: '#22C55E', scale: 0.8 })
            .setLngLat(routeCoordinates[0])
            .addTo(mapInstance);

          // Finish marker
          new mapboxgl.Marker({ color: '#EF4444', scale: 0.8 })
            .setLngLat(routeCoordinates[routeCoordinates.length - 1])
            .addTo(mapInstance);
        });

        mapRef.current = mapInstance;
      } catch (err) {
        console.error('Map init error:', err);
        toast.error('Failed to initialize map');
      }
    };

    initMap();

    return () => {
      mapRef.current?.remove();
    };
  }, [routeCoordinates]);

  // Start GPS tracking on mount (only once)
  const hasStartedTrackingRef = useRef(false);
  useEffect(() => {
    if (!hasStartedTrackingRef.current) {
      hasStartedTrackingRef.current = true;
      startTracking();
    }
    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update runner marker position
  useEffect(() => {
    if (!position || !mapRef.current || !mapboxglRef.current) return;

    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;

    // Create or update runner marker
    if (!runnerMarkerRef.current) {
      const markerEl = createRunnerMarkerElement(accuracy);
      runnerMarkerRef.current = new mapboxgl.Marker({ element: markerEl })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
    } else {
      runnerMarkerRef.current.setLngLat([position.lng, position.lat]);
    }

    // Center map on runner during run
    if (runState === 'running') {
      map.easeTo({
        center: [position.lng, position.lat],
        duration: 500,
      });
    }

    // Calculate navigation state
    const newNavState = calculateNavigationState(
      position.lat,
      position.lng,
      routeCoordinates,
      previousSegmentIndexRef.current
    );
    
    previousSegmentIndexRef.current = newNavState.currentSegmentIndex;
    setNavState(newNavState);

    // Update route visualization (completed vs remaining)
    if (map.getSource('route-completed') && map.getSource('route-remaining')) {
      const completedCoords = routeCoordinates.slice(0, newNavState.currentSegmentIndex + 1);
      const remainingCoords = routeCoordinates.slice(newNavState.currentSegmentIndex);

      map.getSource('route-completed').setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: completedCoords }
      });

      map.getSource('route-remaining').setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: remainingCoords }
      });
    }

    // Check completion
    if (newNavState.isComplete && runState === 'running') {
      handleComplete();
    }
  }, [position, accuracy, routeCoordinates, runState]);

  // Timer for elapsed time
  useEffect(() => {
    if (runState === 'running') {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runState]);

  // Countdown effect
  useEffect(() => {
    if (runState !== 'countdown') return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setRunState('running');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [runState]);

  const handleStartRun = () => {
    if (permissionStatus === 'denied') {
      toast.error('Please enable location access in your browser settings');
      return;
    }
    if (accuracy === 'low') {
      toast.warning('GPS accuracy is low. Try moving to an open area.');
    }
    setRunState('countdown');
  };

  const handlePause = () => {
    setRunState('paused');
  };

  const handleResume = () => {
    setRunState('running');
  };

  const handleComplete = () => {
    setRunState('completed');
    // Vibrate on completion if supported
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  const handleExitConfirm = () => {
    stopTracking();
    onClose();
  };

  const handleRecenter = () => {
    if (position && mapRef.current) {
      mapRef.current.easeTo({
        center: [position.lng, position.lat],
        zoom: 16,
        duration: 500,
      });
    }
  };

  const currentPace = calculatePace();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Map */}
      <div ref={mapContainerRef} className="flex-1 w-full" />

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 pointer-events-auto">
          <div className="flex justify-between items-start">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-background/80 backdrop-blur-sm"
              onClick={() => setShowExitDialog(true)}
            >
              <X className="h-5 w-5" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-background/80 backdrop-blur-sm"
              onClick={handleRecenter}
            >
              <Navigation className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Preparing state */}
        {runState === 'preparing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 pointer-events-auto">
            <div className="text-center p-6 max-w-sm">
              {permissionStatus === 'denied' ? (
                <>
                  <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">Location Access Required</h2>
                  <p className="text-muted-foreground mb-4">
                    Please enable location access in your browser settings to use GPS navigation.
                  </p>
                  <Button onClick={onClose}>Go Back</Button>
                </>
              ) : !position ? (
                <>
                  <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
                  <h2 className="text-xl font-bold mb-2">Acquiring GPS Signal</h2>
                  <p className="text-muted-foreground">
                    Please wait while we find your location...
                  </p>
                </>
              ) : (
                <>
                  <MapPin className="h-16 w-16 text-success mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">Ready to Run!</h2>
                  <p className="text-muted-foreground mb-2">
                    GPS accuracy: <span className={`font-medium ${
                      accuracy === 'high' ? 'text-success' : 
                      accuracy === 'medium' ? 'text-warning' : 'text-destructive'
                    }`}>
                      {accuracy === 'high' ? 'Excellent' : accuracy === 'medium' ? 'Good' : 'Poor'}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    {distance} {unit} route
                  </p>
                  <Button 
                    size="lg" 
                    className="bg-success hover:bg-success/90 text-success-foreground rounded-full px-8"
                    onClick={handleStartRun}
                  >
                    Start Run
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Countdown */}
        {runState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 pointer-events-auto">
            <div className="text-center">
              <p className="text-8xl font-bold text-primary animate-pulse">
                {countdown}
              </p>
              <p className="text-xl text-muted-foreground mt-4">Get ready...</p>
            </div>
          </div>
        )}

        {/* Completed state */}
        {runState === 'completed' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 pointer-events-auto">
            <div className="text-center p-6">
              <CheckCircle2 className="h-20 w-20 text-success mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Run Complete! 🎉</h2>
              <div className="space-y-2 mb-6">
                <p className="text-lg">
                  Distance: <span className="font-bold">{(navState?.distanceCompleted || 0) / 1000} km</span>
                </p>
                <p className="text-lg">
                  Time: <span className="font-bold">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                </p>
                {currentPace && (
                  <p className="text-lg">
                    Avg Pace: <span className="font-bold">{Math.floor(currentPace)}:{Math.round((currentPace % 1) * 60).toString().padStart(2, '0')} min/km</span>
                  </p>
                )}
              </div>
              <Button 
                size="lg" 
                className="rounded-full px-8"
                onClick={onClose}
              >
                Finish
              </Button>
            </div>
          </div>
        )}

        {/* Running/Paused UI */}
        {(runState === 'running' || runState === 'paused') && (
          <>
            {/* Progress bar at top */}
            <div className="absolute top-16 left-4 right-4 pointer-events-none">
              <ProgressBar progress={navState?.progress || 0} />
            </div>

            {/* Direction panel */}
            {navState?.nextInstruction && (
              <div className="absolute top-20 left-4 right-4 pointer-events-auto">
                <DirectionPanel
                  turnType={navState.nextInstruction.turnType}
                  distanceToTurn={navState.nextInstruction.distanceToTurn}
                  description={navState.nextInstruction.description}
                  isOffRoute={navState.isOffRoute}
                />
              </div>
            )}

            {/* Bottom panel */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
              <StatsPanel
                distanceCompleted={navState?.distanceCompleted || 0}
                distanceRemaining={navState?.distanceRemaining || 0}
                elapsedTime={elapsedTime}
                currentPace={currentPace}
                unit={unit}
              />

              {/* Pause/Resume button */}
              <div className="flex justify-center mt-4">
                {runState === 'running' ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-8"
                    onClick={handlePause}
                  >
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="bg-success hover:bg-success/90 text-success-foreground rounded-full px-8"
                    onClick={handleResume}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Resume
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Exit confirmation dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Run?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end your run? Your progress will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Running</AlertDialogCancel>
            <AlertDialogAction onClick={handleExitConfirm} className="bg-destructive text-destructive-foreground">
              End Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
