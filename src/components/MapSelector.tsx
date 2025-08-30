import { useEffect, useRef } from 'react';
import { toast } from "sonner";
import { createMap, initializeMapbox } from '@/services/mapService';

interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
}

const MapSelector = ({ onLocationSelect }: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);

  const initializeMap = async () => {
    if (!mapContainer.current) return;
    
    try {
      // Get user location in background
      const getUserLocation = (): Promise<[number, number]> => {
        return new Promise((resolve) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              position => resolve([position.coords.longitude, position.coords.latitude]),
              () => resolve([-74.5, 40])
            );
          } else {
            resolve([-74.5, 40]);
          }
        });
      };
      
      const userLocation = await getUserLocation();
      const mapInstance = await createMap(mapContainer.current, {
        center: userLocation,
        zoom: 14
      });

      const mapboxgl = await initializeMapbox();

      mapInstance.on('click', (e: any) => {
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }

        const newMarker = new mapboxgl.Marker({
          color: '#ef4444',
          scale: 1.2
        }).setLngLat(coords).addTo(mapInstance);
        
        markerRef.current = newMarker;
        onLocationSelect(coords);
        toast.success("Starting point selected!");
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error("Failed to load map. Please try again.");
    }
  };
  
  useEffect(() => {
    const checkAndInitialize = () => {
      if (mapContainer.current && mapContainer.current.offsetHeight > 0) {
        initializeMap();
      } else {
        setTimeout(checkAndInitialize, 50);
      }
    };
    
    checkAndInitialize();
  }, []);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute inset-0 bg-white/5 pointer-events-none" />
    </div>
  );
};
export default MapSelector;