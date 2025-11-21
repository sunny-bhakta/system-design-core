/**
 * Design Search Engine
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Web search engine that indexes billions of pages and provides fast search.
 * 
 * CAPACITY ESTIMATION:
 * - Pages: Billions of web pages
 * - Index Size: ~100TB for inverted index
 * - Storage: ~1PB for page content
 * - Queries: 5B queries/day = ~58K queries/second
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → Search Service → Inverted Index → Ranking → Results
 * 
 * KEY FEATURES:
 * - Web crawling (distributed crawlers)
 * - Inverted index for fast search
 * - PageRank algorithm for ranking
 * - Distributed indexing
 * - Query processing and ranking
 * 
 * CRAWLING:
 * - Distributed crawlers for parallel crawling
 * - URL frontier for managing crawl queue
 * - Robots.txt compliance
 * - Rate limiting per domain
 * 
 * INDEXING:
 * - Inverted index: term → list of document IDs
 * - Distributed across multiple servers
 * - Sharding by term hash
 * 
 * RANKING:
 * - PageRank: Link-based ranking
 * - TF-IDF: Term frequency-inverse document frequency
 * - Combined score for final ranking
 */
class SearchEngine {
  /**
   * Constructor
   * 
   * INITIALIZES DATA STRUCTURES:
   * ============================
   * All data structures are in-memory Maps for simplicity.
   * In production, would use distributed databases and indexes.
   */
  constructor() {
    /**
     * PAGE STORAGE
     * ============
     * Stores crawled pages with content and metadata.
     * In production: Distributed storage (HDFS, S3)
     */
    this.pages = new Map(); // url -> page data
    
    /**
     * INVERTED INDEX
     * ==============
     * Maps terms to document IDs containing that term.
     * Structure: term → Set<docId>
     * In production: Distributed across multiple servers, sharded by term
     */
    this.invertedIndex = new Map(); // term -> Set of doc IDs
    
    /**
     * DOCUMENT STORAGE
     * ================
     * Stores document metadata (URL, title, etc.).
     * In production: Distributed database
     */
    this.documents = new Map(); // docId -> document data
    
    /**
     * PAGERANK STORAGE
     * ================
     * Stores PageRank scores for each document.
     * PageRank measures importance based on incoming links.
     * In production: Distributed storage, recalculated periodically
     */
    this.pageRank = new Map(); // docId -> PageRank score
    
    /**
     * CRAWL QUEUE
     * ===========
     * Queue of URLs to crawl.
     * In production: Distributed queue (Kafka, RabbitMQ)
     */
    this.crawlQueue = [];
    
    /**
     * CRAWLED URLS
     * ============
     * Set of already crawled URLs to avoid duplicates.
     * In production: Bloom filter or distributed set
     */
    this.crawledUrls = new Set();
    
    /**
     * DOCUMENT ID COUNTER
     * ===================
     * Counter for generating unique document IDs.
     * In production: Distributed ID generator (Snowflake)
     */
    this.docIdCounter = 0;
  }

  /**
   * Crawl page
   */
  async crawlPage(url) {
    if (this.crawledUrls.has(url)) {
      return null;
    }

    // Simulate web crawling
    const page = {
      id: `doc_${this.docIdCounter++}`,
      url,
      title: `Page from ${url}`,
      content: this.extractContent(url), // Simulated
      links: this.extractLinks(url), // Simulated
      crawledAt: Date.now()
    };

    this.pages.set(url, page);
    this.documents.set(page.id, page);
    this.crawledUrls.add(url);

    // Add links to crawl queue
    for (const link of page.links) {
      if (!this.crawledUrls.has(link)) {
        this.crawlQueue.push(link);
      }
    }

    return page;
  }

  /**
   * Extract content (simulated)
   */
  extractContent(url) {
    // In real system, would parse HTML and extract text
    return `Content from ${url}. This page contains information about system design and distributed systems.`;
  }

  /**
   * Extract links (simulated)
   */
  extractLinks(url) {
    // In real system, would parse HTML and extract links
    return [
      `${url}/page1`,
      `${url}/page2`,
      `${url}/page3`
    ];
  }

  /**
   * Index pages
   */
  async indexPages() {
    // Build inverted index
    for (const [url, page] of this.pages.entries()) {
      const terms = this.tokenize(page.title + ' ' + page.content);
      
      for (const term of terms) {
        if (!this.invertedIndex.has(term)) {
          this.invertedIndex.set(term, new Set());
        }
        this.invertedIndex.get(term).add(page.id);
      }
    }

    // Calculate PageRank
    this.calculatePageRank();
  }

  /**
   * Tokenize text
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Calculate PageRank (simplified)
   */
  calculatePageRank() {
    const dampingFactor = 0.85;
    const iterations = 10;

    // Initialize PageRank
    const numPages = this.documents.size;
    const initialRank = 1.0 / numPages;

    for (const docId of this.documents.keys()) {
      this.pageRank.set(docId, initialRank);
    }

    // Iterate
    for (let i = 0; i < iterations; i++) {
      const newRanks = new Map();

      for (const [docId, doc] of this.documents.entries()) {
        let rank = (1 - dampingFactor) / numPages;

        // Sum contributions from linking pages
        for (const [otherDocId, otherDoc] of this.documents.entries()) {
          if (otherDoc.links && otherDoc.links.some(link => {
            const linkedPage = Array.from(this.pages.values()).find(p => p.url === link);
            return linkedPage && linkedPage.id === docId;
          })) {
            const outLinks = otherDoc.links ? otherDoc.links.length : 1;
            rank += dampingFactor * (this.pageRank.get(otherDocId) || 0) / outLinks;
          }
        }

        newRanks.set(docId, rank);
      }

      // Update ranks
      for (const [docId, rank] of newRanks.entries()) {
        this.pageRank.set(docId, rank);
      }
    }
  }

  /**
   * Search
   */
  async search(query, limit = 10) {
    const terms = this.tokenize(query);
    const docScores = new Map();

    // Find documents containing query terms
    for (const term of terms) {
      const docIds = this.invertedIndex.get(term);
      if (docIds) {
        for (const docId of docIds) {
          const score = docScores.get(docId) || 0;
          
          // TF-IDF score (simplified)
          const tf = this.calculateTF(term, docId);
          const idf = this.calculateIDF(term);
          const tfidf = tf * idf;
          
          // Combine with PageRank
          const pageRankScore = this.pageRank.get(docId) || 0;
          const combinedScore = tfidf * 0.7 + pageRankScore * 0.3;
          
          docScores.set(docId, score + combinedScore);
        }
      }
    }

    // Sort by score
    const sortedDocs = Array.from(docScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    // Return results
    return sortedDocs.map(([docId, score]) => {
      const doc = this.documents.get(docId);
      return {
        ...doc,
        score: score.toFixed(4)
      };
    });
  }

  /**
   * Calculate TF (Term Frequency)
   */
  calculateTF(term, docId) {
    const doc = this.documents.get(docId);
    if (!doc) return 0;

    const text = (doc.title + ' ' + doc.content).toLowerCase();
    const words = text.split(/\s+/);
    const termCount = words.filter(w => w === term).length;
    
    return termCount / words.length;
  }

  /**
   * Calculate IDF (Inverse Document Frequency)
   */
  calculateIDF(term) {
    const totalDocs = this.documents.size;
    const docsWithTerm = this.invertedIndex.get(term);
    const docCount = docsWithTerm ? docsWithTerm.size : 1;
    
    return Math.log(totalDocs / docCount);
  }

  /**
   * Batch crawl
   */
  async batchCrawl(urls, maxPages = 100) {
    this.crawlQueue.push(...urls);
    let crawled = 0;

    while (this.crawlQueue.length > 0 && crawled < maxPages) {
      const url = this.crawlQueue.shift();
      if (!this.crawledUrls.has(url)) {
        await this.crawlPage(url);
        crawled++;
      }
    }

    // Index after crawling
    await this.indexPages();

    return { crawled, total: this.pages.size };
  }
}

// Example usage
async function demonstrateSearchEngine() {
  console.log('=== Design Search Engine ===\n');

  const searchEngine = new SearchEngine();

  // Crawl pages
  const urls = [
    'https://example.com',
    'https://example.com/page1',
    'https://example.com/page2'
  ];

  await searchEngine.batchCrawl(urls, 10);
  console.log('Pages crawled:', searchEngine.pages.size);

  // Search
  const results = await searchEngine.search('system design');
  console.log('Search results:', results.map(r => ({
    title: r.title,
    url: r.url,
    score: r.score
  })));
}

if (require.main === module) {
  demonstrateSearchEngine();
}

module.exports = { SearchEngine };

