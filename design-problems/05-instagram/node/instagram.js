/**
 * Design Instagram
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Photo-sharing social network with feeds, stories, and direct messaging.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 1B+ users
 * - Photos: 500M photos/day = ~5,800 photos/second
 * - Storage: 500M/day * 200KB = 100TB/day = 36PB/year
 * - Bandwidth: 4.6GB/sec download, 1.16GB/sec upload
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → App Servers → Media Storage (S3) → CDN
 * 
 * KEY FEATURES:
 * - Upload photos/videos
 * - Follow/unfollow users
 * - View feed (photos from followed users)
 * - Like and comment on posts
 * - Stories (24-hour content)
 * - Explore page (discover posts)
 * - Direct messaging
 * 
 * MEDIA STORAGE:
 * - Object storage (S3-like) for photos/videos
 * - CDN (CloudFront) for global delivery
 * - Image processing (thumbnails, resizing)
 * - Video processing (transcoding, multiple qualities)
 * 
 * FEED GENERATION:
 * - Hybrid Push-Pull model (similar to Twitter)
 * - Push for regular users, Pull for celebrities
 * - Ranking algorithm (engagement, time decay)
 */

/**
 * Instagram Service
 * 
 * CORE FUNCTIONALITY:
 * ===================
 * Implements Instagram-like service with:
 * - User management
 * - Photo upload and storage
 * - Feed generation (Push model)
 * - Social interactions (likes, comments)
 * - Stories (24-hour content)
 * - Direct messaging
 * 
 * DATA STRUCTURES:
 * ================
 * - users: Map<userId, userData> - User information
 * - posts: Map<postId, postData> - All posts
 * - stories: Map<storyId, storyData> - Stories (24-hour content)
 * - follows: Map<userId, Set<followeeId>> - Follow relationships
 * - feedCache: Map<userId, Array<postId>> - Pre-computed feeds (Push model)
 * - likes: Map<postId, Set<userId>> - Users who liked each post
 * - comments: Map<postId, Array<comment>> - Comments on each post
 * - directMessages: Map<conversationId, Array<message>> - Direct messages
 * 
 * PRODUCTION CONSIDERATIONS:
 * - In production, would use:
 *   * SQL database for users, posts, follows
 *   * Object storage (S3) for media files
 *   * CDN for media delivery
 *   * Redis for feed caching
 *   * Message queue for async feed updates
 */
class InstagramService {
  /**
   * Constructor
   * 
   * INITIALIZES DATA STRUCTURES:
   * ============================
   * All data structures are in-memory Maps for simplicity.
   * In production, would use distributed databases and storage.
   */
  constructor() {
    /**
     * USER STORAGE
     * ============
     * Stores user information (id, username, email, bio, counts).
     * In production: SQL database (PostgreSQL, MySQL)
     */
    this.users = new Map();
    
    /**
     * POST STORAGE
     * ============
     * Stores all posts with metadata (imageUrl, caption, likes, comments).
     * In production: SQL database for metadata, object storage for images
     */
    this.posts = new Map();
    
    /**
     * STORIES STORAGE
     * ===============
     * Stores stories (24-hour content).
     * In production: SQL database with TTL, object storage for media
     */
    this.stories = new Map();
    
    /**
     * FOLLOW RELATIONSHIPS
     * ====================
     * Tracks who follows whom.
     * In production: SQL database with indexes
     */
    this.follows = new Map();
    
    /**
     * FEED CACHE (PUSH MODEL)
     * =======================
     * Pre-computed feeds for fast reads.
     * When user posts photo, it's pushed to all followers' feeds.
     * In production: Redis for fast feed access
     */
    this.feedCache = new Map(); // User feed cache
    
    /**
     * SOCIAL INTERACTIONS
     * ===================
     * Tracks likes and comments per post.
     * In production: SQL database or Redis for counters
     */
    this.likes = new Map(); // postId -> Set of user IDs
    this.comments = new Map(); // postId -> List of comments
    
    /**
     * DIRECT MESSAGING
     * ================
     * Stores direct messages between users.
     * In production: SQL database or NoSQL for messages
     */
    this.directMessages = new Map(); // conversationId -> messages
  }

  /**
   * Create user
   */
  createUser(userId, username, email) {
    this.users.set(userId, {
      id: userId,
      username,
      email,
      bio: '',
      followers: 0,
      following: 0,
      posts: 0,
      createdAt: Date.now()
    });
    this.follows.set(userId, new Set());
    this.feedCache.set(userId, []);
    return this.users.get(userId);
  }

  /**
   * Upload post
   * 
   * POST UPLOAD PROCESS (PUSH MODEL):
   * ==================================
   * 1. Create post object with metadata
   * 2. Store post in database
   * 3. Initialize like/comment tracking
   * 4. Update user post count
   * 5. Push to all followers' feeds (Fan-out on Write)
   * 
   * MEDIA UPLOAD:
   * ============
   * In production, image upload would:
   * 1. Upload to object storage (S3)
   * 2. Generate thumbnails and multiple sizes
   * 3. Store image URLs in post metadata
   * 4. Serve via CDN for fast delivery
   * 
   * PUSH MODEL (FAN-OUT):
   * ====================
   * Similar to Twitter - push post to all followers' feeds immediately.
   * Fast reads, but slow writes for users with many followers.
   * 
   * PERFORMANCE:
   * - Time Complexity: O(f) where f = number of followers
   * - For celebrities: Use async queue or Pull model
   * 
   * @param {string} userId - User uploading the post
   * @param {string} imageUrl - URL of uploaded image
   * @param {string} caption - Post caption
   * @returns {Promise<Object>} Created post object
   */
  async uploadPost(userId, imageUrl, caption) {
    /**
     * STEP 1: CREATE POST OBJECT
     * ===========================
     * Generate unique post ID and store metadata.
     * In production: Would use distributed ID generator (Snowflake)
     */
    const post = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      imageUrl,
      caption,
      likes: 0,
      comments: 0,
      createdAt: Date.now()
    };

    /**
     * STEP 2: STORE POST
     * ==================
     * Save post to database.
     * In production: SQL database for metadata, object storage for images
     */
    this.posts.set(post.id, post);
    this.likes.set(post.id, new Set());
    this.comments.set(post.id, []);

    /**
     * STEP 3: UPDATE USER STATS
     * =========================
     * Increment user's post count.
     */
    const user = this.users.get(userId);
    if (user) {
      user.posts++;
    }

    /**
     * STEP 4: PUSH TO FOLLOWERS' FEEDS (FAN-OUT)
     * ===========================================
     * Add post to all followers' pre-computed feeds.
     * This is the "Push Model" - fan-out on write.
     * 
     * OPTIMIZATION:
     * - For users with > 1M followers, use async queue
     * - Background job processes fan-out
     * - Or use Pull model instead
     */
    await this.addToFollowersFeeds(userId, post.id);

    return post;
  }

  /**
   * Add post to followers' feeds
   */
  async addToFollowersFeeds(userId, postId) {
    const user = this.users.get(userId);
    const followers = this.getFollowers(userId);

    for (const followerId of followers) {
      const feed = this.feedCache.get(followerId) || [];
      feed.unshift(postId);
      // Keep only last 500 posts
      if (feed.length > 500) {
        feed.pop();
      }
      this.feedCache.set(followerId, feed);
    }
  }

  /**
   * Get followers
   */
  getFollowers(userId) {
    const followers = [];
    for (const [uid, following] of this.follows.entries()) {
      if (following.has(userId)) {
        followers.push(uid);
      }
    }
    return followers;
  }

  /**
   * Follow user
   */
  async follow(followerId, followeeId) {
    if (followerId === followeeId) {
      throw new Error('Cannot follow yourself');
    }

    const following = this.follows.get(followerId) || new Set();
    following.add(followeeId);
    this.follows.set(followerId, following);

    // Update counts
    const follower = this.users.get(followerId);
    const followee = this.users.get(followeeId);
    if (follower) follower.following++;
    if (followee) followee.followers++;

    // Add followee's recent posts to feed
    await this.addUserPostsToFeed(followerId, followeeId);

    return { following: true };
  }

  /**
   * Add user's posts to feed
   */
  async addUserPostsToFeed(followerId, followeeId) {
    // Get followee's recent posts
    const followeePosts = this.getUserPosts(followeeId, 100);
    const feed = this.feedCache.get(followerId) || [];
    
    // Merge and sort by timestamp
    feed.push(...followeePosts.map(p => p.id));
    feed.sort((a, b) => {
      const postA = this.posts.get(a);
      const postB = this.posts.get(b);
      return (postB?.createdAt || 0) - (postA?.createdAt || 0);
    });

    if (feed.length > 500) {
      feed.splice(500);
    }

    this.feedCache.set(followerId, feed);
  }

  /**
   * Get user posts
   */
  getUserPosts(userId, limit = 20) {
    const posts = [];
    for (const post of this.posts.values()) {
      if (post.userId === userId) {
        posts.push(post);
      }
    }
    return posts
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get feed
   */
  getFeed(userId, limit = 20) {
    const feedIds = this.feedCache.get(userId) || [];
    return feedIds
      .slice(0, limit)
      .map(id => this.posts.get(id))
      .filter(post => post !== undefined)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Like post
   */
  likePost(userId, postId) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const likes = this.likes.get(postId);
    if (!likes.has(userId)) {
      likes.add(userId);
      post.likes++;
    }

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

    const comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      postId,
      text,
      createdAt: Date.now()
    };

    const comments = this.comments.get(postId) || [];
    comments.push(comment);
    this.comments.set(postId, comments);
    post.comments++;

    return comment;
  }

  /**
   * Create story
   */
  createStory(userId, imageUrl, duration = 86400000) {
    const story = {
      id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      imageUrl,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
      views: 0
    };

    if (!this.stories.has(userId)) {
      this.stories.set(userId, []);
    }

    const userStories = this.stories.get(userId);
    userStories.push(story);
    
    // Remove expired stories
    this.cleanupExpiredStories(userId);

    return story;
  }

  /**
   * View story
   */
  viewStory(viewerId, userId, storyId) {
    const userStories = this.stories.get(userId) || [];
    const story = userStories.find(s => s.id === storyId);
    
    if (!story) {
      throw new Error('Story not found');
    }

    if (Date.now() > story.expiresAt) {
      throw new Error('Story has expired');
    }

    story.views++;
    return { viewed: true, views: story.views };
  }

  /**
   * Get stories
   */
  getStories(userId) {
    const following = this.follows.get(userId) || new Set();
    const stories = [];

    for (const followeeId of following) {
      const userStories = this.stories.get(followeeId) || [];
      const activeStories = userStories.filter(s => Date.now() < s.expiresAt);
      if (activeStories.length > 0) {
        stories.push({
          userId: followeeId,
          stories: activeStories
        });
      }
    }

    return stories;
  }

  /**
   * Cleanup expired stories
   */
  cleanupExpiredStories(userId) {
    const userStories = this.stories.get(userId) || [];
    const activeStories = userStories.filter(s => Date.now() < s.expiresAt);
    this.stories.set(userId, activeStories);
  }

  /**
   * Send direct message
   */
  sendDirectMessage(senderId, recipientId, text) {
    const conversationId = [senderId, recipientId].sort().join('_');

    if (!this.directMessages.has(conversationId)) {
      this.directMessages.set(conversationId, []);
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId,
      recipientId,
      text,
      createdAt: Date.now(),
      read: false
    };

    const messages = this.directMessages.get(conversationId);
    messages.push(message);

    return message;
  }

  /**
   * Get direct messages
   */
  getDirectMessages(userId1, userId2) {
    const conversationId = [userId1, userId2].sort().join('_');
    return this.directMessages.get(conversationId) || [];
  }

  /**
   * Explore page (discover posts)
   */
  explorePosts(userId, limit = 20) {
    const following = this.follows.get(userId) || new Set();
    const explorePosts = [];

    for (const post of this.posts.values()) {
      // Exclude posts from users being followed
      if (!following.has(post.userId)) {
        explorePosts.push(post);
      }
      if (explorePosts.length >= limit * 2) break;
    }

    // Sort by engagement (likes + comments)
    return explorePosts
      .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
      .slice(0, limit);
  }
}

// Example usage
async function demonstrateInstagram() {
  console.log('=== Design Instagram ===\n');

  const instagram = new InstagramService();

  // Create users
  const user1 = instagram.createUser('user1', 'alice', 'alice@example.com');
  const user2 = instagram.createUser('user2', 'bob', 'bob@example.com');
  const user3 = instagram.createUser('user3', 'charlie', 'charlie@example.com');

  // Follow users
  await instagram.follow('user1', 'user2');
  await instagram.follow('user1', 'user3');

  // Upload posts
  const post1 = await instagram.uploadPost('user2', 'https://example.com/image1.jpg', 'Beautiful sunset! #photography');
  const post2 = await instagram.uploadPost('user3', 'https://example.com/image2.jpg', 'Coffee time ☕');

  // Get feed
  const feed = instagram.getFeed('user1');
  console.log('Feed:', feed.map(p => ({ user: p.userId, caption: p.caption })));

  // Like and comment
  instagram.likePost('user1', post1.id);
  instagram.commentOnPost('user1', post1.id, 'Amazing!');

  // Create story
  const story = instagram.createStory('user2', 'https://example.com/story.jpg');
  console.log('Story created:', story.id);

  // Explore
  const explore = instagram.explorePosts('user1');
  console.log('Explore posts:', explore.length);
}

if (require.main === module) {
  demonstrateInstagram();
}

module.exports = { InstagramService };

