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
      heading: "Why this exists",
      paragraphs: [
        "A normal LRU cache admits every miss. If the key is requested and the cache has room, it enters. If the cache is full, the miss enters after evicting the least recent resident. That rule is simple, but it treats a one-time visitor as if it has earned the same space as a value used many times.",
        {type: "callout", text: "W-TinyLFU makes cache space an earned resource: recency gets a trial window, but frequency decides whether a newcomer can evict a resident."},
        "Window TinyLFU exists because real workloads mix reuse with noise. A service may have a stable hot set, short bursts from user sessions, and long scans from reports or crawlers. The cache should learn from the request, serve the miss, and still ask a separate question before giving the fetched object durable resident space.",
      ],
    },
    {
      heading: "The naive approaches",
      paragraphs: [
        "Pure recency is the first naive answer. It reacts quickly because a new object immediately becomes hot after one access. That helps with bursts, but it is fragile under scans. A sequence of cold keys can push out useful residents even though none of the scanned keys will be used again.",
        "Pure frequency is the second naive answer. It protects objects with many past hits, but old popularity can become stale. A once-famous object can keep its high count long after users stop asking for it. A new hot object may need many accesses before it can compete with old incumbents.",
      ],
    },
    {
      heading: "The core insight",
      paragraphs: [
        "W-TinyLFU separates admission from eviction. The cache may fetch a missing value to answer the current request, but it does not automatically let that value displace a main-cache resident. The newcomer must show enough estimated reuse to justify replacing the victim.",
        "The estimate does not need to be exact. TinyLFU uses a compact frequency sketch over a recent sample of accesses. The sketch gives a cheap signal: has this candidate been seen often enough in the recent past to be more promising than the resident it would evict?",
      ],
    },
    {
      heading: "How the policy works",
      paragraphs: [
        "A practical W-TinyLFU cache has a small recency window and a larger main region. All requests update the frequency sketch. On a miss, the object is placed in the window so it gets an immediate chance to absorb bursts and demonstrate reuse without first passing a strict frequency test.",
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg", alt: "Memory hierarchy showing multiple cache levels", caption: "A cache hierarchy makes the scarce-space problem concrete: fast layers must decide which copied values deserve residency. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg."},
        "When the window overflows, a candidate leaves the window and challenges a victim from the main cache. The policy compares their sketch estimates. If the candidate looks more frequent, it is admitted and the victim is evicted. If the candidate looks less frequent, the candidate is rejected and the resident stays.",
      ],
    },
    {
      heading: "Main-cache shape",
      paragraphs: [
        "Many implementations pair TinyLFU admission with a segmented main cache. New admitted items can enter a probationary area, while repeatedly hit residents move into a protected area. This gives the cache a second mechanism: admission filters noise, and segmentation protects items that continue to prove reuse after admission.",
        "The window matters because frequency alone is too conservative. If every new key had to beat an established resident before storing anything, the cache would adapt slowly. The window gives recent arrivals a small sandbox. Most one-hit objects die there. Real new hot objects get enough accesses to win the later comparison.",
      ],
    },
    {
      heading: "Aging and bounded memory",
      paragraphs: [
        "TinyLFU is useful only if old history fades. A key that was hot last week should not dominate a key that is hot now. Implementations keep the frequency sample bounded by aging counters, resetting portions of the sketch, or otherwise reducing old estimates so the admission signal follows the recent workload.",
        "Bounded memory is the reason for using a sketch instead of a full table of counts for every key ever requested. A full history table would grow with traffic and would be attacked by one-hit keys. The sketch accepts collisions and approximate estimates in exchange for fixed memory and predictable update cost.",
      ],
    },
    {
      heading: "What the visual is proving",
      paragraphs: [
        "The visual is proving that a cache miss and cache admission are different events. The request still gets served, the sketch still learns from the access, and the window still absorbs the newcomer. Only when space pressure forces a choice does the policy ask whether the candidate deserves long-lived space.",
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg", alt: "Directed graph with nodes connected by arrows", caption: "The admission path is a directed policy graph: request, sketch update, window trial, victim comparison, admit or reject. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg."},
        "The scan-resistance path proves the value of rejection. In pure LRU, a long scan rewrites the cache simply because the scan is recent. In W-TinyLFU, scanned keys may pass through the window, but their low estimates make them lose against residents that have accumulated reuse evidence.",
      ],
    },
    {
      heading: "Why it works",
      paragraphs: [
        "The policy works because it uses two weak signals that compensate for each other. Recency is good at adapting to sudden locality. Frequency is good at identifying values that survive beyond one touch. W-TinyLFU lets the window handle the first problem and lets the sketch handle the second.",
        "It also works because approximate counting is enough for admission. The cache does not need the true access count for every key ever seen. It needs a biased but useful comparison at eviction time. A small sketch can represent a large stream and age its counters so old history fades.",
      ],
    },
    {
      heading: "Costs and tradeoffs",
      paragraphs: [
        "W-TinyLFU spends memory on metadata: sketch counters, window state, main-cache state, and sometimes extra bits for aging or segmentation. It also updates the sketch on every access. Those updates are usually small, but they are not free in a hot in-memory cache.",
        "The tradeoff is that admission decisions can save far more work than they cost when misses are expensive or when scans are common. The policy is most valuable when cache space is contested. If the cache is huge relative to the working set, or if misses are cheap, the added machinery may not matter.",
      ],
    },
    {
      heading: "Implementation details",
      paragraphs: [
        "A production implementation has to place the admission check on the right path. The sketch should learn from hits and misses, because both describe demand. The expensive comparison should happen only when the window or main cache needs space, not on every lookup.",
        "Concurrency is another design pressure. Sketch updates may be buffered, striped, or otherwise relaxed so hot keys do not create a single counter bottleneck. Exact accounting is less important than stable behavior under load, because the sketch is already an approximation used for ranking rather than correctness.",
      ],
    },
    {
      heading: "Real uses",
      paragraphs: [
        "Caffeine popularized this family in a production Java caching library, combining a small admission window, TinyLFU-style frequency estimation, and efficient concurrent implementation techniques. The important lesson is not that every cache should copy one library, but that admission can be a first-class policy surface.",
        "The idea also appears in broader cache design discussions for storage, CDNs, database pages, and service-local memoization. Any system that sees one-hit noise must decide whether misses automatically deserve space. TinyLFU gives that decision a measurable, trace-replayable basis.",
      ],
    },
    {
      heading: "Failure modes and limits",
      paragraphs: [
        "The sketch can be wrong. Hash collisions can overestimate a cold key. Poor aging can keep old history alive too long or erase useful evidence too quickly. A workload shift can make yesterday's counts actively misleading until the sample catches up.",
        "W-TinyLFU also does not solve capacity measurement, freshness, or durability. A byte-sized cache should not treat a 4 KB value and a 40 MB value as equal just because they are both one entry. A cache with TTLs, invalidation, write-back behavior, or stale-read risk needs those rules around the admission policy.",
        "The safest way to adopt it is trace replay. Compare pure LRU, the candidate W-TinyLFU configuration, and any size-aware variant on the same request stream. Then inspect rejected keys, admitted keys, byte hit rate, miss cost, and latency rather than trusting a single aggregate hit-rate number.",
      ],
    },
    {
      heading: "Study next",
      paragraphs: [
        "Primary sources: TinyLFU at https://arxiv.org/abs/1512.00727 and Caffeine Efficiency notes at https://github.com/ben-manes/caffeine/wiki/Efficiency. Read them with one question in mind: what evidence should a newcomer present before evicting a resident?",
        "Study LRU Cache first for the baseline. Then study Count-Min Sketch and Conservative Count-Min Sketch for approximate frequency, Bloom Filter for compact negative evidence, Modern Cache Eviction for SIEVE and S3-FIFO, Cache Invalidation for freshness, and Tail Latency for the user-visible cost of bad misses.",
      ],
    },
  ],
};
