# Design Search Engine

## Problem Statement

Design a web search engine like Google that indexes billions of web pages and returns relevant results.

## Requirements

### Functional Requirements
- Web crawling
- Indexing web pages
- Ranking algorithm
- Search query processing
- Result pagination
- Image search
- News search

### Non-Functional Requirements
- Index billions of pages
- Sub-second search results
- High availability (99.9%)
- Handle millions of queries/second
- Fresh index (regular updates)

## Capacity Estimation

### Storage
- **Index:** 1B pages * 10KB = 10TB
- **Inverted index:** 1B pages * 5KB = 5TB
- **Metadata:** 1B pages * 1KB = 1TB
- **Total:** ~16TB

### Bandwidth
- **Crawling:** 1M pages/day * 100KB = 100GB/day
- **Search queries:** 1M queries/sec * 1KB = 1GB/sec

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Load        │────▶│  Search     │
│             │     │  Balancer    │     │  Service    │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
            │  Indexer     │         │  Ranking    │         │  Crawler     │
            │  Service     │         │  Service    │         │  Service     │
            └──────────────┘         └──────────────┘         └──────────────┘
                    │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Inverted Index    │
                                    │  (Distributed)     │
                                    └────────────────────┘
```

### Web Crawling

#### Crawler Architecture
- **Distributed crawlers:** Multiple crawler instances
- **URL frontier:** Queue of URLs to crawl
- **Robots.txt:** Respect crawling rules
- **Rate limiting:** Don't overload servers
- **Deduplication:** Avoid duplicate pages

#### Crawling Strategy
- **BFS:** Breadth-first search
- **Priority queue:** Important pages first
- **Scheduling:** Re-crawl periodically

### Indexing

#### Inverted Index
- **Term → Documents:** Map words to documents
- **TF-IDF:** Term frequency-inverse document frequency
- **Posting list:** List of documents containing term
- **Compression:** Compress posting lists

#### Index Structure
```
term: "system"
posting_list: [
  {doc_id: 1, tf: 5, positions: [10, 25, 100]},
  {doc_id: 5, tf: 3, positions: [50, 200]},
  ...
]
```

### Ranking Algorithm

#### PageRank
- **Link analysis:** Importance based on links
- **Iterative computation:** Calculate recursively
- **Damping factor:** Prevent rank sinks

#### Relevance Score
- **TF-IDF:** Term frequency
- **PageRank:** Page importance
- **Freshness:** Recent content
- **User signals:** Clicks, dwell time

## Data Structures

### In-Memory Storage (Production: Database)

#### Page Storage
- **pages:** Map<url, pageData> - Crawled pages with content
- **Production:** Distributed storage (HDFS, S3)

#### Inverted Index
- **invertedIndex:** Map<term, Set<docId>> - Term to document mapping
- **Production:** Distributed across servers, sharded by term

#### Document Storage
- **documents:** Map<docId, documentData> - Document metadata
- **Production:** Distributed database

#### PageRank Storage
- **pageRank:** Map<docId, score> - PageRank scores
- **Production:** Distributed storage, recalculated periodically

#### Crawl Queue
- **crawlQueue:** Array<url> - URLs to crawl
- **Production:** Distributed queue (Kafka, RabbitMQ)

#### Crawled URLs
- **crawledUrls:** Set<url> - Already crawled URLs
- **Production:** Bloom filter or distributed set

## Process Flow

### Crawl Page Process

1. **Check if Crawled:** Verify URL not already crawled
2. **Fetch Page:** Download HTML content
3. **Extract Content:** Parse HTML, extract text
4. **Extract Links:** Find all links on page
5. **Store Page:** Save page content and metadata
6. **Add Links to Queue:** Add new links to crawl queue
7. **Mark as Crawled:** Add URL to crawled set

### Index Pages Process

1. **Tokenize:** Split text into terms (words)
2. **Build Inverted Index:** Map each term to document IDs
3. **Calculate PageRank:** Compute PageRank scores
4. **Store Index:** Save inverted index
5. **Update PageRank:** Store PageRank scores

### Search Process

1. **Parse Query:** Tokenize and normalize search query
2. **Lookup Terms:** Find documents containing query terms
3. **Calculate Scores:** Compute TF-IDF and PageRank scores
4. **Merge Results:** Combine results from multiple terms
5. **Rank Results:** Sort by combined score
6. **Return Top N:** Return top N results

## Inverted Index

### Structure
```
term → [docId1, docId2, docId3, ...]
```

### Benefits
- **Fast Lookup:** O(1) term lookup
- **Efficient:** Only store relevant documents
- **Scalable:** Can be sharded by term

### Sharding Strategy
- **Hash-based:** Hash term to determine shard
- **Range-based:** Partition by term range
- **Distributed:** Spread across multiple servers

## PageRank Algorithm

### Formula
```
PR(A) = (1-d) + d * Σ(PR(T)/C(T))
```

Where:
- PR(A) = PageRank of page A
- d = Damping factor (typically 0.85)
- T = Pages linking to A
- C(T) = Number of outbound links from T

### Process
1. **Initialize:** Set all pages to PR = 1/N
2. **Iterate:** Calculate PR for each page
3. **Converge:** Repeat until scores stabilize
4. **Normalize:** Normalize scores

### Damping Factor
- **Purpose:** Prevent rank sinks (pages with no outbound links)
- **Value:** Typically 0.85
- **Effect:** Distributes rank across all pages

## TF-IDF Scoring

### Term Frequency (TF)
```
TF(t, d) = count(t in d) / total terms in d
```

### Inverse Document Frequency (IDF)
```
IDF(t) = log(total documents / documents containing t)
```

### TF-IDF Score
```
TF-IDF(t, d) = TF(t, d) * IDF(t)
```

### Combined Score
```
Score = α * TF-IDF + β * PageRank + γ * Freshness
```

## Performance Considerations

### Time Complexity
- **Crawl Page:** O(1) for storage, O(n) for link extraction
- **Index Pages:** O(p * t) where p = pages, t = terms per page
- **Search:** O(k * log n) where k = query terms, n = documents

### Space Complexity
- **Inverted Index:** O(t * d) where t = terms, d = documents per term
- **Page Storage:** O(p * s) where p = pages, s = average size

### Latency Targets
- **Search:** < 200ms
- **Crawl:** < 5 seconds per page
- **Indexing:** Background process

## Implementation

### Node.js Implementation

See [Node.js Code](./node/search-engine.js)

**Key features:**
- Web crawling with URL frontier
- Inverted index construction
- Search query processing
- PageRank algorithm for ranking
- TF-IDF scoring for relevance
- Result pagination

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Crawling architecture
- Inverted index structure
- PageRank algorithm
- TF-IDF scoring
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { SearchEngine } = require('./node/search-engine');

const searchEngine = new SearchEngine();

// Crawl pages
await searchEngine.crawlPage('https://example.com');

// Index pages
await searchEngine.indexPages();

// Search
const results = await searchEngine.search('system design');
```

## Performance Optimization

### Index Optimization
- **Sharding:** Partition index by term
- **Caching:** Cache frequent queries
- **Compression:** Compress posting lists

### Query Optimization
- **Query parsing:** Parse and normalize
- **Term extraction:** Extract keywords
- **Result merging:** Merge results from shards

## Monitoring

### Key Metrics
- **Search latency:** P50, P95, P99
- **Index freshness:** Time since last crawl
- **Crawl rate:** Pages crawled per second
- **Query throughput:** Queries per second

### Alerts
- High search latency
- Stale index
- Low crawl rate
- High error rate

## Trade-offs

### Freshness vs Cost
- **Fresher index:** More frequent crawls, higher cost
- **Stale index:** Less frequent crawls, lower cost

### Accuracy vs Performance
- **More accurate:** Better ranking, slower
- **Faster:** Less accurate, faster

## Further Enhancements

1. **Personalization:** User-specific results
2. **Autocomplete:** Search suggestions
3. **Spell correction:** Fix typos
4. **Image search:** Visual search
5. **Voice search:** Speech recognition
6. **Real-time search:** Live results

