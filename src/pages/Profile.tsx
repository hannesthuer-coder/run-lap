import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Calendar, Mail, CreditCard, User, Loader2, ExternalLink, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { SavedLapsSection } from '@/components/profile/SavedLapsSection';
import { ShareRouteDialog } from '@/components/profile/ShareRouteDialog';
import { UpgradeModal } from '@/components/UpgradeModal';

interface ProfileData {
  avatar_url: string | null;
  display_name: string | null;
}

const Profile = () => {
  const { user, isPremium, subscriptionEnd } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData>({ avatar_url: null, display_name: null });
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [shareRoute, setShareRoute] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, display_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfileData({
        avatar_url: data?.avatar_url || null,
        display_name: data?.display_name || null,
      });
      setDisplayName(data?.display_name || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user) return;

    setSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() || null })
        .eq('id', user.id);

      if (error) throw error;

      setProfileData(prev => ({ ...prev, display_name: displayName.trim() || null }));
      setEditingName(false);
      toast({
        title: "success",
        description: "display name updated",
      });
    } catch (error) {
      console.error('Error updating display name:', error);
      toast({
        title: "error",
        description: "failed to update display name",
        variant: "destructive",
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleOpenCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "error",
        description: "failed to open payment settings. you may not have an active subscription.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMMM d, yyyy');
  };

  const handleAvatarChange = (url: string) => {
    setProfileData(prev => ({ ...prev, avatar_url: url }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 pt-28 sm:pt-32 pb-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-12 w-12 animate-spin text-beige" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-28 sm:pt-32 pb-12 max-w-2xl">
        {/* Profile Header */}
        <div className="flex flex-col items-center mb-8">
          {user && (
            <AvatarUpload
              userId={user.id}
              avatarUrl={profileData.avatar_url}
              email={user.email || ''}
              onAvatarChange={handleAvatarChange}
            />
          )}
          <div className="mt-4 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {profileData.display_name || user?.email?.split('@')[0] || 'user'}
            </h1>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
            {isPremium && (
              <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-beige rounded-full">
                <Crown className="h-3 w-3 text-beige-foreground" />
                <span className="text-xs font-semibold text-beige-foreground">premium</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                profile details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">email</p>
                  <p className="text-sm font-medium">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">display name</p>
                  {editingName ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="enter display name"
                        className="h-8 text-sm"
                        maxLength={30}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleSaveDisplayName}
                        disabled={savingName}
                      >
                        {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingName(false);
                          setDisplayName(profileData.display_name || '');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {profileData.display_name || <span className="text-muted-foreground italic">not set</span>}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setEditingName(true)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {user?.created_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">member since</p>
                    <p className="text-sm font-medium">{formatDate(user.created_at)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription & Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5" />
                subscription & payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">current plan</p>
                  <p className="text-sm font-semibold">
                    {isPremium ? (
                      <span className="flex items-center gap-1">
                        premium <Crown className="h-4 w-4 text-beige" />
                      </span>
                    ) : (
                      'free'
                    )}
                  </p>
                </div>
                {isPremium ? (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-beige rounded-full">
                    <Crown className="h-3 w-3 text-beige-foreground" />
                    <span className="text-xs font-semibold text-beige-foreground">premium</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-muted rounded-full">
                    <span className="text-xs font-medium text-muted-foreground">free</span>
                  </div>
                )}
              </div>

              {isPremium && subscriptionEnd && (
                <div>
                  <p className="text-xs text-muted-foreground">renews on</p>
                  <p className="text-sm font-medium">{formatDate(subscriptionEnd)}</p>
                </div>
              )}

              {isPremium ? (
                <Button
                  onClick={handleOpenCustomerPortal}
                  disabled={portalLoading}
                  variant="outline"
                  className="w-full"
                >
                  {portalLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      opening...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      manage payment
                    </>
                  )}
                </Button>
              ) : (
                <div className="pt-2 border-t space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">upgrade to premium</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Crown className="h-3 w-3 text-beige" />
                        unlimited route generation
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="h-3 w-3 text-beige" />
                        save your favorite routes
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="h-3 w-3 text-beige" />
                        share routes with friends
                      </li>
                    </ul>
                  </div>
                  <Button
                    className="w-full bg-beige hover:bg-beige-hover text-beige-foreground rounded-full font-semibold"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    upgrade now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved Laps Section */}
          <SavedLapsSection 
            isPremium={isPremium} 
            onShare={(route) => setShareRoute(route)} 
          />
        </div>
      </div>

      <ShareRouteDialog
        open={!!shareRoute}
        onClose={() => setShareRoute(null)}
        route={shareRoute}
      />

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        routesGenerated={0}
      />
    </div>
  );
};

export default Profile;