// MinHash and locality-sensitive hashing: compress large sets into signatures
// that estimate Jaccard similarity, then band the signatures to find candidates.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'minhash-lsh',
  title: 'MinHash & Locality-Sensitive Hashing',
  category: 'Data Structures',
  summary: 'Estimate set similarity with tiny signatures, then use banding so likely-near pairs become cheap candidates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['signature estimate', 'bands and candidates'], defaultValue: 'signature estimate' },
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

function* signatureEstimate() {
  yield {
    state: labelMatrix(
      'Documents become sets of shingles',
      [
        { id: 'docA', label: 'doc A' },
        { id: 'docB', label: 'doc B' },
        { id: 'docC', label: 'doc C' },
      ],
      [
        { id: 's1', label: 'ml' },
        { id: 's2', label: 'ai' },
        { id: 's3', label: 'gpu' },
        { id: 's4', label: 'db' },
        { id: 's5', label: 'log' },
      ],
      [
        ['1', '1', '1', '0', '0'],
        ['1', '1', '0', '0', '1'],
        ['0', '0', '1', '1', '1'],
      ],
    ),
    highlight: { active: ['docA:s1', 'docA:s2', 'docB:s1', 'docB:s2'], compare: ['docC:s4'] },
    explanation: 'MinHash starts by turning each item into a set: document shingles, user purchases, graph neighbors, image patches, or token n-grams. Exact Jaccard similarity needs intersection over union. That is expensive when there are millions of sets, so we replace the set with a compact signature.',
  };

  yield {
    state: labelMatrix(
      'MinHash signature: minimum permuted rank per hash',
      [
        { id: 'h1', label: 'hash 1' },
        { id: 'h2', label: 'hash 2' },
        { id: 'h3', label: 'hash 3' },
        { id: 'h4', label: 'hash 4' },
        { id: 'h5', label: 'hash 5' },
      ],
      [
        { id: 'a', label: 'doc A' },
        { id: 'b', label: 'doc B' },
        { id: 'c', label: 'doc C' },
      ],
      [
        ['12', '12', '44'],
        ['07', '07', '18'],
        ['31', '28', '28'],
        ['02', '02', '60'],
        ['19', '51', '19'],
      ],
    ),
    highlight: { found: ['h1:a', 'h1:b', 'h2:a', 'h2:b', 'h4:a', 'h4:b'], compare: ['h3:b', 'h3:c'] },
    explanation: 'For each random hash ordering, keep the minimum hash value seen in the set. Two sets have the same minimum with probability equal to their Jaccard similarity. In this toy signature, A and B match on 3 of 5 rows, so the MinHash estimate is 0.60.',
    invariant: 'Pr[MinHash(A) = MinHash(B)] = Jaccard(A, B).',
  };

  yield {
    state: labelMatrix(
      'Exact Jaccard versus MinHash estimate',
      [
        { id: 'ab', label: 'A vs B' },
        { id: 'ac', label: 'A vs C' },
        { id: 'bc', label: 'B vs C' },
      ],
      [
        { id: 'intersect', label: 'intersection' },
        { id: 'union', label: 'union' },
        { id: 'exact', label: 'exact' },
        { id: 'sig', label: 'signature' },
      ],
      [
        ['2', '4', '0.50', '0.60'],
        ['1', '5', '0.20', '0.20'],
        ['1', '5', '0.20', '0.20'],
      ],
    ),
    highlight: { active: ['ab:exact', 'ab:sig'], found: ['ac:sig', 'bc:sig'] },
    explanation: 'A short signature is noisy, but it is cheap and mergeable into a large search pipeline. More hash rows reduce variance. The pattern is the same family as HyperLogLog and Count-Min Sketch: keep a compact probabilistic summary when exact set comparison is too expensive.',
  };
}

function* bandsAndCandidates() {
  yield {
    state: labelMatrix(
      'Banding splits a signature into hashable chunks',
      [
        { id: 'band1', label: 'band 1 rows 1-2' },
        { id: 'band2', label: 'band 2 rows 3-4' },
        { id: 'band3', label: 'band 3 row 5' },
      ],
      [
        { id: 'a', label: 'doc A' },
        { id: 'b', label: 'doc B' },
        { id: 'c', label: 'doc C' },
      ],
      [
        ['12|07', '12|07', '44|18'],
        ['31|02', '28|02', '28|60'],
        ['19', '51', '19'],
      ],
    ),
    highlight: { found: ['band1:a', 'band1:b'], compare: ['band3:a', 'band3:c'] },
    explanation: 'Locality-sensitive hashing adds a second stage. Split signatures into bands and hash each band. If two documents match in any band, they become a candidate pair. The band shape tunes the threshold: more rows per band means stricter matches; more bands means more chances to collide.',
  };

  yield {
    state: labelMatrix(
      'Candidate generation before exact verification',
      [
        { id: 'ab', label: 'A vs B' },
        { id: 'ac', label: 'A vs C' },
        { id: 'bc', label: 'B vs C' },
      ],
      [
        { id: 'candidate', label: 'candidate?' },
        { id: 'reason', label: 'why' },
        { id: 'verify', label: 'verify exact?' },
      ],
      [
        ['yes', 'same band 1', 'yes'],
        ['yes', 'same band 3', 'yes'],
        ['no', 'no band collision', 'skip'],
      ],
    ),
    highlight: { active: ['ab:candidate', 'ac:candidate'], removed: ['bc:candidate'] },
    explanation: 'Banding is a filter, not a proof. It produces candidate pairs that are worth exact comparison. In production deduplication, this means the expensive exact Jaccard or edit-distance check runs on a tiny fraction of all possible pairs.',
    invariant: 'LSH trades false candidates for avoiding an all-pairs scan.',
  };

  yield {
    state: labelMatrix(
      'Where MinHash fits on this site',
      [
        { id: 'dedupe', label: 'near-duplicate text' },
        { id: 'recs', label: 'similar users/items' },
        { id: 'rag', label: 'RAG cleanup' },
        { id: 'vectors', label: 'dense vectors' },
      ],
      [
        { id: 'tool', label: 'tool' },
        { id: 'neighbor', label: 'neighbor lesson' },
      ],
      [
        ['MinHash + LSH', 'Hash Table'],
        ['Jaccard over sets', 'Embeddings & Similarity'],
        ['dedupe chunks', 'RAG Pipeline'],
        ['HNSW instead', 'HNSW (Vector Search at Scale)'],
      ],
    ),
    highlight: { found: ['dedupe:tool', 'rag:tool'], compare: ['vectors:tool'] },
    explanation: 'Use MinHash when the objects are naturally sets and Jaccard similarity is meaningful. Use HNSW when the objects are dense vectors and cosine or inner-product similarity is meaningful. Both are approximate candidate-generation systems, but they fit different geometry.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'signature estimate') yield* signatureEstimate();
  else if (view === 'bands and candidates') yield* bandsAndCandidates();
  else throw new InputError('Pick a MinHash view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'MinHash is a sketch for estimating Jaccard similarity between sets. It is useful when objects can be represented as shingles, tokens, neighbors, purchased items, or other set elements. Instead of comparing full sets, each object stores a small signature. The fraction of matching signature rows estimates the Jaccard similarity.',
        'Locality-sensitive hashing, or LSH, turns those signatures into a candidate-generation system. Split the signature into bands, hash each band, and compare only pairs that collide in at least one band. That avoids the impossible all-pairs comparison over huge corpora.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each random permutation or hash function, MinHash records the minimum hash value present in the set. The key theorem is that two sets share the same minimum under a random permutation with probability equal to their Jaccard similarity. Repeating this over many hash functions gives an estimator.',
        'LSH banding changes retrieval behavior. If a signature has b bands of r rows each, two signatures with similarity s collide with probability about 1 - (1 - s^r)^b. That creates an S-curve: pairs below the threshold are usually ignored, while pairs above the threshold usually become candidates.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computing a signature costs O(k times set size) for k hash rows, though production systems use faster approximations and one-permutation variants. Candidate lookup is hash-table work over bands. Memory is O(k) per object plus the LSH buckets. The expensive exact comparison is reserved for candidate pairs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MinHash is used for web-scale near-duplicate detection, plagiarism and boilerplate detection, document clustering, entity resolution, recommender candidate generation over set features, and cleaning RAG Pipeline corpora. It is especially useful before model training, where duplicate examples can distort evaluation and memorization claims.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'MinHash estimates Jaccard similarity, not semantic meaning. Two paragraphs can mean the same thing with low token overlap, and two boilerplate-heavy pages can have high overlap without being the same useful content. LSH also returns candidates, not ground truth. A production dedupe pipeline still needs exact verification, thresholds, sampling audits, and Data Leakage & Contamination checks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Broder, "On the resemblance and containment of documents" at https://www.cs.princeton.edu/courses/archive/spr05/cos598E/bib/broder97resemblance.pdf, with the Stanford MMDS treatment at https://infolab.stanford.edu/~ullman/mmds/ch3n.pdf. Study Hash Table, HyperLogLog, Count-Min Sketch, Embeddings & Similarity, HNSW (Vector Search at Scale), RAG Pipeline, and RAG Dedup, MinHash, and Chunk Canonicalization next.',
      ],
    },
  ],
};
