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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each cleaned chunk as a set of shingles. A shingle is a short overlapping token window, and two chunks are near duplicates when many of their shingles overlap.',
        'The MinHash and LSH stages only find candidate pairs. The canonicalization stage decides the durable evidence identity that retrieval will search and citations will point back through.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'RAG corpora are full of repeated text. Help centers mirror pages, PDFs repeat headers, release notes copy old wording, and email threads quote the same answer many times.',
        'Deduplication exists so retrieval spends ranks and prompt tokens on distinct current evidence instead of five copies of the same chunk. It should reduce redundancy without erasing provenance.',
        {type:'callout', text:`MinHash finds likely duplicate chunks cheaply, while canonicalization decides the durable evidence identity that retrieval should search and provenance should preserve.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/6d/Venn_A_intersect_B.svg', alt:'Venn diagram showing the intersection of sets A and B.', caption:`Venn diagram of set intersection. MinHash estimates overlap between shingle sets so the dedup pipeline can find likely near-duplicates before exact verification. Source: Wikimedia Commons, Cepheus, Public domain.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to embed every chunk and let the retriever or reranker sort the results. That fails because duplicates can all look highly relevant and crowd out exceptions, dates, and procedures.',
        'Another obvious approach is all-pairs comparison. That works for 1000 chunks but becomes impossible at 10 million chunks because about 50 trillion pairs would need comparison.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is candidate explosion. Duplicate control needs to find likely matches without comparing every chunk to every other chunk.',
        'Raw text equality is too brittle. HTML, PDF exports, OCR artifacts, headers, line breaks, and small date changes can make the same evidence look different while boilerplate makes unrelated pages look similar.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use textual resemblance for duplicate detection and stable identity for product behavior. Shingle sets capture overlapping text, Jaccard similarity measures overlap, MinHash compresses the set while preserving that overlap probabilistically, and locality-sensitive hashing groups likely matches.',
        'Detection is not the same as the final merge decision. A canonical record stores the winning chunk id, content hash, source aliases, version, freshness state, and policy decision for stale or jurisdiction-specific variants.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline cleans text before chunking by removing repeated navigation, headers, footers, page numbers, tracking strings, and template language. Each cleaned chunk becomes token shingles, and MinHash records compact minima across many hash functions.',
        'LSH divides signatures into bands and puts chunks that share a band into candidate buckets. The system then verifies candidates with exact Jaccard, containment, edit distance, freshness, authority, and source-specific rules before updating canonical records.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'MinHash works because the chance that two sets share a minimum hash equals their Jaccard similarity under a random permutation. Similar chunks therefore tend to have similar signatures without storing every shingle.',
        'LSH works as a filter because band matches make similar signatures meet in small buckets. The expensive exact checks run on likely pairs rather than the full quadratic set of pairs.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For 10 million chunks, a 128-value MinHash signature stored as 4-byte integers costs about 512 bytes per chunk, or about 5.12 GB before indexing overhead. That is large, but it is far cheaper than all-pairs comparison.',
        'Thresholds control behavior. Lower thresholds find more candidates and risk false merges, while higher thresholds protect distinct variants but leave more duplicate chunks in retrieval.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits support search, policy assistants, legal research, documentation search, code search over generated files, enterprise knowledge bases, and evaluation-set hygiene. It improves retrieval diversity and reduces embedding, vector storage, and prompt-token waste.',
        'It also makes stale-source debugging easier. If a bad answer came from an old PDF alias, the canonical record can show why that alias was still active.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Dedup fails when boilerplate dominates the shingles. Two unrelated documents can collide because their navigation, footer, or template language was not removed.',
        'It also fails when policy is too aggressive. Jurisdiction-specific rules, price tiers, date windows, quoted source material, and examples may look near-duplicate while carrying different legal or product meaning.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Two refund chunks each produce 100 shingles after cleaning, and they share 82 shingles. Their Jaccard similarity is 82 divided by 118, or about 0.695, because the union contains 100 + 100 - 82 shingles.',
        'With a 128-row MinHash signature, the expected shared signature positions are about 89. If LSH uses 32 bands of 4 rows, those chunks are likely to become candidates, after which exact verification can decide whether the current HTML page replaces the stale PDF.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Andrei Broder on resemblance and containment, and the Stanford Mining of Massive Datasets chapter on MinHash and locality-sensitive hashing. These explain the probability model behind signatures and candidate buckets.',
        'Study content-defined chunking, RAG index lifecycle and alias swap, maximal marginal relevance, reciprocal rank fusion, citation span indexes, and RAG evaluation next. Dedup is useful only if the downstream retrieval and citation layers preserve the canonical identity.',
      ],
    },
  ],
};
