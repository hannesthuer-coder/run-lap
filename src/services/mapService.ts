import { toast } from "sonner";
import 'mapbox-gl/dist/mapbox-gl.css';

let mapboxgl: any = null;
let currentToken: string | null = null;

// Initialize mapbox with a token passed from authenticated fetch
export const initializeMapbox = async (token?: string): Promise<any> => {
  console.log('mapService: initializeMapbox called');
  
  // If we already have mapbox initialized with the same token, return it
  if (mapboxgl && currentToken === token) {
    console.log('mapService: returning cached mapboxgl');
    return mapboxgl;
  }
  
  try {
    console.log('mapService: importing mapbox-gl...');
    mapboxgl = (await import('mapbox-gl')).default;
    
    if (!token) {
      throw new Error('Mapbox token is required');
    }
    
    console.log('mapService: setting access token...');
    mapboxgl.accessToken = token;
    currentToken = token;
    
    console.log('mapService: mapbox initialized successfully');
    return mapboxgl;
  } catch (error) {
    console.error('mapService: failed to initialize mapbox:', error);
    throw error;
  }
};

// Create a basic map instance
export const createMap = async (container: HTMLElement, options: any, token?: string) => {
  const mapboxglLib = await initializeMapbox(token);
  
  const map = new mapboxglLib.Map({
    container,
    style: 'mapbox://styles/mapbox/streets-v12',
    attributionControl: false,
    ...options
  });
  
  map.addControl(new mapboxglLib.NavigationControl(), 'bottom-right');
  return map;
};