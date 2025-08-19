import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { toast } from "sonner";

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
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const GOOGLE_MAPS_API_KEY = "AIzaSyAm3IKVxRxms6p1tX5jPg6xzz85IGspT0k";

  // Parse startLocation coordinates from string format "lat,lng"
  const parseLocation = (locationStr: string): [number, number] => {
    try {
      const [lat, lng] = locationStr.split(',').map(coord => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates, using default location');
        return [40.7128, -74.0060]; // Default to NYC
      }
      return [lat, lng];
    } catch (error) {
      console.warn('Error parsing location, using default:', error);
      return [40.7128, -74.0060];
    }
  };

  const generateRoute = async () => {
    if (!map) return;

    try {
      const [lat, lng] = parseLocation(startLocation);
      
      // Generate route using Supabase edge function
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('generate-route', {
        body: {
          startLat: lat,
          startLng: lng,
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
        displayRoute(data.route.geometry.coordinates);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to generate route:', error);
      toast.error("Failed to generate route. Please try again.");
      
      // Fallback to mock circular route
      const [lat, lng] = parseLocation(startLocation);
      generateMockRoute(lat, lng);
    }
  };

  const generateMockRoute = (lat: number, lng: number) => {
    const points = [];
    const numPoints = 20;
    const radius = distance * 0.01;
    
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const pointLat = lat + radius * Math.cos(angle);
      const pointLng = lng + radius * Math.sin(angle);
      points.push([pointLng, pointLat]);
    }
    
    // Estimate distance for mock route
    const mockDistance = unit === 'km' ? distance * 1000 : distance * 1609.34;
    setActualDistance(mockDistance);
    displayRoute(points);
  };

  const displayRoute = (coordinates: number[][]) => {
    if (!map) return;

    // Remove existing route and marker
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    // Convert coordinates to Google Maps format
    const path = coordinates.map(([lng, lat]) => ({ lat, lng }));

    // Create polyline for the route
    const polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#22c55e',
      strokeOpacity: 0.8,
      strokeWeight: 4
    });

    polyline.setMap(map);
    routePolylineRef.current = polyline;

    // Add start marker
    const startMarker = new google.maps.Marker({
      position: path[0],
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#22c55e',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      },
      title: 'Start/End Point'
    });

    markerRef.current = startMarker;

    // Fit map to route
    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    map.fitBounds(bounds);
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
        libraries: ["geometry"]
      });

      await loader.load();

      const [lat, lng] = parseLocation(startLocation);

      // Create map instance
      const mapInstance = new google.maps.Map(mapContainer.current, {
        center: { lat, lng },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative'
      });

      setMap(mapInstance);
      
      // Generate initial route
      setTimeout(() => generateRoute(), 500);
      
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
      generateRoute();
    }
  }, [regenerateKey]);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />
      
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