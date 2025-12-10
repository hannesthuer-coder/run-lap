import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Settings, MapPin, Timer, Route as RouteIcon, Loader2, BookmarkPlus, BookmarkCheck, Share2 } from "lucide-react";
import MapComponent from "@/components/MapComponent";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UpgradeModal } from "@/components/UpgradeModal";
import { ShareRouteDialog } from "@/components/profile/ShareRouteDialog";

const Route = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPremium, user } = useAuth();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateKey, setRegenerateKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showHeader, setShowHeader] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showNotSatisfied, setShowNotSatisfied] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [dots, setDots] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState<any>(null);
  
  const routeData = location.state || { distance: 5, unit: "km", location: "40.7128,-74.0060" }; // Default to NYC coordinates

  // Animate dots
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '') return '.';
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '';
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleRouteGenerated = (route?: any) => {
    setIsLoading(false);
    setIsRegenerating(false);
    if (route) {
      setGeneratedRoute(route);
    }
    
    // Sequential fade-in animations
    setTimeout(() => setShowHeader(true), 100);
    setTimeout(() => setShowMap(true), 400);
    setTimeout(() => setShowNotSatisfied(true), 700);
    setTimeout(() => setShowButtons(true), 1000);
  };

  const handleSaveRoute = async () => {
    if (!routeName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for your route.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('saved_routes')
        .insert([{
          user_id: user?.id,
          route_name: routeName,
          distance: routeData.distance,
          unit: routeData.unit,
          start_location: routeData.location,
          route_geometry: generatedRoute?.geometry || {},
        }] as any);

      if (error) {
        if (error.message.includes('unique')) {
          toast({
            title: "Error",
            description: "You already have a route with this name.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Success!",
          description: "Route saved successfully.",
        });
        setShowSaveDialog(false);
        setRouteName('');
      }
    } catch (error) {
      console.error('Error saving route:', error);
      toast({
        title: "Error",
        description: "Failed to save route. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
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

  const handleRouteError = () => {
    setIsLoading(false);
    setIsRegenerating(false);
    navigate("/");
  };

  const handleChangePreferences = () => {
    navigate("/");
  };

  // Mock route stats
  const estimatedTime = Math.round((routeData.distance / (routeData.unit === "km" ? 10 : 6.2)) * 60); // minutes
  const elevationGain = Math.round(routeData.distance * 15); // rough estimate

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {/* Loading Screen */}
      {isLoading && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-xs font-light text-foreground tracking-wider leading-relaxed text-left">
              generating your<br />
              perfect running route<span className="inline-block w-6 text-left">{dots}</span>
            </h2>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className={`text-center py-4 sm:py-6 md:py-8 pt-28 sm:pt-32 transition-all duration-500 ${showHeader ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-wide">
          results
        </h1>
      </div>

      {/* Map Container */}
      <div className={`flex-1 relative px-3 sm:px-4 transition-all duration-500 ${showMap ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
        <div className="bg-card rounded-xl sm:rounded-2xl overflow-hidden shadow-soft h-[300px] sm:h-[400px] md:h-[500px] mb-4 sm:mb-6 md:mb-8">
          <MapComponent 
            startLocation={routeData.location}
            distance={routeData.distance}
            unit={routeData.unit}
            regenerateKey={regenerateKey}
            onRouteGenerated={handleRouteGenerated}
            onError={handleRouteError}
          />
        </div>
      </div>

      {/* Not Satisfied Section */}
      <div className="space-y-4 sm:space-y-6 pb-6 sm:pb-8">
        <div className={`text-center transition-all duration-500 ${showNotSatisfied ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
          <h2 className="text-base sm:text-lg font-bold text-foreground tracking-wide">
            not satisfied?
          </h2>
        </div>

        <div className={`flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 transition-all duration-500 ${showButtons ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
          <Button
            onClick={handleRegenerateRoute}
            disabled={isRegenerating}
            variant="outline"
            className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold tracking-wide text-xs sm:text-sm"
          >
            {isRegenerating ? "generating..." : "generate new route"}
          </Button>
          
          <Button
            onClick={handleChangePreferences}
            variant="outline"
            className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold tracking-wide text-xs sm:text-sm"
          >
            change preferences
          </Button>

          <Button
            onClick={() => {
              if (isPremium) {
                setShowSaveDialog(true);
              } else {
                setShowUpgradeModal(true);
              }
            }}
            variant="outline"
            className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold tracking-wide text-xs sm:text-sm"
          >
            <BookmarkPlus className="h-4 w-4 mr-2" />
            save route
          </Button>

          <Button
            onClick={() => {
              if (isPremium) {
                setShowShareDialog(true);
              } else {
                setShowUpgradeModal(true);
              }
            }}
            variant="outline"
            className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 h-10 sm:h-12 rounded-full border-2 font-semibold tracking-wide text-xs sm:text-sm"
          >
            <Share2 className="h-4 w-4 mr-2" />
            share route
          </Button>
        </div>
      </div>

      {/* Save Route Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Route</DialogTitle>
            <DialogDescription>
              Give your route a name so you can find it easily later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="route-name">Route Name</Label>
              <Input
                id="route-name"
                placeholder="e.g., Morning Park Loop"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveRoute}
                disabled={isSaving || !routeName.trim()}
                className="bg-beige hover:bg-beige-hover text-beige-foreground"
              >
                {isSaving ? 'Saving...' : 'Save Route'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        routesGenerated={0}
      />

      <ShareRouteDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        route={generatedRoute ? {
          distance: routeData.distance,
          unit: routeData.unit,
          start_location: routeData.location,
          route_geometry: generatedRoute.geometry || {},
        } : null}
      />

      <Footer />
    </div>
  );
};

export default Route;