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
      <div className="relative flex items-center justify-center py-8">
        <button
          onClick={handleBack}
          className="absolute left-4 flex items-center gap-2 text-foreground hover:text-foreground/80 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back</span>
        </button>
        <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
          SELECT YOUR STARTING POINT
        </h1>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative px-4">
        <div className="bg-card rounded-2xl overflow-hidden shadow-soft h-[500px] mb-8">
          <MapSelector onLocationSelect={handleLocationSelect} />
        </div>
      </div>

      {/* Done Button */}
      <div className="flex justify-center pb-8">
        <Button
          onClick={handleDone}
          disabled={!selectedCoords}
          className="px-12 py-3 h-12 rounded-full font-semibold uppercase tracking-wide bg-beige-hover text-beige-foreground hover:bg-beige active:bg-beige-pressed"
        >
          DONE
        </Button>
      </div>
    </div>
  );
};

export default ChooseLocation;