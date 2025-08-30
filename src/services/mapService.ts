import { toast } from "sonner";
import 'mapbox-gl/dist/mapbox-gl.css';

let mapboxgl: any = null;
let mapboxToken: string | null = null;

// Get Mapbox token from Supabase edge function
export const getMapboxToken = async (): Promise<string | null> => {
  console.log('getMapboxToken called, current token:', mapboxToken);
  if (mapboxToken) return mapboxToken;
  
  try {
    console.log('Importing supabase client...');
    const { supabase } = await import('@/integrations/supabase/client');
    console.log('Supabase client imported, calling get-mapbox-token function...');
    
    const { data, error } = await supabase.functions.invoke('get-mapbox-token');
    console.log('Edge function response:', { data, error });
    
    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }
    if (!data?.token) {
      console.error('No token in response:', data);
      throw new Error('No token received');
    }
    
    console.log('Token received:', data.token.substring(0, 10) + '...');
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