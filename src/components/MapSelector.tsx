import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";
import MapTokenInput from './MapTokenInput';
import { useMapboxToken } from '@/hooks/useMapboxToken';
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
  const [isLoading, setIsLoading] = useState(false);
  const { token, isTokenSet, saveToken } = useMapboxToken();

  const handleTokenSet = (newToken: string) => {
    saveToken(newToken);
    setIsLoading(true);
    initializeMap(newToken);
  };

  useEffect(() => {
    if (isTokenSet && token) {
      initializeMap(token);
    }
  }, [isTokenSet, token]);

  const initializeMap = async (token: string) => {
    if (!mapContainer.current || !token) return;
    try {
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
      toast.error("Failed to load map. Please check your token and try again.");
    }
  };
  // Remove the automatic initialization
  if (!isTokenSet) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <MapTokenInput onTokenSet={handleTokenSet} isLoading={isLoading} />
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