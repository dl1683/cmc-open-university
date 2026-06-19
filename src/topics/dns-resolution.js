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
        'Active (highlighted) nodes and edges show the current query hop. Visited markers mean a server has already answered and referred the resolver downward. Found markers mean the final IP address has been returned and cached.',
        'Toggle between cold and warm cache to see the difference. A cold run walks root, TLD, and authoritative servers in sequence. A warm run returns from the resolver cache in one hop. Watch how many round trips each path costs, and notice that the resolver does the walking so the browser does not have to.',
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `DNS exists because humans want stable names and networks route to changing addresses. A browser can remember www.example.com, but TCP needs an IP address. A service owner may move servers, add a CDN, rotate mail providers, split traffic by region, or recover from an outage without asking every user to edit a local file. The name has to stay useful while the infrastructure behind it changes.`,
        `The first Internet naming system was closer to a shared hosts file. That worked when the network was small. It broke when organizations wanted to administer their own names, when the number of hosts grew, and when distributing a central file became a coordination and bandwidth problem. DNS replaced that file with a distributed hierarchy. Each part of the name space can be delegated to the organization responsible for it.`,
        `The result is not a single global phonebook. It is a tree of authority plus many layers of caches. The tree answers who is allowed to speak for a name. The caches make the answer fast enough for ordinary web traffic.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The naive approach is a central table from names to addresses. It is attractive because lookup is simple: send the name to the table, get back the address, connect. It also gives one place to edit when a record changes. For a small private network, that can be enough.`,
        `The wall is ownership and scale. A central table has to know every domain, accept updates from every owner, handle global query traffic, and avoid becoming a single operational and political bottleneck. Local copies make reads faster, but then freshness becomes hard. If every machine holds a stale file, a domain change does not become visible until every copy is updated.`,
        `A second naive approach is to broadcast the question. That fails even faster. Most servers have no authority for the name being asked, and the network would drown in repeated questions for popular domains. The system needs a way to ask only the servers that can move the search closer to an answer.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is to separate authority from resolution. Authority is delegated down the name tree. Resolution is the process of walking that delegation until a server with the right authority returns the record. The root does not need to know every host. It needs to know where top-level domains such as com can be found. The com servers do not need to know every host either. They need to know which authoritative nameservers own example.com.`,
        `This is trie-like, but the trie is split across institutions rather than stored in one process. The labels are read from right to left: the root, then the top-level domain, then the registered domain, then the host name. Each level only needs enough information to delegate the next step. That keeps the root small and lets each zone owner control its own data.`,
        `Caching is the other half of the idea. A recursive resolver stores answers and referrals for their time to live, or TTL. The hierarchy can be correct without being hit on every page load because repeated questions reuse recently learned answers. DNS works because delegation distributes authority and TTL-bound caches distribute load.`,
      ],
    },
    {
      heading: `How resolution works`,
      paragraphs: [
        `A browser usually starts by asking the operating system resolver. The OS checks local state and sends the question to a recursive resolver, often run by an ISP, company, public DNS provider, or local network. The recursive resolver does the walking for the client. The browser does not normally ask root, TLD, and authoritative servers itself.`,
        `On a cold miss, the recursive resolver asks a root server for www.example.com. The root returns a referral to the com nameservers. A com server returns a referral to the authoritative nameservers for example.com. One of those authoritative servers returns the requested A or AAAA record plus a TTL.`,
        `On a warm lookup, the resolver already has a valid cached answer. It can return the IP address directly to the client without contacting the hierarchy. It may also cache referrals, so later questions inside the same zone are not fully cold. Negative caching stores missing names or missing record types so typos do not repeatedly hit authoritative servers.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The cold path proves that DNS resolution is a chain of delegated questions, not one lookup in one global table. The user asks the recursive resolver. The resolver asks the root for a direction, then the TLD for a narrower direction, then the authoritative server for the final record. Each step removes a large part of the name space from consideration because authority narrows as the resolver walks downward.`,
        `The warm-cache path proves why DNS can survive global volume. The recursive resolver returns a still-valid answer in one local hop, so the upper layers stay quiet. The TTL frame proves the tradeoff: a cached answer is useful because it avoids repeated work, and risky because it may keep an old address alive until the freshness budget expires.`,
        `The node labels also prove a boundary that matters in debugging. The recursive resolver is not authoritative for the domain just because it returned the answer. It may be repeating a cached answer. The authoritative server is the source for the zone data. Confusing those roles leads to bad incident response.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Delegation works because each zone signs up for only the names below it. The root zone can delegate com. The com zone can delegate example.com. The example.com zone can publish www.example.com. No server needs to store the whole Internet name space, and no domain owner needs permission from every resolver to change its own zone data.`,
        `Caching works because DNS records are usually reusable for a short period. If ten thousand users behind the same resolver ask for the same popular site, the resolver can answer most of them from one earlier walk. TTL makes the cache contract explicit. Until the TTL expires, the resolver may reuse the record. After it expires, the resolver should refresh before treating the answer as current.`,
        `The design also tolerates partial independence. A company can change authoritative providers without changing browser code. A recursive resolver can improve cache behavior without changing domain ownership. A CDN can publish different answers by geography or client resolver while staying inside the DNS model. The pieces coordinate through records, referrals, TTLs, and protocol rules rather than one central database.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `A cold recursive lookup costs several network round trips before the application can connect. That can dominate page startup when the resolver is far away, the network is lossy, or DNSSEC validation adds work. A warm resolver hit is close to O(1) from the client point of view: one request to a nearby resolver and one response back.`,
        `The space cost is cache state across browsers, operating systems, recursive resolvers, and sometimes application runtimes. That state is worth keeping because popular names repeat constantly. LRU Cache explains the capacity pressure; Cache Invalidation & Versioning explains the freshness pressure. DNS adds TTL because invalidation messages to every resolver on the Internet are not realistic.`,
        `The main tradeoff is agility versus load. A high TTL reduces authoritative traffic and improves resilience during short authoritative outages, but it slows migrations and failover. A low TTL makes steering and recovery faster, but more resolvers have to ask more often. Setting TTL is a product and operations decision, not a cosmetic zone-file field.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every browser page, mobile API call, webhook, package install, container pull, and email delivery path depends on DNS. Web traffic commonly needs A or AAAA records. Email depends on MX records. Service discovery may use SRV, TXT, or internal naming conventions. Certificate automation may use DNS challenges to prove domain control.`,
        `CDNs use DNS as an early steering layer. The authoritative answer can point a user toward a nearby edge, a healthy region, or a traffic-management endpoint. After DNS returns an address, other structures take over: a Load Balancer chooses a backend, Consistent Hashing may select a cache shard, and CDN Request Flow handles cache hits and origin misses.`,
        `Operational migrations are built around TTL. A team lowering TTL before a move is not performing superstition. It is shortening the maximum life of old cached answers. After enough time passes for previous TTLs to drain, the team can change the authoritative record and expect most resolvers to refresh soon.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `DNS changes are not globally instant. Different users can see different answers because their recursive resolvers cached different records at different times, because authoritative servers steer by geography, or because one resolver is validating DNSSEC and another is not. "It works for me" is normal evidence in DNS debugging, not a contradiction.`,
        `The common failure is asking the wrong layer. A stale browser cache, policy-filtered recursive resolver, broken delegation, unavailable authoritative server, DNSSEC validation failure, and application outage can all look like "the site is down." Good debugging follows the chain: local cache, resolver, referral path, authoritative answer, validation, then application connection.`,
        `Authoritative concentration is another risk. A domain can have healthy web servers and still disappear if its authoritative DNS provider is unreachable. The 2016 Dyn attack made that lesson public: many major services were affected because clients could not resolve names, not because every origin server failed.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary sources: RFC 1034 for DNS concepts and facilities, RFC 1035 for implementation and specification, and RFC 2308 for negative caching. Read them with one question in mind: which server is authoritative for this answer, and how long may someone else reuse it?`,
        `Study Trie (Prefix Tree) for the name-tree shape, LRU Cache for resolver storage pressure, Cache Invalidation & Versioning for TTL tradeoffs, DNS Negative Cache & NXDOMAIN for absence caching, and DNS Serve-Stale Resolver Cache for resilience when authoritative refresh fails. Then follow CDN Request Flow, Load Balancer, Consistent Hashing, and TCP: Handshake & Congestion Control to see what happens after the name becomes an address.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A central name table works until ownership, scale, or staleness breaks it. Ownership fails first: a single authority must accept updates from every domain operator on Earth, decide conflicts, and stay available globally. No organization can run that table without becoming a political and operational bottleneck.',
        'Scale compounds the problem. Billions of queries per second hit DNS. A single server cannot absorb that load, and replicating the full table to every edge means every copy must stay synchronized as records change. Broadcasting queries is worse: most servers cannot answer most questions, so the network drowns in irrelevant traffic.',
        'Staleness is the final wall. Local copies of a flat file go stale silently. A domain owner changes an address, but clients keep connecting to the old one until every copy updates. Without an explicit freshness contract, there is no way to know whether a cached answer is still valid. DNS solves all three problems with one structure: a delegation tree that distributes authority, plus TTL-bound caches that distribute load without requiring invalidation broadcasts.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace the full cold resolution of www.example.com from a browser with an empty cache. The name reads right to left as a path through the delegation tree: root (the trailing dot), then com, then example.com, then the www host record.',
        'Step 1: The browser asks the OS stub resolver for www.example.com. The stub has no cached answer and forwards the query to the configured recursive resolver (say, 8.8.8.8). Step 2: The recursive resolver has a cold cache. It knows the addresses of the 13 root server clusters (hardcoded in a hints file). It sends a query for www.example.com to one of them, say a.root-servers.net.',
        'Step 3: The root server does not know www.example.com. It sees the rightmost label is com, so it returns a referral: "Try the .com TLD servers," along with the NS records and glue A records for those servers. Step 4: The resolver sends the same query to a .com TLD server, say a.gtld-servers.net. The TLD server does not know the host either. It returns a referral to the authoritative nameservers for example.com, typically ns1.example.com and ns2.example.com, with their glue addresses.',
        'Step 5: The resolver sends the query to ns1.example.com. This server owns the zone file for example.com. It finds the A record for www.example.com and returns 93.184.216.34 with a TTL of, say, 3600 seconds. Step 6: The resolver caches this answer and the referral chain. It returns 93.184.216.34 to the stub resolver, which returns it to the browser. The browser can now open a TCP connection to that address.',
        'Total cost: four network round trips (stub to resolver, resolver to root, resolver to TLD, resolver to authoritative). If a second user behind the same resolver asks for www.example.com within the next 3600 seconds, the resolver answers from cache in one round trip. The referral to .com TLD servers is also cached, so a later query for any .com domain skips the root entirely.',
      ],
    },
    {
      heading: 'Recursive vs iterative resolution',
      paragraphs: [
        'DNS supports two query modes. In recursive mode, the client asks one resolver to do all the work and return the final answer. The resolver chases referrals on the client\'s behalf. In iterative mode, each server returns a referral and the querying party must follow it. Most clients use recursive mode against a recursive resolver. The recursive resolver itself uses iterative mode against root, TLD, and authoritative servers.',
        'The split matters for security and load. A recursive resolver accepts the burden of chasing the full chain, which means it can cache intermediate results for many clients. Authoritative servers only answer their own zone and never chase referrals for anyone. If an authoritative server accepted recursive queries from the public internet, it could be used as a traffic amplifier in reflection attacks.',
        'Some resolvers offer a hybrid: they accept recursive queries from trusted clients (e.g., users on the same network) and refuse recursion for everyone else. This is why "open resolver" is a security concern. An open recursive resolver will chase any query for any client, making it useful for amplification and cache poisoning.',
      ],
    },
    {
      heading: 'Caching, TTL, and negative caching',
      paragraphs: [
        'Caching is what makes DNS feasible at global scale. Without it, every page load would require multiple round trips through the hierarchy. The TTL (time to live) on each record is the domain owner\'s contract with resolvers: "you may reuse this answer for this many seconds." After TTL expires, the resolver should re-query the authoritative server before treating the cached answer as current.',
        'TTL is a product decision, not a cosmetic field. A CDN serving millions of users might set a TTL of 60 seconds so it can steer traffic quickly during incidents. A rarely-changing corporate domain might set 86400 seconds (one day) to minimize authoritative load. Before a planned migration, operators lower the TTL well in advance so old cached answers drain before the address change.',
        'Negative caching stores the absence of a record. When a resolver learns that a name does not exist (NXDOMAIN) or that a specific record type is missing (NODATA), it caches that negative answer for the duration of the SOA minimum TTL. This prevents typos and dead links from repeatedly hitting authoritative servers. RFC 2308 defines the rules. Without negative caching, a popular broken link could generate sustained query floods to authoritative infrastructure.',
      ],
    },
],
};

