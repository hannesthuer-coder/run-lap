import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import 'mapbox-gl/dist/mapbox-gl.css';

let mapboxgl: any = null;

// Fetch Mapbox token securely from edge function
export const initializeMapbox = async (): Promise<any> => {
  console.log('mapService: initializeMapbox called');
  
  if (mapboxgl) {
    console.log('mapService: returning cached mapboxgl');
    return mapboxgl;
  }
  
  try {
    console.log('mapService: importing mapbox-gl...');
    mapboxgl = (await import('mapbox-gl')).default;
    
    console.log('mapService: fetching access token from edge function...');
    const { data, error } = await supabase.functions.invoke('get-mapbox-token');
    
    if (error || !data?.token) {
      console.error('mapService: failed to fetch token:', error);
      throw new Error('Failed to retrieve Mapbox token');
    }
    
    mapboxgl.accessToken = data.token;
    
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
  
  map.addControl(new mapboxglLib.NavigationControl(), 'top-right');
  return map;
};
