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
    { heading: 'How to read the animation', paragraphs: ['Read each point as one candidate design with multiple objective values. A Pareto front is the set of candidates that no other candidate beats on every objective at once.', 'The active comparison tests dominance. For minimization, candidate A dominates candidate B when A is no worse on every objective and strictly better on at least one.', {type:'callout', text:`NSGA-II preserves the tradeoff surface by ranking dominance layers first and using crowding distance only when capacity forces a choice.`}, {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b7/Front_pareto.svg', alt:'Pareto front diagram showing dominated points and frontier points.', caption:'Pareto front diagram by Nojhan, Wikimedia Commons, CC BY-SA 3.0.'}] },
    { heading: 'Why this exists', paragraphs: ['Many engineering decisions have more than one real objective. A model route may trade latency against cost, while a robot controller may trade energy against tracking error.', 'NSGA-II exists to search for a frontier of good tradeoffs. It avoids pretending that one guessed weighted score is the only policy the decision maker could want.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is to choose weights and compute one score. That is valid when the weights are real policy, such as one dollar of cost being worth exactly one fixed amount of latency.', 'The problem is guessed weights. A tiny weight change can hide candidates that are slightly slower but much cheaper or slightly less accurate but much safer.'] },
    { heading: 'The wall', paragraphs: ['The wall is partial order. Two candidates can be incomparable because one is cheaper and the other is more accurate.', 'A single champion hides that structure. The final decision maker often needs a menu of frontier points, not an optimizer that silently discarded every compromise.'] },
    { heading: 'The core insight', paragraphs: ['NSGA-II ranks candidates by dominance layers. The first front contains all non-dominated candidates, the second front appears after removing the first, and later fronts repeat the same rule.', 'When the next generation has limited capacity inside one front, crowding distance preserves spread. Sparse regions of the front get preference so the population does not collapse into one cluster.'] },
    { heading: 'How it works', paragraphs: ['Fast non-dominated sorting stores a domination count for each candidate and a set of candidates it dominates. Count-zero candidates form the first front.', 'After a front is selected, the algorithm decrements counts for candidates dominated by that front. Any count that reaches zero joins the next front.', 'Crowding distance sorts each front by each objective and gives larger scores to candidates with wider gaps to neighbors. Boundary candidates are protected because they define the visible range of tradeoffs.'] },
    { heading: 'Why it works', paragraphs: ['Dominance is a safe rejection rule for monotone objectives. If A is no worse than B on every objective and better on one, then B cannot be the better choice for any policy that prefers improvements in those objectives.', 'Crowding preserves search coverage. Without it, repeated selection would copy similar good candidates and leave parts of the frontier unexplored.'] },
    { heading: 'Cost and complexity', paragraphs: ['Classic NSGA-II sorting costs O(MN^2), where M is objective count and N is population size. Doubling population size roughly quadruples pairwise dominance work before objective evaluation is counted.', 'In many applications, evaluation dominates sorting. If one candidate requires a 30 second simulation, a population of 200 costs about 100 minutes per generation even before retries or repeated measurements.'] },
    { heading: 'Real-world uses', paragraphs: ['NSGA-II fits engineering design, controller tuning, architecture search, recommender tuning, compiler optimization, and latency-cost-recall search. It is useful when the desired output is a frontier that humans or policy can inspect.', 'It is also useful when constraints are known but preferences are not settled. The algorithm can present feasible options while leaving final policy outside the search loop.'] },
    { heading: 'Where it fails', paragraphs: ['It fails when the problem has one real objective plus hard constraints. A safety requirement should be a rejection gate, not an objective that can be traded away.', 'It also fails under noisy evaluation. Measurement variance can make dominated points appear non-dominated, so serious runs need repeated evaluation and feasibility labels.'] },
    { heading: 'Worked example', paragraphs: ['Consider four model routes with latency and cost to minimize: A = 90 ms and 6 cents, B = 110 ms and 4 cents, C = 85 ms and 8 cents, D = 130 ms and 7 cents. A dominates D because A is faster and cheaper.', 'B is cheaper than A but slower, and C is faster than A but more expensive, so A, B, and C are all on the first front. If only two can survive, crowding keeps boundary points B and C before a crowded middle point because they preserve the frontier range.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources are Deb et al., A Fast and Elitist Multiobjective Genetic Algorithm: NSGA-II, and mature library guides such as pagmo or pymoo. Read implementation notes on constraint handling before using it for safety-critical search.', 'Study evolutionary search, tournament selection, constraint handling, Pareto analysis, quality diversity, MAP-Elites, Bayesian optimization, and multi-armed bandits next. The practical skill is reporting the frontier, not only the favorite point.'] },
  ],
};