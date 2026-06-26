// eBPF LPM trie maps: longest-prefix match for routing and CIDR policy
// using prefixlen,data keys inside kernel BPF maps.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ebpf-lpm-trie-cidr-policy-case-study',
  title: 'eBPF LPM Trie CIDR Policy Case Study',
  category: 'Systems',
  summary: 'A kernel-map case study: BPF_MAP_TYPE_LPM_TRIE, prefixlen/data keys, big-endian IP bytes, longest-prefix lookup, no-prealloc creation, and CIDR policy tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['prefix lookup', 'cidr policy'], defaultValue: 'prefix lookup' },
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

function lpmGraph(title) {
  return graphState({
    nodes: [
      { id: 'pkt', label: 'pkt', x: 0.8, y: 4.0, note: 'dst IP' },
      { id: 'key', label: 'key', x: 2.3, y: 4.0, note: 'plen+ip' },
      { id: 'root', label: '/', x: 3.8, y: 4.0, note: 'root' },
      { id: 'p8', label: '/8', x: 5.2, y: 3.1, note: '10' },
      { id: 'p24', label: '/24', x: 6.7, y: 2.6, note: '10.0.10' },
      { id: 'p32', label: '/32', x: 8.2, y: 2.6, note: 'host' },
      { id: 'miss', label: 'miss', x: 6.7, y: 5.3, note: 'other' },
      { id: 'val', label: 'value', x: 9.4, y: 3.4, note: 'policy' },
    ],
    edges: [
      { id: 'e-pkt-key', from: 'pkt', to: 'key' },
      { id: 'e-key-root', from: 'key', to: 'root' },
      { id: 'e-root-p8', from: 'root', to: 'p8' },
      { id: 'e-p8-p24', from: 'p8', to: 'p24' },
      { id: 'e-p24-p32', from: 'p24', to: 'p32' },
      { id: 'e-root-miss', from: 'root', to: 'miss' },
      { id: 'e-p32-val', from: 'p32', to: 'val' },
      { id: 'e-p24-val', from: 'p24', to: 'val' },
      { id: 'e-p8-val', from: 'p8', to: 'val' },
    ],
  }, { title });
}

function* prefixLookup() {
  yield {
    state: lpmGraph('LPM trie returns the most specific matching prefix'),
    highlight: { active: ['pkt', 'key', 'root', 'p8', 'p24'], found: ['val'], compare: ['p32', 'miss'] },
    explanation: 'A BPF LPM trie map answers a route-style question: given an address, which stored prefix is the longest match? That lets kernel programs apply routing or CIDR policy without scanning every rule.',
    invariant: 'Exact host entries override subnet entries, and subnet entries override defaults.',
  };

  yield {
    state: labelMatrix(
      'BPF key layout',
      [
        { id: 'plen', label: 'plen' },
        { id: 'data', label: 'data' },
        { id: 'end', label: 'endian' },
        { id: 'max', label: 'max' },
      ],
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'role', label: 'role' },
      ],
      [
        ['u32', 'prefix'],
        ['4/16', 'addr'],
        ['big', 'msb'],
        ['32/128', 'lookup'],
      ],
    ),
    highlight: { active: ['plen:role', 'data:role'], found: ['end:role'], compare: ['max:role'] },
    explanation: 'The key starts with a prefix length, followed by address bytes. IPv4 normally uses four data bytes, IPv6 uses sixteen, and lookup keys set prefixlen to the maximum length for that address family.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'q', label: '10.0.10.200', x: 0.9, y: 4.0, note: 'query' },
        { id: 'p0', label: '/0', x: 2.8, y: 4.0, note: 'seen' },
        { id: 'p8', label: '/8', x: 4.2, y: 3.0, note: 'id1' },
        { id: 'p24', label: '/24', x: 5.8, y: 2.6, note: 'id2' },
        { id: 'p32', label: '/32', x: 7.4, y: 2.6, note: 'no' },
        { id: 'ans', label: 'id2', x: 9.0, y: 3.5, note: 'best' },
      ],
      edges: [
        { id: 'e-q-p0', from: 'q', to: 'p0' },
        { id: 'e-p0-p8', from: 'p0', to: 'p8' },
        { id: 'e-p8-p24', from: 'p8', to: 'p24' },
        { id: 'e-p24-p32', from: 'p24', to: 'p32' },
        { id: 'e-p24-ans', from: 'p24', to: 'ans' },
      ],
    }, { title: 'Lookup keeps the deepest matching value' }),
    highlight: { active: ['q', 'p8', 'p24'], found: ['ans'], compare: ['p32'] },
    explanation: 'For 10.0.10.200, a /8 prefix matches and then a /24 prefix matches. If no /32 host entry exists, the /24 value wins because it is the deepest matching prefix on the path.',
  };

  yield {
    state: labelMatrix(
      'Lookup examples',
      [
        { id: 'a', label: '10.0.10.123' },
        { id: 'b', label: '10.0.10.200' },
        { id: 'c', label: '10.12.0.1' },
        { id: 'd', label: '12.0.0.1' },
      ],
      [
        { id: 'best', label: 'best' },
        { id: 'val', label: 'val' },
      ],
      [
        ['/32', 'id3'],
        ['/24', 'id2'],
        ['/8', 'id1'],
        ['none', 'miss'],
      ],
    ),
    highlight: { active: ['a:best', 'b:best'], found: ['c:val'], compare: ['d:val'] },
    explanation: 'The same map can hold broad and narrow rules together. A more specific prefix overrides a less specific prefix for matching addresses, while unrelated addresses miss.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'prefixes', min: 0, max: 100 }, y: { label: 'lookup', min: 0, max: 100 } },
      series: [
        { id: 'scan', label: 'scan', points: [{ x: 0, y: 5 }, { x: 20, y: 25 }, { x: 50, y: 55 }, { x: 80, y: 82 }, { x: 100, y: 100 }] },
        { id: 'trie', label: 'trie', points: [{ x: 0, y: 8 }, { x: 20, y: 12 }, { x: 50, y: 20 }, { x: 80, y: 31 }, { x: 100, y: 38 }] },
      ],
      markers: [{ id: 'depth', x: 70, y: 28, label: 'depth' }],
    }),
    highlight: { active: ['trie', 'depth'], compare: ['scan'] },
    explanation: 'The benefit is avoiding a linear rule scan in the packet path. The cost is trie depth, memory management, update behavior, and shape sensitivity when many prefixes are stored.',
  };

  yield {
    state: labelMatrix(
      'Implementation traps',
      [
        { id: 'flag', label: 'flag' },
        { id: 'byte', label: 'byte' },
        { id: 'plen', label: 'plen' },
        { id: 'cap', label: 'cap' },
        { id: 'dump', label: 'dump' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['NO_PRE', 'create'],
        ['big', 'miss'],
        ['max', 'wrong'],
        ['limit', 'insert'],
        ['order', 'debug'],
      ],
    ),
    highlight: { active: ['flag:need', 'byte:need', 'plen:need'], compare: ['cap:fail', 'dump:fail'] },
    explanation: 'The practical bugs are byte-for-byte bugs: missing BPF_F_NO_PREALLOC, wrong endianness, lookup prefixlen not set to max, map capacity too low, or confusing map iteration order with lookup priority.',
  };
}

function* cidrPolicy() {
  yield {
    state: graphState({
      nodes: [
        { id: 'agent', label: 'agent', x: 0.8, y: 3.2, note: 'policy' },
        { id: 'map', label: 'LPM map', x: 2.6, y: 3.2, note: 'CIDR' },
        { id: 'prog', label: 'BPF', x: 4.5, y: 3.2, note: 'TC/XDP' },
        { id: 'pkt', label: 'pkt', x: 6.1, y: 3.2, note: 'dst' },
        { id: 'allow', label: 'allow', x: 8.0, y: 2.3, note: '/24' },
        { id: 'drop', label: 'drop', x: 8.0, y: 4.3, note: '/32' },
      ],
      edges: [
        { id: 'e-agent-map', from: 'agent', to: 'map' },
        { id: 'e-map-prog', from: 'map', to: 'prog' },
        { id: 'e-prog-pkt', from: 'prog', to: 'pkt' },
        { id: 'e-pkt-allow', from: 'pkt', to: 'allow' },
        { id: 'e-pkt-drop', from: 'pkt', to: 'drop' },
      ],
    }, { title: 'CIDR policy becomes a kernel lookup' }),
    highlight: { active: ['agent', 'map', 'prog', 'pkt'], found: ['allow'], compare: ['drop'] },
    explanation: 'A Cilium-style agent can translate policy into BPF map entries. The packet path then asks the kernel map for the most specific CIDR rule and turns the returned value into allow, deny, redirect, or identity metadata.',
  };

  yield {
    state: labelMatrix(
      'CIDR table',
      [
        { id: 'def', label: '0/0' },
        { id: 'corp', label: '10/8' },
        { id: 'svc', label: '10.0.10/24' },
        { id: 'bad', label: 'host/32' },
      ],
      [
        { id: 'act', label: 'act' },
        { id: 'why', label: 'why' },
      ],
      [
        ['deny', 'base'],
        ['allow', 'corp'],
        ['allow', 'svc'],
        ['deny', 'bad'],
      ],
    ),
    highlight: { active: ['svc:act'], found: ['bad:act'], compare: ['def:act'] },
    explanation: 'Policy can layer broad defaults, organization ranges, service subnets, and host exceptions. The most specific matching entry wins, so a /32 deny can override a /24 allow.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'root', label: 'root', x: 0.9, y: 4.0, note: 'empty' },
        { id: 'p8', label: '/8', x: 2.7, y: 3.0, note: 'real' },
        { id: 'im', label: 'im', x: 4.3, y: 3.0, note: 'split' },
        { id: 'p24', label: '/24', x: 6.0, y: 2.4, note: 'real' },
        { id: 'p32', label: '/32', x: 7.7, y: 2.4, note: 'real' },
        { id: 'other', label: 'other', x: 6.0, y: 4.6, note: 'branch' },
      ],
      edges: [
        { id: 'e-root-p8', from: 'root', to: 'p8' },
        { id: 'e-p8-im', from: 'p8', to: 'im' },
        { id: 'e-im-p24', from: 'im', to: 'p24' },
        { id: 'e-p24-p32', from: 'p24', to: 'p32' },
        { id: 'e-im-other', from: 'im', to: 'other' },
      ],
    }, { title: 'Updates may create intermediate trie nodes' }),
    highlight: { active: ['p8', 'im', 'p24'], found: ['p32'], compare: ['other'] },
    explanation: 'The kernel stores match ranges as trie nodes and may create intermediate split nodes to separate branches. That is why update and delete behavior is more complex than a flat hash map.',
  };

  yield {
    state: labelMatrix(
      'Kernel map contract',
      [
        { id: 'type', label: 'type' },
        { id: 'create', label: 'create' },
        { id: 'look', label: 'look' },
        { id: 'upd', label: 'update' },
        { id: 'val', label: 'value' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'why', label: 'why' },
      ],
      [
        ['LPM', 'prefix'],
        ['NO_PRE', 'must'],
        ['maxplen', 'best'],
        ['atomic', 'swap'],
        ['any', 'policy'],
      ],
    ),
    highlight: { active: ['create:rule', 'look:rule'], found: ['upd:rule'], compare: ['val:why'] },
    explanation: 'The BPF map contract is narrow but powerful: create the LPM trie with no preallocation, look up using a maximum-length key, atomically update prefixes, and store any value type your program understands.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'entries', min: 0, max: 100 }, y: { label: 'risk', min: 0, max: 100 } },
      series: [
        { id: 'small', label: 'small', points: [{ x: 0, y: 5 }, { x: 20, y: 12 }, { x: 50, y: 25 }, { x: 80, y: 42 }, { x: 100, y: 55 }] },
        { id: 'huge', label: 'huge', points: [{ x: 0, y: 5 }, { x: 20, y: 20 }, { x: 50, y: 55 }, { x: 80, y: 88 }, { x: 100, y: 98 }] },
      ],
      markers: [{ id: 'cap', x: 72, y: 82, label: 'cap' }],
    }),
    highlight: { active: ['small'], compare: ['huge', 'cap'] },
    explanation: 'At very large scale, trie shape, deletion, map-freeing cost, and lookup latency can become operational problems. LPM is a packet-path data structure, so tail latency matters.',
  };

  yield {
    state: labelMatrix(
      'Choose the map',
      [
        { id: 'cidr', label: 'CIDR' },
        { id: 'host', label: 'host' },
        { id: 'route', label: 'route' },
        { id: 'port', label: 'port' },
        { id: 'debug', label: 'debug' },
      ],
      [
        { id: 'map', label: 'map' },
        { id: 'note', label: 'note' },
      ],
      [
        ['LPM', 'ranges'],
        ['hash', 'exact'],
        ['LPM', 'best'],
        ['tuple', 'combo'],
        ['dump', 'order'],
      ],
    ),
    highlight: { active: ['cidr:map', 'route:map'], found: ['host:map'], compare: ['debug:note'] },
    explanation: 'Use LPM for prefix semantics. Use hash maps for exact host or tuple keys. If policy combines IP, port, protocol, and identity, be explicit about which dimension uses longest-prefix semantics.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'prefix lookup') yield* prefixLookup();
  else if (view === 'cidr policy') yield* cidrPolicy();
  else throw new InputError('Pick an eBPF LPM trie view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each trie edge as one or more address bits. Active means the lookup is following the packet address, visited means a broader prefix on the path has matched, and found means the deepest matched prefix has a value that can drive policy.',
        'The safe inference rule is prefix containment. If the packet address begins with all bits in a stored prefix, the address is inside that CIDR range. If two prefixes match, the longer one is more specific and wins.',
        {type:'callout', text:'An LPM trie moves CIDR policy out of linear scans by making prefix specificity the lookup invariant: the deepest matching address path wins.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/cd/Patricia_tree.png', alt:'Patricia tree example with branching nodes labeled by bit positions and leaves for string keys.', caption:'Patricia tree example by WikiLinuz, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'CIDR is a way to name an IP address range with a prefix, such as 10.0.10.0/24. Packet policy often needs these ranges because operators write broad rules with narrow exceptions. A kernel packet path cannot scan a long rule list for every packet.',
        'An eBPF map is a kernel-resident key-value data structure used by eBPF programs. BPF_MAP_TYPE_LPM_TRIE gives those programs longest-prefix match, which means returning the most specific stored prefix that contains the packet address. That matches routing and CIDR policy semantics.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a linear CIDR table. For each packet, test the address against every rule and keep the most specific match. It is easy to understand and works for small policy sets.',
        'Another approach is an exact hash map keyed by host address. That is fast for individual hosts, but it loses CIDR compression. A single IPv4 /16 would need 65,536 host entries if expanded exactly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is per-packet work. If a program checks 20,000 CIDR rules for each packet at a busy interface, policy lookup becomes the datapath bottleneck. Every extra rule adds hot-path latency.',
        'The exact-map wall is memory explosion. IPv6 makes expansion impossible because a /64 covers 2^64 addresses. Range rules need to remain ranges, not become host lists.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'IP prefixes are bit prefixes. A trie shares common leading bits, so 10.0.0.0/8 and 10.0.10.0/24 live on the same address path. Lookup can remember the deepest value seen while walking the packet address.',
        'Specificity is the invariant. A /32 host rule overrides a /24 subnet rule because it describes a smaller set of addresses inside that subnet. Insertion order and map iteration order should not decide policy priority.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The loader creates a BPF_MAP_TYPE_LPM_TRIE map with a maximum prefix length, usually 32 for IPv4 or 128 for IPv6. Linux requires BPF_F_NO_PREALLOC for this map type. User space inserts keys made from prefix length plus address bytes.',
        'For lookup, the eBPF program builds a key with prefixlen set to the maximum length for the address family. It fills the address bytes from the packet and asks the map for the longest matching prefix. The returned value can encode allow, deny, identity, route, redirect, or another action chosen by the program.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Address containment becomes path containment. A packet for 10.0.10.123 matches 10.0.0.0/8 because the first 8 bits match, and it matches 10.0.10.0/24 because the first 24 bits match. A different branch cannot contain that packet, so it does not need to be scanned.',
        'Keeping the last value seen on the path is enough. Any later matched value is deeper, and deeper means more specific. When the walk ends, the remembered value is the longest applicable prefix.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup cost follows address width and trie shape rather than the number of rules scanned. IPv4 has at most 32 prefix bits and IPv6 has at most 128, so doubling the number of unrelated rules does not double the maximum bit walk. Real cost still depends on memory layout, cache misses, and node splits.',
        'Memory grows with stored prefixes and internal nodes. Map capacity must be sized for policy cardinality, and failed inserts are correctness events because missing policy can change packet behavior. The control plane also has to write the exact byte order and value layout expected by the eBPF program.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LPM tries fit routing, firewall ranges, source identity by subnet, service steering by destination prefix, and tenant policy by CIDR. The access pattern is route-like: broad defaults plus narrow exceptions.',
        'They also fit the control-plane data-plane split. A user-space agent translates high-level policy into map entries. The eBPF program stays small: parse address, build lookup key, read value, enforce action.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the key is encoded incorrectly. IPv4 and IPv6 use different address sizes, lookup prefixlen should be the maximum length, and network byte order matters. These bugs often look like policy misses rather than crashes.',
        'It also fails when CIDR is only one part of the decision. Ports, protocols, identities, connection state, DNS names, namespaces, and audit rules need additional structures. Longest-prefix match should own the prefix dimension, not the whole policy system.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert four rules: 0.0.0.0/0 -> allow, 10.0.0.0/8 -> tenant, 10.0.10.0/24 -> service, and 10.0.10.123/32 -> deny. A packet to 10.0.10.88 matches /0, /8, and /24, so the /24 service value wins. A packet to 10.0.10.123 also matches /32, so deny wins.',
        'A linear table with 50,000 prefixes may need 50,000 containment checks in the worst case. The trie walk follows the 32 address bits for IPv4 and remembers matches along that path. The cost changes from scan all rules to follow the address.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel LPM trie map documentation at https://docs.kernel.org/bpf/map_lpm_trie.html, Linux bpf(2) manual page at https://man7.org/linux/man-pages/man2/bpf.2.html, Linux lpm_trie.c source at https://github.com/torvalds/linux/blob/master/kernel/bpf/lpm_trie.c, and Cilium BPF maps documentation at https://docs.cilium.io/en/latest/network/ebpf/maps/. Use the kernel docs for key layout and the source for edge behavior.',
        'Study Trie and Patricia Trie for prefix structure, Hash Table for exact-key contrast, IP FIB Longest-Prefix Match for routing semantics, Cilium eBPF Datapath for packet context, and eBPF Verifier Register State for kernel loading constraints. The useful contrast is exact identity lookup versus range lookup.',
      ],
    },
  ],
};
