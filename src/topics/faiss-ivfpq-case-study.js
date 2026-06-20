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
        'The "index recipe" view shows the build-time layout. The active nodes are the learned boundaries: coarse centroids, residual vectors, and product-quantization codes. The found node is the stored inverted list, because every database vector ends the build in exactly one coarse list with an id and a compressed payload.',
        'The "query execution" view shows the serving-time contract. The query stays full precision, centroids choose which lists to probe, ADC scores compressed candidates, and the top-k heap keeps only the best approximate ids seen so far.',
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
        'The memory alone becomes a product constraint. A 768-dimensional float32 embedding uses 3,072 bytes before ids, metadata, allocator overhead, replicas, and exact-rerank copies. One hundred million such vectors need roughly 307 GB for raw vector payloads. One billion need roughly 3 TB. Query latency then adds a second cost: every request must stream huge arrays and maintain a top-k selection structure over the whole collection.',
        'Faiss IVF-PQ exists to move that cost into two cheaper stages. IVF reduces the number of candidate vectors by routing the query to a small number of coarse lists. PQ reduces the bytes read per candidate by storing a lossy code instead of the full vector. Optional reranking then spends exact distance computation only on a bounded candidate pool.',
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
            ['Raw vectors', 'dimensions * 4 bytes * vector count', 'RAM or GPU memory becomes the deployment limit'],
            ['Distance scans', 'one full comparison per stored vector', 'latency grows linearly with corpus size'],
            ['Top-k selection', 'one candidate score per stored vector', 'selection becomes part of the hot path'],
            ['Replicas', 'full index copied per serving shard or availability unit', 'exactness multiplies infrastructure cost'],
            ['Refreshes', 'new embeddings and deleted ids', 'large flat stores are easy to reason about but expensive to move'],
          ],
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'IVF-PQ splits nearest-neighbor search into routing, compressed scoring, and optional exact repair. Routing asks which coarse regions are worth scanning. Compressed scoring asks which encoded candidates inside those regions look close. Exact repair reranks only a small candidate pool.',
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
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The build path starts with training. K-means learns nlist coarse centroids from representative embeddings. PQ training learns M subquantizer codebooks, usually on residuals. After training, each database vector is assigned to its nearest coarse centroid, converted to a residual, encoded as PQ ids, and appended to the corresponding inverted list with its external document id.',
        'The query path starts by comparing the full query vector against the coarse centroids. The nearest nprobe centroids define which lists will be scanned. This is the main recall-latency dial: increasing nprobe scans more candidates and usually recovers more true neighbors, but it also raises work per query.',
        'Inside each probed list, asymmetric distance computation keeps the query precise and the database side compressed. For each subspace, the query residual is compared with every codebook centroid once, producing a lookup table. Each candidate code then turns into M table lookups and M additions.',
        {
          type: 'bullets',
          items: [
            'nlist controls how many coarse buckets exist after training.',
            'nprobe controls how many of those buckets a query scans.',
            'M controls how many subquantizers appear in each PQ code.',
            'nbits controls how many centroids each subquantizer can choose from.',
            'rerank depth controls how many approximate candidates receive exact distance repair.',
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'IVF-PQ works when geometric locality and compression error are both controlled. IVF assumes that the nearest neighbors of a query are likely to live in nearby coarse cells. PQ assumes that the residual can be approximated well enough by independently quantizing subspaces. Neither assumption is perfect; the index earns speed by making both errors measurable and tunable.',
        'The correctness story is therefore approximate, not absolute. The invariant during search is narrower than exact nearest-neighbor search: every returned candidate has been scored among the vectors in the probed lists, using the trained PQ distance approximation. The algorithm is faithful to that candidate set and scoring rule. It does not prove that unprobed lists contain no better vector.',
        'Reranking changes the final guarantee. If the exact vector is available for each approximate candidate, the final ordering can be exact within the candidate pool. Reranking cannot recover a true neighbor that IVF never probed or PQ scored too poorly to enter the candidate pool. It repairs ranking error after candidate generation; it does not repair candidate-generation miss by itself.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Flat search costs O(n * d) distance work per query for n vectors of dimension d. IVF-PQ replaces that with centroid search plus compressed scans: roughly O(nlist * d) for coarse assignment if searched directly, then O(scanned_codes * M) table lookups for ADC, plus top-k maintenance. In practice Faiss can accelerate the centroid stage and batch the hot paths, but the shape remains candidate reduction plus cheaper candidate scoring.',
        'The memory shift is the easiest part to feel. A full 768-dimensional float32 vector costs 3,072 bytes. A PQ64x8 code costs 64 bytes before ids and list overhead. Storing exact vectors for rerank adds memory back, but now the service can choose whether exact vectors live in RAM, GPU memory, memory-mapped storage, or a separate retrieval tier.',
        {
          type: 'table',
          headers: ['Knob', 'Raises quality by', 'Raises cost by', 'Failure if mistuned'],
          rows: [
            ['nlist', 'making coarse cells smaller', 'training complexity and centroid search', 'empty, tiny, or imbalanced lists'],
            ['nprobe', 'scanning more nearby cells', 'more candidate scans per query', 'low recall or high tail latency'],
            ['M', 'using more PQ subspaces', 'larger code and more lookups', 'distortion if too small, memory pressure if too large'],
            ['nbits', 'using larger sub-codebooks', 'larger tables and training cost', 'coarse quantization or slow table access'],
            ['rerank depth', 'repairing approximate order with exact distances', 'extra vector reads and exact math', 'missed repair if too shallow, latency blowup if too deep'],
          ],
        },
        {
          type: 'note',
          text: 'The hidden constant is memory movement. IVF-PQ often wins because scanning compact codes and lookup tables is cheaper than streaming full vectors, not because the math became magically sublinear in every possible deployment.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'IVF-PQ fits billion-scale semantic retrieval, image similarity search, recommendation candidate generation, duplicate detection, and RAG retrieval systems where a compressed first stage feeds a stronger reranker. The workload shape matters: many stored vectors, high-dimensional embeddings, approximate candidates allowed, and a clear way to measure recall loss against flat search.',
        'It is also useful when memory per vector is the binding constraint. A service may need multiple shards, replicas, tenant partitions, hot standby indexes, or GPU-resident serving. Compression can turn an impossible memory plan into a feasible serving plan, especially when exact rerank is applied to a small candidate pool.',
        'Faiss is a case study in systems-aware algorithms. The math says "coarse quantization plus product quantization." The production library also has to handle training data, list layout, SIMD and GPU kernels, batched query execution, lookup tables, fast k-selection, ids, deletes, and evaluation workflows. The data structure and the hardware path are one design surface.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'IVF-PQ is the wrong default when exact recall is mandatory. Legal deduplication, security matching, medical lookup, or financial record linkage may need exact candidate completeness, not a recall-latency trade. Flat search, exhaustive filtered search, or a conservative two-stage system may be safer.',
        'It also fails when the training distribution does not match the serving distribution. If the embedding model changes, the corpus shifts, a tenant has unusual vocabulary, or new documents come from a different language or domain, the learned centroids and codebooks may stop representing the data. Symptoms include huge lists, empty lists, rising quantization distortion, and recall drops isolated to specific slices.',
        'Filtering can break the apparent win. If a query must respect tenant, date, language, jurisdiction, permission, or product constraints, global vector clusters may return many candidates that are later discarded. The ANN benchmark can look strong while filtered product recall is weak. Production systems often need filter-aware indexes, per-tenant shards, hybrid sparse+dense retrieval, or post-filter rerank policies.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a RAG service stores 100 million passage embeddings with dimension 768. The exact baseline is 100 million distance computations per query and roughly 307 GB of raw float32 vector payloads. That baseline remains the evaluation oracle, but it is too expensive for the serving budget.',
        'The team trains an IVF4096,PQ64x8 index on a representative sample. Build time assigns each passage to one of 4,096 coarse centroids. The residual is split into 64 subspaces and encoded as 64 one-byte ids. Each inverted list stores passage ids and 64-byte PQ codes. Exact vectors are retained in a colder tier for reranking the best approximate candidates.',
        'At query time, the system embeds the question, finds the nearest coarse centroids, probes 16 lists, builds ADC lookup tables, scores the codes in those lists, and keeps the best 1,000 approximate ids. It then fetches exact vectors for those 1,000 ids, recomputes true distances, and sends the top passages to the downstream reranker or generator.',
        {
          type: 'table',
          headers: ['Step', 'State before', 'Action', 'State after'],
          rows: [
            ['Train IVF', 'sample embeddings', 'learn 4,096 centroids', 'coarse routing map'],
            ['Encode vector', 'float passage vector x', 'store PQ(x - c_i)', 'id plus 64-byte residual code in list i'],
            ['Probe query', 'full query q', 'find 16 nearest centroids', 'bounded set of lists to scan'],
            ['Score codes', 'candidate PQ ids', 'sum ADC table entries', 'approximate top-1,000 ids'],
            ['Rerank', 'exact vectors for candidates', 'compute true distances', 'final top passages'],
          ],
        },
        'The deployment is accepted only if the product metric survives the approximation. The team should measure recall@k against flat search, gold-passage recovery for RAG queries, answer-quality impact, p95 and p99 latency, list balance, memory per vector, rebuild time, and slice-level failures after embedding-model updates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources to read next are the Faiss documentation, the Faiss index wiki, "The Faiss library" paper by Johnson, Douze, and Jegou, "Product Quantization for Nearest Neighbor Search," and "Billion-scale similarity search with GPUs." Read them for the implementation details: residual coding, ADC, inverted-list layout, GPU k-selection, batching, and benchmark methodology.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: k-means, because IVF is a learned coarse partition.',
            'Prerequisite: vector quantization, because PQ is a lossy codebook scheme.',
            'Contrast: HNSW, because graph navigation trades memory for high recall and low latency.',
            'Contrast: ScaNN and DiskANN, because they choose different points in the ANN design space.',
            'Production extension: RAG evaluation, because approximate retrieval quality must be measured at the answer level, not only at ANN recall.',
          ],
        },
        'The engineering question is not "is IVF-PQ good?" The useful question is whether this trained index, on this embedding distribution, with this filter policy and rerank budget, meets recall, latency, memory, rebuild, and cost targets.',
      ],
    },
  ],
};

