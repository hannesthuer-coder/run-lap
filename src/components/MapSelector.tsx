import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import 'leaflet/dist/leaflet.css';

interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
}

const MapSelector = ({
  onLocationSelect
}: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const markerRef = useRef<any>(null);

  const initializeMap = async () => {
    if (!mapContainer.current) return;
    
    try {
      // Dynamically import Leaflet
      const L = await import('leaflet');

      // Fix default marker icons for Leaflet
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Get user's current location first
      const getUserLocation = (): Promise<[number, number]> => {
        return new Promise((resolve, reject) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
              resolve([position.coords.latitude, position.coords.longitude]);
            }, error => {
              console.warn('Could not get user location:', error);
              // Default to New York if location fails
              resolve([40, -74.5]);
            });
          } else {
            // Default to New York if geolocation not supported
            resolve([40, -74.5]);
          }
        });
      };

      const userLocation = await getUserLocation();

      // Create map instance centered on user's location
      const mapInstance = L.map(mapContainer.current, {
        center: userLocation,
        zoom: 14,
        zoomControl: true,
        attributionControl: false
      });

      // Add beautiful OpenStreetMap tiles with custom styling
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        className: 'map-tiles'
      }).addTo(mapInstance);

      // Add zoom controls in top-right
      mapInstance.zoomControl.setPosition('topright');

      // Handle map clicks
      mapInstance.on('click', (e: any) => {
        const coords: [number, number] = [e.latlng.lng, e.latlng.lat];

        // Always remove existing marker first
        if (markerRef.current) {
          mapInstance.removeLayer(markerRef.current);
          markerRef.current = null;
        }

        // Create custom red marker
        const redIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background-color: #ef4444;
            width: 25px;
            height: 25px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            position: relative;
            transform: translate(-50%, -50%);
          "></div>`,
          iconSize: [25, 25],
          iconAnchor: [12.5, 12.5]
        });

        // Add new marker
        const newMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: redIcon }).addTo(mapInstance);
        markerRef.current = newMarker;
        
        onLocationSelect(coords);
        toast.success("Starting point selected!");
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
    
    // Cleanup on unmount
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0 rounded-2xl overflow-hidden" />
    </div>
  );
};

export default MapSelector;