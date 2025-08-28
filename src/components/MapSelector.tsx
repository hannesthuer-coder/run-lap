import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";
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
  const [isLoading, setIsLoading] = useState(true);

  // Get Mapbox token from Supabase edge function
  const getMapboxToken = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      
      if (error) throw error;
      return data.token;
    } catch (error) {
      console.error('Failed to get Mapbox token:', error);
      return null;
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;
    
    try {
      // Get the Mapbox token
      const token = await getMapboxToken();
      if (!token) {
        throw new Error('Failed to get Mapbox token');
      }
      
      setMapboxToken(token);
      
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
        style: 'mapbox://styles/mapbox/streets-v12', // Same style as route page
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
      setIsLoading(false);
      toast.success("Map loaded! Click anywhere to select your starting point.");
    } catch (error) {
      console.error('Error initializing map:', error);
      setIsLoading(false);
      toast.error("Failed to load map. Please try again.");
    }
  };
  
  useEffect(() => {
    initializeMap();
  }, []);
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Very subtle overlay to match route page style */}
      <div className="absolute inset-0 bg-white/5 pointer-events-none" />
    </div>
  );
};
export default MapSelector;