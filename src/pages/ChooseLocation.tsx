import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import MapSelector from "@/components/MapSelector";
import { Header } from "@/components/Header";

const ChooseLocation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);

  const handleLocationSelect = useCallback((coords: [number, number]) => {
    setSelectedCoords(coords);
  }, []);

  const handleDone = () => {
    if (selectedCoords) {
      // Navigate back to preferences with selected location and preserved form data
      navigate("/", { 
        state: { 
          selectedLocation: `${selectedCoords[1].toFixed(4)}, ${selectedCoords[0].toFixed(4)}`,
          distance: location.state?.distance || "",
          isKm: location.state?.isKm ?? true
        } 
      });
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {/* Page Header */}
      <div className="relative flex items-center justify-center py-8 pt-28 sm:pt-32">
        <button
          onClick={handleBack}
          className="absolute left-4 flex items-center gap-2 text-foreground hover:text-foreground/80 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back</span>
        </button>
        <h1 className="text-2xl font-bold text-foreground tracking-wide">
          select your starting point
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
          className="px-12 py-3 h-12 rounded-full font-semibold tracking-wide bg-beige hover:bg-beige-hover text-beige-foreground"
        >
          done
        </Button>
      </div>
    </div>
  );
};

export default ChooseLocation;
