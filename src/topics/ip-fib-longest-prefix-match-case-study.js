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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows packet forwarding through a forwarding information base, or FIB. A prefix is the leading bit pattern of an IP address, written with a length such as 203.0.113.0/24. A route-bearing trie node has a forwarding action. A lookup walks the destination address bits and remembers the deepest route-bearing node seen so far.',
        'Active nodes are the current trie position or update target. Found nodes are candidate routes that match the destination. Compare nodes show prefixes that are being tested but do not win. The safe inference rule is that a missing deeper child cannot invalidate an already matched ancestor.',
        {type:'callout', text:'Longest-prefix match works because lookup remembers the deepest route-bearing ancestor while walking the destination address path.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/65/Radix_tree.svg', alt:'Radix tree diagram with compressed prefix branches', caption:'Radix tree diagram by Cmglee, via Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A router must choose an outgoing interface for each packet. The routing system can know many overlapping routes for the same destination: a default route, a provider block, a regional block, and a customer subnet. Packet forwarding needs the most specific matching route without rerunning the routing protocol.',
        'The routing information base, or RIB, is the control-plane set of candidate routes and policies. The FIB is the compiled data-plane structure used on the hot path. Longest-prefix match is the contract that makes overlapping CIDR routes deterministic.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a list of routes. For each packet, scan the list, test whether the destination shares the route prefix, and keep the longest matching entry. This is easy to write and correct for a small lab table.',
        'Sorting by prefix length improves early wins but does not remove the scan in the worst case. A table with 1,000,000 prefixes can still test many masks per packet. Updating the sorted list under churn also mixes control-plane work with data-plane lookup cost.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is overlap. A destination such as 203.0.113.9 may match 0.0.0.0/0, 203.0.0.0/8, 203.0.0.0/16, and 203.0.113.0/24. The answer is not the first route, the newest route, or the route with the largest block. It is the matching route with the greatest prefix length.',
        'The second wall is packet rate. A software router or kernel datapath cannot afford broad per-packet scans when route count grows. The lookup must be bounded mainly by address width or hardware priority, not by the number of prefixes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Shape the data structure like the address. A trie stores prefixes along address-bit paths. The root can hold the default route. Each step down consumes more bits, so deeper matching route nodes are more specific.',
        'The lookup variable is saved best. While walking the destination path, every route-bearing node becomes the best answer so far. If the next branch is missing, no deeper prefix on that path exists, so saved best is the longest matching prefix.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To insert 203.0.113.0/24, the FIB builder follows the first 24 address bits, creates structural nodes as needed, and stores the forwarding action at that node. To lookup 203.0.113.9, it starts at the root, records any default action, then follows the destination bits while updating saved best at each route-bearing node.',
        'Real implementations compress the shape. A PATRICIA trie or LC-trie skips one-child stretches and compares chunks, while TCAM hardware compares masked entries in parallel and uses priority to choose the longest prefix. The machinery differs, but the semantic rule is unchanged.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For one destination address, every matching prefix must be an ancestor on that destination path. A prefix that differs in any consumed bit is on a different branch and cannot match. A prefix longer than the point where lookup stops cannot exist on the path because the needed child was missing.',
        'Saved best is therefore sufficient. Each replacement of saved best is deeper than the previous one, so it is more specific. When the walk ends, no unseen off-path prefix can match, and no unseen on-path prefix exists. The saved action is exactly the longest matching prefix.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A plain binary trie performs at most 32 steps for IPv4 and 128 steps for IPv6, independent of route count. Compressed tries reduce steps by grouping bits and improving cache locality, but they add checks so skipped bits still match. TCAM can answer in one parallel lookup, but it spends expensive silicon, power, and limited table capacity.',
        'Updates have their own cost. Inserting a prefix can allocate nodes or update hardware entries. Withdrawing a prefix must remove only that route action, not the covering fallback route. Concurrent datapaths need epochs or atomic publication so each packet sees one consistent FIB version.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Longest-prefix match is used in host route tables, Linux fib_trie, software routers, hardware routers, firewalls, load balancers, eBPF LPM maps, service meshes, and CIDR policy engines. The fit is strongest when broad rules need narrower exceptions.',
        'The same idea appears in telemetry aggregation. A system may count traffic for 10.0.0.0/8, then override or split 10.20.30.0/24 for a region or customer. Prefix hierarchy lets broad and narrow views coexist.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Longest-prefix match is wrong for exact unordered keys. A connection table keyed by a five-tuple belongs in a hash table. A policy engine that needs arbitrary predicates should compile policy before lookup rather than put all logic inside the FIB.',
        'Operational failures are more dangerous than algorithmic confusion. A stale next hop can blackhole traffic. A mixed update can send packets inconsistently. A compressed trie without verification can create false matches. A hardware table overflow can force slow software fallback.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume these routes: 0.0.0.0/0 to ISP-A, 203.0.0.0/8 to ISP-B, 203.0.113.0/24 to customer-C, and 203.0.113.128/25 to scrubbing-D. A packet for 203.0.113.9 matches the first three routes but not the /25. Saved best ends at /24, so the packet goes to customer-C.',
        'A packet for 203.0.113.200 matches all four routes because 200 is inside the upper half covered by /25. Saved best becomes /25 and the packet goes to scrubbing-D. If the /25 is withdrawn, the same packet falls back to /24, not to default, because /24 remains the deepest matching ancestor.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 1812 Requirements for IP Version 4 Routers at https://datatracker.ietf.org/doc/html/rfc1812 and Linux fib_trie documentation at https://docs.kernel.org/networking/fib_trie.html. For compressed tries, study Morrison, PATRICIA, Practical Algorithm To Retrieve Information Coded In Alphanumeric, 1968.',
        'Study trie, radix tree, PATRICIA trie, CIDR, BGP route selection, Linux routing, eBPF LPM trie maps, TCAM, and route update epochs next. The core exercise is to trace saved best on a route table with overlapping prefixes.',
      ],
    },
  ],
};