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
      heading: 'What it is',
      paragraphs: [
        'NSGA-II is an evolutionary algorithm for multi-objective optimization. Instead of reducing every goal into one weighted score, it keeps a population of tradeoff candidates and sorts them into non-dominated Pareto fronts.',
        'A candidate is non-dominated if no other candidate is at least as good on every objective and strictly better on one. The first front contains candidates no other candidate beats outright. Later fronts contain candidates dominated only after better layers are removed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'NSGA-II combines parent and offspring populations, performs fast non-dominated sorting, and fills the next generation from the best fronts. If the last accepted front has more candidates than remaining slots, crowding distance chooses a spread-out subset.',
        'The data structures are domination counts, dominated sets, front arrays, objective-sorted lists, crowding distances, and the next-generation buffer. The algorithm is about preserving tradeoffs while selection pressure improves the frontier.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The classic NSGA-II sorting cost is often described as O(MN^2), where M is the number of objectives and N is population size. The practical cost also includes objective evaluations, which may dominate when every candidate is a simulation, model run, or benchmark.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NSGA-II appears in engineering design, scheduling, robotics, recommender tradeoffs, architecture search, hyperparameter tuning, ANN recall-latency-cost tuning, and any setting where users need several viable tradeoff points rather than one hidden weighted-sum answer.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not hide the policy choice inside arbitrary weights unless those weights reflect a real decision. Do not report only a single champion if the objective is multi-objective. Do not trust the frontier without checking constraint violations, evaluation noise, and whether crowding preserved meaningful diversity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NSGA-II paper PDF at https://sci2s.ugr.es/sites/default/files/files/Teaching/OtherPostGraduateCourses/Metaheuristicas/Deb_NSGAII.pdf, Springer chapter page at https://link.springer.com/chapter/10.1007/3-540-45356-3_83, and pagmo NSGA-II documentation at https://esa.github.io/pagmo2/docs/cpp/algorithms/nsga2.html. Study Evolutionary Search, Quality Diversity MAP-Elites, ANN Recall-Latency Pareto Ledger, Hyperparameter Search, and Multi-Armed Bandits next.',
      ],
    },
  ],
};
