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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each RIB as a table of route beliefs at a different trust boundary. RIB means routing information base. Adj-RIB-In is what neighbors claimed, Loc-RIB is what this router selected, Adj-RIB-Out is what it advertises, and FIB is the forwarding information base used to move packets.',
        {type:'callout', text:'BGP turns neighbor route claims into forwarding action through staged RIBs, with policy and trust boundaries between every stage.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/36/Internet_Connectivity_Distribution_%26_Core.svg', alt:'Diagram of tier 1 and tier 2 internet connectivity', caption:'Internet connectivity depends on independently operated networks exchanging reachability, the control problem BGP organizes. Source: Wikimedia Commons, Ludovic.ferre, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'BGP, the Border Gateway Protocol, exists because the internet is not one network. It is many autonomous systems, or ASes, each run by a separate organization with its own contracts, customers, failures, and policies. They need to exchange reachability without surrendering control to one central route planner.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Internet_Connectivity_Distribution_%26_Core.svg',
          alt: 'Internet connectivity distribution showing core, transit, and edge autonomous systems in a hierarchical topology',
          caption: 'The internet\'s AS-level topology. Core networks (Tier 1 providers) peer with each other settlement-free. Transit networks buy upstream from Tier 1 and sell downstream to enterprises. BGP is the protocol that stitches all of these independent routing domains together. Source: Wikimedia Commons, Ludovic.ferre, CC BY-SA 3.0.',
        },
        {
          type: 'callout',
          text: 'BGP is not a shortest-path algorithm. It is a policy-enforcement engine. The internet\'s ~75,000 autonomous systems each apply local routing policy with limited visibility. The result is stable and useful without being globally optimal -- and that is by design, not by accident.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is shortest path routing. If every router knew every link and every cost, it could choose the path with the smallest total weight. That idea works inside one administrative domain where one operator defines the metric.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/1901_Eastern_Telegraph_cables.png',
          alt: 'World map of Eastern Telegraph Company submarine telegraph cable routes in 1901',
          caption: 'Long-haul routing has always depended on physical paths across oceans and continents. BGP adds a control plane above that substrate: it decides which commercial and administrative path should carry reachability over the physical world. Source: Wikimedia Commons, unknown author, Public domain.',
        },
        'The internet cannot use one global shortest path metric because networks disagree about what cost means. One AS may prefer customer revenue over low latency. Another may avoid a peer, keep traffic inside a region, or obey a regulator.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is trust. A BGP update is a claim from a neighbor: this prefix is reachable through this AS path with these attributes. The receiving router must not turn every claim directly into forwarding behavior.',
        {
          type: 'callout',
          text: 'BGP has no built-in authentication of route origin. Any AS can announce any prefix to its neighbors. The entire system runs on trust, filtering, and -- increasingly -- cryptographic validation (RPKI). A single misconfigured router in a small ISP can accidentally claim ownership of YouTube\'s IP space and black-hole traffic for millions of users. This happened in 2008.',
        },
        'The route also has to pass local policy. A provider might learn one path from a customer, one from a peer, and one from a transit provider. The best route is often the one that satisfies business policy first and technical tie-breakers second.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make route selection a staged database pipeline. Do not mix raw neighbor claims with chosen local truth or exported advertisements. Each RIB stage has a narrower purpose and a different trust level.',
        {
          type: 'callout',
          text: 'The RIB pipeline is a staged data-transformation system, not a simple lookup table. Each stage has a different trust level: Adj-RIB-In is "what neighbors claim," Loc-RIB is "what we believe," Adj-RIB-Out is "what we tell others," and the FIB is "what we actually do." Mixing these stages is where routing incidents come from.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/BGP_FSM.svg',
          alt: 'BGP finite state machine showing the states Idle, Connect, Active, OpenSent, OpenConfirm, and Established with transitions between them',
          caption: 'The BGP finite state machine. A BGP session transitions through Idle, Connect, Active, OpenSent, OpenConfirm, and Established states. Route advertisements only flow in the Established state. Understanding the FSM matters because a session that never reaches Established produces no routes -- and a session that drops from Established triggers withdrawal of all routes learned from that peer. Source: Wikimedia Commons, Johannes Roessel, CC BY-SA 3.0.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A router receives updates from established BGP sessions and stores eligible routes in Adj-RIB-In. Import policy filters or rewrites those routes. The decision process then selects one best path per prefix for Loc-RIB, and the forwarding plane receives the next-hop information through the FIB.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif',
          alt: 'Animation showing packets being switched through network nodes along different paths',
          caption: 'Packet switching in action. Each router makes an independent forwarding decision based on its FIB. BGP\'s job is to populate those FIBs with consistent, policy-compliant forwarding entries so that packets reach their destination even though no single router sees the full path. Source: Wikimedia Commons, Oddbodz, CC BY-SA 3.0.',
        },
        'Export policy then decides what to advertise to each neighbor. The same selected route may be announced to customers, hidden from peers, or modified before export. BGP is therefore not one table lookup; it is import, selection, export, and forwarding commitment.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg',
          alt: 'Visualization of internet routing paths showing a dense network of connections between autonomous systems',
          caption: 'A visualization of internet routing paths. Each line represents a route between autonomous systems. The dense core represents Tier 1 providers and major IXPs. The sparse edges are enterprise and stub networks. BGP maintains this entire graph as distributed state across ~75,000 autonomous systems. Source: Wikimedia Commons, The Opte Project, CC BY 2.5.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'BGP works because each AS only has to make a local, policy-consistent choice from routes it has learned. AS_PATH prevents simple loops because a router can reject a route that already contains its own AS number. Path vector means the advertisement carries the sequence of ASes, not just a distance.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Submarine_cable_cross-section_3D_plain.svg',
          alt: 'Cross-section diagram of a submarine communications cable showing protective layers and optical fibers',
          caption: 'BGP chooses logical reachability, but those paths eventually ride physical media such as submarine fiber. A routing table cannot route around damage unless another physical and commercial path exists. Source: Wikimedia Commons, Oona Raisanen, Public domain.',
        },
        {
          type: 'callout',
          text: 'BGP\'s lack of global optimization is a feature, not a bug. The alternative -- a single authority deciding all internet routing -- would require universal trust, universal visibility, and universal agreement on what "optimal" means. The internet works precisely because BGP does not require any of those things.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with prefixes, peers, route alternatives, and policy rules. If a router has 1,000,000 prefixes and three routes for each, it may retain millions of candidate route records before selecting the best path. Memory and convergence time grow with the number of beliefs kept, not just the number of destinations.',
        'Convergence is behavioral cost. A link failure triggers withdrawals, new best-path choices, exports, and remote recomputation. More peers and more policy can mean slower settling because each stage has to filter, compare, and advertise changes without creating loops or policy leaks.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'BGP is used between internet service providers, cloud networks, content delivery networks, enterprises, and internet exchanges. It is also used inside large data centers and private WANs when operators need policy-rich reachability rather than one uniform shortest path. The access pattern is continuous update, filter, select, export, and forward.',
        'RPKI, route filters, communities, and local preference are operational tools around the RIB pipeline. A community is a tag attached to a route so policy can act on it later. Local preference is an internal ranking used to prefer one route over another before many other tie-breakers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BGP fails when false claims pass import filters and become forwarding behavior. A route leak can send traffic through an unintended AS. A hijack can attract traffic for a prefix the attacker does not own. A bad export policy can advertise routes to the wrong neighbors.',
        'It also fails as a shortest-path mental model. The path with fewer AS hops may be worse, and the selected route may intentionally avoid the lowest-latency option. Commercial relationships, local preference, and security filters are first-class routing inputs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume AS65000 learns prefix 203.0.113.0/24 from three neighbors. Customer route A has AS_PATH 65010 64500 and local preference 200. Peer route B has AS_PATH 65020 64500 and local preference 100. Transit route C has AS_PATH 65030 65031 64500 and local preference 80.',
        'The router does not choose the shortest AS_PATH first. It chooses A because local preference 200 beats 100 and 80. If A is withdrawn, B wins over C because local preference 100 beats 80, even though both might be technically reachable.',
        'Now suppose export policy says customer routes can be exported to peers and providers, but peer-learned routes cannot be exported to other peers. When A is active, AS65000 may advertise it broadly. When only B remains, export is narrower, so the route selected for local forwarding is not automatically the route advertised to everyone.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'callout',
          text: 'The single most important BGP lesson: the control plane is a database of beliefs about the network, not facts about the network. Every stage of the RIB pipeline exists to progressively validate, filter, and commit those beliefs before they become forwarding actions that affect real traffic.',
        },
        'Primary sources: RFC 4271 for BGP-4, RFC 8212 for default EBGP route policy, RFC 6811 for BGP prefix origin validation, and router vendor documentation for decision-process details. Use primary sources because operational tie-breakers and defaults vary by implementation.',
        'Study next by role. For routing theory, study distance-vector and link-state routing. For internet security, study RPKI and route leaks. For operations, study communities, route reflectors, dampening, and incident postmortems for prefix hijacks.',
      ],
    },
  ],
};
