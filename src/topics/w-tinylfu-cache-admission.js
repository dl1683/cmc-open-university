// Window TinyLFU: a scan-resistant cache admission policy built from a small
// recency window, a frequency sketch, and a protected main cache.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'w-tinylfu-cache-admission',
  title: 'W-TinyLFU Cache Admission',
  category: 'Systems',
  summary: 'A production cache policy: let new items prove recency in a small window, then use a tiny frequency sketch to decide admission into the main cache.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['admission pipeline', 'scan resistance'], defaultValue: 'admission pipeline' },
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

function* admissionPipeline() {
  const pipelineNodes = [
    { id: 'req', label: 'request', x: 0.8, y: 2.8, note: 'key' },
    { id: 'sketch', label: 'sketch', x: 2.4, y: 2.8, note: 'freq' },
    { id: 'window', label: 'window', x: 4.0, y: 2.8, note: 'recency' },
    { id: 'admit', label: 'admit?', x: 5.7, y: 2.8, note: 'vs victim' },
    { id: 'main', label: 'main', x: 7.4, y: 2.8, note: 'keep hot' },
    { id: 'reject', label: 'reject', x: 9.0, y: 2.8, note: 'drop noise' },
  ];
  const pipelineEdges = [
    { id: 'e-req-sketch', from: 'req', to: 'sketch', weight: '' },
    { id: 'e-sketch-window', from: 'sketch', to: 'window', weight: '' },
    { id: 'e-window-admit', from: 'window', to: 'admit', weight: '' },
    { id: 'e-admit-main', from: 'admit', to: 'main', weight: '' },
    { id: 'e-main-reject', from: 'main', to: 'reject', weight: '' },
  ];
  const newFreq = '5';
  const victimFreq = '12';
  const sketchRows = [
    { id: 'row0', label: 'hash 0' },
    { id: 'row1', label: 'hash 1' },
    { id: 'row2', label: 'hash 2' },
    { id: 'row3', label: 'hash 3' },
  ];
  const sketchCols = [
    { id: 'a', label: 'a' },
    { id: 'b', label: 'b' },
    { id: 'c', label: 'c' },
    { id: 'd', label: 'd' },
  ];

  yield {
    state: graphState({
      nodes: pipelineNodes,
      edges: pipelineEdges,
    }, { title: 'Window TinyLFU separates recency from admission' }),
    highlight: { active: ['sketch', 'window', 'admit'], found: ['main'] },
    explanation: `W-TinyLFU routes each request through ${pipelineNodes.length} stages (${pipelineNodes.map(n => n.label).join(' → ')}), but does not automatically let newcomers evict valuable main-cache entries. A ${pipelineNodes[1].label} estimates whether the newcomer deserves admission.`,
  };

  yield {
    state: labelMatrix(
      'Admission comparison',
      [
        { id: 'new', label: 'new item' },
        { id: 'victim', label: 'victim' },
        { id: 'decision', label: 'decision' },
      ],
      [
        { id: 'freq', label: 'freq' },
        { id: 'policy', label: 'policy' },
      ],
      [
        [newFreq, 'challenger'],
        [victimFreq, 'resident'],
        ['reject', 'keep victim'],
      ],
    ),
    highlight: { active: ['new:freq', 'victim:freq'], found: ['decision:freq'] },
    explanation: `TinyLFU is admission, not eviction. Here the newcomer has freq ${newFreq} vs the victim's ${victimFreq}, so the newcomer is rejected. TinyLFU asks whether the incoming item has enough estimated frequency to replace the resident.`,
    invariant: `A miss can still be rejected: freq ${newFreq} < ${victimFreq} means the newcomer loses despite being requested.`,
  };

  yield {
    state: labelMatrix(
      'Tiny frequency sketch',
      sketchRows,
      sketchCols,
      [
        ['4', '8', '2', '1'],
        ['5', '7', '3', '2'],
        ['6', '8', '1', '2'],
        ['4', '9', '2', '1'],
      ],
    ),
    highlight: { active: ['row0:b', 'row1:b', 'row2:b', 'row3:b'] },
    explanation: `The sketch is Count-Min-like: ${sketchRows.length} hash rows × ${sketchCols.length} columns estimate recent frequency compactly. Production implementations age the ${sketchRows.length * sketchCols.length}-cell sketch so old popularity fades.`,
  };

  const caffeineNodes = [
    { id: 'window', label: '1% win', x: 1.0, y: 2.8, note: 'new items' },
    { id: 'prob', label: 'prob', x: 3.1, y: 3.5, note: 'warm' },
    { id: 'prot', label: 'prot', x: 5.1, y: 3.5, note: 'hot' },
    { id: 'sketch', label: 'sketch', x: 3.1, y: 2.1, note: 'history' },
    { id: 'hill', label: 'tune win', x: 7.1, y: 2.8, note: 'adapt' },
  ];
  const caffeineEdges = [
    { id: 'e-window-prob', from: 'window', to: 'prob', weight: '' },
    { id: 'e-prob-prot', from: 'prob', to: 'prot', weight: '' },
    { id: 'e-sketch-prob', from: 'sketch', to: 'prob', weight: '' },
    { id: 'e-prot-hill', from: 'prot', to: 'hill', weight: '' },
    { id: 'e-hill-window', from: 'hill', to: 'window', weight: '' },
  ];
  const windowLabel = caffeineNodes[0].label;

  yield {
    state: graphState({
      nodes: caffeineNodes,
      edges: caffeineEdges,
    }, { title: 'Caffeine-style policy structure' }),
    highlight: { active: ['window', 'sketch', 'prob', 'prot'], found: ['hill'] },
    explanation: `Caffeine arranges ${caffeineNodes.length} components: a small "${windowLabel}" window LRU feeding a segmented LRU (${caffeineNodes[1].label} → ${caffeineNodes[2].label}), with a frequency sketch and hill climbing (${caffeineNodes[4].label}) to adapt the window size.`,
  };
}

function* scanResistance() {
  const lruScanDip = 0.35;
  const tinyAtScan = 0.72;
  const lruPoints = [{ x: 0, y: 0.82 }, { x: 25, y: 0.78 }, { x: 50, y: lruScanDip }, { x: 75, y: 0.42 }, { x: 100, y: 0.70 }];
  const tinyPoints = [{ x: 0, y: 0.82 }, { x: 25, y: 0.80 }, { x: 50, y: tinyAtScan }, { x: 75, y: 0.76 }, { x: 100, y: 0.81 }];
  const workloadShapes = [
    { id: 'burst', label: 'burst' },
    { id: 'scan', label: 'scan' },
    { id: 'stable', label: 'stable hot' },
    { id: 'shift', label: 'shift' },
  ];

  yield {
    state: plotState({
      axes: { x: { label: 'request index', min: 0, max: 100 }, y: { label: 'hit rate', min: 0, max: 1.0 } },
      series: [
        { id: 'lru', label: 'LRU under scan', points: lruPoints },
        { id: 'tiny', label: 'W-TinyLFU', points: tinyPoints },
      ],
    }),
    highlight: { active: ['tiny'], compare: ['lru'] },
    explanation: `A one-time scan drops LRU to ${lruScanDip} while W-TinyLFU holds at ${tinyAtScan}. Admission filtering rejects scan noise by requiring enough estimated reuse to displace an existing resident.`,
  };

  yield {
    state: labelMatrix(
      'Workload shapes',
      workloadShapes,
      [
        { id: 'LRU', label: 'LRU' },
        { id: 'Tiny', label: 'W-TinyLFU' },
      ],
      [
        ['good', 'window helps'],
        ['bad', 'reject noise'],
        ['good', 'good'],
        ['ok', 'hill tune'],
      ],
    ),
    highlight: { found: ['scan:Tiny', 'shift:Tiny'], compare: ['scan:LRU'] },
    explanation: `Across ${workloadShapes.length} workload shapes (${workloadShapes.map(s => s.label).join(', ')}), the window protects recency bursts while the sketch protects long-term frequency. The combination covers more patterns than either pure recency or pure frequency alone.`,
  };

  const tradeoffNodes = [
    { id: 'lat', label: 'latency', x: 0.9, y: 3.5, note: 'miss cost' },
    { id: 'hit', label: 'hit rate', x: 2.8, y: 3.5, note: 'policy' },
    { id: 'mem', label: 'memory', x: 4.7, y: 2.1, note: 'sketch' },
    { id: 'cpu', label: 'CPU', x: 4.7, y: 3.5, note: 'counters' },
    { id: 'ops', label: 'ops', x: 6.7, y: 2.8, note: 'tune' },
    { id: 'prod', label: 'cache SLA', x: 8.5, y: 2.8, note: 'goal' },
  ];
  const tradeoffEdges = [
    { id: 'e-lat-hit', from: 'lat', to: 'hit', weight: '' },
    { id: 'e-hit-cpu', from: 'hit', to: 'cpu', weight: '' },
    { id: 'e-hit-mem', from: 'hit', to: 'mem', weight: '' },
    { id: 'e-cpu-ops', from: 'cpu', to: 'ops', weight: '' },
    { id: 'e-mem-ops', from: 'mem', to: 'ops', weight: '' },
    { id: 'e-ops-prod', from: 'ops', to: 'prod', weight: '' },
  ];

  yield {
    state: graphState({
      nodes: tradeoffNodes,
      edges: tradeoffEdges,
    }, { title: 'A cache policy is a production tradeoff' }),
    highlight: { active: ['hit', 'mem', 'cpu'], found: ['prod'] },
    explanation: `Better ${tradeoffNodes[1].label} is valuable only if policy overhead (${tradeoffNodes[2].label}, ${tradeoffNodes[3].label}) stays small. W-TinyLFU reaches the ${tradeoffNodes[5].label} goal using compact approximate counters across ${tradeoffEdges.length} dependency edges.`,
  };

  const auditRows = [
    { id: 'ttl', label: 'TTL' },
    { id: 'size', label: 'size' },
    { id: 'write', label: 'writes' },
    { id: 'trace', label: 'traces' },
  ];

  yield {
    state: labelMatrix(
      'Audit questions',
      auditRows,
      [
        { id: 'risk', label: 'risk' },
        { id: 'check', label: 'check' },
      ],
      [
        ['stale', 'invalidation'],
        ['var bytes', 'weigh items'],
        ['dirty data', 'write policy'],
        ['toy hits', 'real replay'],
      ],
    ),
    highlight: { found: ['ttl:check', 'size:check', 'trace:check'] },
    explanation: `Production cache quality spans ${auditRows.length} concerns (${auditRows.map(r => r.label).join(', ')}): trace replay, value-size accounting, expiration, invalidation, and write behavior. Admission policy is powerful, but it is only one part of the cache contract.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'admission pipeline') yield* admissionPipeline();
  else if (view === 'scan resistance') yield* scanResistance();
  else throw new InputError('Pick a W-TinyLFU view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the picture as two decisions, not one. A cache miss means the requested value was absent. Cache admission means the fetched value is allowed to occupy scarce cache space after the request has been served.',
        {type: 'image', src: './assets/gifs/w-tinylfu-cache-admission.gif', alt: 'Animated walkthrough of the w tinylfu cache admission visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Active highlights show a request updating the frequency sketch or moving through the small window. Found highlights show resident items protected by reuse evidence. A one-time miss may pass through the window, but it must beat a victim by estimated frequency before it receives long-lived space.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A cache is a small fast store in front of a larger slower authority. If the cache admits every missed key, a scan of one-time keys can evict the values that actually save latency. Real services see stable hot keys, short bursts, and accidental scans in the same request stream.',
        {type: "callout", text: "W-TinyLFU makes cache space an earned resource: recency gets a trial window, but frequency decides whether a newcomer can evict a resident."},
        'Window TinyLFU exists to separate serving a request from rewarding that key with residency. It lets new keys prove recent demand in a small trial area while a compact frequency estimate protects the main cache from noise.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is least-recently-used eviction, usually called LRU. It keeps the keys touched most recently and evicts the key whose last access is oldest. LRU is simple and reacts quickly when a workload changes.',
        'A second obvious approach is least-frequently-used eviction, or LFU. It keeps keys with many past hits and rejects keys with little history. LFU protects old hot keys, but it adapts slowly when the hot set changes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Pure recency fails under scans. If a report reads 10,000 cold records through a cache that holds 1,000 entries, LRU can replace the entire working set even though none of those records will be reused.',
        'Pure frequency fails under stale history. A key that was popular yesterday can keep a high count after users leave it behind. A new key that is becoming hot may be rejected for too long because it has not yet accumulated enough count.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'W-TinyLFU uses recency for a trial and frequency for admission. A missing key enters a small window so bursts get a chance. When the window overflows, the departing candidate challenges a main-cache victim using estimated recent frequency.',
        'The estimate can be approximate because admission is a ranking decision, not a correctness decision. A compact sketch stores counters for hashed keys over a recent sample. Aging makes old popularity fade so the estimate follows the current workload.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every request updates the frequency sketch, whether the request is a hit or a miss. On a miss, the cache fetches the value and puts it in the small window. The request is served immediately; the later question is whether the value deserves main-cache space.',
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg", alt: "Memory hierarchy showing multiple cache levels", caption: "A cache hierarchy makes the scarce-space problem concrete: fast layers must decide which copied values deserve residency. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg."},
        'When the window is full, one candidate leaves it and is compared with a victim from the main cache. If the candidate estimate is higher, the candidate is admitted and the victim leaves. If the estimate is lower, the candidate is rejected and the resident stays.',
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg", alt: "Directed graph with nodes connected by arrows", caption: "The admission path is a directed policy graph: request, sketch update, window trial, victim comparison, admit or reject. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg."},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The cache always returns the fetched value for the current request; admission only decides future residency. Therefore a mistaken sketch estimate can hurt hit rate, but it does not return the wrong value.',
        'The policy works because its two signals cover each other. Recency catches new bursts before frequency has enough evidence. Frequency blocks one-hit scans before they overwrite proven residents.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A lookup still needs the ordinary cache map operation, usually expected O(1). W-TinyLFU adds sketch updates on every access, window bookkeeping, main-cache bookkeeping, and a comparison when a candidate leaves the window. Doubling traffic doubles those small metadata updates.',
        'Memory is bounded but not free. The cache stores resident keys and values plus sketch counters, window state, protected or probation state, and aging metadata. The main practical cost is extra CPU on the hottest path of an already latency-sensitive cache.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Caffeine, a production Java caching library, popularized W-TinyLFU for service-local caches. The fit is strong when miss cost is high, memory is limited, and request streams mix hot keys with scans or bursts.',
        'The same admission idea applies to database page caches, CDN object caches, storage caches, and memoization layers. The important access pattern is contested space: many values can be requested, but only a small fraction deserve to stay.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The sketch can overestimate a cold key because hashed counters collide. It can also underrepresent a new hot key if aging or window sizing is poorly tuned. Those errors show up as lower hit rate, not data corruption.',
        'W-TinyLFU does not solve freshness, invalidation, byte sizing, or write policy. A cache that treats a 4 KB value and a 40 MB value as equal may waste memory even with a good admission rule. Adoption should be judged by trace replay, byte hit rate, miss cost, and latency.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a cache holds four entries, the window holds one, and the main cache holds A, B, C, and D with sketch estimates A=20, B=18, C=15, D=12. A scan requests X, Y, and Z once each. Each scanned key enters the window, then challenges D with estimate 1 and loses, so the main cache stays intact.',
        'Now key E is requested five times during a burst. Its estimate rises to 5 while it moves through the window. If the victim has estimate 3, E is admitted; if the victim has estimate 12, E is rejected until more evidence arrives.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: TinyLFU at https://arxiv.org/abs/1512.00727 and the Caffeine efficiency notes at https://github.com/ben-manes/caffeine/wiki/Efficiency. Read them for the admission rule, the sketch, and the reason a small recency window improves adaptation.',
        'Study LRU Cache for the baseline, Count-Min Sketch for approximate frequency, Bloom Filter for compact probabilistic evidence, Cache Invalidation for freshness, and Tail Latency for the user-visible cost of bad misses.',
      ],
    },
  ],
};
