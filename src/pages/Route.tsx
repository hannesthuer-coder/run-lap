import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Settings, MapPin, Timer, Route as RouteIcon } from "lucide-react";
import MapComponent from "@/components/MapComponent";

const Route = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateKey, setRegenerateKey] = useState(0);
  
  const routeData = location.state || { distance: 5, unit: "km", location: "Current Location" };

  const handleRegenerateRoute = async () => {
    setIsRegenerating(true);
    // Trigger route regeneration by incrementing the key
    setRegenerateKey(prev => prev + 1);
    // Simulate loading time
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRegenerating(false);
  };

  const handleChangePreferences = () => {
    navigate("/");
  };

  // Mock route stats
  const estimatedTime = Math.round((routeData.distance / (routeData.unit === "km" ? 10 : 6.2)) * 60); // minutes
  const elevationGain = Math.round(routeData.distance * 15); // rough estimate

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
          BEST {routeData.distance} {routeData.unit.toUpperCase()} ROUTE
        </h1>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative px-4">
        <div className="bg-card rounded-2xl overflow-hidden shadow-soft h-[400px] mb-8">
          <MapComponent 
            startLocation={routeData.location}
            distance={routeData.distance}
            unit={routeData.unit}
            regenerateKey={regenerateKey}
          />
        </div>
      </div>

      {/* Not Satisfied Section */}
      <div className="space-y-6 pb-8">
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
            NOT SATISFIED?
          </h2>
        </div>

        <div className="flex gap-4 justify-center px-4">
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