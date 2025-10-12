import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { startLng, startLat, distance, unit } = await req.json();
    
    // Validate inputs
    if (!startLng || !startLat || !distance || !unit) {
      throw new Error('Missing required parameters');
    }

    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    
    if (!MAPBOX_TOKEN) {
      throw new Error('MAPBOX_ACCESS_TOKEN not configured');
    }

    console.log(`🎯 Generating ${distance}${unit} route at [${startLat}, ${startLng}]`);
    
    // Convert distance to meters
    const targetDistanceMeters = unit === 'km' ? distance * 1000 : distance * 1609.34;
    
    /**
     * Generate smooth circular route with optimal waypoints
     * KEY IMPROVEMENT: Fixed 4 waypoints + single API call = smooth routes
     */
    const generateSmoothRoute = async (
      targetDistance: number,
      seed: number,
      attempt: number
    ) => {
      console.log(`\n=== Attempt ${attempt} (seed: ${seed.toFixed(3)}) ===`);
      
      // Dynamic road factor adjustment based on attempt
      const roadFactor = Math.min(0.55 + (attempt * 0.03), 0.75);
      const compensatedDistance = targetDistance * roadFactor;
      
      console.log(`Target: ${targetDistance}m, Compensated: ${compensatedDistance.toFixed(0)}m (factor: ${roadFactor.toFixed(2)})`);
      
      // Use 4 waypoints for smoothest routes (was 5-6 variable)
      const numWaypoints = 4;
      const radius = (compensatedDistance / (2 * Math.PI)) / 1000; // km
      
      // Generate waypoints in circular pattern with variation
      const baseAngle = seed * 360;
      const waypoints: Array<{ lat: number; lng: number }> = [];
      
      for (let i = 0; i < numWaypoints; i++) {
        const angle = ((baseAngle + (i * 360 / numWaypoints)) % 360) * Math.PI / 180;
        
        // Add slight radius variation (±15%) for natural shapes
        const radiusVariation = radius * (1 + (Math.random() - 0.5) * 0.15);
        
        const lat = startLat + (radiusVariation * Math.cos(angle)) / 111;
        const lng = startLng + (radiusVariation * Math.sin(angle)) / (111 * Math.cos(startLat * Math.PI / 180));
        
        waypoints.push({ lat, lng });
      }
      
      // Build coordinate string for Mapbox Directions API
      const allPoints = [
        { lat: startLat, lng: startLng },
        ...waypoints,
        { lat: startLat, lng: startLng }, // Close the loop
      ];
      
      const coordinatesString = allPoints.map(p => `${p.lng},${p.lat}`).join(';');
      
      // KEY IMPROVEMENT: Single API call with continue_straight=false for natural turns
      const directionsUrl = 
        `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesString}?` +
        `geometries=geojson&` +
        `access_token=${MAPBOX_TOKEN}&` +
        `overview=full&` +
        `continue_straight=false`; // This fixes sharp turns!
      
      const response = await fetch(directionsUrl);
      
      if (!response.ok) {
        console.error(`❌ Mapbox API error: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      if (!data.routes || data.routes.length === 0) {
        console.error('❌ No route found');
        return null;
      }
      
      const route = data.routes[0];
      const actualRoadFactor = route.distance / compensatedDistance;
      
      console.log(`✓ Generated: ${route.distance}m (road factor: ${actualRoadFactor.toFixed(2)})`);
      
      return {
        coordinates: route.geometry.coordinates,
        distance: route.distance,
        duration: route.duration,
      };
    };
    
    // Try multiple attempts to find best route
    let bestRoute = null;
    let bestDistanceDiff = Infinity;
    const tolerance = 500; // ±500m tolerance
    const maxAttempts = 12;
    
    console.log(`🎯 Target: ${targetDistanceMeters}m, Tolerance: ±${tolerance}m`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const seed = (Date.now() + attempt * 1337) % 10000 / 10000;
      
      const route = await generateSmoothRoute(targetDistanceMeters, seed, attempt);
      
      if (!route) {
        console.log(`Attempt ${attempt}: Failed to generate route`);
        continue;
      }
      
      const distanceDiff = Math.abs(route.distance - targetDistanceMeters);
      
      // Track best route
      if (distanceDiff < bestDistanceDiff) {
        bestRoute = route;
        bestDistanceDiff = distanceDiff;
        console.log(`✓ New best: ${route.distance}m (diff: ${distanceDiff}m)`);
      }
      
      // Accept if within tolerance
      if (distanceDiff <= tolerance) {
        console.log(`✅ Accepted within tolerance`);
        break;
      }
      
      // Be more lenient after 8 attempts
      if (attempt > 8 && distanceDiff <= tolerance + 200) {
        console.log(`✅ Accepted with extended tolerance`);
        break;
      }
    }
    
    // Validate final route
    if (!bestRoute) {
      throw new Error('Could not generate valid route after maximum attempts');
    }
    
    const finalTolerance = tolerance + 200;
    if (bestDistanceDiff > finalTolerance) {
      throw new Error(
        `Best route was ${bestDistanceDiff.toFixed(0)}m off target. ` +
        `Try a different distance or location.`
      );
    }
    
    console.log(`\n🎉 Final route: ${bestRoute.distance}m (±${bestDistanceDiff.toFixed(0)}m)`);
    
    return new Response(
      JSON.stringify({
        success: true,
        route: {
          geometry: {
            type: 'LineString',
            coordinates: bestRoute.coordinates,
          },
          distance: bestRoute.distance,
          duration: bestRoute.duration,
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
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