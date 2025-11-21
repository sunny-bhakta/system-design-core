# Design File Storage System

## Problem Statement

Design a cloud file storage system like Dropbox or Google Drive that allows users to store and sync files.

## Requirements

### Functional Requirements
- Upload/download files
- File versioning
- File sharing
- Sync across devices
- Search files
- Folder structure
- File preview

### Non-Functional Requirements
- Handle petabytes of data
- Fast upload/download
- High availability (99.9%)
- Data durability (99.999999999%)
- Scalable

## Capacity Estimation

### Storage
- **Files:** 1B files * 10MB average = 10PB
- **Metadata:** 1B files * 1KB = 1TB
- **Versions:** 10% files have versions * 10MB = 1PB
- **Total:** ~11PB

### Bandwidth
- **Upload:** 100K uploads/day * 10MB = 1TB/day
- **Download:** 1M downloads/day * 10MB = 10TB/day

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  API         │────▶│  Metadata   │
│             │     │  Gateway     │     │  Service    │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
            │  Object      │         │  Sync        │         │  Search      │
            │  Storage     │         │  Service     │         │  Service     │
            │  (S3-like)   │         └──────────────┘         └──────────────┘
            └──────────────┘
                    │
            ┌───────▼──────┐
            │  CDN         │
            │  (Delivery)  │
            └──────────────┘
```

### File Storage

#### Object Storage
- **Primary storage:** S3-like object storage
- **Chunking:** Split large files into chunks
- **Deduplication:** Deduplicate chunks
- **Replication:** Replicate for durability

#### Chunking Strategy
- **Fixed size:** 4MB chunks
- **Variable size:** Content-defined chunking
- **Benefits:** Parallel upload, deduplication

### Sync Mechanism

#### Conflict Resolution
- **Last write wins:** Simple but may lose data
- **Merge:** Combine changes
- **User resolution:** Let user decide

#### Sync Algorithm
1. **Detect changes:** Compare local and remote
2. **Upload changes:** Upload modified files
3. **Download changes:** Download remote changes
4. **Resolve conflicts:** Handle conflicts
5. **Update metadata:** Update file metadata

### Database Schema

#### Files Table
```sql
CREATE TABLE files (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  path VARCHAR(1000) NOT NULL,
  size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  version INT DEFAULT 1,
  parent_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_path (path),
  INDEX idx_parent_id (parent_id)
);
```

#### File Chunks Table
```sql
CREATE TABLE file_chunks (
  id BIGINT PRIMARY KEY,
  file_id BIGINT NOT NULL,
  chunk_index INT NOT NULL,
  chunk_hash VARCHAR(64) NOT NULL,
  storage_url VARCHAR(500) NOT NULL,
  size BIGINT NOT NULL,
  INDEX idx_file_id (file_id),
  INDEX idx_chunk_hash (chunk_hash)
);
```

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - User information and storage quotas
- **Production:** SQL database

#### File Storage
- **files:** Map<fileId, fileData> - File metadata
- **Production:** SQL database

#### File Chunks
- **fileChunks:** Map<fileId, Array<chunkId>> - File to chunks mapping
- **Production:** SQL database, chunks in object storage

#### Folder Storage
- **folders:** Map<folderId, folderData> - Folder structure
- **Production:** SQL database with tree structure

#### Share Storage
- **shares:** Map<fileId, Array<shareData>> - File sharing information
- **Production:** SQL database

#### Version Storage
- **versions:** Map<fileId, Array<versionData>> - File versions
- **Production:** SQL database, versions in object storage

## Process Flow

### Upload File Process

1. **Validate User:** Check if user exists
2. **Check Storage Limit:** Verify available storage
3. **Find/Create Folder:** Locate or create target folder
4. **Chunk File:** Split file into chunks (for large files)
5. **Upload Chunks:** Upload chunks to object storage
6. **Create File Record:** Store file metadata
7. **Update Storage:** Increment user's storage used
8. **Return File:** Return file object

### Chunking Strategy

1. **Split File:** Divide file into fixed-size chunks (e.g., 5MB)
2. **Hash Chunks:** Calculate hash for each chunk
3. **Deduplication:** Check if chunk already exists
4. **Store Chunks:** Upload unique chunks to object storage
5. **Map Chunks:** Store chunk mapping for file

### Download File Process

1. **Validate Access:** Check user has permission
2. **Get File Metadata:** Retrieve file information
3. **Get Chunks:** Retrieve chunk IDs for file
4. **Download Chunks:** Download chunks from object storage
5. **Reassemble File:** Combine chunks in order
6. **Return File:** Return complete file data

## File Versioning

### Version Strategy
- **Snapshot:** Store complete file for each version
- **Delta:** Store only changes (more efficient)
- **Retention:** Keep last N versions or versions within time window

### Version Process
1. **Detect Change:** File modified or replaced
2. **Create Version:** Store current version
3. **Update File:** Update file with new content
4. **Increment Version:** Increment version number
5. **Cleanup Old Versions:** Remove versions beyond retention

## File Sharing

### Sharing Types
- **Read-only:** Recipient can view but not modify
- **Read-write:** Recipient can view and modify
- **Public Link:** Share via public URL with expiration

### Sharing Process
1. **Create Share:** Generate share record
2. **Set Permissions:** Define access level
3. **Generate Link:** Create shareable link (if public)
4. **Notify Recipient:** Send notification (if private share)
5. **Track Access:** Log access attempts

## Implementation

### Node.js Implementation

See [Node.js Code](./node/file-storage.js)

**Key features:**
- File upload with chunking for large files
- File download and reassembly
- Folder organization and hierarchy
- File versioning with history
- File sharing with permissions
- Storage quota management
- File search functionality

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Chunking strategy
- Deduplication
- Versioning mechanisms
- Sharing and permissions
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { FileStorageSystem } = require('./node/file-storage');

const storage = new FileStorageSystem();

// Upload file
const file = await storage.uploadFile('user1', 'document.pdf', fileData, '/documents');

// Download file
const fileData = await storage.downloadFile(file.id);

// Share file
await storage.shareFile(file.id, 'user2', 'read');

// Get file versions
const versions = await storage.getFileVersions(file.id);
```

## Performance Optimization

### Upload Optimization
- **Chunking:** Split into chunks
- **Parallel upload:** Upload chunks in parallel
- **Resumable upload:** Resume interrupted uploads

### Download Optimization
- **CDN:** Cache popular files
- **Compression:** Compress files
- **Range requests:** Partial downloads

## Monitoring

### Key Metrics
- **Upload/download speed:** Throughput
- **Storage usage:** Current vs capacity
- **Sync latency:** Time to sync
- **Error rate:** Failed operations

### Alerts
- Slow upload/download
- High storage usage
- Sync failures
- High error rate

## Trade-offs

### Consistency vs Availability
- **Strong consistency:** Slower, more complex
- **Eventual consistency:** Faster, simpler

### Storage vs Cost
- **More storage tiers:** Better performance, higher cost
- **Fewer tiers:** Lower cost, slower access

## Further Enhancements

1. **Collaborative editing:** Real-time collaboration
2. **File preview:** Preview without download
3. **Offline sync:** Sync when online
4. **Selective sync:** Choose folders to sync
5. **Bandwidth throttling:** Limit bandwidth usage
6. **File encryption:** End-to-end encryption

