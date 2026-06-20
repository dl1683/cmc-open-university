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
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'A vector-index setting is not a constant — it is a measured operating point. The question is not "what is a good ANN setting?" It is "which measured setting is good enough for this traffic, under this cost envelope, with this rollback plan?" The Pareto ledger keeps those tradeoffs visible instead of buried in a blog post copied six months ago.'},
        'Approximate nearest-neighbor search exists because exact vector search gets expensive fast. If a corpus has ten million embeddings and every query compares against every vector, the math is simple but the product is too slow. Vector indexes such as HNSW, IVF-PQ, ScaNN, and DiskANN reduce the search work by visiting only a useful part of the space.',
        'That shortcut creates an engineering problem. The index is no longer just correct or incorrect. It has an operating point: how much recall it gets, how much latency it spends, how much memory it uses, how long it takes to build, and which workload slices it harms. A recall-latency Pareto ledger is the record that keeps those tradeoffs visible.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The first reasonable approach is exact search. Compute the distance from the query vector to every document vector, sort the distances, and return the top k. This is excellent as a truth source. It is also the right baseline for small corpora, offline evaluation, and spot checks.',
        'The second common approach is copying a setting from a blog post or benchmark. Someone says HNSW with ef_search 100 worked well, or IVF with nprobe 32 was a good default. That is not a foolish starting point. These knobs have real directions: more search usually buys more recall and spends more latency.',
        'The wall is that neither approach answers the shipping question. Exact search may miss the latency SLO. Copied settings may fit a different embedding model, corpus shape, hardware profile, filter pattern, or user risk level. The question is not "what is a good ANN setting?" The question is "which measured setting is good enough for this traffic, under this cost envelope, with this rollback plan?"',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat index tuning as a ledger of measured operating points, not as a one-time parameter choice. A row in the ledger says: with this embedding model, this corpus snapshot, this query sample, this exact baseline, and this index configuration, we observed this recall, this latency distribution, this memory footprint, this build cost, and these slice failures.',
        'Once the rows exist, the Pareto frontier does the first cut. A configuration is dominated if another measured configuration is both faster and more accurate, or equally accurate with lower cost. Dominated points are not useful defaults. The frontier contains the real tradeoffs, and the knee of the curve often becomes the default because it captures most of the recall before latency rises sharply.',
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        'Start by sampling representative queries. The sample should include head queries, rare queries, short queries, long queries, filtered queries, fresh documents, important tenants, and domain-specific high-risk cases. Then compute exact kNN for that sample. Exact search can be slow, but it gives the calibration target that approximate search is trying to recover.',
        'Next, run candidate configurations against the same query set. For HNSW, sweep ef_search and sometimes construction parameters. For IVF and IVF-PQ, sweep probe count, quantization settings, and rerank depth. For disk-backed graph search, sweep beam width, cache size, and I/O-sensitive settings. For filtered vector search, test whether filters are applied before, during, or after graph traversal.',
        'Each run writes a ledger row. Useful columns include config id, embedding model id, corpus version, index build id, query sample id, recall@k, distance error, nDCG if ranking matters, downstream answer score if the index feeds RAG, p50, p95, p99, memory, index size, build time, update cost, and worst-slice score. The row is not just a metric record. It is provenance for a future production decision.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first view proves that a tuning decision needs two sources of truth: a representative query mix and an exact nearest-neighbor baseline. The approximate sweep is meaningful only because every candidate is compared against the same target. The ledger node is the join point where labels, measurements, and provenance become one record.',
        'The plot view proves why a single metric is not enough. Moving up improves recall; moving right spends latency. The frontier keeps configurations that cannot be beaten on both axes. The knee marker shows why production defaults are usually compromises, not maximum-recall settings. The truth-set and production-gate views extend the lesson: a config must survive slice analysis, task-quality checks, canary rollout, and drift monitoring.',
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        'The method works because it separates truth, measurement, and policy. Exact kNN supplies the reference set. The sweep supplies measured behavior under different cost budgets. The production gate supplies the business rule for which measured behavior is acceptable. Mixing these together is what causes weak tuning decisions.',
        'The Pareto rule is also easy to defend. If configuration A has lower recall and higher latency than configuration B on the same benchmark, A has no reason to be a default. The frontier does not prove that every remaining point is safe, but it removes points that are plainly worse. Slice checks then catch the cases where an average frontier point hides a tail failure.',
        'The ledger gives repeatability. If recall drops after an embedding-model upgrade, the team can compare the new row to the old row. If p99 spikes after moving to different SSDs, the team can see whether the index choice, cache behavior, or hardware changed. Without provenance, every regression becomes a guessing exercise.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is evaluation discipline. Exact baselines can be expensive. Large sweeps consume CPU, memory, SSD bandwidth, and engineering time. Task-quality evaluation can require labeled data or judge models. A serious ledger also needs storage, versioning, and dashboards so old runs remain comparable.',
        'The payoff is that the live system can route intelligently. A fast profile may serve autocomplete or low-risk browsing. A default profile may serve normal RAG. A strict profile may serve legal, medical, or audit-heavy retrieval. Exact fallback may be reserved for offline jobs or small high-value slices. One universal knob is simpler, but it wastes either latency or quality.',
        'Real systems use this pattern whenever vector search affects user-visible behavior: semantic search, recommendations, deduplication, image retrieval, support-answer retrieval, code search, fraud similarity, and retrieval-augmented generation. The ledger is especially important when filters are strong, documents change often, or a reranker can hide some index misses but not others.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Averages are the easiest trap. A config can look good overall while failing tail documents, rare languages, fresh content, long queries, or tenants with restrictive filters. Another trap is measuring only recall@k. Overlap with exact neighbors is valuable, but task quality also depends on distance ties, ranking, reranking, prompt construction, and whether the final answer needed the missed item.',
        'The ledger can also go stale. New embeddings change geometry. Corpus growth changes graph quality. Deletes and updates leave index artifacts. New filters change selectivity. Hardware changes alter tail latency. A row that was safe last quarter is not automatically safe after these changes. Drift triggers should tell the team when to rebuild, resweep, or reroute.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study HNSW for graph-based search, product quantization for memory reduction, IVF-PQ for coarse partitioning plus compressed vectors, DiskANN for SSD-backed vector search, and filtered vector search for payload-aware retrieval. Then connect this topic to cross-encoder reranking, RAG evaluation, benchmark variance, and SLO-aware request routing.',
        'Useful primary references include ANN-Benchmarks for recall-speed plots, Faiss documentation for index families, pgvector documentation for HNSW and IVFFlat knobs, and Qdrant documentation for measuring ANN recall. The important habit is not memorizing one library default. It is building the evidence loop that lets a team change a vector index without changing product behavior by accident.',
      ],
    },
  ],
};
