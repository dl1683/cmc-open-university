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
        "Read the animation as the execution trace for Contraction Hierarchy Route Planner Case Study. A route-planning case study: road-graph preprocessing, node importance, witness search, shortcut edges, upward/downward queries, traffic customization, and update tradeoffs..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A road router answers the same shortest-path question all day: start here, end there, use this travel profile. The road graph may have millions of vertices and edges, but most of the topology changes slowly. A navigation service can answer many thousands of queries before a new map version arrives.',
        'Running a full shortest-path search for every request wastes that stability. Dijkstra search is exact, but it expands broadly from the start. A* can guide the search with geometry, but it still spends work rediscovering the same local streets, connectors, arterials, and highways on query after query.',
        'Contraction hierarchies move stable work into preprocessing. They build a shortcut graph that preserves shortest-path distances for a chosen metric. Query time then searches mostly upward through that hierarchy, touches far fewer vertices, and unpacks shortcuts only for the final route.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious exact baseline is Dijkstra search with a priority queue. It repeatedly settles the unsettled vertex with the smallest tentative distance, relaxes outgoing edges, and stops when the target is settled. The correctness story is clean as long as edge weights are nonnegative.',
        'A reasonable improvement is A*. Use a lower-bound heuristic such as straight-line distance to focus the search toward the target. This is often much faster than uninformed Dijkstra search and is easy to combine with turn costs and road profiles.',
        'Those baselines remain important. Contraction hierarchies do not replace the concept of shortest path; they specialize it for a graph that will be queried many times. The question is whether expensive preprocessing is worth buying smaller online searches.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated exploration. A long route search starts in local streets, climbs to larger roads, crosses a high-level corridor, then descends near the destination. Plain query-time search repeats that discovery for every source and target pair.',
        'Road networks also have an informal hierarchy. Small residential streets connect to collectors, collectors connect to arterials, and arterials connect to highways. A standard shortest-path algorithm treats that hierarchy as an accident of edge weights. It has no precomputed proof that certain local intersections can be skipped safely.',
        'The hard part is the word safely. It is easy to add a shortcut that seems plausible. It is harder to guarantee that removing a low-importance vertex does not lose a shortest path or invent a route that is cheaper than any real road sequence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to encode road hierarchy as vertex ranks and preserve distances while removing low-ranked vertices. Contract unimportant vertices first. If a shortest path between two remaining neighbors would have gone through the contracted vertex, add a shortcut edge with the same cost.',
        'A shortcut is not a new road. It is a compressed certificate that a lower-level path exists and has a known weight. The shortcut must store enough unpacking metadata to recover the original sequence of road edges for turn-by-turn output, geometry, and audit.',
        'After many contractions, shortest paths can be represented by paths that climb in rank from the source to some high-ranked middle area and climb in rank from the target in the reverse direction. Query time exploits that shape with a bidirectional upward search.',
      ],
    },
    {
      heading: 'Data model',
      paragraphs: [
        'The preprocessed graph stores original edges, a rank for every vertex, shortcut edges, shortcut weights, and unpacking references. It may also store turn restrictions, metric version, access profile, and geometry references outside the core graph. The shortest-path calculation and the route presentation both need the shortcut metadata.',
        'Ranks impose direction on the query graph. For a forward search from the source, an edge is usable if it goes to a higher-ranked vertex. For a reverse search from the target, the same rule applies in the reversed graph. The best meeting point between the two upward searches gives a candidate route cost.',
        'The data model is versioned. A route produced from a hierarchy should carry the map version, metric profile, customization or traffic snapshot, and shortcut unpacking chain. Without those fields, the service cannot explain why it chose a route later.',
      ],
    },
    {
      heading: 'How preprocessing works',
      paragraphs: [
        'Preprocessing starts by choosing a contraction order. Good orders contract local, low-importance vertices early and keep separators, major junctions, and highway-like vertices until later. Importance can consider edge difference, shortcut count, contracted-neighbor count, hierarchy depth, and domain-specific road attributes. Bad orders create too many shortcuts and erase the query-time advantage.',
        'When contracting vertex v, the algorithm examines incoming and outgoing neighbor pairs. Suppose u connects to v and v connects to w. If the shortest u-to-w path in the graph without v is longer than the path u-v-w, then removing v would hide a shortest path. The preprocessor adds a shortcut from u to w with the weight of u-v-w.',
        'The witness search is the guardrail. It looks for an alternate path from u to w that avoids v and is no more expensive. If such a witness exists, no shortcut is needed because the shortest distance is already preserved. If no witness exists within the relevant bound, the shortcut is required.',
        'This phase is expensive because it runs many bounded shortest-path searches and writes many shortcuts. The point is to pay that price once per graph and metric version, then answer many queries quickly.',
      ],
    },
    {
      heading: 'How queries work',
      paragraphs: [
        'At query time, run a bidirectional shortest-path search on the hierarchy. The forward search starts at the source and follows only upward edges. The reverse search starts at the target on the reversed graph and also follows only upward edges. Each side keeps tentative distances, and the best vertex seen by both searches is a meeting candidate.',
        'The search can stop when no unsettled upward path can improve the best known meeting distance. The result is a compressed path from the source up to the meeting vertex and from the meeting vertex down to the target after reversing the target-side path.',
        'The route is then unpacked. A shortcut A-D may expand into A-B-C-D, and those internal edges may include additional shortcuts that must be unpacked recursively. The final output uses original road edges for geometry, instructions, legal restrictions, distance, ETA, and debugging.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In a chain S-A-B-C-D-T, suppose B and C are low-ranked local intersections. Contracting B checks whether A can reach C without B at equal or lower cost. If not, preprocessing adds shortcut A-C. Later, contracting C may add shortcut A-D. A query from S to T can use S-A, shortcut A-D, and D-T instead of scanning B and C at query time.',
        'That shortcut is safe only because witness search failed to find a cheaper or equal A-to-D path that avoids the contracted vertices. If another road already gave A-to-D at the same or lower cost, adding the shortcut would waste memory. If the witness search missed a real cheaper path, the hierarchy could preserve a non-shortest route and the query answer would be wrong for that metric.',
        'The example also shows why shortcuts need unpacking references. The service cannot tell a driver to take shortcut A-D. It must recover A-B-C-D or whatever original edge sequence the shortcut represents.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is induction over contractions. When a vertex is contracted, every shortest path that needs that vertex between remaining neighbors is replaced by a shortcut of equal cost. Paths that do not need the vertex remain in the graph. Therefore contracting one vertex preserves all shortest-path distances among the remaining vertices for the metric being preprocessed.',
        'After all contractions, the hierarchy contains enough shortcuts to represent any original shortest path without descending into already-contracted low-rank detail during query search. A shortest path can be transformed into one that rises in rank to a highest-ranked vertex and then falls. The bidirectional upward query finds that representation by climbing from both ends.',
        'Unpacking preserves route meaning because every shortcut is backed by a stored lower-level path. The shortcut graph is the search artifact; the original graph remains the route artifact.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The payoff is query speed. A good hierarchy turns a route request from broad graph exploration into a small upward search plus shortcut unpacking. The number of visited vertices can drop by orders of magnitude on road networks with good contraction order.',
        'The tax is preprocessing time and shortcut storage. Preprocessing can take minutes or hours depending on graph size, order quality, witness-search limits, and metric complexity. The shortcut graph can be much larger than the original graph if contraction order is poor or turn-expanded state is large.',
        'Metric rigidity is the operational cost. If edge weights are free-flow travel time and the service later needs live traffic, avoid-toll, truck, bike, or weather-aware weights, the precomputed shortcut weights may no longer be valid. Customizable contraction hierarchies and related techniques separate topology preprocessing from metric customization, but the simple static form assumes the metric is stable.',
        'Topology changes are harder than weight changes. A temporary closure, new road, deleted edge, or changed turn restriction can invalidate shortcuts that used that part of the graph. A production router needs rebuild, partial update, fallback search, or overlay logic rather than pretending the old hierarchy is still evidence.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Contraction hierarchies fit route services with stable topology and many repeated shortest-path queries: car navigation, fleet routing, map previews, distance matrices, isochrone seeds, and map-matching transition scoring. The common access pattern is many online queries over a graph whose structure is reused.',
        'They are especially useful when the route profile can be precomputed or customized in batches. A car profile with stable legal access and a daily traffic snapshot is friendlier than a request that changes constraints on every call.',
        'Production route responses need graph version, metric profile, traffic snapshot or customization version, shortcut unpacking, and turn-restriction handling. Without those fields, the service cannot replay a route, explain an ETA, or know whether a disputed shortcut came from stale data.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The technique is weaker when costs change per request. Live traffic, truck restrictions, avoid-toll preferences, weather closures, time-dependent turn costs, and per-user policies can all break the assumption that one preprocessed metric serves many queries.',
        'Shortcut explosion is another failure mode. Poor contraction order can add so many shortcuts that memory rises and query speed falls. Complex turn restrictions can also force a larger state space than plain vertex-to-vertex shortest path, because the state may need to encode the incoming edge or maneuver context.',
        'Witness search mistakes are correctness bugs. Too aggressive a witness bound can omit a required shortcut. Too conservative a policy can add unnecessary shortcuts and bloat memory. Engineering a router means validating both distance correctness and shortcut volume, not just measuring fast demo queries.',
        'Finally, CH is a poor fit when the graph is small, queries are rare, or preprocessing cannot be amortized. A simple Dijkstra or A* implementation may be more maintainable and fast enough.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Dijkstra first, because contraction hierarchies preserve the same shortest-path objective while changing when the work is paid. Then study A* Search, bidirectional search, priority queues, graph separators, turn-expanded routing graphs, and witness search.',
        'For production routing, study customizable contraction hierarchies, multi-level Dijkstra-style routing, OSRM-style route engines, time-dependent routing, HMM Map Matching with Viterbi, and distance-matrix computation. The useful comparison is preprocessing-heavy CH versus query-flexible A* and partition-based routing.',
        'Primary sources and references include "Contraction Hierarchies: Faster and Simpler Hierarchical Routing in Road Networks" at https://algo2.iti.kit.edu/schultes/hwy/contract.pdf and customizable route planning work such as https://arxiv.org/abs/1402.0402.',
      ],
    },
      {
      heading: 'How it works',
      paragraphs: [
        "Describe the mechanism as a sequence of state transitions, not as a story.",
        "Each step should say what changes, what stays true, and why the move is legal.",
        "The animation should look like this section made concrete.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for contraction-hierarchy-route-planner-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
