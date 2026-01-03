import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Crown, Zap, Infinity, BookmarkCheck, Check } from 'lucide-react';
import { StripeService } from '@/services/stripe.service';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  routesGenerated: number;
}

type PlanType = 'monthly' | 'annual';

export function UpgradeModal({ open, onClose, routesGenerated }: UpgradeModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');

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
      const sessionUrl = await StripeService.createCheckoutSession(user.email!, selectedPlan);
      
      if (sessionUrl) {
        toast.info('Redirecting to checkout...');
        window.location.href = sessionUrl;
      } else {
        toast.error('Failed to start checkout. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl">Start Your Free Trial</DialogTitle>
          </div>
          <DialogDescription>
            You've used all 5 of your free routes. Try Premium free for 14 days!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-4">
          <div className="flex items-start gap-3 p-2.5 bg-beige/30 rounded-lg">
            <Infinity className="h-4 w-4 text-beige-foreground mt-0.5" />
            <div>
              <p className="font-medium text-sm">Unlimited Routes</p>
              <p className="text-xs text-muted-foreground">Generate as many routes as you want</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 bg-beige/30 rounded-lg">
            <Zap className="h-4 w-4 text-beige-foreground mt-0.5" />
            <div>
              <p className="font-medium text-sm">Priority AI Generation</p>
              <p className="text-xs text-muted-foreground">Faster route generation with advanced AI</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 bg-beige/30 rounded-lg">
            <BookmarkCheck className="h-4 w-4 text-beige-foreground mt-0.5" />
            <div>
              <p className="font-medium text-sm">Save Your Routes</p>
              <p className="text-xs text-muted-foreground">Access your favorite routes anytime</p>
            </div>
          </div>
        </div>

        {/* Plan Selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-center">Choose your plan</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                selectedPlan === 'monthly'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {selectedPlan === 'monthly' && (
                <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <p className="text-xl font-bold">$3</p>
              <p className="text-sm text-muted-foreground">/month</p>
            </button>

            <button
              onClick={() => setSelectedPlan('annual')}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                selectedPlan === 'annual'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {selectedPlan === 'annual' && (
                <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-success text-success-foreground text-[10px] px-2 py-0.5 rounded-full font-medium">
                Save $6
              </div>
              <p className="text-xl font-bold">$30</p>
              <p className="text-sm text-muted-foreground">/year</p>
            </button>
          </div>
          <p className="text-xs text-center text-muted-foreground">14-day free trial • Cancel anytime</p>
        </div>

        <div className="space-y-4 mt-4">
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
              <Link to="/terms" className="text-primary hover:underline font-medium" target="_blank">
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-primary hover:underline font-medium" target="_blank">
                Privacy Policy
              </Link>
              . I consent to the immediate delivery of the service and acknowledge that I thereby lose my right of withdrawal.
            </label>
          </div>

          <Button 
            onClick={handleUpgrade}
            disabled={isLoading || !consentChecked}
            className="w-full h-10 text-base bg-beige hover:bg-beige-hover text-beige-foreground rounded-full disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : user ? 'Start 14-Day Free Trial' : 'Sign In to Start Trial'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            No charge today. You'll be billed after your trial ends unless you cancel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
