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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'Cache partitioning makes the cache key answer a privacy question: who is allowed to observe this hit? A miss under another site context is the feature, not a regression.'},
        'Read the graph as a lookup path. A top-level site is the site shown in the browser address bar; a frame site is the site of the frame making the request; a resource URL is the network address being fetched. Active nodes show the request context, compare nodes show two possible cache keys, and found nodes show the cache cell the browser is allowed to use.',
        'The safe inference rule is key separation. If site A stores cdn.example/lib.js under an A-scoped key, a request from site B must look under a B-scoped key. A hit under B proves only B-context history, not A-context history.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browser cache partitioning exists because a cache is memory, and shared memory can leak facts even when response bodies are protected. A web page usually cannot read another site response, but it may measure whether a known URL loads like a warm cache hit. That timing difference can reveal browsing history, account state, or cross-site tracking information.',
        'The old performance goal was broad reuse. If many sites embedded the same font, script, or image, one browser-local copy could serve all of them. That saved bandwidth and latency, but it also meant unrelated sites shared one observable cache cell.',
        'Partitioning changes the boundary. The browser still uses HTTP freshness, validators, Vary, and revalidation. It adds site context before the normal resource key so unrelated top-level sites stop seeing each other through browser-local cache hits.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious cache key is the resource identity: URL plus the request dimensions selected by HTTP caching rules. That key is simple, fast, and good for reuse. It is also too wide for privacy because two unrelated sites can collide on the same local entry.',
        'A timing defense that only adds noise is weak. Attackers can repeat probes, average measurements, and choose resources with large warm-versus-cold gaps. A structural fix is better: make the state live under a different key so the probe no longer reaches it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is aliasing. Aliasing means two different logical contexts point at the same storage cell. In a shared HTTP cache, shop.example and news.example can both ask whether cdn.vendor.example/widget.js is warm, even though one site should not learn what happened under the other.',
        'The wall also appears in performance measurement. After partitioning, a CDN edge may still hit while the browser cache misses, so a single hit-rate number becomes misleading. Browser cache, service worker cache, CDN edge cache, origin shield, and origin response are different layers.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Add the observer to the key. A partition key is a prefix derived from site context, and the ordinary HTTP cache key sits inside that partition. In Chrome HTTP cache partitioning, the Network Isolation Key includes the top-level site and the current-frame site in addition to the resource URL.',
        'The data structure is a nested map: partition key, then URL and Vary-selected request dimensions, then response metadata. Partitioning does not replace Cache-Control, ETag, Last-Modified, or Vary. It makes those mechanisms operate inside a privacy boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a request arrives, the browser first derives the relevant site context. A first-party image on a.example and a third-party frame on a.example do not necessarily get the same partition as the same URL requested under b.example. The browser then performs the normal HTTP cache lookup inside that partition.',
        'A cacheable response stores body bytes, freshness metadata, validators, and variant information under the full key. Later requests in the same partition can reuse it while fresh or revalidate it when stale. Requests in a different partition start with a miss even if the URL text is identical.',
        'The same key-prefix idea can apply to other network state. DNS results, connection pools, CORS preflight caches, service worker state, and storage can expose cross-site observations if shared too broadly. Each platform feature has its own exact rules, but the principle is the same.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is non-aliasing. Suppose a victim visit stores widget.js under key (shop.example, vendor.example, widget.js). An attacker page under news.example asks for the same URL, but the lookup key is (news.example, vendor.example, widget.js). Those keys are unequal, so the attacker cannot receive a local hit created by the victim context.',
        'The guarantee is narrow. Servers still observe network requests, and same-partition timing can still matter. The win is that unrelated site contexts no longer share one browser-local answer to the question, "was this object already here?"',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is lower reuse. If 100 customer sites embed a 200 KB widget, a shared browser cache might store one local copy after the first visit, while a partitioned cache may warm one copy per top-level site. That is extra disk and sometimes extra network traffic.',
        'When the number of top-level sites doubles, the worst-case number of browser-local warmups for a third-party asset also doubles. CDN edge caching still helps because the second browser miss may hit a nearby edge. The lost behavior is cross-site browser reuse, not all caching.',
        'Operationally, partitioning adds measurement complexity. Teams need to separate first-party browser hits, third-party partition misses, CDN hits, transfer size, and real-user latency. A global CDN hit ratio cannot explain a browser-local privacy partition.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Browsers use cache partitioning to reduce XS-Leak style timing attacks and cross-site tracking through shared network state. It fits the web privacy model because embedded content should not automatically receive one ambient state bucket across all sites that embed it.',
        'The same lesson applies to product architecture. Multi-tenant systems often need tenant, user, region, or security context in the cache key. A cache is correct only when every caller mapped to the same entry is allowed to observe that entry.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Partitioning fails as an all-purpose privacy claim. It does not hide the request from the server, protect a badly keyed service worker cache, repair overbroad cookies, or prevent timing leaks inside the same partition. It fixes one class of shared-state aliasing.',
        'It can also fail through stale assumptions. The exact key shape differs across browsers and changes over time. Engineers should verify behavior in the browsers they support and avoid designing performance guarantees around cross-site browser warmth.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user visits shop.example, which embeds https://cdn.vendor.example/widget.js in a vendor frame. The browser stores a 200 KB response under a key like (shop.example, vendor.example, widget.js). A later shop.example page can reuse the response because it asks the same partitioned question.',
        'The user then visits news.example, which embeds the same widget. Without partitioning, a 5 ms local cache hit instead of a 120 ms network path could reveal that another site warmed the object. With partitioning, the lookup is (news.example, vendor.example, widget.js), so it misses and warms its own 200 KB entry.',
        'The cost is concrete. If 50 unrelated top-level sites each embed the widget, the browser may store up to 50 partitioned entries, or about 10 MB before eviction. The behavior buys privacy by spending local reuse only where the contexts are not allowed to observe each other.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Chrome HTTP cache partitioning at https://developer.chrome.com/blog/http-cache-partitioning, the Fetch standard HTTP cache partition model at https://fetch.spec.whatwg.org/, MDN state partitioning at https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning, and XS-Leaks partitioned cache guidance at https://xsleaks.dev/docs/defenses/secure-defaults/partitioned-cache/.',
        'Study HTTP Vary Cache-Key Normalization next for the inner key, CORS Preflight Cache for another partition-sensitive cache, Service Workers and Cache Storage Versioned Precache for application-managed state, and Cache-Status HTTP Observability for measuring the layers separately.',
      ],
    },
  ],
};
