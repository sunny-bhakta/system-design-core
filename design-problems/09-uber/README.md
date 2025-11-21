# Design Uber

## Problem Statement

Design a ride-sharing service like Uber that matches drivers with riders in real-time.

## Requirements

### Functional Requirements
- Request ride
- Match driver with rider
- Real-time location tracking
- Payment processing
- Rating system
- Trip history
- Multiple ride types (UberX, UberXL, UberBlack)

### Non-Functional Requirements
- Handle millions of concurrent users
- Real-time matching (< 5 seconds)
- High availability (99.9%)
- Global scale
- Low latency (< 100ms)

## Capacity Estimation

### Storage
- **User data:** 100M users * 2KB = 200GB
- **Driver data:** 5M drivers * 5KB = 25GB
- **Trip data:** 10M trips/day * 1KB = 10GB/day = 3.65TB/year
- **Location updates:** 100M updates/day * 100 bytes = 10GB/day
- **Total:** ~4TB/year

### Bandwidth
- **Location updates:** 1.16K updates/sec * 100 bytes = 116KB/sec
- **Matching requests:** 1K requests/sec * 500 bytes = 500KB/sec

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Load        │────▶│  Matching   │
│             │     │  Balancer    │     │  Service    │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
            │  Location    │         │  Payment    │         │  Notification│
            │  Service     │         │  Service    │         │  Service    │
            └──────────────┘         └──────────────┘         └──────────────┘
                    │
                    ▼
            ┌──────────────┐
            │  Geospatial │
            │  Index       │
            │  (Redis Geo) │
            └──────────────┘
```

### Matching Algorithm

#### Geospatial Indexing
- **Redis GeoHash:** Store driver locations
- **Radius search:** Find drivers within radius
- **Distance calculation:** Haversine formula
- **Real-time updates:** Update on location change

#### Matching Process
1. **Rider requests ride:** Location, destination, ride type
2. **Find nearby drivers:** Query geospatial index
3. **Filter by availability:** Only available drivers
4. **Rank by distance:** Closest drivers first
5. **Send request:** Notify selected driver
6. **Driver accepts:** Confirm match
7. **Start trip:** Begin tracking

### Real-time Location Tracking

#### WebSocket Connection
- **Persistent connection:** Real-time bidirectional
- **Location updates:** Every 5-10 seconds
- **Heartbeat:** Keep connection alive
- **Reconnection:** Auto-reconnect on failure

#### Location Storage
- **Redis:** Store current locations
- **TTL:** Auto-expire stale locations
- **Partitioning:** Partition by region

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20),
  user_type VARCHAR(20), -- rider, driver
  rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Trips Table
```sql
CREATE TABLE trips (
  id BIGINT PRIMARY KEY,
  rider_id BIGINT NOT NULL,
  driver_id BIGINT,
  pickup_lat DECIMAL(10,8),
  pickup_lng DECIMAL(11,8),
  dropoff_lat DECIMAL(10,8),
  dropoff_lng DECIMAL(11,8),
  status VARCHAR(20), -- requested, matched, in_progress, completed, cancelled
  fare DECIMAL(10,2),
  distance DECIMAL(10,2), -- km
  duration INT, -- seconds
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  INDEX idx_rider_id (rider_id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_status (status)
);
```

#### Locations Table
```sql
CREATE TABLE locations (
  user_id BIGINT NOT NULL,
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);
```

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - All users (riders and drivers)
- **Production:** SQL database (PostgreSQL, MySQL)

#### Driver Storage
- **drivers:** Map<driverId, driverData> - Driver-specific information
- **Production:** SQL database with indexes

#### Trip Storage
- **trips:** Map<tripId, tripData> - All trip information
- **Production:** SQL database with indexes

#### Location Storage
- **locations:** Map<userId, {lat, lng, updatedAt}> - Current locations
- **Production:** Redis GeoHash for geospatial indexing

#### Available Drivers
- **availableDrivers:** Set<driverId> - Currently available drivers
- **Production:** Redis GeoHash for efficient nearby search

## Process Flow

### Request Ride Process

1. **Validate Rider:** Check if user exists and is a rider
2. **Find Nearby Drivers:** Search for available drivers within radius
3. **Select Closest Driver:** Choose closest driver from results
4. **Create Trip:** Generate trip object with all information
5. **Update Driver Status:** Mark driver as unavailable
6. **Return Trip:** Return trip information

### Matching Algorithm Process

1. **Get Pickup Location:** Rider's pickup coordinates
2. **Query Geospatial Index:** Find drivers within radius
3. **Filter Available:** Only include available drivers
4. **Calculate Distances:** Use Haversine formula
5. **Sort by Distance:** Closest drivers first
6. **Select Driver:** Choose closest driver
7. **Send Notification:** Notify driver (in production)

### Complete Trip Process

1. **Validate Trip:** Check if trip exists and is in progress
2. **Calculate Fare:** Based on distance, duration, ride type
3. **Update Trip:** Set distance, duration, fare, completion time
4. **Process Payment:** Charge rider's payment method
5. **Free Driver:** Mark driver as available again
6. **Return Trip:** Return completed trip information

## Geospatial Indexing

### Haversine Formula

#### Formula
```
a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlng/2)
c = 2 * atan2(√a, √(1-a))
distance = R * c
```

Where:
- R = Earth's radius (6371 km)
- lat1, lng1 = Point 1 coordinates
- lat2, lng2 = Point 2 coordinates

#### Accuracy
- Accurate for distances up to a few hundred kilometers
- Accounts for Earth's curvature
- More accurate than Euclidean distance

### Redis GeoHash (Production)

#### Commands
```redis
# Add driver location
GEOADD drivers 37.7749 -122.4194 driver1

# Find nearby drivers
GEORADIUS drivers 37.7849 -122.4094 5 km WITHDIST

# Update location
GEOADD drivers 37.7750 -122.4195 driver1
```

#### Benefits
- O(log N) complexity for nearby search
- Real-time updates
- Efficient storage
- Built-in distance calculation

## Matching Algorithm Details

### Driver Selection Criteria
1. **Distance:** Closest drivers prioritized
2. **Availability:** Only available drivers
3. **Ride Type:** Match ride type (UberX, UberXL, etc.)
4. **Rating:** Higher rated drivers (optional)

### Matching Process
1. **Radius Search:** Find drivers within 5km radius
2. **Distance Calculation:** Calculate distance to each driver
3. **Sorting:** Sort by distance (closest first)
4. **Selection:** Select closest driver
5. **Notification:** Send ride request to driver (in production)

### Production Enhancements
- **Driver Acceptance:** Driver can accept/reject
- **Timeout:** If no acceptance, try next driver
- **Multiple Requests:** Send to multiple drivers simultaneously
- **Smart Matching:** Consider driver rating, ride type, etc.

## Performance Considerations

### Time Complexity
- **Find Nearby Drivers (Current):** O(d) where d = available drivers
- **Find Nearby Drivers (Production):** O(log d) with geospatial index
- **Calculate Distance:** O(1) per driver
- **Request Ride:** O(d) for search + O(1) for trip creation

### Space Complexity
- **Location Storage:** O(u) where u = users
- **Trip Storage:** O(t) where t = trips

### Latency Targets
- **Matching:** < 5 seconds
- **Location Updates:** < 100ms
- **Trip Creation:** < 200ms

## Real-time Location Tracking

### WebSocket Connection
- **Persistent Connection:** Real-time bidirectional communication
- **Update Frequency:** Every 5-10 seconds
- **Heartbeat:** Keep connection alive
- **Reconnection:** Auto-reconnect on failure

### Location Storage
- **Redis GeoHash:** Store current locations
- **TTL:** Auto-expire stale locations (e.g., 5 minutes)
- **Partitioning:** Partition by region for scalability

## Implementation

### Node.js Implementation

See [Node.js Code](./node/uber.js)

**Key features:**
- Ride request and real-time driver matching
- Geospatial search using Haversine formula
- Real-time location tracking
- Payment processing
- Rating system (bidirectional)
- Trip history
- Trip cancellation

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Geospatial indexing
- Matching algorithm
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { UberService } = require('./node/uber');

const uber = new UberService();

// Create rider
const rider = uber.createUser('rider1', 'Alice', 'rider');

// Create driver
const driver = uber.createUser('driver1', 'Bob', 'driver');

// Update driver location
uber.updateLocation('driver1', 37.7749, -122.4194);

// Request ride
const trip = await uber.requestRide('rider1', 37.7849, -122.4094, 37.7649, -122.4294);

// Complete trip
await uber.completeTrip(trip.id, 5.5, 1200);
```

## Performance Optimization

### Matching Optimization
- **Caching:** Cache driver locations
- **Pre-computation:** Pre-compute nearby drivers
- **Batching:** Batch location updates

### Database Optimization
- **Read replicas:** Distribute read load
- **Partitioning:** Partition by region
- **Indexing:** Optimize geospatial queries

## Monitoring

### Key Metrics
- **Matching latency:** P50, P95, P99
- **Match success rate:** Successful matches
- **Location update latency:** Real-time tracking
- **Trip completion rate:** Completed trips

### Alerts
- High matching latency
- Low match success rate
- Location update failures
- Payment processing errors

## Trade-offs

### Accuracy vs Performance
- **More accurate matching:** Slower, more complex
- **Faster matching:** Less accurate, simpler

### Real-time vs Reliability
- **Real-time:** Fast updates, may lose data
- **Reliable:** Guaranteed delivery, may be delayed

## Further Enhancements

1. **Surge pricing:** Dynamic pricing based on demand
2. **Route optimization:** Optimal route calculation
3. **Pool rides:** Shared rides
4. **Scheduled rides:** Book in advance
5. **Multiple stops:** Multiple destinations
6. **Driver incentives:** Bonus programs

