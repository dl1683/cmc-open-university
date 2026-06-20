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
    invariant: 'A negative cache entry is scoped by name, type, class, and zone proof, not by a generic error bucket.',
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
      heading: 'Why this exists',
      paragraphs: [
        'DNS is full of repeated misses. Users mistype hostnames, bots probe random names, deploys delete records, and applications retry after failures. Without negative caching, every repeated miss can walk from the recursive resolver to root, TLD, and authoritative servers again.',
        'Negative caching exists to make authoritative absence reusable for a bounded time. A resolver can answer repeated NXDOMAIN or NODATA queries locally, reducing user latency and protecting authoritative servers from useless traffic.',
        {type: 'callout', text: 'Negative caching is bounded reuse of authoritative absence, with the cache key and TTL carrying the safety guarantee.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Domain_name_space.svg', alt: 'Diagram of the DNS namespace tree with delegated zones and resource-record sets.', caption: 'Domain name space and zone-delegation diagram, LionKimbro and Wereldburger758, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest resolver can avoid caching misses. If a name is absent, ask the hierarchy again next time. That is easy to reason about because a newly created name becomes visible as soon as authority serves it.',
        'The opposite shortcut is also tempting: cache every DNS error as a miss. That reduces retry load, but it confuses lookup failure with authoritative absence. A timeout or SERVFAIL does not prove the name is gone.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'No-cache misses create a retry amplifier. A typo in a popular URL, a broken service discovery name, or a bot scan can force many recursive resolvers to repeat the same pointless walk. The DNS hierarchy spends work proving the same absence over and over.',
        'Caching all errors is worse in a different direction. It can turn a temporary authoritative outage into a false deletion. The resolver needs a data structure that remembers absence only when the right authority said the name or type was absent.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A negative cache is a scoped absence table. The key is not just a string. It includes the queried name, record type, class, and zone context. The value records whether the answer was NXDOMAIN or NODATA, the authority metadata, insertion time, expiration time, and DNSSEC proof material when the zone is signed.',
        'The SOA-derived negative TTL is the safety valve. It lets absence suppress repeated work, but only until the zone owner says the denial should be refreshed.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        "In the NXDOMAIN-cache view, read the cache entry as an authoritative absence claim with scope. It is not just the string that missed; it is the queried name, type, class, zone authority, denial kind, proof metadata, and expiration time.",
        "In the failure-boundary view, watch which responses are allowed to become negative cache entries. NXDOMAIN and NODATA can be cached under protocol rules. SERVFAIL, timeout, and validation trouble are not proof that the name or type does not exist.",
        "The highlighted timer is the safety boundary. Negative caching is useful because it suppresses repeated useless lookups, but it is safe only while the authoritative denial remains within its TTL.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A client asks for `typo.example.com A`. The recursive resolver walks the hierarchy and reaches the authoritative servers for `example.com`. The authoritative answer says NXDOMAIN and includes the SOA data used to bound negative caching. The resolver can now answer repeated queries for that absent name locally until the negative TTL expires.',
        'Now compare a different case: `www.example.com` exists, but has no AAAA record. That is NODATA, not NXDOMAIN. The resolver can cache the absence of the AAAA RRset, but it must not conclude that `www.example.com` itself is absent. That distinction is why negative cache keys need more structure than a hostname string.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On a miss, the recursive resolver performs the normal DNS walk. Root and TLD servers usually return referrals. The authoritative server for the zone is the first server allowed to say that a name does not exist in that zone or that a name exists without the requested type.',
        'The resolver stores the negative answer with the authority section and expiration rules from RFC 2308. Later matching queries can be answered from the negative cache. SERVFAIL, timeout, and other resolution failures can be damped separately, but they are not proof of non-existence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The mechanism is correct only because the cache entry is scoped to the authority that proved the absence and expires on a bounded timer. The resolver is not inventing absence; it is reusing an authoritative statement for the interval the DNS protocol permits.',
        'NXDOMAIN and NODATA must stay separate. NXDOMAIN says the owner name does not exist. NODATA says the owner name exists but has no RRset of the requested type. Mixing those states would make the cache answer questions it was never authorized to answer.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The benefit is fewer repeated tree walks. When the same typo is queried thousands of times, the expensive operation becomes one authoritative proof plus many local cache hits. Memory cost is the negative-cache table and any proof records needed for validation.',
        'The tax is recovery time. A long negative TTL lowers retry load, but an accidental NXDOMAIN can keep working clients broken until recursive resolvers expire the entry. Negative TTLs are therefore both performance knobs and incident-recovery knobs.',
        'DNSSEC can add proof size and validation work, but it also makes denial more auditable. Signed zones can provide authenticated denial material such as NSEC or NSEC3 records. Unsigned zones still rely on the resolver trusting the authority path and cache timing.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Before creating a new name during an incident, remember that old misses may be cached. If clients already asked for the name and received NXDOMAIN, some resolvers will keep returning absence until the negative TTL expires. Lowering TTL after the fact cannot recall entries already cached elsewhere.',
        'Monitor NXDOMAIN rate, NODATA rate, SERVFAIL rate, validation failures, and top negative names separately. Combining them into one "DNS error" graph hides the most important distinction: authoritative absence versus lookup failure.',
      ],
    },
    {
      heading: 'DNSSEC boundary',
      paragraphs: [
        'Signed zones add authenticated denial records, but they do not remove the need for careful cache scope. NSEC and NSEC3 can prove that a name or type is absent within a zone. The resolver still has to bind that proof to the right query, validation chain, and expiration time.',
        'NSEC3 also shows the privacy tradeoff. It can make zone walking harder than plain NSEC, but it adds hashing and proof complexity. The educational point is that absence can be a cryptographic statement, not just a server saying "no."',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Negative caching wins for typos, bot scans, deleted names, missing record types, and broken clients that retry the same absent name. It turns repeated absence checks into local resolver work.',
        'It also helps operators see real patterns. NXDOMAIN spikes can reveal bad deploys, bad links, abuse scans, or service-discovery clients looking for names that no longer exist.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Negative caching fails when a resolver treats failure as absence. SERVFAIL, timeout, lame delegation, and validation trouble need different handling from NXDOMAIN and NODATA.',
        'It also hurts during fast migrations when names may appear shortly after a miss. Before risky DNS changes, lowering negative TTLs can matter more than shaving retry traffic.',
        'It is also dangerous for service-discovery systems that create names on demand after clients have already probed them. If names are expected to appear shortly after first lookup, long negative caching can make creation look broken long after authority has the right record.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 2308 DNS Negative Caching at https://www.rfc-editor.org/rfc/rfc2308 and RFC 9520 Negative Caching of DNS Resolution Failures at https://www.rfc-editor.org/rfc/rfc9520. Study How DNS Works for the resolver walk, DNS Serve-Stale Resolver Cache for the opposite stale-positive policy, LRU Cache for local eviction pressure, Cache Invalidation & Versioning for TTL trade-offs, CDN Request Flow for edge cache parallels, Resource Hints: Preload & Preconnect for client-side latency, and Tail Latency & p99 Thinking for retry amplification.',
      ],
    },
  ],
};
