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
      heading: 'What it is',
      paragraphs: [
        `DNS (Domain Name System) is the distributed database that translates human-readable domain names like www.example.com into IP addresses like 93.184.216.34. Rather than storing all domains in one place — impossible given billions of domains and the traffic load — DNS distributes authority using a hierarchy mirroring the domain name's right-to-left structure: (root) → .com (TLD) → example.com (authoritative). This is a Trie (Prefix Tree) carved into the internet itself.`,
        `At each level, a nameserver knows only its immediate children. The root knows "ask .com's servers"; .com knows "ask example.com's servers"; only example.com's authoritative server knows the answer. The query walks down this tree in milliseconds because caches sit at every layer — browser, OS, ISP resolver, and the recursive resolver's own LRU Cache — each equipped with TTL expiry timers that enforce freshness. The result: one slow walk (50–100ms) pays for an hour of ~1ms cached answers for the entire neighborhood.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A cold lookup (no cache hit) begins at a root server. There are 13 root server identities (a through m, run by operators like Verisign and ISC), but each is actually hundreds of machines sharing a single IP via anycast routing — a trick that lets packets automatically find the geographically nearest copy. The root answers "I don't know example.com, but these are the .com servers." Next, your resolver contacts a .com TLD server (Verisign runs the authoritative .com registry, handling trillions of queries daily), which responds with referrals to example.com's nameservers. Finally, the authoritative server (run by the domain owner or a provider like Route 53 or Cloudflare) returns the actual record: an A record mapping the domain to an IP, together with a TTL — say, 3600 seconds (one hour). The resolver caches this and every referral along the way, then returns the IP to your browser. The entire cold walk costs three to four round trips, roughly 50–100ms in practice.`,
        `Warm caches (the common case) skip almost all of this. A resolver seeing the same domain a second time (within the TTL window) returns the cached IP in a single network hop, ~1ms, without ever consulting root or TLD servers. This efficiency — caches absorbing ~99% of the load — is why the planetary DNS hierarchy survives. Operators play a careful trade-off with TTL: high TTLs (24 hours) mean fewer queries but slow propagation if you move your server; low TTLs (60 seconds) enable agility and traffic steering (GeoDNS can redirect users to the nearest data center, but requires sub-minute caches everywhere) but force re-queries constantly. CDNs and failover systems use low TTLs; static sites use high ones.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `DNS's genius is its efficiency despite scale. The hierarchical design ensures that no single server needs to know all domains — authority is delegated downward, load is distributed horizontally across 13 root identities and thousands of TLD and authoritative servers. Caching is the multiplier: every cache miss cascades into one query path, but a single cache hit serves hundreds of clients. The protocol itself (primarily UDP, fast and stateless) assumes some packets are lost and tolerates it. The architectural cost is consistency: if you change your domain's IP, it doesn't propagate instantly to the entire internet. Resolvers and browsers hold onto the old IP until the TTL expires, a delay measured in minutes to hours. This isn't a bug — it's the trade-off you've chosen by setting your TTL.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every URL you type goes through DNS. Every email address, every mobile app, every API call first asks "what's the IP?" Your browser caches answers for seconds; your OS caches them for longer; your ISP's resolver (or public resolvers like Google's 8.8.8.8 or Cloudflare's 1.1.1.1) cache globally. CDNs exploit DNS's low TTLs to steer traffic: a user in London gets a different IP than a user in Tokyo, both resolving the same domain, because the authoritative server can return location-aware answers. Route 53 (AWS's DNS provider) and Cloudflare do this constantly, measuring your geographic location and routing you to the nearest server. Failover systems use the same trick — detect a server down, rotate the IP to a backup, and rely on low TTLs to propagate the change. Distributed denial-of-service attacks often target DNS itself; one of the internet's critical points despite its distributed design.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `New engineers often assume DNS answers are globally consistent and instantaneous. Neither is true. A domain's TTL can hide changes from users for hours; DNS can be spoofed (DNS-over-HTTPS and DNSSEC protect against this); and caching at multiple layers (browser, OS, resolver) means the same query asked milliseconds apart might get different answers. If a resolver's cache expires and the authoritative server is down, lookups fail — DNS failures are invisible until something can't find the domain. The 2016 Dyn outage (October 21, attacking the DNS provider's infrastructure) illustrates the single point of failure: though Dyn wasn't a root or TLD server, its authoritative nameservers handled millions of domains. Twelve hours of downtime silently dropped Twitter, Spotify, GitHub, and Airbnb off the internet without any packets reaching their servers — the DNS blackout meant no IP address to send packets to. The lesson: DNS is decentralized in architecture but concentrated in practice; most domains use the same few providers (Route 53, Cloudflare, Dyn itself), so a single provider's outage cascades.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `DNS's core patterns appear everywhere in computer science. Explore Trie (Prefix Tree) for the hierarchical organization at the heart of domain names and prefix-matching algorithms. Understand LRU Cache to see how caches evict stale data and enforce capacity bounds — the same pattern your resolver uses. Study CDN Request Flow to see how DNS steering (GeoDNS) routes users and how content delivery networks rely on short TTLs. Dive into Consistent Hashing to understand how nameservers and other distributed services balance load without coordination. And finally, Load Balancer shows how traffic is split across multiple servers — the same problem DNS solves at the application level, the same trade-offs apply.`,
      ],
    },
  ],
};
