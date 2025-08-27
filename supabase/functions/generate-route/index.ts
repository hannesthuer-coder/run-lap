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
    
    // Function to generate natural loop patterns using directional exploration
    const generateNaturalLoop = (baseDistance, seed = Math.random(), pattern = 'oval') => {
      const waypoints = []
      
      // Choose loop pattern based on seed and pattern preference
      const patterns = ['oval', 'figure8', 'rectangle', 'organic']
      const selectedPattern = patterns[Math.floor(seed * patterns.length)] || pattern
      
      // Estimate rough coordinate distance (very approximate)
      const coordDistance = baseDistance * 0.000009 // rough conversion for lat/lng
      
      switch (selectedPattern) {
        case 'oval':
          return generateOvalLoop(startLat, startLng, coordDistance, seed)
        case 'figure8':
          return generateFigure8Loop(startLat, startLng, coordDistance, seed)
        case 'rectangle':
          return generateRectangleLoop(startLat, startLng, coordDistance, seed)
        case 'organic':
        default:
          return generateOrganicLoop(startLat, startLng, coordDistance, seed)
      }
    }

    // Generate oval-shaped loop
    const generateOvalLoop = (lat, lng, distance, seed) => {
      const waypoints = []
      const numPoints = 6 + Math.floor(seed * 4) // 6-9 waypoints
      const clockwise = seed > 0.5
      
      // Create oval by varying the radius along the ellipse
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI * (clockwise ? 1 : -1)
        
        // Oval shape: wider in one direction
        const radiusX = distance * (0.6 + 0.4 * Math.cos(seed * Math.PI))
        const radiusY = distance * (0.4 + 0.3 * Math.sin(seed * Math.PI))
        
        const offsetLat = lat + radiusY * Math.cos(angle)
        const offsetLng = lng + radiusX * Math.sin(angle)
        
        waypoints.push([offsetLng, offsetLat])
      }
      return waypoints
    }

    // Generate figure-8 shaped loop
    const generateFigure8Loop = (lat, lng, distance, seed) => {
      const waypoints = []
      const numPoints = 8
      
      for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * 2 * Math.PI
        
        // Figure-8 parametric equations
        const scale = distance * 0.5
        const offsetLat = lat + scale * Math.sin(t)
        const offsetLng = lng + scale * Math.sin(t) * Math.cos(t)
        
        waypoints.push([offsetLng, offsetLat])
      }
      return waypoints
    }

    // Generate rectangle/square shaped loop
    const generateRectangleLoop = (lat, lng, distance, seed) => {
      const waypoints = []
      const width = distance * (0.7 + 0.3 * seed)
      const height = distance * (0.7 + 0.3 * (1 - seed))
      
      // Create rectangle corners with some randomness
      const corners = [
        [lng - width/2, lat + height/2], // top-left
        [lng + width/2, lat + height/2], // top-right  
        [lng + width/2, lat - height/2], // bottom-right
        [lng - width/2, lat - height/2]  // bottom-left
      ]
      
      // Add intermediate points for more natural routing
      corners.forEach((corner, i) => {
        waypoints.push(corner)
        // Add midpoint to next corner
        const nextCorner = corners[(i + 1) % corners.length]
        const midLng = (corner[0] + nextCorner[0]) / 2
        const midLat = (corner[1] + nextCorner[1]) / 2
        waypoints.push([midLng, midLat])
      })
      
      return waypoints
    }

    // Generate organic/natural shaped loop
    const generateOrganicLoop = (lat, lng, distance, seed) => {
      const waypoints = []
      const numPoints = 5 + Math.floor(seed * 4) // 5-8 waypoints
      const clockwise = seed > 0.5
      
      // Create organic shape with varying radius and some randomness
      for (let i = 0; i < numPoints; i++) {
        const baseAngle = (i / numPoints) * 2 * Math.PI * (clockwise ? 1 : -1)
        
        // Add organic variation
        const angleNoise = (Math.sin(i * 1.3 + seed * Math.PI) * 0.3)
        const angle = baseAngle + angleNoise
        
        // Varying radius for organic shape
        const baseRadius = distance * (0.5 + 0.3 * Math.sin(i * 0.7 + seed * Math.PI * 2))
        const radiusNoise = distance * 0.1 * Math.cos(i * 1.1 + seed * Math.PI)
        const radius = baseRadius + radiusNoise
        
        const offsetLat = lat + radius * Math.cos(angle)
        const offsetLng = lng + radius * Math.sin(angle)
        
        waypoints.push([offsetLng, offsetLat])
      }
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
    
    // Try different approaches for natural loop generation
    const approaches = [
      { type: 'waypoint_loop', startFromOriginal: false },
      { type: 'start_centered', startFromOriginal: true },
      { type: 'mixed_pattern', startFromOriginal: false }
    ]
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const approach = approaches[attempt % approaches.length]
      const attemptSeed = (routeSeed + attempt * 0.3) % 1
      
      let route = null
      let waypoints = null
      
      try {
        if (approach.type === 'waypoint_loop') {
          // Generate loop through natural waypoints (start can be anywhere on loop)
          waypoints = generateNaturalLoop(baseDistance, attemptSeed)
          route = await fetchNaturalRoute(waypoints)
        } else if (approach.type === 'start_centered') {
          // Traditional approach but with natural patterns
          waypoints = generateNaturalLoop(baseDistance, attemptSeed)
          route = await fetchNaturalRoute(waypoints, [startLng, startLat])
        } else {
          // Mixed: try different loop patterns
          const patterns = ['oval', 'organic', 'rectangle', 'figure8']
          const pattern = patterns[attempt % patterns.length]
          waypoints = generateNaturalLoop(baseDistance, attemptSeed, pattern)
          route = await fetchNaturalRoute(waypoints, attempt % 2 === 0 ? [startLng, startLat] : null)
        }
        
        if (!route) {
          console.log(`Attempt ${attempt + 1} (${approach.type}): No valid route found`)
          // Adjust base distance for next attempt
          baseDistance *= (0.8 + Math.random() * 0.4)
          continue
        }
        
        const routeDistance = route.distance
        const distanceDiff = Math.abs(routeDistance - targetDistanceMeters)
        
        console.log(`Attempt ${attempt + 1} (${approach.type}): Route distance: ${routeDistance}m, Target: ${targetDistanceMeters}m, Diff: ${distanceDiff}m`)
        
        // Keep track of the best route so far
        if (distanceDiff < bestDistanceDiff) {
          bestRoute = route
          bestWaypoints = waypoints
          bestDistanceDiff = distanceDiff
        }
        
        // Accept route within tolerance immediately
        if (distanceDiff <= tolerance) {
          console.log(`Found acceptable natural loop within ${tolerance}m tolerance on attempt ${attempt + 1}`)
          break
        }
        
        // Adjust base distance based on results
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