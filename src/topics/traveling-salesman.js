// Traveling Salesman Problem: visit every city exactly once and return home
// at minimum total cost. The most famous NP-hard optimization problem â€”
// easy to state, brutal to solve, and the engine behind modern logistics.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'traveling-salesman',
  title: 'Traveling Salesman Problem (TSP)',
  category: 'Algorithms',
  summary: 'Find the shortest tour visiting every city exactly once and returning home â€” NP-hard, so heuristics and DP race against factorial blowup.',
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
    explanation: `Five cities, ${EDGES.length} possible edges â€” a complete graph. The goal: find a tour that visits every city exactly once and returns to the start, at minimum total distance. With 5 cities there are (5-1)!/2 = 12 distinct tours. With 20 cities, that number exceeds 10^16. Brute force dies fast; heuristics are essential.`,
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
    explanation: `Nearest-neighbor heuristic: start at city ${current}. At each step, travel to the closest unvisited city. This greedy strategy runs in O(n^2) â€” fast, but it makes locally optimal choices that can miss the global optimum.`,
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
    explanation: `Return to ${tour[0]}: distance ${fmt(returnDist)}. Nearest-neighbor tour: ${nnTour.join(' â†’ ')} â†’ ${nnTour[0]}. Total cost: ${fmt(nnCost)}. This took O(nÂ²) time â€” one scan of remaining cities per step. The tour is complete but often 20â€“25% longer than optimal. Crossing edges are the visual signature of suboptimality.`,
  };

  if (!use2opt) {
    yield {
      state: snapshot(),
      highlight: { found: [...nnTour, ...nnEdges] },
      explanation: `Final nearest-neighbor tour: ${nnTour.join(' â†’ ')} â†’ ${nnTour[0]}, cost ${fmt(nnCost)}. Switch to "nearest neighbor + 2-opt" to watch local search improve this tour by uncrossing edges.`,
    };
    return;
  }

  // --- 2-opt improvement ---
  yield {
    state: snapshot(),
    highlight: { found: [...nnTour, ...nnEdges] },
    explanation: `Now 2-opt local search improves the tour. The idea: pick two non-adjacent edges, remove them, and reconnect the tour the only other way possible â€” by reversing the segment between the removed edges. If the new tour is shorter, keep it. Repeat until no improving swap exists.`,
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
            explanation: `2-opt examines edges ${a}â€“${b} (${fmt(dist(cityMap.get(a), cityMap.get(b)))}) and ${c}â€“${d} (${fmt(dist(cityMap.get(c), cityMap.get(d)))}). Combined: ${fmt(oldDist)}. Reconnecting as ${a}â€“${c} and ${b}â€“${d} costs ${fmt(newDist)} â€” saves ${fmt(oldDist - newDist)}. Reverse the segment between them.`,
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
            explanation: `After 2-opt swap: ${currentTour.join(' â†’ ')} â†’ ${currentTour[0]}. New cost: ${fmt(newCost)} (was ${fmt(nnCost)}). The reversal uncrosses the path â€” a shorter tour with the same cities.`,
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
    explanation: `2-opt converged: no further improving swaps exist. Final tour: ${currentTour.join(' â†’ ')} â†’ ${currentTour[0]}, cost ${fmt(finalCost)}. Nearest neighbor alone gave ${fmt(nnCost)}; 2-opt saved ${fmt(nnCost - finalCost)}. Each 2-opt pass is O(nÂ²); convergence is fast in practice. For 5 cities this is likely optimal â€” but 2-opt only guarantees a LOCAL optimum: no single edge-pair swap can improve it. A global optimum may require rearranging three or more edges simultaneously (3-opt or Linâ€“Kernighan).`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a complete weighted graph, which means every city has an edge to every other city and each edge has a distance. A tour is a cycle that visits every city exactly once and returns to the start.',
        'Nearest neighbor highlights the closest unvisited city and commits that local edge. The 2-opt view highlights two existing tour edges and tests whether reconnecting them the other way shortens the cycle.',
        'The visual rule to watch is crossing removal in Euclidean space. If two straight tour edges cross, uncrossing them gives a shorter tour while visiting the same cities.',
        {type: 'callout', text: 'TSP is easy to state and hard to solve because the object is a cycle, not a path: one greedy edge can make the final return edge expensive.'},
        {type: 'image', src: './assets/gifs/traveling-salesman.gif', alt: 'Animated walkthrough of the traveling salesman visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The traveling salesman problem asks for the minimum-cost tour through n cities, returning to the start. It is a basic model for routing, sequencing, manufacturing motion, and any task where every location must be visited once.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Illustration_of_an_unsolved_travelling_salesman_problem.svg/250px-Illustration_of_an_unsolved_travelling_salesman_problem.svg.png', alt: 'Unsolved traveling salesman problem instance with many points.', caption: 'An unsolved TSP instance shows the search space before a tour is chosen: the cities are simple, but the number of possible cycles explodes. Source: Wikimedia Commons, M. W. Toews, CC BY 2.5.'},
        'The problem exists because local distances do not determine a global cycle. A cheap edge now can force an expensive return edge later, so route quality depends on the whole loop.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious exact approach is to enumerate every possible tour and keep the shortest. After fixing one start city and treating reversed tours as the same, there are (n - 1)! / 2 distinct tours.',
        'For 5 cities that is 12 tours, which is easy. For 20 cities it is about 6.1e16 tours, so even a billion tour checks per second takes years.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is factorial growth. Each added city multiplies the search space by roughly the new city count, so hardware improvements cannot keep up for exact brute force.',
        'TSP is NP-hard, which means no polynomial-time exact algorithm is known for all inputs. Exact methods use dynamic programming, branch-and-bound, branch-and-cut, and relaxations, but the worst case remains exponential.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'There are two useful ways to make progress. Exact dynamic programming stores best paths by subset and last city, replacing n! tours with n * 2^n states; heuristics search for good tours quickly without proving optimality.',
        'Nearest neighbor is a cheap greedy heuristic, and 2-opt is a local repair rule. 2-opt asks whether replacing two edges with the other reconnection shortens the cycle, then repeats until no pair helps.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Nearest neighbor starts at a city, scans all unvisited cities, and moves to the closest one. After all cities are visited, it returns to the start, producing a complete tour in O(n^2) time.',
        '2-opt starts from any tour. It removes non-adjacent edges (a,b) and (c,d), reconnects as (a,c) and (b,d), and keeps the change if the total distance drops.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The exact dynamic program works by optimal substructure. If an optimal path through subset S ends at v, the part before v must be an optimal path through S without v ending at some predecessor u.',
        '2-opt works as a local improvement method because each accepted swap strictly reduces tour length. There are finitely many tours, so repeated improving swaps must terminate at a tour where no single 2-edge swap improves the cost.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Brute force costs O(n!) time and O(n) space. Held-Karp dynamic programming costs O(n^2 * 2^n) time and O(n * 2^n) space, which is much better than factorial but still exponential.',
        'Nearest neighbor costs O(n^2), and each 2-opt pass costs O(n^2). Doubling cities roughly quadruples nearest-neighbor and one-pass 2-opt work, while exact methods grow beyond practical limits quickly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Vehicle routing, warehouse picking, PCB drilling, telescope scheduling, and manufacturing motion planning all contain TSP-shaped subproblems. Real systems add constraints such as capacity, time windows, traffic, precedence, and multiple vehicles.',
        'TSP also matters as a benchmark problem. It teaches the difference between exact optimization, approximation guarantees, local search, and production heuristics under hard combinatorial growth.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Nearest neighbor can be arbitrarily poor on adversarial inputs, and 2-opt can get stuck in a local optimum that is far from global optimal. A tour with no improving 2-edge swap is not necessarily the best tour.',
        'Metric assumptions matter. Christofides-style guarantees require triangle inequality, while one-way streets, turn costs, and time-varying traffic produce asymmetric or dynamic variants that need different machinery.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use five cities A(1,5), B(4,8), C(8,7), D(7,2), and E(3,1.5). Important rounded distances include A-E = 4.0, E-D = 4.0, D-C = 5.1, C-B = 4.1, and B-A = 4.2.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/GLPK_solution_of_a_travelling_salesman_problem.svg/250px-GLPK_solution_of_a_travelling_salesman_problem.svg.png', alt: 'A solved traveling salesman tour connecting many points.', caption: 'The solved tour makes the constraint visible: every city has degree two in the final cycle, so local choices must still close globally. Source: Wikimedia Commons, M. W. Toews, CC BY 2.5.'},
        'Nearest neighbor from A chooses E, then D, then C, then B, then returns to A. The displayed rounded edge labels sum to 21.4, while the exact coordinate distances sum to 21.527 and round to 21.5 in the animation total. Checking all 12 tours on this small instance shows the reverse cycle A-B-C-D-E-A has the same cost, so the greedy tour is optimal here, but that luck does not scale.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include Held and Karp on dynamic programming for sequencing problems, Karp on NP-completeness, Christofides on the 3/2 approximation for metric TSP, and Applegate, Bixby, Chvatal, and Cook on the Concorde solver.',
        'Study dynamic programming, minimum spanning trees, approximation algorithms, local search, simulated annealing, genetic algorithms, and vehicle routing next.',
      ],
    },
  ],
};

