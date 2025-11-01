import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MapboxService } from '@/services/mapbox.service';
import type { Coordinates } from '@/types';

interface MapSelectorProps {
  onLocationSelect: (coords: Coordinates) => void;
}

export function MapSelector({ onLocationSelect }: MapSelectorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || isInitialized) return;

    const initializeMap = async () => {
      try {
        let center: [number, number];
        try {
          const userLocation = await MapboxService.getUserLocation();
          center = [userLocation.lng, userLocation.lat];
        } catch {
          center = [18.0686, 59.3293];
        }

        const mapboxgl = MapboxService.initialize();
        const map = MapboxService.createMap(mapContainer.current!, {
          center,
          zoom: 14,
        });

        map.on('click', (e) => {
          const coords: Coordinates = {
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
          };

          if (markerRef.current) {
            markerRef.current.remove();
          }

          const marker = MapboxService.createMarker([coords.lng, coords.lat], '#ef4444');
          marker.addTo(map);
          markerRef.current = marker;

          onLocationSelect(coords);
          toast.success('Starting point selected!');
        });

        mapRef.current = map;
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize map:', error);
        toast.error('Failed to load map. Please try again.');
      }
    };

    initializeMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [isInitialized, onLocationSelect]);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
}

export default MapSelector;