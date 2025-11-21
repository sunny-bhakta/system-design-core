/**
 * Design Facebook News Feed
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Personalized news feed system with ranking and real-time updates.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 2B+ users
 * - Posts: 500M posts/day = ~5,800 posts/second
 * - Feed reads: 23K reads/second
 * - Storage: 500M/day * 1KB = 500GB/day = 182TB/year
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → Feed Service → Ranking Service → Database
 * 
 * KEY FEATURES:
 * - Personalized feed generation
 * - Relevance ranking algorithm
 * - Real-time updates
 * - Multiple post types (text, photo, video, link)
 * - Engagement tracking
 * - Feed caching
 * 
 * FEED GENERATION STRATEGY:
 * - Pre-computation: Generate feeds offline
 * - Real-time: Merge new posts on-the-fly
 * - Caching: Cache pre-computed feeds in Redis
 * 
 * RANKING ALGORITHM:
 * - Recency (30%): Newer posts ranked higher
 * - Engagement (40%): Likes, comments, shares
 * - Friend closeness (20%): Interaction history
 * - Interest matching (10%): Content relevance
 */

/**
 * News Feed Service
 * 
 * CORE FUNCTIONALITY:
 * ===================
 * Implements personalized news feed with:
 * - User and friend management
 * - Post creation and storage
 * - Feed generation with ranking
 * - Engagement tracking (likes, comments, shares)
 * - Real-time feed updates
 * - Feed filtering and sorting
 * 
 * DATA STRUCTURES:
 * ================
 * - users: Map<userId, userData> - User information
 * - posts: Map<postId, postData> - All posts
 * - friends: Map<userId, Set<friendId>> - Friend relationships
 * - feedCache: Map<userId, Array<postId>> - Pre-computed feeds
 * - engagement: Map<postId, engagementData> - Engagement metrics
 * - userInterests: Map<userId, Set<interest>> - User interests for personalization
 * 
 * PRODUCTION CONSIDERATIONS:
 * - In production, would use:
 *   * SQL database for users, posts, friendships
 *   * Graph database for friend relationships
 *   * Redis for feed caching
 *   * ML service for relevance ranking
 *   * Message queue for real-time updates
 */
class NewsFeedService {
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
     * Stores user information.
     * In production: SQL database (PostgreSQL, MySQL)
     */
    this.users = new Map();
    
    /**
     * POST STORAGE
     * ============
     * Stores all posts with metadata.
     * In production: SQL database for metadata, object storage for media
     */
    this.posts = new Map();
    
    /**
     * FRIEND RELATIONSHIPS
     * ====================
     * Tracks bidirectional friend relationships.
     * In production: Graph database (Neo4j) or SQL with indexes
     */
    this.friends = new Map(); // userId -> Set of friend IDs
    
    /**
     * FEED CACHE
     * ==========
     * Pre-computed feeds for fast reads.
     * In production: Redis for fast feed access with TTL
     */
    this.feedCache = new Map(); // Pre-computed feeds
    
    /**
     * ENGAGEMENT METRICS
     * ==================
     * Tracks engagement per post (likes, comments, shares, clicks, time spent).
     * Used for ranking algorithm.
     * In production: SQL database or Redis for counters
     */
    this.engagement = new Map(); // postId -> engagement metrics
    
    /**
     * USER INTERESTS
     * =============
     * Stores user interests for personalization.
     * Used in relevance score calculation.
     * In production: SQL database or ML feature store
     */
    this.userInterests = new Map(); // userId -> interests
  }

  /**
   * Create user
   */
  createUser(userId, name, interests = []) {
    this.users.set(userId, {
      id: userId,
      name,
      createdAt: Date.now()
    });
    this.friends.set(userId, new Set());
    this.feedCache.set(userId, []);
    this.userInterests.set(userId, new Set(interests));
    return this.users.get(userId);
  }

  /**
   * Add friend
   */
  addFriend(userId1, userId2) {
    const friends1 = this.friends.get(userId1) || new Set();
    const friends2 = this.friends.get(userId2) || new Set();
    
    friends1.add(userId2);
    friends2.add(userId1);
    
    this.friends.set(userId1, friends1);
    this.friends.set(userId2, friends2);

    // Invalidate feed cache
    this.feedCache.delete(userId1);
    this.feedCache.delete(userId2);

    return { friends: true };
  }

  /**
   * Create post
   */
  async createPost(userId, content, type = 'text') {
    const post = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      content,
      type, // text, photo, video, link
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: Date.now(),
      score: 0 // Relevance score
    };

    this.posts.set(post.id, post);
    this.engagement.set(post.id, {
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      timeSpent: 0
    });

    // Invalidate friends' feed caches
    const friends = this.friends.get(userId) || new Set();
    for (const friendId of friends) {
      this.feedCache.delete(friendId);
    }

    return post;
  }

  /**
   * Generate feed
   */
  async generateFeed(userId, limit = 20) {
    // Check cache first
    if (this.feedCache.has(userId)) {
      const cached = this.feedCache.get(userId);
      if (cached.length >= limit) {
        return cached.slice(0, limit);
      }
    }

    // Generate feed
    const feed = await this.computeFeed(userId, limit);
    
    // Cache feed
    this.feedCache.set(userId, feed);

    return feed;
  }

  /**
   * Compute feed with ranking
   * 
   * FEED GENERATION PROCESS:
   * ========================
   * Generates personalized feed with relevance ranking.
   * 
   * PROCESS:
   * 1. Get user's friends
   * 2. Get user's interests
   * 3. Collect posts from friends (candidate posts)
   * 4. Calculate relevance score for each post
   * 5. Sort by score (highest first)
   * 6. Return top N posts
   * 
   * PERFORMANCE:
   * - Time Complexity: O(p) where p = total posts (inefficient for large scale)
   * - In production: Would use:
   *   * Pre-filtering: Only get recent posts (last 7 days)
   *   * Indexing: Index posts by user_id and created_at
   *   * Batch processing: Pre-compute feeds offline
   *   * ML ranking: Use ML model for faster ranking
   * 
   * OPTIMIZATION:
   * - Pre-compute feeds offline (background jobs)
   * - Cache pre-computed feeds
   * - Incremental updates: Only re-rank when new posts arrive
   * 
   * @param {string} userId - User requesting feed
   * @param {number} limit - Maximum number of posts to return
   * @returns {Promise<Array<Object>>} Array of ranked post objects
   */
  async computeFeed(userId, limit) {
    /**
     * STEP 1: GET USER CONTEXT
     * ========================
     * Retrieve user's friends and interests for personalization.
     */
    const friends = this.friends.get(userId) || new Set();
    const userInterests = this.userInterests.get(userId) || new Set();
    const candidatePosts = [];

    /**
     * STEP 2: COLLECT CANDIDATE POSTS
     * ===============================
     * Get all posts from friends.
     * In production: Would query database with:
     * - WHERE user_id IN (friends)
     * - AND created_at > (7 days ago)
     * - ORDER BY created_at DESC
     * - LIMIT 1000 (top candidates)
     */
    for (const post of this.posts.values()) {
      if (friends.has(post.userId)) {
        /**
         * STEP 3: CALCULATE RELEVANCE SCORE
         * =================================
         * Calculate personalized relevance score for ranking.
         */
        const score = this.calculateRelevanceScore(post, userId, userInterests);
        candidatePosts.push({ post, score });
      }
    }

    /**
     * STEP 4: SORT BY SCORE
     * =====================
     * Sort candidate posts by relevance score (highest first).
     */
    candidatePosts.sort((a, b) => b.score - a.score);

    /**
     * STEP 5: RETURN TOP N
     * ====================
     * Return top N posts based on limit.
     */
    return candidatePosts.slice(0, limit).map(item => item.post);
  }

  /**
   * Calculate relevance score
   * 
   * RANKING ALGORITHM:
   * ==================
   * Calculates relevance score for post ranking in feed.
   * 
   * SCORE COMPONENTS:
   * 1. Recency (30%): Newer posts get higher score
   *    - Decay over 7 days
   *    - Formula: max(0, 1 - age / 7_days)
   * 
   * 2. Engagement (40%): Likes, comments, shares
   *    - Weighted: likes=1, comments=2, shares=3
   *    - Normalized by dividing by 100
   * 
   * 3. Friend Closeness (20%): Interaction history
   *    - Simplified: constant 0.2
   *    - In production: Based on past interactions, messages, etc.
   * 
   * 4. Interest Matching (10%): Content relevance
   *    - Simplified: constant 0.1
   *    - In production: ML-based content analysis and matching
   * 
   * FINAL SCORE:
   * score = (recency * 0.3) + (engagement * 0.4) + (closeness * 0.2) + (interest * 0.1)
   * 
   * IN PRODUCTION:
   * - Would use ML model for more sophisticated ranking
   * - Consider user behavior patterns
   * - A/B test different ranking algorithms
   * - Continuously optimize weights
   * 
   * @param {Object} post - Post object
   * @param {string} userId - User viewing the feed
   * @param {Set} userInterests - User's interests
   * @returns {number} Relevance score (0 to 1)
   */
  calculateRelevanceScore(post, userId, userInterests) {
    let score = 0;

    /**
     * COMPONENT 1: RECENCY (30%)
     * ==========================
     * Newer posts get higher score.
     * Decay over 7 days (posts older than 7 days get 0 recency score).
     */
    const age = Date.now() - post.createdAt;
    const recencyScore = Math.max(0, 1 - (age / (7 * 24 * 60 * 60 * 1000))); // Decay over 7 days
    score += recencyScore * 0.3;

    /**
     * COMPONENT 2: ENGAGEMENT (40%)
     * =============================
     * Higher engagement = higher score.
     * Weighted: likes=1, comments=2, shares=3 (shares are most valuable).
     * Normalized by dividing by 100 to keep score in reasonable range.
     */
    const engagement = this.engagement.get(post.id);
    const engagementScore = (engagement.likes * 1 + engagement.comments * 2 + engagement.shares * 3) / 100;
    score += engagementScore * 0.4;

    /**
     * COMPONENT 3: FRIEND CLOSENESS (20%)
     * ===================================
     * Posts from closer friends ranked higher.
     * Simplified: constant 0.2 for all friends.
     * In production: Based on interaction history, messages, mutual friends, etc.
     */
    score += 0.2;

    /**
     * COMPONENT 4: INTEREST MATCHING (10%)
     * ====================================
     * Posts matching user interests ranked higher.
     * Simplified: constant 0.1.
     * In production: ML-based content analysis, NLP, topic modeling.
     */
    score += 0.1;

    /**
     * STORE SCORE
     * ===========
     * Store calculated score in post object for sorting.
     */
    post.score = score;
    return score;
  }

  /**
   * Like post
   */
  likePost(userId, postId) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    post.likes++;
    const engagement = this.engagement.get(postId);
    engagement.likes++;

    // Invalidate feed caches that include this post
    this.invalidateFeedCaches(postId);

    return { liked: true, likes: post.likes };
  }

  /**
   * Comment on post
   */
  commentOnPost(userId, postId, text) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    post.comments++;
    const engagement = this.engagement.get(postId);
    engagement.comments++;

    this.invalidateFeedCaches(postId);

    return { commented: true, comments: post.comments };
  }

  /**
   * Share post
   */
  sharePost(userId, postId) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    post.shares++;
    const engagement = this.engagement.get(postId);
    engagement.shares++;

    // Create new post for the share
    const sharePost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type: 'share',
      originalPostId: postId,
      createdAt: Date.now(),
      likes: 0,
      comments: 0,
      shares: 0,
      score: 0
    };

    this.posts.set(sharePost.id, sharePost);
    this.engagement.set(sharePost.id, {
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      timeSpent: 0
    });

    this.invalidateFeedCaches(postId);

    return sharePost;
  }

  /**
   * Invalidate feed caches containing post
   */
  invalidateFeedCaches(postId) {
    // In real system, would track which feeds contain which posts
    // For simplicity, invalidate all caches
    this.feedCache.clear();
  }

  /**
   * Get feed with real-time updates
   */
  async getFeedWithUpdates(userId, lastUpdateTime = 0) {
    const feed = await this.generateFeed(userId, 20);
    
    // Filter for new posts since last update
    const newPosts = feed.filter(post => post.createdAt > lastUpdateTime);
    
    return {
      feed: newPosts.length > 0 ? newPosts : feed.slice(0, 10),
      hasUpdates: newPosts.length > 0,
      timestamp: Date.now()
    };
  }

  /**
   * Filter feed by type
   */
  filterFeedByType(userId, type) {
    const feed = this.feedCache.get(userId) || [];
    return feed.filter(post => post.type === type);
  }

  /**
   * Sort feed
   */
  sortFeed(feed, sortBy = 'relevance') {
    switch (sortBy) {
      case 'relevance':
        return feed.sort((a, b) => (b.score || 0) - (a.score || 0));
      case 'recent':
        return feed.sort((a, b) => b.createdAt - a.createdAt);
      case 'popular':
        return feed.sort((a, b) => 
          (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares)
        );
      default:
        return feed;
    }
  }
}

// Example usage
async function demonstrateFacebookNewsFeed() {
  console.log('=== Design Facebook News Feed ===\n');

  const newsFeed = new NewsFeedService();

  // Create users
  const user1 = newsFeed.createUser('user1', 'Alice', ['tech', 'travel']);
  const user2 = newsFeed.createUser('user2', 'Bob', ['sports', 'music']);
  const user3 = newsFeed.createUser('user3', 'Charlie', ['tech', 'gaming']);

  // Add friends
  newsFeed.addFriend('user1', 'user2');
  newsFeed.addFriend('user1', 'user3');
  newsFeed.addFriend('user2', 'user3');

  // Create posts
  const post1 = await newsFeed.createPost('user2', 'Great game today!', 'text');
  const post2 = await newsFeed.createPost('user3', 'New tech release', 'link');
  const post3 = await newsFeed.createPost('user2', 'Amazing concert', 'photo');

  // Generate feed
  const feed = await newsFeed.generateFeed('user1');
  console.log('Feed:', feed.map(p => ({
    user: p.userId,
    content: p.content.substring(0, 30),
    score: p.score.toFixed(2)
  })));

  // Engagement
  newsFeed.likePost('user1', post1.id);
  newsFeed.commentOnPost('user1', post2.id, 'Interesting!');
  newsFeed.sharePost('user1', post3.id);

  // Regenerate feed with updated scores
  const updatedFeed = await newsFeed.generateFeed('user1');
  console.log('\nUpdated Feed:', updatedFeed.map(p => ({
    content: p.content.substring(0, 30),
    score: p.score.toFixed(2),
    engagement: p.likes + p.comments + p.shares
  })));
}

if (require.main === module) {
  demonstrateFacebookNewsFeed();
}

module.exports = { NewsFeedService };

