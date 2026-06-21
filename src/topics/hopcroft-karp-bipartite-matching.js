// Hopcroft-Karp: maximum bipartite matching by augmenting many shortest paths
// per phase instead of one path at a time.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hopcroft-karp-bipartite-matching',
  title: 'Hopcroft-Karp Bipartite Matching',
  category: 'Data Structures',
  summary: 'Find maximum bipartite matchings by layering shortest augmenting paths with BFS, then augmenting a disjoint batch with DFS.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['layered search', 'augment phase'], defaultValue: 'layered search' },
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

function matchingGraph(title) {
  return graphState({
    nodes: [
      { id: 'u1', label: 'u1', x: 1.0, y: 1.2, note: 'free left' },
      { id: 'u2', label: 'u2', x: 1.0, y: 3.2, note: 'matched' },
      { id: 'u3', label: 'u3', x: 1.0, y: 5.2, note: 'free left' },
      { id: 'u4', label: 'u4', x: 1.0, y: 7.2, note: 'matched' },
      { id: 'v1', label: 'v1', x: 5.0, y: 1.2, note: 'matched' },
      { id: 'v2', label: 'v2', x: 5.0, y: 3.2, note: 'matched' },
      { id: 'v3', label: 'v3', x: 5.0, y: 5.2, note: 'free right' },
      { id: 'v4', label: 'v4', x: 5.0, y: 7.2, note: 'free right' },
      { id: 'nil', label: 'NIL', x: 8.5, y: 4.2, note: 'free endpoint' },
    ],
    edges: [
      { id: 'e-u1-v1', from: 'u1', to: 'v1', weight: 'candidate' },
      { id: 'e-u1-v3', from: 'u1', to: 'v3', weight: 'free target' },
      { id: 'e-u2-v1', from: 'u2', to: 'v1', weight: 'matched' },
      { id: 'e-u2-v2', from: 'u2', to: 'v2', weight: 'candidate' },
      { id: 'e-u3-v2', from: 'u3', to: 'v2', weight: 'candidate' },
      { id: 'e-u3-v4', from: 'u3', to: 'v4', weight: 'free target' },
      { id: 'e-u4-v2', from: 'u4', to: 'v2', weight: 'matched' },
      { id: 'e-u4-v4', from: 'u4', to: 'v4', weight: 'candidate' },
      { id: 'e-v3-nil', from: 'v3', to: 'nil', weight: 'unmatched' },
      { id: 'e-v4-nil', from: 'v4', to: 'nil', weight: 'unmatched' },
    ],
  }, { title });
}

function* layeredSearch() {
  yield {
    state: matchingGraph('Start from all free vertices on the left'),
    highlight: { active: ['u1', 'u3'], compare: ['u2', 'u4'], found: ['v3', 'v4'] },
    explanation: 'Hopcroft-Karp keeps a partial matching. Each phase begins with BFS from every free vertex on the left side. The goal is not one path; it is the full layer graph of shortest augmenting paths.',
    invariant: 'Only shortest augmenting paths are eligible in the current phase.',
  };

  yield {
    state: labelMatrix(
      'BFS alternates edge types',
      [
        { id: 'l0', label: 'layer 0' },
        { id: 'l1', label: 'layer 1' },
        { id: 'l2', label: 'layer 2' },
        { id: 'stop', label: 'stop' },
      ],
      [{ id: 'vertices', label: 'vertices' }, { id: 'edge_rule', label: 'edge rule' }],
      [
        ['free U: u1,u3', 'start'],
        ['unmatched edges to V', 'u -> v not in M'],
        ['matched partners in U', 'v -> pair[v]'],
        ['first free V found', 'distance to NIL fixed'],
      ],
    ),
    highlight: { active: ['l0:vertices', 'l1:edge_rule'], found: ['stop:vertices'] },
    explanation: 'The BFS direction matters. From U, follow edges not currently in the matching. From V, follow the matched edge back to U. The first time a free V is reachable, the shortest augmenting length is known.',
  };

  yield {
    state: matchingGraph('Layer graph exposes two shortest augmenting paths'),
    highlight: { active: ['u1', 'v3', 'e-u1-v3', 'u3', 'v4', 'e-u3-v4'], found: ['nil'] },
    explanation: 'In this toy graph, u1->v3 and u3->v4 are both shortest augmenting paths and they are vertex-disjoint. A one-path-at-a-time algorithm would augment only one. Hopcroft-Karp takes both in the same phase.',
  };

  yield {
    state: labelMatrix(
      'Why batching matters',
      [
        { id: 'single', label: 'one path per pass' },
        { id: 'hk', label: 'Hopcroft-Karp' },
        { id: 'dense', label: 'dense graph' },
        { id: 'sparse', label: 'sparse graph' },
      ],
      [{ id: 'idea', label: 'idea' }, { id: 'cost', label: 'cost' }],
      [
        ['augment greedily', 'can need many passes'],
        ['batch shortest paths', 'O(E sqrt(V))'],
        ['many edges', 'BFS dominates'],
        ['few edges', 'batching still helps'],
      ],
    ),
    highlight: { found: ['hk:cost'], compare: ['single:cost'] },
    explanation: 'The data-structure lesson is phase discipline. By refusing longer paths until all shortest ones are exhausted, the algorithm bounds how often path length can increase.',
  };
}

function* augmentPhase() {
  yield {
    state: labelMatrix(
      'DFS only follows the BFS layers',
      [
        { id: 'try1', label: 'try u1' },
        { id: 'take1', label: 'take v3' },
        { id: 'try3', label: 'try u3' },
        { id: 'take3', label: 'take v4' },
      ],
      [{ id: 'dfs', label: 'DFS choice' }, { id: 'result', label: 'result' }],
      [
        ['u1 -> v3', 'augment'],
        ['flip edge', 'u1 matched'],
        ['u3 -> v4', 'augment'],
        ['flip edge', 'u3 matched'],
      ],
    ),
    highlight: { active: ['try1:dfs', 'try3:dfs'], found: ['take1:result', 'take3:result'] },
    explanation: 'After BFS fixes the shortest distance, DFS searches for vertex-disjoint augmenting paths inside that layered graph. It ignores edges that would leave the layer discipline.',
    invariant: 'A phase augments a maximal set of vertex-disjoint shortest augmenting paths.',
  };

  yield {
    state: matchingGraph('Flip unmatched/matched status along each path'),
    highlight: { found: ['e-u1-v3', 'e-u3-v4'], active: ['u1', 'v3', 'u3', 'v4'], compare: ['e-u2-v1', 'e-u4-v2'] },
    explanation: 'Augmenting means toggling every edge on the path. Unmatched edges become matched; matched edges on longer alternating paths would be removed. The matching size increases by one per augmenting path.',
  };

  yield {
    state: labelMatrix(
      'Case study: marketplace assignment',
      [
        { id: 'left', label: 'left side' },
        { id: 'right', label: 'right side' },
        { id: 'edge', label: 'edge' },
        { id: 'matching', label: 'matching' },
      ],
      [{ id: 'meaning', label: 'meaning' }, { id: 'constraint', label: 'constraint' }],
      [
        ['drivers', 'one route each'],
        ['delivery routes', 'one driver each'],
        ['qualified + available', 'eligible assignment'],
        ['chosen edges', 'no shared endpoint'],
      ],
    ),
    highlight: { active: ['edge:meaning'], found: ['matching:constraint'] },
    explanation: 'The complete use case is assignment under binary eligibility. If every driver-route pair is either allowed or not allowed, maximum bipartite matching finds the largest feasible assignment before cost optimization enters the picture.',
  };

  yield {
    state: labelMatrix(
      'Where to go next',
      [
        { id: 'unweighted', label: 'unweighted matching' },
        { id: 'weighted', label: 'weighted assignment' },
        { id: 'flow', label: 'flow network' },
        { id: 'dynamic', label: 'changing graph' },
      ],
      [{ id: 'tool', label: 'tool' }, { id: 'reason', label: 'reason' }],
      [
        ['Hopcroft-Karp', 'maximize cardinality'],
        ['Hungarian / min-cost flow', 'optimize value'],
        ['Max flow', 'general capacities'],
        ['incremental matching', 'avoid full rebuild'],
      ],
    ),
    highlight: { found: ['unweighted:tool', 'flow:tool'], compare: ['weighted:tool'] },
    explanation: 'Hopcroft-Karp solves a specific matching problem extremely well. If edges have costs, capacities, or non-bipartite structure, the problem has changed and the data structure should change with it.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'layered search') yield* layeredSearch();
  else if (view === 'augment phase') yield* augmentPhase();
  else throw new InputError('Pick a Hopcroft-Karp view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        `The animation shows two columns of vertices -- left (U) and right (V) -- connected by edges. Matched edges are distinguished from candidate edges. A sentinel node NIL marks free right endpoints. Active highlights mark the vertices and edges the algorithm is currently examining. Found highlights mark edges that have been added to the matching. Compare highlights mark edges that were already matched before this phase.`,
        {type: `callout`, text: `Hopcroft-Karp is fast because one BFS phase finds the shortest legal layer graph, then DFS spends that layer graph on a whole batch of disjoint augmenting paths.`},
        `In the layered-search view, watch BFS build distance labels outward from every free left vertex, alternating between unmatched edges (left to right) and matched edges (right back to left). The search stops the moment a free right vertex is reached. In the augment-phase view, watch DFS trace vertex-disjoint paths through those layers, then flip matched and unmatched edges along each path.`,
        `After each frame, identify: which vertices gained a distance label, which edges changed status, and why the algorithm chose to stop or continue. The layer graph is the structure; the augmenting paths are the payoff.`,
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Bipartite matching pairs items from a left set with items from a right set, one partner each. Workers to shifts, students to dorm rooms, reviewers to papers, kidneys to patients, tests to machines. An edge means the pair is allowed. The question: how many compatible pairs can be chosen without sharing endpoints?`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Simple_bipartite_graph%3B_two_layers.svg/500px-Simple_bipartite_graph%3B_two_layers.svg.png`, alt: `Bipartite graph drawn as two layers with edges only between layers`, caption: `A bipartite graph makes the two-part assignment constraint visible: every allowed pair crosses from left to right. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Simple_bipartite_graph;_two_layers.svg`},
        `That count is often the feasibility layer before any optimizer runs. If only 93 of 100 shifts can be covered under the eligibility graph, no cost function can cover all 100 without relaxing constraints. Maximum matching answers a binary capacity question that weighting cannot bypass.`,
        `The problem was formalized by Denes Konig in 1931, who proved that in bipartite graphs the size of the maximum matching equals the size of the minimum vertex cover. Harold Kuhn published the Hungarian algorithm for weighted assignment in 1955. Hopcroft and Karp gave an O(E*sqrt(V)) algorithm for unweighted maximum matching in 1973 by batching shortest augmenting paths instead of finding them one at a time.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The brute-force method enumerates all possible matchings. With n vertices on each side, there are up to n! permutations to check. For 10 workers and 10 jobs, that is 3,628,800 candidates. For 20, it is over 2 * 10^18. Enumeration is correct but useless at any real scale.`,
        `A better first attempt uses augmenting paths one at a time. Start with an empty matching. Search for any augmenting path -- an alternating path from a free left vertex to a free right vertex, switching between unmatched and matched edges. Flip that path to increase the matching by one. Repeat until no augmenting path exists. This is correct by Berge's lemma, and each search costs O(E), so the total is O(V*E).`,
        `For sparse graphs with small matchings, one-path-at-a-time works fine. It is the right starting point and should not be dismissed. The question is what happens when both V and the matching size are large.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is repeated scanning. Each augmenting-path search traverses the graph from scratch. If the maximum matching has size k, the algorithm runs k full searches. On a graph with 10,000 vertices per side and 50,000 edges, that can mean 10,000 BFS passes over 50,000 edges each -- 500 million edge scans total.`,
        `The deeper problem is that one-path-at-a-time ignores structure. When many short augmenting paths exist simultaneously, taking just one forces a new full search to rediscover the rest. Augmenting paths interact: flipping one can destroy or create others. But when multiple shortest paths are vertex-disjoint, they can all be flipped safely in one batch.`,
        `Hopcroft and Karp observed that batching shortest augmenting paths per phase bounds the total number of phases to O(sqrt(V)), cutting the total work to O(E*sqrt(V)). The insight is scheduling discipline, not a new correctness argument.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Phase discipline. Each phase asks two questions: what is the shortest augmenting-path length right now, and how many vertex-disjoint paths of that length can be flipped before allowing longer paths?`,
        `BFS from all free left vertices simultaneously builds a layered graph of shortest alternating paths. From a left vertex, follow unmatched edges to the right. From a matched right vertex, follow the matched edge back to the left. The first time BFS reaches a free right vertex, the shortest augmenting distance is fixed. No longer paths enter this phase.`,
        `DFS then searches inside that layered graph for a maximal set of vertex-disjoint shortest augmenting paths. After flipping, every shortest path of that length is gone. The next phase must find longer paths, and there can be at most O(sqrt(V)) phases before the matching is maximum. The algorithm is faster not because it finds better paths, but because it refuses to waste a phase on a single path when a batch is available.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `State: adjacency lists from left to right vertices, arrays pairU and pairV storing matched partners (NIL if free), and a distance array dist for left vertices. NIL is a sentinel representing any free right endpoint.`,
        `BFS phase: enqueue every free left vertex at distance 0. For each dequeued left vertex u, scan its neighbors v. If v is free (pairV[v] = NIL), record that NIL is reachable at distance dist[u]+1 but do not explore further -- the shortest augmenting length is fixed. If v is matched to some u2 = pairV[v] and dist[u2] is not yet set, assign dist[u2] = dist[u]+1 and enqueue u2. BFS ends when the queue is empty. If NIL was never reached, no augmenting path exists and the algorithm terminates.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg`, alt: `Directed graph with nodes connected by arrows`, caption: `The alternating search can be read as a directed reachability problem: unmatched edges move left-to-right, matched edges move back. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg`},
        `DFS phase: for each free left vertex u, attempt to reach NIL through the layered graph. At vertex u, try each neighbor v. Accept v if v is free, or if pairV[v] has dist equal to dist[u]+1 and the recursive DFS from pairV[v] succeeds. On success, set pairU[u] = v and pairV[v] = u along the way -- this flips the path. On failure, set dist[u] = infinity so no other DFS re-enters this dead end during the same phase.`,
        `Repeat BFS and DFS phases until BFS finds no path to NIL. The union of all flipped paths across all phases is the maximum matching.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Correctness rests on Berge's lemma: a matching M is maximum if and only if no augmenting path exists with respect to M. Hopcroft-Karp searches for augmenting paths and stops only when none remain, so the final matching is maximum by the same argument that validates the one-path-at-a-time method.`,
        `Flipping an augmenting path preserves the matching property. Internal vertices on the path have exactly one matched edge before and after the flip. The two endpoints are free before and matched after. The path has one more unmatched edge than matched, so the matching size increases by exactly one per path. Vertex-disjoint paths can be flipped simultaneously because they share no endpoints.`,
        `The speed argument: after flipping a maximal set of shortest augmenting paths of length L, no augmenting path of length L or shorter remains. The shortest augmenting length strictly increases between phases. Once the shortest length exceeds sqrt(V), each remaining augmenting path uses more than sqrt(V) vertices, so at most sqrt(V) vertex-disjoint paths can remain. That means at most sqrt(V) more phases. Total phases: at most 2*sqrt(V). Each phase costs O(E). Total: O(E*sqrt(V)).`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time: O(E*sqrt(V)) total. Each BFS phase scans every edge once. Each DFS phase scans edges inside the layered graph, and marking dead ends prevents rescanning. The number of phases is at most O(sqrt(V)), proven by the path-length monotonicity argument.`,
        `Space: O(V + E). Adjacency lists dominate. The pairU, pairV, and dist arrays are each O(V). BFS uses a queue of at most V entries. DFS uses a stack bounded by V.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Biclique_K_3_5_bicolor.svg/500px-Biclique_K_3_5_bicolor.svg.png`, alt: `Complete bipartite graph K three five with two colored vertex sets`, caption: `Dense bipartite graphs make the E term visible: one phase may inspect many left-right eligibility edges. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Biclique_K_3_5_bicolor.svg`},
        `Doubling V with constant average degree roughly doubles E. The sqrt(V) factor grows slowly: 100 vertices need at most ~10 phases, 10,000 need ~100, 1,000,000 need ~1,000. In practice, most graphs need far fewer phases because the matching saturates early.`,
        `Compared to the simple augmenting-path method at O(V*E): on a graph with 10,000 vertices per side and 50,000 edges, Hopcroft-Karp does roughly 100 * 50,000 = 5 million edge scans versus 10,000 * 50,000 = 500 million. That is a 100x difference from scheduling discipline alone.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Job assignment under binary eligibility. Each worker can do certain jobs; each job needs one worker. Maximum matching finds the largest feasible assignment before any cost optimization. The unmatched set identifies which skills or positions are the binding constraint.`,
        `The National Resident Matching Program (NRMP) matches medical residents to hospitals. While the full system uses stable matching (Gale-Shapley with extensions), the feasibility check -- can every resident be placed somewhere? -- is a maximum matching question. Stable matching refines the answer; maximum matching establishes whether it exists.`,
        `Compiler register allocation models variables as one side and registers as the other. Eligibility edges encode which variables can live in which registers during overlapping lifetimes. Maximum matching determines how many variables can be register-allocated before spilling to memory.`,
        `Image stitching in panorama construction matches feature points between overlapping images. Each feature in one image can match at most one feature in the adjacent image. Maximum bipartite matching selects the largest consistent set of correspondences, which then feeds into a homography estimator.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Non-bipartite graphs. If the graph has odd cycles -- roommate problems, general friendship networks, non-planar circuit routing -- Hopcroft-Karp cannot be applied. Edmonds' blossom algorithm handles general graphs by contracting odd cycles into single vertices, but it is substantially more complex.`,
        `Weighted assignment. Maximum cardinality says nothing about cost. Assigning 100 workers to 100 jobs with maximum matching may pick the worst-cost perfect matching. The Hungarian algorithm solves the weighted case in O(V^3), and min-cost flow generalizes further. Use Hopcroft-Karp only when every valid assignment is equally good, or as a feasibility check before optimization.`,
        `Online and dynamic settings. If workers and jobs arrive over time, rerunning Hopcroft-Karp from scratch after each arrival wastes work and causes assignment churn. Online bipartite matching algorithms (Karp-Vazirani-Vazirani 1990) and incremental matching maintain solutions under updates, trading optimality for stability and speed.`,
        `Hidden capacity constraints. If a worker can take two shifts, or a job needs three workers, the unit-capacity bipartite model is wrong. Multi-capacity assignment requires b-matching or network flow. Forcing a multi-capacity problem into unit matching silently drops valid assignments.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Four workers (u1-u4), four jobs (v1-v4). Edges: u1-v1, u1-v3, u2-v1, u2-v2, u3-v2, u3-v4, u4-v2, u4-v4. Initial matching: u2-v1, u4-v2. Free left: u1, u3. Free right: v3, v4.`,
        `Phase 1 BFS: enqueue u1 (dist 0) and u3 (dist 0). u1 scans v1 (matched to u2, but we check v3 first) and v3 (free -- NIL reachable at distance 1). u3 scans v2 (matched to u4, but check v4 first) and v4 (free -- NIL reachable at distance 1). Shortest augmenting length is 1 (direct free-to-free edges).`,
        `Phase 1 DFS: from u1, try v3 -- v3 is free, augment. Set pairU[u1]=v3, pairV[v3]=u1. From u3, try v4 -- v4 is free, augment. Set pairU[u3]=v4, pairV[v4]=u3. Two vertex-disjoint paths flipped in one phase. Matching is now {u1-v3, u2-v1, u3-v4, u4-v2} -- size 4, a perfect matching.`,
        `Phase 2 BFS: no free left vertices remain. BFS finds no path to NIL. Algorithm terminates. Maximum matching size: 4. A one-path-at-a-time algorithm would have found u1-v3 in pass 1, then u3-v4 in pass 2 -- two separate graph scans instead of one batched phase.`,
        `If the graph were larger and the two short paths were not available, BFS would build longer alternating layers -- say u1 to v1 (unmatched), v1 to u2 (matched back), u2 to v2 (unmatched), v2 to u4 (matched back), u4 to v4 (unmatched to free) -- a length-5 augmenting path. Hopcroft-Karp would take all length-5 paths in that phase before allowing length-7 paths in the next.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary source: Hopcroft and Karp, "An n^(5/2) Algorithm for Maximum Matchings in Bipartite Graphs" (SIAM Journal on Computing, 1973). Konig's theorem (1931) established the max-matching = min-vertex-cover duality for bipartite graphs. Berge's lemma (1957) gave the augmenting-path characterization that underpins all augmenting-path algorithms.`,
        `Prerequisite: study Graph BFS for the layered construction and DFS Traversal for the restricted search within layers. Extension: study the Hungarian algorithm (Kuhn 1955) for weighted bipartite assignment, and Dinic's algorithm for maximum flow -- Dinic uses the same phase-discipline idea (level graphs + blocking flows) in a capacity-flow setting. Contrast: study Edmonds' blossom algorithm (1965) for maximum matching in general (non-bipartite) graphs, and Gale-Shapley stable matching for preference-based assignment.`,
      ],
    },
  ],
};
