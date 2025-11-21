/**
 * Design Instagram
 * Photo-sharing social network with feeds, stories, and direct messaging
 */

/**
 * Instagram Service
 */
class InstagramService {
  constructor() {
    this.users = new Map();
    this.posts = new Map();
    this.stories = new Map();
    this.follows = new Map();
    this.feedCache = new Map(); // User feed cache
    this.likes = new Map(); // postId -> Set of user IDs
    this.comments = new Map(); // postId -> List of comments
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
   */
  async uploadPost(userId, imageUrl, caption) {
    const post = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      imageUrl,
      caption,
      likes: 0,
      comments: 0,
      createdAt: Date.now()
    };

    this.posts.set(post.id, post);
    this.likes.set(post.id, new Set());
    this.comments.set(post.id, []);

    // Update user post count
    const user = this.users.get(userId);
    if (user) {
      user.posts++;
    }

    // Add to followers' feeds (Push model)
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

