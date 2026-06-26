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
  const docCount = 4;
  const termCount = 6;
  const segmentCount = 3;

  yield {
    state: corpusTable('Start with documents, not rows in a database'),
    highlight: { active: ['d1:text', 'd2:text', 'd3:text', 'd4:text'] },
    explanation: `Search starts by turning ${docCount} documents into token streams. The indexer normalizes words, often lowercasing, stemming, dropping stop words, and recording positions. Tokenization is not cleanup; it defines what the engine can later find.`,
  };

  yield {
    state: corpusTable('Normalize into terms and doc ids'),
    highlight: { active: ['d1:tokens', 'd2:tokens', 'd3:tokens', 'd4:tokens'], found: ['d1:docid', 'd2:docid'] },
    explanation: `The engine emits term-document-position facts: search appears in doc 1 at position 2 and doc 2 at position 1. A Hash Table or Trie can hold the ${termCount}-term dictionary while postings are sorted by doc id.`,
  };

  yield {
    state: postingTable('Group facts into postings lists'),
    highlight: { found: ['search:postings', 'need:postings', 'index:postings'], active: ['search:positions'] },
    explanation: `An inverted index flips the ${docCount}-document corpus: instead of doc -> words, it stores term -> postings across ${termCount} terms. Postings lists are sorted, so Boolean search becomes merge-like intersection instead of scanning every document.`,
    invariant: `For each of the ${termCount} terms, postings are sorted by document id.`,
  };

  yield {
    state: segmentGraph('Production indexes write immutable segments'),
    highlight: { active: ['writer', 'buffer', 'segA', 'segB', 'segC', 'e-write-buffer'], compare: ['merge', 'big'] },
    explanation: `Real engines usually do not mutate one giant postings file. They buffer new documents, flush ${segmentCount} immutable segments, search across segments, and merge smaller segments in the background. This is the same operational shape as LSM Trees (How Cassandra Writes).`,
  };

  yield {
    state: segmentGraph('Segment merging is compaction for search'),
    highlight: { active: ['segA', 'segB', 'segC', 'merge', 'big', 'e-a-merge', 'e-b-merge', 'e-c-merge', 'e-merge-big'], found: ['big'] },
    explanation: `Merging rewrites postings from ${segmentCount} segments into a larger one, removes deleted documents, and improves query locality. The cost is write amplification. The payoff is fewer segments to search and better compressed postings.`,
  };
}

function* queryExecution() {
  const queryTerms = ['fast', 'need'];
  const matchedDocs = [1, 3];
  const intersectionSteps = 3;
  const phraseDocCount = 3;
  const rankingLayers = 4;

  yield {
    state: postingTable('Boolean query: fast AND need'),
    highlight: { active: ['fast:postings', 'need:postings'], compare: ['search:postings'], found: ['fast:df', 'need:df'] },
    explanation: `For ${queryTerms[0]} AND ${queryTerms[1]}, intersect the postings lists [1,3] and [1,3]. Because both lists are sorted, two pointers walk forward exactly like Merge Sort. The result is docs ${matchedDocs.join(' and ')} without touching docs that lack either term.`,
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
    explanation: `The simple case completes in ${intersectionSteps} steps because both terms have short lists. In a real web-scale index, one term may have millions of postings and another may have thousands. Query planners start with selective terms and use skip pointers or block-max metadata to avoid useless work.`,
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
    explanation: `A postings list can also store positions across ${phraseDocCount} candidate documents. That lets the engine answer phrase and proximity queries: "${queryTerms[0]} ${queryTerms[1]}" requires adjacent positions, while "${queryTerms[0]} NEAR ${queryTerms[1]}" allows a window. Positions cost space but add expressive power.`,
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
    explanation: `The inverted index retrieves candidates through ${rankingLayers} layers. Ranking decides order. Modern search often combines lexical retrieval with embeddings, then reranks with richer features. That is why Inverted Index links directly to RAG Pipeline, Feature Store, and Embeddings & Similarity.`,
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
    {heading: 'How to read the animation', paragraphs: ['The animation turns documents into a term dictionary and postings lists. Active terms are being indexed or queried, and found document ids are candidates.', {type: 'callout', text: 'An inverted index wins by proving absence cheaply: only documents in the postings lists become candidates.'}, {type: 'image', src: './assets/gifs/inverted-index.gif', alt: 'Animated walkthrough of the inverted index visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['Search should begin with the query terms, not with every document. An inverted index flips storage from document-to-terms into term-to-documents so irrelevant documents are never opened.']},
    {heading: 'The obvious approach', paragraphs: ['The obvious approach is a forward index: store each document as text or tokens, then scan all documents for a query. This works for a small folder but wastes work in a large corpus.']},
    {heading: 'The wall', paragraphs: ['The wall is selectivity. If only 3,000 of 50,000,000 documents contain a rare term, scanning all documents spends almost all its time proving absence.']},
    {heading: 'The core insight', paragraphs: ['Map each normalized term to a sorted postings list of document ids. Sorted postings make Boolean AND a merge, and positions make phrase queries possible.', {type: 'image', src: 'https://iq.opengenus.org/content/images/2022/02/IMG_20210321_095052.JPG', alt: 'Inverted index diagram with term dictionary, document frequency, and posting lists', caption: 'The posting-list diagram makes the reversal visible: terms point to sorted document ids, not the other way around. Source: OpenGenus IQ, Shubham Sood.'}]},
    {heading: 'How it works', paragraphs: ['Indexing tokenizes documents, normalizes terms, assigns document ids, emits term-document-position facts, groups by term, sorts postings, and writes compressed lists. Querying runs the same analyzer, reads postings for query terms, intersects or unions them, then scores candidates.']},
    {heading: 'Why it works', paragraphs: ['Correctness depends on the analyzer contract: the indexer and query parser must produce the same normalized term. Intersection is correct because sorted postings let the smaller document id advance without skipping a possible match.']},
    {heading: 'Cost and complexity', paragraphs: ['Building costs O(D), where D is the number of emitted token occurrences. A two-term AND costs O(n + m) for postings lengths n and m, while storage is dominated by postings, positions, and segment metadata.']},
    {heading: 'Real-world uses', paragraphs: ['Lucene, Elasticsearch, Solr, PostgreSQL full-text search, SQLite FTS, code search, and log search all use inverted indexes. Hybrid retrieval systems pair them with vector search for semantic recall.']},
    {heading: 'Where it fails', paragraphs: ['It fails at pure meaning when the query uses different words from the document. It also fails when analyzer versions drift, because a term normalized at index time may not match the same user term at query time.']},
    {heading: 'Worked example', paragraphs: ['For docs 1: quick brown fox, 2: quick red car, and 3: fox quick brown, quick maps to [1, 2, 3] and fox maps to [1, 3]. Query quick AND fox emits 1, skips 2, emits 3, and returns documents 1 and 3.']},
    {heading: 'Sources and study next', paragraphs: ['Read Introduction to Information Retrieval by Manning, Raghavan, and Schutze, plus Lucene index-format documentation. Then study Trie, Finite-State Transducer, Roaring Bitmap, LSM Tree, BM25, Block-Max WAND, and Embeddings Similarity.']},
  ],
};
