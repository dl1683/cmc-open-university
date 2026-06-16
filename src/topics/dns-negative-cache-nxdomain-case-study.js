// DNS negative caching: resolvers cache NXDOMAIN and NODATA answers so typos,
// deleted names, and unavailable records do not repeatedly walk the DNS tree.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dns-negative-cache-nxdomain-case-study',
  title: 'DNS Negative Cache & NXDOMAIN',
  category: 'Systems',
  summary: 'How resolvers cache negative DNS answers with NXDOMAIN, NODATA, SOA-derived TTLs, retry suppression, and failure-mode boundaries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['NXDOMAIN cache', 'failure boundary'], defaultValue: 'NXDOMAIN cache' },
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
      { id: 'client', label: 'client', x: 0.7, y: 4.7, note: notes.client ?? 'query' },
      { id: 'resolver', label: 'rslv', x: 2.2, y: 4.7, note: notes.resolver ?? 'recursive' },
      { id: 'neg', label: 'neg', x: 3.8, y: 2.7, note: notes.neg ?? 'empty' },
      { id: 'root', label: '.', x: 4.0, y: 6.5, note: notes.root ?? 'root' },
      { id: 'tld', label: 'com', x: 5.5, y: 6.5, note: notes.tld ?? 'TLD' },
      { id: 'auth', label: 'auth', x: 7.1, y: 4.7, note: notes.auth ?? 'zone' },
      { id: 'soa', label: 'SOA', x: 7.1, y: 2.7, note: notes.soa ?? 'min TTL' },
      { id: 'ans', label: 'ans', x: 8.8, y: 4.7, note: notes.ans ?? 'NX' },
    ],
    edges: [
      { id: 'e-client-resolver', from: 'client', to: 'resolver', weight: '' },
      { id: 'e-resolver-neg', from: 'resolver', to: 'neg', weight: '' },
      { id: 'e-resolver-root', from: 'resolver', to: 'root', weight: '' },
      { id: 'e-root-tld', from: 'root', to: 'tld', weight: '' },
      { id: 'e-tld-auth', from: 'tld', to: 'auth', weight: '' },
      { id: 'e-auth-soa', from: 'auth', to: 'soa', weight: '' },
      { id: 'e-auth-ans', from: 'auth', to: 'ans', weight: '' },
      { id: 'e-soa-neg', from: 'soa', to: 'neg', weight: '' },
    ],
  }, { title });
}

function* nxdomainCache() {
  yield {
    state: dnsGraph('A miss for a nonexistent name starts as a normal DNS walk'),
    highlight: { active: ['client', 'resolver', 'e-client-resolver'], compare: ['neg'] },
    explanation: 'A client asks for typo.example.com. The resolver first checks its positive and negative caches. There is no record yet, so the query must walk toward the authoritative zone.',
    invariant: 'A negative cache entry is scoped by name, type, class, and zone proof, not by vibes.',
  };

  yield {
    state: dnsGraph('The resolver follows referrals until the zone is authoritative'),
    highlight: { active: ['resolver', 'root', 'tld', 'auth', 'e-resolver-root', 'e-root-tld', 'e-tld-auth'], compare: ['neg'] },
    explanation: 'The root and TLD usually give referrals. The authoritative server for example.com is the first server allowed to say the name does not exist in that zone.',
  };

  yield {
    state: dnsGraph('NXDOMAIN or NODATA arrives with SOA metadata', { auth: 'no name', soa: 'ttl=300', ans: 'NXDOMAIN' }),
    highlight: { active: ['auth', 'soa', 'ans', 'e-auth-soa', 'e-auth-ans'], found: ['resolver'] },
    explanation: 'A negative answer needs enough authority metadata for caching. RFC 2308 ties negative caching to the SOA record so recursive resolvers know how long to remember the absence.',
  };

  yield {
    state: dnsGraph('The resolver inserts a bounded negative cache entry', { neg: 'NX 300s', resolver: 'store', soa: 'ttl cap' }),
    highlight: { active: ['soa', 'neg', 'resolver', 'e-soa-neg', 'e-resolver-neg'], removed: ['root', 'tld'] },
    explanation: 'The negative entry suppresses repeated tree walks for the same nonexistent answer until its TTL expires. This is the absence version of normal DNS freshness.',
  };

  yield {
    state: dnsGraph('The next typo query is answered locally', { client: 'retry', resolver: 'hit', neg: 'NX hit', ans: 'no walk' }),
    highlight: { found: ['client', 'resolver', 'neg', 'e-client-resolver', 'e-resolver-neg'], removed: ['root', 'tld', 'auth'] },
    explanation: 'When another client repeats the typo, the resolver can answer quickly from the negative cache. That reduces user latency and protects authoritative servers from repeated useless traffic.',
  };
}

function* failureBoundary() {
  yield {
    state: labelMatrix(
      'Negative answers',
      [
        { id: 'nx', label: 'NX' },
        { id: 'nodata', label: 'NODATA' },
        { id: 'servfail', label: 'SERVFAIL' },
        { id: 'stale', label: 'stale' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'cache', label: 'cache' },
      ],
      [
        ['name absent', 'SOA TTL'],
        ['type absent', 'SOA TTL'],
        ['failed lookup', 'short'],
        ['old data', 'policy'],
      ],
    ),
    highlight: { active: ['nx:cache', 'nodata:cache'], compare: ['servfail:cache'] },
    explanation: 'Negative caching is not one bucket. NXDOMAIN means the name does not exist. NODATA means the name exists but not for that record type. SERVFAIL means resolution failed.',
    invariant: 'Do not confuse absence with lookup failure.',
  };

  yield {
    state: dnsGraph('A temporary authoritative outage is not the same as NXDOMAIN', { auth: 'timeout', ans: 'SERVFAIL', neg: 'no NX' }),
    highlight: { active: ['resolver', 'auth', 'ans', 'e-tld-auth', 'e-auth-ans'], compare: ['neg'] },
    explanation: 'If the authoritative server times out, the resolver should not invent NXDOMAIN. A failure cache can damp retries briefly, but it must not erase a name that might exist.',
  };

  yield {
    state: dnsGraph('An accidental NXDOMAIN can persist until the negative TTL ends', { auth: 'bad zone', soa: 'ttl=900', neg: 'NX 900s', ans: 'oops' }),
    highlight: { active: ['auth', 'soa', 'neg', 'e-auth-soa', 'e-soa-neg'], removed: ['root'] },
    explanation: 'The operational risk is deployment error. If a zone temporarily publishes a bad denial, recursive resolvers can keep returning the negative answer until the TTL expires.',
  };

  yield {
    state: labelMatrix(
      'Runbook knobs',
      [
        { id: 'ttl', label: 'neg TTL' },
        { id: 'roll', label: 'rollout' },
        { id: 'dnssec', label: 'DNSSEC' },
        { id: 'observe', label: 'observe' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['retry load', 'slow fix'],
        ['canary zone', 'extra ops'],
        ['proof', 'complex'],
        ['NX spikes', 'noise'],
      ],
    ),
    highlight: { active: ['ttl:helps', 'observe:helps'], compare: ['ttl:risk'] },
    explanation: 'Negative caching is a reliability trade. Longer TTLs lower retry load, but they make mistaken absence last longer. Monitoring NXDOMAIN spikes catches typos, bot scans, and broken deploys.',
  };

  yield {
    state: dnsGraph('The complete case is a deleted API host during deploy', { client: 'api call', auth: 'bad deploy', soa: '300s', neg: 'cached NX', ans: 'down' }),
    highlight: { active: ['client', 'resolver', 'auth', 'soa', 'neg', 'ans'], found: ['e-client-resolver'] },
    explanation: 'A deploy accidentally removes api.example.com for five minutes. Clients keep retrying. Negative caching prevents an authority flood, but some recursive resolvers keep the NXDOMAIN until TTL expiry after the zone is fixed.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'NXDOMAIN cache') yield* nxdomainCache();
  else if (view === 'failure boundary') yield* failureBoundary();
  else throw new InputError('Pick a DNS negative-cache view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'DNS negative caching stores authoritative absence. Instead of asking root, TLD, and authoritative servers again for the same nonexistent name, a recursive resolver can remember NXDOMAIN or NODATA for a bounded time.',
        'RFC 2308 defines DNS negative caching and explains why it reduces response time and traffic for negative answers: https://www.rfc-editor.org/rfc/rfc2308. RFC 9520 updates the picture for negative caching of resolution failures: https://www.rfc-editor.org/rfc/rfc9520.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The cache key includes the queried name, record type, class, and the zone context proving the answer. The cached value includes the negative answer kind, authority metadata, insertion time, TTL, and often DNSSEC proof records when signed zones are involved.',
        'The important distinction is absence versus failure. NXDOMAIN and NODATA are authoritative statements. SERVFAIL and timeouts are lookup failures, so they need much shorter dampening behavior and should not be treated as proof that the name does not exist.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A team deploys a new DNS zone and accidentally omits api.example.com. Recursive resolvers receive NXDOMAIN with an SOA-derived negative TTL of 300 seconds. During the outage, retries are cheap for resolvers and authoritative servers, because the negative cache absorbs repeated traffic.',
        'After the zone is fixed, some clients still see NXDOMAIN until their resolver entry expires. The incident runbook checks authoritative answers directly, watches resolver-side NXDOMAIN rates, and lowers negative TTLs before risky migrations when fast correction matters more than retry suppression.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Negative caching does not mean all errors are cached as absence. Treating SERVFAIL as NXDOMAIN can turn a transient nameserver outage into a false deletion. Treating NXDOMAIN as never cacheable can overload authoritative servers during typo storms and bot scans.',
        'Negative TTL is not just a performance knob. It is a recovery-time knob. A long negative TTL makes nonexistent names cheap, but it also makes accidental deletions harder to roll back quickly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 2308 DNS Negative Caching at https://www.rfc-editor.org/rfc/rfc2308 and RFC 9520 Negative Caching of DNS Resolution Failures at https://www.rfc-editor.org/rfc/rfc9520. Study How DNS Works, DNS Serve-Stale Resolver Cache, LRU Cache, Cache Invalidation & Versioning, CDN Request Flow, Resource Hints: Preload & Preconnect, and Tail Latency & p99 Thinking next.',
      ],
    },
  ],
};
