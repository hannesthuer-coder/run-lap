import { toast } from "sonner";
import 'mapbox-gl/dist/mapbox-gl.css';

let mapboxgl: any = null;

// Use direct token like in working MapTest
export const initializeMapbox = async (): Promise<any> => {
  console.log('mapService: initializeMapbox called');
  
  if (mapboxgl) {
    console.log('mapService: returning cached mapboxgl');
    return mapboxgl;
  }
  
  try {
    console.log('mapService: importing mapbox-gl...');
    mapboxgl = (await import('mapbox-gl')).default;
    
    console.log('mapService: setting access token...');
    mapboxgl.accessToken = 'pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWV2cTk2Y2kwY3J4MmpzN2N3YWFpdXRtIn0.HMwsWwD4VsglAlp3kjultg';
    
    console.log('mapService: mapbox initialized successfully');
    return mapboxgl;
  } catch (error) {
    console.error('mapService: failed to initialize mapbox:', error);
    throw error;
  }
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
  
  map.addControl(new mapboxglLib.NavigationControl(), 'bottom-right');
  return map;
};