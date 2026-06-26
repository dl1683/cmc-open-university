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
  const docCount = 3;
  const shingleCount = 5;
  const hashRows = 5;
  const matchingRows = 3;
  const estimatedSim = matchingRows / hashRows;

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
    explanation: `MinHash starts by turning each item into a set: document shingles, user purchases, graph neighbors, image patches, or token n-grams. Exact Jaccard similarity across ${docCount} documents and ${shingleCount} shingles needs intersection over union. That is expensive when there are millions of sets, so we replace the set with a compact signature.`,
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
    explanation: `For each random hash ordering, keep the minimum hash value seen in the set. Two sets have the same minimum with probability equal to their Jaccard similarity. In this toy signature of ${hashRows} rows, A and B match on ${matchingRows} of ${hashRows} rows, so the MinHash estimate is ${estimatedSim.toFixed(2)}.`,
    invariant: `Pr[MinHash(A) = MinHash(B)] = Jaccard(A, B) -- estimated here as ${matchingRows}/${hashRows} = ${estimatedSim.toFixed(2)}.`,
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
    explanation: `A short signature is noisy, but it is cheap and mergeable into a large search pipeline. More hash rows reduce variance -- with ${hashRows} rows the estimate for A-B is ${estimatedSim.toFixed(2)} versus the exact 0.50. The pattern is the same family as HyperLogLog and Count-Min Sketch: keep a compact probabilistic summary when exact set comparison is too expensive.`,
  };
}

function* bandsAndCandidates() {
  const bandCount = 3;
  const pairCount = 3;
  const candidatePairs = 2;

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
    explanation: `Locality-sensitive hashing adds a second stage. Split signatures into ${bandCount} bands and hash each band. If two documents match in any band, they become a candidate pair. The band shape tunes the threshold: more rows per band means stricter matches; more bands means more chances to collide.`,
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
    explanation: `Banding is a filter, not a proof. It produces ${candidatePairs} candidate pairs out of ${pairCount} possible, worth exact comparison. In production deduplication, this means the expensive exact Jaccard or edit-distance check runs on a tiny fraction of all possible pairs.`,
    invariant: `LSH trades false candidates for avoiding an all-pairs scan -- here ${candidatePairs} of ${pairCount} pairs survive the filter.`,
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
    explanation: `Use MinHash when the objects are naturally sets and Jaccard similarity is meaningful. Use HNSW when the objects are dense vectors and cosine or inner-product similarity is meaningful. Both are approximate candidate-generation systems -- MinHash with ${bandCount}-band LSH, HNSW with navigable small-world graphs -- but they fit different geometry.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'A document is shown as a set of shingles, where a shingle is a small token group such as a word n-gram or character n-gram. Jaccard similarity is intersection size divided by union size, so it measures how much two sets overlap. In the signature view, each hash row is one randomized ordering experiment.',
        'The safe inference rule is probabilistic: two sets match on one MinHash row with probability equal to their Jaccard similarity. In the banding view, a band collision means two signatures share a chunk and should become candidates. Candidate means worth checking exactly, not proven duplicate.',
        {type: 'image', src: './assets/gifs/minhash-lsh.gif', alt: 'Animated walkthrough of the minhash lsh visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        {type: 'callout', text: 'MinHash turns set overlap into collision probability, then LSH spends exact comparison only on likely pairs.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Near-duplicate search becomes impossible if every object must be compared with every other object. A million documents contain about 500 billion pairs. Even if each exact comparison is cheap, the all-pairs plan spends most of its work on pairs that obviously do not match.',
        'MinHash exists when objects are naturally sets and set overlap is the signal. Web pages, code files, query logs, permission lists, graph neighborhoods, and retrieval chunks can all be represented this way. Locality-sensitive hashing, or LSH, adds an index so likely similar signatures are found without scanning every pair.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct approach computes exact Jaccard similarity for every pair. For sets A and B, Jaccard(A, B) = |A intersect B| / |A union B|. If A has 100 shingles, B has 120, and 80 are shared, the similarity is 80 / 140 = 0.571.',
        'Exact comparison is trustworthy for one pair, but pair count grows quadratically. With n objects, there are n(n - 1)/2 comparisons. Doubling the corpus roughly quadruples the number of pairs before any content is inspected.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Venn_A_intersect_B.svg', alt: 'Venn diagram showing the intersection of sets A and B', caption: 'Jaccard similarity is intersection over union; the overlap area is the signal MinHash preserves probabilistically. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Venn_A_intersect_B.svg.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Sampling arbitrary tokens does not preserve the right probability. Common boilerplate can dominate samples, while rare but meaningful overlaps may be missed. A useful sketch needs row matches whose probability is exactly tied to Jaccard similarity.',
        'Indexing is the second wall. Even if every document has a compact signature, scanning all signatures is still O(n) per query and O(n^2) for a full dedupe job. The system needs a way to make near pairs collide in buckets more often than far pairs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Under a random permutation of the universe, the minimum-ranked element of A union B belongs to A intersect B with probability equal to Jaccard(A, B). Therefore two sets have the same minimum under that permutation with probability equal to their Jaccard similarity. MinHash approximates this using many independent hash functions instead of explicit permutations.',
        'LSH banding turns the signature into an index. Split k rows into b bands of r rows, hash each band, and make two objects candidates if any band matches exactly. The collision probability becomes about 1 - (1 - s^r)^b for similarity s, creating a tunable threshold curve.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Bloom_filter.svg', alt: 'Bloom filter diagram showing hash functions mapping keys into shared bit positions', caption: 'The shared design move is hash-derived compact evidence; MinHash stores minimum hash rows instead of membership bits. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Bloom_filter.svg.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First choose the set representation. A text pipeline might lowercase, remove boilerplate, and create 5-word shingles. Each object becomes a set of shingle ids, not a sequence.',
        'For each hash row, compute the hash value of every shingle in the set and keep the minimum. Repeating this for k rows gives a k-number signature. The fraction of rows where two signatures match estimates their Jaccard similarity.',
        'For LSH, divide the signature into bands. Each band is hashed into a bucket table keyed by the band values. Objects sharing a bucket become candidate pairs, and the pipeline then runs exact Jaccard, containment, or a domain-specific check only on those candidates.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The MinHash estimator works because the first element under a random ordering is equally likely to be any element of A union B. It creates a row match exactly when that first element lies in both sets. The chance of that event is |A intersect B| / |A union B|.',
        'Repeating rows reduces noise. If true similarity is 0.8 and the signature has 100 rows, the expected number of matching rows is 80. The observed count will vary, but the estimate concentrates as k grows.',
        'Banding works by requiring several row matches inside one band while giving many bands a chance to hit. Low-similarity pairs rarely match all r rows in a band. High-similarity pairs are likely to match at least one band and survive to exact verification.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building a k-row signature costs O(k times set size) in the simple implementation. Storage is O(k) per object plus bucket entries for the LSH tables. Exact comparison cost moves from all pairs to candidate pairs.',
        'The behavior knob is the band shape. More rows per band makes each collision stricter, reducing false candidates but increasing missed near-duplicates. More bands gives more chances to collide, increasing recall and bucket load.',
        'When the corpus doubles, signature storage doubles and bucket entries double, but all-pairs exact comparison would roughly quadruple. That is the practical win. The price is probability: some false candidates are verified, and some true near-duplicates may miss every band.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloom_filter_fp_probability.svg/500px-Bloom_filter_fp_probability.svg.png', alt: 'Chart showing false positive probability changing with Bloom filter parameters', caption: 'Approximate data structures turn memory into probability curves; MinHash LSH does the same with band collision probability. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Bloom_filter_fp_probability.svg.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MinHash LSH fits web crawl deduplication, plagiarism detection, code clone detection, entity-resolution blocking, recommendation over set features, and retrieval-corpus cleanup. The access pattern is first generate likely pairs cheaply, then spend exact comparison on a much smaller candidate set.',
        'It is also useful before model training and evaluation. Duplicate or near-duplicate examples can cause leakage between train and test splits, inflate benchmark scores, and bias retrieval systems toward repeated boilerplate. MinHash gives a practical audit pass over large corpora.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MinHash measures set overlap, not meaning. Two paraphrases can share few shingles and receive low similarity, while two pages with the same template can collide because boilerplate dominates. If semantic similarity is the target, embeddings or task-specific models may be the right candidate generator.',
        'It also fails when the set construction is wrong. Character shingles, word shingles, token shingles, and graph-neighbor sets answer different questions. Too-small shingles create accidental overlap, while too-large shingles miss edited copies.',
        'Large common buckets can destroy the speedup. Boilerplate, tiny sets, and repeated templates can make many unrelated objects share a band. Production systems cap heavy buckets, strip common shingles, sample candidates, or add secondary checks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let A = {a, b, c, d, e} and B = {a, b, c, f, g}. The intersection has 3 elements and the union has 7, so exact Jaccard similarity is 3/7 = 0.429. A 100-row MinHash signature should match on about 43 rows on average.',
        'Now use 20 bands of 5 rows each. If true similarity is 0.429, the chance a specific band matches is 0.429^5, about 0.0145. The chance at least one of 20 bands matches is 1 - (1 - 0.0145)^20, about 0.253, so this pair often does not become a candidate.',
        'For a near duplicate with similarity 0.85, one band matches with probability 0.85^5, about 0.444. Across 20 bands, candidate probability is 1 - (1 - 0.444)^20, about 0.99999. The banding curve spends verification on the likely copy while skipping many weaker overlaps.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Broder on resemblance and containment and the Stanford Mining of Massive Datasets chapter on MinHash and LSH. Those sources give the probability proof and the banding S-curve in the form used by large-scale dedupe systems.',
        'Study Hash Table for bucket mechanics, Bloom Filter for another probability-for-memory tradeoff, HyperLogLog for sketching cardinality, and HNSW for approximate search in vector space. Then study RAG deduplication and dataset leakage audits to see why near-duplicate detection matters beyond storage savings.',
      ],
    },
  ],
};
