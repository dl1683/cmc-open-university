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
    { heading: 'How to read the animation', paragraphs: ['Read the animation as explicit search over partial reasoning states. Active nodes are generated or expanded states, removed nodes are pruned branches, and found nodes are selected or solved states.', 'A thought is a coherent intermediate step, and a frontier is the live set of states the search may expand next. If partial states can be judged, budget should move from weak branches to stronger ones.', {type:'callout', text:'Tree of Thoughts moves reasoning control out of one token stream and into an explicit frontier that can score, prune, and revisit partial states.'}]},
    { heading: 'Why this exists', paragraphs: ['Some tasks punish early commitment. In Game of 24, the first arithmetic move changes the remaining numbers and may make the goal unreachable.']},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is chain-of-thought prompting, or many complete samples with self-consistency voting. Both evaluate too late because bad branches spend their full token budget.']},
    { heading: 'The wall', paragraphs: ['A single sequence has no frontier, parent pointers, state scores, or backtracking rule. It cannot compare partial states before committing to later steps.']},
    { heading: 'The core insight', paragraphs: ['Move control outside the token stream. Generate several next thoughts, score the resulting states, keep a frontier, and expand again.']},
    { heading: 'How it works', paragraphs: ['A Tree of Thoughts system needs a state representation, generator, evaluator, and search policy. Breadth-first variants keep the best b states per depth; depth-first variants follow one branch and backtrack on weak states.']},
    { heading: 'Why it works', paragraphs: ['If the search eventually explores every reachable state and the goal test is exact, it can find any solution. Pruning trades completeness for cost and works when the evaluator ranks reachability better than chance.']},
    { heading: 'Cost and complexity', paragraphs: ['With beam width b=5, candidates k=5, depth T=3, and 3 evaluator votes, one depth can score 25 candidates with 75 evaluations. Doubling width roughly doubles generation and evaluation at every depth.']},
    { heading: 'Real-world uses', paragraphs: ['Tree search helps in puzzles, planning, proof search, code repair, and constrained writing when partial states are meaningful. It is weak for factual lookup, where retrieval is the right tool.']},
    { heading: 'Where it fails', paragraphs: ['It fails when the evaluator rewards fluency rather than progress, or when the generator produces five paraphrases of one idea. Then the tree has apparent breadth but little real search.']},
    { heading: 'Worked example', paragraphs: ['From 4, 5, 6, 10, generate 10-4=6 giving {5,6,6}, 10/5=2 giving {2,4,6}, and 6-4=2 giving {2,5,10}. Keep {5,6,6}, then 5*6=30 leaves {6,30}, and 30-6=24 solves the branch as (5*(10-4))-6.']},
    { heading: 'Sources and study next', paragraphs: ['Read Yao et al., Tree of Thoughts, and the Princeton NLP reference implementation. Study Chain-of-Thought, Self-Consistency, Beam Search, A* Search, Monte Carlo Tree Search, and Process Reward Models next.']},
  ],
};