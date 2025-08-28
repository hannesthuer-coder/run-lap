import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
}

const MapSelector = ({
  onLocationSelect
}: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const markerRef = useRef<any>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState<boolean>(true);

  const getMapboxToken = async (): Promise<string> => {
    // Use the user-entered token if available
    if (mapboxToken && mapboxToken.startsWith('pk.')) {
      return mapboxToken;
    }
    
    // Try to get from Supabase
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (!error && data?.token) {
        setShowTokenInput(false);
        return data.token;
      }
    } catch (error) {
      console.log('Edge function failed');
    }
    
    throw new Error('Please enter your Mapbox token below');
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;
    try {
      // Get Mapbox token
      const token = await getMapboxToken();
      
      // Dynamically import mapbox-gl
      const mapboxgl = await import('mapbox-gl');

      // Set access token
      mapboxgl.default.accessToken = token;

      // Get user's current location first
      const getUserLocation = (): Promise<[number, number]> => {
        return new Promise((resolve, reject) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
              resolve([position.coords.longitude, position.coords.latitude]);
            }, error => {
              console.warn('Could not get user location:', error);
              // Default to New York if location fails
              resolve([-74.5, 40]);
            });
          } else {
            // Default to New York if geolocation not supported
            resolve([-74.5, 40]);
          }
        });
      };
      const userLocation = await getUserLocation();

      // Create map instance centered on user's location
      const mapInstance = new mapboxgl.default.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: userLocation,
        zoom: 14,
        attributionControl: false
      });

      // Add navigation controls
      mapInstance.addControl(new mapboxgl.default.NavigationControl(), 'top-right');

      // Handle map clicks
      mapInstance.on('click', e => {
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        // Always remove existing marker first
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }

        // Add new marker (only one at a time)
        const newMarker = new mapboxgl.default.Marker({
          color: '#ef4444',
          scale: 1.2
        }).setLngLat(coords).addTo(mapInstance);
        markerRef.current = newMarker;
        onLocationSelect(coords);
        toast.success("Starting point selected!");
      });
      
      setMap(mapInstance);
      toast.success("Map loaded! Click anywhere to select your starting point.");
    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load map');
      setShowTokenInput(true);
    }
  };

  const handleTokenSubmit = () => {
    if (mapboxToken.startsWith('pk.')) {
      setShowTokenInput(false);
      initializeMap();
    } else {
      toast.error('Please enter a valid Mapbox token (starts with pk.)');
    }
  };

  useEffect(() => {
    initializeMap();
  }, []);

  return (
    <div className="relative w-full h-[500px] bg-muted rounded-lg overflow-hidden">
      {showTokenInput && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="p-6 bg-card rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Enter Mapbox Token</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get your public token from <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">mapbox.com</a>
            </p>
            <input
              type="text"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              placeholder="pk.your_mapbox_token_here"
              className="w-full p-2 border border-border rounded mb-4"
            />
            <button
              onClick={handleTokenSubmit}
              disabled={!mapboxToken.startsWith('pk.')}
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded disabled:opacity-50"
            >
              Load Map
            </button>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-background/5 rounded-lg" />
    </div>
  );
};

export default MapSelector;