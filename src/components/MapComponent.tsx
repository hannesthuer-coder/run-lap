import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface MapComponentProps {
  startLocation: string;
  distance: number;
  unit: string;
}

const MapComponent = ({ startLocation, distance, unit }: MapComponentProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);

  const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFubmVzdGh1ciIsImEiOiJjbWVmaTB3eHMxMHkyMmxzZnUxb3hhM2NuIn0.HXWWHQcsYrtdkiw5cCwNhQ";

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      // Dynamically import mapbox-gl
      const mapboxgl = await import('mapbox-gl');
      
      // Set access token
      mapboxgl.default.accessToken = MAPBOX_TOKEN;

      // Create map instance
      const mapInstance = new mapboxgl.default.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-74.5, 40],
        zoom: 12,
        attributionControl: false
      });

      // Add navigation controls
      mapInstance.addControl(new mapboxgl.default.NavigationControl(), 'top-right');

      // Generate mock route coordinates (a loop)
      const generateRouteLoop = (center: [number, number], distance: number) => {
        const points = [];
        const numPoints = 20;
        const radius = distance * 0.01; // Rough conversion for demo
        
        for (let i = 0; i <= numPoints; i++) {
          const angle = (i / numPoints) * 2 * Math.PI;
          const lat = center[1] + radius * Math.cos(angle);
          const lng = center[0] + radius * Math.sin(angle);
          points.push([lng, lat]);
        }
        return points;
      };

      mapInstance.on('load', () => {
        const routeCoords = generateRouteLoop([-74.5, 40], distance);
        
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

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Route Info Overlay */}
      <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-medium border">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {distance} {unit} running loop
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