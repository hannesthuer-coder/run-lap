import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";
import { createMap, initializeMapbox } from '@/services/mapService';
import { supabase } from '@/integrations/supabase/client';

interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
}

const MapSelector = ({ onLocationSelect }: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  const initializeMap = async () => {
    if (!mapContainer.current) return;
    
    try {
      // Fetch Mapbox token from secure edge function
      let token = mapboxToken;
      if (!token) {
        console.log('MapSelector: Fetching Mapbox token...');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error || !data?.success || !data?.token) {
          console.error('Failed to fetch Mapbox token:', error || data?.error);
          toast.error("Failed to load map. Please try again.");
          return;
        }
        token = data.token;
        setMapboxToken(token);
      }

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
      }, token);

      const mapboxgl = await initializeMapbox(token);

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