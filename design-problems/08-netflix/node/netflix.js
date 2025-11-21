/**
 * Design Netflix
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Video streaming platform with global content delivery.
 * 
 * CAPACITY ESTIMATION:
 * - Users: 200M+ users
 * - Videos: 10K titles * 100GB average = 1PB
 * - Encoded versions: 3 qualities * 1PB = 3PB
 * - Concurrent streams: 50M * 5Mbps = 250Tbps
 * 
 * ARCHITECTURE:
 * Client → CDN (Edge) → Video Server → Object Storage (S3)
 * 
 * KEY FEATURES:
 * - Video upload and encoding
 * - Multi-quality video streaming (SD, HD, FHD, 4K)
 * - Adaptive bitrate streaming (HLS)
 * - Global CDN for content delivery
 * - User profiles and accounts
 * - Recommendations based on watch history
 * - Search and browse
 * - Watch history tracking
 * 
 * VIDEO PROCESSING:
 * - Encoding pipeline: Upload → Validate → Transcode → Store → CDN
 * - Multiple qualities: SD (480p), HD (720p), FHD (1080p), 4K (2160p)
 * - Adaptive bitrate: HLS (HTTP Live Streaming) with segments
 * 
 * CDN STRATEGY:
 * - Global edge locations for low latency
 * - Cache popular content at edge
 * - Route to nearest edge server
 */

/**
 * Netflix Service
 * 
 * CORE FUNCTIONALITY:
 * ===================
 * Implements Netflix-like video streaming service with:
 * - Video upload and encoding
 * - Multi-quality video streaming
 * - Adaptive bitrate streaming
 * - Watch history tracking
 * - Personalized recommendations
 * - Search and browse
 * 
 * DATA STRUCTURES:
 * ================
 * - videos: Map<videoId, videoData> - Video metadata
 * - videoFiles: Map<videoId, Map<quality, fileData>> - Encoded video files
 * - users: Map<userId, userData> - User information
 * - watchHistory: Map<userId, Array<watchRecord>> - Watch history per user
 * - recommendations: Map<userId, Array<videoId>> - Personalized recommendations
 * - encodingQueue: Array<encodingJob> - Video encoding queue
 * 
 * PRODUCTION CONSIDERATIONS:
 * - In production, would use:
 *   * Object storage (S3) for video files
 *   * CDN (CloudFront) for global delivery
 *   * Encoding service (AWS MediaConvert, FFmpeg)
 *   * SQL database for metadata
 *   * NoSQL database for watch history
 *   * ML service for recommendations
 */
class NetflixService {
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
     * VIDEO METADATA STORAGE
     * ======================
     * Stores video information (title, description, genre, rating, etc.).
     * In production: SQL database (PostgreSQL, MySQL)
     */
    this.videos = new Map();
    
    /**
     * VIDEO FILES STORAGE
     * ===================
     * Stores encoded video files for each quality.
     * Structure: videoId -> quality -> fileData
     * In production: Object storage (S3) for files, database for metadata
     */
    this.videoFiles = new Map(); // videoId -> quality -> file
    
    /**
     * USER STORAGE
     * ============
     * Stores user information.
     * In production: SQL database
     */
    this.users = new Map();
    
    /**
     * WATCH HISTORY
     * =============
     * Tracks user watch history for recommendations.
     * In production: NoSQL database (MongoDB, Cassandra)
     */
    this.watchHistory = new Map(); // userId -> List of watch records
    
    /**
     * RECOMMENDATIONS
     * ===============
     * Pre-computed personalized recommendations per user.
     * In production: Redis for fast access, ML service for generation
     */
    this.recommendations = new Map(); // userId -> List of video IDs
    
    /**
     * ENCODING QUEUE
     * ==============
     * Queue for video encoding jobs.
     * In production: Message queue (Kafka, RabbitMQ) or job queue (AWS SQS)
     */
    this.encodingQueue = [];
  }

  /**
   * Create user
   */
  createUser(userId, email, name) {
    this.users.set(userId, {
      id: userId,
      email,
      name,
      profile: 'default',
      createdAt: Date.now()
    });
    this.watchHistory.set(userId, []);
    this.recommendations.set(userId, []);
    return this.users.get(userId);
  }

  /**
   * Upload video
   */
  async uploadVideo(title, description, videoUrl, metadata = {}) {
    const video = {
      id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      duration: metadata.duration || 0,
      releaseDate: metadata.releaseDate || new Date().toISOString(),
      genre: metadata.genre || 'Unknown',
      rating: metadata.rating || 0,
      createdAt: Date.now(),
      status: 'uploading'
    };

    this.videos.set(video.id, video);
    this.videoFiles.set(video.id, new Map());

    // Queue for encoding
    this.encodingQueue.push({
      videoId: video.id,
      videoUrl,
      priority: metadata.priority || 'normal'
    });

    // Simulate encoding process
    await this.processEncoding(video.id, videoUrl);

    return video;
  }

  /**
   * Process video encoding
   * 
   * VIDEO ENCODING PROCESS:
   * =======================
   * Encodes video to multiple qualities for adaptive bitrate streaming.
   * 
   * ENCODING PIPELINE:
   * 1. Validate video format and size
   * 2. Transcode to multiple qualities (SD, HD, FHD, 4K)
   * 3. Generate thumbnails
   * 4. Extract metadata (duration, resolution, etc.)
   * 5. Create HLS segments and manifest
   * 6. Store in object storage
   * 7. Distribute to CDN
   * 
   * VIDEO QUALITIES:
   * ===============
   * - SD (480p): ~1Mbps bitrate, smaller file size
   * - HD (720p): ~3Mbps bitrate, medium file size
   * - FHD (1080p): ~5Mbps bitrate, larger file size
   * - 4K (2160p): ~15Mbps bitrate, largest file size
   * 
   * ADAPTIVE BITRATE STREAMING:
   * ===========================
   * Client automatically selects quality based on:
   * - Available bandwidth
   * - Device capabilities
   * - Network conditions
   * 
   * HLS (HTTP Live Streaming):
   * - Video split into small segments (e.g., 10 seconds)
   * - M3U8 manifest file contains segment URLs
   * - Client downloads segments and switches quality as needed
   * 
   * IN PRODUCTION:
   * - Would use encoding service (AWS MediaConvert, FFmpeg)
   * - Parallel encoding for faster processing
   * - Background jobs for encoding
   * - Progress tracking and notifications
   * 
   * @param {string} videoId - Video ID to encode
   * @param {string} videoUrl - Original video URL
   * @returns {Promise<boolean>} True if encoding successful
   */
  async processEncoding(videoId, videoUrl) {
    const video = this.videos.get(videoId);
    if (!video) return;

    /**
     * UPDATE STATUS
     * ============
     * Mark video as encoding.
     */
    video.status = 'encoding';

    /**
     * ENCODE TO MULTIPLE QUALITIES
     * ============================
     * Encode video to different qualities for adaptive bitrate streaming.
     * Each quality has different bitrate and file size.
     */
    const qualities = ['SD', 'HD', 'FHD', '4K'];
    const bitrates = { SD: 1000, HD: 3000, FHD: 5000, '4K': 15000 }; // kbps

    for (const quality of qualities) {
      /**
       * CREATE FILE ENTRY
       * =================
       * Store metadata for each quality version.
       * In production: Would store actual file in object storage (S3).
       */
      const file = {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        videoId,
        quality,
        fileUrl: `${videoUrl}_${quality.toLowerCase()}.mp4`,
        fileSize: Math.floor(Math.random() * 1000000000), // Random size (in production: actual size)
        bitrate: bitrates[quality], // kbps
        createdAt: Date.now()
      };

      /**
       * STORE FILE METADATA
       * ===================
       * Store file information for each quality.
       */
      const files = this.videoFiles.get(videoId);
      files.set(quality, file);
    }

    /**
     * MARK AS READY
     * ============
     * Video is now ready for streaming.
     * In production: Would trigger CDN distribution.
     */
    video.status = 'ready';
    return true;
  }

  /**
   * Get video stream
   * 
   * VIDEO STREAMING PROCESS:
   * ========================
   * Returns video stream information for playback.
   * 
   * PROCESS:
   * 1. Validate video exists and is ready
   * 2. Get requested quality file
   * 3. If quality not available, fallback to available quality
   * 4. Record watch start (if user provided)
   * 5. Return stream information (URL, manifest, bitrate)
   * 
   * ADAPTIVE BITRATE STREAMING:
   * ===========================
   * Returns HLS manifest URL (M3U8 file) which contains:
   * - Segment URLs for different qualities
   * - Quality information (bitrate, resolution)
   * - Client automatically selects best quality based on bandwidth
   * 
   * CDN DELIVERY:
   * ============
   * In production, stream URLs would point to CDN edge locations:
   * - Lower latency for global users
   * - Better bandwidth utilization
   * - Automatic failover
   * 
   * QUALITY FALLBACK:
   * ================
   * If requested quality not available, fallback to highest available quality.
   * Ensures video can always be played.
   * 
   * @param {string} videoId - Video ID to stream
   * @param {string} quality - Requested quality (SD, HD, FHD, 4K)
   * @param {string|null} userId - User ID for watch history tracking
   * @returns {Promise<Object>} Stream information (URL, manifest, bitrate)
   */
  async getVideoStream(videoId, quality = 'HD', userId = null) {
    /**
     * STEP 1: VALIDATE VIDEO
     * =====================
     * Check if video exists and is ready for streaming.
     */
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    if (video.status !== 'ready') {
      throw new Error('Video not ready');
    }

    /**
     * STEP 2: GET REQUESTED QUALITY
     * =============================
     * Retrieve file for requested quality.
     */
    const files = this.videoFiles.get(videoId);
    const file = files.get(quality);

    /**
     * STEP 3: QUALITY FALLBACK
     * ========================
     * If requested quality not available, fallback to highest available quality.
     * Ensures video can always be played.
     */
    if (!file) {
      const availableQualities = Array.from(files.keys());
      const fallbackQuality = availableQualities[0];
      const fallbackFile = files.get(fallbackQuality);
      return {
        videoId,
        quality: fallbackQuality,
        streamUrl: fallbackFile.fileUrl,
        bitrate: fallbackFile.bitrate,
        /**
         * HLS MANIFEST URL
         * ===============
         * M3U8 file contains segment URLs for adaptive bitrate streaming.
         * Client uses this to download segments and switch quality as needed.
         */
        manifestUrl: `${fallbackFile.fileUrl}.m3u8`
      };
    }

    /**
     * STEP 4: RECORD WATCH START
     * ==========================
     * Track that user started watching this video.
     * Used for recommendations and analytics.
     */
    if (userId) {
      await this.recordWatchHistory(userId, videoId, 0);
    }

    /**
     * STEP 5: RETURN STREAM INFORMATION
     * =================================
     * Return stream URL, manifest URL, and bitrate.
     * In production: URLs would point to CDN edge locations.
     */
    return {
      videoId,
      quality,
      streamUrl: file.fileUrl, // Direct video URL (or CDN URL in production)
      bitrate: file.bitrate,
      manifestUrl: `${file.fileUrl}.m3u8` // HLS manifest for adaptive streaming
    };
  }

  /**
   * Record watch history
   */
  async recordWatchHistory(userId, videoId, watchedDuration) {
    const video = this.videos.get(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const history = this.watchHistory.get(userId) || [];
    
    // Check if already watching
    const existingIndex = history.findIndex(h => h.videoId === videoId && !h.completed);
    
    if (existingIndex >= 0) {
      // Update existing record
      history[existingIndex].watchedDuration = watchedDuration;
      history[existingIndex].watchedAt = Date.now();
      history[existingIndex].completed = watchedDuration >= video.duration * 0.9; // 90% watched
    } else {
      // Create new record
      history.push({
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        videoId,
        watchedDuration,
        completed: watchedDuration >= video.duration * 0.9,
        watchedAt: Date.now()
      });
    }

    this.watchHistory.set(userId, history);

    // Update recommendations
    await this.updateRecommendations(userId);

    return true;
  }

  /**
   * Get watch history
   */
  getWatchHistory(userId, limit = 20) {
    const history = this.watchHistory.get(userId) || [];
    return history
      .sort((a, b) => b.watchedAt - a.watchedAt)
      .slice(0, limit)
      .map(h => ({
        ...h,
        video: this.videos.get(h.videoId)
      }))
      .filter(h => h.video !== undefined);
  }

  /**
   * Update recommendations
   */
  async updateRecommendations(userId) {
    const history = this.watchHistory.get(userId) || [];
    const watchedGenres = new Map();

    // Analyze watch history
    for (const record of history) {
      const video = this.videos.get(record.videoId);
      if (video && record.completed) {
        const count = watchedGenres.get(video.genre) || 0;
        watchedGenres.set(video.genre, count + 1);
      }
    }

    // Find similar videos
    const recommendations = [];
    for (const video of this.videos.values()) {
      if (video.status === 'ready') {
        const genreCount = watchedGenres.get(video.genre) || 0;
        if (genreCount > 0) {
          recommendations.push({
            video,
            score: genreCount * video.rating
          });
        }
      }
    }

    // Sort by score and limit
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
      if (video.status === 'ready') {
        if (video.title.toLowerCase().includes(queryLower) ||
            video.description.toLowerCase().includes(queryLower)) {
          results.push(video);
        }
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Browse by genre
   */
  browseByGenre(genre, limit = 20) {
    const results = [];
    for (const video of this.videos.values()) {
      if (video.status === 'ready' && video.genre === genre) {
        results.push(video);
        if (results.length >= limit) break;
      }
    }
    return results.sort((a, b) => b.rating - a.rating);
  }

  /**
   * Get trending videos
   */
  getTrendingVideos(limit = 20) {
    const videos = Array.from(this.videos.values())
      .filter(v => v.status === 'ready')
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);

    return videos;
  }
}

// Example usage
async function demonstrateNetflix() {
  console.log('=== Design Netflix ===\n');

  const netflix = new NetflixService();

  // Create user
  const user = netflix.createUser('user1', 'alice@example.com', 'Alice');

  // Upload videos
  const video1 = await netflix.uploadVideo(
    'The Matrix',
    'A computer hacker learns about the true nature of reality',
    'https://storage.netflix.com/videos/matrix.mp4',
    { genre: 'Sci-Fi', rating: 8.7, duration: 8160 }
  );
  console.log('Video uploaded:', video1.title);

  const video2 = await netflix.uploadVideo(
    'Inception',
    'A thief enters people\'s dreams',
    'https://storage.netflix.com/videos/inception.mp4',
    { genre: 'Sci-Fi', rating: 8.8, duration: 8880 }
  );
  console.log('Video uploaded:', video2.title);

  // Get video stream
  const stream = await netflix.getVideoStream(video1.id, 'HD', 'user1');
  console.log('Stream URL:', stream.streamUrl);

  // Record watch history
  await netflix.recordWatchHistory('user1', video1.id, 4000);
  console.log('Watch history recorded');

  // Get recommendations
  const recommendations = netflix.getRecommendations('user1');
  console.log('Recommendations:', recommendations.map(v => v.title));

  // Search
  const searchResults = netflix.searchVideos('matrix');
  console.log('Search results:', searchResults.map(v => v.title));
}

if (require.main === module) {
  demonstrateNetflix();
}

module.exports = { NetflixService };

