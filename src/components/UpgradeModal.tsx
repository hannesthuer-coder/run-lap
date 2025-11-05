import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Zap, Infinity, Shield } from 'lucide-react';
import { StripeService } from '@/services/stripe.service';
import { toast } from 'sonner';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  routesGenerated: number;
}

export function UpgradeModal({ open, onClose, routesGenerated }: UpgradeModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    try {
      const sessionUrl = await StripeService.createCheckoutSession(email);
      
      if (sessionUrl) {
        window.location.href = sessionUrl;
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
            <Crown className="h-6 w-6 text-yellow-500" />
            <DialogTitle className="text-2xl">Upgrade to Premium</DialogTitle>
          </div>
          <DialogDescription>
            You've generated {routesGenerated} free routes. Upgrade to unlock unlimited AI-powered routes!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-6">
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Infinity className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Unlimited Routes</p>
              <p className="text-sm text-muted-foreground">Generate as many routes as you want</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Zap className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Priority AI Generation</p>
              <p className="text-sm text-muted-foreground">Faster route generation with advanced AI</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Save Your Routes</p>
              <p className="text-sm text-muted-foreground">Access your favorite routes anytime</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="text-center">
            <p className="text-2xl font-bold mb-1">$2.95/month</p>
            <p className="text-sm text-muted-foreground">Cancel anytime</p>
          </div>

          <Button 
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {isLoading ? 'Processing...' : 'Upgrade Now'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By upgrading, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
