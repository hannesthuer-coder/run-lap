import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Calendar, Mail } from 'lucide-react';
import { format } from 'date-fns';

const Profile = () => {
  const { user, isPremium, subscriptionEnd } = useAuth();

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMMM d, yyyy');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">MY PROFILE</h1>
          <p className="text-muted-foreground">Manage your account and subscription</p>
        </div>

        <div className="space-y-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
              {user?.created_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                    <p className="font-medium">{formatDate(user.created_at)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Subscription Status
                {isPremium && <Crown className="h-5 w-5 text-beige" />}
              </CardTitle>
              <CardDescription>Your current subscription plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="font-semibold text-lg">
                    {isPremium ? (
                      <span className="flex items-center gap-2">
                        Premium <Crown className="h-4 w-4 text-beige" />
                      </span>
                    ) : (
                      'Free'
                    )}
                  </p>
                </div>
                {isPremium ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-beige rounded-full">
                    <Crown className="h-4 w-4 text-beige-foreground" />
                    <span className="text-sm font-semibold text-beige-foreground">PREMIUM</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
                    <span className="text-sm font-medium text-muted-foreground">FREE</span>
                  </div>
                )}
              </div>

              {isPremium && subscriptionEnd && (
                <div>
                  <p className="text-sm text-muted-foreground">Renews On</p>
                  <p className="font-medium">{formatDate(subscriptionEnd)}</p>
                </div>
              )}

              {!isPremium && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Upgrade to Premium</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-beige" />
                      <span>Unlimited route generation</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-beige" />
                      <span>Save your favorite routes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-beige" />
                      <span>Priority support</span>
                    </li>
                  </ul>
                  <Button
                    className="w-full bg-beige hover:bg-beige-hover text-beige-foreground rounded-full font-semibold tracking-wide"
                    onClick={() => {
                      // This will be handled by the UpgradeModal component
                      window.dispatchEvent(new CustomEvent('openUpgradeModal'));
                    }}
                  >
                    UPGRADE NOW
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;