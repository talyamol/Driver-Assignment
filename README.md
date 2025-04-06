# Ride Assignment System

An optimized system for assigning drivers to rides based on various constraints and cost optimization.

## Overview

This system uses an advanced algorithm to assign drivers to ride requests while minimizing total costs and respecting various constraints such as vehicle capacity, driver availability, and more.

### Features

- **Cost-Optimized Assignment**: Assigns drivers to rides in a way that minimizes total costs (fuel + driver time)
- **Constraint Handling**:
  - Vehicle capacity matching
  - Driver shift availability
  - Blocked addresses for drivers
  - Daily work hour limits
  - Time constraints (ensuring drivers can reach pickup locations in time)
- **Real-world Distance Calculation**: Uses OSRM API for accurate driving distances with fallback to haversine (straight-line) distance
- **API Call Optimization**: Reduces API calls by using haversine distance as a pre-filter
- **Test Data Generation**: Includes script to generate realistic test data using Nominatim for geocoding

## Algorithm Explanation

The core of the system is the ride assignment algorithm that works as follows:

1. **Sort rides by date and time**: Process rides chronologically to maintain driver availability
2. **For each ride**:
   - Find all eligible drivers (considering vehicle capacity, availability, shift constraints, etc.)
   - For each eligible driver, calculate the cost of assigning them (empty ride fuel, ride fuel, driver time)
   - Choose the driver with the lowest total cost
   - Update the driver's state (position, availability time, daily work hours)
3. **Return** the final assignments and total cost

The algorithm handles edge cases like drivers being unavailable due to shift constraints or having reached their daily work hour limit.

## Project Structure

- `index.js` - Entry point that orchestrates the entire process
- `generateTestData.js` - Script to generate realistic driver and ride test data
- `assignDriversToRides.js` - Contains the core assignment algorithm
- `utils.js` - Helper functions for distance calculations and time operations
- `drivers.json` - Driver data (generated or supplied)
- `rides.json` - Ride data (generated or supplied)

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install axios
```

## Usage

### Basic Usage

Run the main script to generate data (if needed) and perform the assignment:

```bash
npm start
```

This will:

1. Generate test data files if they don't exist
2. Run the assignment algorithm
3. Output the results in the format:

```json
{
  "assignments": [
    {
      "driverId": "driver1",
      "rideIds": [ "ride1", "ride2", "ride6", "ride9", "ride13"]
    },
    {
      "driverId": "driver2",
      "rideIds": [ "ride7", "ride10", "ride12", "ride15", "ride17", "ride19"]
    }
    {
      "driverId": "driver3",
      "rideIds": ["ride4", "ride11", "ride14", "ride18", "ride20"]
    },
    {
      "driverId": "driver4",
      "rideIds": ["ride16", "ride3", "ride5", "ride8" ]
    }
  ],
  "totalCost": 818.07
}
```

### Generate Test Data Only

If you just want to generate test data:

```bash
node generate-test-data.js
```

### Using Your Own Data

You can provide your own `drivers.json` and `rides.json` files with the following formats:

#### drivers.json

```json
[
  {
    "driverId": "driver1",
    "city": "Tel Aviv, Israel",
    "city_coords": [32.0853, 34.7818],
    "numberOfSeats": 4,
    "fuelCost": 0.65,
    "shiftStart": "08:00",
    "shiftEnd": "20:00",
    "maxDailyWorkHours": 8,
    "blockedAddresses": ["Eilat, Israel"]
  }
  // ... more drivers
]
```

#### rides.json

```json
[
  {
    "_id": "ride1",
    "date": "2023-06-01",
    "startTime": "09:30",
    "endTime": "10:15",
    "startPoint": "Jerusalem, Israel",
    "startPoint_coords": [31.7683, 35.2137],
    "endPoint": "Tel Aviv, Israel",
    "endPoint_coords": [32.0853, 34.7818],
    "numberOfSeats": 2
  }
  // ... more rides
]
```

## Performance Optimization

The system includes several optimizations:

1. **Distance calculation caching**: Avoids redundant API calls
2. **Haversine pre-filtering**: Uses fast straight-line distance calculation before making expensive API calls
3. **Chronological processing**: Processes rides in time order to make efficient decisions

## Constraints and Limitations

- The system assumes all times are within a single day (no overnight rides)
- Distance calculations assume driving mode (not public transit or walking)
- The optimization is greedy (processes rides one at a time) rather than globally optimal

## Advanced Configuration

You can modify the following parameters in the code:

- `maxHaversineThreshold` in `utils.js`: Controls when to use API vs. haversine distance
- Maximum daily work hours and shift definitions in driver data
