// DNS serve-stale resolver cache: keep expired positive RRsets around long
// enough to answer during authoritative outages, then refresh with bounded
// retry and maximum-stale timers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'dns-serve-stale-resolver-cache-case-study',
  title: 'DNS Serve-Stale Resolver Cache',
  category: 'Systems',
  summary: 'How recursive resolvers retain expired DNS RRsets and serve bounded stale answers when authoritative nameservers cannot refresh them.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['authority outage', 'timer policy'], defaultValue: 'authority outage' },
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

function dnsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 4.7, note: notes.client ?? 'query' },
      { id: 'res', label: 'rslv', x: 2.4, y: 4.7, note: notes.res ?? 'cache' },
      { id: 'fresh', label: 'fresh', x: 4.0, y: 6.3, note: notes.fresh ?? 'TTL ok' },
      { id: 'stale', label: 'stale', x: 4.0, y: 3.0, note: notes.stale ?? 'expired' },
      { id: 'timer', label: 'timer', x: 5.8, y: 4.7, note: notes.timer ?? 'budget' },
      { id: 'auth', label: 'auth', x: 7.4, y: 4.7, note: notes.auth ?? 'zone' },
      { id: 'retry', label: 'retry', x: 8.9, y: 6.3, note: notes.retry ?? 'backoff' },
      { id: 'ans', label: 'ans', x: 8.9, y: 3.0, note: notes.ans ?? 'A/AAAA' },
    ],
    edges: [
      { id: 'e-client-res', from: 'client', to: 'res', weight: '' },
      { id: 'e-res-fresh', from: 'res', to: 'fresh', weight: '' },
      { id: 'e-res-stale', from: 'res', to: 'stale', weight: '' },
      { id: 'e-stale-timer', from: 'stale', to: 'timer', weight: '' },
      { id: 'e-timer-auth', from: 'timer', to: 'auth', weight: '' },
      { id: 'e-auth-retry', from: 'auth', to: 'retry', weight: '' },
      { id: 'e-auth-ans', from: 'auth', to: 'ans', weight: '' },
      { id: 'e-stale-ans', from: 'stale', to: 'ans', weight: '' },
    ],
  }, { title });
}

function stalePlot() {
  return plotState({
    axes: { x: { label: 'outage min', min: 0, max: 10 }, y: { label: 'answered %', min: 0, max: 105 } },
    series: [
      {
        id: 'nostale',
        label: 'no stale',
        points: [
          { x: 0, y: 100 },
          { x: 1, y: 20 },
          { x: 2, y: 0 },
          { x: 5, y: 0 },
          { x: 10, y: 0 },
        ],
      },
      {
        id: 'servestale',
        label: 'serve stale',
        points: [
          { x: 0, y: 100 },
          { x: 1, y: 98 },
          { x: 2, y: 97 },
          { x: 5, y: 92 },
          { x: 10, y: 65 },
        ],
      },
    ],
    markers: [
      { id: 'start', x: 1, y: 98, label: 'use old' },
      { id: 'limit', x: 10, y: 65, label: 'max stale' },
    ],
  }, { title: 'Stale data preserves availability during outage' });
}

function* authorityOutage() {
  yield {
    state: dnsGraph('A positive DNS answer is cached while its TTL is fresh', { fresh: 'api A', stale: 'empty', auth: 'healthy', ans: '203.0.113' }),
    highlight: { active: ['client', 'res', 'fresh', 'ans', 'e-client-res', 'e-res-fresh'], compare: ['stale'] },
    explanation: 'A resolver receives a normal positive RRset such as api.example.com A 203.0.113.10. Until TTL expiry, answering from cache is ordinary DNS behavior.',
    invariant: 'Serve-stale starts as normal positive caching; the difference is what survives after TTL expiry.',
  };

  yield {
    state: dnsGraph('TTL expires, but the resolver retains the old RRset', { fresh: 'expired', stale: 'api A old', timer: 'eligible' }),
    highlight: { active: ['res', 'fresh', 'stale', 'timer', 'e-res-fresh', 'e-res-stale', 'e-stale-timer'], compare: ['auth'] },
    explanation: 'A serve-stale resolver does not immediately discard an expired positive RRset. It keeps it in a stale-eligible pool for a bounded maximum-stale interval.',
  };

  yield {
    state: dnsGraph('Authoritative refresh times out during an outage', { timer: 'wait 1.8s', auth: 'timeout', retry: 'backoff' }),
    highlight: { active: ['timer', 'auth', 'retry', 'e-timer-auth', 'e-auth-retry'], compare: ['ans'] },
    explanation: 'The resolver still tries to refresh from the authoritative path. If that path fails within the configured client response budget, stale data can keep users moving.',
  };

  yield {
    state: dnsGraph('The resolver serves the expired RRset with a tiny TTL', { stale: 'old A', ans: 'stale A', timer: 'bounded' }),
    highlight: { found: ['client', 'res', 'stale', 'ans', 'e-client-res', 'e-res-stale', 'e-stale-ans'], removed: ['auth'] },
    explanation: 'The stale answer is not treated as fresh forever. It is a resilience response: serve the last known good data, often with a small TTL, while refresh attempts continue.',
  };

  yield {
    state: dnsGraph('When authority recovers, the cache replaces stale data', { auth: 'healthy', ans: 'new A', stale: 'replace', retry: 'success' }),
    highlight: { active: ['auth', 'ans', 'retry', 'stale', 'e-auth-ans', 'e-auth-retry'], found: ['res'] },
    explanation: 'The complete case is an authoritative outage during a deploy. Serve-stale avoids an application outage for names that recently resolved, then refreshes the RRset after authority returns.',
  };
}

function* timerPolicy() {
  yield {
    state: labelMatrix(
      'Serve-stale timers',
      [
        { id: 'ttl', label: 'orig TTL' },
        { id: 'resp', label: 'resp wait' },
        { id: 'retry', label: 'retry gap' },
        { id: 'max', label: 'max stale' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['fresh end', 'too short'],
        ['client cap', 'late stale'],
        ['backoff', 'hammer auth'],
        ['hard stop', 'old data'],
      ],
    ),
    highlight: { active: ['resp:role', 'retry:role', 'max:role'], compare: ['max:risk'] },
    explanation: 'Serve-stale is governed by timers. The original TTL decides freshness, the response timer limits client waiting, retry cadence protects authority, and maximum stale bounds correctness risk.',
    invariant: 'The policy is useful only because every stale path has a deadline.',
  };

  yield {
    state: stalePlot(),
    highlight: { found: ['servestale'], removed: ['nostale'], active: ['start'], compare: ['limit'] },
    explanation: 'The availability gain is not from pretending DNS never expires. It is from choosing bounded stale answers over immediate failure while the authoritative path is temporarily unreachable.',
  };

  yield {
    state: labelMatrix(
      'Answer classes',
      [
        { id: 'addr', label: 'A/AAAA' },
        { id: 'mx', label: 'MX' },
        { id: 'txt', label: 'TXT' },
        { id: 'nx', label: 'NXDOMAIN' },
        { id: 'dnssec', label: 'DNSSEC bad' },
      ],
      [
        { id: 'stale', label: 'stale?' },
        { id: 'care', label: 'care' },
      ],
      [
        ['yes', 'routes'],
        ['maybe', 'mail path'],
        ['maybe', 'ACME risk'],
        ['careful', 'new names'],
        ['no', 'security'],
      ],
    ),
    highlight: { found: ['addr:stale'], compare: ['txt:care', 'nx:care'], removed: ['dnssec:stale'] },
    explanation: 'Not every answer type has the same blast radius. Positive address answers are common candidates. Negative answers and DNSSEC failures need stricter treatment because they can hide newly added names or security changes.',
  };

  yield {
    state: dnsGraph('Serve-stale is paired with backoff and observability', { timer: 'policy', auth: 'fail rate', retry: 'jitter', ans: 'metrics' }),
    highlight: { active: ['timer', 'auth', 'retry', 'ans', 'e-timer-auth', 'e-auth-retry', 'e-auth-ans'], compare: ['stale'] },
    explanation: 'A production resolver watches stale answer counts, refresh failures, retry pressure, and maximum-stale exhaustion. Without metrics, stale service can hide a real authoritative incident.',
  };

  yield {
    state: labelMatrix(
      'Runbook',
      [
        { id: 'enable', label: 'enable' },
        { id: 'bound', label: 'bound' },
        { id: 'refresh', label: 'refresh' },
        { id: 'alert', label: 'alert' },
      ],
      [
        { id: 'do', label: 'do' },
        { id: 'why', label: 'why' },
      ],
      [
        ['opt-in', 'policy'],
        ['max stale', 'correct'],
        ['jitter', 'protect'],
        ['stale rate', 'detect'],
      ],
    ),
    highlight: { found: ['bound:do', 'refresh:do', 'alert:do'], compare: ['enable:why'] },
    explanation: 'The complete runbook treats stale DNS as a circuit breaker for name resolution: explicitly enable it, bound it, refresh with jittered retries, and alert when stale answers appear.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'authority outage') yield* authorityOutage();
  else if (view === 'timer policy') yield* timerPolicy();
  else throw new InputError('Pick a DNS serve-stale view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'DNS TTLs are freshness contracts, but real authoritative paths fail. Nameservers time out, networks partition, DDoS attacks hit authority, and service-discovery control planes have outages. If a resolver discards an expired positive RRset at the exact moment authority is unreachable, users can lose a working service even though the last known answer is probably still useful.',
        'Serve-stale exists to choose bounded old data over immediate failure during a refresh outage. It is a resolver resilience policy, not a claim that TTLs stopped mattering.',
        {type: 'callout', text: 'Serve-stale keeps availability by treating expired positive answers as deadline-limited fallbacks, not as fresh truth.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The strict cache approach is to delete or ignore a positive RRset as soon as its TTL expires. If refresh succeeds, the resolver returns fresh data. If refresh fails, the resolver returns failure. That is simple and respects freshness.',
        'The other naive approach is to keep old data forever. That improves availability during outages, but it can route users to retired addresses, hide migrations, and ignore security-sensitive changes. The useful design must preserve a hard boundary around stale use.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A serve-stale cache keeps two states for a positive RRset: fresh until the original TTL ends, then stale-eligible until a maximum-stale deadline. Refresh still happens. The stale answer is used only when fresh authority cannot be reached within the resolver policy.',
        'The key invariant is that every stale path has a deadline. A response timer caps how long the client waits, retry backoff protects authority, and maximum-stale prevents an old answer from becoming permanent truth.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the authority-outage view, watch the resolver choose between waiting, refreshing, failing, and serving the last known good answer. The stale answer is not fresh truth; it is a bounded fallback when the authoritative path cannot answer inside the response budget.",
        "In the timer-policy view, read each timer as a different safety boundary. TTL controls freshness. The client response timer controls how long the resolver waits before answering. Retry timers protect authority from hammering. Maximum-stale prevents old data from becoming permanent truth.",
        "The important state is eligibility. An expired RRset is useful only if it was once valid, still sits inside the stale window, has acceptable validation state, and the resolver has evidence that refresh currently failed.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A resolver cached `api.example.com A 203.0.113.10` with a TTL of 300 seconds. Five minutes later the TTL expires. At the next query, the resolver asks the authoritative nameservers for a fresh answer, but all attempts time out. With serve-stale enabled, it can return the expired address with a very small TTL while it keeps retrying authority in the background.',
        'That answer is better than failure only if the old address is likely still valid. If the service is in the middle of a migration, or if the record controls an ACME challenge or authorization boundary, stale data may be worse than an error. Serve-stale is therefore a policy decision, not a universal DNS shortcut.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A normal resolver cache stores owner name, type, class, RRset, TTL, insertion time, authority metadata, and validation state. Serve-stale adds retention after TTL expiry, maximum-stale deadline, retry schedule, response timer, and eligibility flags for answer classes.',
        'On query, the resolver uses fresh data if TTL remains. If the RRset is expired, it tries to refresh. If refresh times out or fails inside the response budget, the resolver can return the expired RRset with a small TTL, schedule jittered retries, and record stale-answer metrics. When authority recovers, the new RRset replaces the stale one.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Serve-stale is useful because the old RRset was a valid positive answer when cached. During a temporary authority failure, the resolver has evidence that the answer recently worked and no fresh contradictory data is available.',
        'It stays defensible only under bounds. The resolver must keep validation state, stop at maximum-stale, retry authority, and expose metrics. Without those bounds, serve-stale would silently convert a cache into an unbounded source of old data.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The availability gain appears when authority fails after clients have already warmed the cache. A cold cache cannot serve stale data because it has no last known good RRset. A warm cache can keep answering while refresh attempts continue.',
        'The cost is correctness risk. The old address may point at a drained server, a retired load balancer, or an endpoint that should no longer receive traffic. Memory also grows because expired RRsets remain retained until their stale deadlines or eviction policy removes them.',
        'There is also an observability cost. Without metrics, stale serving can make a nameserver outage look like a healthy resolver. Track stale answers, refresh failures, maximum-stale drops, and per-zone retry pressure so resilience does not become blindness.',
      ],
    },
    {
      heading: 'Policy design',
      paragraphs: [
        'A good serve-stale policy distinguishes record classes. Positive address records for ordinary services are often reasonable candidates. Security-sensitive TXT records, fast-changing service-discovery names, validation failures, and negative answers need stricter treatment. The policy should be explicit rather than inherited from one global switch.',
        'Bound the fallback. Set a maximum stale lifetime, return a small TTL on stale answers, keep retrying authority with backoff, and make stale-answer events visible to operators. The design goal is graceful degradation during a temporary authority outage, not a second DNS truth source.',
      ],
    },
    {
      heading: 'Operational playbook',
      paragraphs: [
        'When stale answers appear, operators should ask whether authority is unreachable, validation is failing, or the resolver is overloaded. Those are different incidents. A resolver serving stale data because every authoritative query times out needs network or authority repair. A resolver serving stale data after DNSSEC validation failure may need a stricter fail-closed policy.',
        'The playbook should also name exit conditions. Once fresh authority succeeds, stale answers should disappear. If stale counts stay high, the resolver may be retrying too slowly, authority may still be unhealthy, or clients may be asking for names whose refresh path is broken.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Serve-stale wins during short authoritative outages, resolver-to-authority network failures, DDoS events against nameservers, and service-discovery control-plane incidents. It is strongest for positive address answers whose old value is likely better than failure.',
        'It pairs naturally with alerting. Stale-answer counts, refresh-failure rates, retry pressure, and maximum-stale exhaustion show whether DNS is absorbing a transient problem or hiding a real outage.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Serve-stale fails on cold misses, long outages beyond the maximum-stale budget, and records where old data is dangerous. Negative answers, DNSSEC validation failures, ACME TXT challenges, authorization records, and active migrations need stricter policy.',
        'It is also different from DNS Negative Cache & NXDOMAIN. Negative caching asks whether authoritative absence can be reused. Serve-stale asks whether old positive data is better than a refresh failure. Mixing those policies can hide newly created names or security changes.',
        'It also fails when application owners assume TTL is an instant cutover lever. A stale-capable resolver can continue returning an old positive answer after TTL expiry during an outage. Critical migrations should account for stale policy, staged drains, and monitoring that distinguishes fresh from stale responses.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 8767 Serving Stale Data to Improve DNS Resiliency at https://www.rfc-editor.org/rfc/rfc8767, RFC 2308 DNS Negative Caching at https://www.rfc-editor.org/rfc/rfc2308, RFC 9520 Negative Caching of DNS Resolution Failures at https://www.rfc-editor.org/rfc/rfc9520, and Unbound serve-stale documentation at https://unbound.docs.nlnetlabs.nl/en/latest/topics/core/serve-stale.html. Cloudflare describes operational use of stale DNS cache entries during Consul-backed DNS problems at https://blog.cloudflare.com/the-benefits-of-serving-stale-dns-entries-when-using-consul/.',
        'Study next: How DNS Works for recursive lookup, DNS Negative Cache & NXDOMAIN for absence caching, Cache Invalidation & Versioning for TTL trade-offs, LRU Cache for local eviction, CDN Stale-While-Revalidate Shield for the HTTP-side stale pattern, Circuit Breakers and Tail Latency & p99 Thinking for the resilience framing.',
      ],
    },
  ],
};
