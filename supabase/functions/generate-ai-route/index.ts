
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { startLng, startLat, distance, unit } = await req.json()
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN') || 'pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWVpdmk4cmUwN3YwMmxzZDNtcjF2em54In0.kkCEFz-Lg2PQoLD-OTJp6Q'
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }
    
    console.log(`AI Route Generation - Start: [${startLat}, ${startLng}], Distance: ${distance}${unit}`)
    
    // Convert distance to meters for consistency
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    
    // Get location context using reverse geocoding
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${startLng},${startLat}.json?access_token=${MAPBOX_TOKEN}&types=neighborhood,locality,place`
    const geocodeResponse = await fetch(geocodeUrl)
    const geocodeData = await geocodeResponse.json()
    
    const locationContext = geocodeData.features?.[0]?.place_name || `coordinates ${startLat}, ${startLng}`
    console.log(`Location context: ${locationContext}`)
    
    // Use AI to generate route waypoints
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
      })
    })

    const aiData = await aiResponse.json()
    console.log('AI Response:', aiData)
    
    if (!aiData.choices?.[0]?.message?.content) {
      throw new Error('Invalid AI response')
    }
    
    let aiRouteData
    try {
      aiRouteData = JSON.parse(aiData.choices[0].message.content)
    } catch (error) {
      console.error('Failed to parse AI response:', aiData.choices[0].message.content)
      throw new Error('AI returned invalid JSON')
    }
    
    console.log('Parsed AI route data:', aiRouteData)
    
    // Build the route using Mapbox Directions API with AI waypoints
    const waypoints = aiRouteData.waypoints || []
    const allPoints = [
      { lat: startLat, lng: startLng },
      ...waypoints,
      { lat: startLat, lng: startLng } // Return to start
    ]
    
    const coordinatesString = allPoints.map(p => `${p.lng},${p.lat}`).join(';')
    
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesString}?` + 
      `geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full&steps=true`
    
    console.log('Fetching route from Mapbox:', directionsUrl)
    
    const routeResponse = await fetch(directionsUrl)
    const routeData = await routeResponse.json()
    
    if (!routeData.routes || routeData.routes.length === 0) {
      throw new Error('No route found by Mapbox')
    }
    
    const route = routeData.routes[0]
    console.log(`Generated route: ${route.distance}m, ${route.duration}s`)
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
          waypoints: waypoints,
          aiInsights: {
            routeStyle: aiRouteData.routeStyle || 'mixed',
            estimatedTerrain: aiRouteData.estimatedTerrain || 'mixed',
            description: `AI-generated ${aiRouteData.routeStyle || 'mixed'} route through ${locationContext}`
          }
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Error generating AI route:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
