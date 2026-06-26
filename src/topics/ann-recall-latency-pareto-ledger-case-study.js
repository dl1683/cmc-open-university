// ANN index tuning as an operational ledger: exact truth sets, parameter
// sweeps, Pareto frontiers, workload slices, and rollout gates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ann-recall-latency-pareto-ledger-case-study',
  title: 'ANN Recall-Latency Pareto Ledger',
  category: 'AI & ML',
  summary: 'Tune vector indexes with exact baselines, recall/latency sweeps, Pareto frontiers, workload slices, and production rollout gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pareto sweep', 'truth set', 'prod gate'], defaultValue: 'pareto sweep' },
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

function ledgerGraph(title) {
  return graphState({
    nodes: [
      { id: 'mix', label: 'query mix', x: 0.7, y: 3.2, note: 'slices' },
      { id: 'truth', label: 'exact kNN', x: 2.4, y: 1.6, note: 'oracle' },
      { id: 'sweep', label: 'knob sweep', x: 2.4, y: 4.8, note: 'configs' },
      { id: 'ledger', label: 'ledger', x: 4.5, y: 3.2, note: 'frontier' },
      { id: 'gate', label: 'ship gate', x: 6.6, y: 3.2, note: 'SLO' },
      { id: 'route', label: 'route', x: 8.4, y: 2.0, note: 'profiles' },
      { id: 'watch', label: 'watch', x: 8.4, y: 4.5, note: 'drift' },
    ],
    edges: [
      { id: 'e-mix-truth', from: 'mix', to: 'truth', weight: 'sample' },
      { id: 'e-mix-sweep', from: 'mix', to: 'sweep', weight: 'replay' },
      { id: 'e-truth-ledger', from: 'truth', to: 'ledger', weight: 'labels' },
      { id: 'e-sweep-ledger', from: 'sweep', to: 'ledger', weight: 'measures' },
      { id: 'e-ledger-gate', from: 'ledger', to: 'gate', weight: 'candidate' },
      { id: 'e-gate-route', from: 'gate', to: 'route', weight: 'version' },
      { id: 'e-route-watch', from: 'route', to: 'watch', weight: 'telemetry' },
      { id: 'e-watch-sweep', from: 'watch', to: 'sweep', weight: 'resweep' },
    ],
  }, { title });
}

function* paretoSweep() {
  yield {
    state: ledgerGraph('A vector index needs a measured tuning ledger'),
    highlight: { active: ['mix', 'truth', 'sweep'], found: ['ledger'], compare: ['gate'] },
    explanation: 'The graph starts with two inputs that make tuning honest: a representative query mix and an exact nearest-neighbor baseline. The sweep is only meaningful because every approximate setting is compared against the same truth set and written into a ledger.',
    invariant: 'A vector-index setting is not a constant; it is a measured operating point.',
  };

  yield {
    state: labelMatrix(
      'Candidate configs',
      [
        { id: 'h64', label: 'HNSW 64' },
        { id: 'h160', label: 'HNSW 160' },
        { id: 'ivf8', label: 'IVF p8' },
        { id: 'ivf32', label: 'IVF p32' },
        { id: 'disk', label: 'Disk beam' },
      ],
      [
        { id: 'knob', label: 'knob' },
        { id: 'recall', label: 'recall' },
        { id: 'p95', label: 'p95 ms' },
        { id: 'ram', label: 'RAM' },
      ],
      [
        ['ef=64', '0.91', '9', '1.0x'],
        ['ef=160', '0.97', '23', '1.0x'],
        ['nprobe=8', '0.86', '6', '0.35x'],
        ['nprobe=32', '0.95', '18', '0.35x'],
        ['beam=4', '0.93', '31', '0.18x'],
      ],
    ),
    highlight: { active: ['h160:recall', 'ivf32:recall'], compare: ['disk:p95'], found: ['h64:p95', 'ivf8:p95'] },
    explanation: 'The same corpus can support many legal configurations. HNSW moves ef_search. IVF-PQ moves nprobe and rerank depth. Disk-backed graph search moves beam width and cache size. Each row must carry measured recall, latency, memory, and build cost.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'p95 latency', min: 0, max: 44 }, y: { label: 'recall@10', min: 0.82, max: 1.0 } },
      series: [
        { id: 'hnsw', label: 'HNSW', points: [{ x: 9, y: 0.91 }, { x: 15, y: 0.95 }, { x: 23, y: 0.97 }, { x: 37, y: 0.985 }] },
        { id: 'ivfpq', label: 'IVF-PQ', points: [{ x: 6, y: 0.86 }, { x: 12, y: 0.91 }, { x: 18, y: 0.95 }, { x: 30, y: 0.972 }] },
        { id: 'disk', label: 'DiskANN', points: [{ x: 19, y: 0.88 }, { x: 31, y: 0.93 }, { x: 41, y: 0.96 }] },
      ],
      markers: [
        { id: 'knee', x: 18, y: 0.95, label: 'knee' },
        { id: 'dom', x: 30, y: 0.972, label: 'slow' },
        { id: 'fast', x: 9, y: 0.91, label: 'cheap' },
      ],
    }),
    highlight: { found: ['knee'], active: ['hnsw', 'ivfpq'], compare: ['dom', 'disk'] },
    explanation: 'Read right as slower and up as more accurate. The Pareto frontier keeps points no other measured config beats on both axes. The knee is often the default because it buys most of the recall before latency starts rising steeply.',
  };

  yield {
    state: labelMatrix(
      'Frontier rules',
      [
        { id: 'fast', label: 'fast path' },
        { id: 'default', label: 'default' },
        { id: 'strict', label: 'strict' },
        { id: 'deep', label: 'deep scan' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'choose', label: 'choose' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['p50 chat', 'HNSW 64', 'rerank'],
        ['normal RAG', 'IVF p32', 'recall'],
        ['legal cite', 'HNSW 200', 'exact gap'],
        ['offline', 'flat', 'batch'],
      ],
    ),
    highlight: { active: ['default:choose', 'strict:choose'], compare: ['fast:guard'], found: ['deep:choose'] },
    explanation: 'A serious ledger produces route profiles, not one universal knob. Low-stakes autocomplete can use a fast profile. Evidence-heavy legal or medical retrieval may need a stricter profile, larger rerank, or exact fallback.',
  };

  yield {
    state: ledgerGraph('The ledger becomes config provenance'),
    highlight: { active: ['ledger', 'gate', 'route', 'watch'], found: ['e-ledger-gate', 'e-gate-route'], compare: ['e-watch-sweep'] },
    explanation: 'The winning setting should be shipped as versioned config with the sweep id, embedding model id, corpus snapshot, slice scores, and rollback condition. Without provenance, a later index rebuild can silently change retrieval behavior.',
  };
}

function* truthSet() {
  yield {
    state: graphState({
      nodes: [
        { id: 'queries', label: 'queries', x: 0.8, y: 3.2, note: 'sample' },
        { id: 'flat', label: 'exact scan', x: 2.8, y: 1.7, note: 'truth' },
        { id: 'ann', label: 'ANN run', x: 2.8, y: 4.7, note: 'config' },
        { id: 'join', label: 'compare', x: 5.0, y: 3.2, note: 'overlap' },
        { id: 'slices', label: 'slices', x: 7.0, y: 2.0, note: 'groups' },
        { id: 'tasks', label: 'task eval', x: 7.0, y: 4.5, note: 'utility' },
      ],
      edges: [
        { id: 'e-q-flat', from: 'queries', to: 'flat', weight: 'kNN' },
        { id: 'e-q-ann', from: 'queries', to: 'ann', weight: 'top-k' },
        { id: 'e-flat-join', from: 'flat', to: 'join', weight: 'truth' },
        { id: 'e-ann-join', from: 'ann', to: 'join', weight: 'cand' },
        { id: 'e-join-slices', from: 'join', to: 'slices', weight: 'recall' },
        { id: 'e-join-tasks', from: 'join', to: 'tasks', weight: 'quality' },
      ],
    }, { title: 'Exact kNN is the calibration target' }),
    highlight: { active: ['queries', 'flat', 'ann'], found: ['join'], compare: ['tasks'] },
    explanation: 'ANN recall is measured by comparing approximate results with exact kNN on representative queries. The exact path can be slow; that is why it belongs in evaluation, shadow sampling, and offline sweeps rather than every live request.',
  };

  yield {
    state: labelMatrix(
      'Workload slices',
      [
        { id: 'head', label: 'head docs' },
        { id: 'tail', label: 'tail docs' },
        { id: 'fresh', label: 'fresh' },
        { id: 'filter', label: 'filtered' },
        { id: 'long', label: 'long q' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'metric', label: 'watch' },
      ],
      [
        ['easy high', 'p95'],
        ['rare terms', 'recall'],
        ['new index', 'stale'],
        ['small pool', 'empty'],
        ['mixed intent', 'nDCG'],
      ],
    ),
    highlight: { active: ['tail:metric', 'filter:metric', 'fresh:metric'], compare: ['head:metric'] },
    explanation: 'Averages hide failures. The ledger should slice by tenant, language, category, freshness, filter selectivity, query length, embedding model, and document type. The worst slice is often the one users notice.',
  };

  yield {
    state: labelMatrix(
      'Metric stack',
      [
        { id: 'overlap', label: 'recall@k' },
        { id: 'ratio', label: '1/ratio' },
        { id: 'rank', label: 'nDCG' },
        { id: 'answer', label: 'answer' },
        { id: 'latency', label: 'latency' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'blind', label: 'blind spot' },
      ],
      [
        ['same ids?', 'near ties'],
        ['same dist?', 'labels'],
        ['right order?', 'no answer'],
        ['task works?', 'judge cost'],
        ['fast enough?', 'quality'],
      ],
    ),
    highlight: { active: ['overlap:asks', 'latency:asks'], found: ['answer:asks'], compare: ['ratio:blind'] },
    explanation: 'Recall@k answers whether the exact neighbor ids reappeared. That is necessary for index debugging, but not always sufficient for application value. Track ranking, downstream answer quality, and latency beside overlap recall.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'recall@10', min: 0.82, max: 1.0 }, y: { label: 'task score', min: 0.72, max: 0.94 } },
      series: [
        { id: 'rag', label: 'RAG eval', points: [{ x: 0.84, y: 0.76 }, { x: 0.89, y: 0.84 }, { x: 0.93, y: 0.89 }, { x: 0.96, y: 0.90 }, { x: 0.985, y: 0.905 }] },
        { id: 'class', label: 'classify', points: [{ x: 0.84, y: 0.86 }, { x: 0.89, y: 0.88 }, { x: 0.93, y: 0.895 }, { x: 0.96, y: 0.90 }, { x: 0.985, y: 0.902 }] },
      ],
      markers: [
        { id: 'flat', x: 0.96, y: 0.90, label: 'flat gain' },
        { id: 'waste', x: 0.985, y: 0.905, label: 'costly' },
      ],
    }),
    highlight: { active: ['rag', 'class'], found: ['flat'], compare: ['waste'] },
    explanation: 'The task-quality curve can flatten before raw overlap recall reaches perfection. That does not mean recall is useless. It means the shipping gate should combine overlap, distance quality, answer quality, and cost.',
  };

  yield {
    state: labelMatrix(
      'Error ledger',
      [
        { id: 'miss', label: 'miss' },
        { id: 'near', label: 'near tie' },
        { id: 'filter', label: 'filter' },
        { id: 'fresh', label: 'freshness' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['absent', 'ef++'],
        ['near', 'ok'],
        ['few', 'bitset'],
        ['old', 'alias'],
      ],
    ),
    highlight: { active: ['miss:fix', 'filter:fix', 'fresh:fix'], compare: ['near:fix'] },
    explanation: 'Every failed query should be classed. A true miss asks for more search budget or a better index. A near tie may be acceptable. A filter failure points at bitset or payload indexes. A freshness failure points at ingestion and alias swaps.',
  };
}

function* prodGate() {
  yield {
    state: graphState({
      nodes: [
        { id: 'candidate', label: 'candidate', x: 0.9, y: 3.1, note: 'config' },
        { id: 'offline', label: 'offline', x: 2.6, y: 1.5, note: 'sweep' },
        { id: 'shadow', label: 'shadow', x: 2.6, y: 4.8, note: 'exact samp' },
        { id: 'canary', label: 'canary', x: 4.8, y: 3.1, note: 'small pct' },
        { id: 'promote', label: 'promote', x: 7.0, y: 1.8, note: 'version' },
        { id: 'rollback', label: 'rollback', x: 7.0, y: 4.5, note: 'safe old' },
      ],
      edges: [
        { id: 'e-c-off', from: 'candidate', to: 'offline', weight: 'replay' },
        { id: 'e-c-shad', from: 'candidate', to: 'shadow', weight: 'sample' },
        { id: 'e-off-can', from: 'offline', to: 'canary', weight: 'pass' },
        { id: 'e-shad-can', from: 'shadow', to: 'canary', weight: 'no gap' },
        { id: 'e-can-prom', from: 'canary', to: 'promote', weight: 'healthy' },
        { id: 'e-can-roll', from: 'canary', to: 'rollback', weight: 'breach' },
      ],
    }, { title: 'ANN config should roll out like code' }),
    highlight: { active: ['candidate', 'offline', 'shadow'], found: ['canary'], compare: ['rollback'] },
    explanation: 'Changing ef_search, nprobe, quantization, rerank depth, or filter strategy changes product behavior. Treat the index config like code: evaluate offline, shadow exact samples, canary, then promote with rollback.',
  };

  yield {
    state: labelMatrix(
      'Ship gate',
      [
        { id: 'recall', label: 'recall' },
        { id: 'quality', label: 'quality' },
        { id: 'latency', label: 'p95' },
        { id: 'cost', label: 'cost' },
        { id: 'slices', label: 'slices' },
      ],
      [
        { id: 'target', label: 'target' },
        { id: 'action', label: 'action' },
      ],
      [
        ['>=0.95', 'block'],
        ['no drop', 'block'],
        ['<25ms', 'tune'],
        ['budget', 'route'],
        ['no red', 'block'],
      ],
    ),
    highlight: { active: ['recall:action', 'quality:action', 'slices:action'], found: ['latency:action', 'cost:action'] },
    explanation: 'The gate should spell out which failures block launch and which failures trigger routing. For example, a strict profile may pass recall but fail p95; the router can reserve it for high-value queries instead of making it default.',
  };

  yield {
    state: ledgerGraph('Live traffic feeds the next sweep'),
    highlight: { active: ['route', 'watch', 'e-route-watch'], found: ['e-watch-sweep'], compare: ['truth'] },
    explanation: 'After launch, log slice-aware telemetry: p50/p95/p99 latency, result count, empty hits, rerank changes, exact-shadow recall, answer-quality labels, and filter selectivity. Those logs become the next sweep input.',
  };

  yield {
    state: labelMatrix(
      'Drift triggers',
      [
        { id: 'model', label: 'embed model' },
        { id: 'corpus', label: 'corpus' },
        { id: 'filters', label: 'filters' },
        { id: 'hardware', label: 'hardware' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'response', label: 'response' },
      ],
      [
        ['new vectors', 'rebuild'],
        ['size jump', 'resweep'],
        ['new ACL', 'bitsets'],
        ['CPU/SSD', 'retune'],
      ],
    ),
    highlight: { active: ['model:response', 'corpus:response', 'filters:response'], compare: ['hardware:response'] },
    explanation: 'ANN settings go stale when embeddings change, the corpus grows, filters change cardinality, deletes pile up, SSD latency shifts, or hardware moves. The ledger defines when to rebuild versus when to retune search knobs.',
  };

  yield {
    state: labelMatrix(
      'Runbook',
      [
        { id: 'recall', label: 'recall dip' },
        { id: 'tail', label: 'p99 spike' },
        { id: 'empty', label: 'empty hits' },
        { id: 'badans', label: 'bad answer' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'move', label: 'move' },
      ],
      [
        ['exact', 'ef++'],
        ['I/O wait', 'fast'],
        ['select', 'iter'],
        ['rerank', 'eval'],
      ],
    ),
    highlight: { found: ['recall:move', 'empty:move', 'badans:move'], compare: ['tail:move'] },
    explanation: 'The operational value is speed of diagnosis. Recall dips, p99 spikes, empty filtered queries, and bad final answers have different fixes. A ledger prevents teams from blindly turning one knob for every symptom.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pareto sweep') yield* paretoSweep();
  else if (view === 'truth set') yield* truthSet();
  else if (view === 'prod gate') yield* prodGate();
  else throw new InputError('Pick an ANN ledger view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows approximate nearest-neighbor tuning as an evidence loop. Approximate nearest-neighbor search, or ANN, means returning vectors that are near the query without checking every vector exactly. Active nodes are the current evidence source: query mix, exact truth set, sweep, gate, route, or telemetry.',
        'Read the plot with latency on the x-axis and recall on the y-axis. Recall@10 means the fraction of the exact top 10 neighbors that the approximate index also returned. A point on the Pareto frontier is not beaten by another measured point on both recall and latency.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'A vector-index setting is not a constant — it is a measured operating point. The question is not "what is a good ANN setting?" It is "which measured setting is good enough for this traffic, under this cost envelope, with this rollback plan?" The Pareto ledger keeps those tradeoffs visible instead of buried in a blog post copied six months ago.'},
        'ANN exists because exact vector search is simple but too expensive at scale. With 10 million document embeddings and 768 dimensions, one exact query touches about 7.68 billion coordinate differences before sorting. That is useful as a truth source, not as a default live path for every request.',
        'The ledger exists because approximate search is not just right or wrong. It has recall, latency, memory, build time, update cost, and slice behavior. A setting is a measured operating point tied to one corpus, one embedding model, one hardware profile, and one workload.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is exact k-nearest-neighbor search. Compute every distance, sort, and return the closest k items. It is correct and excellent for offline evaluation, small corpora, and shadow samples.',
        'The next obvious approach is to copy a default knob from a library benchmark. HNSW ef_search 100 or IVF nprobe 32 may be a reasonable starting point. It is not a shipping decision, because defaults do not know your filters, hardware, corpus drift, or user risk.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that quality and cost move together but not linearly. Raising ef_search from 64 to 160 may lift recall@10 from 0.91 to 0.97 while p95 latency rises from 9 ms to 23 ms. That trade can be right for legal retrieval and wrong for autocomplete.',
        'Averages hide the second wall. A config with 0.95 overall recall can fail fresh documents, rare languages, strict filters, or tail tenants. Production users feel those slices, not the mean of the benchmark.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make tuning a versioned ledger of comparable rows. Each row records the embedding model, corpus snapshot, query sample, exact baseline, index type, knob values, recall, latency distribution, memory, build cost, and worst-slice result. The row is evidence, not advice.',
        'Once rows exist, the Pareto rule removes dominated choices. If config A is slower and less accurate than config B on the same sample, A should not be the default. The remaining frontier contains the real policy choices.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First choose representative queries and compute exact kNN for them. Then sweep candidate indexes and knobs against the same query set. HNSW moves ef_search, IVF moves nprobe and rerank depth, and disk-backed graph search moves beam width and cache policy.',
        'Each run writes a ledger row and slice metrics. The ship gate then applies policy: minimum recall, maximum p95 and p99 latency, no red slices, acceptable memory, and rollback conditions. After launch, telemetry feeds the next sweep when embeddings, corpus size, filters, or hardware drift.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because it separates truth, measurement, and policy. Exact kNN defines what the approximate index is trying to recover. The sweep measures behavior under cost budgets. The gate decides which measured behavior is acceptable for users.',
        'The correctness argument is comparative. If the exact top 10 for a query are known and the ANN result contains 9 of them, recall@10 is 0.90 for that query. Aggregating that over slices makes missed-neighbor behavior visible instead of anecdotal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Evaluation cost can be large but predictable. If 50,000 sampled queries run exact search over 1 million vectors, the truth pass computes 50 billion distances. That belongs offline or in shadow sampling, not in every live request.',
        'Live cost is the chosen tradeoff. A low ef_search config might use 9 ms p95 and 1x memory for 0.91 recall. A strict config might use 37 ms p95 for 0.985 recall. The ledger turns those numbers into route profiles instead of one universal knob.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits semantic search, recommendations, image retrieval, code search, fraud similarity, deduplication, and retrieval-augmented generation. It matters most when retrieval quality changes user-visible answers or downstream decisions.',
        'It is also useful for routing. Low-risk browsing can use a fast profile, normal RAG can use the knee of the curve, and legal or medical evidence retrieval can use a strict profile or exact fallback for small pools.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The ledger fails if the query sample is not representative. Measuring only head queries can hide failures on rare terms, new documents, or filtered tenants. Measuring only recall can hide cases where downstream answer quality is flat or worse.',
        'It also fails when provenance is missing. If the embedding model, corpus snapshot, index build id, or hardware changed, old rows are not directly comparable. A stale ledger can be worse than no ledger because it gives old numbers new authority.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team evaluates 20,000 RAG queries with exact top 10 labels. HNSW ef=64 returns 0.91 recall@10 at 9 ms p95. HNSW ef=160 returns 0.97 at 23 ms. IVF nprobe=32 returns 0.95 at 18 ms and uses 0.35x the RAM of HNSW.',
        'If the default SLO is p95 under 20 ms and recall at least 0.95, IVF nprobe=32 is the default. HNSW ef=160 becomes a strict route for high-value queries, and HNSW ef=64 stays a fast route only if downstream answer quality does not drop. The decision follows measured behavior, not a copied default.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Faiss documentation, HNSW papers, DiskANN papers, pgvector documentation, Qdrant recall measurement guidance, and ANN-Benchmarks. Study exact kNN, HNSW, IVF-PQ, product quantization, cross-encoder reranking, RAG evaluation, and SLO-aware routing next.',
        'The exercise is to build a small ledger with 1,000 queries, exact labels, and three knob settings. Plot recall against p95 latency, mark dominated points, then inspect the worst 20 queries by slice.',
      ],
    },
  ],
};