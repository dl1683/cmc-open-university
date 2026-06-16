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
      heading: 'What it is',
      paragraphs: [
        'The forwarding information base, or FIB, is the packet-speed route lookup table inside a router or host. Given a destination IP address, it returns the forwarding action: next hop, output interface, drop, local delivery, encapsulation, or another platform-specific action. The key rule is longest-prefix match: among all routes that match the destination, choose the most specific prefix.',
        'This is the networking version of a prefix data-structure problem. A destination such as 203.0.113.9 can match 0/0, 203/8, 203.0/16, and 203.0.113/24 at the same time. The FIB must return the /24 entry if it exists, and cleanly fall back to /16 or default if more-specific routes disappear.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The control plane builds a routing information base from BGP, static routes, connected routes, and other sources. The router then materializes selected routes into a FIB structure designed for fast lookup. A trie, PATRICIA trie, LC-trie, or hardware TCAM can all implement the same semantic contract.',
        'During lookup, the algorithm walks the destination bits and remembers the deepest route-bearing prefix seen so far. A later branch may be missing; the answer is still the saved best prefix. This is the same "best so far" variable taught in PATRICIA Trie, but now the consequence is packet forwarding correctness.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The hot path must be tiny: parse the destination address, find the most specific prefix, fetch the next-hop action, and forward. The harder work happens off the hot path: route selection, prefix insertion and withdrawal, next-hop liveness, atomic publication, and table compaction. Software routers care about cache locality and update consistency; hardware routers care about TCAM capacity, power, and rule priority.',
        'Linux documents its IPv4 fib_trie as an LC-trie implementation. Its lookup notes describe searching for the longest matching prefix and backtracking when a direct child search misses. That is exactly the implementation detail the animation emphasizes: a failed deeper path must still recover the best matching ancestor.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A router receives a packet for 203.0.113.9. Its FIB contains a default route, a 203/8 route, a 203.0/16 route, and a 203.0.113/24 route. Lookup walks the prefix structure and updates best from default to /8 to /16 to /24. The /24 points to edge interface eth2, so the packet is forwarded there.',
        'Minutes later the /24 is withdrawn because the next hop fails. The update removes that leaf but leaves the /16 route in place. The next packet for 203.0.113.9 now falls back to the /16 action instead of using a stale next hop or dropping unnecessarily. That small example captures the operational requirement: prefix lookup and route updates must preserve fallback semantics.',
      ],
    },
    {
      heading: 'Links to the rest of the site',
      paragraphs: [
        'PATRICIA Trie explains the compressed prefix shape. BGP Route Selection RIB Case Study explains how routes become candidates before they enter the forwarding table. Cilium eBPF Datapath Case Study shows a modern datapath where service, policy, and connection-tracking maps sit beside route lookup. Hierarchical Heavy Hitters uses the same IP-prefix hierarchy for telemetry rather than forwarding.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 1812, "Requirements for IP Version 4 Routers", defines the most-specific matching route requirement: https://datatracker.ietf.org/doc/html/rfc1812. Linux kernel LC-trie notes describe fib_trie lookup and backtracking: https://docs.kernel.org/networking/fib_trie.html. For the compressed-trie foundation, revisit PATRICIA Trie and the Morrison paper linked there. Study eBPF LPM Trie CIDR Policy Case Study, BGP Route Selection RIB Case Study, PATRICIA Trie, Trie, Cilium eBPF Datapath Case Study, Hierarchical Heavy Hitters, and Elastic Sketch next.',
      ],
    },
  ],
};
