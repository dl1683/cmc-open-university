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
        'The "rib pipeline" view traces a BGP UPDATE from peer arrival through Adj-RIB-In, import policy, the decision process, Loc-RIB, and finally the FIB. Active nodes are the current stage of the route. Found nodes are the forwarding result. Compare nodes show where the pipeline has not yet committed.',
        'The "best path case" view walks through a concrete route selection: three candidates for one prefix, policy filters, local preference comparison, and failover when the winner withdraws. Watch which attributes decide each step.',
        {
          type: 'note',
          text: 'At each frame, if a node is active and its inbound edge is highlighted, that stage has received or produced routing state. If a downstream node is not yet active, no forwarding decision has been made there. The pipeline is sequential -- each stage must complete before the next can act.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Yakov Rekhter, RFC 4271 co-author',
          text: 'BGP is not about finding the shortest path. It is about expressing policy.',
        },
        'The internet is not one network. It is roughly 75,000 autonomous systems (ASes) -- independently operated networks run by ISPs, enterprises, cloud providers, universities, and governments. No single authority decides how traffic flows between them. Each AS has its own business relationships, peering agreements, transit contracts, and traffic-engineering goals. BGP exists because these networks need to exchange reachability information while each retaining the right to make independent routing decisions.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Internet_Connectivity_Distribution_%26_Core.svg',
          alt: 'Internet connectivity distribution showing core, transit, and edge autonomous systems in a hierarchical topology',
          caption: 'The internet\'s AS-level topology. Core networks (Tier 1 providers) peer with each other settlement-free. Transit networks buy upstream from Tier 1 and sell downstream to enterprises. BGP is the protocol that stitches all of these independent routing domains together. Source: Wikimedia Commons, CC BY-SA 3.0.',
        },
        'Your network may learn several possible paths for the same prefix from transit providers, peers, route reflectors, internal routers, or customer links. The router cannot treat those updates as packet-forwarding truth. It has to store candidates, apply policy, choose one local view, decide what to advertise, and then program the forwarding plane.',
        'The RIB split is the data model that keeps those duties separate. Adj-RIB-In is what neighbors have told the router. Import policy filters or rewrites that candidate state. Loc-RIB is the router\'s selected local routing information. Adj-RIB-Out is what this router is prepared to tell a neighbor after export policy. The FIB is the packet-speed table used by forwarding hardware or the kernel datapath.',
        {
          type: 'callout',
          text: 'BGP is not a shortest-path algorithm. It is a policy-enforcement engine. The internet\'s ~75,000 autonomous systems each apply local routing policy with limited visibility. The result is stable and useful without being globally optimal -- and that is by design, not by accident.',
        },
        'That separation is why this belongs in a data-structures curriculum. BGP is not only a protocol message format. Operationally, it is a set of evolving records, indexes, policies, comparisons, and publications. A bad record in the control plane can program a very fast forwarding plane with the wrong answer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to install the latest update for a prefix directly into the FIB. That is simple, and it resembles a last-writer-wins map from prefix to next hop. It is also wrong. A new path might violate import policy, have an unreachable next hop, be worse than an existing path, carry attributes that should not be exported, or come from a neighbor that is allowed to announce only a narrow set of routes.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Naive approach: last-writer-wins, no policy, no backup.\nfunction installRoute(fib, prefix, update) {\n  // Dangerous: no import policy, no validation, no alternative retention.\n  fib.set(prefix, { nextHop: update.nextHop, asPath: update.asPath });\n  // If this path fails, we have nothing to fall back on.\n  // If this path was a hijack, we just programmed it into forwarding.\n}',
        },
        'Another tempting shortcut is to think of BGP route choice as the same thing as packet longest-prefix match. They are different stages. BGP chooses a best path among candidates for one prefix. The FIB later chooses the most specific matching prefix for a packet destination. Confusing those two layers makes routing behavior look arbitrary when it is actually two ordered decisions composed together.',
        {
          type: 'table',
          headers: ['Approach', 'What it does', 'Why it fails'],
          rows: [
            ['Last-writer-wins FIB', 'Installs newest path directly', 'No policy, no backup, hijacks go straight to forwarding'],
            ['Shortest AS path only', 'Picks mathematically shortest', 'Ignores business relationships -- customer routes should beat peer routes'],
            ['Single-path store', 'Keeps only the winner', 'Withdrawal forces full reconvergence instead of instant backup promotion'],
            ['Link-state flooding', 'Share full topology', 'Does not scale to 75K ASes; policy cannot be encoded in link costs'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is policy. The shortest AS path is not always the path an operator wants. A paid customer route may outrank a peer route. A route from one neighbor may be accepted only for certain prefixes. A route may carry communities that request no-export behavior, blackhole handling, prepending, or local preference changes. The router needs a programmable decision surface before packets are affected.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Submarine_cable_map_umap.png',
          alt: 'World map showing submarine cable connections between continents',
          caption: 'The physical substrate of BGP: submarine cables connecting continents. Each cable landing station connects autonomous systems that must negotiate reachability through BGP. A single misconfigured BGP session at one of these interconnection points can reroute traffic for entire countries. Source: Wikimedia Commons, CC BY-SA 4.0.',
        },
        'The second wall is churn. Paths are withdrawn, links fail, route reflectors update, prefixes flap, and validation state changes. If the router discards every losing candidate, a failure of the current winner forces a slow rediscovery process. If it retains alternatives, the best-path process can promote a backup already present in Adj-RIB-In.',
        'The third wall is blast radius. BGP mistakes propagate. A route leak can redirect traffic across the wrong network. A prefix hijack can attract traffic to an unauthorized origin. A stale next hop can blackhole traffic. The data structure is not academic; its invariants are operational safety rules.',
        {
          type: 'callout',
          text: 'BGP has no built-in authentication of route origin. Any AS can announce any prefix to its neighbors. The entire system runs on trust, filtering, and -- increasingly -- cryptographic validation (RPKI). A single misconfigured router in a small ISP can accidentally claim ownership of YouTube\'s IP space and black-hole traffic for millions of users. This happened in 2008.',
        },
      ],
    },
    {
      heading: 'Path-vector algorithm: where BGP sits',
      paragraphs: [
        'Routing algorithms fall into three families. Understanding where BGP sits explains why it works the way it does.',
        {
          type: 'table',
          headers: ['Algorithm', 'What routers share', 'Loop prevention', 'Scalability', 'Example'],
          rows: [
            ['Distance-vector', 'Distance to each destination', 'Split horizon, poison reverse', 'Moderate -- slow convergence, count-to-infinity', 'RIP'],
            ['Link-state', 'Full topology (link costs)', 'Complete graph -- Dijkstra finds shortest path', 'Good within one domain, but flooding scales poorly', 'OSPF, IS-IS'],
            ['Path-vector', 'Full AS path to each destination', 'Reject paths containing own AS number', 'Scales to the internet -- no topology flooding', 'BGP'],
          ],
        },
        'BGP is a path-vector protocol. Each route advertisement carries the complete sequence of AS numbers the route has traversed. When AS 64501 advertises prefix 203.0.113.0/24 to AS 64502, it prepends its own AS number to the path. AS 64502 sees the path [64501] and knows the route originated at 64501. If 64502 re-advertises the route to AS 64503, the path becomes [64502, 64501]. If that advertisement ever loops back to AS 64501, it sees its own number in the path and rejects it.',
        'This is fundamentally different from link-state protocols like OSPF, which flood the complete topology to every router and then run Dijkstra\'s algorithm locally. Link-state works beautifully inside a single organization (one AS), but it cannot scale to 75,000 autonomous systems. It also cannot express policy -- there is no way to say "prefer customer routes over peer routes" in a link cost.',
        {
          type: 'note',
          text: 'BGP uses TCP (port 179) as its transport, not raw IP like OSPF. This means BGP sessions are point-to-point, reliable, and ordered. A BGP speaker maintains a separate TCP session with each neighbor. The protocol does not flood -- it sends updates only when routes change.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'For each prefix, store route candidates as records with attributes. Import policy decides which records survive and how their attributes are normalized. The decision process ranks the survivors in a deterministic order. The selected route enters Loc-RIB. Export policy decides what, if anything, is placed into Adj-RIB-Out for each neighbor. The forwarding process turns selected routes into FIB entries.',
        {
          type: 'diagram',
          alt: 'BGP RIB pipeline from peer updates to FIB',
          label: 'The BGP route processing pipeline',
          body: 'Peer UPDATE messages\n       |\n       v\n  Adj-RIB-In (candidate routes per peer)\n       |\n       v\n  Import Policy (filter, set local-pref, tag communities)\n       |\n       v\n  Decision Process (13-step comparison ladder)\n       |\n       v\n  Loc-RIB (selected best route per prefix)\n       |\n       +---> Export Policy ---> Adj-RIB-Out ---> Peer advertisements\n       |\n       +---> FIB installation (forwarding plane)',
          text: 'Peer UPDATE messages\n       |\n       v\n  Adj-RIB-In (candidate routes per peer)\n       |\n       v\n  Import Policy (filter, set local-pref, tag communities)\n       |\n       v\n  Decision Process (13-step comparison ladder)\n       |\n       v\n  Loc-RIB (selected best route per prefix)\n       |\n       +---> Export Policy ---> Adj-RIB-Out ---> Peer advertisements\n       |\n       +---> FIB installation (forwarding plane)',
        },
        'The transferable idea is ordered reduction over candidate records with retained backups. BGP does not just keep a single answer. It keeps enough structured state to explain where the answer came from, why other answers lost, what should be advertised, and what can replace the winner if the world changes.',
        {
          type: 'callout',
          text: 'The RIB pipeline is a staged data-transformation system, not a simple lookup table. Each stage has a different trust level: Adj-RIB-In is "what neighbors claim," Loc-RIB is "what we believe," Adj-RIB-Out is "what we tell others," and the FIB is "what we actually do." Mixing these stages is where routing incidents come from.',
        },
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The RIB pipeline view shows candidate state becoming selected state. Updates from peers first land as possibilities. Policy then changes the candidate set: it can reject a path, set local preference, tag a community, or make a route ineligible for export. Only after that does the decision process choose a best path.',
        'The best-path case shows why policy dominates raw path shape. Peer A wins because local preference is higher. Peer C disappears because policy filters it. Peer B is not useless just because it lost; it remains a backup candidate that can be promoted if the current winner withdraws.',
        'The important thing to watch is not the animation movement itself. Watch where state changes meaning. A route in Adj-RIB-In means "a neighbor said this." A route in Loc-RIB means "this router selected this." A FIB entry means "packets may now follow this action." Each transition raises the level of commitment.',
      ],
    },
    {
      heading: 'The decision process: 13 steps to a best path',
      paragraphs: [
        'The BGP decision process is not a single comparison. It is a deterministic cascade of tiebreakers, evaluated in strict order. If step N produces a winner, steps N+1 through 13 are never consulted. The exact steps vary slightly by vendor, but RFC 4271 and common implementations follow this general ladder:',
        {
          type: 'table',
          headers: ['Step', 'Criterion', 'Prefers', 'Who controls it'],
          rows: [
            ['1', 'Reachable next hop', 'Discard if unreachable', 'Network topology'],
            ['2', 'Weight (Cisco-specific)', 'Highest weight', 'Local router config'],
            ['3', 'LOCAL_PREF', 'Highest local preference', 'Operator policy (iBGP)'],
            ['4', 'Locally originated', 'Routes originated by this router', 'Local configuration'],
            ['5', 'AS_PATH length', 'Shortest AS path', 'Internet topology'],
            ['6', 'Origin type', 'IGP > EGP > Incomplete', 'Route origin'],
            ['7', 'MED (Multi-Exit Discriminator)', 'Lowest MED (same neighbor AS only)', 'Neighboring AS preference'],
            ['8', 'eBGP over iBGP', 'External over internal', 'Session type'],
            ['9', 'IGP metric to next hop', 'Lowest interior cost (hot-potato routing)', 'Interior routing protocol'],
            ['10', 'Oldest route', 'Most stable path', 'Route age'],
            ['11', 'Lowest router ID', 'Deterministic tiebreaker', 'Router identity'],
            ['12', 'Shortest cluster list', 'Fewer route reflector hops', 'Route reflector topology'],
            ['13', 'Lowest neighbor address', 'Final deterministic tiebreaker', 'Peer IP address'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/0/09/BGP_FSM.svg',
          alt: 'BGP finite state machine showing the states Idle, Connect, Active, OpenSent, OpenConfirm, and Established with transitions between them',
          caption: 'The BGP finite state machine. A BGP session transitions through Idle, Connect, Active, OpenSent, OpenConfirm, and Established states. Route advertisements only flow in the Established state. Understanding the FSM matters because a session that never reaches Established produces no routes -- and a session that drops from Established triggers withdrawal of all routes learned from that peer. Source: Wikimedia Commons, CC BY-SA 3.0.',
        },
        'The critical insight is that steps 2-3 (weight and local preference) are entirely operator-controlled. They override everything else. This is how a network engineer says "always prefer customer routes over peer routes" or "always exit through this specific transit provider." The AS path length at step 5 only matters if the operator has not already decided at steps 2-3.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Simplified BGP decision process.\nfunction selectBestPath(candidates) {\n  let eligible = candidates.filter(r => r.nextHopReachable);\n  if (eligible.length === 0) return null;\n  if (eligible.length === 1) return eligible[0];\n\n  // Step 3: Highest LOCAL_PREF (operator policy dominates)\n  const maxLP = Math.max(...eligible.map(r => r.localPref));\n  eligible = eligible.filter(r => r.localPref === maxLP);\n  if (eligible.length === 1) return eligible[0];\n\n  // Step 5: Shortest AS_PATH\n  const minLen = Math.min(...eligible.map(r => r.asPath.length));\n  eligible = eligible.filter(r => r.asPath.length === minLen);\n  if (eligible.length === 1) return eligible[0];\n\n  // Step 7: Lowest MED (only compare routes from same neighbor AS)\n  // Step 8: Prefer eBGP over iBGP\n  eligible = eligible.filter(r => r.sessionType === \'ebgp\') || eligible;\n\n  // Step 9: Lowest IGP metric to next hop (hot-potato routing)\n  const minIGP = Math.min(...eligible.map(r => r.igpCost));\n  eligible = eligible.filter(r => r.igpCost === minIGP);\n  if (eligible.length === 1) return eligible[0];\n\n  // Step 11: Lowest router ID (deterministic tiebreaker)\n  eligible.sort((a, b) => a.routerId.localeCompare(b.routerId));\n  return eligible[0];\n}',
        },
        'Step 9 deserves special attention: hot-potato routing. When multiple eBGP exits exist for the same prefix with the same local preference and AS path length, the router picks the exit closest to itself in the interior network. This means traffic leaves the AS as quickly as possible, minimizing the sending AS\'s cost. The receiving AS then carries the traffic further. This is the default economic behavior of transit networks.',
      ],
    },
    {
      heading: 'eBGP vs iBGP and route reflectors',
      paragraphs: [
        'BGP runs in two modes. External BGP (eBGP) connects different autonomous systems. Internal BGP (iBGP) distributes routes learned from eBGP peers to all routers within the same AS. The distinction matters because iBGP has a critical rule: a route learned from one iBGP peer must not be re-advertised to another iBGP peer. This prevents loops inside the AS but creates a scaling problem -- every iBGP speaker must peer with every other iBGP speaker (a full mesh).',
        'With N routers, a full iBGP mesh requires N*(N-1)/2 sessions. For a large ISP with 500 routers, that is 124,750 BGP sessions. This does not scale.',
        {
          type: 'table',
          headers: ['Feature', 'eBGP', 'iBGP'],
          rows: [
            ['Connects', 'Different ASes', 'Routers within same AS'],
            ['AS_PATH modification', 'Prepends own AS number', 'Does not modify AS_PATH'],
            ['Next hop', 'Changes to advertising router', 'Preserves original next hop (usually)'],
            ['LOCAL_PREF', 'Not carried (set on receipt)', 'Carried between iBGP peers'],
            ['Loop prevention', 'Reject if own AS in path', 'No re-advertisement rule (split horizon)'],
            ['Full mesh required?', 'No -- peer selectively', 'Yes, unless using route reflectors or confederations'],
          ],
        },
        'Route reflectors solve the full-mesh problem. A route reflector is an iBGP speaker that is allowed to re-advertise routes from one iBGP client to another. Clients peer only with the reflector, not with each other. This reduces the session count from O(N^2) to O(N). The tradeoff: the reflector becomes a critical path for route distribution, and cluster design must avoid routing loops (the CLUSTER_LIST and ORIGINATOR_ID attributes exist for this purpose).',
        {
          type: 'note',
          text: 'Large networks use hierarchical route reflectors -- reflectors of reflectors. This introduces another layer of complexity: routes may take suboptimal paths because the reflector selects a best path based on its own IGP costs, not the client\'s. This is the "route reflector suboptimality" problem, partially addressed by BGP Optimal Route Reflection (RFC 9107).',
        },
      ],
    },
    {
      heading: 'Communities, dampening, and traffic engineering',
      paragraphs: [
        'BGP communities are 32-bit tags attached to routes that signal intent between ASes. They are the protocol\'s extensibility mechanism -- a way for operators to communicate policy without changing the protocol itself.',
        {
          type: 'bullets',
          items: [
            'NO_EXPORT (0xFFFFFF01): do not advertise this route outside the AS. Used to keep routes local.',
            'NO_ADVERTISE (0xFFFFFF02): do not advertise this route to any peer, internal or external.',
            'Blackhole communities: signal the upstream to null-route traffic to a prefix. Used during DDoS attacks to drop malicious traffic at the network edge instead of the victim.',
            'Traffic-engineering communities: many transit providers define communities that let customers control route preference, AS path prepending, or geographic exit selection.',
            'Large communities (RFC 8092): extended to 96 bits (ASN:function:parameter) to avoid collisions between 4-byte AS numbers.',
          ],
        },
        'Route dampening (RFC 2439) penalizes routes that flap -- withdraw and re-announce rapidly. Each flap accumulates a penalty score. When the score exceeds a threshold, the route is suppressed (hidden from the decision process) until the penalty decays below a reuse threshold. Dampening prevents CPU exhaustion from unstable routes but can delay convergence for legitimate path changes. Modern best practice (RIPE-378, RFC 7196) recommends against aggressive dampening because the cure can be worse than the disease.',
        'AS path prepending is the simplest traffic-engineering tool: an AS artificially lengthens its AS path in advertisements to one peer to make that path less attractive. If AS 64501 normally advertises [64501] to both peers, prepending to peer B produces path [64501, 64501, 64501], making peer A\'s shorter path [64501] preferred by remote networks. Prepending is crude but widely used because it requires no coordination with the remote AS.',
      ],
    },
    {
      heading: 'How the pipeline works',
      paragraphs: [
        'A BGP UPDATE message announces or withdraws reachability for one or more prefixes. For an announcement, the router records path attributes such as AS_PATH, NEXT_HOP, LOCAL_PREF inside iBGP contexts, MED, origin information, communities, and other metadata. The exact record shape varies by implementation, but the conceptual unit is a candidate route for a prefix from a neighbor.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif',
          alt: 'Animation showing packets being switched through network nodes along different paths',
          caption: 'Packet switching in action. Each router makes an independent forwarding decision based on its FIB. BGP\'s job is to populate those FIBs with consistent, policy-compliant forwarding entries so that packets reach their destination even though no single router sees the full path. Source: Wikimedia Commons, CC BY-SA 3.0.',
        },
        'Import policy runs before the candidate can become local truth. Policy can reject the route, prefer it, lower its preference, attach tags, modify attributes allowed by the deployment, or route it into a particular table. This is where business intent enters the algorithm. The best mathematical path and the best commercial path are often different.',
        'The decision process compares eligible candidates using the 13-step ladder described above. The comparison is deterministic: given the same eligible candidates and policies, the same route wins. This determinism is essential for convergence -- if routers made different choices from the same inputs, the network would oscillate.',
        'Once a winner exists, Loc-RIB stores the selected local route. Export policy then decides what should be advertised to each neighbor. A customer may receive a different exported set than a peer or provider. The FIB receives forwarding-ready information derived from the selected route, often after recursive next-hop resolution through the interior routing system.',
      ],
    },
    {
      heading: 'Worked example: route advertisement propagation',
      paragraphs: [
        'Let us trace a route from origin to remote AS, step by step. AS 64496 originates prefix 203.0.113.0/24 at its border router.',
        {
          type: 'table',
          headers: ['Step', 'Actor', 'Action', 'AS_PATH at this point'],
          rows: [
            ['1', 'AS 64496 (origin)', 'Originates 203.0.113.0/24, advertises to transit provider AS 64501', '[64496]'],
            ['2', 'AS 64501 (transit)', 'Receives route, applies import policy (accept, set local-pref 100), prepends own AS, advertises to peers', '[64501, 64496]'],
            ['3', 'AS 64502 (peer of 64501)', 'Receives route, accepts via peering policy (local-pref 80, lower than customer)', '[64502, 64501, 64496]'],
            ['4', 'AS 64503 (customer of 64502)', 'Receives route from its transit provider. Path length is 3 ASes.', '[64502, 64501, 64496]'],
            ['5', 'AS 64503 also receives from AS 64510', 'Alternate path through different transit: path length 2 ASes', '[64510, 64496]'],
            ['6', 'AS 64503 decision', 'Both paths valid. If local-pref equal, shorter AS path via 64510 wins at step 5.', 'Selected: [64510, 64496]'],
          ],
        },
        'Now assume the router at AS 64503 learns three candidates for 203.0.113.0/24 from different peers. Peer A offers AS path [64501, 64496] with local preference 200 (set by import policy because 64501 is a paid customer). Peer B offers AS path [64502] with local preference 150. Peer C offers an even lower MED but matches an import filter that rejects it.',
        'A naive shortest-path rule would be tempted by B (path length 1) or C (lowest MED). The actual policy-shaped decision picks A. Local preference is an operator-controlled signal at step 3, and it dominates AS path length at step 5. The network is saying that traffic should leave through A even if B appears shorter in the path vector. Peer C never reaches the comparison because policy removes it from eligibility.',
        'Now peer A withdraws the route. If peer B is still retained as a candidate and its next hop remains reachable, the router can rerun the decision process and promote B into Loc-RIB. The FIB update still has to be published carefully, but the control plane does not need to ask the entire internet for a fresh answer. This is why retaining losing candidates matters -- reconvergence from Adj-RIB-In takes milliseconds; reconvergence from scratch takes minutes.',
      ],
    },
    {
      heading: 'The global routing table: scale and structure',
      paragraphs: [
        'As of 2024, the global BGP routing table contains approximately 1 million IPv4 prefixes and 200,000 IPv6 prefixes. These numbers grow steadily as address space is fragmented for traffic engineering, multihoming, and DDoS mitigation. Every BGP-speaking router on the default-free zone (DFZ) must store and process all of these routes.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg',
          alt: 'Visualization of internet routing paths showing a dense network of connections between autonomous systems',
          caption: 'A visualization of internet routing paths. Each line represents a route between autonomous systems. The dense core represents Tier 1 providers and major IXPs. The sparse edges are enterprise and stub networks. BGP maintains this entire graph as distributed state across ~75,000 autonomous systems. Source: Wikimedia Commons, The Opte Project, CC BY 2.5.',
        },
        {
          type: 'table',
          headers: ['Metric', 'Approximate value (2024)', 'Trend'],
          rows: [
            ['IPv4 prefixes in DFZ', '~1,000,000', 'Growing ~5-8% per year'],
            ['IPv6 prefixes in DFZ', '~200,000', 'Growing ~15-20% per year'],
            ['Active autonomous systems', '~75,000', 'Growing ~3-5% per year'],
            ['Full table memory (per router)', '~2-4 GB RAM', 'Grows with prefix count'],
            ['Convergence time (single prefix)', '30 seconds to 15 minutes', 'Depends on MRAI timers, dampening, path exploration'],
            ['BGP UPDATE messages per day', 'Billions globally', 'Spikes during outages and route leaks'],
          ],
        },
        'Convergence time is a critical operational metric. When a route changes, the update must propagate through the AS graph. BGP uses Minimum Route Advertisement Interval (MRAI) timers -- typically 30 seconds for eBGP -- to batch updates and prevent flooding. This means a single route change can take minutes to fully propagate. During that window, different routers have different views of the network, and packets may take suboptimal or even looping paths.',
        {
          type: 'note',
          text: 'The MRAI timer is a deliberate tradeoff: faster convergence vs. update storm prevention. Setting MRAI to 0 produces fastest convergence but risks overwhelming peers with rapid-fire updates during link flaps. The 30-second default is a compromise that works for most of the internet.',
        },
      ],
    },
    {
      heading: 'Why retaining losers matters',
      paragraphs: [
        'A losing route is not necessarily bad data. It may be a valid backup, a less preferred commercial path, a path that is useful only under failure, or a route that should be advertised to some neighbors but not others after policy. Keeping alternatives gives the router memory.',
        'This is the same reason many algorithms keep frontier state, backup candidates, or predecessor information. The current answer is a projection over richer internal state. If you collapse the internal state too early, every change becomes more expensive and less explainable.',
        'In operations, that richer state helps with troubleshooting. Engineers can ask what the neighbor announced, what policy did, which candidate won, why another candidate lost, whether the route was exported, and whether the FIB actually received the forwarding entry. Those questions map almost exactly to Adj-RIB-In, policy, Loc-RIB, Adj-RIB-Out, and FIB.',
        {
          type: 'code',
          language: 'bash',
          body: '# Operational troubleshooting: tracing the pipeline.\n# Show all candidates in Adj-RIB-In for a prefix:\nshow bgp ipv4 unicast 203.0.113.0/24\n\n# Show the selected best path in Loc-RIB:\nshow bgp ipv4 unicast 203.0.113.0/24 bestpath\n\n# Show what we advertise to a specific neighbor:\nshow bgp ipv4 unicast neighbors 10.0.0.1 advertised-routes\n\n# Show the FIB entry (forwarding table):\nshow ip route 203.0.113.0/24',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it separates claim, preference, selection, export, and forwarding. A neighbor\'s claim is not immediately trusted as local truth. Local truth is not automatically exported to every neighbor. Exported control-plane state is not identical to packet-forwarding state. Each boundary lets operators enforce a different invariant.',
        'The design also works because the comparison is deterministic. Given the same eligible candidates and policies, the router can choose the same best path. Determinism matters because routing changes need to converge. If every router made unstable or opaque choices, failures would become longer and harder to diagnose.',
        'Finally, the design works because BGP is incremental. The internet is too large for every small change to rebuild everything from scratch. Route updates modify candidate sets, decision processes rerun for affected prefixes, selected routes change, and forwarding tables are updated for the consequences.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg',
          alt: 'Server racks in a data center showing the physical infrastructure that BGP routing connects',
          caption: 'Data center infrastructure at the Wikimedia Foundation. Every server rack connects to the internet through routers running BGP. The routing decisions made by BGP determine which physical paths traffic takes across thousands of miles of fiber to reach these servers. Source: Wikimedia Commons, CC BY-SA 3.0.',
        },
      ],
    },
    {
      heading: 'Real incidents: when BGP goes wrong',
      paragraphs: [
        'BGP incidents are not theoretical. They are regular events that affect millions of users. Three cases illustrate the failure modes:',
        {
          type: 'table',
          headers: ['Incident', 'Date', 'What happened', 'Root cause', 'Impact'],
          rows: [
            ['Pakistan YouTube hijack', 'Feb 2008', 'Pakistan Telecom (AS 17557) announced YouTube\'s prefix 208.65.153.0/24 as a more-specific /25', 'Government-ordered block implemented as a BGP hijack that leaked to upstream PCCW', 'YouTube unreachable globally for ~2 hours'],
            ['Facebook outage', 'Oct 4, 2021', 'Facebook (AS 32934) withdrew all BGP routes for its prefixes', 'Maintenance command accidentally removed all BGP peering configurations', 'Facebook, Instagram, WhatsApp down for ~6 hours. DNS failed because resolvers couldn\'t reach Facebook\'s authoritative nameservers.'],
            ['Cloudflare/Verizon leak', 'Jun 24, 2019', 'A small ISP (AS 396531) leaked 20,000+ prefixes through Verizon (AS 701)', 'BGP optimizer at a small PA ISP leaked internal routes to transit; Verizon had no route filtering', 'Cloudflare, Amazon, and others saw traffic rerouted through a small ISP not equipped to handle it'],
          ],
        },
        'The Pakistan YouTube hijack is the textbook case. Pakistan Telecom was ordered to block YouTube domestically. An engineer implemented the block by originating YouTube\'s prefix 208.65.153.0/24 as two more-specific /25 routes (208.65.153.0/25 and 208.65.153.128/25). Because longest-prefix match means more-specific routes always win in the FIB, these /25 announcements overrode YouTube\'s legitimate /24 everywhere they propagated. The routes leaked to PCCW (a major transit provider) and spread globally. YouTube was unreachable worldwide for approximately two hours until PCCW withdrew the bogus routes.',
        'The Facebook outage of October 2021 was self-inflicted. A routine maintenance command intended to assess backbone capacity accidentally removed all BGP peering configurations. Facebook\'s border routers withdrew all routes for Facebook-owned prefixes. Because Facebook\'s DNS authoritative servers were also behind those prefixes, DNS resolution for facebook.com, instagram.com, and whatsapp.com failed globally. The recovery was slowed because Facebook\'s internal tools -- also dependent on the same network -- were unreachable, and physical access to data centers required badge systems that relied on the downed network.',
        {
          type: 'callout',
          text: 'The Facebook outage revealed a dangerous dependency: when your DNS infrastructure depends on the same BGP announcements as your services, a BGP withdrawal becomes a total outage. This is why critical infrastructure should maintain routing independence from the services it supports.',
        },
      ],
    },
    {
      heading: 'RPKI and route origin validation',
      paragraphs: [
        'Resource Public Key Infrastructure (RPKI) is the internet\'s answer to BGP\'s trust problem. RPKI allows IP address holders to cryptographically sign Route Origin Authorizations (ROAs) that declare which AS is authorized to originate a given prefix. Routers can then validate incoming routes against these ROAs.',
        {
          type: 'table',
          headers: ['Validation state', 'Meaning', 'Recommended action'],
          rows: [
            ['Valid', 'Route matches a published ROA', 'Accept normally'],
            ['Invalid', 'Route contradicts a published ROA (wrong AS or too specific)', 'Reject or lower preference'],
            ['Not Found', 'No ROA exists for this prefix', 'Accept (default) -- most prefixes still lack ROAs'],
          ],
        },
        'RPKI adoption has grown significantly: as of 2024, approximately 50% of IPv4 routes have valid ROAs, up from under 10% in 2019. Major networks (Cloudflare, Google, AT&T, NTT) now drop RPKI-invalid routes entirely. If RPKI had been widely deployed in 2008, the Pakistan YouTube hijack would have been automatically rejected by validating routers because Pakistan Telecom was not authorized to originate YouTube\'s prefix.',
        'RPKI does not solve all problems. It validates origin only -- it does not prevent route leaks (where a valid route is re-advertised to an unintended neighbor). BGPsec (RFC 8205) was designed to validate the entire AS path, but it has seen almost zero deployment due to performance costs (cryptographic validation per hop) and operational complexity. The practical defense against route leaks remains careful import/export filtering, community-based signaling, and monitoring systems like RIPE RIS and RouteViews.',
        {
          type: 'note',
          text: 'The internet routing security ecosystem is a layered defense: RPKI validates origin AS, IRR (Internet Routing Registry) databases document intended routing policy, and monitoring systems (BGPStream, RIPE RIS, RouteViews) detect anomalies in real time. No single layer is sufficient; defense in depth is the operational reality.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This model wins anywhere reachability is shaped by policy rather than a single shortest-path metric. Interdomain routing is built from business relationships, filtering, validation, traffic-engineering intent, and failure handling. A RIB pipeline gives those concerns somewhere explicit to live.',
        'It also wins as a teaching model for route leaks, prefix hijacks, route reflection, add-path, multipath, validation, and convergence. Once you understand the RIB stages, many routing incidents become state-machine failures: the wrong route was accepted, the wrong preference was assigned, the wrong route was exported, or the selected route failed to install correctly.',
        'For data-structure study, BGP connects maps, priority comparisons, records, filtering pipelines, incremental maintenance, and publication boundaries. It is a realistic example of why an algorithm\'s output is often less important than the state kept around that output.',
      ],
    },
    {
      heading: 'Where it can fail',
      paragraphs: [
        'Control-plane mistakes become forwarding incidents. Exporting too much can create a route leak. Accepting a false origin can enable a hijack. Choosing a path with an unreachable next hop can blackhole traffic. Letting unstable routes churn can consume CPU and delay convergence. The FIB may be fast, but it can only forward according to the control-plane answer it was given.',
        {
          type: 'table',
          headers: ['Failure mode', 'Bad state', 'Effect', 'Defense'],
          rows: [
            ['Route leak', 'Export policy too permissive', 'Traffic detours through unintended networks', 'Strict export filters, community-based signaling, monitoring'],
            ['Prefix hijack', 'False origin announcement', 'Traffic stolen or blackholed', 'RPKI/ROA validation, prefix filtering by transit providers'],
            ['Route flap', 'Unstable link causing rapid withdraw/re-announce', 'CPU exhaustion, delayed convergence', 'Route dampening (with caution), MRAI timers, BFD for fast failover'],
            ['Stale next hop', 'Selected path has unreachable next hop', 'Blackhole until next-hop tracking detects failure', 'BFD, next-hop validation, fast IGP convergence'],
            ['Memory exhaustion', 'Too many prefixes for router RAM', 'Router crash, cascading failures', 'Prefix limits per peer, route aggregation, hardware capacity planning'],
          ],
        },
        'The simplified comparison ladder can also mislead beginners. Real networks add vendor-specific behavior, route reflector rules, multipath, BGP communities, RPKI origin validation, policy language, dampening or suppression strategies, and internal routing interactions. The right lesson is the shape of the decision, not a belief that every router follows one tiny table printed in a tutorial.',
        'BGP also does not provide global optimality. Each autonomous system applies local policy with limited visibility. The result can be stable and useful without being globally shortest, cheapest, or fastest. That is not a failure of implementation; it is part of the protocol\'s decentralized contract.',
        {
          type: 'callout',
          text: 'BGP\'s lack of global optimization is a feature, not a bug. The alternative -- a single authority deciding all internet routing -- would require universal trust, universal visibility, and universal agreement on what "optimal" means. The internet works precisely because BGP does not require any of those things.',
        },
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Remember the verbs. Adj-RIB-In receives. Policy filters and rewrites. The decision process ranks. Loc-RIB records the local choice. Adj-RIB-Out advertises. The FIB forwards. Most BGP confusion comes from mixing those verbs together.',
        'Remember the safety boundary too: a route is not equally trusted at every stage. The further it moves through the pipeline, the more consequences it has. That is why mature networks invest so much effort in import policy, export policy, validation, route monitoring, and staged rollout of routing changes.',
        {
          type: 'callout',
          text: 'The single most important BGP lesson: the control plane is a database of beliefs about the network, not facts about the network. Every stage of the RIB pipeline exists to progressively validate, filter, and commit those beliefs before they become forwarding actions that affect real traffic.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 4271, "A Border Gateway Protocol 4 (BGP-4)", especially the RIB definitions and Decision Process: https://datatracker.ietf.org/doc/html/rfc4271. RFC 9069 discusses Loc-RIB access through BMP and restates the Loc-RIB role: https://datatracker.ietf.org/doc/html/rfc9069. RFC 6811 covers RPKI-based route origin validation: https://datatracker.ietf.org/doc/html/rfc6811.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: IP addressing and CIDR notation -- understanding prefixes, subnets, and longest-prefix match is essential before BGP makes sense.',
            'Prerequisite: Autonomous systems and the internet hierarchy -- Tier 1, Tier 2, stub networks, IXPs, and peering vs transit relationships.',
            'Extension: RPKI deployment and operations -- how ROAs are created, published, and validated. See https://rpki.readthedocs.io/.',
            'Extension: BGP monitoring and anomaly detection -- RIPE RIS (https://ris.ripe.net/), RouteViews (http://www.routeviews.org/), and BGPStream for real-time analysis.',
            'Contrast: OSPF/IS-IS -- link-state protocols that work inside a single AS. They solve a different problem (shortest path within one domain) and use fundamentally different mechanisms (topology flooding, Dijkstra).',
            'Contrast: Segment Routing (SR) -- modern traffic engineering that can reduce BGP\'s role by encoding forwarding paths in packet headers rather than per-hop FIB lookups.',
            'Study next: IP FIB Longest-Prefix Match Case Study, PATRICIA Trie, Consistent Hashing, Cilium eBPF Datapath Case Study.',
          ],
        },
        'The engineering question for BGP is not "is policy routing good?" The useful question is whether your import filters are tight enough, your RPKI validation is enabled, your route monitoring catches anomalies, and your team has practiced what happens when a peer leaks your prefixes to the world.',
        {
          type: 'quote',
          attribution: 'Network operations proverb',
          text: 'BGP is the duct tape that holds the internet together. It works not because it is elegant, but because it is flexible enough to encode every business relationship on the planet as a routing policy.',
        },
      ],
    },
  ],
};
