import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RouteService } from '@/services/route.service';
import type { Coordinates, GeneratedRoute, LoadingPhase } from '@/types';

interface UseRouteGenerationProps {
  startLocation: Coordinates;
  distance: number;
  unit: 'km' | 'miles';
}

export function useRouteGeneration({ startLocation, distance, unit }: UseRouteGenerationProps) {
  const [route, setRoute] = useState<GeneratedRoute | null>(null);
  const [phase, setPhase] = useState<LoadingPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const generateRoute = useCallback(async () => {
    setPhase('loading');
    setError(null);

    try {
      const generatedRoute = await RouteService.generateRoute({
        startLocation,
        distance,
        unit,
      });

      setRoute(generatedRoute);
      setPhase('complete');
      
      // Show AI insights if available
      if (generatedRoute.aiInsights?.generationMethod === 'ai') {
        toast.success(`AI route generated! ${generatedRoute.aiInsights.description}`);
      } else {
        toast.success('Route generated successfully!');
      }
      
      return generatedRoute;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate route';
      setError(errorMessage);
      setPhase('error');
      
      // User-friendly error messages
      if (errorMessage.includes('OpenAI API key')) {
        toast.error('AI service not configured. Please contact support.');
      } else if (errorMessage.includes('quota')) {
        toast.error('AI service quota exceeded. Please try again later.');
      } else if (errorMessage.includes('rate limit')) {
        toast.error('Service busy. Please wait a moment and try again.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Connection issue. Please check your internet.');
      } else {
        toast.error('Failed to generate route. Please try again.');
      }
      
      throw err;
    }
  }, [startLocation, distance, unit]);

  const reset = useCallback(() => {
    setRoute(null);
    setPhase('idle');
    setError(null);
  }, []);

  return {
    route,
    phase,
    error,
    isLoading: phase === 'loading',
    isComplete: phase === 'complete',
    isError: phase === 'error',
    generateRoute,
    reset,
  };
}
