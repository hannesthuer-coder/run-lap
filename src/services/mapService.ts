import { toast } from "sonner";
import 'mapbox-gl/dist/mapbox-gl.css';

let mapboxgl: any = null;
let mapboxToken: string | null = null;

// Get Mapbox token from Supabase edge function
export const getMapboxToken = async (): Promise<string | null> => {
  if (mapboxToken) return mapboxToken;
  
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.functions.invoke('get-mapbox-token');
    
    if (error) throw error;
    if (!data?.token) throw new Error('No token received');
    
    mapboxToken = data.token;
    return mapboxToken;
  } catch (error) {
    console.error('Failed to get Mapbox token:', error);
    toast.error(`Failed to load map: ${error.message}`);
    return null;
  }
};

// Initialize Mapbox GL library
export const initializeMapbox = async (): Promise<any> => {
  if (mapboxgl) return mapboxgl;
  
  const token = await getMapboxToken();
  if (!token) throw new Error('Failed to get Mapbox token');
  
  mapboxgl = (await import('mapbox-gl')).default;
  mapboxgl.accessToken = token;
  
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