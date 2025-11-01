import mapboxgl from 'mapbox-gl';
import { env } from '@/config/env';
import type { Coordinates } from '@/types';
import 'mapbox-gl/dist/mapbox-gl.css';

// Initialize Mapbox token
mapboxgl.accessToken = env.mapbox.token;

interface MapOptions {
  center: [number, number]; // [lng, lat]
  zoom?: number;
}

export class MapboxService {
  private static instance: typeof mapboxgl;

  static initialize(): typeof mapboxgl {
    if (!this.instance) {
      this.instance = mapboxgl;
    }
    return this.instance;
  }

  static createMap(container: HTMLElement, options: MapOptions): mapboxgl.Map {
    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: options.center,
      zoom: options.zoom ?? 14,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    return map;
  }

  static createMarker(coordinates: [number, number], color = '#3B82F6'): mapboxgl.Marker {
    return new mapboxgl.Marker({ 
      color, 
      scale: 1.2 
    }).setLngLat(coordinates);
  }

  static async getUserLocation(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    });
  }

  static coordinatesToString(coords: Coordinates): string {
    return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  }

  static parseCoordinates(coordString: string): Coordinates {
    const [lat, lng] = coordString.split(',').map(s => parseFloat(s.trim()));
    return { lat, lng };
  }
}

export default MapboxService;
