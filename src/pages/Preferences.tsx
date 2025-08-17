import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MapPin, Play, Locate } from "lucide-react";
import { toast } from "sonner";

const Preferences = () => {
  const navigate = useNavigate();
  const [distance, setDistance] = useState("5");
  const [isKm, setIsKm] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSelectedLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
          toast.success("Current location detected!");
        },
        (error) => {
          toast.error("Unable to get your location. Please try again or choose on map.");
        }
      );
    } else {
      toast.error("Geolocation is not supported by this browser.");
    }
  };

  const handleChooseOnMap = () => {
    navigate("/choose-location");
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

    setIsGenerating(true);
    
    // Simulate route generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsGenerating(false);
    navigate("/route", { 
      state: { 
        distance: parseFloat(distance), 
        unit: isKm ? "km" : "miles", 
        location: selectedLocation 
      } 
    });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-md mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto shadow-medium">
            <Play className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">RunRoute</h1>
          <p className="text-muted-foreground">Generate your perfect running loop</p>
        </div>

        {/* Distance Input */}
        <Card className="shadow-soft border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Distance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="distance">How far do you want to run?</Label>
              <Input
                id="distance"
                type="number"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="Enter distance"
                className="text-lg"
                min="0.1"
                step="0.1"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="unit-toggle" className="text-sm font-medium">
                Distance in {isKm ? "kilometers" : "miles"}
              </Label>
              <div className="flex items-center space-x-2">
                <span className={`text-sm ${!isKm ? "text-muted-foreground" : "text-foreground font-medium"}`}>km</span>
                <Switch
                  id="unit-toggle"
                  checked={!isKm}
                  onCheckedChange={(checked) => setIsKm(!checked)}
                />
                <span className={`text-sm ${isKm ? "text-muted-foreground" : "text-foreground font-medium"}`}>miles</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Selection */}
        <Card className="shadow-soft border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Starting Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedLocation && (
              <div className="p-3 bg-secondary rounded-lg">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Selected: {selectedLocation}</span>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                onClick={handleUseCurrentLocation}
                className="h-12 justify-start"
                disabled={isGenerating}
              >
                <Locate className="w-5 h-5 mr-3" />
                Use my current location
              </Button>
              
              <Button
                variant="outline"
                onClick={handleChooseOnMap}
                className="h-12 justify-start"
                disabled={isGenerating}
              >
                <MapPin className="w-5 h-5 mr-3" />
                Choose on map
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !distance || !selectedLocation}
          className="w-full h-14 text-lg font-semibold shadow-medium hover:shadow-strong transition-all duration-300"
          size="lg"
        >
          {isGenerating ? (
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              <span>Generating route...</span>
            </div>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              Generate Route
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Preferences;