import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
}

const MapSelector = ({ onLocationSelect }: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapboxToken, setMapboxToken] = useState<string>("");
  const [showTokenInput, setShowTokenInput] = useState(true);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);

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
        zoom: 10,
        attributionControl: false
      });

      // Add navigation controls
      mapInstance.addControl(new mapboxgl.default.NavigationControl(), 'top-right');

      // Handle map clicks
      mapInstance.on('click', (e) => {
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        
        // Remove existing marker
        if (marker) {
          marker.remove();
        }
        
        // Add new marker
        const newMarker = new mapboxgl.default.Marker({ 
          color: '#ef4444',
          scale: 1.2 
        })
          .setLngLat(coords)
          .addTo(mapInstance);
        
        setMarker(newMarker);
        onLocationSelect(coords);
        
        toast.success("Location selected!");
      });

      setMap(mapInstance);
      setShowTokenInput(false);
      toast.success("Map loaded! Click anywhere to select your starting point.");

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
      
      {/* Instructions Overlay */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-medium border">
        <p className="text-sm font-medium text-foreground text-center">
          🔴 Click anywhere to place your starting marker
        </p>
      </div>
    </div>
  );
};

export default MapSelector;