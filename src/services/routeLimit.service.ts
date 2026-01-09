import { supabase } from '@/integrations/supabase/client';
import { FingerprintService } from './fingerprint.service';
import type { RouteLimitStatus } from '@/types';

const FREE_ROUTE_LIMIT = 5;
const STORAGE_KEY = 'runlap_route_count';
const SESSION_KEY = 'runlap_session_id';

interface DailyCount {
  date: string; // YYYY-MM-DD in UTC
  count: number;
}

// Get today's date in YYYY-MM-DD format (UTC)
function getTodayUTC(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

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
        used: number;
        remaining: number;
      }>('check-route-limit', {
        body: {
          fingerprint,
          sessionId,
        }
      });
      
      if (error) {
        console.error('Error checking route limit:', error);
      }
      
      // Use server response for remaining count, fallback to local
      const serverRemaining = dbResult?.remaining ?? (FREE_ROUTE_LIMIT - localCount);
      const serverUsed = dbResult?.used ?? localCount;
      const serverLimitReached = dbResult?.limitReached || false;
      const localLimitReached = localCount >= FREE_ROUTE_LIMIT;
      const limitReached = serverLimitReached || localLimitReached;
      
      return {
        canGenerate: !limitReached,
        remainingRoutes: limitReached ? 0 : Math.max(0, serverRemaining),
        totalGenerated: serverUsed,
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
  
  // Only increment local count - server records on successful generation
  static incrementLocalCount(): void {
    this.incrementLocalStorageCount();
  }
  
  // Legacy method - now only updates local storage (server records in generate-route)
  static async recordRouteGeneration(routeData: {
    distance: number;
    unit: string;
    location: string;
  }): Promise<void> {
    // Only increment local storage - server handles the actual recording
    this.incrementLocalStorageCount();
  }
  
  private static getLocalStorageCount(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return 0;
      
      const data: DailyCount = JSON.parse(stored);
      const today = getTodayUTC();
      
      // Reset count if it's a new day
      if (data.date !== today) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
        return 0;
      }
      
      return data.count;
    } catch {
      return 0;
    }
  }
  
  private static incrementLocalStorageCount(): void {
    try {
      const today = getTodayUTC();
      const current = this.getLocalStorageCount();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: current + 1 }));
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