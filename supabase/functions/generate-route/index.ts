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
    
    // Validate inputs
    if (!startLng || !startLat || !distance || !unit) {
      throw new Error('Missing required parameters')
    }
    
    if (typeof startLng !== 'number' || typeof startLat !== 'number' || typeof distance !== 'number') {
      throw new Error('Invalid parameter types')
    }
    
    if (distance <= 0 || distance > 500) {
      throw new Error('Distance must be between 0 and 500')
    }
    
    if (!['km', 'miles'].includes(unit)) {
      throw new Error('Unit must be km or miles')
    }
    
    // Get auth token from request header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check route limit - query last 30 days
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: routeGenerations, error: countError } = await supabase
      .from('route_generations')
      .select('id', { count: 'exact', head: false })
      .eq('user_id', user.id)
      .gte('created_at', last30Days)
    
    if (countError) {
      console.error('Error checking route limit:', countError)
    }
    
    const routeCount = routeGenerations?.length || 0
    
    // Check subscription status
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_expires_at')
      .eq('id', user.id)
      .single()
    
    const hasActiveSubscription = profile?.subscription_status === 'premium' && 
      profile?.subscription_expires_at && 
      new Date(profile.subscription_expires_at) > new Date()
    
    // Enforce 3 route limit for free users
    if (!hasActiveSubscription && routeCount >= 3) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Route limit reached',
          limit: 3,
          used: routeCount,
          requiresUpgrade: true
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN')
    
    if (!MAPBOX_TOKEN) {
      throw new Error('Mapbox token not configured')
    }
    
    console.log(`Using Mapbox token: ${MAPBOX_TOKEN ? 'Available' : 'Missing'}`)
    
    // Convert distance to meters
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34
    console.log(`Target distance: ${targetDistanceMeters}m`)

    // Helper function to calculate bearing between two points (in degrees)
    const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const dLng = (lng2 - lng1) * Math.PI / 180
      const lat1Rad = lat1 * Math.PI / 180
      const lat2Rad = lat2 * Math.PI / 180
      
      const y = Math.sin(dLng) * Math.cos(lat2Rad)
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
      
      const bearing = Math.atan2(y, x) * 180 / Math.PI
      return (bearing + 360) % 360
    }

    // Helper function to calculate distance between two points (in meters)
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371000 // Earth radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLng = (lng2 - lng1) * Math.PI / 180
      
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2)
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    }

    // Helper function to calculate normalized angle difference
    const angleDifference = (angle1: number, angle2: number): number => {
      let diff = Math.abs(angle1 - angle2)
      if (diff > 180) {
        diff = 360 - diff
      }
      return diff
    }

    // Function to remove spikes from route coordinates
    const removeSpikesFromRoute = (coordinates: [number, number][]) => {
      let cleanedCoords = [...coordinates]
      let totalSpikesRemoved = 0
      let originalDistance = 0
      
      // Calculate original distance
      for (let i = 0; i < cleanedCoords.length - 1; i++) {
        originalDistance += calculateDistance(
          cleanedCoords[i][1], cleanedCoords[i][0],
          cleanedCoords[i + 1][1], cleanedCoords[i + 1][0]
        )
      }
      
      // Multi-pass spike removal (up to 3 passes)
      for (let pass = 0; pass < 3; pass++) {
        let foundSpike = false
        let i = 1
        
        while (i < cleanedCoords.length - 2) {
          const pointBefore = cleanedCoords[i - 1]
          const currentPoint = cleanedCoords[i]
          
          // Look ahead up to 5 points to find potential spike end
          let maxLookAhead = Math.min(i + 5, cleanedCoords.length - 1)
          
          for (let j = i + 1; j <= maxLookAhead; j++) {
            const pointAfter = cleanedCoords[j]
            
            // Calculate bearings
            const bearingIn = calculateBearing(
              pointBefore[1], pointBefore[0],
              currentPoint[1], currentPoint[0]
            )
            const bearingOut = calculateBearing(
              currentPoint[1], currentPoint[0],
              pointAfter[1], pointAfter[0]
            )
            
            // Check for ~180° reversal (spike indicator)
            const angleDiff = angleDifference(bearingIn, bearingOut)
            
            if (angleDiff > 150 && angleDiff < 210) {
              // Potential spike detected - verify with distance ratio
              const straightLineDist = calculateDistance(
                pointBefore[1], pointBefore[0],
                pointAfter[1], pointAfter[0]
              )
              
              // Calculate path distance through the spike
              let pathDist = 0
              for (let k = i - 1; k < j; k++) {
                pathDist += calculateDistance(
                  cleanedCoords[k][1], cleanedCoords[k][0],
                  cleanedCoords[k + 1][1], cleanedCoords[k + 1][0]
                )
              }
              
              // If path is much longer than straight line, it's a spike
              const ratio = straightLineDist > 0 ? pathDist / straightLineDist : 0
              
              if (ratio > 2.5) {
                // Remove spike points (from i to j-1)
                console.log(`  Spike detected at index ${i}: angle=${angleDiff.toFixed(1)}°, ratio=${ratio.toFixed(2)}, removing ${j - i} points`)
                cleanedCoords.splice(i, j - i)
                totalSpikesRemoved++
                foundSpike = true
                break
              }
            }
          }
          
          if (!foundSpike) {
            i++
          } else {
            // Reset i after spike removal to check the same area again
            foundSpike = false
          }
        }
        
        if (totalSpikesRemoved === 0 && pass === 0) {
          // No spikes found in first pass, no need to continue
          break
        }
      }
      
      // Calculate new distance after spike removal
      let newDistance = 0
      for (let i = 0; i < cleanedCoords.length - 1; i++) {
        newDistance += calculateDistance(
          cleanedCoords[i][1], cleanedCoords[i][0],
          cleanedCoords[i + 1][1], cleanedCoords[i + 1][0]
        )
      }
      
      return {
        coordinates: cleanedCoords,
        totalDistance: newDistance,
        spikesRemoved: totalSpikesRemoved,
        distanceSaved: originalDistance - newDistance
      }
    }

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

    // Smart route generation with road factor compensation
    const createNaturalLoop = async (targetDistance, seed = Math.random(), attempt = 1) => {
      console.log(`\n=== Creating natural loop (seed: ${seed.toFixed(3)}, attempt: ${attempt}) ===`)
      
      // Road factor compensation - actual walking routes are 1.4-1.7x longer than geometric
      let roadFactor = 0.65; // Start conservatively 
      
      // Adjust road factor based on previous attempts
      if (attempt > 1) {
        roadFactor = 0.5 + (attempt * 0.05); // Get more aggressive: 0.55, 0.60, 0.65, 0.70...
      }
      
      const compensatedTarget = targetDistance * roadFactor;
      console.log(`Target: ${targetDistance}m, Compensated: ${compensatedTarget.toFixed(0)}m (road factor: ${roadFactor.toFixed(2)})`)
      
      // Choose initial direction
      const baseDirection = 45 + (seed * 270) // 45-315 degrees
      console.log(`Initial direction: ${baseDirection.toFixed(1)}°`)
      
      let totalDistance = 0
      let allCoordinates = [[startLng, startLat]]
      let currentLng = startLng
      let currentLat = startLat
      let currentBearing = baseDirection
      
      // Vary segment count based on attempt - simpler shapes for later attempts
      const segments = Math.max(3, 6 - Math.floor(attempt / 2)); // 5,5,4,4,3,3...
      const segmentDistance = compensatedTarget / segments
      const turnAngle = 360 / segments
      
      console.log(`Creating ${segments} segments of ~${segmentDistance.toFixed(0)}m each with ${turnAngle.toFixed(1)}° turns`)
      
      for (let i = 0; i < segments; i++) {
        // Reduce variation for later attempts to be more predictable
        const maxVariation = Math.max(0.1, 0.3 - (attempt * 0.05));
        const variation = (seed - 0.5) * maxVariation;
        const thisSegmentDistance = segmentDistance * (1 + variation)
        const thisSegmentDistanceKm = thisSegmentDistance / 1000
        
        console.log(`Segment ${i + 1}: Direction ${currentBearing.toFixed(1)}° for ${thisSegmentDistance.toFixed(0)}m`)
        
        // Find the endpoint for this segment
        const segmentPoint = findPointInDirection(currentLng, currentLat, currentBearing, thisSegmentDistanceKm)
        
        // Get the route for this segment
        const segmentRoute = await getWalkingRoute(currentLng, currentLat, segmentPoint.lng, segmentPoint.lat)
        
        if (!segmentRoute) {
          console.log(`Failed to get segment ${i + 1} route`)
          return null
        }
        
        // Add this segment to the total route
        totalDistance += segmentRoute.distance
        allCoordinates.push(...segmentRoute.geometry.coordinates.slice(1))
        
        // Update current position to the end of this segment
        const coords = segmentRoute.geometry.coordinates
        currentLng = coords[coords.length - 1][0]
        currentLat = coords[coords.length - 1][1]
        
        console.log(`After segment ${i + 1}: ${totalDistance.toFixed(0)}m covered, at [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}]`)
        
        // Turn for the next segment (except on the last segment)
        if (i < segments - 1) {
          // Reduce turn variation for later attempts
          const turnVariation = Math.max(5, 20 - (attempt * 3));
          currentBearing = (currentBearing + turnAngle + (seed - 0.5) * turnVariation) % 360
        }
      }
      
      // Final segment back to start
      console.log(`Final segment: Returning to start from [${currentLng.toFixed(6)}, ${currentLat.toFixed(6)}]`)
      
      const returnRoute = await getWalkingRoute(currentLng, currentLat, startLng, startLat)
      
      if (!returnRoute) {
        console.log('Failed to get return route')
        return null
      }
      
      totalDistance += returnRoute.distance
      allCoordinates.push(...returnRoute.geometry.coordinates.slice(1))
      
      const actualRoadFactor = totalDistance / compensatedTarget;
      console.log(`Final: ${totalDistance}m, Compensated target: ${compensatedTarget.toFixed(0)}m, Actual road factor: ${actualRoadFactor.toFixed(2)}`)
      console.log(`Distance from real target: ${Math.abs(totalDistance - targetDistance)}m`)
      
      return {
        coordinates: allCoordinates,
        distance: totalDistance,
        duration: 0,
        roadFactor: actualRoadFactor
      }
    }

    // Try multiple variations with progressive improvement
    let bestRoute = null
    let bestDistanceDiff = Infinity
    const tolerance = 500 // STRICT ±500m tolerance
    
    console.log(`Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m (STRICT ENFORCEMENT)`)
    
    // Progressive attempts with different strategies
    for (let attempt = 1; attempt <= 15; attempt++) {
      try {
        const seed = (Date.now() + attempt * 1000) % 10000 / 10000
        console.log(`\n--- Attempt ${attempt}/15 ---`)
        
        const route = await createNaturalLoop(targetDistanceMeters, seed, attempt)
        
        if (!route) {
          console.log('No route generated')
          continue
        }
        
        const distanceDiff = Math.abs(route.distance - targetDistanceMeters)
        console.log(`Route: ${route.distance}m (diff: ${distanceDiff}m, road factor: ${route.roadFactor.toFixed(2)})`)
        
        // Track best route even if outside tolerance for potential fallback
        if (distanceDiff < bestDistanceDiff) {
          bestRoute = route
          bestDistanceDiff = distanceDiff
          console.log('✓ New best route')
        }
        
        // Accept routes within strict tolerance
        if (distanceDiff <= tolerance) {
          console.log('✓ Route within ±500m tolerance - ACCEPTED')
          bestRoute = route
          bestDistanceDiff = distanceDiff
          break
        } else {
          console.log(`✗ Route outside tolerance (${distanceDiff}m > ${tolerance}m) - REJECTED`)
        }
        
        // Early exit if we're getting close (within 100m extra tolerance after attempt 10)
        if (attempt > 10 && distanceDiff <= tolerance + 100) {
          console.log(`✓ Close enough after ${attempt} attempts - ACCEPTED (${distanceDiff}m tolerance)`)
          break
        }
        
      } catch (error) {
        console.log(`Attempt ${attempt} failed: ${error.message}`)
      }
    }
    
    // Enforce tolerance with a small grace period for very close results
    const finalTolerance = tolerance + (bestDistanceDiff > tolerance ? 0 : 0); // No grace period
    if (!bestRoute || bestDistanceDiff > finalTolerance) {
      const message = bestRoute 
        ? `Could not generate route within ±${tolerance}m tolerance. Best attempt was ${bestDistanceDiff.toFixed(0)}m off target (${bestRoute.distance.toFixed(0)}m vs ${targetDistanceMeters}m target). Try a different location or distance.`
        : 'Could not generate any valid route after 15 attempts'
      throw new Error(message)
    }
    
    console.log(`\n🎯 ACCEPTED route: ${bestRoute.distance}m (${bestDistanceDiff.toFixed(0)}m from target - within tolerance)`)
    
    // Remove spikes from the route before returning
    const cleanedResult = removeSpikesFromRoute(bestRoute.coordinates)
    console.log(`🔧 Spike removal: ${cleanedResult.spikesRemoved} spikes removed, ${cleanedResult.distanceSaved.toFixed(0)}m saved`)
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: {
            type: 'LineString',
            coordinates: cleanedResult.coordinates
          },
          distance: cleanedResult.totalDistance,
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