import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
}

const MapSelector = ({ onLocationSelect }: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);

  const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFubmVzdGh1ciIsImEiOiJjbWVmaTB3eHMxMHkyMmxzZnUxb3hhM2NuIn0.HXWWHQcsYrtdkiw5cCwNhQ"; // TODO: Move to environment variable

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      // Dynamically import mapbox-gl
      const mapboxgl = await import('mapbox-gl');
      
      // Set access token
      mapboxgl.default.accessToken = MAPBOX_TOKEN;

      // Create map instance
      const mapInstance = new mapboxgl.default.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-74.5, 40],
        zoom: 10,
        attributionControl: false
      });

      // Add navigation controls
      mapInstance.addControl(new mapboxgl.default.NavigationControl(), 'top-right');

      // Handle map clicks
      mapInstance.on('click', (e) => {
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        
        // Remove existing marker
        if (marker) {
          marker.remove();
        }
        
        // Add new marker
        const newMarker = new mapboxgl.default.Marker({ 
          color: '#ef4444',
          scale: 1.2 
        })
          .setLngLat(coords)
          .addTo(mapInstance);
        
        setMarker(newMarker);
        onLocationSelect(coords);
        
        toast.success("Location selected!");
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

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Instructions Overlay */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-medium border">
        <p className="text-sm font-medium text-foreground text-center">
          🔴 Click anywhere to place your starting marker
        </p>
      </div>
    </div>
  );
};

export default MapSelector;