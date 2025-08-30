import { toast } from "sonner";
import 'mapbox-gl/dist/mapbox-gl.css';

let mapboxgl: any = null;
let mapboxToken: string | null = null;

// Get Mapbox token from Supabase edge function with timeout and fallback
export const getMapboxToken = async (): Promise<string | null> => {
  console.log('getMapboxToken called, current token:', mapboxToken);
  if (mapboxToken) return mapboxToken;
  
  try {
    console.log('Importing supabase client...');
    const { supabase } = await import('@/integrations/supabase/client');
    console.log('Supabase client imported, calling get-mapbox-token function...');
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Edge function timeout after 10 seconds')), 10000);
    });
    
    const functionPromise = supabase.functions.invoke('get-mapbox-token');
    
    const { data, error } = await Promise.race([functionPromise, timeoutPromise]) as any;
    console.log('Edge function response:', { data, error });
    
    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }
    if (!data?.success || !data?.token) {
      console.error('Invalid response from edge function:', data);
      throw new Error('Invalid token response');
    }
    
    console.log('Token received successfully');
    mapboxToken = data.token;
    return mapboxToken;
  } catch (error) {
    console.error('Failed to get Mapbox token:', error);
    
    // Fallback: try to use the public token directly if edge function fails
    const fallbackToken = 'pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWV2cTk2Y2kwY3J4MmpzN2N3YWFpdXRtIn0.HMwsWwD4VsglAlp3kjultg';
    console.log('Using fallback token...');
    mapboxToken = fallbackToken;
    return mapboxToken;
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