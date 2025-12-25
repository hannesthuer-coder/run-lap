import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit: 60 calls per hour per IP
const RATE_LIMIT = 60;
const RATE_WINDOW_SECONDS = 3600;

async function checkRateLimit(supabase: any, ipAddress: string, endpoint: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000)) * (RATE_WINDOW_SECONDS * 1000)).toISOString();
  
  try {
    // Try to get existing rate limit record
    const { data: existing, error: selectError } = await supabase
      .from('rate_limits')
      .select('call_count')
      .eq('ip_address', ipAddress)
      .eq('endpoint', endpoint)
      .eq('window_start', windowStart)
      .single();
    
    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Rate limit check error:', selectError);
      // On error, allow the request but log it
      return { allowed: true, remaining: RATE_LIMIT };
    }
    
    if (existing) {
      // Update existing record
      if (existing.call_count >= RATE_LIMIT) {
        return { allowed: false, remaining: 0 };
      }
      
      await supabase
        .from('rate_limits')
        .update({ call_count: existing.call_count + 1 })
        .eq('ip_address', ipAddress)
        .eq('endpoint', endpoint)
        .eq('window_start', windowStart);
      
      return { allowed: true, remaining: RATE_LIMIT - existing.call_count - 1 };
    } else {
      // Create new record
      await supabase
        .from('rate_limits')
        .insert({
          ip_address: ipAddress,
          endpoint: endpoint,
          call_count: 1,
          window_start: windowStart
        });
      
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }
  } catch (error) {
    console.error('Rate limit error:', error);
    // On error, allow the request
    return { allowed: true, remaining: RATE_LIMIT };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                    req.headers.get('x-real-ip') || 
                    'unknown';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Use service role for rate limiting
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(supabaseAdmin, ipAddress, 'check-route-limit');
    
    if (!allowed) {
      console.log(`Rate limit exceeded for IP: ${ipAddress}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'Retry-After': String(RATE_WINDOW_SECONDS)
          } 
        }
      );
    }

    const { fingerprint, sessionId } = await req.json();
    
    // Validate inputs
    if (!fingerprint || typeof fingerprint !== 'string' || fingerprint.length < 10 || fingerprint.length > 100) {
      throw new Error('Invalid fingerprint')
    }
    
    if (sessionId && (typeof sessionId !== 'string' || sessionId.length > 100)) {
      throw new Error('Invalid session ID')
    }
    
    // Use anon key for the actual query
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .rpc('count_routes_by_fingerprint', {
        _fingerprint: fingerprint,
        _ip_address: ipAddress,
        _since: last30Days
      });
    
    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ canGenerate: true, limitReached: false }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(remaining)
          } 
        }
      );
    }
    
    // Only return whether user can generate, not exact counts
    const count = data || 0
    return new Response(
      JSON.stringify({ 
        canGenerate: count < 3,
        limitReached: count >= 3
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(remaining)
        } 
      }
    );
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ canGenerate: true, limitReached: false }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
