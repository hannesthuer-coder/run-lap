import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { analyticsService } from '@/services/analytics.service';

export default function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      navigate('/');
      return;
    }
    
    setTimeout(() => {
      setIsLoading(false);
      // Track subscription started
      analyticsService.trackSubscriptionStarted();
      toast.success('Welcome to Premium! 🎉');
    }, 2000);
  }, [searchParams, navigate]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p>Activating your premium subscription...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
        <h1 className="text-3xl font-bold">Welcome to Premium!</h1>
        <p className="text-muted-foreground">
          You now have unlimited access to AI-powered running routes. 
          Start generating your perfect routes!
        </p>
        <Button 
          onClick={() => navigate('/')}
          size="lg"
          className="w-full"
        >
          Start Generating Routes
        </Button>
      </div>
    </div>
  );
}
