import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://run-lap.com',
  'https://www.run-lap.com',
  'http://localhost:5173',
  'http://localhost:8080',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow Lovable preview/project domains
  if (origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app')) return true;
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Rate limiting constants
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW_SECONDS = 60; // 1 minute window

async function checkRateLimit(supabase: any, ipAddress: string, endpoint: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_WINDOW_SECONDS * 1000);

  // Check existing rate limit record
  const { data: existing, error: fetchError } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('ip_address', ipAddress)
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart.toISOString())
    .order('window_start', { ascending: false })
    .limit(1)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error checking rate limit:', fetchError);
    // Allow on error to avoid blocking legitimate users
    return { allowed: true, remaining: RATE_LIMIT };
  }

  if (existing) {
    if (existing.call_count >= RATE_LIMIT) {
      return { allowed: false, remaining: 0 };
    }
    
    // Update call count
    await supabase
      .from('rate_limits')
      .update({ call_count: existing.call_count + 1 })
      .eq('id', existing.id);
    
    return { allowed: true, remaining: RATE_LIMIT - existing.call_count - 1 };
  }

  // Create new rate limit record
  await supabase
    .from('rate_limits')
    .insert({
      ip_address: ipAddress,
      endpoint: endpoint,
      call_count: 1,
      window_start: now.toISOString()
    });

  return { allowed: true, remaining: RATE_LIMIT - 1 };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Verify origin is allowed
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`Rejected request from unauthorized origin: ${origin}`);
    return new Response(
      JSON.stringify({ success: false, error: 'Forbidden' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get client IP for rate limiting
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Initialize Supabase client with service role for rate limiting
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(supabase, ipAddress, 'get-mapbox-token');
    
    if (!allowed) {
      console.warn(`Rate limit exceeded for IP: ${ipAddress}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.' 
        }),
        { 
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': RATE_WINDOW_SECONDS.toString()
          } 
        }
      )
    }

    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    
    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token not configured in environment')
      throw new Error('Service configuration error')
    }
    
    console.log(`Mapbox token requested from IP: ${ipAddress}, remaining: ${remaining}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        token: MAPBOX_TOKEN
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': remaining.toString()
        } 
      }
    )
    
  } catch (error) {
    console.error('Error getting Mapbox token:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An error occurred' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
