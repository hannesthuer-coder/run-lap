import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestStart = Date.now();

  try {
    const { startLng, startLat, distance, unit } = await req.json();
    
    console.log(`🎯 AI Route Request - Start: [${startLat}, ${startLng}], Distance: ${distance}${unit}`);
    
    if (!startLng || !startLat || !distance || !unit) {
      throw new Error('Missing required parameters');
    }
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required for AI route generation');
    }
    
    if (!MAPBOX_TOKEN) {
      throw new Error('MAPBOX_ACCESS_TOKEN not configured');
    }
    
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34;
    console.log(`📏 Target distance: ${targetDistanceMeters}m`);
    
    // Get location context using reverse geocoding
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${startLng},${startLat}.json?access_token=${MAPBOX_TOKEN}&types=neighborhood,locality,place`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
    const locationContext = geocodeData.features?.[0]?.place_name || `coordinates ${startLat}, ${startLng}`;
    console.log(`📍 Location: ${locationContext}`);
    
    const aiPrompt = `You are a running route expert. Generate a smooth, circular running route.

Location: ${locationContext}
Start coordinates: [${startLat}, ${startLng}]
Target distance: ${targetDistanceMeters}m (${distance}${unit})

REQUIREMENTS:
1. Create a loop that returns to start
2. Use exactly 4-5 waypoints (CRITICAL: more waypoints = jagged route)
3. Waypoints should form a smooth circle or oval shape
4. Distance between ${targetDistanceMeters - 500}m and ${targetDistanceMeters + 500}m
5. Consider parks, waterfronts, or scenic areas if available
6. Avoid busy highways and dangerous areas
7. Each waypoint should be roughly equidistant from start

Respond with ONLY this JSON format (no other text):
{
  "waypoints": [
    {"lat": number, "lng": number, "description": "brief landmark or area name"}
  ],
  "aiInsights": "Brief description of why this route is good (scenery, safety, terrain, etc.)"
}

CRITICAL: Use only 4-5 waypoints arranged in a smooth circular pattern for a flowing route.`;

    console.log('🤖 Calling OpenAI API...');
    const apiStartTime = Date.now();
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: aiPrompt }],
        max_tokens: 800,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
    });
    
    const apiResponseTime = Date.now() - apiStartTime;
    console.log(`⏱️ OpenAI response time: ${apiResponseTime}ms`);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`❌ OpenAI API error: ${aiResponse.status} - ${errorText}`);
      
      if (aiResponse.status === 429) {
        throw new Error('OpenAI API rate limit exceeded');
      } else if (aiResponse.status === 402) {
        throw new Error('OpenAI API quota exceeded');
      } else if (aiResponse.status === 401) {
        throw new Error('Invalid OpenAI API key');
      }
      
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('✅ AI Response received');
    
    if (!aiData.choices?.[0]?.message?.content) {
      throw new Error('Invalid AI response structure');
    }
    
    let aiRouteData;
    try {
      const aiContent = aiData.choices[0].message.content.trim();
      const jsonContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      aiRouteData = JSON.parse(jsonContent);
      
      console.log(`✅ Parsed AI data: ${aiRouteData.waypoints?.length || 0} waypoints`);
      
      if (!aiRouteData.waypoints || !Array.isArray(aiRouteData.waypoints) || aiRouteData.waypoints.length < 2) {
        throw new Error('AI response missing valid waypoints');
      }
      
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message);
      throw new Error(`AI returned invalid JSON: ${parseError.message}`);
    }
    
    const allPoints = [
      { lat: startLat, lng: startLng },
      ...aiRouteData.waypoints,
      { lat: startLat, lng: startLng },
    ];
    
    const coordinatesString = allPoints.map(p => `${p.lng},${p.lat}`).join(';');
    
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesString}?` + 
      `geometries=geojson&` +
      `access_token=${MAPBOX_TOKEN}&` +
      `overview=full&` +
      `continue_straight=false&` +
      `steps=false`;
    
    console.log('🗺️ Fetching route from Mapbox...');
    
    const routeResponse = await fetch(directionsUrl);
    
    if (!routeResponse.ok) {
      throw new Error(`Mapbox API error: ${routeResponse.status}`);
    }
    
    const routeData = await routeResponse.json();
    
    if (!routeData.routes || routeData.routes.length === 0) {
      throw new Error('No walkable route found');
    }
    
    const route = routeData.routes[0];
    const processingTime = Date.now() - requestStart;
    
    console.log(`✅ AI Route generated: ${route.distance}m, ${route.duration}s (${processingTime}ms total)`);
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
          waypoints: aiRouteData.waypoints,
          aiInsights: {
            description: aiRouteData.aiInsights || `AI-generated ${route.distance}m route`,
            generationMethod: 'ai',
            processingTimeMs: processingTime,
            model: 'gpt-4o-mini',
          },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const processingTime = Date.now() - requestStart;
    console.error(`❌ Error (${processingTime}ms):`, error.message);
    
    let statusCode = 500;
    let clientMessage = error.message;
    
    if (error.message.includes('OpenAI API key')) {
      statusCode = 401;
      clientMessage = 'AI service not configured';
    } else if (error.message.includes('quota')) {
      statusCode = 402;
      clientMessage = 'AI service quota exceeded';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      clientMessage = 'AI service rate limit exceeded';
    } else if (error.message.includes('Mapbox')) {
      statusCode = 503;
      clientMessage = 'Unable to calculate walkable route';
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: clientMessage,
        details: error.message,
        processingTimeMs: processingTime,
      }),
      { 
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
