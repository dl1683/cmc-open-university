// NSGA-II: fast non-dominated sorting plus crowding distance for
// multi-objective evolutionary optimization.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'nsga-ii-pareto-front-sorting-case-study',
  title: 'NSGA-II Pareto Front Sorting Case Study',
  category: 'Concepts',
  summary: 'A multi-objective optimization case study: non-dominated fronts, crowding distance, elitist parent-child merge, Pareto archives, and tradeoff-preserving selection.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pareto fronts', 'crowding selection'], defaultValue: 'pareto fronts' },
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

function nsgaGraph(title) {
  return graphState({
    nodes: [
      { id: 'parents', label: 'P_t', x: 0.8, y: 2.2, note: 'parents' },
      { id: 'offspring', label: 'Q_t', x: 0.8, y: 4.8, note: 'children' },
      { id: 'merge', label: 'R_t', x: 2.5, y: 3.5, note: 'merge' },
      { id: 'sort', label: 'sort', x: 4.2, y: 2.2, note: 'fronts' },
      { id: 'crowd', label: 'crowd', x: 4.2, y: 4.8, note: 'spread' },
      { id: 'fill', label: 'fill', x: 6.2, y: 3.5, note: 'N slots' },
      { id: 'next', label: 'P_t+1', x: 8.2, y: 3.5, note: 'next gen' },
    ],
    edges: [
      { id: 'e-parents-merge', from: 'parents', to: 'merge' },
      { id: 'e-offspring-merge', from: 'offspring', to: 'merge' },
      { id: 'e-merge-sort', from: 'merge', to: 'sort' },
      { id: 'e-merge-crowd', from: 'merge', to: 'crowd' },
      { id: 'e-sort-fill', from: 'sort', to: 'fill' },
      { id: 'e-crowd-fill', from: 'crowd', to: 'fill' },
      { id: 'e-fill-next', from: 'fill', to: 'next' },
    ],
  }, { title });
}

function paretoPlot(title) {
  return plotState({
    axes: { x: { label: 'cost', min: 0, max: 10 }, y: { label: 'error', min: 0, max: 10 } },
    series: [
      { id: 'f1', label: 'F1', points: [{ x: 1.5, y: 8.5 }, { x: 2.7, y: 6.2 }, { x: 4.2, y: 4.8 }, { x: 6.4, y: 3.1 }, { x: 8.2, y: 2.2 }] },
      { id: 'f2', label: 'F2', points: [{ x: 3.5, y: 8.2 }, { x: 5.5, y: 6.1 }, { x: 7.2, y: 4.7 }, { x: 8.8, y: 3.6 }] },
    ],
    markers: [
      { id: 'knee', x: 4.2, y: 4.8, label: 'knee' },
      { id: 'bad', x: 6.0, y: 7.0, label: 'dom' },
    ],
  }, { title });
}

function* paretoFronts() {
  yield {
    state: paretoPlot('Non-dominated points form the first front'),
    highlight: { active: ['f1', 'knee'], compare: ['f2', 'bad'] },
    explanation: 'With two objectives to minimize, a point is dominated if another point is no worse on every objective and better on at least one. The non-dominated set becomes the first Pareto front.',
    invariant: 'A front is a partial order layer, not a single best scalar score.',
  };

  yield {
    state: labelMatrix(
      'Dominance bookkeeping',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
        { id: 'e', label: 'E' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'err', label: 'err' },
        { id: 'front', label: 'front' },
      ],
      [
        ['1.5', '8.5', 'F1'],
        ['2.7', '6.2', 'F1'],
        ['4.2', '4.8', 'F1'],
        ['6.0', '7.0', 'F2'],
        ['8.2', '2.2', 'F1'],
      ],
    ),
    highlight: { active: ['a:front', 'b:front', 'c:front', 'e:front'], compare: ['d:front'] },
    explanation: 'The data structure stores domination counts, dominated sets, and front labels. Once the first front is removed, the next non-dominated layer becomes the second front.',
  };

  yield {
    state: nsgaGraph('NSGA-II merges parents and offspring'),
    highlight: { active: ['parents', 'offspring', 'merge', 'sort', 'e-parents-merge', 'e-offspring-merge', 'e-merge-sort'], found: ['next'] },
    explanation: 'NSGA-II is elitist: it combines the current parent population and offspring, sorts the combined pool into fronts, and fills the next generation from the best fronts first.',
  };

  yield {
    state: paretoPlot('The output is a tradeoff set'),
    highlight: { active: ['f1'], found: ['knee'], compare: ['f2'] },
    explanation: 'The final answer is a frontier of alternatives: cheaper but less accurate, more accurate but expensive, and knee points that often carry the best practical compromise.',
  };
}

function* crowdingSelection() {
  yield {
    state: nsgaGraph('Crowding distance preserves spread within a front'),
    highlight: { active: ['sort', 'crowd', 'fill', 'e-sort-fill', 'e-crowd-fill'], compare: ['merge'] },
    explanation: 'When the next front cannot fit entirely, NSGA-II uses crowding distance. Boundary points and sparse regions are preferred so the population does not collapse into one narrow part of the tradeoff curve.',
  };

  yield {
    state: labelMatrix(
      'Crowding distance table',
      [
        { id: 'p1', label: 'p1' },
        { id: 'p2', label: 'p2' },
        { id: 'p3', label: 'p3' },
        { id: 'p4', label: 'p4' },
        { id: 'p5', label: 'p5' },
      ],
      [
        { id: 'rank', label: 'rank' },
        { id: 'crowd', label: 'crowd' },
        { id: 'keep', label: 'keep' },
      ],
      [
        ['F1', 'inf', 'yes'],
        ['F1', '0.8', 'yes'],
        ['F1', '0.2', 'maybe'],
        ['F1', '0.7', 'yes'],
        ['F1', 'inf', 'yes'],
      ],
    ),
    highlight: { active: ['p1:crowd', 'p5:crowd', 'p2:keep', 'p4:keep'], compare: ['p3:keep'] },
    explanation: 'Crowding distance is a diversity score inside a front. Extremes get protected, and isolated points are preferred over points packed in a crowded neighborhood.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'generation', min: 0, max: 20 }, y: { label: 'front spread', min: 0, max: 1 } },
      series: [
        { id: 'rank', label: 'rank', points: [{ x: 0, y: 0.8 }, { x: 5, y: 0.55 }, { x: 10, y: 0.38 }, { x: 15, y: 0.28 }, { x: 20, y: 0.22 }] },
        { id: 'crowd', label: 'crowd', points: [{ x: 0, y: 0.8 }, { x: 5, y: 0.74 }, { x: 10, y: 0.68 }, { x: 15, y: 0.64 }, { x: 20, y: 0.62 }] },
      ],
      markers: [
        { id: 'keep', x: 15, y: 0.64, label: 'spread' },
      ],
    }),
    highlight: { active: ['crowd', 'keep'], compare: ['rank'] },
    explanation: 'Rank alone can converge to a small part of the Pareto curve. Crowding distance keeps the search useful for decision makers who need alternatives.',
  };

  yield {
    state: labelMatrix(
      'Production interpretation',
      [
        { id: 'lat', label: 'lat' },
        { id: 'cost', label: 'cost' },
        { id: 'acc', label: 'acc' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'objective', label: 'obj' },
        { id: 'decision', label: 'pick' },
      ],
      [
        ['min', 'live'],
        ['min', 'cost'],
        ['max', 'gate'],
        ['min', 'policy'],
      ],
    ),
    highlight: { active: ['lat:objective', 'cost:objective', 'acc:objective', 'risk:objective'] },
    explanation: 'Multi-objective optimization is practical when no single metric owns the product. A model route, ANN index, or controller policy can be selected from a frontier rather than a fake weighted sum.',
    invariant: 'Keep the tradeoff visible until a real policy chooses one point.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pareto fronts') yield* paretoFronts();
  else if (view === 'crowding selection') yield* crowdingSelection();
  else throw new InputError('Pick an NSGA-II view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `NSGA-II exists because many real optimization problems do not have one honest score. A model-routing policy may trade latency, cost, accuracy, and safety risk. A robot controller may trade speed, energy, stability, and clearance. A search index may trade recall, memory, build time, and query latency. Calling one candidate best before the policy is known hides the actual decision.`,
        `The point of multi-objective optimization is to keep that decision visible. Instead of collapsing everything into one weighted score too early, NSGA-II evolves a population of candidates and ranks them by Pareto dominance. The result is a frontier of tradeoffs: cheaper but worse, slower but safer, more accurate but more expensive, and knee points where one metric improves sharply before another becomes costly.`,
        {type:'callout', text:`NSGA-II preserves the tradeoff surface by ranking dominance layers first and using crowding distance only when capacity forces a choice.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b7/Front_pareto.svg', alt:'Pareto front diagram showing dominated points and frontier points.', caption:'Pareto front diagram by Nojhan, Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to choose weights, compute one scalar score, and run an ordinary optimizer. That is fine when the weights are real policy. If the business has already said one millisecond is worth exactly this many dollars and this much error, then the scalar score is not a trick; it is the objective.`,
        `The wall appears when the weights are guessed. A small change in weights can select a different design, and the weighted sum can hide useful alternatives. A candidate that is slightly slower but far cheaper may disappear. A candidate that is a little less accurate but much safer may be thrown away before a human can inspect it.`,
        `Another shortcut is to keep only the best candidate under each individual metric. That misses compromise points. The cheapest point may be unusable, and the most accurate point may be unaffordable. The practical answer often lies between extremes.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core relation is dominance. For minimization, candidate A dominates candidate B if A is no worse than B on every objective and better on at least one objective. If no other candidate dominates A, then A is non-dominated. The non-dominated candidates form the first Pareto front.`,
        `Fronts are partial-order layers, not score bands. After the first front is removed, some candidates that were previously dominated become non-dominated among the remaining points; those form the second front. Repeating that process gives a rank for selection while preserving the fact that points within the same front are tradeoffs rather than ordered winners.`,
        `NSGA-II adds elitism and diversity. It merges the current parents with their offspring, sorts the combined pool into fronts, fills the next generation from the best fronts first, and uses crowding distance when the last accepted front has more candidates than remaining slots.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Fast non-dominated sorting stores two pieces of bookkeeping for each candidate. The domination count says how many candidates dominate this one. The dominated set lists candidates this one dominates. All candidates with count zero enter the first front. When a front is accepted and conceptually removed, the algorithm decrements the counts of candidates it dominated. Any count that falls to zero enters the next front.`,
        `The evolutionary loop then uses these ranks to choose survivors. NSGA-II creates offspring by variation operators such as crossover and mutation, evaluates the objectives, merges parents and offspring into a combined pool, sorts that pool, and fills the next parent population. Merging parents with offspring is what makes the method elitist: a good parent is not discarded merely because a child was created.`,
        `Crowding distance is the diversity mechanism inside one front. For each objective, sort the front by that objective, protect boundary points, and add normalized gaps between neighboring objective values. A point in a sparse region receives a larger distance. When rank ties, NSGA-II prefers larger crowding distance so the population covers the frontier rather than collapsing into one cluster.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `In the Pareto-front view, lower-left is better because cost and error are minimized. The first front is not a line of equal scores. It is the set of points that no other point beats outright. The dominated marker shows the negative case: if another point is no worse on both axes and better on one, the candidate belongs to a later front.`,
        `In the crowding view, rank alone loses information. If all survivors come from one dense part of the first front, the next generation will search only that region. Crowding distance protects boundary and sparse points, so the algorithm keeps alternatives for the final decision maker.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The ranking works because dominance is a safe rejection rule. If A dominates B, then B cannot be the best choice for any policy that prefers all objectives to improve in the same direction. B may survive in a later generation only if population size allows it or if future variation makes it useful, but it should not outrank A.`,
        `Crowding works because selection pressure alone tends to reduce diversity. Evolutionary search repeatedly copies successful patterns. Without diversity pressure, many candidates become similar, and the search stops covering parts of the tradeoff surface. Crowding distance gives sparse regions a survival advantage without inventing a fake scalar score for the objectives themselves.`,
        `Elitism works because the combined parent-child pool prevents regression. A good existing candidate competes directly with new candidates. The next generation can improve only when offspring actually earn their place by rank and crowding, not merely because the algorithm replaced the whole population.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The classic NSGA-II sorting cost is often described as O(MN^2), where M is the number of objectives and N is population size. Doubling population size can roughly quadruple the pairwise dominance work before objective-evaluation cost is considered. Crowding distance adds sorting inside fronts for each objective.`,
        `In many practical problems, objective evaluation dominates sorting. If each candidate requires a simulation, hardware benchmark, model training run, or traffic replay, then a larger population is expensive even if the sorting code is fast. The algorithm stores objective vectors, ranks, dominated sets or counts, crowding distances, and population histories if the experiment needs auditability.`,
        `More objectives also change behavior. With many objectives, dominance becomes less selective because fewer points dominate one another. The first front can become huge, and crowding distance may no longer preserve useful structure. At that point, constraints, reference directions, preference articulation, or a different many-objective method may be needed.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `NSGA-II wins when the output should be a menu of serious options. Engineering design, scheduling, robotics, controller tuning, recommender ranking, architecture search, hyperparameter tuning, compiler optimization, and approximate-nearest-neighbor tuning all often need a frontier rather than one champion.`,
        `It is especially useful when the final choice is downstream policy. A platform team may want cheap, balanced, and high-quality model routes. A product team may want low-risk and high-growth variants. A systems team may want several latency-cost-recall points before committing to an index configuration. The algorithm does the search; the organization still owns the tradeoff.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `NSGA-II is overkill when the problem has one real objective plus hard constraints. If safety must never be violated, it should be a constraint or rejection gate, not just another objective that can be traded away. If cost is only a budget ceiling, enforce the budget and optimize the real objective inside it.`,
        `It also fails when evaluations are noisy and the frontier is treated as truth. Measurement noise can make dominated candidates look non-dominated. Benchmark variance can create fake knee points. Constraints can be hidden behind attractive objective values. A serious run needs repeated evaluation, constraint handling, feasibility labels, and a final audit of the selected points.`,
        `Do not report only one champion if the problem was multi-objective. That throws away the point of the method. Report the frontier, the constraints, the evaluation uncertainty, and the policy used to pick a final candidate.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read the original NSGA-II paper at https://sci2s.ugr.es/sites/default/files/files/Teaching/OtherPostGraduateCourses/Metaheuristicas/Deb_NSGAII.pdf and a library implementation guide such as pagmo at https://esa.github.io/pagmo2/docs/cpp/algorithms/nsga2.html. Then study evolutionary search, tournament selection, constraint handling, quality diversity and MAP-Elites, hyperparameter search, Bayesian optimization, multi-armed bandits, and Pareto analysis for latency-recall-cost systems.`,
      ],
    },
  ],
};
