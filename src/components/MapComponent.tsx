import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
  startLocation: string;
  distance: number;
  unit: string;
  regenerateKey?: number;
}

const MapComponent = ({ startLocation, distance, unit, regenerateKey }: MapComponentProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [actualDistance, setActualDistance] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<number[][]>([]);
  const leafletRef = useRef<any>(null);

  // Parse startLocation coordinates from string format "lat,lng"
  const parseLocation = (locationStr: string): [number, number] => {
    try {
      const [lat, lng] = locationStr.split(',').map(coord => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates, using default location');
        return [40, -74.5]; // Default to NYC
      }
      return [lat, lng]; // Return as [lat, lng] for Leaflet
    } catch (error) {
      console.warn('Error parsing location, using default:', error);
      return [40, -74.5];
    }
  };

  const generateNewRoute = async () => {
    if (!map) return;

    try {
      const [lat, lng] = parseLocation(startLocation);
      
      // Generate real running route using Supabase edge function
      const generateRealRoute = async (center: [number, number], distance: number) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data, error } = await supabase.functions.invoke('generate-route', {
            body: {
              startLng: center[1], // lng
              startLat: center[0], // lat
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
            // Convert coordinates for Leaflet (swap lng/lat to lat/lng)
            return data.route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
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
            const lat = center[0] + radius * Math.cos(angle);
            const lng = center[1] + radius * Math.sin(angle);
            points.push([lat, lng]); // Leaflet format
          }
          
          // Estimate distance for mock route
          const mockDistance = unit === 'km' ? distance * 1000 : distance * 1609.34;
          setActualDistance(mockDistance);
          return points;
        }
      };

      const newRouteCoords = await generateRealRoute([lat, lng], distance);
      setRouteCoords(newRouteCoords);
      
      // Clear existing route
      map.eachLayer((layer: any) => {
        if (layer.options && layer.options.className === 'route-layer') {
          map.removeLayer(layer);
        }
      });

      // Add new route
      const routeLine = leafletRef.current.polyline(newRouteCoords, {
        color: '#22c55e',
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1,
        className: 'route-layer'
      }).addTo(map);

      // Fit map to new route
      map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

      toast.success("New route generated!");

    } catch (error) {
      console.error('Error generating new route:', error);
      toast.error("Failed to generate new route. Please try again.");
    }
  };

  const handleStartNavigation = () => {
    if (routeCoords.length === 0) return;
    
    const [startLat, startLng] = parseLocation(startLocation);
    
    // Detect user agent and open appropriate app
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    
    if (isIOS) {
      // Try Apple Maps first, fallback to Google Maps
      const appleMapsUrl = `http://maps.apple.com/?daddr=${startLat},${startLng}&dirflg=w`;
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${startLat},${startLng}&travelmode=walking`;
      
      // Try Apple Maps, if it fails, open Google Maps
      window.open(appleMapsUrl, '_blank');
      setTimeout(() => {
        window.open(googleMapsUrl, '_blank');
      }, 1000);
    } else {
      // Android or desktop - use Google Maps
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${startLat},${startLng}&travelmode=walking`;
      window.open(googleMapsUrl, '_blank');
    }
    
    toast.success("Opening navigation app...");
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      // Parse the actual start location
      const [lat, lng] = parseLocation(startLocation);
      
      // Dynamically import Leaflet
      const L = await import('leaflet');
      leafletRef.current = L;
      
      // Fix default marker icons for Leaflet
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Create map instance centered on actual location
      const mapInstance = L.map(mapContainer.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: true,
        attributionControl: false
      });

      // Add beautiful OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        className: 'map-tiles'
      }).addTo(mapInstance);

      // Add zoom controls in top-right
      mapInstance.zoomControl.setPosition('topright');

      // Generate initial route
      const generateRealRoute = async (center: [number, number], distance: number) => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data, error } = await supabase.functions.invoke('generate-route', {
            body: {
              startLng: center[1], // lng
              startLat: center[0], // lat
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
            // Convert coordinates for Leaflet (swap lng/lat to lat/lng)
            return data.route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
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
            const lat = center[0] + radius * Math.cos(angle);
            const lng = center[1] + radius * Math.sin(angle);
            points.push([lat, lng]); // Leaflet format
          }
          
          // Estimate distance for mock route
          const mockDistance = unit === 'km' ? distance * 1000 : distance * 1609.34;
          setActualDistance(mockDistance);
          return points;
        }
      };

      const initialRouteCoords = await generateRealRoute([lat, lng], distance);
      setRouteCoords(initialRouteCoords);
      
      // Add route to map
      const routeLine = L.polyline(initialRouteCoords, {
        color: '#22c55e',
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1,
        className: 'route-layer'
      }).addTo(mapInstance);

      // Add start/end marker with custom green styling
      const startIcon = L.divIcon({
        className: 'custom-start-marker',
        html: `<div style="
          background-color: #22c55e;
          width: 25px;
          height: 25px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          position: relative;
          transform: translate(-50%, -50%);
        "></div>`,
        iconSize: [25, 25],
        iconAnchor: [12.5, 12.5]
      });

      L.marker([lat, lng], { icon: startIcon }).addTo(mapInstance);

      // Fit map to route
      mapInstance.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

      setMap(mapInstance);
      toast.success("Map loaded successfully!");

    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error("Failed to load map. Please try again.");
    }
  };

  useEffect(() => {
    initializeMap();
    
    // Cleanup on unmount
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  // Regenerate route when regenerateKey changes
  useEffect(() => {
    if (regenerateKey && regenerateKey > 0) {
      generateNewRoute();
    }
  }, [regenerateKey]);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0 rounded-2xl overflow-hidden" />
      
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

      {/* Navigation Button */}
      <div className="absolute top-4 right-4">
        <Button
          onClick={handleStartNavigation}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-medium"
          size="sm"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Start Navigation
        </Button>
      </div>
    </div>
  );
};

export default MapComponent;