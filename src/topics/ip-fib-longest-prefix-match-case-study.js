// IP FIB longest-prefix match: the route table as a data-structure problem.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ip-fib-longest-prefix-match-case-study',
  title: 'IP FIB Longest-Prefix Match Case Study',
  category: 'Systems',
  summary: 'Forwarding tables choose the most specific matching route: walk prefix bits, remember the deepest route, and keep packet lookup separate from route selection.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lookup walk', 'fib updates'], defaultValue: 'lookup walk' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function fibTrie(title) {
  return graphState({
    nodes: [
      { id: 'root', label: '0/0', x: 0.8, y: 4.2, note: 'default' },
      { id: 'p10', label: '10/8', x: 2.4, y: 2.0, note: 'corp' },
      { id: 'p203', label: '203/8', x: 2.4, y: 4.2, note: 'peer A' },
      { id: 'p198', label: '198/8', x: 2.4, y: 6.4, note: 'peer B' },
      { id: 'p2030', label: '203.0/16', x: 4.4, y: 3.3, note: 'metro' },
      { id: 'p20355', label: '203.55/16', x: 4.4, y: 5.1, note: 'cdn' },
      { id: 'p2030113', label: '203.0.113/24', x: 6.7, y: 3.3, note: 'edge' },
      { id: 'miss', label: '/25 miss', x: 8.7, y: 2.0, note: 'no branch' },
      { id: 'out', label: 'eth2', x: 8.7, y: 4.6, note: 'forward' },
    ],
    edges: [
      { id: 'e-root-10', from: 'root', to: 'p10', weight: '10' },
      { id: 'e-root-203', from: 'root', to: 'p203', weight: '203' },
      { id: 'e-root-198', from: 'root', to: 'p198', weight: '198' },
      { id: 'e-203-2030', from: 'p203', to: 'p2030', weight: '.0' },
      { id: 'e-203-20355', from: 'p203', to: 'p20355', weight: '.55' },
      { id: 'e-2030-2030113', from: 'p2030', to: 'p2030113', weight: '.113' },
      { id: 'e-2030113-miss', from: 'p2030113', to: 'miss', weight: 'next bits' },
      { id: 'e-2030113-out', from: 'p2030113', to: 'out', weight: 'best' },
    ],
  }, { title });
}

function controlPlaneGraph(title) {
  return graphState({
    nodes: [
      { id: 'bgp', label: 'BGP', x: 0.7, y: 2.4, note: 'paths' },
      { id: 'static', label: 'static', x: 0.7, y: 4.7, note: 'manual' },
      { id: 'rib', label: 'RIB', x: 2.8, y: 3.5, note: 'best' },
      { id: 'compile', label: 'build', x: 4.9, y: 3.5, note: 'index' },
      { id: 'fib', label: 'FIB', x: 7.0, y: 3.5, note: 'hot' },
      { id: 'packet', label: 'packet', x: 9.1, y: 3.5, note: 'dst' },
    ],
    edges: [
      { id: 'e-bgp-rib', from: 'bgp', to: 'rib', weight: 'sel' },
      { id: 'e-static-rib', from: 'static', to: 'rib', weight: 'add' },
      { id: 'e-rib-compile', from: 'rib', to: 'compile', weight: '' },
      { id: 'e-compile-fib', from: 'compile', to: 'fib', weight: '' },
      { id: 'e-fib-packet', from: 'fib', to: 'packet', weight: 'LPM' },
    ],
  }, { title });
}

function* lookupWalk() {
  yield {
    state: controlPlaneGraph('Route selection feeds packet forwarding'),
    highlight: { active: ['bgp', 'static', 'rib', 'e-bgp-rib', 'e-static-rib'], compare: ['fib', 'packet'] },
    explanation: 'The routing information base decides which routes are valid. The forwarding information base is the packet-speed structure built from those routes. Separating them keeps complex policy off the per-packet path.',
    invariant: 'The FIB answers "where should this packet go now?", not "which protocol should win?".',
  };

  yield {
    state: fibTrie('Destination 203.0.113.9 walks the prefix structure'),
    highlight: { active: ['root', 'p203', 'p2030', 'p2030113', 'e-root-203', 'e-203-2030', 'e-2030-2030113'], found: ['out'] },
    explanation: 'Longest-prefix match walks the destination bits or compressed prefix chunks. At every route-bearing node, lookup remembers that node as the best candidate so far. The deepest remembered prefix wins.',
  };

  yield {
    state: labelMatrix(
      'Matching candidates for 203.0.113.9',
      [
        { id: 'dflt', label: '0/0' },
        { id: 'p203', label: '203/8' },
        { id: 'p2030', label: '203.0/16' },
        { id: 'p2030113', label: '203.0.113/24' },
        { id: 'p2030113128', label: '203.0.113.128/25' },
      ],
      [
        { id: 'match', label: 'match?' },
        { id: 'len', label: 'prefix len' },
        { id: 'next', label: 'next hop' },
      ],
      [
        ['yes', '0', 'internet'],
        ['yes', '8', 'peer A'],
        ['yes', '16', 'metro'],
        ['yes', '24', 'edge eth2'],
        ['no', '25', 'not used'],
      ],
    ),
    highlight: { active: ['dflt:match', 'p203:match', 'p2030:match'], found: ['p2030113:next'], compare: ['p2030113128:match'] },
    explanation: 'Several routes can match the same destination. The answer is not the first match and not the route with the lowest numeric address. It is the matching prefix with the greatest prefix length.',
  };

  yield {
    state: fibTrie('A missing child still returns the best ancestor'),
    highlight: { active: ['p2030113', 'miss', 'e-2030113-miss'], found: ['out', 'e-2030113-out'], compare: ['p20355'] },
    explanation: 'The lookup may run out of trie branches before it consumes every destination bit. That is not failure. The saved best route, here 203.0.113/24, still forwards the packet.',
  };

  yield {
    state: labelMatrix(
      'How forwarding data structures differ',
      [
        { id: 'plain', label: 'plain trie' },
        { id: 'patricia', label: 'PATRICIA' },
        { id: 'lctrie', label: 'LC-trie' },
        { id: 'tcam', label: 'TCAM' },
      ],
      [
        { id: 'idea', label: 'idea' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['one bit per level', 'simple but tall'],
        ['skip one-child paths', 'compact software index'],
        ['compressed child arrays', 'fast large IPv4 tables'],
        ['parallel hardware match', 'fast but expensive'],
      ],
    ),
    highlight: { active: ['patricia:idea', 'lctrie:idea'], found: ['tcam:tradeoff'] },
    explanation: 'The same semantic contract can sit on different machinery. Software routers often use compressed tries or related prefix indexes; hardware routers may use TCAM. The invariant is the same: most specific matching route wins.',
  };
}

function* fibUpdates() {
  yield {
    state: controlPlaneGraph('Route changes are compiled into the hot-path FIB'),
    highlight: { active: ['rib', 'compile', 'fib', 'e-rib-compile', 'e-compile-fib'], found: ['packet'] },
    explanation: 'When BGP, static routes, or connected routes change, the router updates its RIB first. The FIB is then updated or rebuilt so packet lookup can stay small, deterministic, and fast.',
  };

  yield {
    state: labelMatrix(
      'FIB update cases',
      [
        { id: 'insert', label: 'insert /24' },
        { id: 'withdraw', label: 'withdraw /24' },
        { id: 'nh', label: 'next-hop down' },
        { id: 'metric', label: 'better route' },
      ],
      [
        { id: 'touch', label: 'touches' },
        { id: 'risk', label: 'risk' },
        { id: 'guard', label: 'guardrail' },
      ],
      [
        ['one prefix path', 'wrong split', 'verify route key'],
        ['leaf plus cleanup', 'over-prune', 'fallback ancestor'],
        ['many prefixes', 'blackhole', 'atomic publish'],
        ['same prefix', 'stale next hop', 'versioned entry'],
      ],
    ),
    highlight: { active: ['withdraw:risk', 'nh:touch'], found: ['withdraw:guard', 'nh:guard'] },
    explanation: 'Updates are local in the data structure but broad in effect. If a next hop fails, many prefixes can change. If a specific route is withdrawn, less-specific routes must remain available as fallback.',
  };

  yield {
    state: fibTrie('Withdraw the /24 and fall back to /16'),
    highlight: { removed: ['p2030113', 'e-2030-2030113', 'e-2030113-out'], found: ['p2030'], active: ['root', 'p203', 'p2030'] },
    explanation: 'When 203.0.113/24 disappears, packets for 203.0.113.9 should not automatically drop. The lookup now remembers 203.0/16 as the deepest matching route and forwards according to that entry.',
    invariant: 'Removing a specific prefix must not remove its covering route.',
  };

  yield {
    state: labelMatrix(
      'Lookup checks that make compression safe',
      [
        { id: 'bits', label: 'prefix bits' },
        { id: 'route', label: 'route entry' },
        { id: 'best', label: 'best pointer' },
        { id: 'epoch', label: 'FIB epoch' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'bug', label: 'bug if missing' },
      ],
      [
        ['prove match', 'false positive'],
        ['next hop and action', 'no forwarding action'],
        ['deepest terminal', 'default too often'],
        ['consistent snapshot', 'mixed old/new routes'],
      ],
    ),
    highlight: { active: ['best:purpose', 'epoch:purpose'], compare: ['bits:bug'] },
    explanation: 'Compressed prefix structures remove redundant shape, not semantics. Implementations still need exact prefix checks, a remembered best route, and a consistent publication model for concurrent readers.',
  };

  yield {
    state: controlPlaneGraph('The data structure boundary is the systems boundary'),
    highlight: { active: ['rib', 'compile'], found: ['fib', 'packet'], compare: ['bgp', 'static'] },
    explanation: 'This is why FIB lookup is a core systems case study. BGP can spend time applying policy, comparing paths, and reconverging. The FIB has to answer millions of packet lookups with a compact data structure and a stable invariant.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lookup walk') yield* lookupWalk();
  else if (view === 'fib updates') yield* fibUpdates();
  else throw new InputError('Pick an IP FIB view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'An IP router receives a packet, looks at the destination address, and must choose an outgoing interface before the next packet arrives. The hard part is that the routing system may know many overlapping truths about the same address. There is a default route for everything, a provider route for a large block, a regional route for a smaller block, and a customer or edge route for one subnet inside that region.',
        'The forwarding information base, or FIB, exists because the hot path cannot run the whole routing protocol. BGP, static routes, connected interfaces, policy, metrics, and next-hop reachability all belong in route selection. Packet forwarding needs a compact data structure with one semantic contract: among all prefixes that match the destination, use the most specific one.',
        {type:'callout', text:'Longest-prefix match works because lookup remembers the deepest route-bearing ancestor while walking the destination address path.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/65/Radix_tree.svg', alt:'Radix tree diagram with compressed prefix branches', caption:'Radix tree diagram by Cmglee, via Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'A reasonable first implementation stores routes in a list and scans it for a match. Each route has a network prefix, a prefix length, and a next hop. For a small lab router, this is easy to write and easy to inspect: test whether the destination address shares the prefix bits, remember a matching entry, and forward using that entry.',
        'The list approach teaches the rule but wastes the structure inside the addresses. If the list is unsorted, the first matching entry may be the default route even though a /24 appears later. If the list is sorted by prefix length, every lookup still pays for many failed tests. If the list is maintained under route churn, sorting and scanning become a data-plane tax caused by control-plane complexity.',
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        'The wall is overlap. Prefixes are not disjoint keys. A packet for 203.0.113.9 can match 0/0, 203/8, 203.0/16, and 203.0.113/24 at the same time. The answer is not the route with the lowest numeric address, the route learned first, or the route from the protocol with the most interesting story. The answer is the matching prefix with the greatest prefix length.',
        'The second wall is separation of concerns. A router can spend real time deciding which route is best when BGP changes, but it cannot spend that time per packet. The routing information base is the policy-rich control-plane view. The FIB is the compiled packet-speed view. Mixing them makes forwarding slow, nondeterministic, and hard to update atomically.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'Longest-prefix match becomes simple when the route table is shaped like the address space. A trie stores prefixes along paths of address bits. The root represents the default route. Moving downward consumes more destination bits. A route-bearing node is a candidate answer. The deepest candidate on the destination path is the most specific matching route.',
        'The key variable is saved best. Lookup does not need to know in advance where the deepest match is. It walks the address path, and whenever it reaches a node with a forwarding action, it records that action as the best answer so far. If the next branch is missing, the lookup stops and returns the saved best. A failed descent is not a failed lookup when an ancestor route already matched.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A production router usually builds the FIB from the selected routes in the RIB. BGP may offer several paths for the same prefix; static routes and connected routes may compete; next-hop reachability may change. After that selection step, the compiled FIB entry contains the destination prefix, next-hop action, output interface, and any hardware or software metadata needed for forwarding.',
        'The trie in this case study is compressed for display: it jumps by visible chunks such as 203, 203.0, and 203.0.113. Real software routers often compress one-child paths with PATRICIA-style structures or LC-tries. Hardware routers often use TCAM, which compares many masked entries in parallel. Those implementations differ in machinery, but they preserve the same rule: find all matching prefixes, then choose the most specific match.',
        'Updates preserve the same boundary. Inserting a /24 creates or updates a route-bearing node without changing the meaning of its /16 ancestor. Withdrawing the /24 removes that specific forwarding action, then cleanup may delete empty structural nodes. It must not delete the covering /16 route. A next-hop failure can affect many prefixes, so implementations need versioning or atomic publication so readers do not see a half-updated FIB.',
      ],
    },
    {
      heading: 'Visual Proof',
      paragraphs: [
        'The lookup walk proves why first match is wrong. The destination 203.0.113.9 starts at default, then reaches 203/8, then 203.0/16, then 203.0.113/24. Every one of those prefixes is a valid match. The table of candidates makes the proof explicit: the /25 does not match, the /24 does match, and the prefix length orders the valid candidates.',
        'The missing-child step proves the saved-best invariant. A lookup may run out of trie branches before it has consumed every destination bit. That only means there is no more-specific prefix stored for those next bits. The saved /24 still matches all addresses inside its block. Returning it is correct because no deeper matching route was found on the only path that could contain one.',
        'The update view proves the fallback rule. When 203.0.113/24 is withdrawn, packets for 203.0.113.9 should not suddenly disappear if 203.0/16 still exists. The deepest remaining matching ancestor becomes the answer. That is why deletion logic must distinguish structural cleanup from route removal.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Correctness comes from the prefix path. For a destination address, every matching prefix must be an ancestor on the path defined by that address. A prefix that differs in any consumed bit lies on another branch and cannot match. A prefix that is longer than the point where the path stops cannot be present as a matching route, because its branch was missing.',
        'The saved-best variable is therefore enough. Initially it may hold the default route. Each time lookup reaches a matching route node, the new candidate is deeper than every earlier candidate and therefore more specific. When walking stops, no unseen route outside the path can match the destination, and no unseen deeper route on the path exists in the structure. The saved candidate is exactly the longest matching prefix.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'A plain binary trie lookup is bounded by address width: at most 32 bit decisions for IPv4 and 128 for IPv6. That bound is independent of the number of routes, which is the point. Compressed tries reduce height by skipping deterministic one-child stretches and grouping child choices, but they need exact prefix checks so compression never invents a false match.',
        'Memory and updates are the tax. A route table is not only keys; it stores next hops, output interfaces, adjacency information, counters, and sometimes hardware handles. Compressed software structures improve cache behavior but complicate insertion, deletion, and concurrent readers. TCAM gives parallel masked lookup with priority, but capacity, power, cost, and update behavior become hardware constraints.',
      ],
    },
    {
      heading: 'Uses and Failure Modes',
      paragraphs: [
        'Longest-prefix match is used in host routing tables, software routers, hardware routers, firewalls, load balancers, service meshes, eBPF datapaths, and CIDR policy engines. The fit is real whenever keys are hierarchical bit prefixes and the most-specific enclosing rule should win. The same idea appears in telemetry when traffic is aggregated by prefix and in policy engines when broad allow rules need narrower exceptions.',
        'It is the wrong tool when keys are exact and unordered. A hash table is better for exact connection lookup. A balanced tree is better when predecessor or range order matters over arbitrary keys. A route-policy engine belongs before the FIB, not inside each packet lookup. The FIB should answer a compiled forwarding question, not rerun route selection.',
        'The failure modes are operational. A stale next hop can blackhole traffic. A mixed old/new update can send packets inconsistently. A compressed trie without prefix verification can create false positives. A deletion bug can remove a fallback route. A hardware table can overflow and force unexpected software slow paths. The invariant to defend is simple: every packet sees one consistent FIB epoch and the deepest valid matching route in that epoch.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: RFC 1812, Requirements for IP Version 4 Routers, defines the most-specific matching route requirement at https://datatracker.ietf.org/doc/html/rfc1812. Linux kernel LC-trie notes describe fib_trie lookup and backtracking at https://docs.kernel.org/networking/fib_trie.html. For the compressed-trie foundation, study PATRICIA Trie and the Morrison paper linked from that topic.',
        'Study Trie first if prefix paths are still unfamiliar. Study PATRICIA Trie for compressed shape, BGP Route Selection RIB Case Study for the control-plane side, eBPF LPM Trie CIDR Policy Case Study for software policy maps, Cilium eBPF Datapath Case Study for modern packet processing, and Hierarchical Heavy Hitters or Elastic Sketch for telemetry over the same prefix hierarchy.',
      ],
    },
  ],
};
