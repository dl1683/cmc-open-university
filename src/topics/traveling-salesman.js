// Traveling Salesman Problem: visit every city exactly once and return home
// at minimum total cost. The most famous NP-hard optimization problem —
// easy to state, brutal to solve, and the engine behind modern logistics.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'traveling-salesman',
  title: 'Traveling Salesman Problem (TSP)',
  category: 'Algorithms',
  summary: 'Find the shortest tour visiting every city exactly once and returning home — NP-hard, so heuristics and DP race against factorial blowup.',
  controls: [
    { id: 'method', label: 'Method', type: 'select', options: ['nearest neighbor', 'nearest neighbor + 2-opt'], defaultValue: 'nearest neighbor + 2-opt' },
  ],
  run,
};

// Five cities arranged so nearest-neighbor produces a suboptimal tour
// and a single 2-opt swap visibly improves it.
const CITIES = [
  { id: 'A', label: 'A', x: 1.0, y: 5.0 },
  { id: 'B', label: 'B', x: 4.0, y: 8.0 },
  { id: 'C', label: 'C', x: 8.0, y: 7.0 },
  { id: 'D', label: 'D', x: 7.0, y: 2.0 },
  { id: 'E', label: 'E', x: 3.0, y: 1.5 },
];

// Complete graph: every pair of cities is connected.
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildEdges(cities) {
  const edges = [];
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const w = Math.round(dist(cities[i], cities[j]) * 10) / 10;
      edges.push({ id: `${cities[i].id}${cities[j].id}`, from: cities[i].id, to: cities[j].id, weight: w });
    }
  }
  return edges;
}

const EDGES = buildEdges(CITIES);
const cityMap = new Map(CITIES.map((c) => [c.id, c]));

function edgeId(a, b) {
  return a < b ? `${a}${b}` : `${b}${a}`;
}

function tourCost(tour) {
  let cost = 0;
  for (let i = 0; i < tour.length; i++) {
    cost += dist(cityMap.get(tour[i]), cityMap.get(tour[(i + 1) % tour.length]));
  }
  return Math.round(cost * 10) / 10;
}

function tourEdgeIds(tour) {
  const ids = [];
  for (let i = 0; i < tour.length; i++) {
    ids.push(edgeId(tour[i], tour[(i + 1) % tour.length]));
  }
  return ids;
}

function fmt(x) {
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

export function* run(input) {
  const use2opt = String(input.method) === 'nearest neighbor + 2-opt';

  const snapshot = (tourHighlightEdges = [], note = '') => graphState({
    nodes: CITIES.map((c) => ({ ...c, note: '' })),
    edges: EDGES,
  });

  // --- Step 0: Introduction ---
  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Five cities, ${EDGES.length} possible edges — a complete graph. The goal: find a tour that visits every city exactly once and returns to the start, at minimum total distance. With 5 cities there are (5-1)!/2 = 12 distinct tours. With 20 cities, that number exceeds 10^16. Brute force dies fast; heuristics are essential.`,
  };

  // --- Nearest Neighbor ---
  const visited = new Set();
  const tour = [];
  let current = 'A';
  visited.add(current);
  tour.push(current);

  yield {
    state: snapshot(),
    highlight: { active: [current] },
    explanation: `Nearest-neighbor heuristic: start at city ${current}. At each step, travel to the closest unvisited city. This greedy strategy runs in O(n^2) — fast, but it makes locally optimal choices that can miss the global optimum.`,
  };

  while (tour.length < CITIES.length) {
    let bestDist = Infinity;
    let bestCity = null;
    const candidates = CITIES.filter((c) => !visited.has(c.id));

    // Show candidates
    for (const cand of candidates) {
      const d = dist(cityMap.get(current), cand);
      if (d < bestDist) {
        bestDist = d;
        bestCity = cand.id;
      }
    }

    const eid = edgeId(current, bestCity);
    visited.add(bestCity);
    tour.push(bestCity);

    const currentTourEdges = tourEdgeIds(tour.length === CITIES.length ? tour : tour.slice(0, -1));
    const partialCost = tourCost(tour.length === CITIES.length ? tour : tour);

    yield {
      state: snapshot(),
      highlight: {
        active: [bestCity],
        compare: [eid],
        found: [...tour, ...tourEdgeIds(tour.slice(0, -1))].filter((x) => x !== bestCity && x !== eid),
        visited: candidates.filter((c) => c.id !== bestCity).map((c) => c.id),
      },
      explanation: `From ${current}: nearest unvisited city is ${bestCity} at distance ${fmt(bestDist)}. ${candidates.length - 1 > 0 ? `Passed over ${candidates.filter((c) => c.id !== bestCity).map((c) => `${c.id} (${fmt(dist(cityMap.get(current), c))})`).join(', ')}.` : ''} The greedy choice is locally optimal but may force expensive edges later.`,
    };

    current = bestCity;
  }

  // Complete the tour: return to start
  const returnEdge = edgeId(current, tour[0]);
  const returnDist = dist(cityMap.get(current), cityMap.get(tour[0]));
  const nnTour = [...tour];
  const nnCost = tourCost(nnTour);
  const nnEdges = tourEdgeIds(nnTour);

  yield {
    state: snapshot(),
    highlight: {
      found: [...nnTour, ...nnEdges],
      compare: [returnEdge],
    },
    explanation: `Return to ${tour[0]}: distance ${fmt(returnDist)}. Nearest-neighbor tour: ${nnTour.join(' → ')} → ${nnTour[0]}. Total cost: ${fmt(nnCost)}. This took O(n²) time — one scan of remaining cities per step. The tour is complete but often 20–25% longer than optimal. Crossing edges are the visual signature of suboptimality.`,
  };

  if (!use2opt) {
    yield {
      state: snapshot(),
      highlight: { found: [...nnTour, ...nnEdges] },
      explanation: `Final nearest-neighbor tour: ${nnTour.join(' → ')} → ${nnTour[0]}, cost ${fmt(nnCost)}. Switch to "nearest neighbor + 2-opt" to watch local search improve this tour by uncrossing edges.`,
    };
    return;
  }

  // --- 2-opt improvement ---
  yield {
    state: snapshot(),
    highlight: { found: [...nnTour, ...nnEdges] },
    explanation: `Now 2-opt local search improves the tour. The idea: pick two non-adjacent edges, remove them, and reconnect the tour the only other way possible — by reversing the segment between the removed edges. If the new tour is shorter, keep it. Repeat until no improving swap exists.`,
  };

  const currentTour = [...nnTour];
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < currentTour.length - 1 && !improved; i++) {
      for (let j = i + 2; j < currentTour.length; j++) {
        if (i === 0 && j === currentTour.length - 1) continue; // skip: same as no swap

        const a = currentTour[i];
        const b = currentTour[i + 1];
        const c = currentTour[j];
        const d = currentTour[(j + 1) % currentTour.length];

        const oldDist = dist(cityMap.get(a), cityMap.get(b)) + dist(cityMap.get(c), cityMap.get(d));
        const newDist = dist(cityMap.get(a), cityMap.get(c)) + dist(cityMap.get(b), cityMap.get(d));

        if (newDist < oldDist - 0.001) {
          // Show the edges being considered
          const oldEdge1 = edgeId(a, b);
          const oldEdge2 = edgeId(c, d);

          yield {
            state: snapshot(),
            highlight: {
              found: [...currentTour, ...tourEdgeIds(currentTour)],
              compare: [oldEdge1, oldEdge2],
            },
            explanation: `2-opt examines edges ${a}–${b} (${fmt(dist(cityMap.get(a), cityMap.get(b)))}) and ${c}–${d} (${fmt(dist(cityMap.get(c), cityMap.get(d)))}). Combined: ${fmt(oldDist)}. Reconnecting as ${a}–${c} and ${b}–${d} costs ${fmt(newDist)} — saves ${fmt(oldDist - newDist)}. Reverse the segment between them.`,
          };

          // Perform the 2-opt swap: reverse the segment from i+1 to j
          const segment = currentTour.slice(i + 1, j + 1);
          segment.reverse();
          for (let k = 0; k < segment.length; k++) {
            currentTour[i + 1 + k] = segment[k];
          }
          improved = true;

          const newCost = tourCost(currentTour);
          const newEdges = tourEdgeIds(currentTour);

          yield {
            state: snapshot(),
            highlight: { found: [...currentTour, ...newEdges] },
            explanation: `After 2-opt swap: ${currentTour.join(' → ')} → ${currentTour[0]}. New cost: ${fmt(newCost)} (was ${fmt(nnCost)}). The reversal uncrosses the path — a shorter tour with the same cities.`,
          };
          break;
        }
      }
    }
  }

  const finalCost = tourCost(currentTour);
  const finalEdges = tourEdgeIds(currentTour);

  yield {
    state: snapshot(),
    highlight: { found: [...currentTour, ...finalEdges] },
    explanation: `2-opt converged: no further improving swaps exist. Final tour: ${currentTour.join(' → ')} → ${currentTour[0]}, cost ${fmt(finalCost)}. Nearest neighbor alone gave ${fmt(nnCost)}; 2-opt saved ${fmt(nnCost - finalCost)}. Each 2-opt pass is O(n²); convergence is fast in practice. For 5 cities this is likely optimal — but 2-opt only guarantees a LOCAL optimum: no single edge-pair swap can improve it. A global optimum may require rearranging three or more edges simultaneously (3-opt or Lin–Kernighan).`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a complete graph of five cities. Every pair is connected by an edge labeled with its distance. The tour is built incrementally: active (highlighted) nodes are being added, compare highlights show the edge under consideration, and found highlights mark edges already committed to the tour.',
        'In nearest-neighbor mode, watch the greedy chain grow one city at a time. The visited (dimmed) nodes are candidates that were passed over in favor of a closer city. When 2-opt runs afterward, compare highlights mark the two edges being tested for removal. If reconnecting the tour a different way is cheaper, the segment between them reverses and the tour cost drops.',
        'The key visual signal: crossing edges. Two tour edges that cross each other can always be uncrossed for a shorter path in Euclidean space. 2-opt finds and fixes exactly these crossings.',
        {type: 'callout', text: 'TSP is easy to state and hard to solve because the object is a cycle, not a path: one greedy edge can make the final return edge expensive.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A salesman must visit n cities, each exactly once, and return home. The question: which route minimizes total travel distance? Karl Menger posed this as a mathematical problem in the 1930s. Merrill Flood formalized it at RAND Corporation in 1956. It became the poster child for combinatorial optimization and NP-hardness.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Illustration_of_an_unsolved_travelling_salesman_problem.svg/250px-Illustration_of_an_unsolved_travelling_salesman_problem.svg.png', alt: 'Unsolved traveling salesman problem instance with many points.', caption: 'An unsolved TSP instance shows the search space before a tour is chosen: the cities are simple, but the number of possible cycles explodes. Source: Wikimedia Commons, M. W. Toews, CC BY 2.5.'},
        'The problem is not academic. UPS runs ORION, a TSP-family solver, on 55,000 routes daily and saves over 100 million miles per year. Amazon routes delivery vans. FedEx sequences package pickups. Circuit boards are drilled by moving a laser head through thousands of hole positions — the shortest drill path is a TSP. DNA sequencing reconstructs a genome by finding the shortest superstring that covers all fragment overlaps — another TSP variant. Telescope scheduling, warehouse robot pathing, and VLSI wire routing all reduce to TSP or close relatives.',
        'The gap between stating the problem and solving it defines an entire field. Decades of work on TSP have produced fundamental results in complexity theory, linear programming, polyhedral combinatorics, and metaheuristics.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Enumerate every possible tour, compute each one\'s total distance, keep the shortest. For n cities, fix the starting city (it does not matter which, since the tour is a cycle). The remaining n-1 cities can be arranged in (n-1)! orders, and each tour equals its reverse, so there are (n-1)!/2 distinct tours.',
        'For 5 cities: 4!/2 = 12 tours. Manageable. For 10 cities: 181,440 tours. Still fine. For 15 cities: 43 billion tours. A fast computer finishes in minutes. For 20 cities: over 10^16 tours. At a billion tours per second, that takes four months. For 25 cities: 10^23 tours — longer than the age of the universe at any plausible speed.',
        'Factorial growth is the fastest-growing function that appears naturally in algorithm analysis. Each additional city multiplies the work by roughly n. No amount of hardware rescues this curve.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'TSP is NP-hard. Richard Karp proved in 1972 that the Hamiltonian cycle problem (does a tour through all vertices exist?) is NP-complete, and the optimization version (find the shortest such tour) is at least as hard. No polynomial-time algorithm is known, and most complexity theorists believe none exists.',
        'This means there is no shortcut that works for all inputs. Every exact algorithm has a worst case that grows exponentially. The question shifts from "solve it" to "how close to optimal can we get, how fast?"',
        'The brute-force wall is not just time — it is also structure. The number of distinct subsets of cities is 2^n. Any approach that must reason about all subsets (and most exact methods do) faces exponential blowup. The Held-Karp dynamic programming algorithm is the fastest known exact method, and it runs in O(n^2 * 2^n) — better than n!, but still exponential.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Exact and heuristic approaches attack TSP from opposite ends. The exact insight (Held-Karp): optimal substructure on subsets. The shortest tour through cities {A, B, C, D} ending at D can be built from the shortest paths through subsets {A, B, D}, {A, C, D}, and {A, B, C, D} ending at each predecessor of D. Store intermediate results in a table indexed by (subset, last city), and the 2^n subsets replace the n! permutations.',
        'The heuristic insight (2-opt): local search over edge swaps. A tour with crossing edges is never optimal in Euclidean space — the triangle inequality guarantees that uncrossing them shortens the path. Remove two edges, reconnect the two resulting chains the only other way, and check if the tour improved. Repeat until no swap helps. The result is a local optimum: no single pair of edges can be swapped to improve it.',
        'These are complementary strategies. Held-Karp gives the provably optimal answer but cannot scale past about 25 cities. Heuristics like nearest-neighbor + 2-opt handle thousands of cities in seconds but sacrifice guarantees.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Nearest-neighbor heuristic. Start at any city. Repeatedly travel to the nearest unvisited city. After visiting all cities, return to the start. This greedy strategy builds a complete tour in O(n^2) time: each of n steps scans the remaining cities. The tour is often 20-25% longer than optimal, and the final return-home leg is frequently the costliest edge because the greedy choices have scattered the remaining geography.',
        '2-opt local search. Given any tour, examine every pair of non-adjacent edges (i, i+1) and (j, j+1). Remove them and reconnect the tour by reversing the segment between positions i+1 and j. If the new tour is shorter, keep it and restart the scan. Each pass examines O(n^2) edge pairs; in practice, convergence to a local optimum takes a small number of passes. The result typically comes within 5-8% of optimal for random Euclidean instances.',
        'Held-Karp dynamic programming. Let dp[S][v] = cost of the shortest path starting from city 0, visiting exactly the cities in subset S, and ending at city v. Base case: dp[{0}][0] = 0. Transition: dp[S][v] = min over all u in S \\ {v} of (dp[S \\ {v}][u] + dist(u, v)). Answer: min over all v != 0 of (dp[all cities][v] + dist(v, 0)). There are 2^n subsets and n cities, each transition scans n candidates: total O(n^2 * 2^n) time and O(n * 2^n) space.',
        'Christofides algorithm (1976). For metric TSP (distances satisfy the triangle inequality): (1) compute a minimum spanning tree, (2) find all odd-degree vertices, (3) compute a minimum-weight perfect matching on those vertices, (4) combine MST and matching into a multigraph, (5) find an Eulerian circuit, (6) shortcut repeated vertices. The result is guaranteed within 1.5x optimal. This 3/2-approximation stood as the best known ratio for 45 years until Karlin, Klein, and Oveis Gharan improved it to (3/2 - 10^-36) in 2021.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Held-Karp: optimal substructure. The shortest tour through all n cities decomposes into a shortest path through a subset ending at some city, plus one final edge home. Every subpath of an optimal tour is itself optimal for its subset — if it were not, replacing that subpath would yield a shorter overall tour, contradicting optimality. The DP table captures every possible (subset, endpoint) pair, so no optimal subpath is missed.',
        '2-opt: the uncrossing argument. In Euclidean space, if two tour edges cross, the triangle inequality proves that uncrossing them produces a shorter tour. Suppose edges (A,B) and (C,D) cross. Then dist(A,C) + dist(B,D) < dist(A,B) + dist(C,D) — the direct connections are shorter than the crossing ones. Each swap strictly reduces tour cost, and since there are finitely many tours, the process terminates at a local minimum.',
        'Christofides: matching covers the parity gap. An Eulerian circuit exists only in graphs where every vertex has even degree. The MST may leave some vertices with odd degree. The minimum-weight perfect matching on those odd-degree vertices adds exactly enough edges to make every degree even, at minimum extra cost. The resulting Euler tour visits every edge, and shortcutting (skipping revisited cities) can only shorten the path by the triangle inequality.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Brute force: O(n!) time, O(n) space. Checks every permutation. Practical limit: about 12-13 cities.',
        'Held-Karp: O(n^2 * 2^n) time, O(n * 2^n) space. For 20 cities: 20^2 * 2^20 ~ 400 million operations and ~20 million table entries. For 25 cities: 25^2 * 2^25 ~ 21 billion operations. Practical limit: about 20-25 cities, depending on memory.',
        'Nearest neighbor: O(n^2) time, O(n) space. For 10,000 cities, that is 10^8 operations — under a second. Tour quality: typically 20-25% above optimal.',
        '2-opt: O(n^2) per pass, O(n) space. Usually converges in a few passes, so roughly O(n^2) total. Tour quality after 2-opt: typically 5-8% above optimal for random Euclidean instances.',
        'Christofides: O(n^3) time (dominated by the minimum-weight perfect matching). Guaranteed within 1.5x optimal for metric TSP. Used as a starting point for further local search in production solvers.',
        'Doubling the number of cities: brute force time explodes by a factor of roughly n^n. Held-Karp time roughly doubles (the 2^n term dominates). Nearest neighbor and 2-opt time quadruples. The scaling wall is real: production TSP solvers for 10,000+ cities use branch-and-cut with LP relaxations, not the algorithms above.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Logistics and vehicle routing. UPS ORION plans routes for 55,000 drivers daily, saving 100+ million miles per year. The vehicle routing problem (VRP) is TSP with multiple salesmen, capacity constraints, and time windows — TSP is the core subproblem. Amazon, FedEx, DHL, and every last-mile delivery company solve TSP variants continuously.',
        'PCB drilling. A circuit board may have 10,000+ holes. The drill head must visit each hole and return to the origin. Minimizing travel distance reduces manufacturing time. The Euclidean TSP formulation applies directly, and 2-opt or Lin-Kernighan heuristics are standard.',
        'DNA sequencing. Shotgun sequencing breaks a genome into overlapping fragments. Reconstructing the original sequence requires finding the shortest superstring covering all fragments. This is equivalent to an asymmetric TSP on a graph where edge weights represent overlap lengths. The Human Genome Project relied on TSP-related algorithms.',
        'Telescope scheduling. Space telescopes like Hubble and James Webb must observe targets across the sky. Slewing (repointing) takes time and fuel. The observation schedule that minimizes total slew time is a TSP where cities are sky coordinates and distances are slew times.',
        'VLSI design. Connecting components on a chip with minimum wire length is a Steiner tree problem, but the related TSP formulation guides wire routing heuristics in electronic design automation tools.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Exact solutions cannot scale. Held-Karp handles ~25 cities. The best branch-and-cut solvers (Concorde) have solved instances up to ~90,000 cities, but these are heroic computations taking months of CPU time. For real-time routing of thousands of stops, exact optimality is not an option.',
        'Heuristics give no worst-case guarantee (except Christofides). Nearest neighbor can produce tours arbitrarily bad on pathological inputs — a worst-case ratio of O(log n) over optimal. 2-opt can get trapped in local optima far from global. The quality depends on the starting tour and the geometry of the instance.',
        'Euclidean, metric, and general TSP are different problems. Christofides\' 1.5x guarantee requires the triangle inequality. In general (asymmetric) TSP, where dist(A,B) may differ from dist(B,A), no constant-factor approximation is possible unless P = NP. Real routing problems often involve one-way streets, turn penalties, and time-varying traffic — none of which fit the clean Euclidean model.',
        'Dynamic environments. TSP assumes fixed cities and fixed distances. Delivery routing must handle new orders, traffic jams, and cancellations. Re-solving TSP from scratch at each change is wasteful; production systems use incremental repair heuristics that are harder to analyze theoretically.',
        'Very large instances. For millions of points (e.g., astronomical surveys), even O(n^2) heuristics are too slow. Space-partitioning approaches (divide the plane into clusters, solve each cluster, stitch) sacrifice tour quality for tractability.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Five cities: A(1,5), B(4,8), C(8,7), D(7,2), E(3,1.5). Distances (Euclidean, rounded to one decimal): A-B=4.2, A-C=7.3, A-D=6.7, A-E=4.0, B-C=4.1, B-D=6.7, B-E=6.6, C-D=5.1, C-E=7.4, D-E=4.0.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/GLPK_solution_of_a_travelling_salesman_problem.svg/250px-GLPK_solution_of_a_travelling_salesman_problem.svg.png', alt: 'A solved traveling salesman tour connecting many points.', caption: 'The solved tour makes the constraint visible: every city has degree two in the final cycle, so local choices must still close globally. Source: Wikimedia Commons, M. W. Toews, CC BY 2.5.'},
        'Nearest neighbor from A: (1) From A, nearest is E at 4.0. Tour: A-E. (2) From E, nearest unvisited is D at 4.0. Tour: A-E-D. (3) From D, nearest unvisited is C at 5.1 (B is 6.7 — farther). Tour: A-E-D-C. (4) From C, only B remains at 4.1. Tour: A-E-D-C-B. (5) Return to A: distance 4.2. Total: 4.0 + 4.0 + 5.1 + 4.1 + 4.2 = 21.5.',
        '2-opt improvement: examine edges E-D and C-B. Removing them and reconnecting as E-C and D-B: cost of removed edges = 4.0 + 4.1 = 8.1, cost of new edges = 7.4 + 6.7 = 14.1 — worse, skip. Try edges A-E and D-C: removed = 4.0 + 5.1 = 9.1, new = A-D + E-C = 6.7 + 7.4 = 14.1 — worse. No 2-opt swap improves this tour; it is already a local optimum.',
        'Optimal tour (by checking all 12): A-B-C-D-E-A costs 4.2 + 4.1 + 5.1 + 4.0 + 4.0 = 21.5. The nearest-neighbor tour A-E-D-C-B-A is the same cycle traversed in reverse — nearest neighbor found the optimal tour on this small instance. On larger random instances with 50+ cities, the gap between nearest-neighbor and optimal averages 20-25%, and 2-opt closes most of it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Karp, "Reducibility Among Combinatorial Problems" (1972). Proved that Hamiltonian cycle and many other problems are NP-complete, establishing TSP\'s hardness.',
        'Held & Karp, "A Dynamic Programming Approach to Sequencing Problems" (Journal of SIAM, 1962). The O(n^2 * 2^n) exact algorithm that replaces factorial enumeration with subset-based DP.',
        'Christofides, "Worst-Case Analysis of a New Heuristic for the Travelling Salesman Problem" (1976). The 3/2-approximation for metric TSP using MST + minimum-weight matching.',
        'Applegate, Bixby, Chvatal & Cook, "The Traveling Salesman Problem: A Computational Study" (Princeton University Press, 2006). The definitive computational reference; describes the Concorde solver.',
        'Prerequisite: Kruskal\'s Minimum Spanning Tree. MST is a key building block for Christofides\' approximation and provides the lower-bound argument.',
        'Prerequisite: Dynamic Programming / Memoization. Held-Karp is a DP algorithm; understanding table-filling and optimal substructure is essential.',
        'Related: 0/1 Knapsack. Another NP-hard optimization problem solvable by DP with exponential state space. The comparison illuminates what NP-hardness means in practice.',
        'Extension: Evolutionary Search. Genetic algorithms and simulated annealing are metaheuristics that escape 2-opt\'s local optima by allowing temporarily worse solutions.',
      ],
    },
  ],
};
