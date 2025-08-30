import { toast } from "sonner";
import 'mapbox-gl/dist/mapbox-gl.css';

let mapboxgl: any = null;
let mapboxToken: string | null = null;

// Temporarily bypass edge function and use direct token
export const getMapboxToken = async (): Promise<string | null> => {
  console.log('getMapboxToken called - using direct token');
  if (mapboxToken) return mapboxToken;
  
  // Use the token directly for now
  const directToken = 'pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWV2cTk2Y2kwY3J4MmpzN2N3YWFpdXRtIn0.HMwsWwD4VsglAlp3kjultg';
  console.log('Using direct Mapbox token');
  mapboxToken = directToken;
  return mapboxToken;
};

// Initialize Mapbox GL library
export const initializeMapbox = async (): Promise<any> => {
  console.log('initializeMapbox called, current mapboxgl:', !!mapboxgl);
  if (mapboxgl) return mapboxgl;
  
  console.log('Getting Mapbox token...');
  const token = await getMapboxToken();
  if (!token) {
    console.error('No token received from getMapboxToken');
    throw new Error('Failed to get Mapbox token');
  }
  
  console.log('Token received, importing mapbox-gl...');
  mapboxgl = (await import('mapbox-gl')).default;
  mapboxgl.accessToken = token;
  console.log('Mapbox initialized successfully');
  
  return mapboxgl;
};

// Create a basic map instance
export const createMap = async (container: HTMLElement, options: any) => {
  const mapboxglLib = await initializeMapbox();
  
  const map = new mapboxglLib.Map({
    container,
    style: 'mapbox://styles/mapbox/streets-v12',
    attributionControl: false,
    ...options
  });
  
  map.addControl(new mapboxglLib.NavigationControl(), 'top-right');
  return map;
};