import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MapPin, Play, Locate } from "lucide-react";
import { toast } from "sonner";
const Preferences = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [distance, setDistance] = useState("5");
  const [isKm, setIsKm] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle location selection from map
  useEffect(() => {
    if (location.state?.selectedLocation) {
      setSelectedLocation(location.state.selectedLocation);
      // Clear the state to prevent re-setting on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        setSelectedLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        toast.success("Current location detected!");
      }, error => {
        toast.error("Unable to get your location. Please try again or choose on map.");
      });
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
  return <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Main Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
            WHAT DISTANCE DO YOU WANT TO RUN TODAY?
          </h1>
        </div>

        {/* Distance Input */}
        <div className="space-y-4">
          <div className="relative flex items-center">
            <Input 
              type="number" 
              value={distance} 
              onChange={e => setDistance(e.target.value)}
              placeholder="Select Distance" 
              className="text-center text-lg h-14 rounded-lg border-2 pr-20" 
              min="0"
              step="0.1"
            />
            <div className="absolute right-3 flex items-center gap-2">
              <span className="text-sm font-medium">{isKm ? 'KM' : 'MI'}</span>
              <Switch
                checked={isKm}
                onCheckedChange={setIsKm}
                className="scale-75"
              />
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground uppercase tracking-wide">
              WHERE FROM?
            </h2>
          </div>

          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={handleUseCurrentLocation} className="px-8 py-3 h-12 rounded-full border-2 font-semibold uppercase tracking-wide" disabled={isGenerating}>
              CURRENT LOCATION
            </Button>
            
            <Button variant="outline" onClick={handleChooseOnMap} className="px-8 py-3 h-12 rounded-full border-2 font-semibold uppercase tracking-wide" disabled={isGenerating}>
              CHOOSE ON MAP
            </Button>
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex justify-center">
          <Button onClick={handleGenerate} disabled={isGenerating || !distance || !selectedLocation} className="px-8 py-3 h-12 rounded-full font-semibold uppercase tracking-wide" size="lg">
            {isGenerating ? "GENERATING..." : "GENERATE RUNNING LAPS"}
          </Button>
        </div>

        {/* Other Preferences Section */}
        
      </div>
    </div>;
};
export default Preferences;