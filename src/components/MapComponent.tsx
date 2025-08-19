import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader } from "@googlemaps/js-api-loader";

interface MapComponentProps {
  startLocation: string;
  distance: number;
  unit: string;
  regenerateKey?: number;
}

const MapComponent = ({ startLocation, distance, unit, regenerateKey }: MapComponentProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [actualDistance, setActualDistance] = useState<number | null>(null);
  const routeRef = useRef<google.maps.Polyline | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  // Parse startLocation coordinates from string format "lat,lng"
  const parseLocation = (locationStr: string): { lat: number; lng: number } => {
    try {
      const [lat, lng] = locationStr.split(',').map(coord => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates, using default location');
        return { lat: 40.7128, lng: -74.0060 }; // Default to NYC
      }
      return { lat, lng };
    } catch (error) {
      console.warn('Error parsing location, using default:', error);
      return { lat: 40.7128, lng: -74.0060 };
    }
  };

  const generateNewRoute = async () => {
    if (!map) return;

    try {
      const location = parseLocation(startLocation);
      
      // Generate real running route using Supabase edge function
      const generateRealRoute = async (center: { lat: number; lng: number }, distance: number) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data, error } = await supabase.functions.invoke('generate-route', {
            body: {
              startLng: center.lng,
              startLat: center.lat,
              distance: distance,
              unit: unit
            }
          });
          
          if (error) {
            throw error;
          }
          
          if (data.success) {
            setActualDistance(data.route.distance);
            return data.route.geometry.coordinates.map((coord: [number, number]) => ({
              lat: coord[1],
              lng: coord[0]
            }));
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
            const lat = center.lat + radius * Math.cos(angle);
            const lng = center.lng + radius * Math.sin(angle);
            points.push({ lat, lng });
          }
          
          const mockDistance = unit === 'km' ? distance * 1000 : distance * 1609.34;
          setActualDistance(mockDistance);
          return points;
        }
      };

      const routeCoords = await generateRealRoute(location, distance);
      
      // Remove existing route
      if (routeRef.current) {
        routeRef.current.setMap(null);
      }

      // Add new route
      const newRoute = new google.maps.Polyline({
        path: routeCoords,
        geodesic: true,
        strokeColor: '#22c55e',
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });

      newRoute.setMap(map);
      routeRef.current = newRoute;

      // Fit map to new route
      const bounds = new google.maps.LatLngBounds();
      routeCoords.forEach(coord => bounds.extend(coord));
      map.fitBounds(bounds);

      toast.success("New route generated!");

    } catch (error) {
      console.error('Error generating new route:', error);
      toast.error("Failed to generate new route. Please try again.");
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      const location = parseLocation(startLocation);
      
      // Load Google Maps with the API key directly
      const loader = new Loader({
        apiKey: "AIzaSyAm3IKVxRxms6p1tX5jPg6xzz85IGspT0k",
        version: "weekly"
      });
      
      const { Map } = await loader.importLibrary("maps");
      
      // Create map instance
      const mapInstance = new Map(mapContainer.current, {
        center: location,
        zoom: 14,
        mapTypeId: "roadmap",
        styles: [
          {
            featureType: "all",
            elementType: "geometry.fill",
            stylers: [{ color: "#f8f9fa" }]
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#4285f4" }]
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#ffffff" }]
          },
          {
            featureType: "poi",
            elementType: "geometry.fill",
            stylers: [{ color: "#e8f5e8" }]
          }
        ]
      });

      // Generate initial route
      const generateRealRoute = async (center: { lat: number; lng: number }, distance: number) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data, error } = await supabase.functions.invoke('generate-route', {
            body: {
              startLng: center.lng,
              startLat: center.lat,
              distance: distance,
              unit: unit
            }
          });
          
          if (error) {
            throw error;
          }
          
          if (data.success) {
            setActualDistance(data.route.distance);
            return data.route.geometry.coordinates.map((coord: [number, number]) => ({
              lat: coord[1],
              lng: coord[0]
            }));
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
            const lat = center.lat + radius * Math.cos(angle);
            const lng = center.lng + radius * Math.sin(angle);
            points.push({ lat, lng });
          }
          
          const mockDistance = unit === 'km' ? distance * 1000 : distance * 1609.34;
          setActualDistance(mockDistance);
          return points;
        }
      };

      const routeCoords = await generateRealRoute(location, distance);
      
      // Add route polyline
      const route = new google.maps.Polyline({
        path: routeCoords,
        geodesic: true,
        strokeColor: '#22c55e',
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });

      route.setMap(mapInstance);
      routeRef.current = route;

      // Add start marker
      const marker = new google.maps.Marker({
        position: routeCoords[0],
        map: mapInstance,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#ffffff"
        }
      });
      markerRef.current = marker;

      // Fit map to route
      const bounds = new google.maps.LatLngBounds();
      routeCoords.forEach(coord => bounds.extend(coord));
      mapInstance.fitBounds(bounds);

      setMap(mapInstance);
      toast.success("Map loaded successfully!");

    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error("Failed to load map. Please try again.");
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