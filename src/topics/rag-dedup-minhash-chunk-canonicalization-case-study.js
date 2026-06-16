// RAG corpus deduplication: use normalization, shingles, MinHash, LSH, and
// canonical chunk ids so duplicate pages do not flood retrieval top-k.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rag-dedup-minhash-chunk-canonicalization-case-study',
  title: 'RAG Dedup, MinHash, and Chunk Canonicalization',
  category: 'AI & ML',
  summary: 'Clean a RAG corpus by detecting near-duplicate chunks, picking canonical versions, and preventing boilerplate from crowding evidence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['near duplicates', 'chunk hygiene'], defaultValue: 'near duplicates' },
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

function dedupGraph(title) {
  return graphState({
    nodes: [
      { id: 'crawl', label: 'crawl', x: 0.75, y: 3.2, note: 'docs' },
      { id: 'clean', label: 'clean', x: 2.1, y: 3.2, note: 'text' },
      { id: 'chunk', label: 'chunk', x: 3.45, y: 2.1, note: 'windows' },
      { id: 'shingle', label: 'shingle', x: 3.45, y: 4.3, note: 'tokens' },
      { id: 'minhash', label: 'minhash', x: 5.05, y: 3.2, note: 'sig' },
      { id: 'lsh', label: 'LSH', x: 6.5, y: 3.2, note: 'bucket' },
      { id: 'canon', label: 'canon', x: 8.0, y: 2.35, note: 'winner' },
      { id: 'index', label: 'index', x: 8.9, y: 4.15, note: 'RAG' },
    ],
    edges: [
      { id: 'e-crawl-clean', from: 'crawl', to: 'clean' },
      { id: 'e-clean-chunk', from: 'clean', to: 'chunk' },
      { id: 'e-clean-shingle', from: 'clean', to: 'shingle' },
      { id: 'e-shingle-minhash', from: 'shingle', to: 'minhash' },
      { id: 'e-minhash-lsh', from: 'minhash', to: 'lsh' },
      { id: 'e-lsh-canon', from: 'lsh', to: 'canon' },
      { id: 'e-canon-index', from: 'canon', to: 'index' },
      { id: 'e-chunk-index', from: 'chunk', to: 'index' },
    ],
  }, { title });
}

function* nearDuplicates() {
  yield {
    state: dedupGraph('Duplicate control starts before embedding'),
    highlight: { active: ['crawl', 'clean', 'chunk'], found: ['shingle'] },
    explanation: 'A RAG corpus often contains repeated FAQ pages, mirrored PDFs, boilerplate footers, stale policy versions, and slightly edited release notes. If those duplicates reach the vector index unchanged, top-k retrieval can fill with the same evidence repeated five ways.',
  };

  yield {
    state: labelMatrix(
      'Normalize before comparing chunks',
      [
        { id: 'html', label: 'HTML' },
        { id: 'pdf', label: 'PDF' },
        { id: 'faq', label: 'FAQ' },
        { id: 'mail', label: 'email' },
      ],
      [
        { id: 'noise', label: 'noise' },
        { id: 'clean', label: 'clean key' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['nav/footer', 'main text', 'low'],
        ['page nums', 'body text', 'med'],
        ['template', 'answer text', 'high'],
        ['headers', 'thread text', 'med'],
      ],
    ),
    highlight: { active: ['html:clean', 'faq:clean'], compare: ['pdf:risk', 'mail:risk'] },
    explanation: 'Dedup quality depends on the representation. Remove headers, nav text, tracking boilerplate, page numbers, and repeated template language before generating shingles. Otherwise the deduper learns that every page is similar to every other page.',
  };

  yield {
    state: dedupGraph('MinHash signatures make near-duplicate search cheap'),
    highlight: { active: ['shingle', 'minhash', 'lsh'], found: ['canon'] },
    explanation: 'After normalization, each chunk becomes a set of token shingles. MinHash compresses that set into a signature, and LSH buckets likely-near chunks together so exact verification only runs on candidates.',
    invariant: 'MinHash finds candidates; canonicalization decides what survives.',
  };

  yield {
    state: labelMatrix(
      'Candidate pair decisions',
      [
        { id: 'p1', label: 'pair 1' },
        { id: 'p2', label: 'pair 2' },
        { id: 'p3', label: 'pair 3' },
        { id: 'p4', label: 'pair 4' },
      ],
      [
        { id: 'jac', label: 'Jaccard' },
        { id: 'kind', label: 'kind' },
        { id: 'action', label: 'action' },
      ],
      [
        ['0.96', 'mirror', 'merge'],
        ['0.88', 'stale ver', 'tombstone'],
        ['0.62', 'boiler', 'strip'],
        ['0.21', 'semantic', 'keep'],
      ],
    ),
    highlight: { found: ['p1:action'], removed: ['p2:action'], compare: ['p4:action'] },
    explanation: 'Near-duplicate detection is not the same as semantic equivalence. Two pages can say the same thing with different words and low overlap; two pages can share boilerplate without being the same evidence. Candidate pairs still need exact checks and policy rules.',
  };

  yield {
    state: dedupGraph('Only canonical chunks enter the retrieval index'),
    highlight: { active: ['canon', 'index'], removed: ['lsh'], found: ['chunk'] },
    explanation: 'The canonical chunk keeps backlinks to all duplicate sources, but the retrieval index gets one representative. That preserves provenance while preventing duplicates from crowding the context window.',
  };
}

function* chunkHygiene() {
  yield {
    state: labelMatrix(
      'Canonical record fields',
      [
        { id: 'cid', label: 'chunk id' },
        { id: 'hash', label: 'hash' },
        { id: 'dupes', label: 'dupes' },
        { id: 'fresh', label: 'fresh' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['stable id', 'joins data'],
        ['content fp', 'detect drift'],
        ['source ids', 'show lineage'],
        ['version', 'avoid stale'],
      ],
    ),
    highlight: { active: ['cid:stores', 'hash:stores', 'dupes:stores'], found: ['fresh:why'] },
    explanation: 'Canonicalization turns dedup from a one-off cleanup script into an index invariant. Every chunk has a stable id, content fingerprint, version, source list, and freshness state.',
  };

  yield {
    state: dedupGraph('Complete case: policy corpus cleanup'),
    highlight: { active: ['crawl', 'clean', 'minhash', 'lsh', 'canon', 'index'] },
    explanation: 'Case study: a policy assistant has three mirrors of the same refund page, two stale PDFs, and a fresh FAQ summary. Deduping collapses mirrors, tombstones stale versions, strips shared footer text, and keeps the fresh canonical chunk linked to every source that mentioned it.',
  };

  yield {
    state: labelMatrix(
      'Top-k before and after hygiene',
      [
        { id: 'r1', label: 'rank 1' },
        { id: 'r2', label: 'rank 2' },
        { id: 'r3', label: 'rank 3' },
        { id: 'r4', label: 'rank 4' },
        { id: 'r5', label: 'rank 5' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['refund mirror', 'refund current'],
        ['refund PDF old', 'refund FAQ'],
        ['refund FAQ', 'fee exception'],
        ['refund mirror', 'date rule'],
        ['refund PDF old', 'contact step'],
      ],
    ),
    highlight: { removed: ['r2:before', 'r4:before', 'r5:before'], found: ['r1:after', 'r3:after', 'r4:after'] },
    explanation: 'Dedup improves context precision without lowering recall. The answer still sees the refund rule, but the remaining slots can hold exceptions, dates, fees, and procedure details.',
    invariant: 'Context windows should spend tokens on new evidence, not repeated evidence.',
  };

  yield {
    state: labelMatrix(
      'Dedup interacts with other RAG tools',
      [
        { id: 'mmr', label: 'MMR' },
        { id: 'rrf', label: 'RRF' },
        { id: 'rerank', label: 'rerank' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['diversity', 'over-prune'],
        ['rank fusion', 'dup votes'],
        ['precision', 'stale text'],
        ['failure sets', 'hidden dupes'],
      ],
    ),
    highlight: { active: ['mmr:uses', 'rrf:watch', 'eval:watch'], compare: ['rerank:uses'] },
    explanation: 'Dedup is upstream of ranking. RRF can accidentally reward duplicates that appear in many indexes. MMR can reduce repetition after retrieval. RAG evaluation can expose when near-duplicate stale chunks are harming faithfulness.',
  };

  yield {
    state: dedupGraph('Hygiene links lexical, set, and vector structures'),
    highlight: { active: ['shingle', 'minhash', 'lsh', 'index'], found: ['canon'] },
    explanation: 'A strong retrieval stack uses the right geometry at each layer: shingles and MinHash for near-duplicate text, inverted indexes for exact terms, vector search for semantic neighbors, and rerankers for final precision.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'near duplicates') yield* nearDuplicates();
  else if (view === 'chunk hygiene') yield* chunkHygiene();
  else throw new InputError('Pick a dedup view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'RAG deduplication is the corpus-maintenance layer that prevents repeated or stale chunks from dominating retrieval. It combines text normalization, shingling, MinHash, locality-sensitive hashing, exact verification, and canonical chunk records. The goal is not to delete provenance; the goal is to index one canonical representative while preserving backlinks to every source version.',
        'This is a different problem from dense semantic search. HNSW and DiskANN find nearby embeddings. MinHash and LSH find near-duplicate sets of shingles. A production RAG system usually needs both because semantic similarity and textual resemblance catch different failure modes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First normalize the document text: remove navigation, footers, page numbers, tracking strings, repeated headers, and template boilerplate. Then split into chunks and represent each chunk as token shingles. MinHash compresses each shingle set into a signature whose collision behavior estimates Jaccard similarity. LSH banding buckets signatures so likely duplicates become candidates without comparing all pairs.',
        'Candidates are verified with stricter checks: exact Jaccard, containment, edit distance, source version, timestamp, document type, and domain-specific rules. The winner becomes the canonical chunk. Duplicates become backlinks, aliases, tombstones, or excluded variants. The vector index receives canonical chunks; the source ledger still remembers every original source.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The expensive baseline is all-pairs chunk comparison, which is infeasible for large corpora. MinHash plus LSH changes the cost shape: compute a compact signature for each chunk, use hash buckets to generate candidates, then verify only a small fraction. Storage includes signatures, buckets, canonical records, source aliases, and tombstone metadata.',
        'The operational cost is in drift. Websites change templates, PDFs are re-exported, documents are re-chunked, and product policies get replaced. A durable system stores content fingerprints and canonical ids so downstream citations, embeddings, eval sets, and cache entries can be invalidated precisely. RAG Index Lifecycle and Alias Swap shows how those canonical records move through tombstones, shadow rebuilds, and safe cutovers.',
      ],
    },
    {
      heading: 'Complete case study: duplicated policy corpus',
      paragraphs: [
        'A support RAG system ingests a help center, a PDF archive, release notes, and emailed policy updates. The same refund policy appears as HTML, PDF, and FAQ text. Older PDFs disagree with current HTML. Before dedup, top-k retrieval returns five near-identical refund chunks, two of them stale. The model answers confidently with the old 45-day rule.',
        'After dedup, the pipeline strips boilerplate, detects mirrors with MinHash, tombstones stale versions, stores source aliases, and indexes one fresh canonical chunk. Top-k now contains the current refund rule, exceptions, restocking fee policy, and contact procedure. RAG Evaluation improves because context precision rises and faithfulness failures from stale chunks drop.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not dedupe by URL alone. Mirrors, PDFs, exports, and copied support articles often carry different URLs. Do not dedupe by embedding similarity alone either; semantically related chunks are not necessarily duplicates. Conversely, boilerplate-heavy pages can look duplicate-like while their important middle paragraphs differ.',
        'Over-aggressive dedup can remove legitimate variants such as jurisdiction-specific policies, pricing tiers, date-specific rules, and quoted source documents. Keep duplicate decisions auditable, preserve aliases, and sample the false-positive and false-negative buckets. Treat dedup thresholds as eval-tuned data-structure parameters, not universal constants.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Broder on resemblance and containment at https://www.cs.princeton.edu/courses/archive/spr05/cos598E/bib/broder97resemblance.pdf and the Stanford MMDS MinHash/LSH chapter at https://infolab.stanford.edu/~ullman/mmds/ch3n.pdf. Study MinHash & Locality-Sensitive Hashing, Content-Defined Chunking Dedup, RAG Pipeline, Multi-Index RAG, RAG Index Lifecycle and Alias Swap, Maximal Marginal Relevance, Reciprocal Rank Fusion, RAG Evaluation, and Citation Span Index next.',
      ],
    },
  ],
};
