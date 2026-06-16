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
  yield {
    state: graphState({
      nodes: [
        { id: 'req', label: 'request', x: 0.8, y: 2.8, note: 'key' },
        { id: 'sketch', label: 'sketch', x: 2.4, y: 2.8, note: 'freq' },
        { id: 'window', label: 'window', x: 4.0, y: 2.8, note: 'recency' },
        { id: 'admit', label: 'admit?', x: 5.7, y: 2.8, note: 'vs victim' },
        { id: 'main', label: 'main', x: 7.4, y: 2.8, note: 'keep hot' },
        { id: 'reject', label: 'reject', x: 9.0, y: 2.8, note: 'drop noise' },
      ],
      edges: [
        { id: 'e-req-sketch', from: 'req', to: 'sketch', weight: '' },
        { id: 'e-sketch-window', from: 'sketch', to: 'window', weight: '' },
        { id: 'e-window-admit', from: 'window', to: 'admit', weight: '' },
        { id: 'e-admit-main', from: 'admit', to: 'main', weight: '' },
        { id: 'e-main-reject', from: 'main', to: 'reject', weight: '' },
      ],
    }, { title: 'Window TinyLFU separates recency from admission' }),
    highlight: { active: ['sketch', 'window', 'admit'], found: ['main'] },
    explanation: 'W-TinyLFU gives new items a small recency window, but it does not automatically let them evict valuable main-cache entries. A frequency sketch estimates whether the newcomer deserves admission.',
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
        ['5', 'challenger'],
        ['12', 'resident'],
        ['reject', 'keep victim'],
      ],
    ),
    highlight: { active: ['new:freq', 'victim:freq'], found: ['decision:freq'] },
    explanation: 'TinyLFU is admission, not eviction. The eviction candidate is chosen by the main cache policy; TinyLFU asks whether the incoming item has enough estimated frequency to replace it.',
    invariant: 'A miss can still be rejected from the main cache.',
  };

  yield {
    state: labelMatrix(
      'Tiny frequency sketch',
      [
        { id: 'row0', label: 'hash 0' },
        { id: 'row1', label: 'hash 1' },
        { id: 'row2', label: 'hash 2' },
        { id: 'row3', label: 'hash 3' },
      ],
      [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
        { id: 'c', label: 'c' },
        { id: 'd', label: 'd' },
      ],
      [
        ['4', '8', '2', '1'],
        ['5', '7', '3', '2'],
        ['6', '8', '1', '2'],
        ['4', '9', '2', '1'],
      ],
    ),
    highlight: { active: ['row0:b', 'row1:b', 'row2:b', 'row3:b'] },
    explanation: 'The sketch is Count-Min-like: multiple hashed counters estimate recent frequency compactly. Production implementations age the sketch so old popularity fades.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'window', label: '1% win', x: 1.0, y: 2.8, note: 'new items' },
        { id: 'prob', label: 'prob', x: 3.1, y: 3.5, note: 'warm' },
        { id: 'prot', label: 'prot', x: 5.1, y: 3.5, note: 'hot' },
        { id: 'sketch', label: 'sketch', x: 3.1, y: 2.1, note: 'history' },
        { id: 'hill', label: 'tune win', x: 7.1, y: 2.8, note: 'adapt' },
      ],
      edges: [
        { id: 'e-window-prob', from: 'window', to: 'prob', weight: '' },
        { id: 'e-prob-prot', from: 'prob', to: 'prot', weight: '' },
        { id: 'e-sketch-prob', from: 'sketch', to: 'prob', weight: '' },
        { id: 'e-prot-hill', from: 'prot', to: 'hill', weight: '' },
        { id: 'e-hill-window', from: 'hill', to: 'window', weight: '' },
      ],
    }, { title: 'Caffeine-style policy structure' }),
    highlight: { active: ['window', 'sketch', 'prob', 'prot'], found: ['hill'] },
    explanation: 'Caffeine describes a small window LRU feeding a larger segmented LRU, with a frequency sketch and hill climbing to adapt the window size to workload shifts.',
  };
}

function* scanResistance() {
  yield {
    state: plotState({
      axes: { x: { label: 'request index', min: 0, max: 100 }, y: { label: 'hit rate', min: 0, max: 1.0 } },
      series: [
        { id: 'lru', label: 'LRU under scan', points: [{ x: 0, y: 0.82 }, { x: 25, y: 0.78 }, { x: 50, y: 0.35 }, { x: 75, y: 0.42 }, { x: 100, y: 0.70 }] },
        { id: 'tiny', label: 'W-TinyLFU', points: [{ x: 0, y: 0.82 }, { x: 25, y: 0.80 }, { x: 50, y: 0.72 }, { x: 75, y: 0.76 }, { x: 100, y: 0.81 }] },
      ],
    }),
    highlight: { active: ['tiny'], compare: ['lru'] },
    explanation: 'A one-time scan can flush LRU. TinyLFU-style admission filters scan noise by asking whether the new item has enough estimated reuse to displace an existing resident.',
  };

  yield {
    state: labelMatrix(
      'Workload shapes',
      [
        { id: 'burst', label: 'burst' },
        { id: 'scan', label: 'scan' },
        { id: 'stable', label: 'stable hot' },
        { id: 'shift', label: 'shift' },
      ],
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
    explanation: 'The window protects recency bursts; the sketch protects long-term frequency. The combination covers more workload shapes than either pure recency or pure frequency alone.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'lat', label: 'latency', x: 0.9, y: 3.5, note: 'miss cost' },
        { id: 'hit', label: 'hit rate', x: 2.8, y: 3.5, note: 'policy' },
        { id: 'mem', label: 'memory', x: 4.7, y: 2.1, note: 'sketch' },
        { id: 'cpu', label: 'CPU', x: 4.7, y: 3.5, note: 'counters' },
        { id: 'ops', label: 'ops', x: 6.7, y: 2.8, note: 'tune' },
        { id: 'prod', label: 'cache SLA', x: 8.5, y: 2.8, note: 'goal' },
      ],
      edges: [
        { id: 'e-lat-hit', from: 'lat', to: 'hit', weight: '' },
        { id: 'e-hit-cpu', from: 'hit', to: 'cpu', weight: '' },
        { id: 'e-hit-mem', from: 'hit', to: 'mem', weight: '' },
        { id: 'e-cpu-ops', from: 'cpu', to: 'ops', weight: '' },
        { id: 'e-mem-ops', from: 'mem', to: 'ops', weight: '' },
        { id: 'e-ops-prod', from: 'ops', to: 'prod', weight: '' },
      ],
    }, { title: 'A cache policy is a production tradeoff' }),
    highlight: { active: ['hit', 'mem', 'cpu'], found: ['prod'] },
    explanation: 'Better hit rate is valuable only if policy overhead stays small. W-TinyLFU is attractive because it makes an admission decision with compact approximate counters.',
  };

  yield {
    state: labelMatrix(
      'Audit questions',
      [
        { id: 'ttl', label: 'TTL' },
        { id: 'size', label: 'size' },
        { id: 'write', label: 'writes' },
        { id: 'trace', label: 'traces' },
      ],
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
    explanation: 'Production cache quality needs trace replay, value-size accounting, expiration, invalidation, and write behavior. Admission policy is powerful, but it is only one part of the cache contract.',
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
      heading: 'What it is',
      paragraphs: [
        'Window TinyLFU, often written W-TinyLFU, is a cache admission policy used by Caffeine. It combines a small recency window with a frequency sketch and a larger segmented main cache. The key difference from LRU is that a miss does not automatically get to evict a valuable resident from the main cache. The policy decides entry into the protected space, while other queues still choose concrete victims.',
        'TinyLFU estimates recent frequency with a compact sketch. When an item leaves the window and challenges a main-cache victim, the policy compares approximate frequencies. If the newcomer looks colder than the victim, it is rejected. That is why the algorithm is an admission policy, not just another eviction queue.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every access updates the frequency sketch. New items enter a small window, which captures bursts of recency that a pure frequency policy might ignore. When the window overflows, the candidate competes with a victim from the main cache. The candidate is admitted only if the sketch estimates it is at least as valuable as the resident it would replace.',
        'Caffeine describes W-TinyLFU as a small admission LRU feeding a larger segmented LRU, with a 4-bit Count-Min-style sketch and adaptive hill climbing for the window size. Conservative Count-Min Sketch explains why production admission sketches often use conservative updates to reduce false frequency from collision noise. The details matter because cache workloads drift: a search service, CDN, or database buffer can move between scans, bursts, and stable hot sets.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The policy adds CPU work and memory for the sketch, but it avoids storing nonresident history for every evicted key. That keeps overhead small compared with ARC or LIRS-style policies that can require extra ghost entries. The complexity is operational: measuring hit rate by trace, accounting for item size, aging counters, and coordinating policy with expiration and invalidation.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Caffeine uses Window TinyLFU because it performs well across a wide range of traces with low memory overhead. Its wiki emphasizes that ordinary LRU can do poorly on full scans, while W-TinyLFU remains competitive with stronger policies by blending recency, frequency, and adaptivity.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'W-TinyLFU does not make cache invalidation easy, and it does not guarantee the best policy for every workload. It also should not be evaluated on synthetic uniform traffic only. Real trace replay is essential because hit rate, byte hit rate, tail latency, and stale-read risk can move in different directions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: TinyLFU: A Highly Efficient Cache Admission Policy at https://arxiv.org/abs/1512.00727 and Caffeine Efficiency notes at https://github.com/ben-manes/caffeine/wiki/Efficiency. Study LRU Cache, Count-Min Sketch, Conservative Count-Min Sketch, Bloom Filter, Cache Invalidation & Versioning, Write-Through vs Write-Back, SwissTable Hash Map, and Tail Latency next.',
      ],
    },
  ],
};
