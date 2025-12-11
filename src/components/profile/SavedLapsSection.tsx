import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Trash2, MapPin, Calendar, Share2, Eye, Loader2, Crown } from 'lucide-react';
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

interface SavedLapsSectionProps {
  isPremium: boolean;
  onShare: (route: SavedRoute) => void;
}

export const SavedLapsSection = ({ isPremium, onShare }: SavedLapsSectionProps) => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteRouteId, setDeleteRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (isPremium) {
      fetchSavedRoutes();
    } else {
      setLoading(false);
    }
  }, [isPremium]);

  const fetchSavedRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_routes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      setRoutes(data || []);
    } catch (error) {
      console.error('Error fetching saved routes:', error);
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
        title: "success",
        description: "route deleted",
      });
    } catch (error) {
      console.error('Error deleting route:', error);
      toast({
        title: "error",
        description: "failed to delete route",
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
        location: route.start_location,
        isPreloaded: true,
      },
    });
  };

  if (!isPremium) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Crown className="h-12 w-12 text-beige mb-3" />
          <h3 className="text-lg font-semibold mb-2">saved laps</h3>
          <p className="text-muted-foreground text-center text-sm mb-4">
            upgrade to premium to save your favorite routes
          </p>
          <Button
            onClick={() => window.dispatchEvent(new CustomEvent('openUpgradeModal'))}
            className="bg-beige hover:bg-beige-hover text-beige-foreground rounded-full px-6"
          >
            upgrade to premium
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-beige" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          saved laps
          <Crown className="h-5 w-5 text-beige" />
        </h3>
        {routes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/saved-routes')}
            className="text-muted-foreground hover:text-foreground"
          >
            view all
          </Button>
        )}
      </div>

      {routes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <MapPin className="h-12 w-12 text-muted-foreground mb-3" />
            <h4 className="font-semibold mb-1">no saved laps yet</h4>
            <p className="text-muted-foreground text-center text-sm mb-4">
              generate and save your first route
            </p>
            <Button
              onClick={() => navigate('/')}
              className="bg-beige hover:bg-beige-hover text-beige-foreground rounded-full px-6"
            >
              generate a route
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {routes.map((route) => (
            <Card key={route.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{route.route_name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {route.distance} {route.unit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(route.created_at), 'MMM d, yyyy')}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8"
                    onClick={() => handleViewRoute(route)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    view
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => onShare(route)}
                  >
                    <Share2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteRouteId(route.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteRouteId} onOpenChange={() => setDeleteRouteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>delete route?</AlertDialogTitle>
            <AlertDialogDescription>
              this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoute}
              className="bg-destructive hover:bg-destructive/90"
            >
              delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};