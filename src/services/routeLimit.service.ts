import { supabase } from '@/integrations/supabase/client';
import { FingerprintService } from './fingerprint.service';
import type { RouteLimitStatus } from '@/types';

const FREE_ROUTE_LIMIT = 5;
const STORAGE_KEY = 'runlap_daily_count';
const SESSION_KEY = 'runlap_session_id';

interface DailyCount {
  date: string; // 'YYYY-MM-DD' in UTC
  count: number;
}

const getTodayUTC = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

export class RouteLimitService {
  
  static async checkRouteLimit(): Promise<RouteLimitStatus> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Use the check-subscription edge function for accurate Stripe status
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          const { data, error } = await supabase.functions.invoke('check-subscription', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          
          if (!error && data?.subscribed === true) {
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
      
      const { data: dbResult, error } = await supabase.functions.invoke<{
        canGenerate: boolean;
        limitReached: boolean;
      }>('check-route-limit', {
        body: {
          fingerprint,
          sessionId,
        }
      });
      
      if (error) {
        console.error('Error checking route limit:', error);
      }
      
      // Use server response combined with local count for defense in depth
      const serverLimitReached = dbResult?.limitReached || false;
      const localLimitReached = localCount >= FREE_ROUTE_LIMIT;
      const limitReached = serverLimitReached || localLimitReached;
      
      return {
        canGenerate: !limitReached,
        remainingRoutes: limitReached ? 0 : Math.max(0, FREE_ROUTE_LIMIT - localCount),
        totalGenerated: localCount,
        isPremium: false,
        needsUpgrade: limitReached,
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
      
      await supabase.functions.invoke('record-route-generation', {
        body: {
          fingerprint,
          sessionId,
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
      if (!stored) return 0;
      
      const dailyCount: DailyCount = JSON.parse(stored);
      const today = getTodayUTC();
      
      // Reset count if it's a new day
      if (dailyCount.date !== today) {
        return 0;
      }
      
      return dailyCount.count;
    } catch {
      return 0;
    }
  }
  
  private static incrementLocalStorageCount(): void {
    try {
      const today = getTodayUTC();
      const current = this.getLocalStorageCount();
      const newCount: DailyCount = {
        date: today,
        count: current + 1
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCount));
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
  }
  
  // Public method to increment local count after successful generation
  static incrementLocalCount(): void {
    this.incrementLocalStorageCount();
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
