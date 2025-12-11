import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import MapComponent from '@/components/MapComponent';
import Footer from '@/components/Footer';

interface SharedRouteData {
  id: string;
  share_code: string;
  route_geometry: any;
  distance: number;
  unit: string;
  start_location: string;
  route_name: string | null;
  created_at: string;
  expires_at: string;
}

const SharedRoute = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const [route, setRoute] = useState<SharedRouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSharedRoute();
  }, [shareCode]);

  const fetchSharedRoute = async () => {
    if (!shareCode) {
      setError('invalid share link');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('shared_routes')
        .select('*')
        .eq('share_code', shareCode)
        .single();

      if (fetchError || !data) {
        setError('route not found or link expired');
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('this share link has expired');
        setLoading(false);
        return;
      }

      setRoute(data as SharedRouteData);
    } catch (err) {
      console.error('Error fetching shared route:', err);
      setError('failed to load route');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-28 sm:pt-32 pb-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-28 sm:pt-32 pb-12 max-w-lg">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">route not found</h2>
              <p className="text-muted-foreground text-center mb-6">
                {error || 'this route may have been deleted or the link has expired.'}
              </p>
              <Button
                onClick={() => navigate('/')}
                className="bg-beige hover:bg-beige-hover text-beige-foreground rounded-full px-6"
              >
                generate your own route
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <div className="text-center py-4 sm:py-6 md:py-8 pt-28 sm:pt-32">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-wide">
          shared route
        </h1>
        <p className="text-muted-foreground mt-1">
          {route.route_name || `${route.distance} ${route.unit} lap`}
        </p>
      </div>

      <div className="flex-1 relative px-3 sm:px-4">
        <div className="bg-card rounded-xl sm:rounded-2xl overflow-hidden shadow-soft h-[300px] sm:h-[400px] md:h-[500px] mb-4 sm:mb-6 md:mb-8">
          <MapComponent 
            startLocation={route.start_location}
            distance={route.distance}
            unit={route.unit}
            regenerateKey={0}
            onRouteGenerated={() => {}}
            onError={() => {}}
            preloadedRoute={route.route_geometry}
          />
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6 pb-6 sm:pb-8 px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{route.distance} {route.unit} lap</span>
          </div>
          <Button
            onClick={() => navigate('/')}
            className="bg-beige hover:bg-beige-hover text-beige-foreground rounded-full px-8"
          >
            generate your own route
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SharedRoute;
