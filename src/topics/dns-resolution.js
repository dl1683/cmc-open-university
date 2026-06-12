// DNS resolution: how "www.example.com" becomes an IP address — a walk
// down a planetary tree of name servers, made instant by caches with
// expiry timers at every layer. The internet's original distributed system.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'dns-resolution',
  title: 'How DNS Works',
  category: 'Systems',
  summary: 'Root → TLD → authoritative: the hierarchical lookup behind every URL, and the caches that skip it.',
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
    explanation: 'You type www.example.com. The browser needs an IP address, and there is no global phonebook — no single machine could hold every domain or survive the traffic. DNS\'s 1983 answer still runs the internet: a HIERARCHY of name servers, where the domain name itself is the path — read it right to left: (root) → com → example → www. The same shape as a Trie (Prefix Tree), distributed across the planet.',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['lr', 'R'] },
    explanation: `First stop: caches. The browser checks its own cache, the OS checks its, and the question lands at the RESOLVER (your ISP's, or 8.8.8.8 / 1.1.1.1) — whose job is to do the full lookup so nobody else has to. ${cold ? 'COLD cache today: the resolver has never seen example.com (or its entry expired). Time to walk the tree.' : 'WARM cache: the resolver answered example.com an hour ago and the entry is still fresh…'}`,
  };

  if (!cold) {
    yield {
      state: snapshot(),
      highlight: { found: ['R', 'lr'] },
      explanation: 'Cache HIT: the resolver returns 93.184.216.34 instantly — one network hop, ~1ms, and the root/TLD/authoritative servers never hear about it. This is the overwhelmingly common case: the global DNS hierarchy survives BECAUSE caches absorb almost everything (an LRU Cache with expiry timers, at every layer).',
    };
    yield {
      state: snapshot(),
      highlight: { found: ['R'] },
      explanation: 'The expiry timer is the TTL (time-to-live) the domain owner chose. High TTL (a day): fewer lookups, but changes propagate slowly — move your server and some users hit the old IP for hours. Low TTL (60s): agile — this is how CDN Request Flow\'s GeoDNS steers traffic and how failover works — but every minute, caches everywhere re-ask. The cache invalidation trade-off, planet-sized. Re-run with a cold cache to see what the TTL is saving you from.',
    };
    return;
  }

  yield {
    state: snapshot(),
    highlight: { active: ['rroot', 'ROOT'] },
    explanation: 'The resolver asks a ROOT server: "www.example.com?" The root knows almost nothing — by design. It answers with a REFERRAL: "I don\'t know, but the .com servers live at these addresses." Thirteen root server identities (a–m), each actually hundreds of machines sharing an IP via anycast routing, serve the entire planet this one tiny job.',
    invariant: 'Each level of the tree only knows its children — no server holds the whole map.',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['rtld', 'TLD'], visited: ['ROOT'] },
    explanation: 'Next: a .com TLD server (run by the registry — Verisign for .com, handling trillions of queries a day). Same shape of answer, one level deeper: "example.com\'s nameservers are ns1.example.com at this IP." Another referral, another step down the trie.',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['rauth', 'AUTH'], visited: ['ROOT', 'TLD'] },
    explanation: 'Finally the AUTHORITATIVE server — the one that actually holds example.com\'s records (run by the domain\'s owner or their DNS provider: Route 53, Cloudflare…). It answers, not with a referral, but with the RECORD: "www.example.com A 93.184.216.34, TTL 3600."',
  };

  yield {
    state: snapshot(),
    highlight: { found: ['R', 'lr', 'L'], visited: ['ROOT', 'TLD', 'AUTH'] },
    explanation: 'The resolver CACHES the answer (and the referrals!) for the TTL, hands the IP to your browser, and the TCP connection finally begins. The cold walk cost ~4 round trips (~50–100ms); every neighbor asking for example.com within the next hour gets the ~1ms cached answer. One slow lookup pays for a city — the same warm-the-cache economics as the CDN Request Flow.',
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'Appreciate what this design survived: forty years of growth from a few hundred hosts to billions, with no central operator and no flag day. The tree distributes AUTHORITY (each level delegates downward), caches distribute LOAD, TTLs trade freshness for traffic — and when DNS itself fails, "the whole internet" appears to die (the 2016 Dyn outage took down Twitter, Spotify, and GitHub without touching any of their servers). The most successful distributed database ever shipped, and you walk its tree before every page load.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `DNS is the distributed database that turns a name such as www.example.com into an IP address. It is not one global phonebook. Authority is delegated down a hierarchy that mirrors the domain name from right to left: root, then com, then example.com, then a host record. That makes DNS feel like a Trie (Prefix Tree) spread across organizations instead of memory.`,
        `The visualization follows a resolver through that tree. The root does not know the final answer; it knows where com lives. The com TLD does not know the address; it knows the authoritative nameserver for example.com. The authoritative server finally returns the record and a TTL. Then caches make the next lookup cheap.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A cold lookup starts after browser and OS caches miss. The recursive resolver asks a root server. There are 13 root identities, named a through m, but each identity is served by many machines using anycast. The root returns a referral to the com servers. The resolver asks com, receives a referral to the domain's authoritative servers, then asks one of those for the A or AAAA record. The demo uses 93.184.216.34 and TTL 3600, meaning the answer may be reused for one hour.`,
        `A warm lookup skips the tree. The resolver returns the cached answer in one network hop, often around a millisecond on a local network. That is why DNS scales. Browser caches, OS caches, ISP or public resolvers, and authoritative-side caches all absorb repeat traffic. LRU Cache explains the capacity side; TTL explains the freshness side.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A cold recursive lookup is usually three or four resolver round trips before TCP: Handshake & Congestion Control can even start the connection. A warm lookup is O(1) from the client's point of view. DNS mostly uses UDP for speed, but TCP, DoT, and DoH are common for large responses, privacy, or policy. The architectural cost is consistency: if an IP changes, caches may keep the old answer until TTL expiry. Low TTLs improve agility and raise query load; high TTLs reduce load and slow failover.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every browser page, mobile API call, email route, and CDN Request Flow begins with DNS. CDN providers use GeoDNS and short TTLs to steer users toward nearby edges. Consistent Hashing may then choose a cache machine inside that edge, and a Load Balancer may choose an origin on a miss. Service Workers & Offline-First can skip some network requests after the page has been installed, but the first visit still depends on name resolution.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `DNS answers are not globally instant. Different users can see different answers because caches expire at different times or because authoritative servers intentionally steer by location. DNSSEC can validate signed data; DNS-over-HTTPS encrypts the path to a resolver; neither removes the need to trust the resolver's policy. Cache Invalidation & Versioning is the operational heart of DNS changes.`,
        `The 2016 Dyn outage showed the concentration risk. Dyn was not a root or TLD operator, but many major domains depended on its authoritative nameservers. When those nameservers were attacked, users could not discover IP addresses for sites whose servers were otherwise healthy.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Trie (Prefix Tree), LRU Cache, and Cache Invalidation & Versioning for the local patterns inside DNS. Then follow CDN Request Flow, Consistent Hashing, and Load Balancer to see how the returned IP becomes an actual path to content. TCP: Handshake & Congestion Control is the next packet-level step after the name resolves.`,
      ],
    },
  ],
};
