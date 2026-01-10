import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { RouteLimitService } from "@/services/routeLimit.service";
import { UpgradeModal } from "@/components/UpgradeModal";
import { supabase } from "@/integrations/supabase/client";
import { FingerprintService } from "@/services/fingerprint.service";
import type { RouteLimitStatus } from "@/types";
const Preferences = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isPremium
  } = useAuth();
  const [distance, setDistance] = useState("");
  const [isKm, setIsKm] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [locationMethod, setLocationMethod] = useState<"current" | "map" | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [routeLimitStatus, setRouteLimitStatus] = useState<RouteLimitStatus | null>(null);

  // Check route limit on mount, but skip if already premium from AuthContext
  useEffect(() => {
    checkRouteLimit();
  }, [isPremium]);
  const checkRouteLimit = async () => {
    // If AuthContext already knows user is premium, skip the limit check
    if (isPremium) {
      setRouteLimitStatus({
        canGenerate: true,
        remainingRoutes: Infinity,
        totalGenerated: 0,
        isPremium: true,
        needsUpgrade: false
      });
      return;
    }
    const status = await RouteLimitService.checkRouteLimit();
    setRouteLimitStatus(status);
    // Don't show upgrade modal on page load - only when user tries to generate
  };

  // Handle location selection from map
  useEffect(() => {
    if (location.state?.selectedLocation) {
      setSelectedLocation(location.state.selectedLocation);
      setLocationMethod("map");
      // Restore distance and unit if they were passed back
      if (location.state.distance) {
        setDistance(location.state.distance);
      }
      if (location.state.isKm !== undefined) {
        setIsKm(location.state.isKm);
      }
      // Clear the state to prevent re-setting on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  const handleUseCurrentLocation = () => {
    // Toggle selection state
    if (locationMethod === "current") {
      setLocationMethod(null);
      setSelectedLocation("");
      return;
    }
    setLocationMethod("current");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        setSelectedLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        toast.success("Current location detected!");
      }, error => {
        toast.error("Unable to get your location. Please try again or choose on map.");
        setLocationMethod(null);
      });
    } else {
      toast.error("Geolocation is not supported by this browser.");
      setLocationMethod(null);
    }
  };
  const handleChooseOnMap = () => {
    // Toggle selection state
    if (locationMethod === "map") {
      setLocationMethod(null);
      setSelectedLocation("");
      return;
    }
    setLocationMethod("map");
    navigate("/choose-location", {
      state: {
        distance,
        isKm
      }
    });
  };
  const handleGenerate = async () => {
    if (!distance || parseFloat(distance) <= 0) {
      toast.error("Please enter a valid distance.");
      return;
    }
    if (!selectedLocation) {
      toast.error("Please select a starting location.");
      return;
    }

    // Check route limit BEFORE generating
    const limitStatus = await RouteLimitService.checkRouteLimit();
    if (!limitStatus.canGenerate) {
      setShowUpgradeModal(true);
      return;
    }
    setIsGenerating(true);
    try {
      // Parse coordinates from selectedLocation
      const [lat, lng] = selectedLocation.split(',').map(coord => parseFloat(coord.trim()));
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid coordinates');
      }

      // Get fingerprint for anonymous users
      let fingerprint: string | undefined;
      if (!user) {
        fingerprint = await FingerprintService.getFingerprint();
      }

      // Generate route before navigating
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-route', {
        body: {
          startLng: lng,
          startLat: lat,
          distance: parseFloat(distance),
          unit: isKm ? 'km' : 'miles',
          fingerprint // Include for anonymous users
        }
      });
      if (error) {
        throw error;
      }
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate route');
      }

      // Only increment local count after successful generation
      RouteLimitService.incrementLocalCount();
      setIsGenerating(false);

      // Navigate with the preloaded route
      navigate("/route", {
        state: {
          distance: parseFloat(distance),
          unit: isKm ? "km" : "miles",
          location: selectedLocation,
          route_geometry: data.route.geometry,
          isPreloaded: true
        }
      });
    } catch (error: any) {
      console.error('Route generation error:', error);
      setIsGenerating(false);
      if (error.message?.includes('quota')) {
        toast.error("Service quota exceeded. Please try again later.");
      } else if (error.message?.includes('rate limit')) {
        toast.error("Service temporarily busy. Please wait and try again.");
      } else if (error.message?.includes('tolerance')) {
        toast.error("Could not generate a suitable route. Try a different location or distance.");
      } else {
        toast.error("Failed to generate route. Please try again.");
      }
    }
  };
  return <div className="min-h-screen bg-background flex flex-col pt-[100px]">
      <Helmet>
        <title>Run-Lap: Generate Your Perfect Running Route | AI Route Planner</title>
        <meta name="description" content="Create your perfect running lap in seconds. Set your distance, choose your starting location, and let AI generate a custom running route just for you." />
        <link rel="canonical" href="https://run-lap.com/start" />
        <meta property="og:title" content="Run-Lap: Generate Your Perfect Running Route" />
        <meta property="og:description" content="Create your perfect running lap in seconds. Set your distance and starting location." />
        <meta property="og:url" content="https://run-lap.com/start" />
      </Helmet>
      <Header />
      <div className="w-full max-w-lg mx-auto space-y-8 flex-1 flex flex-col justify-center px-4 py-6 pt-28 sm:pt-32 sm:py-[200px]">
        {/* Main Title */}
        <div className="text-center">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-wide leading-tight">what distance do you want to run?</h1>
        </div>

        {/* Distance Input */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-sm">
            <Input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="Select Distance" className="text-left text-base sm:text-lg h-12 sm:h-14 rounded-full border-2 pr-16 sm:pr-20 w-full pl-4 sm:pl-6" min="0" step="0.1" />
            <div className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex items-center">
              <div className="flex border rounded-full overflow-hidden">
                <button onClick={() => setIsKm(true)} className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium transition-colors ${isKm ? 'bg-beige text-beige-foreground' : 'bg-background hover:bg-beige-hover'}`}>
                  km
                </button>
                <button onClick={() => setIsKm(false)} className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium transition-colors border-l ${!isKm ? 'bg-beige text-beige-foreground' : 'bg-background hover:bg-beige-hover'}`}>
                  miles
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-wide">select your starting point</h2>
          </div>

          <div className="flex flex-row gap-4 justify-center items-center">
            <Button variant={locationMethod === "current" ? "selected" : "outline"} onClick={handleUseCurrentLocation} className="w-36 sm:w-44 px-4 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold tracking-wide text-xs sm:text-sm" disabled={isGenerating}>
              current location
            </Button>
            
            <div className="flex items-center justify-center">
              <span className="text-xs text-muted-foreground tracking-wider font-light">or</span>
            </div>
            
            <Button variant={locationMethod === "map" ? "selected" : "outline"} onClick={handleChooseOnMap} className="w-36 sm:w-44 px-4 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold tracking-wide text-xs sm:text-sm" disabled={isGenerating}>
              choose on map
            </Button>
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex flex-col items-center gap-2">
          <Button onClick={handleGenerate} disabled={isGenerating || !distance || !selectedLocation} className="w-auto px-8 py-3 h-12 sm:h-14 rounded-full font-semibold tracking-wide bg-beige hover:bg-beige-hover text-beige-foreground text-sm sm:text-base" size="lg">
            {isGenerating ? "generating..." : "generate"}
          </Button>
          
          {/* Remaining routes counter - only show for non-premium users */}
          {routeLimitStatus && !routeLimitStatus.isPremium && <p className="text-xs text-muted-foreground">
              You have {routeLimitStatus.remainingRoutes} free lap{routeLimitStatus.remainingRoutes !== 1 ? 's' : ''} left today
            </p>}
        </div>
      </div>
      <Footer />

      {/* Upgrade Modal */}
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} routesGenerated={routeLimitStatus?.totalGenerated || 0} />
    </div>;
};
export default Preferences;