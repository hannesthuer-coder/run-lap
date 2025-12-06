
import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";
import { createMap, initializeMapbox } from '@/services/mapService';

interface MapComponentProps {
  startLocation: string;
  distance: number;
  unit: string;
  regenerateKey?: number;
  onRouteGenerated?: (route?: any) => void;
  onError?: () => void;
  preloadedRoute?: any;
}

const MapComponent = ({ startLocation, distance, unit, regenerateKey, onRouteGenerated, onError, preloadedRoute }: MapComponentProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const mapboxglRef = useRef<any>(null);
  const [actualDistance, setActualDistance] = useState<number | null>(null);
  const [routeInsights, setRouteInsights] = useState<any>(null);

  // Parse startLocation coordinates from string format "lat,lng"
  const parseLocation = (locationStr: string): [number, number] => {
    try {
      console.log('Parsing location:', locationStr);
      const [lat, lng] = locationStr.split(',').map(coord => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates, using default location');
        toast.error('Invalid coordinates provided, using default location');
        return [-74.0060, 40.7128]; // Default to NYC (lng, lat)
      }
      console.log('Parsed coordinates:', [lng, lat]);
      return [lng, lat]; // Return as [lng, lat] for Mapbox
    } catch (error) {
      console.error('Error parsing location, using default:', error);
      toast.error('Error parsing location, using default');
      return [-74.0060, 40.7128];
    }
  };


  const generateNewRoute = async () => {
    if (!map) return;

    try {
      const [lng, lat] = parseLocation(startLocation);
      
      // Generate AI-powered running route with retry logic
      const generateAIRoute = async (center: [number, number], distance: number, retryCount = 0): Promise<any> => {
        const maxRetries = 2;
        
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          console.log(`Attempting route generation (attempt ${retryCount + 1}/${maxRetries + 1})`);
          
          const { data, error } = await supabase.functions.invoke('generate-route', {
            body: {
              startLng: center[0],
              startLat: center[1],
              distance: distance,
              unit: unit
            }
          });
          
          if (error) {
            console.error('Supabase function error:', error);
            throw error;
          }
          
          if (data.success) {
            // Update actual distance 
            setActualDistance(data.route.distance);
            setRouteInsights(null); // No AI insights for geometric routes
            
            toast.success("Geometric route generated successfully!");
            
            return data.route.geometry.coordinates;
          } else {
            const errorMessage = data.error || 'Unknown error occurred';
            console.error('Route generation failed:', errorMessage);
            
            // Handle specific error types with appropriate user messages
            if (data.errorType === 'API_RATE_LIMITED' && retryCount < maxRetries) {
              console.log(`Rate limited, retrying in ${(retryCount + 1) * 2} seconds...`);
              await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
              return generateAIRoute(center, distance, retryCount + 1);
            } else if (data.errorType === 'API_QUOTA_EXCEEDED') {
              toast.error("AI service quota exceeded. Route generation may use fallback method.");
            } else if (data.errorType === 'MAPBOX_ERROR') {
              toast.error("Location routing unavailable. Please try a different area.");
            } else if (data.errorType === 'NETWORK_ERROR' && retryCount < maxRetries) {
              console.log(`Network error, retrying in ${(retryCount + 1) * 3} seconds...`);
              await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 3000));
              return generateAIRoute(center, distance, retryCount + 1);
            }
            
            throw new Error(errorMessage);
          }
        } catch (error) {
          console.error('Route generation attempt failed:', error);
          
          // Retry on network errors
          if (retryCount < maxRetries && (
            error.message?.includes('fetch') || 
            error.message?.includes('network') ||
            error.message?.includes('timeout')
          )) {
            console.log(`Network error, retrying in ${(retryCount + 1) * 2} seconds...`);
            toast.info(`Connection issue, retrying... (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
            return generateAIRoute(center, distance, retryCount + 1);
          }
          
          throw error;
        }
      };

      const routeCoords = await generateAIRoute([lng, lat], distance);
      
      // Remove existing route and marker
      if (map.getSource('route')) {
        map.removeLayer('route');
        map.removeSource('route');
      }

      // Add new route source and layer
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoords
          }
        }
      });

      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3B82F6',
          'line-width': 4,
          'line-opacity': 0.9
        }
      });

      // Fit map to new route
      if (mapboxglRef.current) {
        const bounds = new mapboxglRef.current.LngLatBounds();
        routeCoords.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 50 });
      }

      onRouteGenerated?.();

    } catch (error) {
      console.error('Error generating new route:', error);
      
      // Provide specific error messages based on error content
      if (error.message?.includes('quota')) {
        toast.error("Service quota exceeded. Please try again later.");
      } else if (error.message?.includes('rate limit')) {
        toast.error("Service temporarily busy. Please wait a moment and try again.");
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error("Connection issue. Please check your internet and try again.");
      } else if (error.message?.includes('location')) {
        toast.error("Unable to generate route for this location. Try a different area.");
      } else {
        toast.error("Failed to generate route. Please try again or refresh the page.");
      }
      
      onError?.();
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      const [lng, lat] = parseLocation(startLocation);
      
      // Create map using shared service
      const mapInstance = await createMap(mapContainer.current, {
        center: [lng, lat],
        zoom: 12
      });

      // Initialize Mapbox library for markers
      const mapboxgl = await initializeMapbox();
      mapboxglRef.current = mapboxgl;

      // Generate initial AI route with enhanced error handling
      const generateAIRoute = async (center: [number, number], distance: number, retryCount = 0): Promise<any> => {
        const maxRetries = 1; // Fewer retries on initial load
        
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          console.log(`Loading initial route (attempt ${retryCount + 1}/${maxRetries + 1})`);
          
          const { data, error } = await supabase.functions.invoke('generate-route', {
            body: {
              startLng: center[0],
              startLat: center[1],
              distance: distance,
              unit: unit
            }
          });
          
          if (error) {
            console.error('Supabase function error:', error);
            throw error;
          }
          
          if (data.success) {
            setActualDistance(data.route.distance);
            setRouteInsights(null); // No AI insights for geometric routes
            
            toast.success("Geometric route loaded successfully!");
            
            return data.route.geometry.coordinates;
          } else {
            const errorMessage = data.error || 'Unknown error occurred';
            console.error('Initial route generation failed:', errorMessage);
            
            // Limited retry logic for initial load
            if (data.errorType === 'NETWORK_ERROR' && retryCount < maxRetries) {
              console.log('Network error on initial load, retrying once...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              return generateAIRoute(center, distance, retryCount + 1);
            }
            
            throw new Error(errorMessage);
          }
        } catch (error) {
          console.error('Initial route generation attempt failed:', error);
          
          // Retry network errors once on initial load
          if (retryCount < maxRetries && (
            error.message?.includes('fetch') || 
            error.message?.includes('network') ||
            error.message?.includes('timeout')
          )) {
            console.log('Network error on initial load, retrying...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            return generateAIRoute(center, distance, retryCount + 1);
          }
          
          throw error;
        }
      };

      mapInstance.on('load', async () => {
        try {
          // Use preloaded route if available, otherwise generate new one
          let routeCoords;
          if (preloadedRoute?.coordinates) {
            routeCoords = preloadedRoute.coordinates;
            setActualDistance(distance * (unit === 'km' ? 1000 : 1609.34));
          } else {
            routeCoords = await generateAIRoute([lng, lat], distance);
          }
          
          mapInstance.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeCoords
              }
            }
          });

          mapInstance.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3B82F6',
              'line-width': 4,
              'line-opacity': 0.9
            }
          });

          new mapboxgl.Marker({ 
            color: '#3B82F6',
            scale: 1.2 
          })
            .setLngLat(routeCoords[0])
            .addTo(mapInstance);

          const bounds = new mapboxgl.LngLatBounds();
          routeCoords.forEach(coord => bounds.extend(coord));
          mapInstance.fitBounds(bounds, { padding: 50 });

          onRouteGenerated?.();
        } catch (error) {
          console.error('Error loading initial route:', error);
          
          // Provide specific error messages for initial load
          if (error.message?.includes('quota')) {
            toast.error("Service quota exceeded. Route generation may be limited.");
          } else if (error.message?.includes('rate limit')) {
            toast.error("Service busy. Please wait a moment before generating a new route.");
          } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            toast.error("Connection issue. Please check your internet and refresh the page.");
          } else if (error.message?.includes('location')) {
            toast.error("Unable to generate route for this location. Try a different area.");
          } else {
            toast.error("Failed to load route. Please refresh the page or try again.");
          }
          
          onError?.();
        }
      });

      setMap(mapInstance);
      toast.success("Map loaded successfully!");

    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error("Failed to load map. Please try again.");
      onError?.();
    }
  };

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    if (regenerateKey && regenerateKey > 0) {
      generateNewRoute();
    }
  }, [regenerateKey]);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      <div className="absolute inset-0 bg-white/5 pointer-events-none" />
      
      {/* Enhanced Route Info Overlay with AI insights */}
      <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-medium border">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {actualDistance 
              ? `${(actualDistance / (unit === 'km' ? 1000 : 1609.34)).toFixed(2)} ${unit} lap`
              : `${distance} ${unit} lap (generating...)`
            }
          </p>
          <p className="text-xs text-muted-foreground">
            Starting from: {startLocation}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
