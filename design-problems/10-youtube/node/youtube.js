/**
 * Design YouTube
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Video sharing platform with upload, streaming, comments, and recommendations.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 2B+ users
 * - Video Upload: 500 hours/minute = 8.3 hours/second
 * - Storage: 500 hours/min * 1GB/hour = 500GB/min = 720TB/day = 262PB/year
 * - Encoded versions: 3 qualities * 262PB = 786PB/year
 * - Streaming: 1B views/day * 100MB = 100PB/day = 1.16TB/sec
 * 
 * ARCHITECTURE:
 * Client → CDN (Edge) → Video Service → Encoding Pipeline → Object Storage
 * 
 * KEY FEATURES:
 * - Video upload and processing
 * - Multi-quality video streaming
 * - Comments and likes
 * - Subscriptions
 * - Recommendations
 * - Search functionality
 * - Playlists
 * - Channel management
 * 
 * VIDEO PROCESSING:
 * - Encoding pipeline: Upload → Validate → Transcode → Store → CDN
 * - Multiple qualities: SD, HD, FHD, 4K
 * - Adaptive bitrate streaming (HLS)
 * 
 * RECOMMENDATIONS:
 * - Collaborative filtering: Similar users
 * - Content-based: Similar videos
 * - Hybrid approach: Combine both
 */
class YouTubeService {
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
     * Stores user information.
     * In production: SQL database (PostgreSQL, MySQL)
     */
    this.users = new Map();
    
    /**
     * CHANNEL STORAGE
     * ===============
     * Stores channel information (subscribers, videos count).
     * In production: SQL database
     */
    this.channels = new Map(); // userId -> channel data
    
    /**
     * VIDEO STORAGE
     * =============
     * Stores video metadata (title, description, views, etc.).
     * In production: SQL database for metadata, object storage for videos
     */
    this.videos = new Map();
    
    /**
     * COMMENTS STORAGE
     * ================
     * Stores comments per video.
     * In production: NoSQL database (MongoDB, Cassandra)
     */
    this.comments = new Map(); // videoId -> List of comments
    
    /**
     * LIKES STORAGE
     * =============
     * Tracks users who liked each video.
     * In production: SQL database or Redis
     */
    this.likes = new Map(); // videoId -> Set of user IDs
    
    /**
     * SUBSCRIPTIONS
     * =============
     * Tracks user subscriptions to channels.
     * In production: SQL database with indexes
     */
    this.subscriptions = new Map(); // userId -> Set of channel IDs
    
    /**
     * WATCH HISTORY
     * ============
     * Tracks user watch history for recommendations.
     * In production: NoSQL database (MongoDB, Cassandra)
     */
    this.watchHistory = new Map(); // userId -> List of video IDs
    
    /**
     * RECOMMENDATIONS
     * ===============
     * Pre-computed personalized recommendations per user.
     * In production: Redis for fast access, ML service for generation
     */
    this.recommendations = new Map(); // userId -> List of video IDs
  }

  /**
   * Create user
   */
  createUser(userId, username, email) {
    const user = {
      id: userId,
      username,
      email,
      createdAt: Date.now()
    };

    this.users.set(userId, user);
    this.channels.set(userId, {
      userId,
      name: username,
      subscribers: 0,
      videos: 0,
      createdAt: Date.now()
    });
    this.subscriptions.set(userId, new Set());
    this.watchHistory.set(userId, []);
    this.recommendations.set(userId, []);

    return user;
  }

  /**
   * Upload video
   * 
   * VIDEO UPLOAD PROCESS:
   * ====================
   * Handles video upload and initiates processing pipeline.
   * 
   * PROCESS:
   * 1. Validate channel exists
   * 2. Create video object with metadata
   * 3. Store video metadata
   * 4. Initialize comments and likes
   * 5. Update channel video count
   * 6. Queue for processing (encoding, thumbnails, etc.)
   * 7. Return video object
   * 
   * VIDEO PROCESSING PIPELINE (PRODUCTION):
   * =======================================
   * 1. Upload: Original video uploaded to object storage
   * 2. Validation: Check format, size, content
   * 3. Transcoding: Encode to multiple qualities (SD, HD, FHD, 4K)
   * 4. Thumbnail Generation: Create thumbnails for UI
   * 5. Metadata Extraction: Extract duration, resolution, codec
   * 6. HLS Segmentation: Split into segments for adaptive streaming
   * 7. Storage: Store in object storage
   * 8. CDN Distribution: Push to CDN edge locations
   * 9. Indexing: Index for search (Elasticsearch)
   * 10. Status Update: Mark as published when ready
   * 
   * IN PRODUCTION:
   * - Would use encoding service (AWS MediaConvert, FFmpeg)
   * - Background jobs for processing
   * - Progress tracking and notifications
   * - Error handling and retries
   * 
   * @param {string} userId - Channel owner ID
   * @param {string} title - Video title
   * @param {string} description - Video description
   * @param {string} videoUrl - Original video URL
   * @param {Object} metadata - Additional metadata (tags, category, etc.)
   * @returns {Promise<Object>} Created video object
   */
  async uploadVideo(userId, title, description, videoUrl, metadata = {}) {
    /**
     * STEP 1: VALIDATE CHANNEL
     * ========================
     * Check if user has a channel (required for uploading).
     */
    const channel = this.channels.get(userId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    /**
     * STEP 2: CREATE VIDEO OBJECT
     * ===========================
     * Generate unique video ID and store metadata.
     * In production: Would use distributed ID generator (Snowflake).
     */
    const video = {
      id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      title,
      description,
      videoUrl,
      thumbnailUrl: metadata.thumbnailUrl || `${videoUrl}_thumb.jpg`,
      duration: metadata.duration || 0,
      views: 0,
      likes: 0,
      comments: 0,
      tags: metadata.tags || [],
      category: metadata.category || 'Entertainment',
      createdAt: Date.now(),
      status: 'processing' // processing → published
    };

    /**
     * STEP 3: STORE VIDEO
     * ===================
     * Save video metadata to database.
     * Initialize comments and likes tracking.
     */
    this.videos.set(video.id, video);
    this.comments.set(video.id, []);
    this.likes.set(video.id, new Set());

    /**
     * STEP 4: UPDATE CHANNEL
     * =====================
     * Increment channel's video count.
     */
    channel.videos++;

    /**
     * STEP 5: QUEUE FOR PROCESSING
     * =============================
     * In production: Would add to encoding queue (Kafka, RabbitMQ).
     * Background workers process encoding, thumbnails, etc.
     * Here: Simulate processing with timeout.
     */
    setTimeout(() => {
      video.status = 'published';
    }, 1000);

    return video;
  }

  /**
   * Get video stream
   */
  async getVideoStream(videoId, quality = 'HD') {
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    if (video.status !== 'published') {
      throw new Error('Video not available');
    }

    // Increment views
    video.views++;

    return {
      videoId,
      quality,
      streamUrl: `${video.videoUrl}_${quality.toLowerCase()}.mp4`,
      manifestUrl: `${video.videoUrl}_${quality.toLowerCase()}.m3u8`
    };
  }

  /**
   * Add comment
   */
  addComment(userId, videoId, text) {
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      videoId,
      text,
      likes: 0,
      createdAt: Date.now()
    };

    const comments = this.comments.get(videoId) || [];
    comments.push(comment);
    this.comments.set(videoId, comments);
    video.comments++;

    return comment;
  }

  /**
   * Like video
   */
  likeVideo(userId, videoId) {
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const likes = this.likes.get(videoId);
    if (!likes.has(userId)) {
      likes.add(userId);
      video.likes++;
    }

    return { liked: true, likes: video.likes };
  }

  /**
   * Subscribe to channel
   */
  subscribe(userId, channelUserId) {
    const subscriptions = this.subscriptions.get(userId) || new Set();
    
    if (!subscriptions.has(channelUserId)) {
      subscriptions.add(channelUserId);
      this.subscriptions.set(userId, subscriptions);

      const channel = this.channels.get(channelUserId);
      if (channel) {
        channel.subscribers++;
      }
    }

    return { subscribed: true, subscribers: channel.subscribers };
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(userId, channelUserId) {
    const subscriptions = this.subscriptions.get(userId);
    if (subscriptions && subscriptions.has(channelUserId)) {
      subscriptions.delete(channelUserId);

      const channel = this.channels.get(channelUserId);
      if (channel) {
        channel.subscribers--;
      }
    }

    return { subscribed: false, subscribers: channel.subscribers };
  }

  /**
   * Record watch history
   */
  recordWatchHistory(userId, videoId) {
    const history = this.watchHistory.get(userId) || [];
    
    // Remove if already exists
    const index = history.indexOf(videoId);
    if (index > -1) {
      history.splice(index, 1);
    }

    // Add to front
    history.unshift(videoId);

    // Keep only last 100
    if (history.length > 100) {
      history.pop();
    }

    this.watchHistory.set(userId, history);

    // Update recommendations
    this.updateRecommendations(userId);
  }

  /**
   * Update recommendations
   */
  updateRecommendations(userId) {
    const history = this.watchHistory.get(userId) || [];
    const watchedCategories = new Map();

    // Analyze watch history
    for (const videoId of history.slice(0, 10)) {
      const video = this.videos.get(videoId);
      if (video) {
        const count = watchedCategories.get(video.category) || 0;
        watchedCategories.set(video.category, count + 1);
      }
    }

    // Find similar videos
    const recommendations = [];
    for (const video of this.videos.values()) {
      if (video.status === 'published' && video.userId !== userId) {
        const categoryCount = watchedCategories.get(video.category) || 0;
        if (categoryCount > 0) {
          recommendations.push({
            video,
            score: categoryCount * video.views * (video.likes + 1)
          });
        }
      }
    }

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);
    const topRecommendations = recommendations.slice(0, 20).map(r => r.video.id);

    this.recommendations.set(userId, topRecommendations);
  }

  /**
   * Get recommendations
   */
  getRecommendations(userId, limit = 10) {
    const recommendationIds = this.recommendations.get(userId) || [];
    return recommendationIds
      .slice(0, limit)
      .map(id => this.videos.get(id))
      .filter(video => video !== undefined);
  }

  /**
   * Search videos
   */
  searchVideos(query, limit = 20) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const video of this.videos.values()) {
      if (video.status === 'published') {
        if (video.title.toLowerCase().includes(queryLower) ||
            video.description.toLowerCase().includes(queryLower) ||
            video.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
          results.push(video);
        }
        if (results.length >= limit * 2) break;
      }
    }

    // Sort by relevance (views * likes)
    results.sort((a, b) => (b.views * (b.likes + 1)) - (a.views * (a.likes + 1)));

    return results.slice(0, limit);
  }

  /**
   * Get trending videos
   */
  getTrendingVideos(limit = 20) {
    const videos = Array.from(this.videos.values())
      .filter(v => v.status === 'published')
      .sort((a, b) => {
        // Trending score: views in last 24 hours * engagement
        const scoreA = a.views * (a.likes + a.comments + 1);
        const scoreB = b.views * (b.likes + b.comments + 1);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return videos;
  }

  /**
   * Get channel videos
   */
  getChannelVideos(channelUserId, limit = 20) {
    const videos = [];
    for (const video of this.videos.values()) {
      if (video.userId === channelUserId && video.status === 'published') {
        videos.push(video);
      }
    }

    return videos
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get subscriptions feed
   */
  getSubscriptionsFeed(userId, limit = 20) {
    const subscriptions = this.subscriptions.get(userId) || new Set();
    const videos = [];

    for (const channelUserId of subscriptions) {
      const channelVideos = this.getChannelVideos(channelUserId, 5);
      videos.push(...channelVideos);
    }

    return videos
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
}

// Example usage
async function demonstrateYouTube() {
  console.log('=== Design YouTube ===\n');

  const youtube = new YouTubeService();

  // Create users
  const user1 = youtube.createUser('user1', 'Alice', 'alice@example.com');
  const user2 = youtube.createUser('user2', 'Bob', 'bob@example.com');

  // Upload video
  const video = await youtube.uploadVideo(
    'user1',
    'How to Code',
    'Learn programming basics',
    'https://storage.youtube.com/videos/code.mp4',
    { category: 'Education', tags: ['programming', 'coding'] }
  );
  console.log('Video uploaded:', video.title);

  // Watch video
  await youtube.getVideoStream(video.id, 'HD');
  youtube.recordWatchHistory('user2', video.id);
  console.log('Video watched');

  // Like and comment
  youtube.likeVideo('user2', video.id);
  youtube.addComment('user2', video.id, 'Great tutorial!');
  console.log('Video liked and commented');

  // Subscribe
  youtube.subscribe('user2', 'user1');
  console.log('Subscribed to channel');

  // Get recommendations
  const recommendations = youtube.getRecommendations('user2');
  console.log('Recommendations:', recommendations.map(v => v.title));

  // Search
  const searchResults = youtube.searchVideos('code');
  console.log('Search results:', searchResults.map(v => v.title));
}

if (require.main === module) {
  demonstrateYouTube();
}

module.exports = { YouTubeService };

