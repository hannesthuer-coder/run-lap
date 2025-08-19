import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFubmVzdGh1ciIsImEiOiJjbWVmaTB3eHMxMHkyMmxzZnUxb3hhM2NuIn0.HXWWHQcsYrtdkiw5cCwNhQ"; // TODO: Move to environment variable

  const initializeMap = async () => {
    if (!mapContainer.current) return;
    try {
      // Dynamically import mapbox-gl
      const mapboxgl = await import('mapbox-gl');

      // Set access token
      mapboxgl.default.accessToken = MAPBOX_TOKEN;

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
        style: 'mapbox://styles/mapbox/light-v11',
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
      toast.error("Failed to load map. Please check your token and try again.");
    }
  };
  useEffect(() => {
    initializeMap();
  }, []);
  return <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Instructions Overlay */}
      
    </div>;
};
export default MapSelector;