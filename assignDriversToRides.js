const fs = require('fs');
const axios = require('axios');
const { haversineDistance, getDistanceFromOSRM, timeToMinutes, isTimeInRange } = require('./utils');

/**
 * Assign drivers to rides with enhanced constraints and optimization
 * @param {Array} driversData Array of driver objects
 * @param {Array} ridesData Array of ride objects
 * @returns {Object} Assignments and total cost
 */
async function assignDriversToRides(driversData, ridesData) {
  const drivers = driversData;
  const rides = ridesData;

  rides.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
  
  const assignments = drivers.map(driver => ({
    driverId: driver.driverId,
    rideIds: [],
    dailyWorkMinutes: {}
  }));
  
  let totalCost = 0;
  let apiCallsSaved = 0;

  const driverAvailability = {};
  drivers.forEach(driver => {
    driverAvailability[driver.driverId] = {
      lastRideEndTime: driver.shiftStart || '00:00',
      lastRideEndPoint: driver.city,
      lastRideEndPoint_coords: driver.city_coords,
      busyUntil: driver.shiftStart || '00:00',
      lastActiveDate: null
    };
  });

  for (const ride of rides) {
    let bestDriverId = null;
    let minCost = Infinity;
    
    for (const driver of drivers) {
      if (driver.numberOfSeats < ride.numberOfSeats) {
        continue;
      }
      
      const availability = driverAvailability[driver.driverId];
      
      if (isTimeAfter(availability.busyUntil, ride.startTime)) {
        continue;
      }
    
      if (!isDriverOnShift(driver, ride.startTime, ride.endTime)) {
        continue;
      }
      
      if (isAddressBlocked(driver, ride.startPoint) || isAddressBlocked(driver, ride.endPoint)) {
        continue;
      }
      const driverAssignment = assignments.find(a => a.driverId === driver.driverId);
      if (wouldExceedDailyHours(driverAssignment, driver, ride)) {
        continue;
      }
      const haversineEmptyDistance = haversineDistance(
        availability.lastRideEndPoint_coords,
        ride.startPoint_coords
      );
      
      let emptyRideDistance;
      
      if (haversineEmptyDistance <= 50) { 
        try {
          emptyRideDistance = await getDistanceFromOSRM(
            availability.lastRideEndPoint_coords,
            ride.startPoint_coords
          );
        } catch (error) {
          console.warn('Failed to get distance from OSRM for empty ride, using haversine as fallback:', error.message);
          emptyRideDistance = haversineEmptyDistance;
        }
      } else {
        emptyRideDistance = haversineEmptyDistance;
        apiCallsSaved++;
      }

      const emptyRideDurationHours = emptyRideDistance / 60;
      const emptyRideDurationMinutes = Math.ceil(emptyRideDurationHours * 60);
      
      const expectedArrivalTime = addMinutesToTime(
        availability.busyUntil, 
        emptyRideDurationMinutes
      );
      
      if (isTimeAfter(expectedArrivalTime, ride.startTime)) {
        continue;
      }
      
      const rideDurationMinutes = getTimeDifferenceInMinutes(ride.startTime, ride.endTime);
      const driverTimeCost = (rideDurationMinutes / 60) * 30;
      
      const haversineRideDistance = haversineDistance(
        ride.startPoint_coords,
        ride.endPoint_coords
      );
      
      let rideDistance;
      
      if (haversineRideDistance <= 50) {
        try {
          rideDistance = await getDistanceFromOSRM(
            ride.startPoint_coords,
            ride.endPoint_coords
          );
        } catch (error) {
          console.warn('Failed to get distance from OSRM for ride, using haversine as fallback:', error.message);
          rideDistance = haversineRideDistance;
        }
      } else {
        rideDistance = haversineRideDistance;
        apiCallsSaved++;
      }

      const rideFuelCost = rideDistance * driver.fuelCost;

      const emptyRideFuelCost = emptyRideDistance * driver.fuelCost;

      const totalAssignmentCost = driverTimeCost + rideFuelCost + emptyRideFuelCost;

      if (totalAssignmentCost < minCost) {
        minCost = totalAssignmentCost;
        bestDriverId = driver.driverId;
      }
    }
    
    if (bestDriverId) {
      const driverIndex = assignments.findIndex(a => a.driverId === bestDriverId);
      assignments[driverIndex].rideIds.push(ride._id);
      
      if (!assignments[driverIndex].dailyWorkMinutes[ride.date]) {
        assignments[driverIndex].dailyWorkMinutes[ride.date] = 0;
      }
      
      const rideDuration = getTimeDifferenceInMinutes(ride.startTime, ride.endTime);
      assignments[driverIndex].dailyWorkMinutes[ride.date] += rideDuration;

      const driver = drivers.find(d => d.driverId === bestDriverId);
      driverAvailability[bestDriverId] = {
        lastRideEndTime: ride.endTime,
        lastRideEndPoint: ride.endPoint,
        lastRideEndPoint_coords: ride.endPoint_coords,
        busyUntil: ride.endTime,
        lastActiveDate: ride.date
      };

      totalCost += minCost;
    }
  }

  const filteredAssignments = assignments
    .filter(a => a.rideIds.length > 0)
    .map(a => ({
      driverId: a.driverId,
      rideIds: a.rideIds
    }));
  
  return {
    assignments: filteredAssignments,
    totalCost: Math.round(totalCost * 100) / 100
  };
}

// Helper function to check if a driver is on shift during the ride time
function isDriverOnShift(driver, startTime, endTime) {
  if (!driver.shiftStart || !driver.shiftEnd) {
    return true; 
  }
  const startInShift = isTimeInRange(startTime, driver.shiftStart, driver.shiftEnd);
  const endInShift = isTimeInRange(endTime, driver.shiftStart, driver.shiftEnd);
  return startInShift && endInShift;
}

// Helper function to check if an address is in driver's blocked list
function isAddressBlocked(driver, address) {
  if (!driver.blockedAddresses || driver.blockedAddresses.length === 0) {
    return false;
  }
    return driver.blockedAddresses.some(blockedAddress => 
    address.toLowerCase().includes(blockedAddress.toLowerCase())
  );
}

// Helper function to check if a ride would cause driver to exceed daily hours
function wouldExceedDailyHours(driverAssignment, driver, ride) {
  if (!driver.maxDailyWorkHours) {
    return false; 
  }
  
  const maxDailyMinutes = driver.maxDailyWorkHours * 60;
  const currentDailyMinutes = driverAssignment.dailyWorkMinutes[ride.date] || 0;
  const rideDurationMinutes = getTimeDifferenceInMinutes(ride.startTime, ride.endTime);
  
  return (currentDailyMinutes + rideDurationMinutes) > maxDailyMinutes;
}

// Helper function to check if time1 is after time2
function isTimeAfter(time1, time2) {
  const [hours1, minutes1] = time1.split(':').map(Number);
  const [hours2, minutes2] = time2.split(':').map(Number);
  
  if (hours1 > hours2) return true;
  if (hours1 < hours2) return false;
  return minutes1 > minutes2;
}

// Helper function to add minutes to a time
function addMinutesToTime(timeStr, minutes) {
  const [hours, mins] = timeStr.split(':').map(Number);
  
  let totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

// Helper function to get time difference in minutes
function getTimeDifferenceInMinutes(startTime, endTime) {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return endTotalMinutes - startTotalMinutes;
}

async function main() {
  try {
    console.log('Loading driver and ride data...');
    const driversData = JSON.parse(fs.readFileSync('./drivers.json', 'utf8'));
    const ridesData = JSON.parse(fs.readFileSync('./rides.json', 'utf8'));
    
    console.log('Assigning drivers to rides...');
    const result = await assignDriversToRides(driversData, ridesData);
    
    console.log('Assignment Results:');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('Error:', error);
  }
}
if (require.main === module) {
  main();
}

module.exports = { assignDriversToRides };