const axios = require('axios');

/**
 * Calculate haversine distance between two points in kilometers
 * @param {Array} coords1 
 * @param {Array} coords2
 * @returns {number} 
 */
function haversineDistance(coords1, coords2) {
  const [lat1, lon1] = coords1;
  const [lat2, lon2] = coords2;
 
  const R = 6371; 
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
 
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
 
  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} 
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Cache for OSRM distance results to avoid duplicate API calls
const distanceCache = new Map();

/**
 * Generate a unique key for caching distance calculations
 */
function getDistanceCacheKey(startCoords, endCoords) {
  return `${startCoords[0]},${startCoords[1]}_${endCoords[0]},${endCoords[1]}`;
}

/**
 * Calculate distance using OSRM service with optimized API usage
 * @param {Array} startCoords
 * @param {Array} endCoords 
 * @param {number} maxHaversineThreshold
 * @returns {Promise<number>} 
 */
async function getDistanceFromOSRM(startCoords, endCoords, maxHaversineThreshold = 30) {
  try {
    const cacheKey = getDistanceCacheKey(startCoords, endCoords);
    if (distanceCache.has(cacheKey)) {
      return distanceCache.get(cacheKey);
    }
    
    const haversineDistanceValue = haversineDistance(startCoords, endCoords);
    
    if (haversineDistanceValue > maxHaversineThreshold) {
      distanceCache.set(cacheKey, haversineDistanceValue);
      return haversineDistanceValue;
    }
    
    const [startLat, startLon] = startCoords;
    const [endLat, endLon] = endCoords;
   
    const url = `http://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=false`;
   
    const response = await axios.get(url);

    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const distance = response.data.routes[0].distance / 1000;
      distanceCache.set(cacheKey, distance);
      return distance;
    }
   
    distanceCache.set(cacheKey, haversineDistanceValue);
    return haversineDistanceValue;
  } catch (error) {
    console.warn('Error using OSRM service, falling back to haversine distance:', error.message);
    const haversineDistanceValue = haversineDistance(startCoords, endCoords);
    distanceCache.set(getDistanceCacheKey(startCoords, endCoords), haversineDistanceValue);
    return haversineDistanceValue;
  }
}

// Helper function to calculate total minutes from a time string (HH:MM)
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to check if a time is within a time range
function isTimeInRange(time, startTime, endTime) {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

module.exports = {
  haversineDistance,
  toRadians,
  getDistanceFromOSRM,
  timeToMinutes,
  isTimeInRange
};