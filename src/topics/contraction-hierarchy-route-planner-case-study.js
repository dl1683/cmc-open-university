// Contraction hierarchies: preprocess a road graph by contracting low-importance
// vertices and adding shortcuts, then answer shortest-path queries quickly.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'contraction-hierarchy-route-planner-case-study',
  title: 'Contraction Hierarchy Route Planner Case Study',
  category: 'Systems',
  summary: 'A route-planning case study: road-graph preprocessing, node importance, witness search, shortcut edges, upward/downward queries, traffic customization, and update tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['preprocess', 'fast query'], defaultValue: 'preprocess' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function roadGraph(title) {
  return graphState({
    nodes: [
      { id: 's', label: 'S', x: 0.8, y: 3.5, note: 'start' },
      { id: 'a', label: 'A', x: 2.3, y: 2.2, note: 'local' },
      { id: 'b', label: 'B', x: 3.8, y: 3.5, note: 'minor' },
      { id: 'c', label: 'C', x: 5.3, y: 2.2, note: 'artery' },
      { id: 'd', label: 'D', x: 6.8, y: 3.5, note: 'hub' },
      { id: 't', label: 'T', x: 8.5, y: 3.5, note: 'goal' },
      { id: 'short', label: 'shortcut', x: 4.6, y: 5.6, note: 'A-D' },
    ],
    edges: [
      { id: 'e-s-a', from: 's', to: 'a', weight: 2 },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 1 },
      { id: 'e-b-c', from: 'b', to: 'c', weight: 1 },
      { id: 'e-c-d', from: 'c', to: 'd', weight: 1 },
      { id: 'e-d-t', from: 'd', to: 't', weight: 2 },
      { id: 'e-a-d', from: 'a', to: 'd', weight: 3 },
      { id: 'e-a-short', from: 'a', to: 'short', weight: 'skip' },
      { id: 'e-short-d', from: 'short', to: 'd', weight: 'skip' },
    ],
  }, { title });
}

function* preprocess() {
  yield {
    state: roadGraph('Start with a road graph'),
    highlight: { active: ['s', 'a', 'b', 'c', 'd', 't', 'e-a-b', 'e-b-c', 'e-c-d'], compare: ['short'] },
    explanation: 'Contraction hierarchies accelerate shortest-path queries by doing expensive preprocessing on a mostly stable road graph.',
  };
  yield {
    state: labelMatrix(
      'Contract order',
      [
        { id: 'b', label: 'B' },
        { id: 'a', label: 'A' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      [
        { id: 'rank', label: 'rank' },
        { id: 'why', label: 'why' },
      ],
      [
        ['low', 'minor'],
        ['mid', 'local'],
        ['high', 'artery'],
        ['top', 'hub'],
      ],
    ),
    highlight: { active: ['b:rank', 'a:rank'], compare: ['d:rank'] },
    explanation: 'Preprocessing assigns importance ranks. Low-importance nodes are contracted first. Important junctions and arterials survive higher in the hierarchy.',
    invariant: 'Shortcut correctness depends on witness searches during contraction.',
  };
  yield {
    state: roadGraph('Contracting minor nodes creates shortcuts'),
    highlight: { active: ['b', 'c', 'short', 'e-a-short', 'e-short-d'], found: ['e-a-d'], compare: ['e-a-b', 'e-b-c', 'e-c-d'] },
    explanation: 'When a contracted node lies on the shortest path between two neighbors, preprocessing adds a shortcut so future queries can skip the hidden local path.',
  };
  yield {
    state: labelMatrix(
      'Preprocess ledger',
      [
        { id: 'order', label: 'order' },
        { id: 'witness', label: 'witness' },
        { id: 'short', label: 'shortcuts' },
        { id: 'metric', label: 'metric' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['ranks', 'minutes'],
        ['searches', 'heavy'],
        ['edges', 'memory'],
        ['time', 'rebuild?'],
      ],
    ),
    highlight: { found: ['order:stored', 'short:stored'], compare: ['witness:cost', 'metric:cost'] },
    explanation: 'The speed comes from a preprocessing ledger: contraction order, witness-search results, shortcut edges, and metric assumptions. Dynamic traffic complicates the story.',
  };
}

function* fastQuery() {
  yield {
    state: roadGraph('Query searches upward through shortcut graph'),
    highlight: { active: ['s', 'a', 'short', 'd', 't', 'e-s-a', 'e-a-short', 'e-short-d', 'e-d-t'], removed: ['b', 'c'] },
    explanation: 'At query time, the router searches mostly upward in node importance, uses shortcuts to skip low-level paths, and then unpacks shortcuts into the original road sequence.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'query', min: 0, max: 4 }, y: { label: 'visited nodes', min: 0, max: 1000 } },
      series: [
        { id: 'dij', label: 'Dijkstra', points: [{ x: 0, y: 900 }, { x: 1, y: 870 }, { x: 2, y: 930 }, { x: 3, y: 890 }] },
        { id: 'ch', label: 'CH', points: [{ x: 0, y: 80 }, { x: 1, y: 60 }, { x: 2, y: 95 }, { x: 3, y: 70 }] },
      ],
      markers: [
        { id: 'fast', x: 1, y: 60, label: 'fast' },
      ],
    }),
    highlight: { active: ['ch', 'fast'], compare: ['dij'] },
    explanation: 'The payoff is fewer visited nodes per route query. The cost is preprocessing time, extra shortcut storage, and trickier updates when road weights change.',
  };
  yield {
    state: labelMatrix(
      'Update tradeoffs',
      [
        { id: 'closure', label: 'road close' },
        { id: 'traffic', label: 'traffic' },
        { id: 'profile', label: 'profile' },
        { id: 'map', label: 'new map' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'action', label: 'action' },
      ],
      [
        ['topology', 'rebuild'],
        ['weights', 'customize'],
        ['avoid toll', 'metric'],
        ['nodes', 'reprep'],
      ],
    ),
    highlight: { found: ['traffic:action', 'profile:action'], compare: ['closure:action', 'map:action'] },
    explanation: 'Contraction hierarchies are excellent when topology is stable. Live traffic and preferences need customization or alternative routing strategies.',
  };
  yield {
    state: labelMatrix(
      'Route artifact',
      [
        { id: 'path', label: 'path' },
        { id: 'short', label: 'shortcuts' },
        { id: 'eta', label: 'ETA' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'need', label: 'need' },
      ],
      [
        ['S-A-D-T', 'unpack'],
        ['A-D', 'expand'],
        ['6 min', 'metric'],
        ['version', 'replay'],
      ],
    ),
    highlight: { found: ['path:need', 'short:need', 'audit:need'] },
    explanation: 'A route response should include enough versioning to explain it later: graph version, metric profile, traffic snapshot, and any shortcuts that were unpacked.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'preprocess') yield* preprocess();
  else if (view === 'fast query') yield* fastQuery();
  else throw new InputError('Pick a contraction-hierarchy view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Preprocess" shows the offline pipeline: rank vertices by importance, contract low-ranked ones, run witness searches, and emit shortcuts. "Fast query" shows the online payoff: a bidirectional upward search on the compressed graph, then shortcut unpacking into the original road sequence.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current decision point: a vertex being ranked, a neighbor pair under witness search, or an upward edge being relaxed.',
            'Compare marks show original low-level paths that the witness search must beat to avoid adding a shortcut.',
            'Found marks are durable artifacts: assigned ranks, committed shortcuts, and final route metadata.',
          ],
        },
        {
          type: 'note',
          text: 'Safe inference rule: if every path from u to w that avoids v costs more than weight(u,v) + weight(v,w), then a shortcut u-w with that combined weight is required before v can be hidden from future queries.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The key idea is to add shortcut edges to the graph during a preprocessing phase so that a subsequent query phase can avoid exploring low-degree vertices altogether.',
          attribution: 'Geisberger, Sanders, Schultes, Delling, "Contraction Hierarchies: Faster and Simpler Hierarchical Routing in Road Networks" (2008), Section 1',
        },
        'A road router answers the same question all day: given a source, a target, and a travel profile, return an exact shortest route fast enough for an interactive product. The graph can contain tens of millions of vertices and edges, but the physical topology changes far more slowly than requests arrive. A continental road graph might update once a day; the service handles thousands of queries per second.',
        {type:'callout', text:'Contraction hierarchies buy fast routes by turning stable road topology into ranked shortcuts with witness-proofed distance preservation.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/31/Road-movement-hierarchy.svg', alt:'A road network diagram with arrows moving from local access roads through collection, distribution, transition, and main movement.', caption:'Hierarchy of traffic movement in road networks. Source: Wikimedia Commons, Ftrebien, CC0 1.0.'},
        'Running a full shortest-path search for every request wastes that stability. Dijkstra is exact but expands broadly from the source. A* uses geometry to bias the search, but it still rediscovers the same local streets, connectors, arterials, and highway entrances on query after query. Every request pays for structure that has not changed since the last map build.',
        'Contraction hierarchies move stable work into preprocessing. They build a shortcut graph that preserves shortest-path distances for a chosen metric, then answer queries by searching mostly upward through that hierarchy. The result touches far fewer vertices and unpacks shortcuts only for the final route.',
        {
          type: 'table',
          headers: ['Scale marker', 'Typical value'],
          rows: [
            ['European road graph', '~18M vertices, ~42M edges'],
            ['Preprocessing time', '5-30 minutes (depends on metric and order quality)'],
            ['Query: plain Dijkstra', '~500,000 vertices settled per query'],
            ['Query: CH', '~500-1,000 vertices settled per query'],
            ['Speedup factor', '500x-1,000x fewer settled vertices'],
          ],
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious exact baseline is Dijkstra with a priority queue. Settle the unsettled vertex with the smallest tentative distance, relax outgoing edges, stop when the target is settled. Correctness is clean as long as edge weights are nonnegative.',
        'A reasonable improvement is A*. Use a lower-bound heuristic -- typically straight-line distance divided by maximum road speed -- to focus the search toward the target. This is often much faster than uninformed Dijkstra and easy to combine with turn costs.',
        {
          type: 'diagram',
          text: 'Dijkstra from S:\n  settles outward in all directions\n  visits ~500K vertices on a continental graph\n  finds shortest path to T after broad expansion\n\nA* from S toward T:\n  biases toward T using heuristic\n  visits ~50K-200K vertices (geometry helps)\n  still rediscovers local streets near S and T\n\nCH query from S to T:\n  forward search climbs upward from S\n  reverse search climbs upward from T\n  meets at a high-ranked vertex\n  visits ~500-1,000 vertices total',
          label: 'Search footprint comparison on the same graph',
        },
        'Both baselines remain important. Contraction hierarchies do not replace the concept of shortest path; they specialize it for a graph that will be queried many times under the same metric. The question is whether expensive preprocessing is worth buying smaller online searches.',
        {
          type: 'table',
          headers: ['Approach', 'Stored before query', 'Query behavior', 'Main limit'],
          rows: [
            ['Dijkstra', 'Original weighted graph', 'Expands outward by smallest tentative distance', 'Repeats broad exploration for every request'],
            ['A*', 'Graph + admissible heuristic', 'Prefers nodes closer to target', 'Still rediscovers local structure each time'],
            ['CH', 'Ranks, shortcuts, unpack metadata', 'Bidirectional upward search on compressed graph', 'Pays preprocessing time and update complexity'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated exploration. A long route starts in local streets, climbs to larger roads, crosses a high-level corridor, then descends near the destination. Plain query-time search repeats that climb-cross-descend discovery for every source-target pair.',
        {
          type: 'diagram',
          text: 'Road hierarchy (informal, but real):\n\n  highway          ========================\n                  /                        \\\n  arterial     --/--                    --\\--\n              /      \\                /      \\\n  collector  /        \\              /        \\\n            /          \\            /          \\\n  local    S  . . . . .  ramp    ramp  . . . .  T\n\nDijkstra re-discovers this staircase on every query.\nCH encodes it once: low-rank local vertices are contracted,\nhigh-rank highway vertices survive, shortcuts skip the stairs.',
          label: 'The informal road hierarchy that CH formalizes',
        },
        'A standard shortest-path algorithm treats this hierarchy as an accident of edge weights. It has no precomputed proof that certain local intersections can be skipped safely. The hard part is the word "safely" -- it is easy to add a shortcut that seems plausible. It is harder to guarantee that removing a low-importance vertex does not lose a shortest path or invent a cheaper-than-real route.',
        {
          type: 'note',
          text: 'Bidirectional Dijkstra halves the search radius but still settles tens of thousands of vertices per query. ALT (A* with landmarks and triangle inequality) does better but still lacks precomputed shortcuts. The wall is not just direction -- it is redundant local expansion.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Encode the road hierarchy as vertex ranks and preserve distances while removing low-ranked vertices. Contract unimportant vertices first. If a shortest path between two remaining neighbors would have gone through the contracted vertex, add a shortcut edge with the same cost.',
        'A shortcut is not a new road. It is a compressed certificate that a lower-level path exists and has a known weight. The shortcut stores enough unpacking metadata to recover the original sequence of road edges for turn-by-turn output, geometry, and audit.',
        {
          type: 'diagram',
          text: 'Before contraction:\n  A --1-- B --1-- C --1-- D        (B and C are low-rank)\n\nContract B (rank 1):\n  Witness search: is there an A-to-C path avoiding B with cost <= 2?\n  No witness found.  Add shortcut A --2-- C.\n  A ======2====== C --1-- D\n\nContract C (rank 2):\n  Witness search: is there an A-to-D path avoiding C with cost <= 3?\n  No witness found.  Add shortcut A --3-- D.\n  A ============3============ D\n\nQuery uses only upward edges:\n  forward:   S -> A -> D    (shortcuts skip B, C)\n  reverse:   T -> D\n  Unpack A-D -> A-C-D -> A-B-C-D   (recursive)',
          label: 'Contraction, witness search, and shortcut creation',
        },
        'After many contractions, any shortest path can be represented as a path that climbs in rank from the source to some high-ranked meeting area and climbs in rank from the target in the reverse direction. The bidirectional upward query exploits that shape.',
        {
          type: 'note',
          text: 'The witness search is the correctness guardrail. It checks whether an alternate path already preserves the distance. If a witness exists, no shortcut is needed. If no witness exists within the cost bound, the shortcut is required. The entire construction depends on this check being correct.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system has two phases: offline preprocessing and online query.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Phase 1: Preprocessing -- contract vertices in importance order.\nfunction buildHierarchy(graph) {\n  const order = computeContractionOrder(graph);\n  for (const v of order) {\n    for (const u of inNeighbors(graph, v)) {\n      for (const w of outNeighbors(graph, v)) {\n        if (u === w) continue;\n        const viaV = weight(u, v) + weight(v, w);\n        const witness = boundedDijkstra(graph, u, w, {\n          forbidden: v, maxCost: viaV\n        });\n        if (witness.cost > viaV) {\n          graph.addShortcut({\n            from: u, to: w, weight: viaV,\n            unpackMiddle: v   // enough to recurse\n          });\n        }\n      }\n    }\n    graph.setRank(v, order.indexOf(v));\n    graph.markContracted(v);\n  }\n}',
        },
        'Preprocessing assigns an importance rank to every vertex. Low-importance vertices (dead-end streets, residential intersections) are contracted first. High-importance vertices (highway interchanges, major junctions) survive near the top. Importance can consider edge difference (shortcuts added minus edges removed), contracted-neighbor count, hierarchy depth, and domain-specific road class.',
        'When contracting vertex v, examine every incoming-outgoing neighbor pair (u, w). Run a bounded Dijkstra from u to w in the graph that forbids v. If the shortest such path costs more than weight(u,v) + weight(v,w), the preprocessor adds a shortcut u-w. Otherwise the distance is already preserved and no shortcut is needed.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Phase 2: Query -- bidirectional upward search.\nfunction chQuery(hierarchy, source, target) {\n  const fwd = new MinHeap();  // forward from source\n  const rev = new MinHeap();  // backward from target\n  fwd.insert(source, 0);\n  rev.insert(target, 0);\n  let bestCost = Infinity, meetVertex = null;\n\n  while (!fwd.empty() || !rev.empty()) {\n    if (!fwd.empty()) {\n      const [u, du] = fwd.extractMin();\n      if (du >= bestCost) { fwd.clear(); continue; }\n      for (const e of upwardEdges(hierarchy, u)) {\n        const nd = du + e.weight;\n        if (nd < fwd.dist(e.to)) {\n          fwd.decrease(e.to, nd);\n          if (nd + rev.dist(e.to) < bestCost) {\n            bestCost = nd + rev.dist(e.to);\n            meetVertex = e.to;\n          }\n        }\n      }\n    }\n    // symmetric for rev using upward edges in reversed graph\n  }\n  return unpackPath(hierarchy, source, meetVertex, target);\n}',
        },
        'At query time, the forward search starts at the source and follows only edges to higher-ranked vertices. The reverse search does the same from the target in the reversed graph. When a vertex has been reached by both sides, it is a meeting candidate. The search stops when no unsettled upward path can improve the best known meeting distance.',
        'The returned path is compressed: it contains shortcuts. Unpacking expands each shortcut into its stored middle vertex and recurses until only original edges remain. The final output uses those original edges for geometry, turn-by-turn instructions, and ETA.',
        {
          type: 'table',
          headers: ['Phase', 'Input', 'Output', 'Runs when'],
          rows: [
            ['Rank computation', 'Road graph + metric', 'Importance order for all vertices', 'Once per map version + metric'],
            ['Contraction', 'Graph + order', 'Shortcut edges with unpack references', 'Once per map version + metric'],
            ['Forward query', 'Source vertex', 'Upward tentative distances from source', 'Every route request'],
            ['Reverse query', 'Target vertex', 'Upward tentative distances from target', 'Every route request'],
            ['Meet scan', 'Both distance tables', 'Best meeting vertex and cost', 'Every route request'],
            ['Unpack', 'Compressed path with shortcuts', 'Original edge sequence', 'Every route request'],
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is induction over contractions. When vertex v is contracted, every shortest path between remaining neighbors u and w that passed through v is replaced by a shortcut of equal cost. Paths that did not use v remain in the graph. Contracting one vertex therefore preserves all shortest-path distances among the remaining vertices for the preprocessed metric.',
        'After all contractions, the hierarchy contains enough shortcuts so that any original shortest path has an equivalent that rises in rank to a highest-ranked vertex and then falls. The bidirectional upward query finds that representation by climbing from both ends.',
        {
          type: 'bullets',
          items: [
            'Distance invariant: after each contraction, shortest-path distances among uncontracted vertices are unchanged for the preprocessed metric.',
            'Shortcut invariant: every shortcut has the same cost as the concrete lower-level path it replaces and stores enough references to recover that path.',
            'Query invariant: forward and reverse searches only traverse edges toward higher-ranked vertices, so they search the compressed representation instead of reopening local detail.',
            'Audit invariant: a returned route can be unpacked into original edges under the same map version and metric profile used during search.',
          ],
        },
        'Unpacking preserves route meaning because every shortcut is backed by a stored lower-level path. The shortcut graph is the search artifact; the original graph remains the route artifact.',
        {
          type: 'note',
          text: 'The proof depends on witness search correctness. If the witness search has a bug -- stopping too early, not forbidding v properly, or using the wrong cost bound -- a required shortcut can be omitted and the hierarchy will return wrong distances. This is the single most dangerous implementation error in the entire system.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Typical cost', 'What drives growth'],
          rows: [
            ['Preprocessing', 'Minutes to hours for continental graph', 'Witness searches * neighbor-pair checks per vertex'],
            ['Shortcut storage', '1.5x-3x original edge count', 'Contraction order quality; bad orders cause shortcut explosion'],
            ['Query (settled vertices)', '500-1,000 on a European road graph', 'Rank distribution and graph structure'],
            ['Query (wall-clock)', 'Sub-millisecond', 'Cache locality of upward adjacency lists'],
            ['Shortcut unpacking', 'O(path length) recursive expansion', 'Depth of shortcut nesting'],
            ['Metric update', 'Full rebuild or customization pass', 'Fraction of shortcuts affected by weight changes'],
            ['Topology update', 'Partial or full rebuild', 'Number of shortcuts that touched the changed edge'],
          ],
        },
        'The payoff is query speed. A good hierarchy turns a route request from broad graph exploration into a small upward search plus shortcut unpacking. Settled vertices drop by two to three orders of magnitude on road networks with good contraction order.',
        'The tax is preprocessing time and shortcut storage. Preprocessing can take minutes or hours depending on graph size, order quality, and witness-search limits. The shortcut graph is typically 1.5x-3x the original edge count but can explode with bad order or complex turn restrictions.',
        {
          type: 'quote',
          text: 'A good node ordering is the key to a practical contraction hierarchy. It determines the number of shortcuts, preprocessing time, and query speed.',
          attribution: 'Geisberger et al. (2008), Section 4',
        },
        'Metric rigidity is the operational cost. Free-flow travel-time shortcuts become invalid when the service needs live traffic, avoid-toll, truck, bike, or weather-aware weights. Customizable contraction hierarchies (CCH) separate topology preprocessing from metric application, but the simple static form assumes one stable metric.',
        'Topology changes are harder than weight changes. A road closure, new road, or changed turn restriction can invalidate any shortcut that used that edge. A production router needs rebuild, partial update, fallback search, or overlay logic.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace the animation chain S-A-B-C-D-T with edge weights S-A=2, A-B=1, B-C=1, C-D=1, D-T=2.',
        {
          type: 'table',
          headers: ['Step', 'Action', 'Witness check', 'Result'],
          rows: [
            ['1. Rank vertices', 'B=rank 1 (minor), C=rank 2 (local), A=rank 3, D=rank 4 (hub)', '--', 'Contraction order: B, C, A, D'],
            ['2. Contract B', 'Check pair (A, C) via B: cost = 1+1 = 2', 'Dijkstra A-to-C avoiding B: no cheaper path exists', 'Add shortcut A-C, weight 2, unpack via B'],
            ['3. Contract C', 'Check pair (A, D) via C: cost = 2+1 = 3 (using shortcut A-C)', 'Dijkstra A-to-D avoiding C: no cheaper path exists', 'Add shortcut A-D, weight 3, unpack via C'],
            ['4. Query S to T', 'Forward: S(0)->A(2)->D(5). Reverse: T(0)->D(2).', 'Meet at D: 5+2=7 is best', 'Compressed path: S-A-D-T, cost 7'],
            ['5. Unpack', 'A-D is a shortcut (unpack via C) -> A-C-D. A-C is a shortcut (unpack via B) -> A-B-C.', '--', 'Final path: S-A-B-C-D-T, cost 7'],
          ],
        },
        {
          type: 'diagram',
          text: 'After preprocessing:\n\n  rank 4 (hub):     D\n                   / \\\n  rank 3:         A   T      (original edges S-A, D-T survive)\n                  |           plus shortcuts: A-C (wt 2), A-D (wt 3)\n  rank 2:         C\n                  |\n  rank 1 (minor): B           contracted -- skipped at query time\n                  |\n                  S\n\nQuery searches UPWARD only:\n  forward:  S -> A -> D  (using shortcut A-D)\n  reverse:  T -> D\n  meet at D, cost = 2+3+2 = 7',
          label: 'The hierarchy after contracting B and C',
        },
        'The shortcut A-D is safe only because witness search found no cheaper A-to-D path avoiding the contracted vertices. If another road already connected A to D at cost 3 or less, the shortcut would be unnecessary memory. If witness search missed a cheaper path, the hierarchy would return wrong distances.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Use case', 'Why CH fits', 'What the service stores'],
          rows: [
            ['Car navigation', 'Stable road topology, many queries per second', 'CH per metric profile (car, truck, pedestrian)'],
            ['Fleet routing / VRP', 'Distance matrix between N stops needs N^2 queries', 'Precomputed CH makes each query sub-millisecond'],
            ['Map-matching (HMM)', 'Viterbi transition probabilities need road distance between GPS candidates', 'CH query replaces Dijkstra in inner loop'],
            ['Isochrone computation', 'Reachable area from a point within time budget', 'CH-based one-to-many search'],
            ['Map tile preview', 'Route preview on hover needs sub-50ms response', 'CH avoids full search on every mouse move'],
          ],
        },
        'The common access pattern is many online queries over a graph whose structure is reused. CH fits when the route profile can be precomputed or customized in batches. A car profile with stable legal access and a daily traffic snapshot is friendlier than a request that changes constraints on every call.',
        {
          type: 'code',
          language: 'text',
          text: 'Production route response record:\n{\n  path:           [S, A, B, C, D, T],\n  cost:           7,\n  metric:         "car-free-flow-v3",\n  graph_version:  "2024-06-15T04:00:00Z",\n  traffic_snap:   "live-2024-06-15T14:32:00Z",\n  shortcuts_used: ["A-D (via C, via B)"],\n  turn_rules:     "v2024.6",\n  eta_seconds:    420\n}',
        },
        'Without graph version, metric profile, and traffic snapshot, the service cannot replay a route, explain an ETA, or know whether a disputed shortcut came from stale data.',
        {
          type: 'note',
          text: 'The case-study lesson is amortization. CH is not only a graph algorithm; it is a systems design that trades offline compute and versioned artifacts for lower online latency. The same pattern appears in database indexes, compiled shaders, and precomputed lookup tables.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Per-request cost changes: live traffic, truck restrictions, avoid-toll preferences, weather closures, and time-dependent turn costs break the assumption that one preprocessed metric serves many queries. Each distinct metric needs its own hierarchy or a customization layer.',
            'Shortcut explosion: poor contraction order can produce more shortcuts than original edges, bloating memory and slowing queries. Turn-expanded graphs (where state includes the incoming edge) compound the problem because the vertex count multiplies.',
            'Witness search bugs: too aggressive a witness bound omits a required shortcut, returning wrong distances. Too conservative a bound adds unnecessary shortcuts and wastes memory. Both errors are silent until a specific query hits the affected path.',
            'Small or rare-query graphs: if the graph has fewer than ~10,000 vertices or queries are infrequent, plain Dijkstra or A* is simpler, correct, and fast enough. CH preprocessing cost cannot be amortized.',
            'Topology instability: frequent road closures, construction, or map edits invalidate shortcuts that touched the changed edges. The router needs rebuild, partial repair, or fallback search -- not stale hierarchy data.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Mitigation'],
          rows: [
            ['Stale metric', 'Route ignores current traffic or road closure', 'Customizable CH, live overlay, or fallback A*'],
            ['Shortcut explosion', 'Memory grows past budget; query not faster than A*', 'Better contraction order; simpler turn model'],
            ['Witness bug', 'Distance returned is wrong for specific vertex pairs', 'Exhaustive validation against Dijkstra on random pairs'],
            ['Topology change', 'Shortcut references a deleted or modified edge', 'Incremental rebuild or full repreprocessing'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Geisberger, Sanders, Schultes, Delling, "Contraction Hierarchies" (2008)', 'Original paper: construction, witness search, query algorithm, European road graph experiments'],
            ['https://algo2.iti.kit.edu/schultes/hwy/contract.pdf', 'Full text of the original CH paper'],
            ['Dibbelt, Strasser, Wagner, "Customizable Contraction Hierarchies" (2016), arxiv:1402.0402', 'Separates topology preprocessing from metric customization -- handles multiple travel profiles'],
            ['OSRM (Open Source Routing Machine)', 'Production CH-based router; open-source reference implementation'],
            ['Luxen, Vetter, "Real-time routing with OpenStreetMap data" (2011)', 'OSRM design paper showing CH in a production map service'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Dijkstra Search -- the exact shortest-path algorithm whose work CH amortizes. Also priority queues and bidirectional search.',
            'Extension: A* Search -- the heuristic baseline CH replaces; understanding A* clarifies what CH gains and loses.',
            'Production variant: Customizable Contraction Hierarchies (CCH) -- separates topology from metric, enabling multi-profile routing without full rebuild.',
            'Adjacent case study: HMM Map Matching with Viterbi -- uses CH queries in the inner loop to compute road-distance transition probabilities.',
            'Contrasting alternative: partition-based routing (PUNCH, CRP) -- trades different update and memory tradeoffs for similar query speed.',
          ],
        },
      ],
    },
  ],
};
