import { supabase } from '@/integrations/supabase/client';
import type { Coordinates, GeneratedRoute, RouteGenerationResponse } from '@/types';

interface GenerateRouteParams {
  startLocation: Coordinates;
  distance: number;
  unit: 'km' | 'miles';
}

export class RouteService {
  static async generateRoute(params: GenerateRouteParams): Promise<GeneratedRoute> {
    const { startLocation, distance, unit } = params;

    // Call the AI-powered route generation function
    const { data, error } = await supabase.functions.invoke<RouteGenerationResponse>(
      'generate-ai-route',  // Using AI version!
      {
        body: {
          startLng: startLocation.lng,
          startLat: startLocation.lat,
          distance,
          unit,
        },
      }
    );

    if (error) {
      throw new Error(`Failed to generate route: ${error.message}`);
    }

    if (!data?.success || !data.route) {
      throw new Error(data?.error || 'Route generation failed');
    }

    return data.route;
  }

  static formatDistance(meters: number, unit: 'km' | 'miles'): string {
    const value = unit === 'km' 
      ? meters / 1000 
      : meters / 1609.34;
    
    return `${value.toFixed(2)} ${unit}`;
  }

  static formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    
    if (minutes < 60) {
      return `${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m`;
  }
}

export default RouteService;
