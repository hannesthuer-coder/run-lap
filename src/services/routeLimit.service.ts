import { supabase } from '@/integrations/supabase/client';
import { FingerprintService } from './fingerprint.service';
import type { RouteLimitStatus } from '@/types';

const FREE_ROUTE_LIMIT = 3;
const STORAGE_KEY = 'runlap_route_count';
const SESSION_KEY = 'runlap_session_id';

export class RouteLimitService {
  
  static async checkRouteLimit(): Promise<RouteLimitStatus> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_status, subscription_expires_at')
          .eq('id', user.id)
          .single();
        
        if (profile?.subscription_status === 'premium') {
          const isActive = profile.subscription_expires_at 
            ? new Date(profile.subscription_expires_at) > new Date()
            : false;
          
          if (isActive) {
            return {
              canGenerate: true,
              remainingRoutes: Infinity,
              totalGenerated: 0,
              isPremium: true,
              needsUpgrade: false,
            };
          }
        }
      }
      
      const fingerprint = await FingerprintService.getFingerprint();
      const sessionId = this.getOrCreateSessionId();
      
      const localCount = this.getLocalStorageCount();
      
      const { data: dbGenerations, error } = await supabase.functions.invoke<{
        count: number;
      }>('check-route-limit', {
        body: {
          fingerprint,
          sessionId,
        }
      });
      
      if (error) {
        console.error('Error checking route limit:', error);
      }
      
      const dbCount = dbGenerations?.count || 0;
      
      const totalGenerated = Math.max(localCount, dbCount);
      const canGenerate = totalGenerated < FREE_ROUTE_LIMIT;
      const remainingRoutes = Math.max(0, FREE_ROUTE_LIMIT - totalGenerated);
      
      return {
        canGenerate,
        remainingRoutes,
        totalGenerated,
        isPremium: false,
        needsUpgrade: !canGenerate,
      };
      
    } catch (error) {
      console.error('Error in checkRouteLimit:', error);
      return {
        canGenerate: true,
        remainingRoutes: 1,
        totalGenerated: 0,
        isPremium: false,
        needsUpgrade: false,
      };
    }
  }
  
  static async recordRouteGeneration(routeData: {
    distance: number;
    unit: string;
    location: string;
  }): Promise<void> {
    try {
      const fingerprint = await FingerprintService.getFingerprint();
      const sessionId = this.getOrCreateSessionId();
      
      this.incrementLocalStorageCount();
      
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.functions.invoke('record-route-generation', {
        body: {
          fingerprint,
          sessionId,
          userId: user?.id || null,
          routeDistance: routeData.distance,
          routeUnit: routeData.unit,
          startLocation: routeData.location,
        }
      });
      
    } catch (error) {
      console.error('Error recording route generation:', error);
    }
  }
  
  private static getLocalStorageCount(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }
  
  private static incrementLocalStorageCount(): void {
    try {
      const current = this.getLocalStorageCount();
      localStorage.setItem(STORAGE_KEY, (current + 1).toString());
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
  }
  
  private static getOrCreateSessionId(): string {
    try {
      let sessionId = sessionStorage.getItem(SESSION_KEY);
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, sessionId);
      }
      return sessionId;
    } catch {
      return crypto.randomUUID();
    }
  }
}
