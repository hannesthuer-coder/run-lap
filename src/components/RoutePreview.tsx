import { useState, useEffect, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { encodePolyline, simplifyCoordinates } from '@/lib/polyline';
import { supabase } from '@/integrations/supabase/client';

interface RoutePreviewProps {
  geometry: {
    coordinates?: [number, number][];
  } | null;
  className?: string;
}

const RoutePreview = ({ geometry, className = '' }: RoutePreviewProps) => {
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Fetch Mapbox token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data.token);
      } catch (err) {
        console.error('Failed to fetch Mapbox token:', err);
        setHasError(true);
      }
    };
    fetchToken();
  }, []);

  // Generate the static map URL
  const staticMapUrl = useMemo(() => {
    if (!mapboxToken || !geometry?.coordinates?.length) return null;

    try {
      // Simplify coordinates to keep URL length reasonable
      const simplified = simplifyCoordinates(geometry.coordinates, 80);
      const encoded = encodePolyline(simplified);

      if (!encoded) return null;

      // Mapbox Static Images API with polyline overlay
      // path-{strokeWidth}+{color}-{opacity}({encodedPolyline})
      const pathOverlay = `path-4+3b82f6-0.8(${encodeURIComponent(encoded)})`;
      
      return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pathOverlay}/auto/400x200@2x?access_token=${mapboxToken}&padding=30`;
    } catch (err) {
      console.error('Failed to generate static map URL:', err);
      return null;
    }
  }, [mapboxToken, geometry]);

  // Fallback placeholder
  if (hasError || !geometry?.coordinates?.length) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-t-lg ${className}`}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MapPin className="h-8 w-8" />
          <span className="text-xs">No preview available</span>
        </div>
      </div>
    );
  }

  // Loading state
  if (!staticMapUrl || isLoading) {
    return (
      <div className={`relative rounded-t-lg overflow-hidden ${className}`}>
        <Skeleton className="absolute inset-0" />
        {staticMapUrl && (
          <img
            src={staticMapUrl}
            alt="Route preview"
            className="w-full h-full object-cover opacity-0"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`relative rounded-t-lg overflow-hidden ${className}`}>
      <img
        src={staticMapUrl}
        alt="Route preview"
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
    </div>
  );
};

export default RoutePreview;
