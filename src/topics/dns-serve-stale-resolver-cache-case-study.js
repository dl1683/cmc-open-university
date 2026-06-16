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
      heading: 'What it is',
      paragraphs: [
        'DNS serve-stale lets a recursive resolver answer with expired positive DNS data when it cannot refresh the RRset from authoritative nameservers. The goal is resilience during authoritative outages, denial-of-service events, or transient resolver-to-authority network failures.',
        'RFC 8767 defines serving stale data to improve DNS resiliency: https://www.rfc-editor.org/rfc/rfc8767. It updates the practical interpretation of DNS TTLs by allowing explicitly bounded stale use when fresh refresh cannot be completed.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'A normal resolver cache stores owner name, type, class, RRset, TTL, insertion time, authority metadata, and validation state. Serve-stale adds retention after TTL expiry, maximum-stale deadline, retry schedule, response timer, and flags that decide whether a stale answer class is eligible.',
        'The policy is different from DNS Negative Cache & NXDOMAIN. Negative caching stores authoritative absence. Serve-stale usually protects recently valid positive data. Both are resolver-cache policies, but they answer different questions: "is absence reusable?" versus "is old positive data better than failure?"',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An internal service discovery domain recently resolved api.service.example to a healthy address with a 60 second TTL. During a control-plane outage, the authoritative nameservers time out. A serve-stale resolver waits briefly, returns the expired positive RRset with a small TTL, schedules jittered refresh retries, and increments stale-answer metrics.',
        'When authority recovers, the resolver refreshes the RRset and stops serving stale. If the outage exceeds the maximum-stale budget, the resolver stops hiding the failure. That boundary is what keeps serve-stale from becoming stale-forever DNS.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Serve-stale is not a blanket permission to ignore TTLs. It should have a client response timer, retry backoff, maximum-stale budget, and observability. Otherwise an expired answer can conceal a real migration, failover, or security change.',
        'Be cautious with negative answers, DNSSEC validation failures, and records used for issuance or authorization such as ACME TXT challenges. Stale availability is useful only when the old answer is safer than an immediate error.',
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
