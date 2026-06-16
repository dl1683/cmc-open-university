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
      heading: 'What it is',
      paragraphs: [
        'An inverted index maps terms to postings lists. A posting says that a term appeared in a document, often with frequency, positions, fields, payloads, or score metadata. This turns search from "scan every document" into "look up a few sorted lists and combine them."',
        'The structure is foundational because it sits under search engines, code search, log search, document retrieval, spam filtering, and many RAG Pipeline systems. It is also a bridge topic: Hash Table, Trie, Merge Sort, Roaring Bitmaps, LSM Trees (How Cassandra Writes), SPLADE Learned Sparse Retrieval, and Embeddings & Similarity all become practical once you see how a search engine stores and queries text.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Index construction tokenizes documents, normalizes terms, emits term-document-position facts, sorts or groups those facts by term, and writes a term dictionary plus postings files. A Boolean query intersects postings lists. A phrase query also checks positions. A ranked query retrieves candidates and then scores them with term statistics, static quality, learned features, or neural reranking.',
        'Production indexes usually use immutable segments. New documents enter a memory buffer, flush into a segment, and become searchable. Background merges combine segments, remove deletes, and improve locality. This is search-flavored compaction: it buys query speed at the cost of write amplification.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main costs are postings size, dictionary size, merge write amplification, and query-time decompression. Common optimizations include sorted doc ids, delta compression, block compression, skip pointers, impact-ordered postings, tiered indexes, and caching. The right structure depends on query mix: exact phrase search, Boolean filtering, top-k ranking, and hybrid semantic search put pressure on different parts of the index.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lucene-style engines use inverted indexes with segments. Web search engines add huge ranking and serving layers. Observability tools use related structures for log search. Databases use inverted indexes for text columns and sometimes bitmap-style postings for analytical filters. Hybrid retrieval stacks combine inverted indexes with HNSW (Vector Search at Scale), Product Quantization for Vector Search, and learned rerankers.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An inverted index is not just a map from word to documents. Serious systems need positions, fields, compression, segment metadata, deletes, scoring statistics, and merge policy. Another misconception is that vector search replaces inverted indexes. In practice, lexical search remains valuable for exact names, identifiers, rare terms, filters, and explainability; vector search adds semantic recall. SPLADE shows the bridge case: a neural model can learn term expansion while still serving through postings.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Stanford Introduction to Information Retrieval contents at https://nlp.stanford.edu/IR-book/html/htmledition/contents-1.html, the Stanford PDF at https://nlp.stanford.edu/IR-book/pdf/irbookonlinereading.pdf, and Lucene index file format notes at https://lucene.apache.org/core/3_0_3/fileformats.html. Study Trie (Prefix Tree), Suffix Array & LCP, Roaring Bitmaps, LSM Trees (How Cassandra Writes), Block-Max WAND Top-k Retrieval, SPLADE Learned Sparse Retrieval, Embeddings & Similarity, and RAG Pipeline next.',
      ],
    },
  ],
};
