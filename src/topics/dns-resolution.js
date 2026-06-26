// DNS resolution: how "www.example.com" becomes an IP address — a walk
// down a planetary tree of name servers, made instant by caches with
// expiry timers at every layer. The internet's original distributed system.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'dns-resolution',
  title: 'How DNS Works',
  category: 'Systems',
  summary: 'Root, TLD, authoritative: the hierarchical lookup behind every URL, and the caches that skip it.',
  controls: [
    { id: 'cache', label: 'Resolver cache', type: 'select', options: ['cold (full walk)', 'warm (cached)'], defaultValue: 'cold (full walk)' },
  ],
  run,
};

const NODES = [
  { id: 'L', label: 'you', x: 1.0, y: 7.8, note: 'browser' },
  { id: 'R', label: 'rslv', x: 3.6, y: 4.6, note: 'resolver' },
  { id: 'ROOT', label: '.', x: 6.6, y: 1.2, note: 'root' },
  { id: 'TLD', label: 'com', x: 8.6, y: 4.2, note: 'TLD' },
  { id: 'AUTH', label: 'ns1', x: 8.0, y: 7.8, note: 'authoritative' },
];
const EDGES = [
  { id: 'lr', from: 'L', to: 'R' },
  { id: 'rroot', from: 'R', to: 'ROOT' },
  { id: 'rtld', from: 'R', to: 'TLD' },
  { id: 'rauth', from: 'R', to: 'AUTH' },
];

export function* run(input) {
  const cold = String(input.cache).startsWith('cold');
  if (!['cold (full walk)', 'warm (cached)'].includes(String(input.cache))) {
    throw new InputError('Pick a cache state.');
  }
  const snapshot = () => graphState({ nodes: NODES, edges: EDGES });

  yield {
    state: snapshot(),
    highlight: { active: ['L'] },
    explanation: 'Start with the name, not the network. www.example.com is a path through delegated authority: root, com, example.com, then the host record. DNS scales because no one server owns the whole map.',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['lr', 'R'] },
    explanation: `First check caches. The browser, OS, and recursive resolver may already know the answer. ${cold ? 'This run is cold, so the resolver must walk the hierarchy.' : 'This run is warm, so the resolver can answer from a still-valid cached record.'}`,
  };

  if (!cold) {
    yield {
      state: snapshot(),
      highlight: { found: ['R', 'lr'] },
      explanation: 'Cache hit: the resolver returns 93.184.216.34 without contacting root, TLD, or authoritative servers. Most DNS lookups are saved by TTL-bound caches, which is why the hierarchy can serve global traffic.',
    };
    yield {
      state: snapshot(),
      highlight: { found: ['R'] },
      explanation: 'TTL is the freshness budget chosen by the domain owner. High TTLs reduce load but slow changes. Low TTLs make failover and CDN steering faster but force caches to ask more often. The tradeoff is cache invalidation at internet scale.',
    };
    return;
  }

  yield {
    state: snapshot(),
    highlight: { active: ['rroot', 'ROOT'] },
    explanation: 'On a cold miss, the resolver asks a root server. The root does not know the final address; it returns a referral to the TLD servers for .com. Root servers stay small by delegating downward.',
    invariant: 'Each level of the tree only knows its children — no server holds the whole map.',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['rtld', 'TLD'], visited: ['ROOT'] },
    explanation: 'The resolver asks a .com TLD server next. The TLD returns the authoritative nameserver for example.com, another referral one level closer to the answer.',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['rauth', 'AUTH'], visited: ['ROOT', 'TLD'] },
    explanation: 'The authoritative server owns the zone data for example.com. It finally returns the A record and its TTL instead of another referral.',
  };

  yield {
    state: snapshot(),
    highlight: { found: ['R', 'lr', 'L'], visited: ['ROOT', 'TLD', 'AUTH'] },
    explanation: 'The resolver caches both the final answer and useful referrals, then hands the IP to the browser so TCP can start. The first lookup pays several round trips; later clients reuse that work until TTL expiry.',
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'The design has survived because authority and load are distributed separately. Delegation decides who may answer; caches decide how often they must be asked. When authoritative DNS for a popular domain fails, healthy web servers can still look offline because clients cannot find them.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces a recursive resolver walking the DNS hierarchy for www.example.com. Five nodes represent the actors: your browser, the recursive resolver, a root server, a .com TLD server, and the authoritative nameserver for example.com. Edges show the query path the resolver follows.',
        {type: 'callout', text: 'DNS scales by separating who may answer from who can cache, so global naming becomes delegated authority plus timed reuse.'},
        'Active nodes and edges show the current query hop. Visited markers mean a server has already answered and referred the resolver downward. Found markers mean the final IP address has been returned and cached.',
        'Toggle between cold and warm cache to see the difference. A cold run walks root, TLD, and authoritative servers in sequence, costing several round trips. A warm run returns from the resolver cache in one hop. Notice that the resolver does the walking so the browser never has to.',
        {type: 'image', src: './assets/gifs/dns-resolution.gif', alt: 'Animated walkthrough of the dns resolution visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Humans remember names. Networks route to numbers. A browser can remember www.example.com, but TCP needs 93.184.216.34. A service owner may move servers, add a CDN, rotate mail providers, split traffic by region, or recover from an outage — all without asking every user to edit a local file. The name has to stay useful while the infrastructure behind it changes.',
        'The first Internet naming system was a shared hosts file distributed by hand. That worked when the network was small. It broke when organizations wanted to administer their own names, when the host count grew past what a single file could hold, and when distributing that file became a coordination and bandwidth problem.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/b/b1/Domain_name_space.svg`, alt: `DNS domain name space tree with root, top-level domains, zones, and resource records`, caption: `The DNS namespace is a delegated tree, not a single table owned by one server. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Domain_name_space.svg.`},
        'DNS replaced that file with a distributed hierarchy. Each part of the namespace is delegated to the organization responsible for it. The result is a tree of authority plus many layers of caches: the tree answers who is allowed to speak for a name, and the caches make the answer fast enough for ordinary web traffic.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first design is a central table from names to addresses. Lookup is simple: send the name, get back the address, connect. It also gives one place to edit when a record changes. For a small private network, this works fine.',
        'A slightly less centralized version is to replicate the table to every machine. Local copies make reads fast, but freshness becomes impossible to guarantee. If every machine holds a stale copy, a domain change stays invisible until every copy updates. Broadcasting the question to the network fails even faster: most servers have no authority for the name being asked, and popular domains would drown the network in repeated traffic.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A central table hits three walls simultaneously. Ownership: a single authority must accept updates from every domain operator on Earth, adjudicate conflicts, and stay available globally. No organization can run that table without becoming a political and operational bottleneck.',
        'Scale: billions of queries per second hit DNS today. A single server cannot absorb that load, and replicating the full table to every edge means every copy must stay synchronized as records change. The synchronization cost grows with both the number of records and the number of replicas.',
        'Staleness: local copies of a flat file go stale silently. A domain owner changes an address, but clients keep connecting to the old one until every copy updates. Without an explicit freshness contract, there is no way to know whether a cached answer is still valid. DNS solves all three problems with one structure: a delegation tree that distributes authority, plus TTL-bound caches that distribute load without requiring invalidation broadcasts.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate authority from resolution. Authority is delegated down the name tree: root delegates to TLD servers, TLD servers delegate to authoritative nameservers, and each zone owner controls its own data. Resolution is the process of walking that delegation until a server with the right authority returns the record.',
        'The namespace is trie-like, but the trie is split across institutions rather than stored in one process. Labels read right to left: root, then the top-level domain (com), then the registered domain (example.com), then the host (www). Each level only needs enough information to delegate the next step, which keeps the root small.',
        'Caching is the other half. A recursive resolver stores answers and referrals for their TTL (time to live). The hierarchy can be correct without being hit on every page load because repeated questions reuse recently learned answers. DNS works because delegation distributes authority and TTL-bound caches distribute load.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The browser asks the OS stub resolver, which forwards the query to a recursive resolver (like 8.8.8.8 or a corporate resolver). The recursive resolver does the walking so the browser never contacts the hierarchy directly.',
        'On a cold miss, the resolver asks a root server. The root does not know www.example.com, but it knows where the .com TLD servers live and returns a referral. The resolver asks a .com TLD server, which returns a referral to the authoritative nameservers for example.com. The resolver asks the authoritative server, which owns the zone file and returns the A record (93.184.216.34) with a TTL of, say, 3600 seconds.',
        'On a warm lookup, the resolver already has a valid cached answer and returns the IP in one hop. It may also cache referrals: if the .com TLD referral is cached, a later query for any .com domain skips the root entirely. Negative caching stores the absence of a record (NXDOMAIN or NODATA) so typos and dead links do not repeatedly hit authoritative servers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Delegation works because each zone is responsible only for the names below it. The root zone delegates com. The com zone delegates example.com. The example.com zone publishes www. No server stores the whole Internet namespace, and no domain owner needs permission from every resolver to change its own zone data.',
        'Caching works because DNS records are usually reusable for a period the domain owner chooses. If ten thousand users behind the same resolver ask for the same site, the resolver answers most of them from one earlier walk. TTL makes the cache contract explicit: until it expires, the resolver may reuse the record; after it expires, the resolver must refresh.',
        'The design tolerates partial independence. A company can change authoritative providers without changing browser code. A recursive resolver can improve cache behavior without changing domain ownership. A CDN can publish different answers by geography while staying inside the DNS model. The pieces coordinate through records, referrals, TTLs, and protocol rules rather than one central database.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A cold recursive lookup costs several network round trips: stub to resolver, resolver to root, resolver to TLD, resolver to authoritative. On a lossy network or with DNSSEC validation, this can dominate page startup time. A warm resolver hit costs one round trip — close to O(1) from the client\'s perspective.',
        'The space cost is cache state across browsers, operating systems, recursive resolvers, and sometimes application runtimes. That state is worth keeping because popular names repeat constantly. The main tradeoff is agility versus load: a high TTL (86400 seconds) reduces authoritative traffic and improves resilience during short outages, but slows migrations and failover. A low TTL (60 seconds) makes steering and recovery faster, but forces resolvers to refresh more often.',
        'TTL is a product and operations decision, not a cosmetic zone-file field. Before a planned migration, operators lower the TTL well in advance so old cached answers drain before the address change.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every browser page, mobile API call, webhook, package install, container pull, and email delivery path depends on DNS. Web traffic uses A or AAAA records. Email depends on MX records. Service discovery may use SRV or TXT records. Certificate automation uses DNS challenges to prove domain control.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg`, alt: `Global internet topology visualization with many connected network nodes`, caption: `DNS caching and delegation exist because name lookup has to serve a planet-scale network. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Internet_map_1024.jpg.`},
        'CDNs use DNS as an early steering layer. The authoritative answer can point a user toward a nearby edge, a healthy region, or a traffic-management endpoint. After DNS returns an address, other systems take over: a Load Balancer chooses a backend, Consistent Hashing may select a cache shard, and CDN Request Flow handles cache hits and origin misses.',
        'Operational migrations are built around TTL. A team lowering TTL before a move is shortening the maximum life of old cached answers. After enough time passes for previous TTLs to drain, the team can change the authoritative record and expect most resolvers to refresh soon.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DNS changes are not globally instant. Different users see different answers because their resolvers cached different records at different times, because authoritative servers steer by geography, or because DNSSEC validation adds delay. "It works for me" is normal evidence in DNS debugging, not a contradiction.',
        'The most common debugging failure is blaming the wrong layer. A stale browser cache, a policy-filtered resolver, broken delegation, an unavailable authoritative server, a DNSSEC validation failure, and an application outage all look like "the site is down." Good debugging follows the chain: local cache, resolver, referral path, authoritative answer, validation, then application connection.',
        'Authoritative concentration is a systemic risk. A domain can have healthy web servers and still disappear if its authoritative DNS provider is unreachable. The 2016 Dyn attack proved this: many major services went offline because clients could not resolve their names, not because any origin server failed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace the full cold resolution of www.example.com from a browser with an empty cache. The name reads right to left through the delegation tree: root (the trailing dot), then com, then example.com, then www.',
        'Step 1: The browser asks the OS stub resolver. No cached answer exists, so the stub forwards the query to a recursive resolver at 8.8.8.8. Step 2: The recursive resolver has a cold cache. It knows the 13 root server cluster addresses from a hardcoded hints file and sends the query to a.root-servers.net.',
        'Step 3: The root server sees the rightmost label is com and returns a referral: NS records and glue A records for the .com TLD servers. Step 4: The resolver queries a.gtld-servers.net, which returns a referral to ns1.example.com and ns2.example.com with their glue addresses.',
        'Step 5: The resolver queries ns1.example.com. This server owns the zone file, finds the A record, and returns 93.184.216.34 with a TTL of 3600 seconds. Step 6: The resolver caches the answer and the referral chain, then returns 93.184.216.34 to the stub, which returns it to the browser. TCP can now connect.',
        'Total cost: four round trips. If a second user behind the same resolver asks within 3600 seconds, the answer comes from cache in one round trip. The .com TLD referral is also cached, so any later .com query skips the root server entirely.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 1034 defines DNS concepts and the delegation model. RFC 1035 specifies the protocol, message format, and implementation. RFC 2308 defines negative caching rules. Read them with one question: which server is authoritative for this answer, and how long may someone else reuse it?',
        'Prerequisites: Trie (Prefix Tree) for the name-tree shape. Related topics: LRU Cache for resolver storage pressure, Cache Invalidation & Versioning for TTL tradeoffs, DNS Negative Cache & NXDOMAIN for absence caching, DNS Serve-Stale Resolver Cache for resilience when authoritative refresh fails. Follow-up systems: CDN Request Flow, Load Balancer, Consistent Hashing, and TCP: Handshake & Congestion Control to see what happens after the name becomes an address.',
      ],
    },
  ],
};
