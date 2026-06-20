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
      heading: 'Why this exists',
      paragraphs: [
        `BPF_MAP_TYPE_LPM_TRIE exists because packet programs often need range semantics, not exact-key semantics. A firewall rule may allow 10.0.10.0/24 while denying one bad host inside it. A routing rule may have a default route, a corporate /8, a service /24, and a host /32. The packet path needs the most specific matching rule without scanning every CIDR entry on every packet.`,
        `A normal hash map is the wrong shape for that question. It can answer "is this exact key present?" but it cannot naturally answer "which stored prefix is the longest prefix of this address?" You could store every host address covered by every CIDR, but that explodes memory. You could scan a list of CIDRs, but that puts linear work in a latency-sensitive kernel path.`,
        `The LPM trie map gives eBPF programs a kernel-resident data structure for longest-prefix match. User space loads prefixes and values. The BPF program builds a lookup key from a packet address and asks the map for the deepest matching prefix. The value can represent a route, identity, allow/deny action, redirect target, or any policy data the program understands.`,
        {type:`callout`, text:`An LPM trie moves CIDR policy out of linear scans by making prefix specificity the lookup invariant: the deepest matching address path wins.`},
        {type:`image`, src:`https://upload.wikimedia.org/wikipedia/commons/c/cd/Patricia_tree.png`, alt:`Patricia tree example with branching nodes labeled by bit positions and leaves for string keys.`, caption:`Patricia tree example by WikiLinuz, CC BY-SA 4.0, via Wikimedia Commons.`},
      ],
    },
    {
      heading: 'The naive approaches',
      paragraphs: [
        `The first naive approach is a linear CIDR table. Store rules in an array, check whether the destination address belongs to each prefix, and remember the most specific match. This is easy to write in user space and fine for tiny rule sets. It breaks when the table grows or when the check runs for every packet at XDP, TC, cgroup, or socket hook speed. Each extra rule adds more work to the hot path.`,
        `The second naive approach is an exact hash map keyed by host address. That is fast for /32 IPv4 or /128 IPv6 host rules, but it loses the compression that CIDR was invented to provide. A /24 would need 256 IPv4 host entries. A /16 would need 65,536. IPv6 makes expansion impossible in practice. Range rules should remain ranges.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that IP prefixes are bit prefixes. If a packet destination begins with the bits for 10.0.10, then it also begins with the bits for 10.0 and 10. A trie can share those common prefixes and keep the best value seen while walking down the address bits. The deepest matching node is the most specific CIDR rule.`,
        `That specificity rule is the whole contract. A /32 host rule overrides a /24 service subnet. A /24 overrides a /8 corporate range. A /8 overrides a /0 default. Insertion order should not decide the result, and map iteration order should not be mistaken for priority. Prefix length decides priority because longer prefixes describe smaller, more specific address sets.`,
        `The BPF map exposes this as a key-value store, but the key is structured: a prefix length followed by data bytes. For IPv4 the normal data length is four bytes. For IPv6 it is sixteen bytes. The kernel treats the data as network byte order, so the most significant byte comes first. A byte-order bug is not cosmetic; it turns the trie path into a different address.`,
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        `When creating the map, the loader chooses BPF_MAP_TYPE_LPM_TRIE and a maximum prefix length. Normal IP use is 32 for IPv4 or 128 for IPv6. The map must be created with BPF_F_NO_PREALLOC because this map type cannot preallocate all possible trie nodes.`,
        `An update key contains the prefix length being inserted and the address bytes for that prefix. Insert 10.0.0.0/8 with value id1, 10.0.10.0/24 with value id2, and 10.0.10.123/32 with value id3. The kernel stores nodes for the relevant bit paths and may create intermediate split nodes when prefixes share only part of a path. The value type is chosen by the program owner, so it can be a small action code or a richer policy record.`,
        `A lookup key is different from an update key in one important way. For longest-prefix lookup, prefixlen should be set to the maximum length for the address family, such as 32 for IPv4. The address bytes contain the packet address. The map walks the trie, tracks the deepest matching value, and returns that value. If no prefix on the path has a value, lookup returns null.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The prefix-lookup view proves that specificity beats breadth. The packet address first matches the broad /8, then a narrower /24. If no host /32 exists, the /24 value wins because it is the deepest matching value on the path. If a host entry exists, it overrides the subnet. The visual is teaching the precedence rule that operators rely on when layering defaults, service ranges, and exceptions.`,
        `The key-layout view proves that the data structure is byte-sensitive. Prefix length and address bytes are not metadata around a string. They are the actual binary key the kernel walks. A wrong prefix length, IPv4/IPv6 size mismatch, or little-endian address encoding changes the lookup.`,
        `The CIDR-policy view proves the control-plane/data-plane split. An agent translates policy into map entries. A BPF program attached in the packet path performs a local lookup and turns the returned value into allow, deny, redirect, or identity metadata. The packet does not need to call a policy service for every decision.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Longest-prefix match works because address containment is prefix containment. If every bit in prefix P matches the beginning of address A, then A is inside P's CIDR block. If two matching prefixes both contain A, the longer one names a subset of the shorter one. Returning the longest match is therefore the same as returning the most specific applicable rule.`,
        `The trie makes that proof operational. Walking the address bits visits only prefixes compatible with the query path. A branch that differs from the packet address cannot contain the packet, so it does not need to be scanned. Keeping the latest value seen on the path is enough because any later value on that same path has a longer prefix and therefore a smaller matching range.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Lookup avoids O(number of rules) scanning, but it is not magic O(1) hashing. The cost follows trie depth, prefix distribution, memory layout, and cache behavior. IPv4 has at most 32 address bits and IPv6 has at most 128, but real performance depends on the number and shape of nodes the kernel touches.`,
        `Memory is bounded by map capacity and by the nodes needed to represent prefixes and split points. Large policy sets can fail inserts when capacity is too low, and Cilium's documentation calls out that BPF maps have upper capacity limits. Map sizing is an operational concern, not just a code detail.`,
        `Agents also need to handle failed updates, partial rollout, stale entries, and compatibility between the value layout expected by the BPF program and the values written by user space. A correct data structure can still produce wrong packet behavior if the control plane writes the wrong bytes.`,
        `The tradeoff is semantic fit. LPM trie is excellent for prefix rules. It is worse for exact tuple state such as connection tracking, per-socket counters, or service backend maps. Combining IP prefix, port, protocol, direction, identity, and namespace may require multiple maps or a composite design where only the IP dimension uses longest-prefix semantics.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `LPM trie wins for route-like and CIDR-like questions. Routing tables, firewall allow/deny ranges, service steering by destination subnet, network identity by source range, and tenant policy by CIDR all need broad rules with narrow exceptions. The data structure matches the product language: the most specific matching prefix wins.`,
        `It also wins when the control plane and data plane need a clean boundary. A controller, agent, or daemon can compute policy from Kubernetes objects, user configuration, cloud metadata, or routing state. It then writes compact entries into a kernel map. The BPF program stays small: parse the packet, build the key, look up the map, enforce the returned action.`,
        `The case study is a Cilium-style datapath. The agent translates higher-level network policy into BPF maps. A packet hits a TC or XDP program. The program looks up the destination or source address in an LPM trie and applies the most specific policy value. The same broad pattern appears in packet filters and edge firewalls: user space owns policy authoring; kernel map lookup owns fast enforcement.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The first failure mode is key encoding. Prefix length, address length, and byte order must line up with the kernel contract. A lookup for an IPv4 address should use max prefix length 32, not the prefix length of the rule the developer hopes to find. IPv6 needs a different data size and max prefix length. These bugs often look like policy misses rather than crashes.`,
        `The second failure mode is map creation and sizing. BPF_F_NO_PREALLOC is required for LPM trie maps. Maximum entries still matter. If the agent underestimates policy cardinality, inserts can fail and packet behavior can diverge from intended policy. A robust control plane treats map update failure as a datapath correctness event, not as a log line to ignore.`,
        `The third failure mode is confusing LPM with all policy logic. A longest-prefix lookup can pick the right CIDR rule, but it does not solve identity, port, protocol, DNS name policy, connection state, audit logging, or rollout. Those dimensions need their own data structures and consistency rules.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Linux kernel LPM trie map documentation at https://docs.kernel.org/bpf/map_lpm_trie.html, the Linux bpf(2) manual page at https://man7.org/linux/man-pages/man2/bpf.2.html, Linux lpm_trie.c source at https://github.com/torvalds/linux/blob/master/kernel/bpf/lpm_trie.c, and Cilium BPF maps documentation at https://docs.cilium.io/en/latest/network/ebpf/maps/.`,
        `Study Trie and Patricia Trie for prefix structure, Hash Table for exact-key contrast, IP FIB Longest-Prefix Match Case Study for routing semantics, Cilium eBPF Datapath Case Study for the broader packet path, eBPF Verifier Register State Case Study for program constraints, and eBPF Ring Buffer Telemetry Case Study for reporting decisions back to user space.`,
      ],
    },
  ],
};
