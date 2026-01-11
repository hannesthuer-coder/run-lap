import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// FEATURE FLAG: Set to false to enable paywalls and subscription checks
const PAYWALLS_DISABLED = false;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPremium: boolean;
  subscriptionEnd: string | null;
  isTrialing: boolean;
  trialEndsAt: string | null;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkSubscriptionStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(PAYWALLS_DISABLED);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [isTrialing, setIsTrialing] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  const checkSubscriptionStatus = async (userOverride?: User | null) => {
    // If paywalls disabled, everyone is premium - skip Stripe check entirely
    if (PAYWALLS_DISABLED) {
      setIsPremium(true);
      setSubscriptionEnd(null);
      setIsTrialing(false);
      setTrialEndsAt(null);
      return;
    }

    const currentUser = userOverride ?? user;
    
    if (!currentUser) {
      setIsPremium(false);
      setSubscriptionEnd(null);
      setIsTrialing(false);
      setTrialEndsAt(null);
      return;
    }

    try {
      // Call the check-subscription edge function to get real-time status from Stripe
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
        console.error('Error checking subscription:', error);
        setIsPremium(false);
        setSubscriptionEnd(null);
        setIsTrialing(false);
        setTrialEndsAt(null);
        return;
      }

      // Check if subscribed (includes trialing status)
      const hasActiveSub = data?.subscribed === true;
      const isTrial = data?.is_trialing === true;
      
      if (hasActiveSub) {
        setIsPremium(true);
        setIsTrialing(isTrial);
        setTrialEndsAt(isTrial ? data?.trial_ends_at : null);
        setSubscriptionEnd(data?.subscription_end || null);
      } else {
        setIsPremium(false);
        setSubscriptionEnd(null);
        setIsTrialing(false);
        setTrialEndsAt(null);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsPremium(false);
      setSubscriptionEnd(null);
      setIsTrialing(false);
      setTrialEndsAt(null);
    }
  };

  // Send welcome email to new users (only once per user)
  const sendWelcomeEmail = async (userId: string) => {
    const welcomeSentKey = `welcome_email_sent_${userId}`;
    
    // Check if we've already sent the welcome email
    if (localStorage.getItem(welcomeSentKey)) {
      return;
    }

    try {
      console.log('[AUTH] Sending welcome email for new user');
      const { error } = await supabase.functions.invoke('send-welcome-email', {
        body: {}
      });
      
      if (!error) {
        // Mark as sent to prevent duplicate emails
        localStorage.setItem(welcomeSentKey, 'true');
        console.log('[AUTH] Welcome email sent successfully');
      } else {
        console.error('[AUTH] Failed to send welcome email:', error);
      }
    } catch (err) {
      console.error('[AUTH] Error sending welcome email:', err);
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Defer subscription check - pass user directly to avoid state race condition
      if (session?.user) {
        setTimeout(() => {
          checkSubscriptionStatus(session.user);
        }, 0);

        // Send welcome email for new signups (SIGNED_IN after email confirmation)
        if (event === 'SIGNED_IN') {
          // Check if this is a new user (created within last 5 minutes)
          const createdAt = new Date(session.user.created_at);
          const now = new Date();
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
          
          if (createdAt > fiveMinutesAgo) {
            setTimeout(() => {
              sendWelcomeEmail(session.user.id);
            }, 1000);
          }
        }
      } else {
        // If paywalls disabled, everyone is premium (including anonymous users)
        setIsPremium(PAYWALLS_DISABLED);
        setSubscriptionEnd(null);
        setIsTrialing(false);
        setTrialEndsAt(null);
      }
    });

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        setTimeout(() => {
          checkSubscriptionStatus(session.user);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    // Redirect to verify-email page after email confirmation
    const redirectUrl = import.meta.env.PROD 
      ? 'https://run-lap.com/verify-email' 
      : `${window.location.origin}/verify-email`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      return { error };
    }

    toast({
      title: "Success!",
      description: "Check your email to confirm your account.",
    });

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    toast({
      title: "Welcome back!",
      description: "You've successfully logged in.",
    });

    return { error: null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } else {
      setUser(null);
      setSession(null);
      setIsPremium(PAYWALLS_DISABLED);
      setSubscriptionEnd(null);
      setIsTrialing(false);
      setTrialEndsAt(null);
      toast({
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isPremium,
        subscriptionEnd,
        isTrialing,
        trialEndsAt,
        signUp,
        signIn,
        signOut,
        checkSubscriptionStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};