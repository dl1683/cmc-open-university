// Faiss IVF-PQ: a production vector-search composition of inverted lists,
// residual product-quantization codes, batched execution, and optional rerank.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'faiss-ivfpq-case-study',
  title: 'Faiss IVF-PQ Case Study',
  category: 'AI & ML',
  summary: 'A production vector-index recipe: train coarse centroids, store residual PQ codes in inverted lists, probe a few lists, and optionally rerank exact vectors.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['index recipe', 'query execution'], defaultValue: 'index recipe' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* indexRecipe() {
  yield {
    state: graphState({
      nodes: [
        { id: 'vectors', label: 'vectors', x: 0.7, y: 4.0, note: 'float' },
        { id: 'coarse', label: 'coarse', x: 2.7, y: 4.0, note: 'k-means' },
        { id: 'residual', label: 'residual', x: 4.7, y: 4.0, note: 'minus center' },
        { id: 'pq', label: 'PQ code', x: 6.7, y: 4.0, note: 'bytes' },
        { id: 'lists', label: 'IVF list', x: 8.6, y: 4.0, note: 'stored' },
      ],
      edges: [
        { id: 'e-vectors-coarse', from: 'vectors', to: 'coarse' },
        { id: 'e-coarse-residual', from: 'coarse', to: 'residual' },
        { id: 'e-residual-pq', from: 'residual', to: 'pq' },
        { id: 'e-pq-lists', from: 'pq', to: 'lists' },
      ],
    }, { title: 'IVF-PQ stores compact residual codes inside coarse lists' }),
    highlight: { active: ['coarse', 'residual', 'pq'], found: ['lists'] },
    explanation: 'Faiss IVF-PQ is a composition: an inverted file partitions vectors by coarse centroids, then product quantization stores compact codes for residuals inside each list.',
    invariant: 'The index spends training time to buy lower memory and fewer scanned candidates at query time.',
  };

  yield {
    state: labelMatrix(
      'IndexFactory-style knobs',
      [
        { id: 'nlist', label: 'nlist' },
        { id: 'm', label: 'M' },
        { id: 'nbits', label: 'nbits' },
        { id: 'rerank', label: 'rerank' },
      ],
      [
        { id: 'means', label: 'meaning' },
        { id: 'pressure', label: 'pressure' },
      ],
      [
        ['coarse lists', 'partition recall'],
        ['subquantizers', 'code size'],
        ['bits/code', 'table size'],
        ['exact top-k', 'extra reads'],
      ],
    ),
    highlight: { active: ['nlist:means', 'm:means', 'nbits:means'], compare: ['rerank:pressure'] },
    explanation: 'The typical recipe is written as something like IVF4096,PQ64x8. That means many coarse lists, 64 PQ subquantizers, and 8 bits per subquantizer. The string is short; the tradeoff surface is not.',
  };

  yield {
    state: labelMatrix(
      'What each list contains',
      [
        { id: 'list7', label: 'list 7' },
        { id: 'list42', label: 'list 42' },
        { id: 'list99', label: 'list 99' },
      ],
      [
        { id: 'center', label: 'centroid' },
        { id: 'ids', label: 'ids' },
        { id: 'codes', label: 'PQ codes' },
      ],
      [
        ['c7', 'doc ids', 'residual bytes'],
        ['c42', 'doc ids', 'residual bytes'],
        ['c99', 'doc ids', 'residual bytes'],
      ],
    ),
    highlight: { found: ['list42:codes'], active: ['list42:center', 'list42:ids'] },
    explanation: 'The inverted list is not a posting list of terms; it is a vector bucket. It stores ids and compressed vector payloads for points whose nearest coarse centroid is that list.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'memory per vector', min: 0, max: 3200 }, y: { label: 'recall pressure', min: 0, max: 100 } },
      series: [
        { id: 'flat', label: 'Flat float32', points: [{ x: 3072, y: 96 }, { x: 3072, y: 96 }] },
        { id: 'ivfpq', label: 'IVF-PQ code', points: [{ x: 64, y: 60 }, { x: 96, y: 72 }, { x: 128, y: 81 }] },
        { id: 'rerank', label: 'IVF-PQ + rerank', points: [{ x: 160, y: 76 }, { x: 224, y: 88 }, { x: 320, y: 93 }] },
      ],
    }),
    highlight: { active: ['ivfpq'], found: ['rerank'], compare: ['flat'] },
    explanation: 'The chart is illustrative: full vectors maximize exactness but are expensive. IVF-PQ buys a compressed candidate stage; reranking pays a controlled exact-read budget to recover quality.',
  };
}

function* queryExecution() {
  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'query', x: 0.8, y: 4.0, note: 'float' },
        { id: 'centroids', label: 'centroids', x: 2.6, y: 4.0, note: 'search' },
        { id: 'probe', label: 'probe', x: 4.4, y: 4.0, note: 'nprobe' },
        { id: 'adc', label: 'ADC', x: 6.2, y: 4.0, note: 'tables' },
        { id: 'topk', label: 'top-k', x: 8.1, y: 4.0, note: 'heap' },
      ],
      edges: [
        { id: 'e-query-centroids', from: 'query', to: 'centroids' },
        { id: 'e-centroids-probe', from: 'centroids', to: 'probe' },
        { id: 'e-probe-adc', from: 'probe', to: 'adc' },
        { id: 'e-adc-topk', from: 'adc', to: 'topk' },
      ],
    }, { title: 'Search probes lists, scores PQ codes, then keeps top-k' }),
    highlight: { active: ['centroids', 'probe', 'adc'], found: ['topk'] },
    explanation: 'At query time, the exact query first finds nearby coarse centroids. Faiss scans only those lists, computes asymmetric distances against PQ codes, and maintains the nearest candidate ids.',
    invariant: 'nprobe is the recall-latency dial: more lists, more candidates, higher recall.',
  };

  yield {
    state: labelMatrix(
      'Asymmetric distance computation',
      [
        { id: 'sub0', label: 'subspace 0' },
        { id: 'sub1', label: 'subspace 1' },
        { id: 'sub2', label: 'subspace 2' },
        { id: 'sub3', label: 'subspace 3' },
      ],
      [
        { id: 'precompute', label: 'query table' },
        { id: 'candidate', label: 'candidate code' },
        { id: 'score', label: 'score lookup' },
      ],
      [
        ['D0[*]', '17', 'D0[17]'],
        ['D1[*]', '4', 'D1[4]'],
        ['D2[*]', '88', 'D2[88]'],
        ['D3[*]', '31', 'D3[31]'],
      ],
    ),
    highlight: { active: ['sub0:score', 'sub1:score', 'sub2:score', 'sub3:score'] },
    explanation: 'The query stays full precision. For each subspace, precompute distance from the query residual to every centroid code. Candidate scoring becomes a sequence of small table lookups and additions.',
  };

  yield {
    state: labelMatrix(
      'CPU and GPU shape',
      [
        { id: 'batch', label: 'batch queries' },
        { id: 'tables', label: 'lookup tables' },
        { id: 'select', label: 'k-selection' },
        { id: 'transfer', label: 'host/device' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['parallelism', 'tail latency'],
        ['shared/register', 'fit limits'],
        ['fast top-k', 'hot path'],
        ['throughput', 'copy cost'],
      ],
    ),
    highlight: { found: ['batch:helps', 'tables:helps', 'select:helps'], compare: ['transfer:risk'] },
    explanation: 'Faiss is not only an algorithm catalog. The GPU work mattered because vector search has harsh hardware bottlenecks: distance math, compressed-code lookup, and top-k selection all need careful kernels.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'badTrain', label: 'bad training set' },
        { id: 'lowProbe', label: 'low nprobe' },
        { id: 'badM', label: 'bad M/nbits' },
        { id: 'shift', label: 'model shift' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['empty or huge lists', 'retrain'],
        ['misses neighbors', 'probe more'],
        ['distortion', 'larger code'],
        ['recall drops', 'rebuild'],
      ],
    ),
    highlight: { active: ['badTrain:symptom', 'lowProbe:symptom', 'shift:symptom'], found: ['badTrain:fix', 'lowProbe:fix'] },
    explanation: 'IVF-PQ is learned infrastructure. Its quality depends on training data, embedding distribution, list balance, code size, reranking budget, and whether the embedding model has changed since the index was built.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'index recipe') yield* indexRecipe();
  else if (view === 'query execution') yield* queryExecution();
  else throw new InputError('Pick a Faiss IVF-PQ view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "index recipe" view shows the build-time layout. Active nodes mark the learned boundaries: coarse centroids, residual vectors, and product-quantization codes. The found node is the stored inverted list, because every database vector ends the build in exactly one coarse list with an id and a compressed payload.',
        'The "query execution" view shows the serving-time contract. The query stays full precision, centroids choose which lists to probe, ADC scores compressed candidates, and the top-k heap keeps only the best approximate ids seen so far.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg',
          alt: 'Voronoi diagram partitioning a 2D plane into nearest-point cells',
          caption: 'IVF partitions the vector space into Voronoi cells, each owned by a coarse centroid. At query time, only the nearest cells are searched. The animation mirrors this: the "coarse" node decides which list a vector belongs to. Source: Wikimedia Commons (CC BY-SA 4.0).',
        },
        {
          type: 'note',
          text: 'The safe inference rule is local: if a list is not probed, its vectors are treated as outside the candidate set for this query. That is a speed decision, not a proof that those vectors cannot be true nearest neighbors.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Faiss case-study lesson',
          text: 'IVF-PQ is what you build when exact vector search is still the teacher, but no longer the serving plan.',
        },
        'A vector search service usually starts with the clean baseline: store each embedding as a float array, compare the query to every stored vector, and return the nearest k. That flat index is exact, debuggable, and essential for evaluation. It is also brutally expensive when the collection grows.',
        'The memory alone becomes a product constraint. A 768-dimensional float32 embedding uses 3,072 bytes before ids, metadata, allocator overhead, replicas, and exact-rerank copies. One hundred million such vectors need roughly 307 GB for raw vector payloads. One billion need roughly 3 TB. Query latency adds a second cost: every request must stream huge arrays and maintain a top-k selection structure over the whole collection.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/55/Euclidean_distance_2d.svg',
          alt: 'Euclidean distance between two points on a coordinate plane',
          caption: 'At the heart of vector search is a distance computation -- typically L2 (Euclidean) or inner product. Flat search computes this distance against every stored vector, which is exact but O(n). Source: Wikimedia Commons (CC BY 4.0).',
        },
        'Faiss IVF-PQ exists to move that cost into two cheaper stages. IVF reduces the number of candidate vectors by routing the query to a small number of coarse lists. PQ reduces the bytes read per candidate by storing a lossy code instead of the full vector. Optional reranking then spends exact distance computation only on a bounded candidate pool.',
        {
          type: 'callout',
          text: 'IVF-PQ trades exactness for speed at two levels: coarse routing skips most vectors entirely, and product quantization compresses the survivors from thousands of bytes to tens of bytes.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is flat search. It stores full vectors, computes an exact distance for every item, and keeps the nearest k. For small indexes, offline analysis, correctness tests, and recall measurement, flat search is the right tool. It gives the reference answer that every approximate index must be judged against.',
        'Teams often stretch flat search longer than expected because it has few moving parts. There is no training set to choose, no quantizer to tune, no cluster imbalance to debug, and no approximate miss to explain to a product team. If the corpus fits in memory and the query rate is modest, exact search can be simpler and safer than a compressed index.',
        {
          type: 'code',
          language: 'javascript',
          body: `// Flat-search baseline: exact, simple, and expensive at scale.
function flatTopK(query, vectors, k) {
  const heap = new MaxHeap(k);
  for (const row of vectors) {
    const d = squaredL2(query, row.embedding);
    heap.pushBounded({ id: row.id, distance: d });
  }
  return heap.itemsSortedByDistance();
}`,
          text: `// Flat-search baseline: exact, simple, and expensive at scale.
function flatTopK(query, vectors, k) {
  const heap = new MaxHeap(k);
  for (const row of vectors) {
    const d = squaredL2(query, row.embedding);
    heap.pushBounded({ id: row.id, distance: d });
  }
  return heap.itemsSortedByDistance();
}`,
        },
        'This baseline is sacred. Every approximate index must be evaluated against flat search to know what recall is being sacrificed. A production team that cannot measure recall against the oracle is flying blind.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not that distance math is mysterious. The wall is bytes and candidates. Exact search must read every vector, touch every dimension, and compare every score against the current top-k boundary. When n doubles, flat search reads twice as many vectors and does twice as many distance computations.',
        'Hardware does not remove the wall; it changes its shape. A GPU can compute many distances in parallel, but the service still has to move vectors through memory, batch requests, select top-k candidates, and keep enough replicas online for availability. If the index is too large, the deployment pays through memory pressure, cross-device transfer, lower cache locality, or fewer replicas.',
        {
          type: 'table',
          headers: ['Baseline pressure', 'What grows', 'Why it hurts'],
          rows: [
            ['Raw vectors', 'dimensions x 4 bytes x vector count', 'RAM or GPU memory becomes the deployment limit'],
            ['Distance scans', 'one full comparison per stored vector', 'latency grows linearly with corpus size'],
            ['Top-k selection', 'one candidate score per stored vector', 'selection becomes part of the hot path'],
            ['Replicas', 'full index copied per serving shard', 'exactness multiplies infrastructure cost'],
            ['Refreshes', 'new embeddings and deleted ids', 'large flat stores are easy to reason about but expensive to move'],
          ],
        },
        {
          type: 'callout',
          text: 'The wall is linear in two dimensions simultaneously: memory grows with vector count, and latency grows with vector count. IVF-PQ attacks both.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'IVF-PQ splits nearest-neighbor search into routing, compressed scoring, and optional exact repair. Routing asks which coarse regions are worth scanning. Compressed scoring asks which encoded candidates inside those regions look close. Exact repair reranks only a small candidate pool.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/K_Means_Example_Step_4.svg',
          alt: 'K-means clustering converged result showing data points assigned to cluster centroids',
          caption: 'IVF training runs k-means on representative embeddings to learn coarse centroids. Each centroid defines one inverted list. At query time, only the lists nearest the query are scanned. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
        {
          type: 'diagram',
          alt: 'IVF-PQ build and query pipeline',
          label: 'IVF-PQ as a two-stage candidate generator',
          body: `Build time:
  float vector x
       |
       v
  nearest coarse centroid c_i        list i owns this vector id
       |
       v
  residual r = x - c_i
       |
       v
  PQ code [q0, q1, ..., q(M-1)]      compact payload stored in list i

Query time:
  query q -> nearest centroids -> nprobe lists -> ADC scores -> top-k ids
                                                     |
                                                     v
                                           optional exact rerank`,
          text: `Build time:
  float vector x
       |
       v
  nearest coarse centroid c_i        list i owns this vector id
       |
       v
  residual r = x - c_i
       |
       v
  PQ code [q0, q1, ..., q(M-1)]      compact payload stored in list i

Query time:
  query q -> nearest centroids -> nprobe lists -> ADC scores -> top-k ids
                                                     |
                                                     v
                                           optional exact rerank`,
        },
        'The key layout is residual product quantization inside inverted lists. A vector x is assigned to a coarse centroid c. Instead of storing x as full precision in the list, the index stores an encoding of x - c. Residuals are usually easier to compress than full vectors because the coarse centroid has already explained the broad location.',
        'Product quantization then splits the residual into M subspaces. Each subspace has a learned codebook. The stored code is one codebook id per subspace, often one byte per id when nbits is 8. A 64-subquantizer code is 64 bytes, compared with 3,072 bytes for a 768-dimensional float32 vector.',
        {
          type: 'callout',
          text: 'The residual trick is critical: subtracting the coarse centroid removes the "where in the space" component, leaving only the "how far from the centroid" component. This smaller residual compresses far better under product quantization.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The build path starts with training. K-means learns nlist coarse centroids from representative embeddings. PQ training learns M subquantizer codebooks, usually on residuals. After training, each database vector is assigned to its nearest coarse centroid, converted to a residual, encoded as PQ ids, and appended to the corresponding inverted list with its external document id.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/K_Means_Example_Step_1.svg',
          alt: 'K-means step 1: initial random centroid placement among data points',
          caption: 'K-means begins with random centroids and iteratively refines assignments. Faiss trains centroids on a representative sample of embeddings. Poor training data leads to imbalanced or empty lists. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
        'The query path starts by comparing the full query vector against the coarse centroids. The nearest nprobe centroids define which lists will be scanned. This is the main recall-latency dial: increasing nprobe scans more candidates and usually recovers more true neighbors, but it also raises work per query.',
        'Inside each probed list, asymmetric distance computation (ADC) keeps the query precise and the database side compressed. For each subspace, the query residual is compared with every codebook centroid once, producing a lookup table. Each candidate code then turns into M table lookups and M additions.',
        {
          type: 'code',
          language: 'javascript',
          body: `// Asymmetric distance computation (ADC) pseudocode.
// The query stays full precision; only the database is compressed.
function adcScore(querySubvectors, pqCode, codebooks) {
  let distance = 0;
  for (let m = 0; m < pqCode.length; m++) {
    // Precomputed table: distance from query subvector to each centroid
    const table = codebooks[m].map(c => squaredL2(querySubvectors[m], c));
    // One table lookup per subspace
    distance += table[pqCode[m]];
  }
  return distance;
}`,
          text: `// Asymmetric distance computation (ADC) pseudocode.
// The query stays full precision; only the database is compressed.
function adcScore(querySubvectors, pqCode, codebooks) {
  let distance = 0;
  for (let m = 0; m < pqCode.length; m++) {
    // Precomputed table: distance from query subvector to each centroid
    const table = codebooks[m].map(c => squaredL2(querySubvectors[m], c));
    // One table lookup per subspace
    distance += table[pqCode[m]];
  }
  return distance;
}`,
        },
        {
          type: 'bullets',
          items: [
            'nlist controls how many coarse buckets exist after training.',
            'nprobe controls how many of those buckets a query scans.',
            'M controls how many subquantizers appear in each PQ code.',
            'nbits controls how many centroids each subquantizer can choose from (2^nbits options).',
            'rerank depth controls how many approximate candidates receive exact distance repair.',
          ],
        },
        {
          type: 'note',
          text: 'ADC is asymmetric because the query is never quantized. The query stays at full float precision while the database vectors are compressed into PQ codes. This avoids adding quantization error to the query side.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'IVF-PQ works when geometric locality and compression error are both controlled. IVF assumes that the nearest neighbors of a query are likely to live in nearby coarse cells. PQ assumes that the residual can be approximated well enough by independently quantizing subspaces. Neither assumption is perfect; the index earns speed by making both errors measurable and tunable.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Coloured_Voronoi_2D.svg',
          alt: 'Colored Voronoi tessellation showing space partitioned into distinct cells',
          caption: 'Each colored region is a Voronoi cell: all points closer to that cell\'s centroid than any other. IVF exploits this partition -- a query\'s true nearest neighbors usually fall in the same cell or adjacent cells. Probing multiple cells (nprobe > 1) recovers neighbors near cell boundaries. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
        'The correctness story is approximate, not absolute. The invariant during search is narrower than exact nearest-neighbor search: every returned candidate has been scored among the vectors in the probed lists, using the trained PQ distance approximation. The algorithm is faithful to that candidate set and scoring rule. It does not prove that unprobed lists contain no better vector.',
        'Reranking changes the final guarantee. If the exact vector is available for each approximate candidate, the final ordering can be exact within the candidate pool. Reranking cannot recover a true neighbor that IVF never probed or PQ scored too poorly to enter the candidate pool. It repairs ranking error after candidate generation; it does not repair candidate-generation miss by itself.',
        {
          type: 'diagram',
          alt: 'Two sources of error in IVF-PQ',
          label: 'Error budget: IVF miss vs. PQ distortion',
          body: `Source 1: IVF routing error
  True neighbor in cell C5, query probes cells C3, C4
  -> neighbor never considered
  -> fix: increase nprobe

Source 2: PQ distortion
  True neighbor scored, but PQ distance != true distance
  -> neighbor ranked below worse candidates
  -> fix: increase M, increase nbits, or add reranking

Source 3: interaction
  Both errors compound: missed cell + distorted ranking
  -> fix: tune both knobs, measure recall@k against flat`,
          text: `Source 1: IVF routing error
  True neighbor in cell C5, query probes cells C3, C4
  -> neighbor never considered
  -> fix: increase nprobe

Source 2: PQ distortion
  True neighbor scored, but PQ distance != true distance
  -> neighbor ranked below worse candidates
  -> fix: increase M, increase nbits, or add reranking

Source 3: interaction
  Both errors compound: missed cell + distorted ranking
  -> fix: tune both knobs, measure recall@k against flat`,
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Flat search costs O(n * d) distance work per query for n vectors of dimension d. IVF-PQ replaces that with centroid search plus compressed scans: roughly O(nlist * d) for coarse assignment, then O(scanned_codes * M) table lookups for ADC, plus top-k maintenance. The shape is candidate reduction plus cheaper candidate scoring.',
        {
          type: 'table',
          headers: ['Component', 'Flat search cost', 'IVF-PQ cost'],
          rows: [
            ['Memory per vector', '768 * 4 = 3,072 bytes', '64 bytes (PQ64x8) + 8 bytes (id)'],
            ['100M vectors total', '~307 GB', '~7.2 GB codes + centroid tables'],
            ['Distance ops per query', '100M full-dimension comparisons', '~390K table lookups (16 lists * ~24K vectors * M adds)'],
            ['Rerank (optional)', 'N/A (already exact)', '1,000 exact comparisons on candidate pool'],
          ],
        },
        'The memory shift is the easiest part to feel. A full 768-dimensional float32 vector costs 3,072 bytes. A PQ64x8 code costs 64 bytes before ids and list overhead. Storing exact vectors for rerank adds memory back, but the service can choose whether exact vectors live in RAM, GPU memory, memory-mapped storage, or a separate retrieval tier.',
        {
          type: 'table',
          headers: ['Knob', 'Raises quality by', 'Raises cost by', 'Failure if mistuned'],
          rows: [
            ['nlist', 'making coarse cells smaller', 'training complexity and centroid search', 'empty, tiny, or imbalanced lists'],
            ['nprobe', 'scanning more nearby cells', 'more candidate scans per query', 'low recall or high tail latency'],
            ['M', 'using more PQ subspaces', 'larger code and more lookups', 'distortion if too small, memory if too large'],
            ['nbits', 'using larger sub-codebooks', 'larger tables and training cost', 'coarse quantization or slow table access'],
            ['rerank depth', 'repairing approximate ranking', 'extra vector reads and exact math', 'missed repair if shallow, latency blowup if deep'],
          ],
        },
        {
          type: 'note',
          text: 'The hidden constant is memory movement. IVF-PQ often wins because scanning compact codes and lookup tables is cheaper than streaming full vectors, not because the math became sublinear in every possible deployment.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'IVF-PQ fits billion-scale semantic retrieval, image similarity search, recommendation candidate generation, duplicate detection, and RAG retrieval systems where a compressed first stage feeds a stronger reranker. The workload shape matters: many stored vectors, high-dimensional embeddings, approximate candidates allowed, and a clear way to measure recall loss against flat search.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/KnnClassification.svg',
          alt: 'K-nearest neighbor classification with decision boundaries around a query point',
          caption: 'kNN classification relies on finding the nearest neighbors of a query. At billion scale, exact kNN is too expensive for real-time serving. IVF-PQ provides the approximate candidate set that makes large-scale kNN practical. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
        {
          type: 'bullets',
          items: [
            'Semantic search: embed documents and queries, retrieve the nearest passage vectors for a RAG pipeline or direct answer.',
            'Image similarity: embed images with a vision model, find near-duplicates or visually similar items for e-commerce, content moderation, or reverse image search.',
            'Recommendation candidates: embed users and items, generate a candidate set from the nearest item vectors before a heavier ranking model.',
            'Duplicate detection: find near-duplicate documents, images, or records across a large corpus for deduplication or plagiarism detection.',
            'Multimodal retrieval: CLIP-style models embed text and images into a shared space; IVF-PQ serves cross-modal nearest-neighbor queries.',
          ],
        },
        'It is also useful when memory per vector is the binding constraint. A service may need multiple shards, replicas, tenant partitions, hot standby indexes, or GPU-resident serving. Compression can turn an impossible memory plan into a feasible serving plan, especially when exact rerank is applied to a small candidate pool.',
        'Faiss is a case study in systems-aware algorithms. The math says "coarse quantization plus product quantization." The production library also has to handle training data, list layout, SIMD and GPU kernels, batched query execution, lookup tables, fast k-selection, ids, deletes, and evaluation workflows. The data structure and the hardware path are one design surface.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'IVF-PQ is the wrong default when exact recall is mandatory. Legal deduplication, security matching, medical lookup, or financial record linkage may need exact candidate completeness, not a recall-latency trade. Flat search, exhaustive filtered search, or a conservative two-stage system may be safer.',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Root cause', 'Mitigation'],
          rows: [
            ['Training mismatch', 'empty or huge lists, low recall', 'centroids learned from wrong distribution', 'retrain on representative data, monitor list sizes'],
            ['Embedding model drift', 'recall drops after model update', 'codebooks no longer match vector space', 'rebuild index after any embedding model change'],
            ['Low nprobe', 'misses obvious neighbors', 'too few lists scanned', 'increase nprobe, measure recall@k'],
            ['PQ distortion', 'reranked results differ heavily from PQ ranking', 'M or nbits too small for the data', 'increase code size, evaluate distortion on held-out set'],
            ['Filter interaction', 'post-filter discards most ANN candidates', 'global clusters ignore metadata constraints', 'per-tenant shards, filter-aware indexing, hybrid retrieval'],
          ],
        },
        'It also fails when the training distribution does not match the serving distribution. If the embedding model changes, the corpus shifts, a tenant has unusual vocabulary, or new documents come from a different language or domain, the learned centroids and codebooks may stop representing the data.',
        'Filtering can break the apparent win. If a query must respect tenant, date, language, jurisdiction, permission, or product constraints, global vector clusters may return many candidates that are later discarded. The ANN benchmark can look strong while filtered product recall is weak. Production systems often need filter-aware indexes, per-tenant shards, hybrid sparse+dense retrieval, or post-filter rerank policies.',
        {
          type: 'callout',
          text: 'IVF-PQ is learned infrastructure. Its quality depends on training data, embedding distribution, list balance, code size, and whether the embedding model has changed since the index was built. Treat index builds like model deployments: version them, evaluate them, and monitor them.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a RAG service stores 100 million passage embeddings with dimension 768. The exact baseline is 100 million distance computations per query and roughly 307 GB of raw float32 vector payloads. That baseline remains the evaluation oracle, but it is too expensive for the serving budget.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Kdtree_2d.svg',
          alt: 'Kd-tree space partitioning showing recursive axis-aligned splits',
          caption: 'Space-partitioning structures like kd-trees are a foundational approach to nearest-neighbor search. IVF-PQ uses a different partitioning strategy -- Voronoi cells from k-means -- but the principle is the same: organize vectors so queries only visit a small region. Source: Wikimedia Commons (CC BY-SA 3.0).',
        },
        'The team trains an IVF4096,PQ64x8 index on a representative sample. Build time assigns each passage to one of 4,096 coarse centroids. The residual is split into 64 subspaces and encoded as 64 one-byte ids. Each inverted list stores passage ids and 64-byte PQ codes. Exact vectors are retained in a colder tier for reranking the best approximate candidates.',
        {
          type: 'code',
          language: 'python',
          body: `# Faiss index factory: the one-liner that builds the full pipeline.
import faiss
import numpy as np

d = 768                     # embedding dimension
nlist = 4096                # coarse centroids
M = 64                      # PQ subquantizers
nbits = 8                   # bits per subquantizer code

# Build the composite index
quantizer = faiss.IndexFlatL2(d)
index = faiss.IndexIVFPQ(quantizer, d, nlist, M, nbits)

# Train on a representative sample (not the full corpus)
training_vectors = np.random.rand(500_000, d).astype("float32")
index.train(training_vectors)

# Add the full corpus
index.add(corpus_vectors)

# Search: nprobe controls the recall-latency tradeoff
index.nprobe = 16
distances, ids = index.search(query_vectors, k=100)`,
          text: `# Faiss index factory: the one-liner that builds the full pipeline.
import faiss
import numpy as np

d = 768                     # embedding dimension
nlist = 4096                # coarse centroids
M = 64                      # PQ subquantizers
nbits = 8                   # bits per subquantizer code

# Build the composite index
quantizer = faiss.IndexFlatL2(d)
index = faiss.IndexIVFPQ(quantizer, d, nlist, M, nbits)

# Train on a representative sample (not the full corpus)
training_vectors = np.random.rand(500_000, d).astype("float32")
index.train(training_vectors)

# Add the full corpus
index.add(corpus_vectors)

# Search: nprobe controls the recall-latency tradeoff
index.nprobe = 16
distances, ids = index.search(query_vectors, k=100)`,
        },
        'At query time, the system embeds the question, finds the nearest coarse centroids, probes 16 lists, builds ADC lookup tables, scores the codes in those lists, and keeps the best 1,000 approximate ids. It then fetches exact vectors for those 1,000 ids, recomputes true distances, and sends the top passages to the downstream reranker or generator.',
        {
          type: 'table',
          headers: ['Step', 'State before', 'Action', 'State after'],
          rows: [
            ['Train IVF', 'sample embeddings', 'learn 4,096 centroids', 'coarse routing map'],
            ['Train PQ', 'residual vectors', 'learn 64 codebooks of 256 centroids', 'subspace quantizers'],
            ['Encode vector', 'float passage vector x', 'store PQ(x - c_i)', 'id + 64-byte residual code in list i'],
            ['Probe query', 'full query q', 'find 16 nearest centroids', 'bounded set of lists to scan'],
            ['Score codes', 'candidate PQ ids in probed lists', 'sum ADC table entries per candidate', 'approximate top-1,000 ids'],
            ['Rerank', 'exact vectors for 1,000 candidates', 'compute true L2 distances', 'final top passages for RAG'],
          ],
        },
        'The deployment is accepted only if the product metric survives the approximation. The team should measure recall@k against flat search, gold-passage recovery for RAG queries, answer-quality impact, p95 and p99 latency, list balance, memory per vector, rebuild time, and slice-level failures after embedding-model updates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Faiss documentation and wiki on GitHub, "The Faiss library" by Johnson, Douze, and Jegou (2021), "Product Quantization for Nearest Neighbor Search" by Jegou, Douze, and Schmid (IEEE TPAMI 2011), and "Billion-scale similarity search with GPUs" by Johnson, Douze, and Jegou (IEEE TBD 2021). These cover residual coding, ADC, inverted-list layout, GPU k-selection, batching, and benchmark methodology.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: k-means clustering, because IVF is a learned Voronoi partition and training quality determines index quality.',
            'Prerequisite: vector quantization, because PQ is a structured lossy codebook scheme that decomposes the vector space into subspaces.',
            'Contrast: HNSW (hierarchical navigable small world graphs), which trades higher memory per vector for high recall and low latency without a training step.',
            'Contrast: ScaNN (Google) and DiskANN (Microsoft), which choose different points in the ANN design space -- ScaNN uses anisotropic quantization, DiskANN uses graph search with SSD-resident vectors.',
            'Production extension: RAG evaluation, because approximate retrieval quality must be measured at the answer level, not only at ANN recall@k.',
            'Production extension: hybrid retrieval (BM25 + dense vectors), because sparse keyword matching and dense semantic matching catch different failure modes.',
          ],
        },
        {
          type: 'note',
          text: 'The engineering question is not "is IVF-PQ good?" The useful question is whether this trained index, on this embedding distribution, with this filter policy and rerank budget, meets recall, latency, memory, rebuild, and cost targets for the specific product.',
        },
      ],
    },
  ],
};

