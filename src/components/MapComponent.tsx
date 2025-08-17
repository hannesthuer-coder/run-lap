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
  const [mapboxToken, setMapboxToken] = useState<string>("");
  const [showTokenInput, setShowTokenInput] = useState(true);
  const [map, setMap] = useState<any>(null);

  const initializeMap = async (token: string) => {
    if (!mapContainer.current) return;

    try {
      // Dynamically import mapbox-gl
      const mapboxgl = await import('mapbox-gl');
      
      // Set access token
      mapboxgl.default.accessToken = token;

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
      setShowTokenInput(false);
      toast.success("Map loaded successfully!");

    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error("Failed to load map. Please check your token and try again.");
    }
  };

  const handleTokenSubmit = () => {
    if (mapboxToken.trim()) {
      initializeMap(mapboxToken.trim());
    } else {
      toast.error("Please enter a valid Mapbox token");
    }
  };

  if (showTokenInput) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="max-w-md w-full mx-4 p-6 bg-card rounded-lg shadow-medium">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">Mapbox Token Required</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your Mapbox public token to display the interactive map
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mapbox-token">Mapbox Public Token</Label>
              <Input
                id="mapbox-token"
                type="text"
                placeholder="pk.eyJ1Ijoi..."
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Get your token from{" "}
                <a 
                  href="https://mapbox.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  mapbox.com
                </a>
              </p>
            </div>
            
            <Button 
              onClick={handleTokenSubmit}
              className="w-full"
              disabled={!mapboxToken.trim()}
            >
              Load Map
            </Button>
          </div>
        </div>
      </div>
    );
  }

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