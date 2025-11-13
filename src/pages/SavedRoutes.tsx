import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Trash2, MapPin, Calendar, Crown } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface SavedRoute {
  id: string;
  route_name: string;
  distance: number;
  unit: string;
  start_location: string;
  route_geometry: any;
  created_at: string;
}

const SavedRoutes = () => {
  const navigate = useNavigate();
  const { isPremium } = useAuth();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteRouteId, setDeleteRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPremium) {
      navigate('/profile');
      return;
    }
    fetchSavedRoutes();
  }, [isPremium, navigate]);

  const fetchSavedRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_routes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRoutes(data || []);
    } catch (error) {
      console.error('Error fetching saved routes:', error);
      toast({
        title: "Error",
        description: "Failed to load saved routes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!deleteRouteId) return;

    try {
      const { error } = await supabase
        .from('saved_routes')
        .delete()
        .eq('id', deleteRouteId);

      if (error) throw error;

      setRoutes(routes.filter(r => r.id !== deleteRouteId));
      toast({
        title: "Success",
        description: "Route deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting route:', error);
      toast({
        title: "Error",
        description: "Failed to delete route.",
        variant: "destructive",
      });
    } finally {
      setDeleteRouteId(null);
    }
  };

  const handleViewRoute = (route: SavedRoute) => {
    navigate('/route', {
      state: {
        route: {
          geometry: route.route_geometry,
          distance: route.distance * (route.unit === 'km' ? 1000 : 1609.34),
          duration: 0,
        },
        distance: route.distance,
        unit: route.unit,
        startLocation: { lat: 0, lng: 0 },
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-28 sm:pt-32 pb-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beige"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-28 sm:pt-32 pb-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            SAVED ROUTES
            <Crown className="h-8 w-8 text-beige" />
          </h1>
          <p className="text-muted-foreground">Your collection of favorite running routes</p>
        </div>

        {routes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <MapPin className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No saved routes yet</h3>
              <p className="text-muted-foreground text-center mb-6">
                Generate and save your first route to see it here!
              </p>
              <Button
                onClick={() => navigate('/')}
                className="bg-beige hover:bg-beige-hover text-beige-foreground rounded-full px-6"
              >
                GENERATE A ROUTE
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {routes.map((route) => (
              <Card key={route.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{route.route_name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {route.start_location}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteRouteId(route.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Distance</span>
                      <span className="font-semibold">
                        {route.distance} {route.unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Saved
                      </span>
                      <span>{format(new Date(route.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleViewRoute(route)}
                    className="w-full bg-beige hover:bg-beige-hover text-beige-foreground rounded-full"
                  >
                    VIEW ROUTE
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteRouteId} onOpenChange={() => setDeleteRouteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this route? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoute}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SavedRoutes;