import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { MapboxService } from '@/services/mapbox.service';
import Footer from '@/components/Footer';
import type { LocationMethod, Coordinates } from '@/types';

export default function Preferences() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<'km' | 'miles'>('km');
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [locationMethod, setLocationMethod] = useState<LocationMethod>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Restore state from navigation
  useEffect(() => {
    if (location.state) {
      const state = location.state as any;
      if (state.selectedLocation) {
        setSelectedLocation(MapboxService.parseCoordinates(state.selectedLocation));
        setLocationMethod('map');
      }
      if (state.distance) setDistance(state.distance);
      if (state.unit) setUnit(state.unit);
      
      // Clear state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleUseCurrentLocation = async () => {
    if (locationMethod === 'current') {
      setLocationMethod(null);
      setSelectedLocation(null);
      return;
    }

    setLocationMethod('current');
    
    try {
      const coords = await MapboxService.getUserLocation();
      setSelectedLocation(coords);
      toast.success('Current location detected!');
    } catch (error) {
      toast.error('Unable to get your location. Please try choosing on map.');
      setLocationMethod(null);
    }
  };

  const handleChooseOnMap = () => {
    if (locationMethod === 'map') {
      setLocationMethod(null);
      setSelectedLocation(null);
      return;
    }

    navigate('/choose-location', {
      state: { distance, unit },
    });
  };

  const handleGenerate = () => {
    const distanceNum = parseFloat(distance);
    
    if (!distance || distanceNum <= 0) {
      toast.error('Please enter a valid distance.');
      return;
    }

    if (!selectedLocation) {
      toast.error('Please select a starting location.');
      return;
    }

    setIsGenerating(true);

    navigate('/route', {
      state: {
        distance: distanceNum,
        unit,
        startLocation: selectedLocation,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-4 py-6 sm:py-8">
      <div className="w-full max-w-lg mx-auto space-y-8 flex-1 flex flex-col justify-center">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground uppercase tracking-wide leading-tight">
            What distance do you want to run today?
          </h1>
        </div>

        {/* Distance Input */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-sm">
            <Input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="Select Distance"
              className="text-left text-base sm:text-lg h-12 sm:h-14 rounded-full border-2 pr-16 sm:pr-20 w-full pl-4 sm:pl-6"
              min="0"
              step="0.1"
            />
            <div className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex items-center">
              <div className="flex border rounded-full overflow-hidden">
                <button
                  onClick={() => setUnit('km')}
                  className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium transition-colors ${
                    unit === 'km' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'
                  }`}
                >
                  KM
                </button>
                <button
                  onClick={() => setUnit('miles')}
                  className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium transition-colors border-l ${
                    unit === 'miles' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'
                  }`}
                >
                  MILES
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground uppercase tracking-wide">
              Where from?
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              variant={locationMethod === 'current' ? 'default' : 'outline'}
              onClick={handleUseCurrentLocation}
              className="w-full sm:w-44 px-4 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold uppercase tracking-wide text-xs sm:text-sm"
              disabled={isGenerating}
            >
              Current Location
            </Button>

            <span className="text-xs text-muted-foreground uppercase tracking-wider font-light">or</span>

            <Button
              variant={locationMethod === 'map' ? 'default' : 'outline'}
              onClick={handleChooseOnMap}
              className="w-full sm:w-44 px-4 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold uppercase tracking-wide text-xs sm:text-sm"
              disabled={isGenerating}
            >
              Choose on Map
            </Button>
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !distance || !selectedLocation}
            className="w-full sm:w-auto px-8 py-3 h-12 sm:h-14 rounded-full font-semibold uppercase tracking-wide text-sm sm:text-base"
            size="lg"
          >
            {isGenerating ? 'Generating...' : 'Generate AI-Powered Route'}
          </Button>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}