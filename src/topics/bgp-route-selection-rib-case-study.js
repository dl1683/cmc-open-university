// BGP route selection: Adj-RIB-In, policy, Loc-RIB, FIB, and export state.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'bgp-route-selection-rib-case-study',
  title: 'BGP Route Selection RIB Case Study',
  category: 'Systems',
  summary: 'BGP keeps candidate routes, applies policy, selects best paths into Loc-RIB, and exports a forwarding-ready choice to the FIB.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rib pipeline', 'best path case'], defaultValue: 'rib pipeline' },
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

function ribPipeline(title) {
  return graphState({
    nodes: [
      { id: 'peerA', label: 'P-A', x: 0.5, y: 1.9, note: 'update' },
      { id: 'peerB', label: 'P-B', x: 0.5, y: 4.0, note: 'update' },
      { id: 'peerC', label: 'P-C', x: 0.5, y: 6.1, note: 'update' },
      { id: 'adjIn', label: 'Adj', x: 2.5, y: 4.0, note: 'In' },
      { id: 'import', label: 'policy', x: 4.7, y: 4.0, note: '' },
      { id: 'decision', label: 'best', x: 6.8, y: 4.0, note: '' },
      { id: 'loc', label: 'Loc', x: 8.2, y: 3.0, note: 'RIB' },
      { id: 'fib', label: 'FIB', x: 9.3, y: 1.8, note: 'fwd' },
      { id: 'adjOut', label: 'Out', x: 9.3, y: 5.2, note: 'RIB' },
    ],
    edges: [
      { id: 'e-a-in', from: 'peerA', to: 'adjIn', weight: '' },
      { id: 'e-b-in', from: 'peerB', to: 'adjIn', weight: '' },
      { id: 'e-c-in', from: 'peerC', to: 'adjIn', weight: '' },
      { id: 'e-in-import', from: 'adjIn', to: 'import', weight: '' },
      { id: 'e-import-decision', from: 'import', to: 'decision', weight: '' },
      { id: 'e-decision-loc', from: 'decision', to: 'loc', weight: '' },
      { id: 'e-loc-fib', from: 'loc', to: 'fib', weight: '' },
      { id: 'e-loc-out', from: 'loc', to: 'adjOut', weight: '' },
    ],
  }, { title });
}

function* pipelineView() {
  yield {
    state: ribPipeline('BGP stores candidates before it forwards anything'),
    highlight: { active: ['peerA', 'peerB', 'peerC', 'adjIn', 'e-a-in', 'e-b-in', 'e-c-in'], compare: ['fib'] },
    explanation: 'BGP UPDATE messages from neighbors first become candidate routes in Adj-RIB-In. A router does not forward packets from this raw pile. It applies import policy and runs a decision process first.',
    invariant: 'Adj-RIB-In is candidate control-plane state, not the packet forwarding table.',
  };

  yield {
    state: labelMatrix(
      'RIB roles',
      [
        { id: 'adjIn', label: 'Adj-RIB-In' },
        { id: 'loc', label: 'Loc-RIB' },
        { id: 'adjOut', label: 'Adj-RIB-Out' },
        { id: 'fib', label: 'FIB' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'question', label: 'answers' },
      ],
      [
        ['routes from peers', 'what did neighbors say?'],
        ['selected local routes', 'what do we believe?'],
        ['routes to advertise', 'what do we tell peers?'],
        ['forwarding actions', 'where does packet go?'],
      ],
    ),
    highlight: { active: ['adjIn:contains', 'loc:contains'], found: ['fib:question'] },
    explanation: 'The names matter because they separate duties. BGP can remember many alternatives, advertise a policy-shaped subset, and export only forwarding-ready choices to the FIB.',
  };

  yield {
    state: ribPipeline('Import policy changes what the decision process sees'),
    highlight: { active: ['adjIn', 'import', 'e-in-import'], found: ['decision'], removed: ['peerC'] },
    explanation: 'Import policy can reject a route, set local preference, tag communities, or change other attributes before ranking. In production, policy is often the real business logic of interdomain routing.',
  };

  yield {
    state: ribPipeline('Loc-RIB is the selected local view'),
    highlight: { active: ['decision', 'loc', 'e-decision-loc'], found: ['fib', 'adjOut', 'e-loc-fib', 'e-loc-out'] },
    explanation: 'The selected route enters Loc-RIB. From there, the router may install a forwarding action in the FIB and may advertise a policy-transformed route to neighbors through Adj-RIB-Out.',
  };

  yield {
    state: labelMatrix(
      'Why this is a data-structure case study',
      [
        { id: 'candidates', label: 'candidates' },
        { id: 'policy', label: 'policy' },
        { id: 'rank', label: 'ranking' },
        { id: 'publish', label: 'publish' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'failure', label: 'failure if wrong' },
      ],
      [
        ['per-prefix path sets', 'lost backup path'],
        ['filters and attributes', 'leaked route'],
        ['ordered comparison', 'bad best path'],
        ['RIB to FIB', 'blackhole or loop'],
      ],
    ),
    highlight: { active: ['candidates:structure', 'rank:structure'], found: ['publish:failure'] },
    explanation: 'BGP looks like a protocol, but its operational core is state management: store path alternatives, transform attributes, choose one route per prefix, publish safely, and recover when the graph changes.',
  };
}

function* bestPathCase() {
  yield {
    state: labelMatrix(
      'Three paths for 203.0.113/24',
      [
        { id: 'a', label: 'peer A' },
        { id: 'b', label: 'peer B' },
        { id: 'c', label: 'peer C' },
      ],
      [
        { id: 'local', label: 'local pref' },
        { id: 'aspath', label: 'AS path' },
        { id: 'med', label: 'MED' },
        { id: 'result', label: 'result' },
      ],
      [
        ['200', '64501 64496', '30', 'best'],
        ['150', '64502', '10', 'backup'],
        ['reject', '64566 64567', '5', 'filtered'],
      ],
    ),
    highlight: { active: ['a:local', 'a:result'], compare: ['b:aspath', 'b:med'], removed: ['c:result'] },
    explanation: 'This toy ranking shows a common policy shape: local preference dominates, filtered routes disappear, and shorter AS paths or lower MEDs matter only if earlier policy comparisons do not decide the winner. Exact vendor decision ladders differ, so treat this as an explanatory case study, not a universal CLI rule.',
  };

  yield {
    state: labelMatrix(
      'A simplified comparison ladder',
      [
        { id: 'valid', label: 'valid path' },
        { id: 'lp', label: 'local pref' },
        { id: 'as', label: 'AS path' },
        { id: 'origin', label: 'origin/MED' },
        { id: 'igp', label: 'IGP cost' },
        { id: 'tie', label: 'tie breaks' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'data', label: 'data used' },
      ],
      [
        ['discard impossible', 'next-hop reachability'],
        ['express policy', 'operator attribute'],
        ['prefer shorter path', 'path vector'],
        ['compare attributes', 'route metadata'],
        ['reach nearest exit', 'interior route'],
        ['make deterministic', 'router ids'],
      ],
    ),
    highlight: { active: ['valid:purpose', 'lp:purpose', 'as:data'], found: ['tie:purpose'] },
    explanation: 'The key data-structure idea is ordered comparison over candidate records. Each path is a record with attributes; the decision process is a deterministic reduction from many records to one selected route.',
  };

  yield {
    state: ribPipeline('Best path A is installed and exported'),
    highlight: { active: ['peerA', 'adjIn', 'import', 'decision', 'loc', 'e-a-in', 'e-in-import', 'e-import-decision', 'e-decision-loc'], found: ['fib'] },
    explanation: 'After policy and comparison, peer A wins for 203.0.113/24. Loc-RIB stores the selected route, and the FIB receives the forwarding action that packet lookup will use.',
  };

  yield {
    state: ribPipeline('Failure: A withdraws, so the backup can win quickly'),
    highlight: { removed: ['peerA', 'e-a-in'], active: ['peerB', 'adjIn', 'decision', 'loc', 'e-b-in'], found: ['fib'] },
    explanation: 'When peer A withdraws the route, the router does not need to relearn the whole internet from scratch. If peer B remains in Adj-RIB-In and passes policy, the decision process can promote it into Loc-RIB.',
    invariant: 'Keeping alternatives is what makes reconvergence possible.',
  };

  yield {
    state: labelMatrix(
      'Control-plane mistakes become forwarding incidents',
      [
        { id: 'leak', label: 'route leak' },
        { id: 'hijack', label: 'prefix hijack' },
        { id: 'flap', label: 'route flap' },
        { id: 'stale', label: 'stale next hop' },
      ],
      [
        { id: 'bad_state', label: 'bad state' },
        { id: 'effect', label: 'effect' },
        { id: 'defense', label: 'defense' },
      ],
      [
        ['export too much', 'traffic detours', 'export policy'],
        ['false origin', 'traffic stolen', 'validation'],
        ['rapid churn', 'CPU and outages', 'damping/limits'],
        ['path unreachable', 'blackhole', 'next-hop checks'],
      ],
    ),
    highlight: { active: ['leak:bad_state', 'stale:effect'], found: ['hijack:defense'] },
    explanation: 'BGP is slow-moving compared with packet forwarding, but its errors are large. Bad control-plane state can program a perfectly fast FIB with the wrong answer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rib pipeline') yield* pipelineView();
  else if (view === 'best path case') yield* bestPathCase();
  else throw new InputError('Pick a BGP RIB view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'BGP is a path-vector routing protocol, but the implementation lesson here is state discipline. A router receives candidate paths from neighbors, stores them, applies policy, selects the best local routes, and exports selected forwarding information to the FIB. RFC 4271 names the key routing information bases: Adj-RIBs-In, Loc-RIB, and Adj-RIBs-Out.',
        'Adj-RIBs-In holds routing information learned from peers. Loc-RIB holds the routes selected by the local BGP speaker decision process. Adj-RIBs-Out holds routes selected for advertisement. The FIB is outside BGP itself: it is the packet-forwarding table built from selected routes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each prefix, the router may learn multiple paths. Import policy can reject paths or modify attributes such as local preference. The decision process ranks the remaining candidate records. The selected route enters Loc-RIB, may be advertised after export policy, and may be installed into the FIB so packets can be forwarded by longest-prefix match.',
        'The toy comparison in the animation uses a common teaching ladder: validate the path, prefer higher local preference, consider AS-path length, then other attributes and deterministic tie-breakers. Production routers and vendors have specific rules and policy hooks, so the important transferable idea is the ordered reduction over candidate route records.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A full internet table contains hundreds of thousands of IPv4 routes and a large IPv6 table, with multiple candidate paths per prefix on many routers. The data structures must support update storms, withdrawals, policy recomputation, alternative-path retention, and safe publication to the FIB. Memory pressure is real because Adj-RIB-In can keep routes that are not currently selected.',
        'Time scale matters. BGP convergence is control-plane work; it can take seconds or longer under churn. FIB lookup is data-plane work; it must answer per packet. Mixing those concerns is how route leaks, blackholes, and slow reconvergence become outages.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A router learns 203.0.113/24 from three peers. Peer A has local preference 200, peer B has local preference 150, and peer C is rejected by import policy. Even though peer B has a shorter AS path in the toy table, local policy chooses peer A. The selected route enters Loc-RIB and programs the FIB entry used by packet forwarding.',
        'Later, peer A withdraws the route. Because peer B remains in Adj-RIB-In and still passes policy, the decision process promotes peer B into Loc-RIB and the FIB is updated. The router did not need to query every neighbor again; it used retained candidate state. That is the data-structure lesson behind reconvergence.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse BGP best path with longest-prefix match. BGP chooses the best route for a particular prefix from candidate paths. The FIB later chooses the most specific matching prefix for each packet. These are different decisions at different layers.',
        'Do not treat the simplified comparison ladder as a universal standard order for every router. RFC 4271 defines the broad decision process and RIB concepts, while vendors and operators add policy, local preference, route reflection behavior, multipath, validation, and deployment-specific constraints.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 4271, "A Border Gateway Protocol 4 (BGP-4)", especially the RIB definitions and Decision Process: https://datatracker.ietf.org/doc/html/rfc4271. RFC 9069 discusses Loc-RIB access through BMP and restates the Loc-RIB role: https://datatracker.ietf.org/doc/html/rfc9069. Study IP FIB Longest-Prefix Match Case Study next, then PATRICIA Trie, Hash Table, Binary Heap, Message Queue, Distributed Tracing, and Cilium eBPF Datapath Case Study.',
      ],
    },
  ],
};
