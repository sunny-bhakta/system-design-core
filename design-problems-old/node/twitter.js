/**
 * Design Twitter/X
 * Social media platform with tweets, follows, and timelines
 */

/**
 * Twitter Service
 */
class TwitterService {
  constructor() {
    this.users = new Map();
    this.tweets = new Map();
    this.follows = new Map(); // userId -> Set of following user IDs
    this.followers = new Map(); // userId -> Set of follower user IDs
    this.timelines = new Map(); // userId -> List of tweet IDs
    this.userTweets = new Map(); // userId -> List of tweet IDs
    this.likes = new Map(); // tweetId -> Set of user IDs
    this.retweets = new Map(); // tweetId -> Set of user IDs
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
   */
  async postTweet(userId, content) {
    if (content.length > 280) {
      throw new Error('Tweet exceeds 280 characters');
    }

    const tweet = {
      id: `tweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      content,
      createdAt: Date.now(),
      likes: 0,
      retweets: 0,
      replies: 0
    };

    this.tweets.set(tweet.id, tweet);
    this.likes.set(tweet.id, new Set());
    this.retweets.set(tweet.id, new Set());

    // Add to user's tweets
    const userTweets = this.userTweets.get(userId) || [];
    userTweets.unshift(tweet.id);
    this.userTweets.set(userId, userTweets);

    // Add to followers' timelines (Push model)
    await this.addToFollowersTimelines(userId, tweet.id);

    return tweet;
  }

  /**
   * Add tweet to followers' timelines
   */
  async addToFollowersTimelines(userId, tweetId) {
    const followers = this.followers.get(userId) || new Set();
    
    for (const followerId of followers) {
      const timeline = this.timelines.get(followerId) || [];
      timeline.unshift(tweetId);
      // Keep only last 1000 tweets in timeline
      if (timeline.length > 1000) {
        timeline.pop();
      }
      this.timelines.set(followerId, timeline);
    }
  }

  /**
   * Follow user
   */
  async follow(followerId, followeeId) {
    if (followerId === followeeId) {
      throw new Error('Cannot follow yourself');
    }

    // Add to follows
    const following = this.follows.get(followerId) || new Set();
    following.add(followeeId);
    this.follows.set(followerId, following);

    // Add to followers
    const followers = this.followers.get(followeeId) || new Set();
    followers.add(followerId);
    this.followers.set(followeeId, followers);

    // Add followee's recent tweets to follower's timeline
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
   */
  getHomeTimeline(userId, limit = 20) {
    const timeline = this.timelines.get(userId) || [];
    const tweetIds = timeline.slice(0, limit);
    
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

