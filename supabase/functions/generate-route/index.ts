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

    // Check if a route segment creates a spike (sharp reversal) - distance-adaptive
    const isSpike = (prevBearing, currentBearing, targetDistance) => {
      if (prevBearing === null) return false
      
      let diff = Math.abs(currentBearing - prevBearing)
      if (diff > 180) diff = 360 - diff
      
      // Distance-adaptive spike detection thresholds
      let spikeThreshold
      if (targetDistance < 3000) {
        spikeThreshold = 120 // Stricter for short routes
      } else if (targetDistance < 6000) {
        spikeThreshold = 130 // Medium for medium routes
      } else {
        spikeThreshold = 145 // More relaxed for long routes
      }
      
      return diff > spikeThreshold
    }

    // Create a natural loop route with anti-spike logic
    const createNaturalLoop = async (targetDistance, seed = Math.random()) => {
      console.log(`\n=== Creating natural loop (seed: ${seed.toFixed(3)}) ===`)
      
      // Distance-adaptive segment strategy
      let segments
      if (targetDistance < 3000) {
        segments = 2 // Simple 2-segment routes for short distances
      } else if (targetDistance < 6000) {
        segments = 3 // 3 segments for medium distances  
      } else {
        segments = 4 + Math.floor(seed * 2) // 4-5 segments for long distances
      }
      
      const baseDirection = seed * 360 // Random initial direction
      
      console.log(`Creating ${segments} segments, initial direction: ${baseDirection.toFixed(1)}°`)
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      let prevBearing = null
      
      // Create segments with natural exploration
      for (let i = 0; i < segments; i++) {
        const segmentRatio = (i + 1) / segments
        let segmentDistance = targetDistance * (0.8 / segments) // Conservative segment size
        
        // Add natural variation to segment distances
        const variation = (seed - 0.5) * 0.4 // ±20% variation
        segmentDistance *= (1 + variation)
        
        // Calculate turn angle (90-120° for natural turns)
        const baseTurnAngle = 360 / segments // Base angle for completing the loop
        const turnVariation = (seed - 0.5) * 60 // ±30° variation
        let targetBearing = (baseDirection + (i * baseTurnAngle) + turnVariation) % 360
        
        // Reduce attempts for better performance: max 2 attempts per segment
        let attempts = 0
        let segmentRoute = null
        let actualBearing = null
        
        while (attempts < 2 && !segmentRoute) {
          const segmentDistanceKm = segmentDistance / 1000
          const waypoint = findPointInDirection(currentLng, currentLat, targetBearing, segmentDistanceKm)
          
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
              
              // Check for spikes with distance-adaptive threshold
              if (!isSpike(prevBearing, actualBearing, targetDistance)) {
                segmentRoute = testRoute
                console.log(`Segment ${i + 1}: Direction ${actualBearing.toFixed(1)}° for ${testRoute.distance.toFixed(0)}m`)
                break
              } else {
                console.log(`Spike detected (${prevBearing?.toFixed(1)}° -> ${actualBearing.toFixed(1)}°), trying alternative`)
              }
            }
          }
          
          attempts++
          targetBearing = (targetBearing + 45) % 360 // Try different direction
        }
        
        if (!segmentRoute) {
          console.log(`Failed to find non-spike route for segment ${i + 1}`)
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
        
        // Dynamic distance adjustment
        const remainingSegments = segments - i - 1
        if (remainingSegments > 0) {
          const remainingDistance = targetDistance - totalDistance
          segmentDistance = remainingDistance / remainingSegments * 0.8 // Leave room for return
        }
      }
      
      // Final return segment to complete the loop
      console.log(`Final return: From [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}] to start`)
      
      const returnRoute = await getWalkingRoute(currentLng, currentLat, startLng, startLat)
      
      if (!returnRoute) {
        console.log('Failed to get return route')
        return null
      }
      
      // Check if return route creates a spike with distance-adaptive threshold
      const returnBearing = calculateBearing(currentLng, currentLat, startLng, startLat)
      if (isSpike(prevBearing, returnBearing, targetDistance)) {
        console.log('Return route would create a spike - rejecting this route')
        return null
      }
      
      totalDistance += returnRoute.distance
      allCoordinates.push(...returnRoute.geometry.coordinates.slice(1))
      
      console.log(`Final total: ${totalDistance}m (target: ${targetDistance}m, diff: ${Math.abs(totalDistance - targetDistance)}m)`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: 0
      }
    }

    // Distance-adaptive tolerance and reduced attempts for performance
    let bestRoute = null
    let bestDistanceDiff = Infinity
    
    // Adaptive tolerance: fixed for short distances, percentage-based for long distances
    const tolerance = targetDistanceMeters < 4000 ? 500 : Math.max(500, targetDistanceMeters * 0.04) // 4% for longer distances
    const maxAttempts = targetDistanceMeters < 3000 ? 3 : 4 // Fewer attempts for short routes
    
    console.log(`Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m, Max attempts: ${maxAttempts}`)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const seed = (Date.now() + attempt * 1000) % 10000 / 10000
        console.log(`\n--- Attempt ${attempt + 1}/${maxAttempts} ---`)
        
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
          console.log('✓ Within tolerance - stopping early for performance')
          break
        }
        
      } catch (error) {
        console.log(`Attempt ${attempt + 1} failed: ${error.message}`)
      }
    }
    
    if (!bestRoute) {
      throw new Error(`Could not generate any valid route after ${maxAttempts} attempts`)
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