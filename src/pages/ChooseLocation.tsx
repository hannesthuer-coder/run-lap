import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import MapSelector from "@/components/MapSelector";

const ChooseLocation = () => {
  const navigate = useNavigate();
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);

  const handleLocationSelect = useCallback((coords: [number, number]) => {
    setSelectedCoords(coords);
  }, []);

  const handleDone = () => {
    if (selectedCoords) {
      // Navigate back to preferences with selected location
      navigate("/", { 
        state: { 
          selectedLocation: `${selectedCoords[1].toFixed(4)}, ${selectedCoords[0].toFixed(4)}` 
        } 
      });
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card shadow-soft border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Button>
            
            <h1 className="text-xl font-bold text-foreground">Choose Starting Point</h1>
            
            <Button
              onClick={handleDone}
              disabled={!selectedCoords}
              className="flex items-center space-x-2"
            >
              <Check className="w-5 h-5" />
              <span>Done</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-secondary/50 border-b px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-muted-foreground">
            Click anywhere on the map to place your starting marker
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapSelector onLocationSelect={handleLocationSelect} />
      </div>
    </div>
  );
};

export default ChooseLocation;