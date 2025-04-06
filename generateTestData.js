const fs = require('fs');
const axios = require('axios');

// Helper function to get coordinates from an address using Nominatim
async function getCoordinatesFromAddress(address) {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'RideAssignmentSystem/1.0'
      }
    });
    
    if (response.data && response.data.length > 0) {
      const location = response.data[0];
      return [parseFloat(location.lat), parseFloat(location.lon)];
    }
    
    console.warn(`Could not find coordinates for address: ${address}`);
    return [
      31.5 + (Math.random() * 2),
      34.5 + (Math.random() * 1.5) 
    ];
  } catch (error) {
    console.error(`Error getting coordinates for ${address}:`, error.message);
    return [
      31.5 + (Math.random() * 2),
      34.5 + (Math.random() * 1.5) 
    ];
  }
}

function getRandomTime(startTime, endTime) {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  const randomTotalMinutes = Math.floor(
    Math.random() * (endTotalMinutes - startTotalMinutes) + startTotalMinutes
  );
  
  const randomHours = Math.floor(randomTotalMinutes / 60);
  const randomMinutes = randomTotalMinutes % 60;
  
  return `${String(randomHours).padStart(2, '0')}:${String(randomMinutes).padStart(2, '0')}`;
}

function addMinutesToTime(timeStr, minutes) {
  const [hours, mins] = timeStr.split(':').map(Number);
  
  let totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

async function generateDriversData(numDrivers) {
  const cities = [
    'Tel Aviv, Israel',
    'Jerusalem, Israel',
    'Haifa, Israel',
    'Beer Sheva, Israel',
    'Netanya, Israel',
    'Eilat, Israel',
    'Ashdod, Israel',
    'Tiberias, Israel'
  ];
  
  const drivers = [];
  
  for (let i = 0; i < numDrivers; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const coords = await getCoordinatesFromAddress(city);
    
    const shiftType = Math.random() < 0.33 ? 'morning' : 
                     (Math.random() < 0.66 ? 'evening' : 'full');
    
    let startShift, endShift;
    
    switch (shiftType) {
      case 'morning':
        startShift = '06:00';
        endShift = '12:00';
        break;
      case 'evening':
        startShift = '16:00';
        endShift = '22:00';
        break;
      case 'full':
        startShift = '08:00';
        endShift = '20:00';
        break;
    }
    
    const numberOfSeats = Math.floor(Math.random() * 5) + 4;
    
    const fuelCost = Math.round((Math.random() * 0.3 + 0.5) * 100) / 100;
    
    const numBlockedAddresses = Math.floor(Math.random() * 4);
    const blockedAddresses = [];
    
    for (let j = 0; j < numBlockedAddresses; j++) {
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      blockedAddresses.push(randomCity);
    }
    
    drivers.push({
      driverId: `driver${i + 1}`,
      city,
      city_coords: coords,
      numberOfSeats,
      fuelCost,
      shiftStart: startShift,
      shiftEnd: endShift,
      maxDailyWorkHours: Math.floor(Math.random() * 5) + 6, // 6-10 hours
      blockedAddresses
    });
  }
  
  return drivers;
}
async function generateRidesData(numRides) {
  const locations = [
    'Tel Aviv, Israel',
    'Jerusalem, Israel',
    'Haifa, Israel',
    'Beer Sheva, Israel',
    'Netanya, Israel',
    'Eilat, Israel',
    'Ashdod, Israel',
    'Tiberias, Israel',
    'Herzliya, Israel',
    'Ramat Gan, Israel',
    'Rishon LeZion, Israel',
    'Rehovot, Israel'
  ];
  
  const rides = [];
  
  const dates = ['2023-06-01', '2023-06-02', '2023-06-03', '2023-06-04', '2023-06-05'];
  
  for (let i = 0; i < numRides; i++) {
    const startIndex = Math.floor(Math.random() * locations.length);
    let endIndex;
    do {
      endIndex = Math.floor(Math.random() * locations.length);
    } while (endIndex === startIndex);
    
    const startPoint = locations[startIndex];
    const endPoint = locations[endIndex];
    
    const startPoint_coords = await getCoordinatesFromAddress(startPoint);
    const endPoint_coords = await getCoordinatesFromAddress(endPoint);
    
    const date = dates[Math.floor(Math.random() * dates.length)];
    
    const startTime = getRandomTime('06:00', '21:00');
    
    const rideDuration = Math.floor(Math.random() * 105) + 15;
    const endTime = addMinutesToTime(startTime, rideDuration);
    
    const numberOfSeats = Math.floor(Math.random() * 6) + 1;
    
    rides.push({
      _id: `ride${i + 1}`,
      date,
      startTime,
      endTime,
      startPoint,
      startPoint_coords,
      endPoint,
      endPoint_coords,
      numberOfSeats
    });
  }
  
  rides.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
  
  return rides;
}

async function generateTestData() {
  try {
    console.log('Generating drivers data...');
    const drivers = await generateDriversData(10);
    
    console.log('Generating rides data...');
    const rides = await generateRidesData(30);
    
    fs.writeFileSync('./drivers.json', JSON.stringify(drivers, null, 2));
    console.log('Drivers data saved to drivers.json');
    
    fs.writeFileSync('./rides.json', JSON.stringify(rides, null, 2));
    console.log('Rides data saved to rides.json');
    
  } catch (error) {
    console.error('Error generating test data:', error);
  }
}

if (require.main === module) {
  generateTestData();
}

module.exports = { generateTestData };