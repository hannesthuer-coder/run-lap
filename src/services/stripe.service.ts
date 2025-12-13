import { supabase } from '@/integrations/supabase/client';

export type PlanType = 'monthly' | 'annual';

export class StripeService {
  
  static async createCheckoutSession(plan: PlanType = 'monthly'): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke<{
        sessionUrl: string;
      }>('create-stripe-checkout', {
        body: { plan }
      });
      
      if (error) throw error;
      
      return data?.sessionUrl || null;
      
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return null;
    }
  }
  
  static async checkSubscriptionStatus(): Promise<{
    isActive: boolean;
    expiresAt: string | null;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { isActive: false, expiresAt: null };
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_expires_at')
        .eq('id', user.id)
        .single();
      
      const isActive = profile?.subscription_status === 'premium' &&
        profile?.subscription_expires_at &&
        new Date(profile.subscription_expires_at) > new Date();
      
      return {
        isActive,
        expiresAt: profile?.subscription_expires_at || null,
      };
      
    } catch (error) {
      console.error('Error checking subscription:', error);
      return { isActive: false, expiresAt: null };
    }
  }
}
