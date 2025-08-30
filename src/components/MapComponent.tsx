
import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";
import { createMap, initializeMapbox } from '@/services/mapService';

interface MapComponentProps {
  startLocation: string;
  distance: number;
  unit: string;
  regenerateKey?: number;
  onRouteGenerated?: () => void;
  onError?: () => void;
}

const MapComponent = ({ startLocation, distance, unit, regenerateKey, onRouteGenerated, onError }: MapComponentProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const mapboxglRef = useRef<any>(null);
  const [actualDistance, setActualDistance] = useState<number | null>(null);
  const [routeInsights, setRouteInsights] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Parse startLocation coordinates from string format "lat,lng"
  const parseLocation = (locationStr: string): [number, number] => {
    try {
      const [lat, lng] = locationStr.split(',').map(coord => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates, using default location');
        return [-74.5, 40]; // Default to NYC
      }
      return [lng, lat]; // Return as [lng, lat] for Mapbox
    } catch (error) {
      console.warn('Error parsing location, using default:', error);
      return [-74.5, 40];
    }
  };


  const generateNewRoute = async () => {
    if (!map) return;

    try {
      const [lng, lat] = parseLocation(startLocation);
      
      // Generate AI-powered running route using Supabase edge function
      const generateAIRoute = async (center: [number, number], distance: number) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data, error } = await supabase.functions.invoke('generate-ai-route', {
            body: {
              startLng: center[0],
              startLat: center[1],
              distance: distance,
              unit: unit
            }
          });
          
          if (error) {
            throw error;
          }
          
          if (data.success) {
            // Update actual distance and AI insights
            setActualDistance(data.route.distance);
            setRouteInsights(data.route.aiInsights);
            return data.route.geometry.coordinates;
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Failed to generate AI route:', error);
          throw new Error('AI route generation failed. Please try again.');
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

      toast.success("AI-generated route created!");
      onRouteGenerated?.();

    } catch (error) {
      console.error('Error generating new route:', error);
      toast.error("Failed to generate AI route. Please try again.");
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

      // Generate initial AI route
      const generateAIRoute = async (center: [number, number], distance: number) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data, error } = await supabase.functions.invoke('generate-ai-route', {
            body: {
              startLng: center[0],
              startLat: center[1],
              distance: distance,
              unit: unit
            }
          });
          
          if (error) {
            throw error;
          }
          
          if (data.success) {
            setActualDistance(data.route.distance);
            setRouteInsights(data.route.aiInsights);
            return data.route.geometry.coordinates;
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Failed to generate AI route:', error);
          throw new Error('AI route generation failed. Please try again.');
        }
      };

      mapInstance.on('load', async () => {
        try {
          const routeCoords = await generateAIRoute([lng, lat], distance);
          
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
          toast.error("Failed to load AI route. Please try again.");
          onError?.();
        }
      });

      setMap(mapInstance);
      setIsLoading(false);
      toast.success("Map loaded successfully!");

    } catch (error) {
      console.error('Error initializing map:', error);
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading AI-powered map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      <div className="absolute inset-0 bg-white/5 pointer-events-none" />
      
      {/* Enhanced Route Info Overlay with AI insights */}
      <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-medium border">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {actualDistance 
              ? `${(actualDistance / (unit === 'km' ? 1000 : 1609.34)).toFixed(2)} ${unit} AI-generated route`
              : `${distance} ${unit} AI route (generating...)`
            }
          </p>
          {routeInsights && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Style: {routeInsights.routeStyle}</p>
              <p>Terrain: {routeInsights.estimatedTerrain}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Starting from: {startLocation}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
