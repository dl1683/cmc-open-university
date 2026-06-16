// Browser cache partitioning: add top-level and frame-site context to network
// caches so cross-site timing probes cannot freely observe shared cache state.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'browser-cache-partitioning-network-key-case-study',
  title: 'Browser Cache Partitioning Network Key',
  category: 'Security',
  summary: 'How browser network-state partition keys trade shared-cache reuse for privacy by separating HTTP cache, DNS, and connections by site context.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['double key cache', 'privacy tradeoff'], defaultValue: 'double key cache' },
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

function partitionGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'topA', label: 'top A', x: 0.8, y: 6.0, note: notes.topA ?? 'site A' },
      { id: 'topB', label: 'top B', x: 0.8, y: 3.2, note: notes.topB ?? 'site B' },
      { id: 'frame', label: 'frame', x: 2.6, y: 4.6, note: notes.frame ?? 'embed' },
      { id: 'res', label: 'res', x: 4.2, y: 4.6, note: notes.res ?? 'cdn.js' },
      { id: 'keyA', label: 'key A', x: 5.9, y: 6.0, note: notes.keyA ?? 'A|res' },
      { id: 'keyB', label: 'key B', x: 5.9, y: 3.2, note: notes.keyB ?? 'B|res' },
      { id: 'cacheA', label: 'cache A', x: 7.7, y: 6.0, note: notes.cacheA ?? 'entry' },
      { id: 'cacheB', label: 'cache B', x: 7.7, y: 3.2, note: notes.cacheB ?? 'empty' },
      { id: 'probe', label: 'probe', x: 9.3, y: 4.6, note: notes.probe ?? 'timing' },
    ],
    edges: [
      { id: 'e-topA-frame', from: 'topA', to: 'frame', weight: '' },
      { id: 'e-topB-frame', from: 'topB', to: 'frame', weight: '' },
      { id: 'e-frame-res', from: 'frame', to: 'res', weight: '' },
      { id: 'e-res-keyA', from: 'res', to: 'keyA', weight: '' },
      { id: 'e-res-keyB', from: 'res', to: 'keyB', weight: '' },
      { id: 'e-keyA-cacheA', from: 'keyA', to: 'cacheA', weight: '' },
      { id: 'e-keyB-cacheB', from: 'keyB', to: 'cacheB', weight: '' },
      { id: 'e-cacheA-probe', from: 'cacheA', to: 'probe', weight: '' },
      { id: 'e-cacheB-probe', from: 'cacheB', to: 'probe', weight: '' },
    ],
  }, { title });
}

function tradeoffPlot() {
  return plotState({
    axes: { x: { label: 'partition depth', min: 0, max: 3 }, y: { label: 'score', min: 0, max: 100 } },
    series: [
      { id: 'privacy', label: 'privacy', points: [{ x: 0, y: 25 }, { x: 1, y: 58 }, { x: 2, y: 82 }, { x: 3, y: 90 }] },
      { id: 'reuse', label: 'reuse', points: [{ x: 0, y: 90 }, { x: 1, y: 72 }, { x: 2, y: 55 }, { x: 3, y: 44 }] },
    ],
    markers: [
      { id: 'old', x: 0, y: 90, label: 'shared' },
      { id: 'new', x: 2, y: 82, label: 'keyed' },
    ],
  }, { title: 'Partitioning raises privacy and lowers cross-site reuse' });
}

function* doubleKeyCache() {
  yield {
    state: partitionGraph('A shared browser cache lets sites observe one another indirectly', { keyA: 'URL only', keyB: 'URL only', cacheB: 'same entry', probe: 'fast?' }),
    highlight: { active: ['topA', 'topB', 'res', 'cacheA', 'cacheB', 'probe'], compare: ['keyA', 'keyB'] },
    explanation: 'Historically, a resource cached while visiting one site could sometimes speed up the same URL when embedded by another site. That performance win also creates timing-probe risk.',
    invariant: 'A cross-site cache hit is observable state unless the browser partitions it.',
  };

  yield {
    state: partitionGraph('A timing probe asks whether another site warmed the resource', { topB: 'attacker', cacheA: 'victim hit', probe: 'timing leak' }),
    highlight: { active: ['topB', 'frame', 'res', 'probe', 'e-topB-frame', 'e-frame-res'], compare: ['cacheA'] },
    explanation: 'An attacker does not need to read cached bytes. If loading a known URL is faster only when another site already fetched it, timing can leak cross-site state.',
  };

  yield {
    state: partitionGraph('Partitioning adds site context to the cache key', { keyA: 'A|frame|URL', keyB: 'B|frame|URL', cacheA: 'entry', cacheB: 'miss' }),
    highlight: { active: ['topA', 'topB', 'keyA', 'keyB', 'cacheA', 'cacheB', 'e-res-keyA', 'e-res-keyB'], removed: ['probe'] },
    explanation: 'Modern browsers partition network state. Chrome describes HTTP cache partitioning with a Network Isolation Key composed from top-level site and current-frame site, in addition to the resource URL.',
  };

  yield {
    state: partitionGraph('The same CDN asset becomes two entries under two top-level sites', { res: 'lib.js', keyA: 'A|lib', keyB: 'B|lib', cacheA: 'hit', cacheB: 'miss' }),
    highlight: { found: ['cacheA'], active: ['cacheB', 'keyB', 'e-keyB-cacheB'], compare: ['cacheA', 'keyA'] },
    explanation: 'The browser may fetch the same CDN JavaScript once for site A and again for site B. That costs reuse, but site B no longer learns that site A loaded the resource.',
  };

  yield {
    state: labelMatrix(
      'Partitioned state',
      [
        { id: 'http', label: 'HTTP cache' },
        { id: 'dns', label: 'DNS' },
        { id: 'conn', label: 'conn pool' },
        { id: 'pre', label: 'preflight' },
        { id: 'sw', label: 'SW cache' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'trade', label: 'trade' },
      ],
      [
        ['site+URL', 'less reuse'],
        ['site+name', 'more lookup'],
        ['site+origin', 'more setup'],
        ['site+shape', 'more OPTIONS'],
        ['top site', 'privacy'],
      ],
    ),
    highlight: { found: ['http:key', 'dns:key', 'pre:key'], compare: ['http:trade', 'conn:trade'] },
    explanation: 'The complete data-structure idea is adding a partition key in front of existing keys. The cache still has URL, Vary, freshness, and validators; it now also has site context.',
  };
}

function* privacyTradeoff() {
  yield {
    state: tradeoffPlot(),
    highlight: { found: ['privacy', 'new'], removed: ['reuse'], compare: ['old'] },
    explanation: 'Partitioning intentionally moves along a trade-off curve. It reduces cross-site side channels and tracking surfaces, while lowering the old shared-CDN warm-cache benefit.',
    invariant: 'The performance regression is not accidental; it buys privacy isolation.',
  };

  yield {
    state: labelMatrix(
      'Mitigations',
      [
        { id: 'host', label: 'self host' },
        { id: 'preload', label: 'preload' },
        { id: 'bundle', label: 'bundle' },
        { id: 'cdn', label: 'CDN' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['1p cache', 'ops'],
        ['warm path', 'bandwidth'],
        ['fewer reqs', 'size'],
        ['edge hit', 'no xsite'],
      ],
    ),
    highlight: { found: ['host:helps', 'preload:helps', 'cdn:helps'], compare: ['bundle:cost'] },
    explanation: 'The web-performance answer changes: shared public CDNs still help at the edge, but browser reuse is mostly first-party. Measure first-party cache hits, preload critical assets, and avoid assuming cross-site warmth.',
  };

  yield {
    state: partitionGraph('Partitioning works with Vary inside each partition', { keyA: 'A|URL|br', keyB: 'B|URL|br', res: 'Vary AE', cacheA: 'br hit', cacheB: 'br miss' }),
    highlight: { active: ['keyA', 'keyB', 'cacheA', 'cacheB'], found: ['res'], compare: ['probe'] },
    explanation: 'Partitioning does not replace HTTP Vary. It wraps the existing cache key: partition key first, then URL, then Vary-selected request dimensions and freshness metadata.',
  };

  yield {
    state: partitionGraph('Embedded third-party state is separated by top-level site', { frame: '3p widget', keyA: 'shop|3p', keyB: 'news|3p', cacheA: 'shop', cacheB: 'news' }),
    highlight: { active: ['topA', 'topB', 'frame', 'keyA', 'keyB', 'cacheA', 'cacheB'], removed: ['probe'] },
    explanation: 'This is the same privacy direction as partitioned storage and third-party cookie changes. Embedded content may need explicit storage access for unpartitioned state, but network caches stay isolated by site context.',
  };

  yield {
    state: labelMatrix(
      'Engineering audit',
      [
        { id: 'metric', label: 'metrics' },
        { id: 'assets', label: 'assets' },
        { id: 'embed', label: 'embeds' },
        { id: 'debug', label: 'debug' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'tool', label: 'tool' },
      ],
      [
        ['hit by site', 'logs'],
        ['1p reuse?', 'Cache-Stat'],
        ['3p cost?', 'RUM'],
        ['which key?', 'DevTools'],
      ],
    ),
    highlight: { found: ['metric:tool', 'assets:ask', 'embed:ask'], compare: ['debug:tool'] },
    explanation: 'The complete case study is a shared widget served from a CDN. After cache partitioning, each top-level customer site warms its own browser cache. The fix is not to disable privacy; it is to measure per-site hits and design first-party-friendly delivery.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'double key cache') yield* doubleKeyCache();
  else if (view === 'privacy tradeoff') yield* privacyTradeoff();
  else throw new InputError('Pick a browser cache partitioning view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Browser cache partitioning adds site context to network cache keys. A resource URL is no longer enough to identify a reusable browser-cache entry across unrelated top-level sites. This reduces cross-site timing leaks and tracking surfaces that depend on shared cache state.',
        'Chrome describes HTTP cache partitioning as adding a Network Isolation Key composed of top-level site and current-frame site to the resource URL: https://developer.chrome.com/blog/http-cache-partitioning. MDN State Partitioning describes partitioning storage and related browser state by top-level site: https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The structure is a prefixed key. Before partitioning, a browser HTTP cache key might be URL plus method plus Vary-selected headers. After partitioning, the browser also includes top-level site, frame site, or a related network partition key before those existing dimensions.',
        'Partitioning applies beyond one HTTP cache entry. Modern privacy work discusses partitioning HTTP cache, DNS cache, connection pools, preflight cache, service-worker-related state, and other network state. The exact key shape varies by browser and evolves over time.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A widget vendor serves https://cdn.vendor.example/widget.js to two customers: shop.example and news.example. In an old shared-cache model, a user who visited shop.example could later load news.example and get a browser-cache hit for the same widget URL. That saved bytes but also made cross-site cache probing possible.',
        'With cache partitioning, shop.example and news.example get separate browser cache entries for the same CDN URL. The CDN edge cache can still be globally effective, but browser-local reuse is scoped to site context. The vendor measures per-site hit rate, adds first-party preload where needed, and stops promising shared-CDN browser warmth.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Partitioning does not make HTTP caching irrelevant. It changes the boundary of reuse. Within a partition, Cache-Control, ETag, Vary, No-Vary-Search, and Service Worker Cache Storage still matter.',
        'It also does not mean every browser has the same key shape. Chrome, Firefox, and Safari have shipped or discussed different partitioning strategies. Treat this as a privacy architecture trend and verify the behavior in the browsers you support.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Chrome HTTP cache partitioning at https://developer.chrome.com/blog/http-cache-partitioning, MDN State Partitioning at https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning, PrivacyCG storage partitioning notes at https://github.com/privacycg/storage-partitioning, and XS-Leaks partitioned HTTP cache guidance at https://xsleaks.dev/docs/defenses/secure-defaults/partitioned-cache/.',
        'Study next: HTTP Vary Cache-Key Normalization for the inner representation key, No-Vary-Search Query Key for query canonicalization, Cache-Status HTTP Observability for measuring misses, CORS Preflight Cache and Storage Access API Third-Party Cookie Gate for related browser privacy boundaries, Service Workers & Offline-First and Cache Storage Versioned Precache for partitioned app-controlled caches, and Data Leakage for the threat-model lens.',
      ],
    },
  ],
};
