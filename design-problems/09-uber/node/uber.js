/**
 * Design Uber
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Ride-sharing service with real-time matching of drivers and riders.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 100M users (riders + drivers)
 * - Drivers: 5M active drivers
 * - Trips: 10M trips/day = ~116 trips/second
 * - Location updates: 100M updates/day = ~1.16K updates/second
 * - Storage: 10M trips/day * 1KB = 10GB/day = 3.65TB/year
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → Matching Service → Geospatial Index → Database
 * 
 * KEY FEATURES:
 * - Real-time driver-rider matching
 * - Geospatial indexing for nearby driver search
 * - Real-time location tracking
 * - Payment processing
 * - Rating system
 * - Trip history
 * - Multiple ride types (UberX, UberXL, UberBlack)
 * 
 * MATCHING ALGORITHM:
 * - Geospatial indexing (Redis GeoHash)
 * - Radius search for nearby drivers
 * - Distance calculation (Haversine formula)
 * - Real-time updates on location change
 * 
 * REAL-TIME TRACKING:
 * - WebSocket for real-time location updates
 * - Location updates every 5-10 seconds
 * - Geospatial index for fast queries
 */
class UberService {
  /**
   * Constructor
   * 
   * INITIALIZES DATA STRUCTURES:
   * ============================
   * All data structures are in-memory Maps for simplicity.
   * In production, would use distributed databases and geospatial indexes.
   */
  constructor() {
    /**
     * USER STORAGE
     * ============
     * Stores all users (riders and drivers).
     * In production: SQL database (PostgreSQL, MySQL)
     */
    this.users = new Map();
    
    /**
     * DRIVER STORAGE
     * ==============
     * Stores driver-specific information (availability, current trip).
     * In production: SQL database with indexes
     */
    this.drivers = new Map(); // driverId -> driver data
    
    /**
     * TRIP STORAGE
     * ============
     * Stores all trip information (pickup, dropoff, fare, status).
     * In production: SQL database with indexes
     */
    this.trips = new Map();
    
    /**
     * LOCATION STORAGE
     * ================
     * Stores current location for all users (riders and drivers).
     * In production: Redis GeoHash for geospatial indexing
     */
    this.locations = new Map(); // userId -> {lat, lng}
    
    /**
     * AVAILABLE DRIVERS
     * =================
     * Set of driver IDs who are currently available.
     * In production: Would use geospatial index (Redis GeoHash)
     */
    this.availableDrivers = new Set();
  }

  /**
   * Create user
   */
  createUser(userId, name, userType = 'rider') {
    const user = {
      id: userId,
      name,
      userType, // rider or driver
      rating: 0,
      totalRatings: 0,
      createdAt: Date.now()
    };

    this.users.set(userId, user);

    if (userType === 'driver') {
      this.drivers.set(userId, {
        ...user,
        available: false,
        currentTrip: null
      });
    }

    return user;
  }

  /**
   * Update location
   */
  updateLocation(userId, lat, lng) {
    this.locations.set(userId, { lat, lng, updatedAt: Date.now() });

    // If driver is available, update in available drivers
    const driver = this.drivers.get(userId);
    if (driver && driver.available) {
      // In real system, would update geospatial index
    }

    return true;
  }

  /**
   * Set driver availability
   */
  setDriverAvailability(driverId, available) {
    const driver = this.drivers.get(driverId);
    if (!driver) {
      throw new Error('Driver not found');
    }

    driver.available = available;

    if (available) {
      this.availableDrivers.add(driverId);
    } else {
      this.availableDrivers.delete(driverId);
    }

    return { available };
  }

  /**
   * Calculate distance (Haversine formula)
   * 
   * HAVERSINE FORMULA:
   * =================
   * Calculates great-circle distance between two points on Earth.
   * 
   * FORMULA:
   * a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlng/2)
   * c = 2 * atan2(√a, √(1-a))
   * distance = R * c
   * 
   * WHERE:
   * - R = Earth's radius (6371 km)
   * - lat1, lng1 = Latitude and longitude of point 1
   * - lat2, lng2 = Latitude and longitude of point 2
   * 
   * ACCURACY:
   * - Accurate for distances up to a few hundred kilometers
   * - Accounts for Earth's curvature
   * - More accurate than simple Euclidean distance
   * 
   * PERFORMANCE:
   * - Time Complexity: O(1)
   * - Fast calculation for real-time matching
   * 
   * ALTERNATIVES:
   * - For very short distances: Euclidean distance (faster, less accurate)
   * - For production: Use geospatial database functions (PostGIS, Redis GeoHash)
   * 
   * @param {number} lat1 - Latitude of point 1
   * @param {number} lng1 - Longitude of point 1
   * @param {number} lat2 - Latitude of point 2
   * @param {number} lng2 - Longitude of point 2
   * @returns {number} Distance in kilometers
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    /**
     * EARTH'S RADIUS
     * ==============
     * Mean radius of Earth in kilometers.
     */
    const R = 6371; // Earth's radius in km
    
    /**
     * CONVERT TO RADIANS
     * =================
     * Convert latitude and longitude differences to radians.
     */
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    /**
     * HAVERSINE FORMULA
     * =================
     * Calculate intermediate value 'a' using Haversine formula.
     */
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    /**
     * CALCULATE ANGULAR DISTANCE
     * ==========================
     * Calculate central angle 'c' between two points.
     */
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    /**
     * CALCULATE DISTANCE
     * =================
     * Multiply radius by angular distance to get actual distance.
     */
    return R * c;
  }

  /**
   * Find nearby drivers
   * 
   * NEARBY DRIVER SEARCH:
   * ====================
   * Finds available drivers within specified radius of pickup location.
   * 
   * PROCESS:
   * 1. Iterate through available drivers
   * 2. Get driver's current location
   * 3. Calculate distance from pickup location
   * 4. Filter drivers within radius
   * 5. Sort by distance (closest first)
   * 6. Return sorted list
   * 
   * PERFORMANCE:
   * - Current: O(d) where d = number of available drivers (inefficient)
   * - Production: O(log d) using geospatial index (Redis GeoHash)
   * 
   * GEOSPATIAL INDEXING (PRODUCTION):
   * =================================
   * Would use Redis GeoHash for efficient nearby search:
   * - GEOADD: Add driver locations
   * - GEORADIUS: Find drivers within radius
   * - O(log N) complexity
   * - Real-time updates
   * 
   * OPTIMIZATION:
   * - Use geospatial index instead of linear search
   * - Partition by region for better performance
   * - Cache popular pickup locations
   * 
   * @param {number} pickupLat - Pickup latitude
   * @param {number} pickupLng - Pickup longitude
   * @param {number} radiusKm - Search radius in kilometers (default: 5km)
   * @returns {Array<Object>} Array of nearby drivers sorted by distance
   */
  findNearbyDrivers(pickupLat, pickupLng, radiusKm = 5) {
    const nearbyDrivers = [];

    /**
     * ITERATE THROUGH AVAILABLE DRIVERS
     * ==================================
     * Check each available driver's distance from pickup location.
     * In production: Would use geospatial index query (Redis GEORADIUS).
     */
    for (const driverId of this.availableDrivers) {
      const location = this.locations.get(driverId);
      if (!location) continue;

      /**
       * CALCULATE DISTANCE
       * ==================
       * Use Haversine formula to calculate distance.
       */
      const distance = this.calculateDistance(
        pickupLat, pickupLng,
        location.lat, location.lng
      );

      /**
       * FILTER BY RADIUS
       * ================
       * Only include drivers within specified radius.
       */
      if (distance <= radiusKm) {
        nearbyDrivers.push({
          driverId,
          distance,
          location
        });
      }
    }

    /**
     * SORT BY DISTANCE
     * ================
     * Sort drivers by distance (closest first).
     * This ensures closest driver is selected for matching.
     */
    nearbyDrivers.sort((a, b) => a.distance - b.distance);

    return nearbyDrivers;
  }

  /**
   * Request ride
   * 
   * RIDE REQUEST PROCESS:
   * =====================
   * Matches rider with nearby driver and creates trip.
   * 
   * PROCESS:
   * 1. Validate rider
   * 2. Find nearby available drivers
   * 3. Select closest driver
   * 4. Create trip object
   * 5. Update driver status (mark as unavailable)
   * 6. Return trip information
   * 
   * MATCHING ALGORITHM:
   * ==================
   * - Find drivers within radius (default: 5km)
   * - Sort by distance (closest first)
   * - Select closest driver
   * 
   * IN PRODUCTION:
   * - Would send notification to driver for acceptance
   * - Driver can accept or reject
   * - If rejected, try next closest driver
   * - Timeout if no driver accepts
   * 
   * TRIP STATUS FLOW:
   * ================
   * matched → in_progress → completed
   * 
   * @param {string} riderId - Rider requesting the ride
   * @param {number} pickupLat - Pickup latitude
   * @param {number} pickupLng - Pickup longitude
   * @param {number} dropoffLat - Dropoff latitude
   * @param {number} dropoffLng - Dropoff longitude
   * @param {string} rideType - Ride type (UberX, UberXL, UberBlack)
   * @returns {Promise<Object>} Created trip object
   */
  async requestRide(riderId, pickupLat, pickupLng, dropoffLat, dropoffLng, rideType = 'UberX') {
    /**
     * STEP 1: VALIDATE RIDER
     * ======================
     * Check if user exists and is a rider.
     */
    const rider = this.users.get(riderId);
    if (!rider || rider.userType !== 'rider') {
      throw new Error('Invalid rider');
    }

    /**
     * STEP 2: FIND NEARBY DRIVERS
     * ===========================
     * Search for available drivers within radius.
     * Returns drivers sorted by distance (closest first).
     */
    const nearbyDrivers = this.findNearbyDrivers(pickupLat, pickupLng);

    if (nearbyDrivers.length === 0) {
      throw new Error('No drivers available');
    }

    /**
     * STEP 3: SELECT CLOSEST DRIVER
     * =============================
     * Select closest driver for matching.
     * In production: Would send notification to driver for acceptance.
     */
    const selectedDriver = nearbyDrivers[0];

    /**
     * STEP 4: CREATE TRIP
     * ===================
     * Create trip object with all trip information.
     * Status starts as 'matched' (driver matched, trip not started yet).
     */
    const trip = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      riderId,
      driverId: selectedDriver.driverId,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      rideType,
      status: 'matched', // matched → in_progress → completed
      fare: null, // Calculated on completion
      distance: null, // Calculated on completion
      duration: null, // Calculated on completion
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null
    };

    /**
     * STEP 5: STORE TRIP
     * ==================
     * Save trip to database.
     */
    this.trips.set(trip.id, trip);

    /**
     * STEP 6: UPDATE DRIVER STATUS
     * ============================
     * Mark driver as unavailable and assign current trip.
     * Remove from available drivers set.
     */
    const driver = this.drivers.get(selectedDriver.driverId);
    driver.available = false;
    driver.currentTrip = trip.id;
    this.availableDrivers.delete(selectedDriver.driverId);

    return trip;
  }

  /**
   * Start trip
   */
  startTrip(tripId) {
    const trip = this.trips.get(tripId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status !== 'matched') {
      throw new Error('Trip cannot be started');
    }

    trip.status = 'in_progress';
    trip.startedAt = Date.now();

    return trip;
  }

  /**
   * Complete trip
   */
  async completeTrip(tripId, distanceKm, durationSeconds) {
    const trip = this.trips.get(tripId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status !== 'in_progress') {
      throw new Error('Trip not in progress');
    }

    // Calculate fare (simplified)
    const baseFare = 2.0;
    const perKmRate = 1.5;
    const perMinuteRate = 0.25;
    const fare = baseFare + (distanceKm * perKmRate) + ((durationSeconds / 60) * perMinuteRate);

    trip.status = 'completed';
    trip.distance = distanceKm;
    trip.duration = durationSeconds;
    trip.fare = fare;
    trip.completedAt = Date.now();

    // Process payment
    await this.processPayment(tripId, fare);

    // Free up driver
    const driver = this.drivers.get(trip.driverId);
    driver.available = true;
    driver.currentTrip = null;
    this.availableDrivers.add(trip.driverId);

    return trip;
  }

  /**
   * Process payment
   */
  async processPayment(tripId, amount) {
    const trip = this.trips.get(tripId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    // Simulate payment processing
    const payment = {
      id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tripId,
      amount,
      status: 'completed',
      processedAt: Date.now()
    };

    return payment;
  }

  /**
   * Rate trip
   */
  rateTrip(tripId, rating, userId) {
    const trip = this.trips.get(tripId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Rate driver or rider
    if (userId === trip.riderId) {
      // Rider rating driver
      const driver = this.users.get(trip.driverId);
      driver.totalRatings++;
      driver.rating = ((driver.rating * (driver.totalRatings - 1)) + rating) / driver.totalRatings;
    } else if (userId === trip.driverId) {
      // Driver rating rider
      const rider = this.users.get(trip.riderId);
      rider.totalRatings++;
      rider.rating = ((rider.rating * (rider.totalRatings - 1)) + rating) / rider.totalRatings;
    }

    return { rated: true, rating };
  }

  /**
   * Get trip history
   */
  getTripHistory(userId, limit = 20) {
    const trips = [];
    for (const trip of this.trips.values()) {
      if (trip.riderId === userId || trip.driverId === userId) {
        trips.push(trip);
      }
    }

    return trips
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Cancel trip
   */
  cancelTrip(tripId, userId) {
    const trip = this.trips.get(tripId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.riderId !== userId && trip.driverId !== userId) {
      throw new Error('Unauthorized');
    }

    trip.status = 'cancelled';

    // Free up driver if matched
    if (trip.driverId && trip.status === 'matched') {
      const driver = this.drivers.get(trip.driverId);
      driver.available = true;
      driver.currentTrip = null;
      this.availableDrivers.add(trip.driverId);
    }

    return trip;
  }
}

// Example usage
async function demonstrateUber() {
  console.log('=== Design Uber ===\n');

  const uber = new UberService();

  // Create rider and driver
  const rider = uber.createUser('rider1', 'Alice', 'rider');
  const driver = uber.createUser('driver1', 'Bob', 'driver');

  // Set driver availability
  uber.setDriverAvailability('driver1', true);

  // Update driver location
  uber.updateLocation('driver1', 37.7749, -122.4194);
  console.log('Driver location updated');

  // Request ride
  const trip = await uber.requestRide(
    'rider1',
    37.7849, -122.4094, // Pickup
    37.7649, -122.4294  // Dropoff
  );
  console.log('Ride requested:', trip.id);

  // Start trip
  uber.startTrip(trip.id);
  console.log('Trip started');

  // Complete trip
  const completedTrip = await uber.completeTrip(trip.id, 5.5, 1200);
  console.log('Trip completed:', {
    fare: completedTrip.fare,
    distance: completedTrip.distance,
    duration: completedTrip.duration
  });

  // Rate trip
  uber.rateTrip(trip.id, 5, 'rider1');
  console.log('Trip rated');
}

if (require.main === module) {
  demonstrateUber();
}

module.exports = { UberService };

