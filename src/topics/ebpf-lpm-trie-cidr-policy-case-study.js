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
      heading: 'What it is',
      paragraphs: [
        'BPF_MAP_TYPE_LPM_TRIE is the eBPF map type for longest-prefix match. It is useful when a packet address must match the most specific stored route or CIDR policy entry. The structure sits between ordinary Trie and IP FIB Longest-Prefix Match Case Study: it has prefix-tree semantics, but it is exposed as a kernel BPF map.',
        'The key idea is simple: store prefixes such as 10.0.0.0/8, 10.0.10.0/24, and 10.0.10.123/32 in one map. A lookup for 10.0.10.200 returns the /24 value; a lookup for 10.0.10.123 returns the /32 value; an unrelated address misses.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The key begins with a 32-bit prefix length followed by address bytes. For IPv4, the address data is normally four bytes; for IPv6, sixteen bytes. The kernel documentation notes that the data bytes are interpreted in network byte order, so byte layout must match what the kernel expects.',
        'Lookup keys set prefixlen to the maximum prefix length for the address family, such as 32 for IPv4 or 128 for IPv6. The map walks the trie and returns the value associated with the deepest matching prefix. Updates add or replace prefixes atomically from the program or from user space through the BPF map APIs.',
      ],
    },
    {
      heading: 'Data structures and complexity',
      paragraphs: [
        'Internally, the kernel stores an unbalanced trie of nodes with prefix length, data bytes, child pointers, and value storage. Intermediate split nodes can appear when prefixes share only part of a path. That makes this structure different from a flat Hash Table and different from a fixed-width array table.',
        'The happy path avoids scanning every policy or route entry. The cost is depth and operational shape: large or badly distributed prefix sets can stress lookup latency, update behavior, deletion, and map destruction. Because packet-path lookup is latency sensitive, a map that is mathematically correct can still be operationally expensive at very high cardinality.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Cilium-style datapath receives a packet and needs to decide whether the destination CIDR is allowed. The agent writes broad defaults, organization ranges, service ranges, and host-level exceptions into an LPM trie map. The BPF program builds a lookup key from the packet destination, calls bpf_map_lookup_elem, and receives the most specific policy value.',
        'The same pattern applies to routing tables, firewall ranges, service steering, and Magic Firewall-style packet policy. Cilium eBPF Datapath Case Study explains the broader control-plane/data-plane split; this topic zooms into one concrete map type used when ranges, not exact keys, are the product requirement.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first trap is key encoding. prefixlen, address bytes, IPv4 versus IPv6 length, and big-endian byte order must line up exactly. The second trap is map creation: BPF_F_NO_PREALLOC is mandatory for this map type. The third trap is lookup prefixlen: setting it to the stored prefix rather than the maximum prefix length changes the question.',
        'LPM is not a universal replacement for hash maps. Exact host identity, connection tracking tuples, service IDs, and counters often belong in hash or array maps. Use LPM when longest-prefix semantics are the contract, and keep debug tooling honest: map iteration order is not the same as lookup priority.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel LPM trie map documentation at https://docs.kernel.org/bpf/map_lpm_trie.html, eBPF Docs map reference at https://docs.ebpf.io/linux/map-type/BPF_MAP_TYPE_LPM_TRIE/, Linux lpm_trie.c source at https://github.com/torvalds/linux/blob/master/kernel/bpf/lpm_trie.c, Cilium BPF maps documentation at https://docs.cilium.io/en/latest/network/ebpf/maps/, and Cloudflare engineering analysis of BPF LPM trie performance at https://blog.cloudflare.com/a-deep-dive-into-bpf-lpm-trie-performance-and-optimization/.',
        'Study Cilium eBPF Datapath Case Study, IP FIB Longest-Prefix Match Case Study, eBPF Verifier Register State Case Study, Patricia Trie, Trie, Hash Table, eBPF Ring Buffer Telemetry Case Study, and Metric Label Cardinality Control Case Study next.',
      ],
    },
  ],
};
