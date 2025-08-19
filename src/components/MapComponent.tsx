import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapComponentProps {
  startLocation: string;
  distance: number;
  unit: string;
  regenerateKey?: number; // Add regeneration trigger
}

const MapComponent = ({ startLocation, distance, unit, regenerateKey }: MapComponentProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const mapboxglRef = useRef<any>(null);
  const [actualDistance, setActualDistance] = useState<number | null>(null);

  const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWVpdmk4cmUwN3YwMmxzZDNtcjF2em54In0.kkCEFz-Lg2PQoLD-OTJp6Q";

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
          console.error('Failed to generate real route, falling back to mock:', error);
          // Fallback to mock route if API fails
          const points = [];
          const numPoints = 20;
          const radius = distance * 0.01;
          
          for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const lat = center[1] + radius * Math.cos(angle);
            const lng = center[0] + radius * Math.sin(angle);
            points.push([lng, lat]);
          }
          
          // Estimate distance for mock route
          const mockDistance = unit === 'km' ? distance * 1000 : distance * 1609.34;
          setActualDistance(mockDistance);
          return points;
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
          'line-color': '#22c55e',
          'line-width': 4,
          'line-opacity': 0.8
        }
      });

      // Fit map to new route
      if (mapboxglRef.current) {
        const bounds = new mapboxglRef.current.LngLatBounds();
        routeCoords.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 50 });
      }

      toast.success("New route generated!");

    } catch (error) {
      console.error('Error generating new route:', error);
      toast.error("Failed to generate new route. Please try again.");
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      // Parse the actual start location
      const [lng, lat] = parseLocation(startLocation);
      
      // Dynamically import mapbox-gl
      const mapboxgl = await import('mapbox-gl');
      mapboxglRef.current = mapboxgl.default;
      
      // Set access token
      mapboxgl.default.accessToken = MAPBOX_TOKEN;

      // Create map instance centered on actual location
      const mapInstance = new mapboxgl.default.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
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
          console.error('Failed to generate real route, falling back to mock:', error);
          // Fallback to mock route if API fails
          const points = [];
          const numPoints = 20;
          const radius = distance * 0.01;
          
          for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const lat = center[1] + radius * Math.cos(angle);
            const lng = center[0] + radius * Math.sin(angle);
            points.push([lng, lat]);
          }
          
          // Estimate distance for mock route
          const mockDistance = unit === 'km' ? distance * 1000 : distance * 1609.34;
          setActualDistance(mockDistance);
          return points;
        }
      };

      mapInstance.on('load', async () => {
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
            'line-color': '#22c55e',
            'line-width': 4,
            'line-opacity': 0.8
          }
        });

        // Add start/end marker
        new mapboxgl.default.Marker({ 
          color: '#22c55e',
          scale: 1.2 
        })
          .setLngLat(routeCoords[0])
          .addTo(mapInstance);

        // Fit map to route
        const bounds = new mapboxgl.default.LngLatBounds();
        routeCoords.forEach(coord => bounds.extend(coord));
        mapInstance.fitBounds(bounds, { padding: 50 });
      });

      setMap(mapInstance);
      toast.success("Map loaded successfully!");

    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error("Failed to load map. Please check your token and try again.");
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