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
      heading: 'Why this exists',
      paragraphs: [
        'An inverted index exists because search should not scan every document for every query. Text collections, logs, code repositories, and RAG corpora need a direct route from a query term to the documents that might contain it.',
        'The structure flips the corpus. Instead of document -> terms, it stores term -> postings. That one reversal is the foundation of fast Boolean search, phrase search, lexical retrieval, and many candidate-generation stages in modern search systems.',
      ],
    },
    {
      heading: 'Naive baseline and wall',
      paragraphs: [
        'The baseline is to store documents and scan their text at query time. That is acceptable for a tiny corpus and keeps ingestion simple. It collapses when the corpus has millions of documents and users expect interactive latency.',
        'A slightly better baseline stores a per-document set of normalized terms. That avoids raw text parsing at query time, but the query still touches far too many documents. A rare term might appear in 50 documents out of 50 million; a scan wastes almost all of its work proving absence.',
        'The wall is selectivity. Search needs to start from the terms in the query, not from the documents in the corpus.',
      ],
    },
    {
      heading: 'Core insight and invariant',
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
      heading: 'Mechanics',
      paragraphs: [
        'Index construction tokenizes documents, normalizes terms, assigns doc ids, emits term-document-position facts, groups those facts by term, sorts postings by doc id, and writes a term dictionary plus compressed postings files.',
        'A Boolean AND query intersects postings lists, usually starting with the most selective term. A phrase query first intersects documents, then checks positions inside each candidate. A ranked query retrieves candidates and scores them with term statistics such as tf-idf or BM25, field boosts, static quality, learned features, or reranking models.',
        'Large engines write immutable segments instead of mutating one giant index. Deletes are often tombstones until a merge rewrites segments. Merging improves locality and compression, but it creates write amplification.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'Retrieval is correct if the analyzer and indexer record every searchable occurrence under the same normalized term that the query analyzer will later produce. If query term q maps to postings list P, every indexed document containing q must appear in P.',
        'Two-pointer intersection is correct because postings are sorted. If one pointer is at a smaller doc id than the other, that smaller document cannot match the larger one, so advancing it cannot skip a valid intersection. Equal ids are emitted as matches.',
        'Phrase search is correct only when positions are stored and analyzed consistently. A document that contains fast at position 1 and need at position 3 matches a proximity query with a gap allowance, but not the exact phrase fast need.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In the animation corpus, fast appears in docs 1 and 3. Need also appears in docs 1 and 3. The query fast AND need intersects [1, 3] with [1, 3] and emits docs 1 and 3 without reading docs 2 or 4.',
        'For the phrase fast need, doc 1 has fast at position 1 and need at position 3, so the exact phrase is absent. Doc 3 has the same gap. Positions let the engine reject both documents after retrieval without rescanning the original text.',
        'If the query were search AND engine, postings [1, 2] and [2, 4] would intersect to doc 2. Ranking would then decide whether doc 2 is the best result, but retrieval has already narrowed the candidate set.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The main costs are postings size, dictionary size, positions, stored fields, query-time decompression, cache behavior, and merge write amplification. Positions make phrase queries possible but can be a large part of the index.',
        'Common optimizations include delta encoding doc ids, block compression, skip pointers, impact-ordered postings, block-max WAND metadata, Roaring Bitmaps for filters, term dictionaries backed by finite-state structures, query caches, and tiered segment merges.',
        'The best layout depends on query mix. Boolean filters want fast intersections. Phrase search wants positions. Top-k ranking wants scoring bounds and early termination. Hybrid search wants lexical candidates to cooperate with vector retrieval and reranking.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Inverted indexes win in web search, code search, log search, document retrieval, spam filtering, database text columns, observability tools, legal discovery, and many RAG pipelines.',
        'Lexical retrieval remains strong for exact names, identifiers, error messages, rare terms, filters, and explainability. Even when vector retrieval adds semantic recall, postings are often the fastest way to honor exact constraints.',
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
  ],
};
