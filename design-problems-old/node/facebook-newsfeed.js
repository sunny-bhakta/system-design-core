/**
 * Design Facebook News Feed
 * Personalized news feed system with ranking and real-time updates
 */

/**
 * News Feed Service
 */
class NewsFeedService {
  constructor() {
    this.users = new Map();
    this.posts = new Map();
    this.friends = new Map(); // userId -> Set of friend IDs
    this.feedCache = new Map(); // Pre-computed feeds
    this.engagement = new Map(); // postId -> engagement metrics
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
   */
  async computeFeed(userId, limit) {
    const friends = this.friends.get(userId) || new Set();
    const userInterests = this.userInterests.get(userId) || new Set();
    const candidatePosts = [];

    // Get posts from friends
    for (const post of this.posts.values()) {
      if (friends.has(post.userId)) {
        // Calculate relevance score
        const score = this.calculateRelevanceScore(post, userId, userInterests);
        candidatePosts.push({ post, score });
      }
    }

    // Sort by score
    candidatePosts.sort((a, b) => b.score - a.score);

    return candidatePosts.slice(0, limit).map(item => item.post);
  }

  /**
   * Calculate relevance score
   */
  calculateRelevanceScore(post, userId, userInterests) {
    let score = 0;

    // Recency (newer posts get higher score)
    const age = Date.now() - post.createdAt;
    const recencyScore = Math.max(0, 1 - (age / (7 * 24 * 60 * 60 * 1000))); // Decay over 7 days
    score += recencyScore * 0.3;

    // Engagement (likes, comments, shares)
    const engagement = this.engagement.get(post.id);
    const engagementScore = (engagement.likes * 1 + engagement.comments * 2 + engagement.shares * 3) / 100;
    score += engagementScore * 0.4;

    // Friend closeness (simplified - would use interaction history)
    score += 0.2;

    // Interest matching (simplified)
    // In real system, would analyze post content and match with user interests
    score += 0.1;

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

