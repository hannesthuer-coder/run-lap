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

    // Generate Strava-style organic loop routes focused on distance accuracy
    const generateOrganicLoop = async (targetDistance, seed = Math.random()) => {
      console.log(`\n=== Generating organic loop (seed: ${seed.toFixed(3)}) ===`)
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      let visitedCoords = new Set()
      
      // Add starting point to visited
      visitedCoords.add(`${startLng.toFixed(5)},${startLat.toFixed(5)}`)
      
      // Exploration phase: build route naturally until we've covered ~75% of target distance
      const explorationTarget = targetDistance * 0.75
      
      console.log(`Exploration target: ${explorationTarget}m`)
      
      while (totalDistance < explorationTarget) {
        const remainingDistance = explorationTarget - totalDistance
        
        // Dynamic segment distance: shorter segments when closer to target
        const segmentTarget = Math.min(
          remainingDistance * (0.3 + seed * 0.4), // 30-70% of remaining
          targetDistance * 0.25 // Never more than 25% of total in one segment
        )
        
        let bestRoute = null
        let bestDistance = 0
        
        // Try multiple directions for natural exploration
        const directions = [
          seed * 360, // Random primary direction
          (seed * 360 + 90) % 360, // Perpendicular options
          (seed * 360 + 180) % 360,
          (seed * 360 + 270) % 360,
          (seed * 360 + 45) % 360, // Diagonal options
          (seed * 360 + 135) % 360
        ]
        
        for (const direction of directions) {
          // Try different distances for this direction
          for (const distanceRatio of [0.8, 1.0, 1.2]) {
            const segmentDistanceKm = (segmentTarget * distanceRatio) / 1000
            const waypoint = findPointInDirection(currentLng, currentLat, direction, segmentDistanceKm)
            
            // Skip if we've been too close to this area
            const waypointKey = `${waypoint.lng.toFixed(5)},${waypoint.lat.toFixed(5)}`
            if (visitedCoords.has(waypointKey)) continue
            
            const testRoute = await getWalkingRoute(currentLng, currentLat, waypoint.lng, waypoint.lat)
            
            if (testRoute && testRoute.distance > 100) { // Minimum 100m segments
              // Check if this would be too close to existing route (prevent backtracking)
              const routeCoords = testRoute.geometry.coordinates
              let tooClose = false
              
              for (const coord of routeCoords.slice(0, -1)) { // Don't check endpoint
                const coordKey = `${coord[0].toFixed(5)},${coord[1].toFixed(5)}`
                if (visitedCoords.has(coordKey)) {
                  tooClose = true
                  break
                }
              }
              
              if (!tooClose && testRoute.distance > bestDistance) {
                bestRoute = testRoute
                bestDistance = testRoute.distance
                console.log(`Found route: ${direction.toFixed(0)}° for ${testRoute.distance.toFixed(0)}m`)
              }
            }
          }
        }
        
        if (!bestRoute) {
          console.log('No valid exploration route found')
          break
        }
        
        // Add route and mark coordinates as visited
        totalDistance += bestRoute.distance
        const coords = bestRoute.geometry.coordinates
        allCoordinates.push(...coords.slice(1))
        
        // Mark route coordinates as visited
        for (const coord of coords) {
          visitedCoords.add(`${coord[0].toFixed(5)},${coord[1].toFixed(5)}`)
        }
        
        // Update current position
        currentLng = coords[coords.length - 1][0]
        currentLat = coords[coords.length - 1][1]
        
        console.log(`Exploration progress: ${totalDistance.toFixed(0)}m / ${explorationTarget.toFixed(0)}m`)
        
        // Update seed for next iteration to ensure variety
        seed = (seed * 1.618034) % 1 // Golden ratio for good distribution
      }
      
      // Return phase: complete the loop
      console.log(`\n--- Return phase ---`)
      console.log(`Current distance: ${totalDistance.toFixed(0)}m, need ${(targetDistance - totalDistance).toFixed(0)}m more`)
      
      const returnRoute = await getWalkingRoute(currentLng, currentLat, startLng, startLat)
      
      if (!returnRoute) {
        console.log('Failed to generate return route')
        return null
      }
      
      totalDistance += returnRoute.distance
      allCoordinates.push(...returnRoute.geometry.coordinates.slice(1))
      
      console.log(`Final total: ${totalDistance.toFixed(0)}m (target: ${targetDistance}m, diff: ${Math.abs(totalDistance - targetDistance).toFixed(0)}m)`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: 0
      }
    }

    // Generate multiple route variations focused on distance accuracy
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = 500 // Maximum 500m tolerance as requested
    
    console.log(`Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m`)
    
    // Try different route generation strategies
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const seed = (Date.now() + attempt * 1337 + Math.random() * 1000) % 10000 / 10000
        console.log(`\n--- Attempt ${attempt + 1}/10 ---`)
        
        const route = await generateOrganicLoop(targetDistanceMeters, seed)
        
        if (!route) {
          console.log('No route generated')
          continue
        }
        
        const distanceDiff = Math.abs(route.distance - targetDistanceMeters)
        console.log(`Route: ${route.distance.toFixed(0)}m (diff: ${distanceDiff.toFixed(0)}m)`)
        
        // Always prefer routes within tolerance
        if (distanceDiff <= tolerance) {
          console.log('✓ Within tolerance - using this route')
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
      throw new Error('Could not generate any valid route after 10 attempts')
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