import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN') || 'pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWVpdmk4cmUwN3YwMmxzZDNtcjF2em54In0.kkCEFz-Lg2PQoLD-OTJp6Q'
    
    console.log(`Using Mapbox token: ${MAPBOX_TOKEN ? 'Available' : 'Missing'}`)
    
    // Convert distance to meters
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    console.log(`Target distance: ${targetDistanceMeters}m`)

    // Simple function to get walking route between two points
    const getWalkingRoute = async (fromLng, fromLat, toLng, toLat) => {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${fromLng},${fromLat};${toLng},${toLat}?` + 
        `geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full&steps=true`
      
      try {
        const response = await fetch(url)
        const data = await response.json()
        
        if (data.routes && data.routes.length > 0) {
          return data.routes[0]
        }
        return null
      } catch (error) {
        console.log(`Route request failed: ${error.message}`)
        return null
      }
    }

    // Function to find a point roughly at given distance in given direction
    const findPointInDirection = (startLng, startLat, bearingDegrees, distanceKm) => {
      const R = 6371 // Earth's radius in km
      const bearing = bearingDegrees * Math.PI / 180
      const lat1 = startLat * Math.PI / 180
      const lon1 = startLng * Math.PI / 180
      
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distanceKm / R) +
                            Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(bearing))
      
      const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(distanceKm / R) * Math.cos(lat1),
                                    Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2))
      
      return {
        lat: lat2 * 180 / Math.PI,
        lng: lon2 * 180 / Math.PI
      }
    }

    // Helper function to calculate bearing between two points
    const calculateBearing = (startLng, startLat, endLng, endLat) => {
      const lat1 = startLat * Math.PI / 180
      const lat2 = endLat * Math.PI / 180
      const deltaLng = (endLng - startLng) * Math.PI / 180
      
      const y = Math.sin(deltaLng) * Math.cos(lat2)
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
      
      const bearing = Math.atan2(y, x) * 180 / Math.PI
      return (bearing + 360) % 360
    }

    // Check if a route segment creates a spike (sharp reversal)
    const isSpike = (prevBearing, currentBearing) => {
      if (prevBearing === null) return false
      
      let diff = Math.abs(currentBearing - prevBearing)
      if (diff > 180) diff = 360 - diff
      
      // Be less aggressive - consider it a spike if direction changes by more than 140°
      return diff > 140
    }

    // Create a natural loop route with improved natural exploration
    const createNaturalLoop = async (targetDistance, seed = Math.random()) => {
      console.log(`\n=== Creating natural loop (seed: ${seed.toFixed(3)}) ===`)
      
      // Use 3-4 segments for simpler routes, but try different segment counts for variety
      const segments = 3 + Math.floor(seed * 2) // 3 or 4 segments
      const baseDirection = seed * 360 // Random initial direction
      
      console.log(`Creating ${segments} segments, initial direction: ${baseDirection.toFixed(1)}°`)
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      let prevBearing = null
      
      // Create segments with natural exploration
      for (let i = 0; i < segments; i++) {
        // Start with larger segments and adjust based on remaining distance
        const remainingSegments = segments - i
        const baseSegmentDistance = (targetDistance - totalDistance) / remainingSegments * 0.7 // Leave room for variations
        
        // Add natural variation to segment distances
        const variation = (seed - 0.5) * 0.3 // ±15% variation
        let segmentDistance = baseSegmentDistance * (1 + variation)
        
        // Ensure minimum segment size
        segmentDistance = Math.max(segmentDistance, 800) // At least 800m per segment
        
        // Calculate natural turn angles - less rigid geometry
        const naturalTurnBase = 360 / segments // Base turn for completing loop
        const turnVariation = (seed - 0.5) * 90 // ±45° variation for more natural turns
        let targetBearing = (baseDirection + (i * naturalTurnBase) + turnVariation) % 360
        
        // Try multiple directions with wider search
        let attempts = 0
        let segmentRoute = null
        let actualBearing = null
        const maxAttempts = 5 // More attempts for better results
        
        while (attempts < maxAttempts && !segmentRoute) {
          // Use slightly varied distances for each attempt
          const attemptDistance = segmentDistance * (0.8 + (attempts * 0.1)) // 80% to 120% of target
          const segmentDistanceKm = attemptDistance / 1000
          const waypoint = findPointInDirection(currentLng, currentLat, targetBearing, segmentDistanceKm)
          
          console.log(`Attempt ${attempts + 1}: Trying direction ${targetBearing.toFixed(1)}° for ${attemptDistance.toFixed(0)}m`)
          
          // Test the route
          const testRoute = await getWalkingRoute(currentLng, currentLat, waypoint.lng, waypoint.lat)
          
          if (testRoute) {
            // Calculate the actual bearing of this route
            const routeCoords = testRoute.geometry.coordinates
            if (routeCoords.length >= 2) {
              actualBearing = calculateBearing(
                routeCoords[0][0], routeCoords[0][1],
                routeCoords[routeCoords.length - 1][0], routeCoords[routeCoords.length - 1][1]
              )
              
              // Check for spikes with more lenient threshold
              if (!isSpike(prevBearing, actualBearing)) {
                segmentRoute = testRoute
                console.log(`✓ Segment ${i + 1}: Direction ${actualBearing.toFixed(1)}° for ${testRoute.distance.toFixed(0)}m`)
                break
              } else {
                console.log(`Spike detected (${prevBearing?.toFixed(1)}° -> ${actualBearing.toFixed(1)}°), trying alternative`)
              }
            }
          } else {
            console.log(`No route found for attempt ${attempts + 1}`)
          }
          
          attempts++
          // Try progressively different directions
          targetBearing = (targetBearing + (30 + attempts * 15)) % 360
        }
        
        if (!segmentRoute) {
          console.log(`Failed to find valid route for segment ${i + 1} after ${maxAttempts} attempts`)
          return null
        }
        
        // Add this segment to the total route
        totalDistance += segmentRoute.distance
        allCoordinates.push(...segmentRoute.geometry.coordinates.slice(1))
        
        // Update current position
        const coords = segmentRoute.geometry.coordinates
        currentLng = coords[coords.length - 1][0]
        currentLat = coords[coords.length - 1][1]
        prevBearing = actualBearing
        
        console.log(`After segment ${i + 1}: ${totalDistance.toFixed(0)}m covered`)
      }
      
      // Final return segment to complete the loop
      console.log(`Final return: From [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}] to start`)
      
      const returnRoute = await getWalkingRoute(currentLng, currentLat, startLng, startLat)
      
      if (!returnRoute) {
        console.log('Failed to get return route')
        return null
      }
      
      // Check if return route creates a spike (more lenient for return)
      const returnBearing = calculateBearing(currentLng, currentLat, startLng, startLat)
      if (isSpike(prevBearing, returnBearing)) {
        console.log(`Return spike detected (${prevBearing?.toFixed(1)}° -> ${returnBearing.toFixed(1)}°) - rejecting route`)
        return null
      }
      
      totalDistance += returnRoute.distance
      allCoordinates.push(...returnRoute.geometry.coordinates.slice(1))
      
      const distanceDiff = Math.abs(totalDistance - targetDistance)
      console.log(`Final total: ${totalDistance.toFixed(0)}m (target: ${targetDistance}m, diff: ${distanceDiff.toFixed(0)}m)`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: 0
      }
    }

    // Try multiple variations to find the best route
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = 500 // Maximum 500m tolerance as requested
    
    console.log(`Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m`)
    
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const seed = (Date.now() + attempt * 1000) % 10000 / 10000
        console.log(`\n--- Attempt ${attempt + 1}/5 ---`)
        
        const route = await createNaturalLoop(targetDistanceMeters, seed)
        
        if (!route) {
          console.log('No route generated')
          continue
        }
        
        const distanceDiff = Math.abs(route.distance - targetDistanceMeters)
        console.log(`Route: ${route.distance}m (diff: ${distanceDiff}m)`)
        
        if (distanceDiff < bestDistanceDiff) {
          bestRoute = route
          bestDistanceDiff = distanceDiff
          console.log('✓ New best route')
        }
        
        if (distanceDiff <= tolerance) {
          console.log('✓ Within tolerance - using this route')
          break
        }
        
      } catch (error) {
        console.log(`Attempt ${attempt + 1} failed: ${error.message}`)
      }
    }
    
    if (!bestRoute) {
      throw new Error('Could not generate any valid route after 5 attempts')
    }
    
    console.log(`\n🎯 Selected route: ${bestRoute.distance}m (${bestDistanceDiff}m from target)`)
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: {
            type: 'LineString',
            coordinates: bestRoute.coordinates
          },
          distance: bestRoute.distance,
          duration: bestRoute.duration,
          waypoints: []
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Error generating route:', error)
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