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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a resolver choosing between freshness and availability. A positive RRset is a set of DNS records for one owner name and type, TTL means time to live, and stale means the original TTL has expired. Active state is the refresh attempt, visited state is cached data whose original validity is known, and found state is the answer returned under policy.',
        'The safe inference is conditional: an expired positive answer may be served only when it was once valid, it is still inside a maximum-stale window, and refresh has failed or timed out under resolver policy. Stale is not fresh. It is a bounded fallback.',
        {type: 'callout', text: 'Serve-stale keeps availability by treating expired positive answers as deadline-limited fallbacks, not as fresh truth.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'DNS TTLs let zone owners bound how long resolvers reuse positive answers. Real authoritative paths still fail. Nameservers time out, networks partition, and control planes can be unavailable while the last known address still works.',
        'Serve-stale exists for that outage window. Instead of returning immediate failure after TTL expiry, a resolver can return the last valid answer with a small TTL while it keeps trying to refresh. The goal is graceful degradation, not ignoring DNS changes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The strict approach is to discard or ignore a cached positive RRset when TTL reaches zero. If authority responds, the resolver returns fresh data. If authority fails, the resolver returns failure.',
        'A careless availability shortcut is to keep expired data forever. That can hide migrations, route users to drained servers, and ignore security-sensitive changes. The useful design keeps stale service behind explicit timers and failure evidence.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Strict expiry creates an avoidable outage for warm caches. A resolver may have answered api.example.com successfully for five minutes, then fail users only because authority is unreachable at the refresh moment. The last known good answer may be safer than a blank failure during a short outage.',
        'Unbounded stale data creates the opposite failure. If an address moved from 203.0.113.10 to 203.0.113.20, a resolver that serves the old value for hours can keep traffic on the wrong endpoint. Availability and correctness need separate timers.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Serve-stale adds a second lifetime after TTL expiry. The RRset is fresh until its TTL ends, then stale-eligible until a maximum-stale deadline. The resolver may use it only when refresh cannot produce a fresh answer within the response budget.',
        'The invariant is that stale answers remain bounded and visible. The resolver keeps retrying authority, returns a small TTL on stale answers, and records metrics. If authority recovers, fresh data replaces the stale entry.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The cache stores owner name, type, class, RRset data, original TTL, insertion time, validation state, and stale eligibility. When a query arrives, the resolver first checks whether the RRset is still fresh. If it is fresh, the normal cache path answers.',
        'If the RRset is expired, the resolver starts or joins a refresh attempt. If refresh succeeds inside the policy deadline, the fresh result wins. If refresh times out or fails, and the entry is still inside maximum-stale, the resolver returns the old RRset with a short TTL and schedules more refresh attempts.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument depends on prior validity and bounded reuse. The resolver has evidence that the RRset was authentic or at least valid under its normal resolution policy when stored. During a temporary authority failure, it can prefer that recent fact over a failure response.',
        'The argument stops at the stale deadline. Past that point, the old answer is too old to treat as a resilience fallback. DNSSEC validation state, local policy, and record class can also make stale service invalid even before the maximum window ends.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Serve-stale changes cost only for warm cache entries. A cold cache still has nothing to return. For warm entries, authority query load may rise during outages because the resolver keeps retrying, while client-visible failures drop because many queries receive the stale value.',
        'The behavioral cost is delayed convergence. If TTL is 300 seconds and maximum-stale is 3,600 seconds, a resolver may return old data for up to an hour during authority failure. Memory also grows because expired RRsets remain retained until stale deadlines or eviction remove them.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Serve-stale is useful for ordinary service address records where temporary authority failure is worse than using a recent address. Public resolvers and enterprise resolvers can absorb short nameserver outages without making every dependent application fail. The access pattern is many clients asking for names that were recently valid.',
        'It also helps during DDoS or network partition events against authoritative DNS. Operators can keep user traffic flowing while alerts show refresh failures and stale-answer counts. The feature is strongest when stale metrics are treated as an incident signal rather than hidden success.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Serve-stale fails on cold misses because there is no last known answer. It is dangerous for records that are meant to change quickly, such as authorization TXT records, active cutover records, and some service-discovery names. Old data can be worse than failure when it sends traffic to the wrong authority or endpoint.',
        'It also fails if operators treat stale serving as health. A resolver can appear successful while all authoritative refreshes fail. Good deployments separate fresh answers, stale answers, refresh failures, validation failures, and maximum-stale drops in monitoring.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A resolver caches api.example.com A 203.0.113.10 at 10:00:00 with TTL 300. At 10:05:00 the TTL expires, and a client asks again. The resolver queries authority, waits 200 milliseconds under policy, and all nameservers time out.',
        'If maximum-stale is 3,600 seconds, the old answer is still eligible at 10:05:00. The resolver returns 203.0.113.10 with TTL 30 and keeps refreshing in the background. At 11:05:01 the same entry is beyond the stale window, so failure should be returned unless fresh authority has recovered.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include RFC 8767 at https://www.rfc-editor.org/rfc/rfc8767, RFC 2308 at https://www.rfc-editor.org/rfc/rfc2308, and the Unbound serve-stale documentation at https://unbound.docs.nlnetlabs.nl/en/latest/topics/core/serve-stale.html. Study DNS negative caching to contrast absence reuse, cache invalidation for TTL behavior, and tail-latency thinking for response-budget design.',
      ],
    },
  ],
};
