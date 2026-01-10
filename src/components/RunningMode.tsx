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
import { voiceNavigationService } from '@/services/voiceNavigation.service';
import { analyticsService } from '@/services/analytics.service';
import { 
  X, 
  Pause, 
  Play, 
  MapPin, 
  Navigation, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Volume2,
  VolumeX
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

type RunState = 'preparing' | 'running' | 'paused' | 'completed';

// Number of consecutive off-route readings required to trigger off-route warning
const OFF_ROUTE_CONFIRM_COUNT = 3;

export const RunningMode = ({ routeCoordinates, distance, unit, onClose }: RunningModeProps) => {
  const [runState, setRunState] = useState<RunState>('preparing');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [navState, setNavState] = useState<NavigationState | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentPace, setCurrentPace] = useState<number | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapboxglRef = useRef<any>(null);
  const runnerMarkerRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previousSegmentIndexRef = useRef(0);
  const wasOffRouteRef = useRef(false);
  const offRouteCountRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const {
    position,
    smoothedPosition,
    isTracking,
    error: gpsError,
    accuracy,
    permissionStatus,
    startTracking,
    stopTracking,
    calculatePace,
  } = useGpsTracking({ enableHighAccuracy: true, smoothingWindow: 5 });

  // Wake Lock - prevent screen from sleeping during run
  useEffect(() => {
    const acquireWakeLock = async () => {
      if ('wakeLock' in navigator && runState === 'running') {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Wake lock acquired');
        } catch (err) {
          console.log('Wake lock failed:', err);
        }
      }
    };

    if (runState === 'running') {
      acquireWakeLock();
    } else {
      // Release wake lock when not running
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake lock released');
      }
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [runState]);

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

          // Completed route (accent blue - slightly different shade for visibility)
          mapInstance.addLayer({
            id: 'route-completed',
            type: 'line',
            source: 'route-completed',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#0EA5E9', 'line-width': 6, 'line-opacity': 0.9 }
          });

          // Start marker (primary blue)
          new mapboxgl.Marker({ color: '#3B82F6', scale: 0.8 })
            .setLngLat(routeCoordinates[0])
            .addTo(mapInstance);

          // Finish marker (accent blue)
          new mapboxgl.Marker({ color: '#0EA5E9', scale: 0.8 })
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

  // Update runner marker position - USE SMOOTHED POSITION
  useEffect(() => {
    // Use smoothed position for map and navigation, fall back to raw position
    const displayPosition = smoothedPosition || position;
    if (!displayPosition || !mapRef.current || !mapboxglRef.current) return;

    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;

    // Create or update runner marker
    if (!runnerMarkerRef.current) {
      const markerEl = createRunnerMarkerElement(accuracy, displayPosition.heading);
      runnerMarkerRef.current = new mapboxgl.Marker({ element: markerEl })
        .setLngLat([displayPosition.lng, displayPosition.lat])
        .addTo(map);
    } else {
      runnerMarkerRef.current.setLngLat([displayPosition.lng, displayPosition.lat]);
      
      // Update heading arrow rotation
      const arrow = runnerMarkerRef.current.getElement().querySelector('.runner-heading-arrow') as HTMLElement;
      if (arrow) {
        if (displayPosition.heading !== null) {
          arrow.style.transform = `translate(-50%, -150%) rotate(${displayPosition.heading}deg)`;
          arrow.style.display = 'block';
        } else {
          arrow.style.display = 'none';
        }
      }
    }

    // Center map on runner during run - SMOOTHER ANIMATION, NO ROTATION
    if (runState === 'running') {
      map.easeTo({
        center: [displayPosition.lng, displayPosition.lat],
        duration: 1000, // Increased from 500 for smoother movement
        easing: (t: number) => t * (2 - t), // Smooth ease-out curve
        // NOTE: Removed bearing/heading rotation - keeps map north-up for stability
      });
    }

    // Calculate navigation state
    // Pass hasStartedRunning: true only when running AND user has progressed
    const hasStartedRunning = runState === 'running' && previousSegmentIndexRef.current > 10;
    const newNavState = calculateNavigationState(
      displayPosition.lat,
      displayPosition.lng,
      routeCoordinates,
      previousSegmentIndexRef.current,
      hasStartedRunning
    );
    
    previousSegmentIndexRef.current = newNavState.currentSegmentIndex;
    setNavState(newNavState);

    // Update current pace
    if (runState === 'running') {
      const pace = calculatePace();
      setCurrentPace(pace);
    }

    // Voice announcements (only when running)
    if (runState === 'running') {
      // Announce upcoming turns
      if (newNavState.nextInstruction) {
        voiceNavigationService.announceUpcomingTurn(
          newNavState.nextInstruction.turnType,
          newNavState.nextInstruction.distanceToTurn
        );
      }

      // Off-route detection with CONFIRMATION (prevents false alerts from GPS blips)
      if (newNavState.isOffRoute) {
        offRouteCountRef.current++;
      } else {
        offRouteCountRef.current = 0;
      }

      const confirmedOffRoute = offRouteCountRef.current >= OFF_ROUTE_CONFIRM_COUNT;

      // Only announce if confirmed off-route for multiple readings
      if (confirmedOffRoute && !wasOffRouteRef.current) {
        voiceNavigationService.announceOffRoute();
        wasOffRouteRef.current = true;
      } else if (!newNavState.isOffRoute && wasOffRouteRef.current) {
        voiceNavigationService.announceBackOnRoute();
        wasOffRouteRef.current = false;
      }
    }

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
  }, [position, smoothedPosition, accuracy, routeCoordinates, runState, calculatePace]);

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

  const handleStartRun = () => {
    if (permissionStatus === 'denied') {
      toast.error('Please enable location access in your browser settings');
      return;
    }
    if (accuracy === 'low') {
      toast.warning('GPS accuracy is low. Try moving to an open area.');
    }
    voiceNavigationService.resetCooldowns();
    voiceNavigationService.announceStart();
    offRouteCountRef.current = 0;
    wasOffRouteRef.current = false;
    setRunState('running');
    // Track run started
    analyticsService.trackRunStarted(distance, unit);
  };

  const handlePause = () => {
    setRunState('paused');
    analyticsService.trackRunPaused();
  };

  const handleResume = () => {
    setRunState('running');
    analyticsService.trackRunResumed();
  };

  const handleComplete = () => {
    setRunState('completed');
    voiceNavigationService.announceCompletion();
    // Track run completed
    analyticsService.trackRunCompleted(distance, unit, elapsedTime);
    // Vibrate on completion if supported
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  const toggleVoice = () => {
    const newEnabled = !voiceEnabled;
    setVoiceEnabled(newEnabled);
    voiceNavigationService.setEnabled(newEnabled);
    toast.success(newEnabled ? 'Voice navigation enabled' : 'Voice navigation disabled');
  };

  const handleExitConfirm = () => {
    // Track run exited with completion percentage
    const completionPercentage = navState?.progress || 0;
    analyticsService.trackRunExited(completionPercentage);
    stopTracking();
    onClose();
  };

  const handleRecenter = () => {
    const displayPosition = smoothedPosition || position;
    if (displayPosition && mapRef.current) {
      mapRef.current.easeTo({
        center: [displayPosition.lng, displayPosition.lat],
        zoom: 16,
        duration: 500,
      });
    }
  };

  

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

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full bg-background/80 backdrop-blur-sm"
                onClick={toggleVoice}
              >
                {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
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
                  <Button onClick={onClose} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full">Go Back</Button>
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
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8"
                    onClick={handleStartRun}
                  >
                    Start Run
                  </Button>
                </>
              )}
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
                {(() => {
                  const distanceKm = (navState?.distanceCompleted || 0) / 1000;
                  const distanceMiles = distanceKm / 1.60934;
                  const displayDistance = unit === 'km' ? distanceKm : distanceMiles;
                  const elapsedMinutes = elapsedTime / 60;
                  const avgPace = displayDistance > 0.01 ? elapsedMinutes / displayDistance : null;
                  
                  return (
                    <>
                      <p className="text-lg">
                        Distance: <span className="font-bold">{displayDistance.toFixed(2)} {unit}</span>
                      </p>
                      <p className="text-lg">
                        Time: <span className="font-bold">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                      </p>
                      {avgPace && (
                        <p className="text-lg">
                          Avg Pace: <span className="font-bold">{Math.floor(avgPace)}:{Math.round((avgPace % 1) * 60).toString().padStart(2, '0')} /{unit === 'km' ? 'km' : 'mi'}</span>
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8"
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
            {/* Direction panel */}
            {navState?.nextInstruction && (
              <div className="absolute top-16 left-4 right-4 pointer-events-auto">
                <DirectionPanel
                  turnType={navState.nextInstruction.turnType}
                  distanceToTurn={navState.nextInstruction.distanceToTurn}
                  description={navState.nextInstruction.description}
                  isOffRoute={offRouteCountRef.current >= OFF_ROUTE_CONFIRM_COUNT}
                />
              </div>
            )}

            {/* Bottom panel */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
              <StatsPanel
                distanceCompleted={navState?.distanceCompleted || 0}
                distanceRemaining={navState?.distanceRemaining || 0}
                elapsedTime={elapsedTime}
                unit={unit}
                currentPace={currentPace}
              />

              {/* Progress bar below stats */}
              <div className="mt-2">
                <ProgressBar progress={navState?.progress || 0} />
              </div>

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
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8"
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
