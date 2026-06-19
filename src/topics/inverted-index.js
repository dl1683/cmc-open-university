// Inverted index: map each normalized term to a sorted postings list, then
// answer text queries by intersecting, skipping, scoring, and merging segments.

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'inverted-index',
  title: 'Inverted Index',
  category: 'Data Structures',
  summary: 'The search-engine index: terms point to sorted postings lists, positions, frequencies, and segment metadata.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build postings', 'query execution'], defaultValue: 'build postings' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function corpusTable(title) {
  return labelMatrix(
    title,
    [
      { id: 'd1', label: 'doc 1' },
      { id: 'd2', label: 'doc 2' },
      { id: 'd3', label: 'doc 3' },
      { id: 'd4', label: 'doc 4' },
    ],
    [
      { id: 'text', label: 'text' },
      { id: 'tokens', label: 'normalized tokens' },
      { id: 'docid', label: 'doc id' },
    ],
    [
      ['fast search needs indexes', 'fast search need index', '1'],
      ['search engines score documents', 'search engine score document', '2'],
      ['fast documents need compression', 'fast document need compression', '3'],
      ['engines merge index segments', 'engine merge index segment', '4'],
    ],
  );
}

function postingTable(title) {
  return labelMatrix(
    title,
    [
      { id: 'fast', label: 'fast' },
      { id: 'search', label: 'search' },
      { id: 'need', label: 'need' },
      { id: 'engine', label: 'engine' },
      { id: 'document', label: 'document' },
      { id: 'index', label: 'index' },
    ],
    [
      { id: 'df', label: 'doc freq' },
      { id: 'postings', label: 'postings' },
      { id: 'positions', label: 'positions' },
    ],
    [
      ['2', '1,3', '1:1 3:1'],
      ['2', '1,2', '1:2 2:1'],
      ['2', '1,3', '1:3 3:3'],
      ['2', '2,4', '2:2 4:1'],
      ['2', '2,3', '2:4 3:2'],
      ['2', '1,4', '1:4 4:3'],
    ],
  );
}

function segmentGraph(title) {
  return graphState({
    nodes: [
      { id: 'writer', label: 'index writer', x: 0.7, y: 3.8, note: 'token stream' },
      { id: 'buffer', label: 'memory buffer', x: 2.6, y: 2.3, note: 'new postings' },
      { id: 'segA', label: 'segment A', x: 4.8, y: 1.4, note: 'immutable' },
      { id: 'segB', label: 'segment B', x: 4.8, y: 3.8, note: 'immutable' },
      { id: 'segC', label: 'segment C', x: 4.8, y: 6.2, note: 'immutable' },
      { id: 'merge', label: 'merge policy', x: 7.0, y: 3.8, note: 'rewrite' },
      { id: 'big', label: 'larger segment', x: 9.0, y: 3.8, note: 'fewer seeks' },
    ],
    edges: [
      { id: 'e-write-buffer', from: 'writer', to: 'buffer', weight: 'add docs' },
      { id: 'e-flush-a', from: 'buffer', to: 'segA', weight: 'flush' },
      { id: 'e-flush-b', from: 'buffer', to: 'segB', weight: 'flush' },
      { id: 'e-flush-c', from: 'buffer', to: 'segC', weight: 'flush' },
      { id: 'e-a-merge', from: 'segA', to: 'merge', weight: 'input' },
      { id: 'e-b-merge', from: 'segB', to: 'merge', weight: 'input' },
      { id: 'e-c-merge', from: 'segC', to: 'merge', weight: 'input' },
      { id: 'e-merge-big', from: 'merge', to: 'big', weight: 'output' },
    ],
  }, { title });
}

function* buildPostings() {
  yield {
    state: corpusTable('Start with documents, not rows in a database'),
    highlight: { active: ['d1:text', 'd2:text', 'd3:text', 'd4:text'] },
    explanation: 'Search starts by turning documents into token streams. The indexer normalizes words, often lowercasing, stemming, dropping stop words, and recording positions. Tokenization is not cleanup; it defines what the engine can later find.',
  };

  yield {
    state: corpusTable('Normalize into terms and doc ids'),
    highlight: { active: ['d1:tokens', 'd2:tokens', 'd3:tokens', 'd4:tokens'], found: ['d1:docid', 'd2:docid'] },
    explanation: 'The engine emits term-document-position facts: search appears in doc 1 at position 2 and doc 2 at position 1. A Hash Table or Trie can hold the term dictionary while postings are sorted by doc id.',
  };

  yield {
    state: postingTable('Group facts into postings lists'),
    highlight: { found: ['search:postings', 'need:postings', 'index:postings'], active: ['search:positions'] },
    explanation: 'An inverted index flips the corpus: instead of doc -> words, it stores term -> postings. Postings lists are sorted, so Boolean search becomes merge-like intersection instead of scanning every document.',
    invariant: 'For each term, postings are sorted by document id.',
  };

  yield {
    state: segmentGraph('Production indexes write immutable segments'),
    highlight: { active: ['writer', 'buffer', 'segA', 'segB', 'segC', 'e-write-buffer'], compare: ['merge', 'big'] },
    explanation: 'Real engines usually do not mutate one giant postings file. They buffer new documents, flush immutable segments, search across segments, and merge smaller segments in the background. This is the same operational shape as LSM Trees (How Cassandra Writes).',
  };

  yield {
    state: segmentGraph('Segment merging is compaction for search'),
    highlight: { active: ['segA', 'segB', 'segC', 'merge', 'big', 'e-a-merge', 'e-b-merge', 'e-c-merge', 'e-merge-big'], found: ['big'] },
    explanation: 'Merging rewrites postings into larger segments, removes deleted documents, and improves query locality. The cost is write amplification. The payoff is fewer segments to search and better compressed postings.',
  };
}

function* queryExecution() {
  yield {
    state: postingTable('Boolean query: fast AND need'),
    highlight: { active: ['fast:postings', 'need:postings'], compare: ['search:postings'], found: ['fast:df', 'need:df'] },
    explanation: 'For fast AND need, intersect the postings lists [1,3] and [1,3]. Because both lists are sorted, two pointers walk forward exactly like Merge Sort. The result is docs 1 and 3 without touching docs that lack either term.',
  };

  yield {
    state: labelMatrix(
      'Two-pointer postings intersection',
      [
        { id: 's0', label: 'step 1' },
        { id: 's1', label: 'step 2' },
        { id: 's2', label: 'step 3' },
        { id: 'out', label: 'result' },
      ],
      [
        { id: 'fast', label: 'fast pointer' },
        { id: 'need', label: 'need pointer' },
        { id: 'action', label: 'action' },
      ],
      [
        ['1', '1', 'emit 1'],
        ['3', '3', 'emit 3'],
        ['end', 'end', 'stop'],
        ['1,3', '1,3', 'matched docs'],
      ],
    ),
    highlight: { found: ['s0:action', 's1:action', 'out:action'], active: ['s0:fast', 's0:need'] },
    explanation: 'The simple case is clean because both terms have short lists. In a real web-scale index, one term may have millions of postings and another may have thousands. Query planners start with selective terms and use skip pointers or block-max metadata to avoid useless work.',
  };

  yield {
    state: labelMatrix(
      'Phrase query needs positions, not just doc ids',
      [
        { id: 'd1', label: 'doc 1' },
        { id: 'd2', label: 'doc 2' },
        { id: 'd3', label: 'doc 3' },
      ],
      [
        { id: 'fast', label: 'fast positions' },
        { id: 'need', label: 'need positions' },
        { id: 'phrase', label: 'fast ... need?' },
      ],
      [
        ['1', '3', 'gap: no exact phrase'],
        ['', '', 'missing fast'],
        ['1', '3', 'gap: no exact phrase'],
      ],
    ),
    highlight: { active: ['d1:fast', 'd1:need', 'd3:fast', 'd3:need'], removed: ['d1:phrase', 'd3:phrase'] },
    explanation: 'A postings list can also store positions. That lets the engine answer phrase and proximity queries: "fast need" requires adjacent positions, while "fast NEAR need" allows a window. Positions cost space but add expressive power.',
  };

  yield {
    state: labelMatrix(
      'Ranking layers sit on top of retrieval',
      [
        { id: 'retrieve', label: 'retrieve' },
        { id: 'score', label: 'score' },
        { id: 'rerank', label: 'rerank' },
        { id: 'hybrid', label: 'hybrid search' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'signal', label: 'signal' },
        { id: 'neighbor', label: 'study link' },
      ],
      [
        ['postings lists', 'term match', 'Trie'],
        ['tf-idf/BM25', 'term statistics', 'Naive Bayes'],
        ['learned model', 'features', 'Feature Store'],
        ['text + vectors', 'lexical and semantic', 'Embeddings & Similarity'],
      ],
    ),
    highlight: { found: ['retrieve:structure', 'score:signal', 'hybrid:neighbor'], compare: ['rerank:structure'] },
    explanation: 'The inverted index retrieves candidates. Ranking decides order. Modern search often combines lexical retrieval with embeddings, then reranks with richer features. That is why Inverted Index links directly to RAG Pipeline, Feature Store, and Embeddings & Similarity.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build postings') yield* buildPostings();
  else if (view === 'query execution') yield* queryExecution();
  else throw new InputError('Pick an inverted-index view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The build-postings view shows the inversion: raw documents on the left become sorted postings lists on the right. Active (highlighted) cells mark the terms or doc ids currently being processed. Found markers indicate completed postings entries whose sorted order is now locked in.',
        'The segment frames show the production lifecycle: buffer, flush, search, merge. Active nodes are the write path; compare-highlighted nodes are the merge path.',
        'In the query-execution view, active postings lists are the ones participating in the current Boolean intersection. The two-pointer table steps through the merge. Found markers in the action column are emitted matches. If a document is absent from a postings list, it never appears as a candidate -- that is the whole point.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An inverted index exists because search should not scan every document for every query. Text collections, logs, code repositories, and RAG corpora need a direct route from a query term to the documents that might contain it.',
        'The structure flips the corpus. Instead of document -> terms, it stores term -> postings. That one reversal is the foundation of fast Boolean search, phrase search, lexical retrieval, and many candidate-generation stages in modern search systems.',
      ],
    },
    {
      heading: 'The obvious approach: the forward index',
      paragraphs: [
        'The natural first attempt is a forward index: store each document as a list of its terms. To answer a query, scan every document and check whether it contains the query terms. This is grep. It works, it is simple, and for a folder of 200 files it is fast enough.',
        'A forward index maps document -> terms. Searching for "quick" means opening every document and checking its term list. With 50 million documents, a single query touches 50 million term lists even though only 3,000 of them contain the word. Almost all the work proves absence.',
        'The wall is selectivity. Search needs to start from the terms in the query, not from the documents in the corpus. A forward index cannot skip irrelevant documents because its structure does not know which documents are relevant until it has read them all.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Map each normalized term to a postings list. A posting says that the term appears in a document, usually with extra data such as term frequency, positions, fields, payloads, or block-level score metadata.',
        'The key invariant is that each postings list is sorted by document id. Sorted postings make Boolean intersection a merge problem, make skipping possible, and let query engines move monotonically through candidate documents.',
        'Positions add another invariant: within a document, occurrences are ordered. That is what lets phrase and proximity queries test word order after the document-level candidates have been found.',
      ],
    },
    {
      heading: 'What the diagram emphasizes',
      paragraphs: [
        'In the build-postings view, read the first table left to right: raw text becomes normalized tokens, and each document receives a doc id. The postings table then shows the inversion: terms such as search, need, and index point back to sorted document lists.',
        'The segment frames show the production shape. New postings are buffered, flushed into immutable segments, searched across segments, and merged in the background. This is why search indexing resembles an LSM tree even though the query API looks very different.',
        'In the query-execution view, the highlighted postings lists are the only documents the Boolean query needs to consider. The phrase frame adds positions, and the ranking frame separates retrieval from scoring and reranking.',
      ],
    },
    {
      heading: 'Tokenization and stemming',
      paragraphs: [
        'Before anything enters the index, text passes through an analysis pipeline. Tokenization splits raw text into terms: "The quick brown fox" becomes ["the", "quick", "brown", "fox"]. Lowercasing normalizes case. A stop-word filter may drop "the" because it appears in nearly every document and carries little search value.',
        'Stemming reduces words to a root form. Porter stemming maps "running", "runs", "ran" to "run". Lemmatization is more precise but slower, using dictionary lookup: "better" becomes "good". The choice matters because the indexer and the query analyzer must agree. If the indexer stems "documents" to "document" but the query does not, the term will not match.',
        'Other common analyzers include n-gram tokenizers (for substring and fuzzy matching), language-specific analyzers (CJK segmentation, German compound splitting), synonym expansion, and phonetic encoding. Each analyzer choice trades recall for precision or index size for query power.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Index construction tokenizes documents, normalizes terms, assigns doc ids, emits term-document-position facts, groups those facts by term, sorts postings by doc id, and writes a term dictionary plus compressed postings files.',
        'A Boolean AND query intersects postings lists, usually starting with the most selective term. Two pointers walk the sorted lists in lockstep: if both point to the same doc id, emit a match and advance both; if one is smaller, advance it because the smaller doc id cannot appear in the other list. This is the same merge logic as Merge Sort, running in O(n + m) where n and m are the list lengths.',
        'A phrase query first intersects documents, then checks positions inside each candidate. A ranked query retrieves candidates and scores them with term statistics such as TF-IDF or BM25, field boosts, static quality, learned features, or reranking models.',
        'Large engines write immutable segments instead of mutating one giant index. Deletes are often tombstones until a merge rewrites segments. Merging improves locality and compression, but it creates write amplification.',
      ],
    },
    {
      heading: 'TF-IDF scoring',
      paragraphs: [
        'After retrieval identifies candidate documents, scoring decides the order. TF-IDF (term frequency -- inverse document frequency) is the foundational ranking signal. TF measures how often a term appears in a single document: a document mentioning "index" five times is more likely to be about indexing than one mentioning it once. IDF measures how rare a term is across the entire corpus: "the" appears in almost every document (low IDF), while "inverted" appears in few (high IDF).',
        'The score for a term t in document d is TF(t,d) * IDF(t). TF is typically the raw count or its logarithm (1 + log(tf)) to dampen the effect of very high frequency. IDF is typically log(N / df), where N is the total number of documents and df is the number of documents containing t. The document score for a multi-term query is the sum of per-term TF-IDF scores.',
        'BM25 refines TF-IDF with two improvements: term frequency saturates (a 20th occurrence adds less than the 2nd), and longer documents are penalized so that a long document does not win simply by containing more words. BM25 has two tuning parameters: k1 controls TF saturation (typically 1.2) and b controls length normalization (typically 0.75). Elasticsearch, Solr, and Lucene all default to BM25.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Retrieval is correct if the analyzer and indexer record every searchable occurrence under the same normalized term that the query analyzer will later produce. If query term q maps to postings list P, every indexed document containing q must appear in P.',
        'Two-pointer intersection is correct because postings are sorted. If one pointer is at a smaller doc id than the other, that smaller document cannot match the larger one, so advancing it cannot skip a valid intersection. Equal ids are emitted as matches.',
        'Phrase search is correct only when positions are stored and analyzed consistently. A document that contains fast at position 1 and need at position 3 matches a proximity query with a gap allowance, but not the exact phrase fast need.',
      ],
    },
    {
      heading: 'Worked example: indexing 3 documents and querying "quick fox"',
      paragraphs: [
        'Consider three documents. Doc 1: "the quick brown fox jumps". Doc 2: "a quick red car". Doc 3: "the fox is quick and brown". After lowercasing, removing stop words ("the", "a", "is", "and"), and no stemming, the normalized term lists are: Doc 1: [quick, brown, fox, jumps]. Doc 2: [quick, red, car]. Doc 3: [fox, quick, brown].',
        'Building the inverted index produces these postings lists (sorted by doc id): quick -> [1, 2, 3], brown -> [1, 3], fox -> [1, 3], jumps -> [1], red -> [2], car -> [2]. Each entry can also store term frequency: quick appears once in each document (tf = 1 everywhere), fox appears once in docs 1 and 3.',
        'Now query "quick AND fox". The postings are quick: [1, 2, 3] and fox: [1, 3]. Two pointers start at the beginning. Pointer A (quick) = 1, pointer B (fox) = 1: match, emit doc 1, advance both. Pointer A = 2, pointer B = 3: 2 < 3, so advance A. Pointer A = 3, pointer B = 3: match, emit doc 3, advance both. Both exhausted. Result: {1, 3}. Doc 2 was skipped because it lacks "fox" -- the intersection never read it.',
        'For scoring, compute TF-IDF. N = 3 documents. IDF(quick) = log(3/3) = 0 (appears everywhere, no discriminating power). IDF(fox) = log(3/2) = 0.41. So the ranking signal comes almost entirely from "fox". Both docs 1 and 3 have tf(fox) = 1, so they tie on TF-IDF and a secondary signal (document length, recency, PageRank) would break the tie.',
        'In the animation corpus, the same logic applies. The query "fast AND need" intersects [1, 3] with [1, 3] and emits docs 1 and 3 without reading docs 2 or 4. If the query were "search AND engine", postings [1, 2] and [2, 4] would intersect to doc 2 alone.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Building the index costs O(D) where D is the total number of term occurrences across all documents. Each occurrence produces one posting entry. Dictionary construction (sorting terms, building a trie or FST) is O(V log V) where V is the vocabulary size, but V is typically much smaller than D.',
        'A Boolean AND query costs O(n + m) for two-pointer intersection on lists of length n and m. With skip pointers the practical cost drops to O(n * log(m/n)) when one list is much shorter, because the short list drives skips through the long list. An OR query costs O(n + m) but produces more candidates.',
        'Space is dominated by postings. Delta encoding and variable-byte or PForDelta compression reduce postings to 1-2 bytes per entry on average. Positions roughly double the index size. The term dictionary is compact: Lucene uses an FST (finite-state transducer) that typically fits in memory even for billions of terms.',
        'When the corpus doubles, the index roughly doubles. When query terms are selective (low df), query time barely changes because postings lists stay short. When query terms are common, query time grows, but techniques like block-max WAND and impact-ordered postings let the engine skip blocks whose maximum score cannot beat the current top-k threshold.',
      ],
    },
    {
      heading: 'Real-world uses: Lucene, Elasticsearch, and Solr',
      paragraphs: [
        'Apache Lucene is the reference implementation. It stores term dictionaries as FSTs, postings as compressed block streams with skip data, positions in separate files, and manages segments with a tiered merge policy. Lucene is a library, not a server; it powers everything below.',
        'Elasticsearch wraps Lucene in a distributed system. Each Elasticsearch index is split into shards, each shard is a Lucene index, and each Lucene index is a collection of segments. Queries fan out to shards, each shard runs a local Lucene query, and results are merged by a coordinating node. This is how Elasticsearch handles billions of documents: the inverted index runs locally per shard, distribution handles scale.',
        'Apache Solr also wraps Lucene but emphasizes configuration-driven schema design, faceting, and traditional enterprise search. Both Elasticsearch and Solr expose the same underlying postings, scoring (BM25 by default), and analysis pipeline from Lucene.',
        'Beyond search engines: PostgreSQL full-text search uses a GIN (generalized inverted index) to map lexemes to row IDs. SQLite FTS5 builds an inverted index inside the database file. Git code search (GitHub, Sourcegraph) uses inverted indexes over token streams from source files. Log aggregation tools (Splunk, Loki) invert log lines to answer grep-like queries at scale.',
        'Lexical retrieval remains strong for exact names, identifiers, error messages, rare terms, and filters. Even when vector retrieval adds semantic recall, postings are often the fastest way to honor exact constraints. Modern RAG pipelines frequently combine inverted-index retrieval with dense vector search in a hybrid approach.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when treated as just a hash map from word to documents. Serious systems need analyzers, positions, fields, compression, segment lifecycle, deletes, scoring statistics, and merge policy.',
        'It also fails at pure meaning. Exact terms miss paraphrases, synonyms, and conceptual similarity. Embeddings help with semantic recall, while learned sparse methods such as SPLADE bridge the gap by producing expanded sparse terms that still serve through postings.',
        'Analyzer mismatch is another common failure. If indexing lowercases, stems, or removes terms differently from querying, the correct documents may never be considered.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Make the analyzer a versioned contract. Store which tokenizer, normalization rules, stop-word list, synonym set, stemmer, and field rules produced each segment. Reindexing is often required when that contract changes; pretending old and new analysis are identical creates silent recall bugs.',
        'Keep postings metadata close to the query patterns you need to accelerate. Boolean filters need doc ids and fast intersections. Phrase search needs positions. Ranked top-k needs term statistics and upper-bound score data. Highlighting may need offsets. Each extra payload costs space, so the index should match real queries.',
        'Plan for deletes and merges from day one. Tombstones, soft deletes, segment warming, cache invalidation, and merge throttling are not side details; they decide whether indexing keeps up while queries stay fast.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Trie and finite-state dictionaries for term lookup, Suffix Array & LCP for another text-indexing family, Roaring Bitmaps for compressed set operations, LSM Trees for segment and compaction intuition, Block-Max WAND Top-k Retrieval for efficient ranking, SPLADE Learned Sparse Retrieval for neural sparse search, Embeddings & Similarity for dense retrieval, and RAG Pipeline for how retrieval feeds generation.',
        'For a deeper text-search foundation, read Introduction to Information Retrieval and Lucene index-format documentation, then inspect how a real engine stores dictionaries, postings, positions, norms, deletes, and segments.',
      ],
    },
    {
      heading: 'Inverted index vs. forward index',
      paragraphs: [
        'A forward index maps document -> terms. It answers "what terms does document 7 contain?" in O(1) but answers "which documents contain term X?" only by scanning every document: O(N). A forward index is natural for document storage and is how most databases store rows.',
        'An inverted index maps term -> documents. It answers "which documents contain X?" by reading one postings list: O(df) where df is the document frequency of X. But answering "what terms does document 7 contain?" requires scanning the entire dictionary or maintaining a separate forward structure.',
        'Most search engines keep both. The inverted index handles retrieval. A forward structure (stored fields, doc values, column store) handles display, sorting, aggregation, and highlighting. Lucene stores them in separate file formats within the same segment directory.',
        'The tradeoff is clear: the forward index is write-friendly (append a document), the inverted index is query-friendly (jump to matching documents). Building an inverted index from a forward index is the indexing step; it costs O(D) but pays for itself on every query.',
      ],
    },
    {
      heading: 'Posting list intersection for AND queries',
      paragraphs: [
        'AND queries are the most common Boolean operation, and posting list intersection is the engine behind them. The algorithm is a two-pointer merge on sorted lists. Given postings for term A = [2, 5, 8, 12, 17] and term B = [3, 5, 9, 12, 20], start both pointers at position 0.',
        'Compare A[0]=2 with B[0]=3. Since 2 < 3, advance A. Compare A[1]=5 with B[0]=3. Since 5 > 3, advance B. Compare A[1]=5 with B[1]=5. Match: emit doc 5, advance both. Continue: A[2]=8 vs B[2]=9, advance A. A[3]=12 vs B[2]=9, advance B. A[3]=12 vs B[3]=12: match, emit doc 12. A[4]=17 vs B[4]=20, advance A. A exhausted, stop. Result: {5, 12}.',
        'For multi-term AND queries, intersect the two shortest lists first to minimize intermediate results. With skip pointers (every k-th doc id stored separately), the short list can binary-search or gallop through the long list, reducing practical cost from O(n + m) to O(n * log(m/n)) when n is much less than m.',
        'OR queries union the lists instead of intersecting them. NOT queries subtract one list from another. These compose into arbitrary Boolean trees, which query planners optimize by reordering and pruning.',
      ],
    },
    {
      heading: 'Sources and further reading',
      paragraphs: [
        'The canonical textbook is "Introduction to Information Retrieval" by Manning, Raghavan, and Schutze (Cambridge University Press, 2008), freely available online. Chapters 1-5 cover the inverted index, postings compression, and scoring. The BM25 formula originates from Robertson and Walker (1994).',
        'For implementation detail, the Lucene index format documentation describes exactly how terms, postings, positions, norms, and skip data are laid out on disk. The Elasticsearch and Solr reference guides explain distributed indexing and query fan-out built on top of Lucene segments.',
      ],
    },
],
};
