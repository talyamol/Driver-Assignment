const fs = require('fs');
const { generateTestData } = require('./generateTestData');
const { assignDriversToRides } = require('./assignDriversToRides');

async function runSystem() {
  try {
    const driversExists = fs.existsSync('./drivers.json');
    const ridesExists = fs.existsSync('./rides.json');

    if (!driversExists || !ridesExists) {
      console.log('Test data files not found. Generating new test data...');
      await generateTestData();
    }

    const drivers = JSON.parse(fs.readFileSync('./drivers.json', 'utf8'));
    const rides = JSON.parse(fs.readFileSync('./rides.json', 'utf8'));
    
    console.log(`Loaded ${drivers.length} drivers and ${rides.length} rides.`);
    
    console.log('Running enhanced assignment algorithm...');
    const result = await assignDriversToRides(drivers, rides);

    const simplifiedOutput = {
      assignments: result.assignments.map(assignment => ({
        driverId: assignment.driverId,
        rideIds: assignment.rideIds
      })),
      totalCost: result.totalCost
    };

    console.log('\nAssignment Results:');
    console.log(JSON.stringify(simplifiedOutput, null, 2));
    
  } catch (error) {
    console.error('Error running system:', error);
  }
}

if (require.main === module) {
  runSystem();
}

module.exports = { runSystem };