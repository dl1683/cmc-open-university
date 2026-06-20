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
    explanation: 'The opening frame is the naive corpus: repeated pages, boilerplate, and stale variants all look like candidates. If they reach retrieval unchanged, top-k can spend its slots on copies.',
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
    explanation: 'Read this as a two-stage filter. Shingles describe overlap, MinHash makes compact signatures, and LSH buckets likely duplicates so the expensive exact comparison runs only where it matters.',
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
    explanation: 'The canonical row is the durable object. Retrieval indexes one representative, while backlinks preserve where the text appeared and which source version it came from.',
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
      heading: 'Why this exists',
      paragraphs: [
        `Retrieval-augmented generation depends on the context window spending tokens on distinct, current evidence. Real corpora fight that assumption. Help centers mirror pages. PDFs contain repeated headers and page numbers. Release notes copy old wording with one date changed. Legal and policy documents keep stale versions online. Email threads repeat the same answer through quoted replies. If all of that text reaches the vector index unchanged, top-k retrieval can fill with five versions of the same chunk while missing exceptions, procedures, or dates.`,
        `RAG deduplication exists to make the corpus behave like evidence rather than a pile of files. It combines normalization, shingling, MinHash, locality-sensitive hashing, exact verification, and canonical chunk records. The goal is not to erase provenance. The goal is to index one representative chunk while preserving backlinks to every source version, so retrieval gets novelty and citations still know where the statement appeared.`,
        {type:'callout', text:`MinHash finds likely duplicate chunks cheaply, while canonicalization decides the durable evidence identity that retrieval should search and provenance should preserve.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/6d/Venn_A_intersect_B.svg', alt:'Venn diagram showing the intersection of sets A and B.', caption:`Venn diagram of set intersection. MinHash estimates overlap between shingle sets so the dedup pipeline can find likely near-duplicates before exact verification. Source: Wikimedia Commons, Cepheus, Public domain.`},
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        `The naive pipeline embeds every chunk and trusts the retriever or reranker to sort things out. That fails because duplicates are not just low-quality results; they can look highly relevant. A user asks about refunds, and every mirrored refund page has almost the same embedding. Rank fusion can make the problem worse by rewarding the same text from multiple indexes. The model then sees repeated evidence and may answer confidently from a stale duplicate.`,
        `The second naive approach is all-pairs comparison. Compare every chunk with every other chunk, merge the ones above a threshold, and call the corpus clean. That is simple for a thousand chunks and impossible for millions. Worse, raw text comparison before normalization confuses boilerplate with evidence. Two unrelated pages with the same footer can look similar, while an HTML page and a PDF export of the same policy can look different because one has page numbers and line breaks.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Near-duplicate detection should use the geometry that matches the problem. Dense embeddings are good at semantic neighborhood, but duplicate control needs textual resemblance and containment. A shingle set captures overlapping token windows. Jaccard similarity asks how much two sets overlap. MinHash compresses each set into a signature that preserves Jaccard behavior probabilistically. LSH banding turns those signatures into candidate buckets, so the system compares likely pairs instead of every possible pair.`,
        `Canonicalization is the product layer on top of detection. MinHash can say two chunks are likely near-duplicates; it cannot decide which one should survive. The canonical record stores a stable chunk id, content fingerprint, source aliases, version, freshness state, and duplicate policy decision. One representative enters retrieval. Duplicates become backlinks, aliases, tombstones, or excluded variants. The index becomes smaller, but the evidence ledger becomes richer.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `The pipeline starts before chunking. Normalize text by removing navigation, footers, repeated headers, tracking strings, page numbers, OCR artifacts, and template language that should not count as evidence. Then chunk the cleaned content with stable boundaries where possible. Each chunk becomes a set of token shingles, often fixed-length word sequences. MinHash applies many hash functions or hash permutations and keeps compact minima that approximate the original set's overlap behavior.`,
        `LSH groups signatures into bands. If two chunks share enough bands, they become a candidate pair. That pair still needs verification: exact Jaccard, containment, edit distance, source freshness, document type, timestamp, authority, and domain-specific rules. A refund FAQ copied from the current policy may merge. A stale PDF may become a tombstone. A jurisdiction-specific policy may stay separate even if most words overlap. The decision is a policy judgment backed by data structures.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The first view proves that duplicate control starts before embeddings. Crawl, clean, chunk, shingle, MinHash, LSH, canonicalize, and index are ordered for a reason. If boilerplate survives into shingles, unrelated pages collide. If stale versions survive into the index, retrieval cannot distinguish current evidence from old evidence. MinHash and LSH are recall devices: they propose candidate pairs cheaply, but they do not make the final claim that two chunks are interchangeable.`,
        `The chunk-hygiene view proves that the canonical row is the durable object. Top-k before hygiene spends ranks on mirrors and stale exports. Top-k after hygiene has the current rule plus exceptions, dates, fees, and procedure details. That is the practical win: the context window uses tokens for new evidence, while backlinks still preserve every source that contained the duplicated statement.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `It works because it separates cheap candidate generation from expensive truth. MinHash signatures are small enough to compute and store for every chunk. LSH buckets make likely duplicates meet without scanning the whole corpus. Exact comparison and policy checks then run on a much smaller set. This changes the cost shape from quadratic comparison to a pipeline of linear signature creation, bucket lookup, and limited verification.`,
        `It also works because it keeps identity stable. A RAG stack has many downstream artifacts: embeddings, lexical indexes, reranker features, citations, eval failures, answer caches, and feedback traces. If dedup is a one-off cleanup script, those artifacts drift. Canonical ids and content fingerprints let the system know whether a chunk changed, moved, merged, split, or became stale. That makes invalidation precise instead of rebuilding or trusting old references blindly.`,
      ],
    },
    {
      heading: 'Tradeoffs and cost',
      paragraphs: [
        `The engineering cost is not only signatures. The system stores shingles or their hashes, MinHash signatures, LSH buckets, canonical records, source aliases, tombstones, freshness states, and audit samples. Thresholds must be tuned against false merges and missed duplicates. A low threshold finds more candidates but can over-prune legitimate variants. A high threshold is safer but leaves repeated chunks in retrieval. Chunk size also matters: large chunks hide small differences, while tiny chunks create noisy overlaps.`,
        `Operational drift is the harder cost. Websites change templates, PDFs are regenerated, policy pages are updated, and chunking algorithms evolve. A canonical id should survive harmless source movement but change when the evidence changes. Backfills need to preserve citation lineage. Shadow indexes need to prove that a dedup change improves context quality before alias swap. A good dedup system behaves like part of the index lifecycle, not a cleaning script someone runs once.`,
      ],
    },
    {
      heading: 'Uses and failure modes',
      paragraphs: [
        `Dedup helps support assistants, policy copilots, legal research, documentation search, enterprise knowledge bases, code search over generated files, and evaluation-set hygiene. It improves retrieval precision, reduces token waste, lowers embedding and storage cost, prevents duplicate votes in rank fusion, and makes stale-source failures easier to diagnose. It also helps evaluation: if a faithfulness failure came from a stale duplicate, the evidence chain can identify the source alias rather than blaming the model alone.`,
        `The failure modes are subtle. URL-based dedup misses mirrors and exports. Embedding-based dedup can collapse semantically related but distinct rules. Boilerplate-heavy pages can look duplicate even when the middle paragraph differs. Over-aggressive containment rules can delete jurisdiction-specific policies, price tiers, date windows, quoted source material, or examples that should remain separate. Every dedup policy needs sampled false positives, sampled false negatives, and an audit trail for why a canonical chunk won.`,
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        `A support RAG system ingests a help center, a PDF archive, release notes, and emailed policy updates. The refund policy appears as HTML, a PDF export, a FAQ answer, and a copied email. Older PDFs still say 45 days, while the current HTML says 30 days with exceptions. Before dedup, top-k returns five refund chunks, including stale copies. The answer is fluent, cited, and wrong.`,
        `After dedup, the pipeline strips boilerplate, shingles cleaned chunks, uses MinHash and LSH to find mirrors, verifies candidates, tombstones stale versions, and indexes one current canonical chunk with aliases to every source. Top-k now includes the rule, exceptions, fee policy, contact procedure, and date caveat. The model did not become smarter; the evidence presented to it became less redundant and less stale.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Broder on resemblance and containment at https://www.cs.princeton.edu/courses/archive/spr05/cos598E/bib/broder97resemblance.pdf and the Stanford MMDS MinHash/LSH chapter at https://infolab.stanford.edu/~ullman/mmds/ch3n.pdf. Study MinHash and Locality-Sensitive Hashing for the signature math, Content-Defined Chunking Dedup for boundary stability, RAG Index Lifecycle and Alias Swap for rebuilds, Maximal Marginal Relevance and Reciprocal Rank Fusion for diversity after retrieval, and RAG Evaluation for measuring whether dedup actually improves answers.`,
      ],
    },
  ],
};
