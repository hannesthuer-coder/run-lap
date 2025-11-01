import { useEffect, useRef, useState } from 'react';
import { MapboxService } from '@/services/mapbox.service';
import { RouteService } from '@/services/route.service';
import type { Coordinates, GeneratedRoute } from '@/types';

interface RouteMapProps {
  route: GeneratedRoute;
  startLocation: Coordinates;
  unit: 'km' | 'miles';
}

export function RouteMap({ route, startLocation, unit }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !route || isInitialized) return;

    const initializeMap = async () => {
      try {
        const mapboxgl = MapboxService.initialize();

        const map = MapboxService.createMap(mapContainer.current!, {
          center: [startLocation.lng, startLocation.lat],
          zoom: 14,
        });

        map.on('load', () => {
          // Add route layer
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry,
            },
          });

          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#3B82F6',
              'line-width': 4,
              'line-opacity': 0.9,
            },
          });

          // Add start marker
          const startMarker = MapboxService.createMarker(
            [startLocation.lng, startLocation.lat],
            '#3B82F6'
          );
          startMarker.addTo(map);

          // Add waypoint markers if available (AI routes)
          if (route.waypoints && route.waypoints.length > 0) {
            route.waypoints.forEach((waypoint) => {
              const waypointMarker = MapboxService.createMarker(
                [waypoint.lng, waypoint.lat],
                '#10B981'
              );
              waypointMarker.addTo(map);
            });
          }

          // Fit map to route bounds
          const bounds = new mapboxgl.LngLatBounds();
          route.geometry.coordinates.forEach((coord) => bounds.extend(coord as [number, number]));
          map.fitBounds(bounds, { padding: 50 });
        });

        mapRef.current = map;
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize route map:', error);
      }
    };

    initializeMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [route, startLocation, isInitialized]);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Route Info Overlay with AI Insights */}
      <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border max-w-xs">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {RouteService.formatDistance(route.distance, unit)}
          </p>
          <p className="text-xs text-muted-foreground">
            {MapboxService.coordinatesToString(startLocation)}
          </p>
          {route.aiInsights && (
            <>
              {route.aiInsights.generationMethod === 'ai' && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-2">
                  🤖 AI-Generated Route
                </p>
              )}
              {route.aiInsights.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {route.aiInsights.description}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RouteMap;
