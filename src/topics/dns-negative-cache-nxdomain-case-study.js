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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a resolver deciding whether absence can be reused. A recursive resolver is the DNS server that performs lookups for clients, NXDOMAIN means the owner name does not exist, and NODATA means the owner exists but lacks the requested record type. Active state is the current query or cache decision, visited state is authority that has already been checked, and found state is a cache entry whose scope is proven.',
        'The safe inference is narrow: an authoritative NXDOMAIN for one name can answer later matching queries only until its negative TTL expires. A timeout, SERVFAIL, or validation failure is not absence. The animation should make that boundary visible before it shows the cache hit.',
        {type: 'callout', text: 'Negative caching is bounded reuse of authoritative absence, with the cache key and TTL carrying the safety guarantee.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Domain_name_space.svg', alt: 'Diagram of the DNS namespace tree with delegated zones and resource-record sets.', caption: 'Domain name space and zone-delegation diagram, LionKimbro and Wereldburger758, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'DNS maps names to records by walking authority from the root toward the owning zone. Many lookups are misses: mistyped names, deleted hosts, bot probes, and missing record types. Without negative caching, each repeated miss can force another resolver walk.',
        'Negative caching exists to make proven absence cheap for a bounded time. It protects authoritative servers from repeated useless traffic and reduces client latency. The cache entry is useful only because the absence came from the authority for the zone.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest resolver does not cache misses. If a name fails, it asks the DNS hierarchy again on the next query. That is fresh and easy to reason about because a newly created record becomes visible as soon as the authoritative server returns it.',
        'A different shortcut is to cache every DNS error. That lowers retry traffic but confuses failure with nonexistence. A server timeout does not prove that a name is absent.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'No-cache misses become a retry amplifier. If 50,000 clients repeatedly ask for typo.example.com, the resolver fleet can send the same impossible lookup toward authority again and again. The DNS tree spends work proving the same absence.',
        'Caching every error breaks correctness. A temporary SERVFAIL during an outage could make the resolver answer false NXDOMAIN later. The resolver needs a table that stores only authoritative negative answers and only within the scope that answer proves.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A negative-cache entry is not just a hostname. Its key includes the query name, record type, class, denial kind, zone authority, and expiration time. For signed zones, it can also include DNSSEC denial proof material.',
        'The negative TTL is the safety valve. It says how long the resolver may reuse the absence before asking authority again. Longer TTLs reduce repeated work, but they also delay recovery when a name is created after clients already saw NXDOMAIN.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On a cache miss, the recursive resolver performs the normal DNS walk. Referrals from root and top-level-domain servers lead to the authoritative server for the zone. Only that authority can say that a name does not exist in the zone or that an existing name lacks the requested type.',
        'The resolver stores the negative response with its expiration rule, often derived from SOA information under RFC 2308. Later matching queries are answered locally until the entry expires. SERVFAIL and timeout can be damped by separate failure caching rules, but they are not NXDOMAIN or NODATA proof.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is authority plus scope plus time. The resolver is not inventing absence; it is reusing a statement made by the zone authority. The entry answers only the same question or the exact related question that the protocol allows.',
        'NXDOMAIN and NODATA must stay distinct. NXDOMAIN says the owner name is absent. NODATA says the owner name exists but the requested record type is absent. If a resolver merges those states, it can incorrectly hide valid records at the same owner name.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A cold miss still costs a DNS walk. A warm negative-cache hit costs a local lookup, so repeated misses collapse from many network queries to one authoritative proof plus table reads. When repeated query count doubles for the same absent name, authority load stays almost flat until the negative TTL expires.',
        'The cost is memory for negative entries and operational delay after mistakes. A 600-second negative TTL can suppress a typo storm, but it can also keep returning NXDOMAIN for up to 10 minutes after a record is created. DNSSEC adds response bytes and validation work when absence is cryptographically proven.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Negative caching is useful for public recursive resolvers and enterprise resolvers because repeated absence is common. A bot scan over random subdomains can generate millions of names that never existed. Caching authoritative absence keeps those probes from becoming repeated upstream load.',
        'It is also useful during ordinary application errors. A broken service-discovery client may retry a missing name every second. Negative caching turns that bug into local resolver work while operators inspect NXDOMAIN rate and the top absent names.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Negative caching fails when the system treats lookup failure as absence. SERVFAIL, lame delegation, timeout, and DNSSEC validation trouble require different handling. Returning a cached NXDOMAIN for those conditions would be a false claim.',
        'It also hurts workflows that create names after first use. If clients probe future names before deployment, resolvers may cache absence and keep returning it after the records exist. Shorter negative TTLs are often more important before risky DNS migrations than shorter positive TTLs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A client asks for typo.example.com A at 12:00:00. The resolver reaches the authoritative server for example.com, receives NXDOMAIN, and stores a negative entry with TTL 300 seconds. From 12:00:01 through 12:04:59, 20,000 repeated queries can be answered from local cache.',
        'At 12:05:00 the entry expires. If typo.example.com has now been created with A 203.0.113.9, the next lookup can fetch the new positive answer. If the negative TTL had been 1,800 seconds, the same clients could keep seeing absence for 30 minutes after the record was published.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include RFC 2308 at https://www.rfc-editor.org/rfc/rfc2308 and RFC 9520 at https://www.rfc-editor.org/rfc/rfc9520. Study recursive DNS lookup before this topic, DNS serve-stale for the opposite positive-cache resilience policy, DNSSEC NSEC3 for authenticated absence, and cache invalidation for TTL tradeoffs.',
      ],
    },
  ],
};
