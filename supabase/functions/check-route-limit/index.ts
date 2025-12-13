import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fingerprint, sessionId } = await req.json();
    
    // Validate inputs
    if (!fingerprint || typeof fingerprint !== 'string' || fingerprint.length < 10 || fingerprint.length > 100) {
      throw new Error('Invalid fingerprint')
    }
    
    if (sessionId && (typeof sessionId !== 'string' || sessionId.length > 100)) {
      throw new Error('Invalid session ID')
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Only return whether user can generate, not exact counts
    const count = data || 0
    return new Response(
      JSON.stringify({ 
        canGenerate: count < 3,
        limitReached: count >= 3
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
