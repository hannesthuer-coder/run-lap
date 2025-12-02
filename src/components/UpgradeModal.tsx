import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Crown, Zap, Infinity, BookmarkCheck } from 'lucide-react';
import { StripeService } from '@/services/stripe.service';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  routesGenerated: number;
}

export function UpgradeModal({ open, onClose, routesGenerated }: UpgradeModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const handleUpgrade = async () => {
    if (!user) {
      toast.error('Please sign in first');
      navigate('/auth');
      return;
    }

    if (!consentChecked) {
      toast.error('Please agree to the Terms and Conditions');
      return;
    }

    setIsLoading(true);
    
    try {
      const sessionUrl = await StripeService.createCheckoutSession(user.email!);
      
      if (sessionUrl) {
        window.open(sessionUrl, '_blank');
      } else {
        toast.error('Failed to start checkout. Please try again.');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-6 w-6 text-beige" />
            <DialogTitle className="text-2xl">Upgrade to Premium</DialogTitle>
          </div>
          <DialogDescription>
            You've generated {routesGenerated} free routes. Upgrade to unlock unlimited routes!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-6">
          <div className="flex items-start gap-3 p-3 bg-beige/10 rounded-lg">
            <Infinity className="h-5 w-5 text-beige-foreground mt-0.5" />
            <div>
              <p className="font-medium">Unlimited Routes</p>
              <p className="text-sm text-muted-foreground">Generate as many routes as you want</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-beige/10 rounded-lg">
            <Zap className="h-5 w-5 text-beige-foreground mt-0.5" />
            <div>
              <p className="font-medium">Priority AI Generation</p>
              <p className="text-sm text-muted-foreground">Faster route generation with advanced AI</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-beige/10 rounded-lg">
            <BookmarkCheck className="h-5 w-5 text-beige-foreground mt-0.5" />
            <div>
              <p className="font-medium">Save Your Routes</p>
              <p className="text-sm text-muted-foreground">Access your favorite routes anytime</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-2xl font-bold mb-1">$2.95/month</p>
            <p className="text-sm text-muted-foreground">Cancel anytime</p>
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Checkbox
              id="consent"
              checked={consentChecked}
              onCheckedChange={(checked) => setConsentChecked(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              I agree to Run-Lap's{" "}
              <Link to="/terms" className="text-beige-foreground hover:underline font-medium" target="_blank">
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-beige-foreground hover:underline font-medium" target="_blank">
                Privacy Policy
              </Link>
              . I consent to the immediate delivery of the service and acknowledge that I thereby lose my right of withdrawal.
            </label>
          </div>

          <Button 
            onClick={handleUpgrade}
            disabled={isLoading || !consentChecked}
            className="w-full h-12 text-lg bg-beige hover:bg-beige-hover text-beige-foreground rounded-full disabled:opacity-50"
            size="lg"
          >
            {isLoading ? 'Processing...' : user ? 'Upgrade Now' : 'Sign In to Upgrade'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By upgrading, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
