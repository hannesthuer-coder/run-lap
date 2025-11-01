import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RouteMap } from '@/components/RouteMap';
import { useRouteGeneration } from '@/hooks/useRouteGeneration';
import type { Coordinates } from '@/types';

export default function Route() {
  const location = useLocation();
  const navigate = useNavigate();
  const [regenerateCount, setRegenerateCount] = useState(0);

  // Extract route parameters from navigation state
  const routeParams = location.state as {
    distance: number;
    unit: 'km' | 'miles';
    startLocation: Coordinates;
  } | null;

  // Redirect if no parameters
  useEffect(() => {
    if (!routeParams) {
      navigate('/');
    }
  }, [routeParams, navigate]);

  const { route, isLoading, isComplete, generateRoute, reset } = useRouteGeneration({
    startLocation: routeParams?.startLocation || { lat: 59.3293, lng: 18.0686 },
    distance: routeParams?.distance || 5,
    unit: routeParams?.unit || 'km',
  });

  // Generate initial route
  useEffect(() => {
    if (routeParams && !route && !isLoading) {
      generateRoute();
    }
  }, [routeParams, route, isLoading, generateRoute]);

  const handleRegenerateRoute = async () => {
    reset();
    setRegenerateCount(prev => prev + 1);
    await generateRoute();
  };

  const handleChangePreferences = () => {
    navigate('/');
  };

  if (!routeParams) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Loading Screen */}
      {isLoading && (
        <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4" />
            <h2 className="text-sm font-light text-foreground uppercase tracking-wider">
              Generating your perfect AI-powered route...
            </h2>
          </div>
        </div>
      )}

      {/* Header */}
      {isComplete && (
        <div className="text-center py-4 sm:py-6 md:py-8 animate-fade-in">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground uppercase tracking-wide">
            Results
          </h1>
        </div>
      )}

      {/* Map Container */}
      {isComplete && route && (
        <div className="flex-1 relative px-3 sm:px-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="bg-card rounded-xl sm:rounded-2xl overflow-hidden shadow-soft h-[300px] sm:h-[400px] md:h-[500px] mb-4 sm:mb-6 md:mb-8">
            <RouteMap
              route={route}
              startLocation={routeParams.startLocation}
              unit={routeParams.unit}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {isComplete && (
        <div className="space-y-4 sm:space-y-6 pb-6 sm:pb-8 animate-fade-in" style={{ animationDelay: '600ms' }}>
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-bold text-foreground uppercase tracking-wide">
              Not Satisfied?
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Button
              onClick={handleRegenerateRoute}
              variant="outline"
              className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold uppercase tracking-wide text-xs sm:text-sm"
            >
              Generate New Route
            </Button>

            <Button
              onClick={handleChangePreferences}
              variant="outline"
              className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold uppercase tracking-wide text-xs sm:text-sm"
            >
              Change Preferences
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}