import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";
import { Loader } from "@googlemaps/js-api-loader";
interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
}

const MapSelector = ({ onLocationSelect }: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const initializeMap = async () => {
    if (!mapContainer.current) return;
    
    try {
      // Get user's current location first
      const getUserLocation = (): Promise<{ lat: number; lng: number }> => {
        return new Promise((resolve) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              position => {
                resolve({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                });
              },
              error => {
                console.warn('Could not get user location:', error);
                // Default to New York if location fails
                resolve({ lat: 40.7128, lng: -74.0060 });
              }
            );
          } else {
            // Default to New York if geolocation not supported
            resolve({ lat: 40.7128, lng: -74.0060 });
          }
        });
      };
      
      const userLocation = await getUserLocation();
      
      // Get Google Maps API key from edge function
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: apiKeyData } = await supabase.functions.invoke('get-google-maps-key');
      const apiKey = apiKeyData?.key || 'placeholder';
      
      // Load Google Maps
      const loader = new Loader({
        apiKey: apiKey,
        version: "weekly"
      });
      
      const { Map } = await loader.importLibrary("maps");
      
      // Create map instance
      const mapInstance = new Map(mapContainer.current, {
        center: userLocation,
        zoom: 14,
        mapTypeId: "roadmap",
        styles: [
          {
            featureType: "all",
            elementType: "geometry.fill",
            stylers: [{ color: "#f5f5f5" }]
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#c9e9ff" }]
          }
        ]
      });
      
      // Handle map clicks
      mapInstance.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        
        const coords: [number, number] = [e.latLng.lng(), e.latLng.lat()];
        
        // Remove existing marker
        if (markerRef.current) {
          markerRef.current.setMap(null);
        }
        
        // Add new marker
        const newMarker = new google.maps.Marker({
          position: e.latLng,
          map: mapInstance,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff"
          }
        });
        
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
  }, []);
  return <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Instructions Overlay */}
      
    </div>;
};
export default MapSelector;