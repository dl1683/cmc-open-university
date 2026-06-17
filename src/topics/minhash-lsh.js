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
      heading: 'Why this exists',
      paragraphs: [
        'Near-duplicate detection becomes impossible if every document, profile, or item must be compared with every other one. MinHash exists to compress set similarity into signatures. LSH exists to turn those signatures into candidates so the exact comparison is paid only for likely matches.',
        'This matters whenever the object is naturally a set: web-page shingles, tokens in a document, users who bought an item, neighbors of a graph node, permissions attached to a role, or chunks in a retrieval corpus. The question is not "are these vectors close?" It is "how much set overlap do these objects share?"',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct approach builds shingles or token sets for every object and computes Jaccard similarity for all pairs. That is fine for dozens of documents and hopeless for millions. Embeddings can capture semantics, but they answer a different question than exact token-set resemblance.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Random sampling of tokens is unstable because common boilerplate and set size skew can dominate. A useful sketch needs an estimator whose collision probability is the similarity measure itself. Candidate generation then needs a threshold-like retrieval curve without scanning every signature.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Under a random permutation, the probability that two sets have the same minimum element equals their Jaccard similarity. Repeating that experiment with many hashes creates a signature. LSH banding hashes chunks of the signature so highly similar objects collide as candidates with high probability.',
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        "In the signature view, read each row as one random ordering experiment. If two sets share the minimum under that ordering, that row votes for similarity. A short signature is noisy, but the fraction of matching rows is an unbiased estimate of Jaccard similarity under the MinHash model.",
        "In the banding view, read a band collision as an invitation to verify, not as proof. LSH is a candidate generator. It deliberately accepts some false candidates so it can avoid comparing every pair.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each hash row, store the minimum hash value found in the object set. The fraction of matching rows estimates Jaccard similarity. For LSH, split the signature into b bands of r rows and hash each band. A pair that shares any band bucket becomes a candidate for exact verification.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The minimum-permutation theorem ties one row collision directly to Jaccard similarity. Repetition reduces variance. Banding changes retrieval probability: for similarity s, collision probability is about 1 - (1 - s^r)^b, creating an S-curve that keeps many low-similarity pairs out of the candidate set.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Computing a k-row signature costs O(k times set size), though production systems use faster approximations and one-permutation variants. Memory is O(k) per object plus LSH buckets. Candidate lookup is hash-table work, and expensive exact comparison is reserved for candidate pairs.',
        'The banding parameters are the main knob. More rows per band makes collisions stricter. More bands gives pairs more chances to collide. The resulting S-curve is useful because it turns similarity into a tunable retrieval threshold rather than a hard exact scan.',
      ],
    },
    {
      heading: 'Parameter choices',
      paragraphs: [
        'The signature length controls estimator variance. More rows give a steadier Jaccard estimate but cost more CPU and memory per object. Short signatures are useful for coarse filtering; longer signatures are needed when the decision boundary is close or the cost of a missed duplicate is high.',
        'The banding layout controls candidate behavior. If a signature has b bands of r rows, a pair with similarity s collides with probability about 1 - (1 - s^r)^b. Increasing r makes each band stricter. Increasing b gives more chances to match. This is the knob that turns a sketch into a retrieval system.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Choose the set representation before choosing MinHash. Character shingles, word shingles, token ids, graph neighbors, and permission sets all define different similarity questions. Normalize text, remove or downweight boilerplate, and decide whether order should matter before building signatures.',
        'Keep candidate generation separate from truth. Store enough metadata to run exact Jaccard, containment, or domain-specific verification on LSH candidates. Log candidate counts per bucket, false-positive samples, and missed-duplicate audits so the banding parameters can be tuned from evidence.',
        'Use stable hash seeds and version the signature scheme. Changing shingling, tokenization, hash functions, signature length, or band layout changes the meaning of every stored signature and bucket.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'MinHash fits web-scale near-duplicate detection, plagiarism and boilerplate detection, document clustering, entity resolution, recommender candidate generation over set features, and RAG corpus cleanup. It is especially useful before training or evaluation, where duplicates can distort leakage and memorization claims.',
        'It is also useful as a cheap first gate before more expensive models. A dedupe pipeline can use MinHash LSH to find likely copies, exact set comparison to confirm overlap, and embeddings only for cases where semantic similarity matters more than token resemblance.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MinHash estimates token-set overlap, not semantic equivalence. Two texts can mean the same thing with low overlap, and boilerplate can create high overlap without useful duplication. LSH returns candidates, not truth; production dedupe still needs exact checks, thresholds, sampling audits, and leakage review.',
        'It also fails when the shingling model is wrong. Character shingles catch copy-paste edits better than word sets. Word shingles capture phrase overlap better than individual terms. Too-small shingles produce many accidental overlaps; too-large shingles miss small edits. The set construction is part of the algorithm, not preprocessing trivia.',
        'A second failure is bucket explosion. Boilerplate, common templates, or tiny sets can send huge numbers of objects into the same LSH buckets. Production systems cap bucket sizes, sample heavy buckets, or strip common shingles so candidate generation remains useful.',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'Imagine two pages share 80 of 100 shingles in their union. Their exact Jaccard similarity is 0.8. With a 100-row MinHash signature, you expect about 80 matching rows, with sampling noise. You do not need to store all shingles for candidate search; the signature carries the resemblance signal.',
        'Now split that signature into 20 bands of 5 rows. A pair with high similarity has a good chance of matching all rows in at least one band, so it enters the candidate set. A low-similarity pair rarely matches a full band, so it is skipped. The exact dedupe check then runs only on candidates.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Run sampling audits. Take random candidate pairs, false-positive-heavy buckets, and hand-labeled known duplicates, then measure how often the system catches the cases the product cares about. Near-duplicate detection is usually judged by downstream cleanup quality, not by sketch elegance.',
        'Treat MinHash as one stage in a pipeline. In a RAG corpus, for example, the system may canonicalize text, remove boilerplate, shingle chunks, build MinHash signatures, retrieve candidates with LSH, verify overlap exactly, then decide whether to delete, cluster, or mark duplicates for review.',
        'Keep containment in mind. Jaccard can underrate a short document copied into a much longer one because the union is large. Some dedupe systems need containment checks in addition to ordinary resemblance so small copied passages are not missed.',
        'Separate batch rebuilds from incremental updates. A nightly corpus cleanup job can rebuild signatures and buckets from scratch, while a live ingestion pipeline needs stable buckets, deletion handling, and a policy for rechecking older documents when tokenization or boilerplate removal changes.',
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
