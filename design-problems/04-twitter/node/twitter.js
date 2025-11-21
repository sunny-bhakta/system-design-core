/**
 * Design Twitter/X
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Social media platform that allows users to post tweets, follow users, and view timelines.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 500M users
 * - Tweets: 200M tweets/day = ~2,300 tweets/second
 * - Timeline reads: 23K reads/second
 * - Storage: 200M tweets/day * 500 bytes = 100GB/day = 36TB/year
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → App Servers → Timeline Service → Database (SQL + NoSQL)
 * 
 * TIMELINE GENERATION STRATEGIES:
 * 1. Push Model (Fan-out on Write): Push tweets to followers' timelines
 *    - Pros: Fast reads, real-time
 *    - Cons: Slow writes for users with many followers
 *    - Use for: Users with < 1M followers
 * 
 * 2. Pull Model (Fan-out on Read): Fetch tweets when timeline requested
 *    - Pros: Fast writes
 *    - Cons: Slow reads, not real-time
 *    - Use for: Users with > 1M followers
 * 
 * 3. Hybrid Model: Push for regular users, Pull for celebrities
 *    - Best of both worlds
 * 
 * KEY FEATURES:
 * - Post tweets (280 characters)
 * - Follow/unfollow users
 * - View home timeline (feed from followed users)
 * - View user timeline (user's own tweets)
 * - Like, retweet, reply to tweets
 * - Search tweets
 * - Trending topics
 */

/**
 * Twitter Service
 * 
 * CORE FUNCTIONALITY:
 * ===================
 * Implements the main Twitter/X service with:
 * - User management
 * - Tweet posting and retrieval
 * - Follow/unfollow relationships
 * - Timeline generation (Push model)
 * - Social interactions (likes, retweets)
 * - Search and trending topics
 * 
 * DATA STRUCTURES:
 * ================
 * - users: Map<userId, userData> - User information
 * - tweets: Map<tweetId, tweetData> - All tweets
 * - follows: Map<userId, Set<followeeId>> - Who each user follows
 * - followers: Map<userId, Set<followerId>> - Who follows each user
 * - timelines: Map<userId, Array<tweetId>> - Pre-computed home timelines (Push model)
 * - userTweets: Map<userId, Array<tweetId>> - User's own tweets
 * - likes: Map<tweetId, Set<userId>> - Users who liked each tweet
 * - retweets: Map<tweetId, Set<userId>> - Users who retweeted each tweet
 * 
 * PRODUCTION CONSIDERATIONS:
 * - In production, would use:
 *   * SQL database for users, tweets, follows
 *   * NoSQL database for timelines (Redis, Cassandra)
 *   * Search engine (Elasticsearch) for tweet search
 *   * Message queue for async timeline updates
 *   * CDN for media storage
 */
class TwitterService {
  /**
   * Constructor
   * 
   * INITIALIZES DATA STRUCTURES:
   * ============================
   * All data structures are in-memory Maps for simplicity.
   * In production, would use distributed databases.
   */
  constructor() {
    /**
     * USER STORAGE
     * ============
     * Stores user information (id, username, name, etc.)
     * In production: SQL database (PostgreSQL, MySQL)
     */
    this.users = new Map();
    
    /**
     * TWEET STORAGE
     * =============
     * Stores all tweets with metadata.
     * In production: SQL database for tweets, NoSQL for timeline
     */
    this.tweets = new Map();
    
    /**
     * FOLLOW RELATIONSHIPS
     * ====================
     * follows: userId -> Set of users they follow
     * followers: userId -> Set of users following them
     * In production: SQL database with indexes on both columns
     */
    this.follows = new Map(); // userId -> Set of following user IDs
    this.followers = new Map(); // userId -> Set of follower user IDs
    
    /**
     * TIMELINE STORAGE (PUSH MODEL)
     * =============================
     * Pre-computed home timelines for fast reads.
     * When user posts tweet, it's pushed to all followers' timelines.
     * In production: Redis or Cassandra for fast timeline access
     */
    this.timelines = new Map(); // userId -> List of tweet IDs (sorted by time)
    
    /**
     * USER TWEETS
     * ===========
     * Stores list of tweet IDs for each user (for user timeline).
     * In production: SQL database with user_id index
     */
    this.userTweets = new Map(); // userId -> List of tweet IDs
    
    /**
     * SOCIAL INTERACTIONS
     * ===================
     * Tracks likes and retweets per tweet.
     * In production: SQL database or Redis for counters
     */
    this.likes = new Map(); // tweetId -> Set of user IDs who liked
    this.retweets = new Map(); // tweetId -> Set of user IDs who retweeted
  }

  /**
   * Create user
   */
  createUser(userId, username, name) {
    this.users.set(userId, {
      id: userId,
      username,
      name,
      createdAt: Date.now()
    });
    this.follows.set(userId, new Set());
    this.followers.set(userId, new Set());
    this.timelines.set(userId, []);
    this.userTweets.set(userId, []);
    return this.users.get(userId);
  }

  /**
   * Post tweet
   * 
   * TWEET POSTING PROCESS (PUSH MODEL):
   * ====================================
   * 1. Validate tweet content (length, format)
   * 2. Create tweet object with metadata
   * 3. Store tweet in database
   * 4. Initialize like/retweet tracking
   * 5. Add to user's own tweets list
   * 6. Push to all followers' timelines (Fan-out on Write)
   * 
   * PUSH MODEL (FAN-OUT ON WRITE):
   * ==============================
   * When user posts tweet, immediately push to all followers' timelines.
   * 
   * PROS:
   * - Fast timeline reads (pre-computed)
   * - Real-time updates
   * - Better user experience
   * 
   * CONS:
   * - Slow writes for users with many followers (celebrities)
   * - High write load
   * 
   * SOLUTION FOR CELEBRITIES:
   * - Use Pull model for users with > 1M followers
   * - Hybrid approach: Push for regular users, Pull for celebrities
   * 
   * PERFORMANCE:
   * - Time Complexity: O(f) where f = number of followers
   * - For celebrities: Would use async queue (message queue)
   * - In production: Background job for fan-out
   * 
   * @param {string} userId - User posting the tweet
   * @param {string} content - Tweet content (max 280 characters)
   * @returns {Promise<Object>} Created tweet object
   */
  async postTweet(userId, content) {
    /**
     * STEP 1: VALIDATE TWEET CONTENT
     * ==============================
     * Check tweet length (280 character limit).
     * In production, would also check:
     * - Content filtering (spam, abuse)
     * - Media attachments
     * - Mentions and hashtags
     */
    if (content.length > 280) {
      throw new Error('Tweet exceeds 280 characters');
    }

    /**
     * STEP 2: CREATE TWEET OBJECT
     * ===========================
     * Generate unique tweet ID and store metadata.
     * In production: Would use distributed ID generator (Snowflake)
     */
    const tweet = {
      id: `tweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      content,
      createdAt: Date.now(),
      likes: 0,
      retweets: 0,
      replies: 0
    };

    /**
     * STEP 3: STORE TWEET
     * ===================
     * Save tweet to database.
     * In production: SQL database (PostgreSQL) for tweets
     */
    this.tweets.set(tweet.id, tweet);
    this.likes.set(tweet.id, new Set());
    this.retweets.set(tweet.id, new Set());

    /**
     * STEP 4: ADD TO USER'S TWEETS
     * ============================
     * Add tweet to user's own tweet list (for user timeline).
     * Prepend to list (newest first).
     */
    const userTweets = this.userTweets.get(userId) || [];
    userTweets.unshift(tweet.id);
    this.userTweets.set(userId, userTweets);

    /**
     * STEP 5: PUSH TO FOLLOWERS' TIMELINES (FAN-OUT)
     * ===============================================
     * Add tweet to all followers' pre-computed timelines.
     * This is the "Push Model" - fan-out on write.
     * 
     * OPTIMIZATION FOR CELEBRITIES:
     * - For users with > 1M followers, use async queue
     * - Background job processes fan-out
     * - Or use Pull model instead
     */
    await this.addToFollowersTimelines(userId, tweet.id);

    return tweet;
  }

  /**
   * Add tweet to followers' timelines
   * 
   * FAN-OUT PROCESS (PUSH MODEL):
   * =============================
   * Pushes new tweet to all followers' pre-computed timelines.
   * 
   * PROCESS:
   * 1. Get all followers of the user who posted
   * 2. For each follower, add tweet to their timeline
   * 3. Maintain timeline size limit (keep only recent tweets)
   * 
   * TIMELINE SIZE LIMIT:
   * - Keep only last 1000 tweets per user
   * - Prevents unbounded memory growth
   * - In production: Would use Redis with TTL or LRU eviction
   * 
   * PERFORMANCE CONSIDERATIONS:
   * - For users with many followers, this can be slow
   * - Solution: Use async queue (message queue) for fan-out
   * - Or use Pull model for celebrities
   * 
   * IN PRODUCTION:
   * - Would use message queue (Kafka, RabbitMQ) for async fan-out
   * - Background workers process fan-out jobs
   * - Batch updates for efficiency
   * 
   * @param {string} userId - User who posted the tweet
   * @param {string} tweetId - Tweet ID to add to timelines
   */
  async addToFollowersTimelines(userId, tweetId) {
    /**
     * GET ALL FOLLOWERS
     * =================
     * Retrieve set of users following this user.
     */
    const followers = this.followers.get(userId) || new Set();
    
    /**
     * FAN-OUT TO EACH FOLLOWER
     * ========================
     * Add tweet to each follower's timeline.
     * In production: Would batch this operation or use async queue.
     */
    for (const followerId of followers) {
      const timeline = this.timelines.get(followerId) || [];
      /**
       * PREPEND TWEET (NEWEST FIRST)
       * ============================
       * Add tweet to beginning of timeline (chronological order).
       */
      timeline.unshift(tweetId);
      
      /**
       * MAINTAIN TIMELINE SIZE LIMIT
       * ============================
       * Keep only last 1000 tweets to prevent unbounded growth.
       * In production: Would use Redis with TTL or LRU eviction.
       */
      if (timeline.length > 1000) {
        timeline.pop();
      }
      this.timelines.set(followerId, timeline);
    }
  }

  /**
   * Follow user
   * 
   * FOLLOW PROCESS:
   * ==============
   * Establishes follow relationship between two users.
   * 
   * PROCESS:
   * 1. Validate (cannot follow yourself)
   * 2. Add to follower's "following" list
   * 3. Add to followee's "followers" list
   * 4. Add followee's recent tweets to follower's timeline
   * 
   * TIMELINE BACKFILL:
   * =================
   * When user follows someone, add their recent tweets to timeline.
   * This ensures follower sees historical tweets immediately.
   * 
   * PERFORMANCE:
   * - Time Complexity: O(1) for relationship update
   * - O(n) for timeline backfill where n = recent tweets (typically 100)
   * 
   * @param {string} followerId - User who wants to follow
   * @param {string} followeeId - User being followed
   * @returns {Promise<Object>} Follow relationship status
   */
  async follow(followerId, followeeId) {
    /**
     * VALIDATION
     * =========
     * Prevent users from following themselves.
     */
    if (followerId === followeeId) {
      throw new Error('Cannot follow yourself');
    }

    /**
     * UPDATE FOLLOW RELATIONSHIPS
     * ===========================
     * Maintain bidirectional relationship:
     * - followerId follows followeeId
     * - followeeId is followed by followerId
     * 
     * In production: Would use SQL database with indexes on both columns.
     */
    const following = this.follows.get(followerId) || new Set();
    following.add(followeeId);
    this.follows.set(followerId, following);

    const followers = this.followers.get(followeeId) || new Set();
    followers.add(followerId);
    this.followers.set(followeeId, followers);

    /**
     * BACKFILL TIMELINE
     * =================
     * Add followee's recent tweets to follower's timeline.
     * This ensures follower sees historical content immediately.
     * Typically adds last 100 tweets.
     */
    await this.addUserTweetsToTimeline(followerId, followeeId);

    return { followerId, followeeId, following: true };
  }

  /**
   * Add user's tweets to timeline
   */
  async addUserTweetsToTimeline(followerId, followeeId) {
    const followeeTweets = this.userTweets.get(followeeId) || [];
    const timeline = this.timelines.get(followerId) || [];

    // Add recent tweets (last 100)
    const recentTweets = followeeTweets.slice(0, 100);
    timeline.unshift(...recentTweets);
    
    // Sort by timestamp and limit
    timeline.sort((a, b) => {
      const tweetA = this.tweets.get(a);
      const tweetB = this.tweets.get(b);
      return (tweetB?.createdAt || 0) - (tweetA?.createdAt || 0);
    });

    if (timeline.length > 1000) {
      timeline.splice(1000);
    }

    this.timelines.set(followerId, timeline);
  }

  /**
   * Unfollow user
   */
  unfollow(followerId, followeeId) {
    const following = this.follows.get(followerId);
    if (following) {
      following.delete(followeeId);
    }

    const followers = this.followers.get(followeeId);
    if (followers) {
      followers.delete(followerId);
    }

    // Remove followee's tweets from timeline
    const timeline = this.timelines.get(followerId) || [];
    const followeeTweets = this.userTweets.get(followeeId) || new Set();
    const filteredTimeline = timeline.filter(tweetId => !followeeTweets.includes(tweetId));
    this.timelines.set(followerId, filteredTimeline);

    return { followerId, followeeId, following: false };
  }

  /**
   * Get home timeline (feed)
   * 
   * HOME TIMELINE RETRIEVAL:
   * ========================
   * Returns user's home feed (tweets from followed users).
   * 
   * PUSH MODEL BENEFIT:
   * ==================
   * Timeline is pre-computed, so reads are fast (O(1) lookup).
   * No need to query all followed users on read.
   * 
   * PROCESS:
   * 1. Get pre-computed timeline (tweet IDs)
   * 2. Fetch tweet objects for IDs
   * 3. Sort by timestamp (newest first)
   * 4. Return limited results
   * 
   * PERFORMANCE:
   * - Time Complexity: O(n) where n = limit (typically 20)
   * - Very fast because timeline is pre-computed
   * - In production: Would use Redis for timeline storage
   * 
   * RANKING:
   * - Currently sorted by timestamp (chronological)
   * - In production: Would use ML-based ranking (relevance, engagement)
   * 
   * @param {string} userId - User requesting timeline
   * @param {number} limit - Maximum number of tweets to return (default: 20)
   * @returns {Array<Object>} Array of tweet objects
   */
  getHomeTimeline(userId, limit = 20) {
    /**
     * GET PRE-COMPUTED TIMELINE
     * ========================
     * Retrieve pre-computed timeline (Push model benefit).
     * In production: Would fetch from Redis (fast in-memory access).
     */
    const timeline = this.timelines.get(userId) || [];
    const tweetIds = timeline.slice(0, limit);
    
    /**
     * FETCH TWEET OBJECTS
     * ===================
     * Map tweet IDs to actual tweet objects.
     * Filter out any deleted tweets.
     * Sort by timestamp (newest first).
     * 
     * IN PRODUCTION:
     * - Would use batch fetch from database
     * - Cache frequently accessed tweets
     * - Use ranking algorithm instead of simple timestamp sort
     */
    return tweetIds
      .map(id => this.tweets.get(id))
      .filter(tweet => tweet !== undefined)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get user timeline
   */
  getUserTimeline(userId, limit = 20) {
    const tweetIds = this.userTweets.get(userId) || [];
    return tweetIds
      .slice(0, limit)
      .map(id => this.tweets.get(id))
      .filter(tweet => tweet !== undefined);
  }

  /**
   * Like tweet
   */
  likeTweet(userId, tweetId) {
    const tweet = this.tweets.get(tweetId);
    if (!tweet) {
      throw new Error('Tweet not found');
    }

    const likes = this.likes.get(tweetId);
    if (!likes.has(userId)) {
      likes.add(userId);
      tweet.likes++;
    }

    return { liked: true, likes: tweet.likes };
  }

  /**
   * Retweet
   */
  retweet(userId, tweetId) {
    const tweet = this.tweets.get(tweetId);
    if (!tweet) {
      throw new Error('Tweet not found');
    }

    const retweets = this.retweets.get(tweetId);
    if (!retweets.has(userId)) {
      retweets.add(userId);
      tweet.retweets++;

      // Create retweet entry in user's timeline
      const retweet = {
        id: `retweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        originalTweetId: tweetId,
        createdAt: Date.now()
      };

      const userTweets = this.userTweets.get(userId) || [];
      userTweets.unshift(retweet.id);
      this.userTweets.set(userId, userTweets);

      // Add to followers' timelines
      this.addToFollowersTimelines(userId, retweet.id);
    }

    return { retweeted: true, retweets: tweet.retweets };
  }

  /**
   * Search tweets
   */
  searchTweets(query, limit = 20) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const tweet of this.tweets.values()) {
      if (tweet.content.toLowerCase().includes(queryLower)) {
        results.push(tweet);
      }
      if (results.length >= limit) break;
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get trending topics
   */
  getTrendingTopics(limit = 10) {
    const hashtags = new Map();

    for (const tweet of this.tweets.values()) {
      const matches = tweet.content.match(/#\w+/g);
      if (matches) {
        matches.forEach(tag => {
          const count = hashtags.get(tag) || 0;
          hashtags.set(tag, count + 1);
        });
      }
    }

    return Array.from(hashtags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }
}

// Example usage
async function demonstrateTwitter() {
  console.log('=== Design Twitter/X ===\n');

  const twitter = new TwitterService();

  // Create users
  console.log('=== Creating Users ===\n');
  const user1 = twitter.createUser('user1', 'alice', 'Alice');
  const user2 = twitter.createUser('user2', 'bob', 'Bob');
  const user3 = twitter.createUser('user3', 'charlie', 'Charlie');

  // Follow users
  console.log('=== Following Users ===\n');
  await twitter.follow('user1', 'user2');
  await twitter.follow('user1', 'user3');
  await twitter.follow('user2', 'user3');

  // Post tweets
  console.log('=== Posting Tweets ===\n');
  const tweet1 = await twitter.postTweet('user2', 'Hello world! #coding');
  console.log('Tweet 1:', tweet1);

  const tweet2 = await twitter.postTweet('user3', 'Working on a new project #webdev');
  console.log('Tweet 2:', tweet2);

  const tweet3 = await twitter.postTweet('user2', 'Just launched my app! #startup');
  console.log('Tweet 3:', tweet3);

  // Get home timeline
  console.log('\n=== Home Timeline ===\n');
  const homeTimeline = twitter.getHomeTimeline('user1');
  console.log('User1 Home Timeline:', homeTimeline.map(t => ({
    user: t.userId,
    content: t.content,
    time: new Date(t.createdAt).toISOString()
  })));

  // Like and retweet
  console.log('\n=== Interactions ===\n');
  twitter.likeTweet('user1', tweet1.id);
  twitter.retweet('user1', tweet2.id);
  console.log('User1 liked and retweeted');

  // Search
  console.log('\n=== Search ===\n');
  const searchResults = twitter.searchTweets('coding');
  console.log('Search Results:', searchResults.map(t => t.content));

  // Trending
  console.log('\n=== Trending Topics ===\n');
  const trending = twitter.getTrendingTopics();
  console.log('Trending:', trending);
}

if (require.main === module) {
  demonstrateTwitter();
}

module.exports = { TwitterService };

