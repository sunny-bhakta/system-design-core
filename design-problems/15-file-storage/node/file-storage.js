/**
 * Design File Storage System
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Cloud file storage system with sync and versioning (like Dropbox, Google Drive).
 * 
 * CAPACITY ESTIMATION:
 * - Users: 100M+ users
 * - Files: 1B files
 * - Storage: 10PB total
 * - Uploads: 1M files/day = ~11.6 files/second
 * - Downloads: 10M files/day = ~116 files/second
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → File Service → Object Storage (S3) → CDN
 * 
 * KEY FEATURES:
 * - File upload and download
 * - Folder organization
 * - File versioning
 * - File sharing
 * - Sync across devices
 * - Chunked upload for large files
 * 
 * STORAGE STRATEGY:
 * - Chunking: Split large files into chunks
 * - Deduplication: Store chunks once, reference multiple times
 * - Object storage: S3-like storage for chunks
 * - Metadata: SQL database for file metadata
 */
class FileStorageSystem {
  /**
   * Constructor
   * 
   * INITIALIZES DATA STRUCTURES:
   * ============================
   * All data structures are in-memory Maps for simplicity.
   * In production, would use distributed databases and object storage.
   */
  constructor() {
    /**
     * USER STORAGE
     * ============
     * Stores user information and storage quotas.
     * In production: SQL database
     */
    this.users = new Map();
    
    /**
     * FILE STORAGE
     * ============
     * Stores file metadata (name, size, path, etc.).
     * In production: SQL database
     */
    this.files = new Map(); // fileId -> file data
    
    /**
     * FILE CHUNKS
     * ===========
     * Maps file ID to list of chunk IDs.
     * Files are split into chunks for efficient storage and upload.
     * In production: SQL database, chunks stored in object storage
     */
    this.fileChunks = new Map(); // fileId -> List of chunks
    
    /**
     * FOLDER STORAGE
     * ==============
     * Stores folder structure and hierarchy.
     * In production: SQL database with tree structure
     */
    this.folders = new Map(); // folderId -> folder data
    
    /**
     * SHARE STORAGE
     * =============
     * Stores file sharing information (permissions, shared with).
     * In production: SQL database
     */
    this.shares = new Map(); // fileId -> List of shares
    
    /**
     * VERSION STORAGE
     * ===============
     * Stores file versions for version history.
     * In production: SQL database, versions stored in object storage
     */
    this.versions = new Map(); // fileId -> List of versions
  }

  /**
   * Create user
   */
  createUser(userId, email, name) {
    const user = {
      id: userId,
      email,
      name,
      storageUsed: 0,
      storageLimit: 1000000000, // 1GB default
      createdAt: Date.now()
    };

    this.users.set(userId, user);

    // Create root folder
    const rootFolder = {
      id: `folder_${userId}_root`,
      userId,
      name: 'Root',
      path: '/',
      parentId: null,
      createdAt: Date.now()
    };

    this.folders.set(rootFolder.id, rootFolder);

    return user;
  }

  /**
   * Create folder
   */
  createFolder(userId, name, parentPath = '/') {
    const folder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name,
      path: parentPath === '/' ? `/${name}` : `${parentPath}/${name}`,
      parentId: this.findFolderByPath(userId, parentPath)?.id || null,
      createdAt: Date.now()
    };

    this.folders.set(folder.id, folder);
    return folder;
  }

  /**
   * Find folder by path
   */
  findFolderByPath(userId, path) {
    for (const folder of this.folders.values()) {
      if (folder.userId === userId && folder.path === path) {
        return folder;
      }
    }
    return null;
  }

  /**
   * Upload file
   */
  async uploadFile(userId, fileName, fileData, folderPath = '/', metadata = {}) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check storage limit
    if (user.storageUsed + fileData.length > user.storageLimit) {
      throw new Error('Storage limit exceeded');
    }

    // Find or create folder
    let folder = this.findFolderByPath(userId, folderPath);
    if (!folder) {
      folder = this.createFolder(userId, folderPath.split('/').pop(), '/');
    }

    // Chunk file (simplified - in real system would split into chunks)
    const chunks = this.chunkFile(fileData);
    const chunksData = chunks.map((chunk, index) => ({
      index,
      hash: this.hashChunk(chunk),
      size: chunk.length,
      storageUrl: `https://storage.example.com/chunks/${this.hashChunk(chunk)}`
    }));

    const file = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name: fileName,
      path: folderPath === '/' ? `/${fileName}` : `${folderPath}/${fileName}`,
      size: fileData.length,
      mimeType: metadata.mimeType || 'application/octet-stream',
      version: 1,
      folderId: folder.id,
      chunks: chunksData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.files.set(file.id, file);
    this.fileChunks.set(file.id, chunksData);
    this.versions.set(file.id, [{
      version: 1,
      fileId: file.id,
      createdAt: Date.now(),
      size: fileData.length
    }]);

    // Update user storage
    user.storageUsed += fileData.length;

    return file;
  }

  /**
   * Chunk file (simplified)
   */
  chunkFile(data, chunkSize = 4 * 1024 * 1024) { // 4MB chunks
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Hash chunk (simplified)
   */
  hashChunk(chunk) {
    // In real system, would use SHA-256
    let hash = 0;
    for (let i = 0; i < chunk.length; i++) {
      const char = chunk.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Download file
   */
  async downloadFile(fileId, userId = null) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // Check permissions
    if (userId && file.userId !== userId) {
      const hasAccess = this.checkFileAccess(fileId, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }
    }

    // In real system, would download chunks and reassemble
    const chunks = this.fileChunks.get(fileId) || [];
    const fileData = chunks.map(chunk => `chunk_${chunk.hash}`).join('');

    return {
      file,
      data: fileData
    };
  }

  /**
   * Check file access
   */
  checkFileAccess(fileId, userId) {
    const shares = this.shares.get(fileId) || [];
    return shares.some(share => share.userId === userId && share.permission !== 'none');
  }

  /**
   * Share file
   */
  shareFile(fileId, shareWithUserId, permission = 'read') {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    if (!this.shares.has(fileId)) {
      this.shares.set(fileId, []);
    }

    const shares = this.shares.get(fileId);
    const existingShare = shares.find(s => s.userId === shareWithUserId);

    if (existingShare) {
      existingShare.permission = permission;
      existingShare.updatedAt = Date.now();
    } else {
      shares.push({
        userId: shareWithUserId,
        permission, // read, write, none
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    return { shared: true, permission };
  }

  /**
   * Get file versions
   */
  getFileVersions(fileId) {
    return this.versions.get(fileId) || [];
  }

  /**
   * Create new version
   */
  async createNewVersion(fileId, fileData) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // Save current version
    const versions = this.versions.get(fileId) || [];
    versions.push({
      version: file.version,
      fileId: file.id,
      createdAt: file.updatedAt,
      size: file.size
    });
    this.versions.set(fileId, versions);

    // Update file
    file.version++;
    file.size = fileData.length;
    file.updatedAt = Date.now();

    // Update chunks
    const chunks = this.chunkFile(fileData);
    const chunksData = chunks.map((chunk, index) => ({
      index,
      hash: this.hashChunk(chunk),
      size: chunk.length,
      storageUrl: `https://storage.example.com/chunks/${this.hashChunk(chunk)}`
    }));
    this.fileChunks.set(fileId, chunksData);

    return file;
  }

  /**
   * Search files
   */
  searchFiles(userId, query, limit = 20) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const file of this.files.values()) {
      if (file.userId === userId || this.checkFileAccess(file.id, userId)) {
        if (file.name.toLowerCase().includes(queryLower) ||
            file.path.toLowerCase().includes(queryLower)) {
          results.push(file);
        }
        if (results.length >= limit) break;
      }
    }

    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get user files
   */
  getUserFiles(userId, folderPath = '/', limit = 50) {
    const files = [];
    for (const file of this.files.values()) {
      if (file.userId === userId && file.path.startsWith(folderPath)) {
        files.push(file);
      }
      if (files.length >= limit) break;
    }

    return files.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Delete file
   */
  deleteFile(fileId, userId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    if (file.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // Update user storage
    const user = this.users.get(userId);
    if (user) {
      user.storageUsed -= file.size;
    }

    // Delete file
    this.files.delete(fileId);
    this.fileChunks.delete(fileId);
    this.shares.delete(fileId);

    return { deleted: true };
  }
}

// Example usage
async function demonstrateFileStorage() {
  console.log('=== Design File Storage System ===\n');

  const storage = new FileStorageSystem();

  // Create user
  const user = storage.createUser('user1', 'alice@example.com', 'Alice');

  // Create folder
  const folder = storage.createFolder('user1', 'Documents', '/');
  console.log('Folder created:', folder.name);

  // Upload file
  const file = await storage.uploadFile(
    'user1',
    'document.pdf',
    'file content here',
    '/Documents',
    { mimeType: 'application/pdf' }
  );
  console.log('File uploaded:', file.name);

  // Share file
  storage.shareFile(file.id, 'user2', 'read');
  console.log('File shared');

  // Create new version
  const newVersion = await storage.createNewVersion(file.id, 'updated file content');
  console.log('New version created:', newVersion.version);

  // Search files
  const searchResults = storage.searchFiles('user1', 'document');
  console.log('Search results:', searchResults.length);

  // Get file versions
  const versions = storage.getFileVersions(file.id);
  console.log('File versions:', versions.length);
}

if (require.main === module) {
  demonstrateFileStorage();
}

module.exports = { FileStorageSystem };

