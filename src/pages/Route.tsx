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
  
  const routeData = location.state || { distance: 5, unit: "km", location: "Current Location" };

  const handleRegenerateRoute = async () => {
    setIsRegenerating(true);
    // Simulate route regeneration
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-soft border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
                <RouteIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Your Running Route</h1>
                <p className="text-sm text-muted-foreground">
                  {routeData.distance} {routeData.unit} loop
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Route Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up">
          <Card className="p-4 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <RouteIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Distance</p>
                <p className="text-xl font-bold text-foreground">
                  {routeData.distance} {routeData.unit}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <Timer className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Est. Time</p>
                <p className="text-xl font-bold text-foreground">{estimatedTime} min</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Elevation</p>
                <p className="text-xl font-bold text-foreground">{elevationGain}m</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Map Container */}
        <Card className="shadow-medium overflow-hidden animate-fade-in">
          <div className="h-96 md:h-[500px] relative">
            <MapComponent 
              startLocation={routeData.location}
              distance={routeData.distance}
              unit={routeData.unit}
            />
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
          <Button
            onClick={handleRegenerateRoute}
            disabled={isRegenerating}
            variant="outline"
            size="lg"
            className="h-14 text-lg font-semibold shadow-soft hover:shadow-medium transition-all duration-300"
          >
            {isRegenerating ? (
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Regenerating...</span>
              </div>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Generate New Route
              </>
            )}
          </Button>

          <Button
            onClick={handleChangePreferences}
            variant="secondary"
            size="lg"
            className="h-14 text-lg font-semibold shadow-soft hover:shadow-medium transition-all duration-300"
          >
            <Settings className="w-5 h-5 mr-2" />
            Change Preferences
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Route;