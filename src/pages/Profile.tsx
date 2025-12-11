import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, Calendar, Mail, CreditCard, User, Loader2, ExternalLink, Pencil, Check, X, Phone, MapPin, Settings } from 'lucide-react';
import { useTheme } from 'next-themes';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
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
  phone_number: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
}

type EditableField = 'display_name' | 'phone_number' | 'address' | 'city' | 'postal_code' | 'country' | null;

const Profile = () => {
  const { user, isPremium, subscriptionEnd } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profileData, setProfileData] = useState<ProfileData>({
    avatar_url: null,
    display_name: null,
    phone_number: null,
    address: null,
    city: null,
    postal_code: null,
    country: null,
  });
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<EditableField>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
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
        .select('avatar_url, display_name, phone_number, address, city, postal_code, country')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfileData({
        avatar_url: data?.avatar_url || null,
        display_name: data?.display_name || null,
        phone_number: data?.phone_number || null,
        address: data?.address || null,
        city: data?.city || null,
        postal_code: data?.postal_code || null,
        country: data?.country || null,
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (field: EditableField) => {
    if (!field) return;
    setEditingField(field);
    setEditValue(profileData[field] || '');
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleSaveField = async () => {
    if (!user || !editingField) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [editingField]: editValue.trim() || null })
        .eq('id', user.id);

      if (error) throw error;

      setProfileData(prev => ({ ...prev, [editingField]: editValue.trim() || null }));
      setEditingField(null);
      setEditValue('');
      toast({
        title: "success",
        description: "profile updated",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "error",
        description: "failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

  const renderEditableField = (
    field: EditableField,
    label: string,
    icon: React.ReactNode,
    placeholder: string
  ) => {
    if (!field) return null;
    const isEditing = editingField === field;
    const value = profileData[field];

    return (
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={placeholder}
                className="h-8 text-sm"
                maxLength={100}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleSaveField}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleCancelEdit}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                {value || <span className="text-muted-foreground italic">not set</span>}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => handleStartEdit(field)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
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

              {renderEditableField('display_name', 'display name', <User className="h-4 w-4" />, 'enter display name')}
              {renderEditableField('phone_number', 'phone number', <Phone className="h-4 w-4" />, 'enter phone number')}

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

          {/* Address Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderEditableField('address', 'street address', <MapPin className="h-4 w-4" />, 'enter street address')}
              {renderEditableField('city', 'city', <MapPin className="h-4 w-4" />, 'enter city')}
              {renderEditableField('postal_code', 'postal code', <MapPin className="h-4 w-4" />, 'enter postal code')}
              {renderEditableField('country', 'country', <MapPin className="h-4 w-4" />, 'enter country')}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5" />
                settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-3">theme</p>
                <RadioGroup value={theme} onValueChange={setTheme} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system" className="text-sm font-normal cursor-pointer">system (follow device)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="text-sm font-normal cursor-pointer">light</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark" className="text-sm font-normal cursor-pointer">dark</Label>
                  </div>
                </RadioGroup>
              </div>
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
                        premium <Crown className="h-4 w-4 text-primary" />
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
                        <Crown className="h-3 w-3 text-primary" />
                        unlimited route generation
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="h-3 w-3 text-primary" />
                        save your favorite routes
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="h-3 w-3 text-primary" />
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
