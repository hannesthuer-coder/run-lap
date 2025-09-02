
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
    
    const aiPrompt = `Create a running LOOP that forms a closed shape returning to the starting point.

LOCATION: Start/End at ${startLat}, ${startLng} in ${locationContext}
TARGET: Generate a route totaling ${targetDistanceMeters}m (${distance}${unit})

LOOP CREATION RULES:
• Create a closed geometric shape (square, rectangle, oval, polygon - NOT a circle necessarily)
• Start at coordinates ${startLat}, ${startLng}
• Place 4-6 waypoints that form the perimeter of your chosen shape
• End back at the exact starting coordinates ${startLat}, ${startLng}
• The shape should enclose an area and form a continuous loop

DISTANCE TARGET:
• Route must total between ${targetDistanceMeters - 300}m and ${targetDistanceMeters + 300}m
• If your shape is too small, make it bigger
• If your shape is too large, make it smaller
• Adjust the size of your loop to hit the target distance

WAYPOINT SEQUENCING (CRITICAL):
• Each waypoint should be the NEXT corner/point of your shape
• Move around the shape in ONE direction only (clockwise or counterclockwise)
• NEVER go backwards to a previous waypoint
• NEVER create detours that break the shape's perimeter
• Each waypoint should form a logical corner or curve of your loop

EXAMPLE GOOD LOOP:
Start → North corner → East corner → South corner → West corner → Back to Start
(This creates a roughly square loop)

EXAMPLE BAD PATTERNS TO AVOID:
• Start → North → South → North → East (zigzag - BAD)
• Start → East → West → East → South (backtracking - BAD)
• Start → North → detour South → back North → East (detour - BAD)

VALIDATION:
Before responding, ensure your waypoints form a continuous shape that loops back to start without any backtracking or detours.

Return ONLY this JSON structure:
{
  "waypoints": [
    {"lat": precise_number, "lng": precise_number, "description": "waypoint location"},
    ...
  ],
  "aiInsights": "brief route description"
}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000) // 45 second timeout for enhanced processing
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use GPT-4 for reliable JSON responses
        messages: [{ 
          role: 'user', 
          content: aiPrompt 
        }],
        max_tokens: 800 // Increased for detailed descriptions
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error(`❌ OpenAI API error: ${aiResponse.status} - ${errorText}`)
      
      // Check for specific error types
      if (aiResponse.status === 429) {
        errorType = ErrorType.API_RATE_LIMITED
        throw new Error('OpenAI API rate limit exceeded - please try again in a moment')
      } else if (aiResponse.status === 402) {
        errorType = ErrorType.API_QUOTA_EXCEEDED  
        throw new Error('OpenAI API quota exceeded - please upgrade your plan')
      } else if (aiResponse.status === 401) {
        errorType = ErrorType.API_KEY_MISSING
        throw new Error('Invalid OpenAI API key - please check your configuration')
      } else {
        errorType = ErrorType.NETWORK_ERROR
        throw new Error(`OpenAI API error: ${aiResponse.status}`)
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
      aiRouteData = JSON.parse(aiData.choices[0].message.content)
      console.log('✅ Parsed AI route data:', aiRouteData)
      
      // Validate AI response structure
      if (!aiRouteData.waypoints || !Array.isArray(aiRouteData.waypoints) || aiRouteData.waypoints.length < 2) {
        throw new Error('AI response missing valid waypoints array')
      }
      
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', aiData.choices[0].message.content)
      errorType = ErrorType.AI_PARSING_ERROR
      throw new Error('AI returned invalid JSON format - please try again')
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
            model: 'gpt-4o-mini'
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
