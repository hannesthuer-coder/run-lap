import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Settings, MapPin, Timer, Route as RouteIcon, Loader2 } from "lucide-react";
import MapComponent from "@/components/MapComponent";

const Route = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateKey, setRegenerateKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showHeader, setShowHeader] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showNotSatisfied, setShowNotSatisfied] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  
  const routeData = location.state || { distance: 5, unit: "km", location: "Current Location" };

  const handleRouteGenerated = () => {
    setIsLoading(false);
    setIsRegenerating(false);
    
    // Sequential fade-in animations
    setTimeout(() => setShowHeader(true), 100);
    setTimeout(() => setShowMap(true), 400);
    setTimeout(() => setShowNotSatisfied(true), 700);
    setTimeout(() => setShowButtons(true), 1000);
  };

  const handleRegenerateRoute = async () => {
    setIsRegenerating(true);
    setIsLoading(true);
    setShowHeader(false);
    setShowMap(false);
    setShowNotSatisfied(false);
    setShowButtons(false);
    
    // Trigger route regeneration by incrementing the key
    setRegenerateKey(prev => prev + 1);
  };

  const handleChangePreferences = () => {
    navigate("/");
  };

  // Mock route stats
  const estimatedTime = Math.round((routeData.distance / (routeData.unit === "km" ? 10 : 6.2)) * 60); // minutes
  const elevationGain = Math.round(routeData.distance * 15); // rough estimate

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Loading Screen */}
      {isLoading && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground uppercase tracking-wide animate-pulse">
            Generating your perfect route
          </h2>
        </div>
      )}

      {/* Header */}
      <div className={`text-center py-8 transition-all duration-500 ${showHeader ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
        <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
          Results
        </h1>
      </div>

      {/* Map Container */}
      <div className={`flex-1 relative px-4 transition-all duration-500 ${showMap ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
        <div className="bg-card rounded-2xl overflow-hidden shadow-soft h-[500px] mb-8">
          <MapComponent 
            startLocation={routeData.location}
            distance={routeData.distance}
            unit={routeData.unit}
            regenerateKey={regenerateKey}
            onRouteGenerated={handleRouteGenerated}
          />
        </div>
      </div>

      {/* Not Satisfied Section */}
      <div className="space-y-6 pb-8">
        <div className={`text-center transition-all duration-500 ${showNotSatisfied ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
          <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
            NOT SATISFIED?
          </h2>
        </div>

        <div className={`flex gap-4 justify-center px-4 transition-all duration-500 ${showButtons ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
          <Button
            onClick={handleRegenerateRoute}
            disabled={isRegenerating}
            variant="outline"
            className="px-8 py-3 h-12 rounded-full border-2 font-semibold uppercase tracking-wide"
          >
            {isRegenerating ? "GENERATING..." : "GENERATE NEW ROUTE"}
          </Button>
          
          <Button
            onClick={handleChangePreferences}
            variant="outline"
            className="px-8 py-3 h-12 rounded-full border-2 font-semibold uppercase tracking-wide"
          >
            CHANGE PREFERENCES
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Route;