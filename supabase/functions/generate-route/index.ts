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
    
    // Get Mapbox token - use hardcoded token as fallback since secret access isn't working
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN') || 'pk.eyJ1IjoiaGFubmVzdGh1cjEyMyIsImEiOiJjbWVpdmk4cmUwN3YwMmxzZDNtcjF2em54In0.kkCEFz-Lg2PQoLD-OTJp6Q'
    
    console.log(`Using Mapbox token: ${MAPBOX_TOKEN ? 'Token available' : 'No token found'}`)
    
    if (!MAPBOX_TOKEN) {
      console.error('No Mapbox access token available')
      throw new Error('Mapbox access token not configured')
    }
    
    // Convert distance to meters
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    
    // Progressive path building algorithm
    const generateProgressivePath = (targetDistance, seed = Math.random()) => {
      const waypoints = []
      
      // Pick an initial direction (north, south, east, west, or diagonal)
      const initialDirection = seed * 360 // Random direction in degrees
      
      // Calculate how many waypoints we need based on target distance
      // Space them every 800-1200m for natural routing
      const waypointSpacing = 800 + (seed * 400) // 800-1200m between waypoints
      const numWaypoints = Math.max(3, Math.floor(targetDistance / waypointSpacing))
      
      console.log(`Generating ${numWaypoints} waypoints with ${waypointSpacing}m spacing for ${targetDistance}m target`)
      
      let currentLat = startLat
      let currentLng = startLng
      let currentDirection = initialDirection
      let totalDistance = 0
      
      // Build path progressively
      for (let i = 0; i < numWaypoints; i++) {
        const progress = i / (numWaypoints - 1)
        
        // Distance for this segment
        const segmentDistance = waypointSpacing
        
        // Start curving back when we're about 60% through
        if (progress > 0.6) {
          // Calculate direction back to start
          const deltaLat = startLat - currentLat
          const deltaLng = startLng - currentLng
          const directionToStart = Math.atan2(deltaLng, deltaLat) * (180 / Math.PI)
          
          // Gradually curve toward start direction
          const curveStrength = (progress - 0.6) / 0.4 // 0 to 1 as we approach end
          currentDirection = currentDirection + (directionToStart - currentDirection) * curveStrength * 0.3
        } else {
          // Add some natural variation to direction
          const variation = (Math.sin(i * 0.7 + seed * Math.PI) * 30) // ±30 degrees variation
          currentDirection += variation * (1 - progress) // Less variation as we approach return phase
        }
        
        // Convert direction and distance to lat/lng offset
        // 1 degree lat ≈ 111km, 1 degree lng ≈ 111km * cos(lat)
        const distanceInKm = segmentDistance / 1000
        const latOffset = (distanceInKm / 111) * Math.cos(currentDirection * Math.PI / 180)
        const lngOffset = (distanceInKm / (111 * Math.cos(currentLat * Math.PI / 180))) * Math.sin(currentDirection * Math.PI / 180)
        
        currentLat += latOffset
        currentLng += lngOffset
        totalDistance += segmentDistance
        
        waypoints.push([currentLng, currentLat])
        
        console.log(`Waypoint ${i + 1}: [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}], direction: ${currentDirection.toFixed(1)}°`)
      }
      
      console.log(`Generated ${waypoints.length} waypoints, estimated total: ${totalDistance}m`)
      return waypoints
    }
    
    // Function to calculate bearing between two points
    const calculateBearing = (lat1, lng1, lat2, lng2) => {
      const dLng = (lng2 - lng1) * Math.PI / 180
      const lat1Rad = lat1 * Math.PI / 180
      const lat2Rad = lat2 * Math.PI / 180
      
      const y = Math.sin(dLng) * Math.cos(lat2Rad)
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
      
      const bearing = Math.atan2(y, x) * 180 / Math.PI
      return (bearing + 360) % 360
    }

    // Simplified validation: check for natural flow and avoid sharp reversals
    const validateNaturalFlow = (coordinates) => {
      if (coordinates.length < 15) return true // Too short to validate properly
      
      const bearings = []
      const checkPoints = Math.min(20, Math.floor(coordinates.length / 3)) // Check fewer points for speed
      
      // Calculate bearings at intervals throughout the route
      for (let i = 0; i < coordinates.length - 5; i += Math.floor(coordinates.length / checkPoints)) {
        if (i + 5 < coordinates.length) {
          const bearing = calculateBearing(
            coordinates[i][1], coordinates[i][0],
            coordinates[i + 5][1], coordinates[i + 5][0]
          )
          bearings.push(bearing)
        }
      }
      
      // Check for sharp directional reversals (U-turns)
      let sharpReversals = 0
      for (let i = 1; i < bearings.length - 1; i++) {
        const prevBearing = bearings[i - 1]
        const currBearing = bearings[i]
        const nextBearing = bearings[i + 1]
        
        // Calculate bearing changes
        const change1 = Math.abs(((currBearing - prevBearing + 540) % 360) - 180)
        const change2 = Math.abs(((nextBearing - currBearing + 540) % 360) - 180)
        
        // Detect sharp U-turn pattern
        if (change1 > 120 && change2 > 120) {
          sharpReversals++
        }
      }
      
      // Reject routes with too many sharp reversals
      const maxReversals = Math.ceil(bearings.length * 0.2) // Allow up to 20% sharp turns
      if (sharpReversals > maxReversals) {
        console.log(`Route rejected: ${sharpReversals} sharp reversals (max: ${maxReversals})`)
        return false
      }
      
      return true
    }

    // Function to fetch route from Mapbox with natural loop preferences
    const fetchNaturalRoute = async (waypoints, startPoint = null) => {
      let routeCoordinates
      
      if (startPoint) {
        // Start from specific point, visit waypoints, return to start
        routeCoordinates = `${startPoint[0]},${startPoint[1]};` + 
          waypoints.map(w => `${w[0]},${w[1]}`).join(';') + 
          `;${startPoint[0]},${startPoint[1]}`
      } else {
        // Create natural loop through waypoints
        routeCoordinates = waypoints.map(w => `${w[0]},${w[1]}`).join(';') + 
          `;${waypoints[0][0]},${waypoints[0][1]}` // Return to first waypoint
      }
      
      // Optimize for natural walking paths and smooth turns
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${routeCoordinates}?` + 
        `geometries=geojson&` +
        `access_token=${MAPBOX_TOKEN}&` +
        `overview=full&` +
        `steps=true&` +
        `continue_straight=false&` + // Allow natural turns at intersections
        `waypoint_snapping=any&` + // Snap to nearest routable point
        `annotations=distance,duration` // Get detailed information
      
      const response = await fetch(directionsUrl)
      const data = await response.json()
      
      if (!data.routes || data.routes.length === 0) {
        console.log('No route found for waypoints')
        return null
      }
      
      const route = data.routes[0]
      
      // Validate natural flow instead of complex backtracking detection
      if (!validateNaturalFlow(route.geometry.coordinates)) {
        console.log('Route rejected due to poor flow')
        return null
      }
      
      return route
    }
    
    // Natural loop generation settings
    let bestRoute = null
    let bestWaypoints = null
    let bestDistanceDiff = Infinity
    const tolerance = 800 // Slightly more tolerant for natural loops
    const maxAttempts = 8 // Try different patterns and approaches
    
    // Estimate base distance for loop generation
    let baseDistance = targetDistanceMeters
    
    // Generate a unique seed based on timestamp and random for maximum variation
    const routeSeed = (Date.now() % 10000) / 10000 + Math.random()
    
    console.log(`Target distance: ${targetDistanceMeters}m, Tolerance: ${tolerance}m`)
    console.log(`Starting coordinate distance: ${(targetDistanceMeters / 1000) / 111} degrees`)
    
    // Try progressive path building with different variations
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const attemptSeed = (routeSeed + attempt * 0.3) % 1
      
      let route = null
      let waypoints = null
      
      try {
        // Generate progressive path that builds naturally from start location
        waypoints = generateProgressivePath(baseDistance, attemptSeed)
        
        // Create route that starts and ends at the original location
        route = await fetchNaturalRoute(waypoints, [startLng, startLat])
        
        console.log(`Attempt ${attempt + 1}: Generated ${waypoints.length} waypoints`)
        
        if (!route) {
          console.log(`Attempt ${attempt + 1}: No valid route found`)
          // Adjust base distance for next attempt
          baseDistance *= (0.8 + Math.random() * 0.4)
          continue
        }
        
        const routeDistance = route.distance
        const distanceDiff = Math.abs(routeDistance - targetDistanceMeters)
        
        console.log(`Attempt ${attempt + 1}: Route distance: ${routeDistance}m, Target: ${targetDistanceMeters}m, Diff: ${distanceDiff}m`)
        
        // Keep track of the best route so far
        if (distanceDiff < bestDistanceDiff) {
          bestRoute = route
          bestWaypoints = waypoints
          bestDistanceDiff = distanceDiff
        }
        
        // Accept route within tolerance immediately
        if (distanceDiff <= tolerance) {
          console.log(`Found acceptable route within ${tolerance}m tolerance on attempt ${attempt + 1}`)
          break
        }
        
        // Adjust base distance based on results for next attempt
        const adjustmentFactor = Math.min(distanceDiff / targetDistanceMeters, 0.3)
        
        if (routeDistance < targetDistanceMeters) {
          baseDistance *= (1 + adjustmentFactor)
        } else {
          baseDistance *= (1 - adjustmentFactor)
        }
        
      } catch (error) {
        console.log(`Attempt ${attempt + 1} failed: ${error.message}`)
        // Try different base distance
        baseDistance *= (0.7 + Math.random() * 0.6)
      }
    }
    
    // Reject routes that exceed tolerance
    if (!bestRoute || bestDistanceDiff > tolerance) {
      const errorMsg = bestRoute ? 
        `Could not generate route within ${tolerance}m tolerance. Best attempt was ${Math.round(bestDistanceDiff)}m off target.` :
        'Could not generate a suitable route'
      throw new Error(errorMsg)
    }
    
    console.log(`Final route distance: ${bestRoute.distance}m vs target: ${targetDistanceMeters}m`)
    const route = bestRoute
    const waypoints = bestWaypoints
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
          waypoints: waypoints
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