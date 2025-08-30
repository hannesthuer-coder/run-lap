import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";
import { createMap, initializeMapbox } from '@/services/mapService';

interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
}

const MapSelector = ({ onLocationSelect }: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const markerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializeMap = async () => {
    if (!mapContainer.current) return;
    
    try {
      // Get user's current location
      const getUserLocation = (): Promise<[number, number]> => {
        return new Promise((resolve) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              position => resolve([position.coords.longitude, position.coords.latitude]),
              () => resolve([-74.5, 40]) // Default to NYC if location fails
            );
          } else {
            resolve([-74.5, 40]);
          }
        });
      };
      
      const userLocation = await getUserLocation();

      // Create map using shared service
      const mapInstance = await createMap(mapContainer.current, {
        center: userLocation,
        zoom: 14
      });

      // Initialize Mapbox library for marker creation
      const mapboxgl = await initializeMapbox();

      // Handle map clicks
      mapInstance.on('click', (e: any) => {
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        // Remove existing marker
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }

        // Add new marker
        const newMarker = new mapboxgl.Marker({
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