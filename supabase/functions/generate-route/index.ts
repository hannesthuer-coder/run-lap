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
      
      // Consider it a spike if the direction changes by more than 120°
      return diff > 120
    }

    // Fast distance calculation between two points in meters
    const calculateDistance = (lng1, lat1, lng2, lat2) => {
      const R = 6371000 // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLng = (lng2 - lng1) * Math.PI / 180
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      return R * c
    }

    // Generate optimized Strava-style organic loops
    const generateOrganicLoop = async (targetDistance, seed = Math.random()) => {
      console.log(`\n=== Generating organic loop (seed: ${seed.toFixed(3)}) ===`)
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      let visitedPoints = [] // Store [lng, lat] for distance-based collision detection
      let lastBearing = seed * 360 // Track direction for natural turns
      
      // Add starting point
      visitedPoints.push([startLng, startLat])
      
      // Plan segments upfront for efficiency
      const explorationTarget = targetDistance * 0.75
      const numSegments = Math.min(4, Math.max(2, Math.floor(targetDistance / 2000))) // 2-4 segments based on distance
      const avgSegmentDistance = explorationTarget / numSegments
      
      console.log(`Planning ${numSegments} segments, avg ${avgSegmentDistance.toFixed(0)}m each`)
      
      // Exploration phase with minimal API calls
      for (let segment = 0; segment < numSegments; segment++) {
        const remainingDistance = explorationTarget - totalDistance
        if (remainingDistance < 500) break // Stop if very close to target
        
        const segmentTarget = Math.min(remainingDistance, avgSegmentDistance * (0.8 + seed * 0.4))
        const segmentDistanceKm = segmentTarget / 1000
        
        let bestRoute = null
        let bestDistance = 0
        
        // Try only 2-3 smart directions (massive reduction from 18 combinations)
        const baseDirection = (lastBearing + 60 + seed * 120) % 360 // Turn 60-180° from last direction
        const directions = [
          baseDirection,
          (baseDirection + 90) % 360,
          (baseDirection - 90 + 360) % 360
        ]
        
        for (const direction of directions) {
          const waypoint = findPointInDirection(currentLng, currentLat, direction, segmentDistanceKm)
          
          // Fast collision detection: check if waypoint is too close to any visited point
          let tooClose = false
          for (const [vLng, vLat] of visitedPoints) {
            if (calculateDistance(waypoint.lng, waypoint.lat, vLng, vLat) < 200) { // 200m minimum separation
              tooClose = true
              break
            }
          }
          
          if (tooClose) continue
          
          const testRoute = await getWalkingRoute(currentLng, currentLat, waypoint.lng, waypoint.lat)
          
          if (testRoute && testRoute.distance > 300 && testRoute.distance > bestDistance) {
            bestRoute = testRoute
            bestDistance = testRoute.distance
            console.log(`Segment ${segment + 1}: ${direction.toFixed(0)}° for ${testRoute.distance.toFixed(0)}m`)
            break // Take first good route for speed
          }
        }
        
        if (!bestRoute) {
          console.log(`No valid route for segment ${segment + 1}`)
          break
        }
        
        // Add route
        totalDistance += bestRoute.distance
        const coords = bestRoute.geometry.coordinates
        allCoordinates.push(...coords.slice(1))
        
        // Update position and visited points (sample every ~100m for efficiency)
        const sampleRate = Math.max(1, Math.floor(coords.length / 10))
        for (let i = 0; i < coords.length; i += sampleRate) {
          visitedPoints.push([coords[i][0], coords[i][1]])
        }
        
        currentLng = coords[coords.length - 1][0]
        currentLat = coords[coords.length - 1][1]
        lastBearing = calculateBearing(coords[coords.length - 2][0], coords[coords.length - 2][1], currentLng, currentLat)
        
        console.log(`Progress: ${totalDistance.toFixed(0)}m / ${explorationTarget.toFixed(0)}m`)
        
        // Update seed for natural variation
        seed = (seed * 1.618034) % 1
      }
      
      // Return phase: complete the loop
      console.log(`\n--- Return phase ---`)
      console.log(`Current: ${totalDistance.toFixed(0)}m, need ${(targetDistance - totalDistance).toFixed(0)}m more`)
      
      const returnRoute = await getWalkingRoute(currentLng, currentLat, startLng, startLat)
      
      if (!returnRoute) {
        console.log('Failed to generate return route')
        return null
      }
      
      totalDistance += returnRoute.distance
      allCoordinates.push(...returnRoute.geometry.coordinates.slice(1))
      
      console.log(`Final: ${totalDistance.toFixed(0)}m (target: ${targetDistance}m, diff: ${Math.abs(totalDistance - targetDistance).toFixed(0)}m)`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: 0
      }
    }

    // Generate route with early termination for speed
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = 500 // Maximum 500m tolerance
    
    console.log(`Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m`)
    
    // Reduced attempts for faster generation
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const seed = (Date.now() + attempt * 1337 + Math.random() * 1000) % 10000 / 10000
        console.log(`\n--- Attempt ${attempt + 1}/5 ---`)
        
        const route = await generateOrganicLoop(targetDistanceMeters, seed)
        
        if (!route) {
          console.log('No route generated')
          continue
        }
        
        const distanceDiff = Math.abs(route.distance - targetDistanceMeters)
        console.log(`Route: ${route.distance.toFixed(0)}m (diff: ${distanceDiff.toFixed(0)}m)`)
        
        // Early termination: use first route within tolerance
        if (distanceDiff <= tolerance) {
          console.log('✓ Within tolerance - using this route immediately')
          bestRoute = route
          bestDistanceDiff = distanceDiff
          break
        }
        
        // Otherwise keep the closest one
        if (distanceDiff < bestDistanceDiff) {
          bestRoute = route
          bestDistanceDiff = distanceDiff
          console.log('✓ New best route')
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