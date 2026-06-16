// Tree of Thoughts: treat intermediate reasoning chunks as tree states, then
// generate, evaluate, select, and backtrack instead of decoding once.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tree-of-thoughts-search-case-study',
  title: 'Tree of Thoughts Search Case Study',
  category: 'Papers',
  summary: 'Turn reasoning into explicit search: generate thought states, evaluate them, keep the promising frontier, and backtrack when a branch dies.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['generate evaluate select', 'backtracking search'], defaultValue: 'generate evaluate select' },
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

function totGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'root', label: '4 5 6 10', x: 0.8, y: 4.0, note: notes.root ?? 'start' },
      { id: 't1', label: '10-4=6', x: 2.8, y: 1.8, note: notes.t1 ?? 'good' },
      { id: 't2', label: '10/5=2', x: 2.8, y: 4.0, note: notes.t2 ?? 'maybe' },
      { id: 't3', label: '6-4=2', x: 2.8, y: 6.2, note: notes.t3 ?? 'weak' },
      { id: 'u1', label: '6*5=30', x: 5.0, y: 1.8, note: notes.u1 ?? 'near' },
      { id: 'u2', label: '6+6=12', x: 5.0, y: 3.3, note: notes.u2 ?? 'ok' },
      { id: 'u3', label: '2*6=12', x: 5.0, y: 5.0, note: notes.u3 ?? 'ok' },
      { id: 'dead', label: 'dead', x: 5.0, y: 6.7, note: notes.dead ?? 'no 24' },
      { id: 'goal', label: '30-6=24', x: 7.5, y: 2.4, note: notes.goal ?? 'solve' },
      { id: 'answer', label: 'answer', x: 9.2, y: 2.4, note: notes.answer ?? '(5*(10-4))-6' },
    ],
    edges: [
      { id: 'e-root-t1', from: 'root', to: 't1' },
      { id: 'e-root-t2', from: 'root', to: 't2' },
      { id: 'e-root-t3', from: 'root', to: 't3' },
      { id: 'e-t1-u1', from: 't1', to: 'u1' },
      { id: 'e-t1-u2', from: 't1', to: 'u2' },
      { id: 'e-t2-u3', from: 't2', to: 'u3' },
      { id: 'e-t3-dead', from: 't3', to: 'dead' },
      { id: 'e-u1-goal', from: 'u1', to: 'goal' },
      { id: 'e-goal-answer', from: 'goal', to: 'answer' },
    ],
  }, { title });
}

function loopGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'state', label: 'state', x: 0.8, y: 4.0, note: notes.state ?? 'partial' },
      { id: 'generate', label: 'gen', x: 2.6, y: 2.4, note: notes.generate ?? 'thoughts' },
      { id: 'evaluate', label: 'eval', x: 4.5, y: 2.4, note: notes.evaluate ?? 'value' },
      { id: 'select', label: 'select', x: 6.4, y: 2.4, note: notes.select ?? 'frontier' },
      { id: 'expand', label: 'expand', x: 8.2, y: 4.0, note: notes.expand ?? 'next depth' },
      { id: 'backtrack', label: 'back', x: 4.5, y: 6.0, note: notes.backtrack ?? 'dead end' },
      { id: 'stop', label: 'stop', x: 9.4, y: 2.4, note: notes.stop ?? 'answer' },
    ],
    edges: [
      { id: 'e-state-generate', from: 'state', to: 'generate' },
      { id: 'e-generate-evaluate', from: 'generate', to: 'evaluate' },
      { id: 'e-evaluate-select', from: 'evaluate', to: 'select' },
      { id: 'e-select-expand', from: 'select', to: 'expand' },
      { id: 'e-expand-state', from: 'expand', to: 'state' },
      { id: 'e-evaluate-backtrack', from: 'evaluate', to: 'backtrack' },
      { id: 'e-select-stop', from: 'select', to: 'stop' },
    ],
  }, { title });
}

function* generateEvaluateSelect() {
  yield {
    state: loopGraph('Tree of Thoughts turns reasoning into a search loop'),
    highlight: { active: ['state', 'generate', 'evaluate', 'select'], found: ['expand'] },
    explanation: 'Tree of Thoughts treats a thought as a coherent intermediate state. The loop generates candidate next thoughts, evaluates them, selects a frontier, and expands again.',
    invariant: 'The model is no longer forced into one left-to-right path.',
  };

  yield {
    state: totGraph('Game of 24 as a thought tree'),
    highlight: { active: ['root', 't1', 't2', 't3', 'e-root-t1', 'e-root-t2', 'e-root-t3'], found: ['goal'] },
    explanation: 'For Game of 24, a thought can be an arithmetic move that reduces the remaining numbers. From 4, 5, 6, 10, the search proposes several first moves instead of committing to one.',
  };

  yield {
    state: labelMatrix(
      'Evaluate thoughts',
      [
        { id: 't1', label: '10-4' },
        { id: 't2', label: '10/5' },
        { id: 't3', label: '6-4' },
      ],
      [
        { id: 'left', label: 'left' },
        { id: 'value', label: 'value' },
      ],
      [
        ['5,6,6', 'high'],
        ['2,4,6', 'mid'],
        ['2,5,10', 'low'],
      ],
    ),
    highlight: { active: ['t1:value', 't2:value'], compare: ['t3:value'] },
    explanation: 'The evaluator can be the same language model, a verifier, a heuristic, or executable code. The key is that states are scored before the search spends more budget on them.',
  };

  yield {
    state: totGraph('Select the frontier and expand'),
    highlight: { active: ['t1', 't2', 'u1', 'u2', 'u3', 'e-t1-u1', 'e-t1-u2', 'e-t2-u3'], removed: ['t3', 'dead'] },
    explanation: 'A BFS-like ToT variant keeps the best b states at each depth. A DFS-like variant follows one promising branch but can backtrack. Either way, the frontier is explicit.',
  };

  yield {
    state: totGraph('A selected branch reaches 24'),
    highlight: { active: ['root', 't1', 'u1', 'goal', 'answer', 'e-root-t1', 'e-t1-u1', 'e-u1-goal', 'e-goal-answer'], found: ['answer'] },
    explanation: 'The branch 10 - 4 = 6, then 5 * 6 = 30, then 30 - 6 = 24 solves the problem. The search found it because the first thought was kept alive long enough to produce the final move.',
  };
}

function* backtrackingSearch() {
  yield {
    state: loopGraph('Backtracking is a first-class operation'),
    highlight: { active: ['evaluate', 'backtrack', 'e-evaluate-backtrack'], compare: ['stop'] },
    explanation: 'The paper frames ToT as allowing lookahead and backtracking. A bad branch is not a permanent failure; it is a state to abandon while the frontier keeps other candidates alive.',
  };

  yield {
    state: totGraph('The weak branch dies without killing the search'),
    highlight: { active: ['t3', 'dead', 'e-t3-dead'], removed: ['dead'], found: ['t1', 't2'] },
    explanation: 'The 6 - 4 branch can run out of useful moves. A single chain-of-thought decode would be stuck with its early decision; tree search returns to the frontier.',
  };

  yield {
    state: labelMatrix(
      'Search controls',
      [
        { id: 'width', label: 'width' },
        { id: 'depth', label: 'depth' },
        { id: 'evals', label: 'evals' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'meaning', label: 'means' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['states kept', 'cost'],
        ['steps ahead', 'drift'],
        ['votes/value', 'bias'],
        ['answer rule', 'early stop'],
      ],
    ),
    highlight: { active: ['width:meaning', 'evals:meaning'], compare: ['evals:risk'] },
    explanation: 'Tree search introduces knobs: frontier width, depth, number of evaluator calls, and stopping rule. Those knobs are data structures plus budget policy, not prompt decoration.',
  };

  yield {
    state: loopGraph('ToT sits between self-consistency and verifier search', { state: 'thought', generate: 'branch', evaluate: 'score', select: 'keep b', backtrack: 'retry', stop: 'solution' }),
    highlight: { active: ['generate', 'evaluate', 'select', 'backtrack'], found: ['stop'] },
    explanation: 'Self-consistency samples independent full paths and votes. ToT evaluates intermediate states. Process reward models can make the evaluator stronger by scoring each step rather than only the final answer.',
  };

  yield {
    state: labelMatrix(
      'When ToT helps',
      [
        { id: 'planning', label: 'planning' },
        { id: 'puzzle', label: 'puzzle' },
        { id: 'writing', label: 'writing' },
        { id: 'lookup', label: 'lookup' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['early choices', 'good'],
        ['branch states', 'good'],
        ['outline eval', 'mixed'],
        ['fact needed', 'poor'],
      ],
    ),
    highlight: { active: ['planning:fit', 'puzzle:fit'], compare: ['lookup:fit'] },
    explanation: 'Tree search helps when intermediate choices matter and can be evaluated. It is a poor substitute for missing facts: if the problem needs retrieval or execution, add those tools rather than branching guesses.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'generate evaluate select') yield* generateEvaluateSelect();
  else if (view === 'backtracking search') yield* backtrackingSearch();
  else throw new InputError('Pick a Tree of Thoughts view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Tree of Thoughts, or ToT, is a search framework for language-model reasoning. It generalizes chain-of-thought from one left-to-right trace into a tree of coherent intermediate thoughts. Each thought is a state that can be generated, evaluated, selected, expanded, or abandoned.',
        'The key shift is representational. The system stops treating reasoning as one token stream and starts treating it as a frontier search problem. That makes classic data structures visible: trees, queues, priority frontiers, backtracking, evaluators, and stopping rules.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A ToT loop starts with a problem state. The generator proposes candidate thoughts. The evaluator scores those thoughts, often with value prompts, votes, or task-specific checks. The selector keeps a frontier of promising states. The search repeats until a solution is found, the budget is exhausted, or the frontier dies.',
        'The official implementation exposes these choices directly: generation can sample or propose thoughts, evaluation can use value or vote prompts, and selection controls how many states stay alive. This is ordinary search engineering wrapped around language-model calls.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'In Game of 24, a thought can be an arithmetic move that reduces the remaining numbers. Starting from 4, 5, 6, 10, the search might try 10 - 4 = 6, 10 / 5 = 2, and 6 - 4 = 2. The evaluator scores the resulting states. A promising branch continues to 5 * 6 = 30 and then 30 - 6 = 24.',
        'The important point is not that this puzzle is hard. The important point is that the first move shapes all later possibilities. A greedy chain can throw away the winning branch immediately. ToT keeps multiple branches alive and lets evaluation steer the budget.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is the product of depth, frontier width, generated thoughts per state, and evaluator calls per thought. If width is b and depth is d, a naive tree can grow like b^d. Practical ToT systems prune aggressively, cache evaluations, stop early, and use task-specific validators when possible.',
        'The evaluator is the weak point. If it rewards plausible but wrong thoughts, the search will amplify the wrong branch. If it is expensive, the search becomes slow. Process Reward Models & Verifier Search is the natural next layer because it makes step scoring more systematic.',
      ],
    },
    {
      heading: 'Primary sources and study next',
      paragraphs: [
        'Primary sources: Tree of Thoughts: Deliberate Problem Solving with Large Language Models at https://arxiv.org/abs/2305.10601 and the official implementation at https://github.com/princeton-nlp/tree-of-thought-llm.',
        'Study Self-Consistency Reasoning Vote first for the simpler full-path vote, then Beam Search for frontier pruning, A* Search for heuristic search, Tree Traversals for explicit tree mechanics, Process Reward Models & Verifier Search for stronger evaluators, and Monte Carlo Tree Search & UCT Primer for a classical search algorithm with exploration bonuses.',
      ],
    },
  ],
};
