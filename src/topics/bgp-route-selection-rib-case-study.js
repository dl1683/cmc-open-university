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
      heading: 'Why this exists',
      paragraphs: [
        'BGP is the protocol that lets independently operated networks exchange reachability. Your network may learn several possible paths for the same prefix from transit providers, peers, route reflectors, internal routers, or customer links. The router cannot treat those updates as packet-forwarding truth. It has to store candidates, apply policy, choose one local view, decide what to advertise, and then program the forwarding plane.',
        'The RIB split is the data model that keeps those duties separate. Adj-RIB-In is what neighbors have told the router. Import policy filters or rewrites that candidate state. Loc-RIB is the router\'s selected local routing information. Adj-RIB-Out is what this router is prepared to tell a neighbor after export policy. The FIB is the packet-speed table used by forwarding hardware or the kernel datapath.',
        'That separation is why this belongs in a data-structures curriculum. BGP is not only a protocol message format. Operationally, it is a set of evolving records, indexes, policies, comparisons, and publications. A bad record in the control plane can program a very fast forwarding plane with the wrong answer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to install the latest update for a prefix directly into the FIB. That is simple, and it resembles a last-writer-wins map from prefix to next hop. It is also wrong. A new path might violate import policy, have an unreachable next hop, be worse than an existing path, carry attributes that should not be exported, or come from a neighbor that is allowed to announce only a narrow set of routes.',
        'Another tempting shortcut is to think of BGP route choice as the same thing as packet longest-prefix match. They are different stages. BGP chooses a best path among candidates for one prefix. The FIB later chooses the most specific matching prefix for a packet destination. Confusing those two layers makes routing behavior look arbitrary when it is actually two ordered decisions composed together.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is policy. The shortest AS path is not always the path an operator wants. A paid customer route may outrank a peer route. A route from one neighbor may be accepted only for certain prefixes. A route may carry communities that request no-export behavior, blackhole handling, prepending, or local preference changes. The router needs a programmable decision surface before packets are affected.',
        'The second wall is churn. Paths are withdrawn, links fail, route reflectors update, prefixes flap, and validation state changes. If the router discards every losing candidate, a failure of the current winner forces a slow rediscovery process. If it retains alternatives, the best-path process can promote a backup already present in Adj-RIB-In.',
        'The third wall is blast radius. BGP mistakes propagate. A route leak can redirect traffic across the wrong network. A prefix hijack can attract traffic to an unauthorized origin. A stale next hop can blackhole traffic. The data structure is not academic; its invariants are operational safety rules.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'For each prefix, store route candidates as records with attributes. Import policy decides which records survive and how their attributes are normalized. The decision process ranks the survivors in a deterministic order. The selected route enters Loc-RIB. Export policy decides what, if anything, is placed into Adj-RIB-Out for each neighbor. The forwarding process turns selected routes into FIB entries.',
        'The transferable idea is ordered reduction over candidate records with retained backups. BGP does not just keep a single answer. It keeps enough structured state to explain where the answer came from, why other answers lost, what should be advertised, and what can replace the winner if the world changes.',
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
      heading: 'How the pipeline works',
      paragraphs: [
        'A BGP UPDATE message announces or withdraws reachability for one or more prefixes. For an announcement, the router records path attributes such as AS_PATH, NEXT_HOP, LOCAL_PREF inside iBGP contexts, MED, origin information, communities, and other metadata. The exact record shape varies by implementation, but the conceptual unit is a candidate route for a prefix from a neighbor.',
        'Import policy runs before the candidate can become local truth. Policy can reject the route, prefer it, lower its preference, attach tags, modify attributes allowed by the deployment, or route it into a particular table. This is where business intent enters the algorithm. The best mathematical path and the best commercial path are often different.',
        'The decision process compares eligible candidates. Common simplified ladders begin with validity and next-hop reachability, then operator preference, AS path length, origin type, MED in constrained cases, eBGP over iBGP, IGP cost to next hop, and deterministic tie breaks. Vendor behavior and configuration details matter, so a curriculum should teach the ladder as a model, not as a replacement for device documentation.',
        'Once a winner exists, Loc-RIB stores the selected local route. Export policy then decides what should be advertised to each neighbor. A customer may receive a different exported set than a peer or provider. The FIB receives forwarding-ready information derived from the selected route, often after recursive next-hop resolution through the interior routing system.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume the router learns three candidates for 203.0.113.0/24. Peer A offers AS path "64501 64496" with local preference 200. Peer B offers AS path "64502" with local preference 150. Peer C offers an even lower MED but matches an import filter that rejects it. A naive shortest-path rule would be tempted by B or C. The actual policy-shaped decision picks A.',
        'That result is not a bug. Local preference is an operator-controlled signal, and it usually dominates AS path length. The network is saying that traffic should leave through A even if B appears shorter in the path vector. Peer C never reaches the comparison because policy removes it from eligibility.',
        'Now peer A withdraws the route. If peer B is still retained as a candidate and its next hop remains reachable, the router can rerun the decision process and promote B into Loc-RIB. The FIB update still has to be published carefully, but the control plane does not need to ask the entire internet for a fresh answer.',
      ],
    },
    {
      heading: 'Why retaining losers matters',
      paragraphs: [
        'A losing route is not necessarily bad data. It may be a valid backup, a less preferred commercial path, a path that is useful only under failure, or a route that should be advertised to some neighbors but not others after policy. Keeping alternatives gives the router memory.',
        'This is the same reason many algorithms keep frontier state, backup candidates, or predecessor information. The current answer is a projection over richer internal state. If you collapse the internal state too early, every change becomes more expensive and less explainable.',
        'In operations, that richer state helps with troubleshooting. Engineers can ask what the neighbor announced, what policy did, which candidate won, why another candidate lost, whether the route was exported, and whether the FIB actually received the forwarding entry. Those questions map almost exactly to Adj-RIB-In, policy, Loc-RIB, Adj-RIB-Out, and FIB.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it separates claim, preference, selection, export, and forwarding. A neighbor\'s claim is not immediately trusted as local truth. Local truth is not automatically exported to every neighbor. Exported control-plane state is not identical to packet-forwarding state. Each boundary lets operators enforce a different invariant.',
        'The design also works because the comparison is deterministic. Given the same eligible candidates and policies, the router can choose the same best path. Determinism matters because routing changes need to converge. If every router made unstable or opaque choices, failures would become longer and harder to diagnose.',
        'Finally, the design works because BGP is incremental. The internet is too large for every small change to rebuild everything from scratch. Route updates modify candidate sets, decision processes rerun for affected prefixes, selected routes change, and forwarding tables are updated for the consequences.',
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
        'The simplified comparison ladder can also mislead beginners. Real networks add vendor-specific behavior, route reflector rules, multipath, BGP communities, RPKI origin validation, policy language, dampening or suppression strategies, and internal routing interactions. The right lesson is the shape of the decision, not a belief that every router follows one tiny table printed in a tutorial.',
        'BGP also does not provide global optimality. Each autonomous system applies local policy with limited visibility. The result can be stable and useful without being globally shortest, cheapest, or fastest. That is not a failure of implementation; it is part of the protocol\'s decentralized contract.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Remember the verbs. Adj-RIB-In receives. Policy filters and rewrites. The decision process ranks. Loc-RIB records the local choice. Adj-RIB-Out advertises. The FIB forwards. Most BGP confusion comes from mixing those verbs together.',
        'Remember the safety boundary too: a route is not equally trusted at every stage. The further it moves through the pipeline, the more consequences it has. That is why mature networks invest so much effort in import policy, export policy, validation, route monitoring, and staged rollout of routing changes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 4271, "A Border Gateway Protocol 4 (BGP-4)", especially the RIB definitions and Decision Process: https://datatracker.ietf.org/doc/html/rfc4271. RFC 9069 discusses Loc-RIB access through BMP and restates the Loc-RIB role: https://datatracker.ietf.org/doc/html/rfc9069. Study IP FIB Longest-Prefix Match Case Study next, then PATRICIA Trie, Hash Table, Binary Heap, Message Queue, Distributed Tracing, Cilium eBPF Datapath Case Study, and Consistent Hashing.',
      ],
    },
  ],
};
