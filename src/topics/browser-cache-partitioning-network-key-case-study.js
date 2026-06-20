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
      heading: 'Why it exists',
      paragraphs: [
        {type:'callout', text:'Cache partitioning makes the cache key answer a privacy question: who is allowed to observe this hit? A miss under another site context is the feature, not a regression.'},
        'Browser cache partitioning exists because a cache is a memory system, and memory can leak information even when the bytes are protected. A website usually cannot read the response body of another site, but it may be able to measure whether loading a known URL is unusually fast. If the speed difference reveals that some other top-level site already warmed the resource, the cache has become a cross-site side channel.',
        'The old performance intuition was simple: the same URL should reuse the same browser-local cache entry. That gave public CDNs a strong advantage because one site could warm a library and another site could reuse it. The privacy problem is that reuse also created observable shared state. A fast request for a rare script, avatar URL, tracking pixel, font, or account-specific image can reveal a bit of browsing history or user state.',
        'Partitioning changes the trust boundary. The browser still caches. It still uses freshness, validators, Vary, and revalidation. The difference is that the lookup is scoped by site context before the ordinary HTTP cache key is considered. A resource fetched while visiting one top-level site should not automatically become a browser-local hit while visiting an unrelated top-level site.',
      ],
    },
    {
      heading: 'Why the obvious key fails',
      paragraphs: [
        'The obvious key for an HTTP cache is request identity: method, URL, selected headers, freshness metadata, validators, and the dimensions named by Vary. Under that representation, shop.example and news.example embedding the same CDN script can share one local browser entry if the response permits caching. That is efficient, but it answers the wrong question.',
        'The safer question is not merely "has this browser seen this URL?" It is "has this browser seen this URL in this site context?" The attack does not need same-origin read access. It only needs a measurable difference between a warm local hit and a cold network path. Once timing reveals a cache hit across site boundaries, the cache key has become too broad.',
        'Adding random delays is not a good primary fix. Timing defenses are hard because the network itself is noisy, attackers can repeat probes, and browsers need consistent performance. The robust data-structure fix is key separation: make the state the attacker wants to observe live under a different key.',
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        'Cache partitioning is a key-prefix change. The browser derives a partition key from site context, then performs the ordinary cache lookup inside that partition. Chrome documentation for HTTP cache partitioning describes a Network Isolation Key that includes the top-level site and current-frame site in addition to the resource URL. Other forms of browser state can use related partitioning rules, but the core idea is the same: site context becomes part of the lookup boundary.',
        'The data-structure shape is nested: partition key, then HTTP cache key, then response metadata. The inner key still includes URL and the normal HTTP caching dimensions. Vary still selects representations. Cache-Control still decides freshness. ETag and Last-Modified still support validation. No-Vary-Search can still affect query handling where supported. Partitioning does not replace HTTP caching; it wraps it with a privacy boundary.',
        'The same idea can apply beyond the HTTP cache. DNS results, connection pools, preflight caches, storage, service worker state, and other network or browser-local state can expose cross-site observations if they are shared too broadly. The design question is always the same: who should be allowed to observe this state? That observer belongs in the key.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is simple: a lookup under one top-level site should not reveal whether another unrelated top-level site warmed the same browser-local network state. The lookup can reveal state inside its own partition because that is part of ordinary browsing. It should not reveal state across the partition boundary.',
        'The proof idea is key non-aliasing. If a victim request writes an entry under (shop.example, vendor.example, widget.js), an attacker request under news.example looks for (news.example, vendor.example, widget.js). Those are different keys. A hit in the attacker partition proves only attacker-partition history. The cross-site bit disappears because the two requests no longer alias to the same local cell.',
        'This is a precise privacy gain, not a general anonymity promise. Servers still see requests. Timing can still reveal same-partition state. First-party caches still work. The improvement is that unrelated site contexts stop sharing one browser-local answer to the question "is this object already here?"',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user visits shop.example, which embeds https://cdn.vendor.example/widget.js in a vendor frame. The response is cacheable for a day. Under a partitioned cache, the browser stores it under a key shaped like (top-level site = shop.example, frame site = vendor.example, URL = widget.js), plus the normal HTTP dimensions. The resource can be reused later while the user is still in the same relevant site context.',
        'Later the user visits news.example, which embeds the same widget URL. Without partitioning, news.example might observe an immediate local hit and infer that some earlier page already loaded the widget. With partitioning, the browser looks under (news.example, vendor.example, widget.js). That entry is empty until news.example warms it. The CDN edge may still have the object and deliver it quickly, but the browser-local signal from shop.example is not reused.',
        'The same example explains the performance cost. The browser may store two local copies of an identical URL under two top-level sites. That costs disk space and bandwidth. It is still the intended behavior because the second copy buys isolation. The system spends some reuse to remove a cross-site observation channel.',
      ],
    },
    {
      heading: 'Visual model',
      paragraphs: [
        'The double-key cache view shows the important structural change: the resource node is still the same URL, but key A and key B lead to different cache cells. In the shared-cache version, both top-level sites can collide on a URL-only entry. In the partitioned version, top-level site and frame site are part of the path before the browser reaches the ordinary cache key.',
        'The privacy tradeoff plot shows the product decision. More partition depth means fewer cross-site observations, but it also means less browser-local reuse across unrelated sites. The matrix frames apply the same key-prefix idea to several state types. HTTP cache, DNS, connection pools, preflight caches, and service-worker-controlled caches each need their own exact platform rules, but the recurring pattern is to put the observing context into the key.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'This matters anywhere a web page can probe a resource that another site might have loaded. Public CDNs, third-party widgets, fonts, avatars, images, pixels, preflight responses, DNS entries, and connection reuse can all become sensors if the browser shares state across unrelated contexts. Partitioning is part of the same privacy direction as storage partitioning and third-party cookie restrictions: embedded code should not automatically receive one shared ambient state bucket across the web.',
        'For performance engineers, the operational change is that browser-local reuse becomes mostly first-party or same-partition reuse. Public CDNs still help through edge proximity, origin shielding, TLS termination, and global delivery, but they no longer guarantee a warm local browser entry across customers. A vendor serving a third-party widget should budget each top-level customer site as its own warmup population.',
        'For security engineers, the useful mental model is threat surface reduction. Cache partitioning does not need to identify every possible probe URL. It removes an entire class of aliasing by making unrelated contexts miss each other in the local map.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'Partitioning has limits. It does not hide requests from servers. It does not make URLs secret. It does not remove timing differences inside one partition. It does not fix bad Cache-Control settings, incorrect Vary headers, overbroad service worker behavior, or application-level identity leaks. The narrower claim is that one unrelated partition should not get a local browser hit because another unrelated partition warmed the object.',
        'The exact key shape is browser-specific and can change as privacy models evolve. Engineers should treat documentation as the platform contract and verify behavior in the browsers that matter for their product. A cache audit that checks only one browser or one state type can miss important differences in HTTP cache, preflight cache, DNS cache, service workers, and connection reuse.',
        'Partitioning can also create false performance conclusions. A CDN log may show an edge hit while the browser reports a local miss. A real-user metric may show extra requests after a browser update. A synthetic test that reuses one top-level site may not represent a third-party embed across many customer sites. Separate browser cache, edge cache, origin cache, and service worker cache in the measurements.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Build metrics that distinguish the layers. Browser cache hit, service worker cache hit, CDN edge hit, origin hit, preflight reuse, DNS lookup, connection reuse, and transfer size are different signals. Segment browser-local cache metrics by top-level site when debugging third-party assets. A global hit rate can hide the fact that every customer site is warming its own partition.',
        'Design delivery for first-party friendliness. Self-host critical assets when that improves locality and control. Preload only resources that are actually critical. Avoid excessive third-party bundles whose cold-start cost repeats across top-level sites. Use Cache-Control, validators, compression, and immutable asset names correctly within each partition. Do not try to bypass the privacy boundary by creating new probes or covert shared state.',
        'When investigating regressions, compare before and after under the same top-level site, then across different top-level sites. Use DevTools and resource timing carefully, and verify with real browsers rather than assuming one abstract cache. If a third-party widget becomes slower after partitioning, the likely repair is packaging, preload strategy, size reduction, or first-party deployment, not weakening isolation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources for this topic are Chrome HTTP cache partitioning at https://developer.chrome.com/blog/http-cache-partitioning, MDN State Partitioning at https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning, PrivacyCG storage partitioning notes at https://github.com/privacycg/storage-partitioning, and XS-Leaks partitioned HTTP cache guidance at https://xsleaks.dev/docs/defenses/secure-defaults/partitioned-cache/.',
        'Study next: HTTP Vary Cache-Key Normalization for the inner representation key, No-Vary-Search Query Key for query canonicalization, Cache-Status HTTP Observability for measuring misses, CORS Preflight Cache for another partition-sensitive cache, Storage Access API Third-Party Cookie Gate for related storage boundaries, Service Workers and Cache Storage Versioned Precache for app-controlled caches, Resource Hints Preload Preconnect for warmup strategy, and Data Leakage for the threat-model lens.',
      ],
    },
  ],
};
