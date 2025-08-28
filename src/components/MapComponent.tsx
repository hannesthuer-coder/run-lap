import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapComponentProps {
  startLocation: string;
  distance: number;
  unit: string;
  regenerateKey?: number; // Add regeneration trigger
  onRouteGenerated?: () => void; // Callback when route is ready
  onError?: () => void; // Callback when route generation fails
}

const MapComponent = ({ startLocation, distance, unit, regenerateKey, onRouteGenerated, onError }: MapComponentProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const mapboxglRef = useRef<any>(null);
  const [actualDistance, setActualDistance] = useState<number | null>(null);

  const getMapboxToken = async (): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) throw error;
      return data.token;
    } catch (error) {
      console.error('Failed to get Mapbox token:', error);
      throw new Error('Unable to load map. Please try again later.');
    }
  };

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
      
      // Generate real running route using Supabase edge function
      const generateRealRoute = async (center: [number, number], distance: number) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data, error } = await supabase.functions.invoke('generate-route', {
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
            // Update actual distance from API response
            setActualDistance(data.route.distance);
            return data.route.geometry.coordinates;
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Failed to generate real route:', error);
          throw new Error('Route generation failed. Please try again.');
        }
      };

      const routeCoords = await generateRealRoute([lng, lat], distance);
      
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
            'line-color': '#3B82F6', // Clear blue like Lovable publish button
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

      toast.success("New route generated!");
      
      // Call callback to notify parent that route is ready
      onRouteGenerated?.();

    } catch (error) {
      console.error('Error generating new route:', error);
      toast.error("Failed to generate new route. Please try again.");
      onError?.(); // Notify parent of error
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      // Parse the actual start location
      const [lng, lat] = parseLocation(startLocation);
      
      // Get Mapbox token from Supabase
      const mapboxToken = await getMapboxToken();
      
      // Dynamically import mapbox-gl
      const mapboxgl = await import('mapbox-gl');
      mapboxglRef.current = mapboxgl.default;
      
      // Set access token
      mapboxgl.default.accessToken = mapboxToken;

      // Create map instance centered on actual location
      const mapInstance = new mapboxgl.default.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12', // Streets style with subtle colors
        center: [lng, lat],
        zoom: 12,
        attributionControl: false
      });

      // Add navigation controls
      mapInstance.addControl(new mapboxgl.default.NavigationControl(), 'top-right');

      // Generate real running route using Supabase edge function
      const generateRealRoute = async (center: [number, number], distance: number) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data, error } = await supabase.functions.invoke('generate-route', {
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
            // Update actual distance from initial API response
            setActualDistance(data.route.distance);
            return data.route.geometry.coordinates;
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Failed to generate real route:', error);
          throw new Error('Route generation failed. Please try again.');
        }
      };

      mapInstance.on('load', async () => {
        try {
          const routeCoords = await generateRealRoute([lng, lat], distance);
          
          // Add route source and layer
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
              'line-color': '#3B82F6', // Clear blue like Lovable publish button  
              'line-width': 4,
              'line-opacity': 0.9
            }
          });

          // Add start/end marker
          new mapboxgl.default.Marker({ 
            color: '#3B82F6', // Clear blue to match route
            scale: 1.2 
          })
            .setLngLat(routeCoords[0])
            .addTo(mapInstance);

          // Fit map to route
          const bounds = new mapboxgl.default.LngLatBounds();
          routeCoords.forEach(coord => bounds.extend(coord));
          mapInstance.fitBounds(bounds, { padding: 50 });

          // Call callback to notify parent that initial route is ready
          onRouteGenerated?.();
        } catch (error) {
          console.error('Error loading initial route:', error);
          toast.error("Failed to load route. Please try again.");
          onError?.(); // Notify parent of error
        }
      });

      setMap(mapInstance);
      toast.success("Map loaded successfully!");

    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error("Failed to load map. Please check your token and try again.");
      onError?.(); // Notify parent of error
    }
  };

  useEffect(() => {
    initializeMap();
  }, []);

  // Regenerate route when regenerateKey changes
  useEffect(() => {
    if (regenerateKey && regenerateKey > 0) {
      generateNewRoute();
    }
  }, [regenerateKey]);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Very subtle overlay to just slightly fade colors */}
      <div className="absolute inset-0 bg-white/5 pointer-events-none" />
      
      {/* Route Info Overlay */}
      <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-medium border">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {actualDistance 
              ? `${(actualDistance / (unit === 'km' ? 1000 : 1609.34)).toFixed(2)} ${unit} running loop`
              : `${distance} ${unit} running loop (generating...)`
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