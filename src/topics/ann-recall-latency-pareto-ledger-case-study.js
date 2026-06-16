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
    explanation: 'Production ANN tuning should start from a query mix, an exact nearest-neighbor baseline, and a replayable sweep of index configurations. The output is a ledger, not a gut feeling.',
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
    explanation: 'The Pareto frontier is the non-dominated edge of the sweep: no other measured point is both faster and more accurate. The knee is often the best production default because it buys most of the recall before latency bends upward.',
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
      heading: 'What it is',
      paragraphs: [
        'An ANN recall-latency Pareto ledger is the production data structure around vector-index tuning. It records which embedding model, corpus snapshot, query sample, exact kNN baseline, index configuration, recall metric, latency percentile, memory footprint, build cost, rerank depth, and workload slice produced each operating point.',
        'This topic connects the algorithm pages to the act of shipping a search system. HNSW, Faiss IVF-PQ, ScaNN, FINGER, DiskANN, and Filtered Vector Search all expose knobs. The ledger decides which knob setting is allowed to serve which user traffic, and why.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with representative query samples and compute exact kNN for those queries. Exact search may be too slow for production, but it is the calibration target for approximate search. Then run every candidate index setting against the same queries: HNSW ef_search, IVFFlat probes, IVF-PQ nprobe and rerank depth, ScaNN partition and rescoring settings, DiskANN beam and cache settings, and filter-aware search policies.',
        'For each run, write a row: config id, corpus version, embedding model id, recall@k, distance-quality metric if available, nDCG or task-quality score, p50/p95/p99 latency, QPS, memory, index size, build time, update behavior, and worst-slice score. The Pareto frontier keeps the non-dominated points: configurations where no other measured setting is both faster and better.',
      ],
    },
    {
      heading: 'Why recall is not the whole story',
      paragraphs: [
        'Recall@k is the first safety rail because it checks whether approximate search is close to exact kNN. Qdrant documents this exact-vs-ANN comparison directly and recommends representative query vectors for CI-style checks. ANN-Benchmarks makes the same speed-quality tradeoff visible by plotting recall against queries per second, with detail for approximate recall, index size, and build time.',
        'But overlap recall is not the same as application quality. Recent ANN research argues that a retrieved set can miss exact ids while still being near enough in distance to preserve downstream classification or RAG quality. Treat that as a caution, not permission to ignore recall. A strong gate keeps recall, distance quality, reranking quality, final-answer quality, and latency together.',
      ],
    },
    {
      heading: 'Production case study',
      paragraphs: [
        'Imagine an enterprise RAG system with policy documents, ticket histories, and product manuals. A fast HNSW profile with ef_search 64 may work for autocomplete. A default IVF-PQ profile with moderate nprobe and exact reranking may work for normal support questions. A strict legal-citation profile may need higher ef_search, larger rerank depth, or exact fallback for a small sample of high-value queries.',
        'The ledger prevents accidental regression. If a new embedding model changes vector geometry, the old HNSW or PQ settings may no longer hit recall targets. If a new authorization filter leaves only 2 percent of the corpus eligible, post-filter ANN may return too few results. If an index rebuild changes graph quality, p95 can stay fine while recall drops on tail slices. Versioned rows make those changes visible.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first mistake is copying someone else\'s HNSW or IVF parameters. pgvector documents the basic direction of the knobs: higher ef_search improves recall at speed cost, and higher ef_construction improves build quality at build-time or insert-speed cost. Those directions are useful, but they do not select your operating point. Your corpus, filters, hardware, embedding model, reranker, and user SLOs decide the point.',
        'The second mistake is optimizing only the average. A configuration can look excellent overall while failing fresh documents, rare languages, filtered tenants, long queries, or image/table embeddings. The third mistake is launching a config without provenance. If the row does not identify the corpus, model, query sample, exact baseline, and index build, it cannot explain future regressions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ANN-Benchmarks at https://ann-benchmarks.com/, the ANN-Benchmarks GitHub project at https://github.com/erikbern/ann-benchmarks, Faiss documentation at https://faiss.ai/index.html, Faiss index-selection guidelines at https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index, pgvector HNSW and IVFFlat docs at https://github.com/pgvector/pgvector, Qdrant search parameters at https://qdrant.tech/documentation/search/search/, Qdrant indexing docs at https://qdrant.tech/documentation/manage-data/indexing/, Qdrant Measuring ANN Recall at https://qdrant.tech/documentation/tutorials-search-engineering/ann-recall/, and ANN Search: Recall What Matters at https://arxiv.org/abs/2606.04522.',
        'Study HNSW, Product Quantization for Vector Search, Faiss IVF-PQ Case Study, ScaNN Vector Search Case Study, FINGER Graph ANN Case Study, DiskANN SSD Vector Search Case Study, Filtered Vector Search and Bitset Gates, Multi-Index RAG, RAG Evaluation, Cross-Encoder Reranker, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
