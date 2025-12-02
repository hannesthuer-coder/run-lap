
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Error types for better error handling
enum ErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  AI_PARSING_ERROR = 'AI_PARSING_ERROR',
  MAPBOX_ERROR = 'MAPBOX_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  GENERAL_ERROR = 'GENERAL_ERROR'
}

// Helper function to calculate bearing between two points
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;
  
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - 
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  
  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

// Helper function to calculate distance between two points (Haversine)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => deg * Math.PI / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to calculate angle difference
function angleDifference(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

// Function to remove spikes from route coordinates
function removeSpikesFromRoute(coordinates: number[][]): { 
  coordinates: number[][], 
  spikesRemoved: number, 
  distanceSaved: number 
} {
  let cleanedCoords = [...coordinates];
  let totalSpikesRemoved = 0;
  let originalDistance = 0;
  
  // Calculate original distance
  for (let i = 0; i < coordinates.length - 1; i++) {
    originalDistance += calculateDistance(
      coordinates[i][1], coordinates[i][0],
      coordinates[i + 1][1], coordinates[i + 1][0]
    );
  }
  
  // Multi-pass spike removal
  for (let pass = 0; pass < 3; pass++) {
    let foundSpike = false;
    let i = 1;
    
    while (i < cleanedCoords.length - 2) {
      const pointBefore = cleanedCoords[i - 1];
      const currentPoint = cleanedCoords[i];
      
      // Look ahead to find potential spike end
      for (let j = i + 1; j < Math.min(i + 8, cleanedCoords.length - 1); j++) {
        const pointAfter = cleanedCoords[j];
        
        // Calculate bearings
        const bearingIn = calculateBearing(
          pointBefore[1], pointBefore[0],
          currentPoint[1], currentPoint[0]
        );
        const bearingOut = calculateBearing(
          currentPoint[1], currentPoint[0],
          pointAfter[1], pointAfter[0]
        );
        
        // Check for ~180° reversal
        const angleDiff = angleDifference(bearingIn, bearingOut);
        
        if (angleDiff > 150 && angleDiff < 210) {
          // Calculate distance ratio to verify spike
          const straightLineDist = calculateDistance(
            pointBefore[1], pointBefore[0],
            pointAfter[1], pointAfter[0]
          );
          
          let pathDist = 0;
          for (let k = i - 1; k < j; k++) {
            pathDist += calculateDistance(
              cleanedCoords[k][1], cleanedCoords[k][0],
              cleanedCoords[k + 1][1], cleanedCoords[k + 1][0]
            );
          }
          
          const ratio = straightLineDist > 0 ? pathDist / straightLineDist : Infinity;
          
          // If path is much longer than straight line, it's a spike - remove ALL spikes
          if (ratio > 2.5) {
            // Remove spike points
            cleanedCoords.splice(i, j - i);
            totalSpikesRemoved++;
            foundSpike = true;
            break;
          }
        }
      }
      
      if (!foundSpike) {
        i++;
      }
    }
    
    if (!foundSpike) break;
  }
  
  // Calculate new distance
  let newDistance = 0;
  for (let i = 0; i < cleanedCoords.length - 1; i++) {
    newDistance += calculateDistance(
      cleanedCoords[i][1], cleanedCoords[i][0],
      cleanedCoords[i + 1][1], cleanedCoords[i + 1][0]
    );
  }
  
  return {
    coordinates: cleanedCoords,
    spikesRemoved: totalSpikesRemoved,
    distanceSaved: originalDistance - newDistance
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestStart = Date.now()
  let errorType = ErrorType.GENERAL_ERROR
  let errorDetails = ''

  try {
    const { startLng, startLat, distance, unit } = await req.json()
    
    console.log(`🚀 AI Route Generation Request - Start: [${startLat}, ${startLng}], Distance: ${distance}${unit}`)
    
    // Validate input parameters
    if (!startLng || !startLat || !distance || !unit) {
      errorType = ErrorType.GENERAL_ERROR
      throw new Error('Missing required parameters: startLng, startLat, distance, unit')
    }
    
    if (typeof startLng !== 'number' || typeof startLat !== 'number' || typeof distance !== 'number') {
      errorType = ErrorType.GENERAL_ERROR
      throw new Error('Invalid parameter types')
    }
    
    if (distance <= 0 || distance > 500) {
      errorType = ErrorType.GENERAL_ERROR
      throw new Error('Distance must be between 0 and 500')
    }
    
    if (!['km', 'miles'].includes(unit)) {
      errorType = ErrorType.GENERAL_ERROR
      throw new Error('Unit must be km or miles')
    }
    
    // Import Supabase for auth and limit checking
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    
    // Get auth token from request header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check route limit - query last 30 days
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: routeGenerations, error: countError } = await supabase
      .from('route_generations')
      .select('id', { count: 'exact', head: false })
      .eq('user_id', user.id)
      .gte('created_at', last30Days)
    
    if (countError) {
      console.error('Error checking route limit:', countError)
    }
    
    const routeCount = routeGenerations?.length || 0
    
    // Check subscription status
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_expires_at')
      .eq('id', user.id)
      .single()
    
    const hasActiveSubscription = profile?.subscription_status === 'premium' && 
      profile?.subscription_expires_at && 
      new Date(profile.subscription_expires_at) > new Date()
    
    // Enforce 3 route limit for free users
    if (!hasActiveSubscription && routeCount >= 3) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Route limit reached',
          limit: 3,
          used: routeCount,
          requiresUpgrade: true
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    
    if (!OPENAI_API_KEY) {
      errorType = ErrorType.API_KEY_MISSING
      throw new Error('OpenAI API key is required for route generation')
    }
    
    if (!MAPBOX_TOKEN) {
      errorType = ErrorType.MAPBOX_ERROR
      throw new Error('MAPBOX_ACCESS_TOKEN environment variable not configured')
    }
    
    // Convert distance to meters for consistency
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    console.log(`📏 Target distance: ${targetDistanceMeters}m`)
    
    // Get location context using reverse geocoding
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${startLng},${startLat}.json?access_token=${MAPBOX_TOKEN}&types=neighborhood,locality,place`
    const geocodeResponse = await fetch(geocodeUrl)
    const geocodeData = await geocodeResponse.json()
    
    const locationContext = geocodeData.features?.[0]?.place_name || `coordinates ${startLat}, ${startLng}`
    console.log(`📍 Location context: ${locationContext}`)
    
    console.log('🤖 Generating AI-powered route...')
    
    const aiPrompt = `Generate a running route as valid JSON only.

Target: ${targetDistanceMeters}m route starting at ${startLat}, ${startLng}
Location: ${locationContext}

STRICT Requirements:
- Create a loop that returns to start
- Distance MUST be between ${targetDistanceMeters - 500}m and ${targetDistanceMeters + 500}m 
- NO LONGER than ${targetDistanceMeters + 500}m
- NO SHORTER than ${targetDistanceMeters - 500}m
- Use 4-6 waypoints in sequence (no backtracking)
- Only walkable streets/paths

Respond with ONLY this exact JSON format:
{
  "waypoints": [
    {"lat": ${startLat}, "lng": ${startLng}, "description": "Start point"},
    {"lat": 59.271, "lng": 18.087, "description": "North waypoint"},
    {"lat": 59.272, "lng": 18.089, "description": "East waypoint"},
    {"lat": 59.269, "lng": 18.088, "description": "South waypoint"},
    {"lat": 59.268, "lng": 18.085, "description": "West waypoint"}
  ],
  "aiInsights": "Brief description of the route"
}

Important: Return ONLY valid JSON, no other text.`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.error('❌ Request timeout after 60 seconds')
      controller.abort()
    }, 60000) // Increased to 60 seconds for more reliability
    
    console.log('🔄 Calling OpenAI API...')
    const apiStartTime = Date.now()
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use GPT-4o-mini - proven to work for route generation
        messages: [{ 
          role: 'user', 
          content: aiPrompt 
        }],
        max_tokens: 800 // Use max_tokens for GPT-4o models
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    const apiResponseTime = Date.now() - apiStartTime
    console.log(`⏱️ OpenAI API response time: ${apiResponseTime}ms`)

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error(`❌ OpenAI API error after ${apiResponseTime}ms: ${aiResponse.status} - ${errorText}`)
      
      // Check for specific error types
      if (aiResponse.status === 429) {
        errorType = ErrorType.API_RATE_LIMITED
        throw new Error('OpenAI API rate limit exceeded - please wait a few seconds and try again')
      } else if (aiResponse.status === 402) {
        errorType = ErrorType.API_QUOTA_EXCEEDED  
        throw new Error('OpenAI API quota exceeded - please upgrade your plan')
      } else if (aiResponse.status === 401) {
        errorType = ErrorType.API_KEY_MISSING
        throw new Error('Invalid OpenAI API key - please check your configuration')
      } else if (aiResponse.status === 500 || aiResponse.status === 502 || aiResponse.status === 503) {
        errorType = ErrorType.NETWORK_ERROR
        throw new Error('OpenAI service temporarily unavailable - please try again in a moment')
      } else {
        errorType = ErrorType.NETWORK_ERROR
        throw new Error(`OpenAI API error: ${aiResponse.status} - ${errorText.substring(0, 200)}`)
      }
    }

    const aiData = await aiResponse.json()
    console.log('✅ AI Response received:', aiData.usage || 'usage info not available')
    
    if (!aiData.choices?.[0]?.message?.content) {
      errorType = ErrorType.AI_PARSING_ERROR
      throw new Error('Invalid AI response structure')
    }
    
    let aiRouteData
    try {
      const aiContent = aiData.choices[0].message.content
      console.log('🔍 Raw AI response content:', aiContent.substring(0, 500) + (aiContent.length > 500 ? '...' : ''))
      
      aiRouteData = JSON.parse(aiContent)
      console.log('✅ Parsed AI route data:', aiRouteData)
      
      // Validate AI response structure
      if (!aiRouteData.waypoints || !Array.isArray(aiRouteData.waypoints) || aiRouteData.waypoints.length < 2) {
        console.error('❌ Invalid waypoints structure:', aiRouteData.waypoints)
        throw new Error('AI response missing valid waypoints array')
      }
      
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message)
      console.error('❌ Raw response causing error:', aiData.choices[0].message.content)
      errorType = ErrorType.AI_PARSING_ERROR
      throw new Error(`AI returned invalid JSON: ${parseError.message}`)
    }
    
    // Build the route using Mapbox Directions API with waypoints
    const waypoints = aiRouteData.waypoints
    const allPoints = [
      { lat: startLat, lng: startLng },
      ...waypoints,
      { lat: startLat, lng: startLng } // Return to start
    ]
    
    const coordinatesString = allPoints.map(p => `${p.lng},${p.lat}`).join(';')
    
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesString}?` + 
      `geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full&steps=true`
    
    console.log('🗺️ Fetching route from Mapbox...')
    
    const routeResponse = await fetch(directionsUrl)
    
    if (!routeResponse.ok) {
      errorType = ErrorType.MAPBOX_ERROR
      throw new Error(`Mapbox API error: ${routeResponse.status} - Unable to calculate route`)
    }
    
    const routeData = await routeResponse.json()
    
    if (!routeData.routes || routeData.routes.length === 0) {
      errorType = ErrorType.MAPBOX_ERROR
      throw new Error('No walkable route found - waypoints may be unreachable or invalid')
    }
    
    const route = routeData.routes[0]
    
    // Apply spike removal to clean the route
    console.log('🔧 Checking for spikes in route...')
    const spikeResult = removeSpikesFromRoute(route.geometry.coordinates)
    
    if (spikeResult.spikesRemoved > 0) {
      console.log(`✂️ Removed ${spikeResult.spikesRemoved} spike(s), saved ${spikeResult.distanceSaved.toFixed(1)}m`)
      route.geometry.coordinates = spikeResult.coordinates
      // Recalculate distance after spike removal
      let newDistance = 0
      for (let i = 0; i < spikeResult.coordinates.length - 1; i++) {
        newDistance += calculateDistance(
          spikeResult.coordinates[i][1], spikeResult.coordinates[i][0],
          spikeResult.coordinates[i + 1][1], spikeResult.coordinates[i + 1][0]
        )
      }
      route.distance = newDistance
    } else {
      console.log('✅ No spikes detected in route')
    }
    
    const processingTime = Date.now() - requestStart
    
    console.log(`✅ AI Route generated successfully: ${route.distance}m, ${route.duration}s (${processingTime}ms total)`)
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
          waypoints: waypoints,
          aiInsights: {
            description: aiRouteData.aiInsights || `AI-generated route (${route.distance}m)`,
            generationMethod: 'ai',
            processingTimeMs: processingTime,
            model: 'gpt-4o-mini',
            spikesRemoved: spikeResult.spikesRemoved
          }
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    const processingTime = Date.now() - (requestStart || Date.now())
    console.error(`❌ Error generating route (${processingTime}ms):`, error.message)
    
    // Determine error category for better client handling
    let statusCode = 500
    let clientMessage = error.message
    
    switch (errorType) {
      case ErrorType.API_KEY_MISSING:
        statusCode = 401
        clientMessage = 'OpenAI API key is required - please configure your API key to generate routes'
        break
      case ErrorType.API_QUOTA_EXCEEDED:
        statusCode = 402
        clientMessage = 'OpenAI API quota exceeded - please upgrade your plan or try again later'
        break
      case ErrorType.API_RATE_LIMITED:
        statusCode = 429
        clientMessage = 'OpenAI API rate limit exceeded - please try again in a moment'
        break
      case ErrorType.MAPBOX_ERROR:
        statusCode = 503
        clientMessage = 'Unable to calculate walkable route - please try a different location or distance'
        break
      case ErrorType.NETWORK_ERROR:
        statusCode = 503
        clientMessage = 'AI service unavailable - please check your connection and try again'
        break
      case ErrorType.AI_PARSING_ERROR:
        statusCode = 502
        clientMessage = 'AI service returned invalid route data - please try generating again'
        break
      default:
        clientMessage = 'AI route generation failed - please try again'
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: clientMessage,
        errorType,
        details: errorDetails || error.message,
        processingTimeMs: processingTime
      }),
      { 
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
