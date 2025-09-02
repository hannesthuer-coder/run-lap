
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

// Fallback route generation using simple circular geometry
const generateFallbackRoute = (startLat: number, startLng: number, targetDistanceMeters: number) => {
  console.log('Generating fallback route using circular geometry')
  
  // Calculate radius for a circular route (circumference = 2πr, so r = circumference/2π)
  const radiusMeters = targetDistanceMeters / (2 * Math.PI)
  const radiusDegrees = radiusMeters / 111000 // Rough conversion: 1 degree ≈ 111km
  
  const waypoints = []
  const numPoints = 8 // Create an octagon for variety
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints
    const lat = startLat + radiusDegrees * Math.cos(angle)
    const lng = startLng + radiusDegrees * Math.sin(angle) / Math.cos(startLat * Math.PI / 180)
    waypoints.push({ lat, lng, description: `Waypoint ${i + 1}` })
  }
  
  return {
    waypoints,
    routeStyle: 'circular',
    estimatedTerrain: 'mixed'
  }
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
    
    if (!MAPBOX_TOKEN) {
      errorType = ErrorType.MAPBOX_ERROR
      throw new Error('MAPBOX_ACCESS_TOKEN environment variable not configured')
    }
    
    // Convert distance to meters for consistency
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    console.log(`📏 Target distance: ${targetDistanceMeters}m`)
    
    let aiRouteData = null
    let usingFallback = false
    
    // Get location context using reverse geocoding
    try {
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${startLng},${startLat}.json?access_token=${MAPBOX_TOKEN}&types=neighborhood,locality,place`
      const geocodeResponse = await fetch(geocodeUrl)
      const geocodeData = await geocodeResponse.json()
      
      const locationContext = geocodeData.features?.[0]?.place_name || `coordinates ${startLat}, ${startLng}`
      console.log(`📍 Location context: ${locationContext}`)
      
      // Try AI route generation first
      if (OPENAI_API_KEY) {
        try {
          console.log('🤖 Attempting AI route generation...')
          
          const aiPrompt = `You are a running route planner. Generate a circular running route that starts and ends at the same location.

Starting location: ${locationContext} (${startLat}, ${startLng})
Target distance: ${distance} ${unit} (${targetDistanceMeters} meters)

Please generate 4-6 waypoints that create an interesting, safe, and scenic running loop. Consider:
- Parks, waterfront areas, or tree-lined streets when possible
- Avoiding busy highways or dangerous intersections
- Creating a natural loop that flows well for runners
- Varying terrain to keep the route interesting

Return ONLY a JSON object with this exact structure:
{
  "waypoints": [
    {"lat": number, "lng": number, "description": "brief waypoint description"},
    {"lat": number, "lng": number, "description": "brief waypoint description"}
  ],
  "routeStyle": "scenic/urban/park/mixed",
  "estimatedTerrain": "flat/rolling/hilly"
}

Generate waypoints within a reasonable distance from the start point to achieve the target distance.`

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
          
          const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1-2025-04-14',
              messages: [{ role: 'user', content: aiPrompt }],
              max_completion_tokens: 500
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
              throw new Error('OpenAI API rate limit exceeded')
            } else if (aiResponse.status === 402) {
              errorType = ErrorType.API_QUOTA_EXCEEDED  
              throw new Error('OpenAI API quota exceeded')
            } else if (aiResponse.status === 401) {
              errorType = ErrorType.API_KEY_MISSING
              throw new Error('OpenAI API key invalid')
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
          
          try {
            aiRouteData = JSON.parse(aiData.choices[0].message.content)
            console.log('✅ Parsed AI route data:', aiRouteData)
          } catch (parseError) {
            console.error('❌ Failed to parse AI response:', aiData.choices[0].message.content)
            errorType = ErrorType.AI_PARSING_ERROR
            throw new Error('AI returned invalid JSON format')
          }
          
        } catch (aiError) {
          console.error('❌ AI route generation failed:', aiError.message)
          
          // If AI fails, fall back to geometric route generation
          console.log('🔄 Falling back to geometric route generation...')
          aiRouteData = generateFallbackRoute(startLat, startLng, targetDistanceMeters)
          usingFallback = true
        }
      } else {
        console.log('⚠️ No OpenAI API key, using fallback route generation')
        aiRouteData = generateFallbackRoute(startLat, startLng, targetDistanceMeters)
        usingFallback = true
        errorType = ErrorType.API_KEY_MISSING
      }
    } catch (geocodeError) {
      console.error('❌ Geocoding failed:', geocodeError)
      // Continue with fallback using coordinates
      console.log('🔄 Using coordinate-based fallback route...')
      aiRouteData = generateFallbackRoute(startLat, startLng, targetDistanceMeters)
      usingFallback = true
    }
    
    // Build the route using Mapbox Directions API with waypoints
    const waypoints = aiRouteData?.waypoints || []
    const allPoints = [
      { lat: startLat, lng: startLng },
      ...waypoints,
      { lat: startLat, lng: startLng } // Return to start
    ]
    
    const coordinatesString = allPoints.map(p => `${p.lng},${p.lat}`).join(';')
    
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesString}?` + 
      `geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full&steps=true`
    
    console.log('🗺️ Fetching route from Mapbox...')
    
    try {
      const routeResponse = await fetch(directionsUrl)
      
      if (!routeResponse.ok) {
        errorType = ErrorType.MAPBOX_ERROR
        throw new Error(`Mapbox API error: ${routeResponse.status}`)
      }
      
      const routeData = await routeResponse.json()
      
      if (!routeData.routes || routeData.routes.length === 0) {
        errorType = ErrorType.MAPBOX_ERROR
        throw new Error('No route found by Mapbox - may be unreachable waypoints')
      }
      
      const route = routeData.routes[0]
      const processingTime = Date.now() - requestStart
      
      console.log(`✅ Route generated successfully: ${route.distance}m, ${route.duration}s (${processingTime}ms total)`)
      
      if (usingFallback) {
        console.log('⚠️ Used fallback route generation due to AI service issues')
      }
    
      return new Response(
        JSON.stringify({
          success: true,
          route: {
            geometry: route.geometry,
            distance: route.distance,
            duration: route.duration,
            waypoints: waypoints,
            aiInsights: {
              routeStyle: aiRouteData?.routeStyle || 'mixed',
              estimatedTerrain: aiRouteData?.estimatedTerrain || 'mixed',
              description: usingFallback 
                ? `Fallback geometric route (${route.distance}m)`
                : `AI-generated ${aiRouteData?.routeStyle || 'mixed'} route`,
              generationMethod: usingFallback ? 'fallback' : 'ai',
              processingTimeMs: processingTime
            }
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
      
    } catch (mapboxError) {
      console.error('❌ Mapbox routing failed:', mapboxError)
      errorDetails = mapboxError.message
      throw mapboxError
    }
    
  } catch (error) {
    const processingTime = Date.now() - (requestStart || Date.now())
    console.error(`❌ Error generating route (${processingTime}ms):`, error.message)
    
    // Determine error category for better client handling
    let statusCode = 500
    let clientMessage = error.message
    
    switch (errorType) {
      case ErrorType.API_KEY_MISSING:
        statusCode = 401
        clientMessage = 'AI service configuration missing - using fallback route generation'
        break
      case ErrorType.API_QUOTA_EXCEEDED:
        statusCode = 402
        clientMessage = 'AI service quota exceeded - please try again later'
        break
      case ErrorType.API_RATE_LIMITED:
        statusCode = 429
        clientMessage = 'AI service temporarily busy - please try again in a moment'
        break
      case ErrorType.MAPBOX_ERROR:
        statusCode = 503
        clientMessage = 'Route mapping service unavailable - please try a different location'
        break
      case ErrorType.NETWORK_ERROR:
        statusCode = 503
        clientMessage = 'Network connectivity issues - please check your connection'
        break
      case ErrorType.AI_PARSING_ERROR:
        statusCode = 502
        clientMessage = 'AI service returned invalid data - using fallback route generation'
        break
      default:
        clientMessage = 'Route generation temporarily unavailable - please try again'
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
