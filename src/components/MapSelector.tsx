import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { toast } from "sonner";

interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
}

const MapSelector = ({ onLocationSelect }: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const GOOGLE_MAPS_API_KEY = "AIzaSyAm3IKVxRxms6p1tX5jPg6xzz85IGspT0k";

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
        libraries: ["geometry"]
      });

      await loader.load();

      // Get user's current location
      const getUserLocation = (): Promise<[number, number]> => {
        return new Promise((resolve) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              position => {
                resolve([position.coords.latitude, position.coords.longitude]);
              },
              () => {
                // Default to New York if location fails
                resolve([40.7128, -74.0060]);
              }
            );
          } else {
            // Default to New York if geolocation not supported
            resolve([40.7128, -74.0060]);
          }
        });
      };

      const [lat, lng] = await getUserLocation();

      // Create map instance
      const mapInstance = new google.maps.Map(mapContainer.current, {
        center: { lat, lng },
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative'
      });

      // Handle map clicks
      mapInstance.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          const clickedLat = event.latLng.lat();
          const clickedLng = event.latLng.lng();

          // Remove existing marker
          if (markerRef.current) {
            markerRef.current.setMap(null);
          }

          // Add new marker
          const newMarker = new google.maps.Marker({
            position: { lat: clickedLat, lng: clickedLng },
            map: mapInstance,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#ef4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            }
          });

          markerRef.current = newMarker;
          onLocationSelect([clickedLat, clickedLng]);
          toast.success("Starting point selected!");
        }
      });

      setMap(mapInstance);
      toast.success("Map loaded! Click anywhere to select your starting point.");
    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error("Failed to load map. Please try again.");
    }
  };

  useEffect(() => {
    initializeMap();
  }, []);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />
    </div>
  );
};

export default MapSelector;