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
      heading: 'The problem',
      paragraphs: [
        'Some problems are not hard because each step is mysterious. They are hard because an early choice controls what later choices are possible. A puzzle move, proof direction, plan decomposition, or program repair strategy can quietly turn a solvable problem into a dead end.',
        'A normal left-to-right language-model answer commits to one path. Even self-consistency, which samples multiple complete paths and votes at the end, usually does not manage a shared frontier of partial solutions. Tree of Thoughts exists to make the intermediate states explicit enough to search, score, prune, and revisit.',
      ],
    },
    {
      heading: 'Why one chain is brittle',
      paragraphs: [
        'Chain-of-thought asks the model to produce one reasoning trace. It can help the model spend more tokens on the problem, but it has no built-in way to say "this partial route is weak, keep the other two alive." The first plausible move often gets narrative momentum.',
        'Self-consistency improves coverage by sampling several full answers, but it evaluates after complete traces have already spent their budget. If the useful signal appears at depth two or three, voting over finished paths may waste most of the search on branches that could have been pruned earlier.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat a thought as a state in a search tree. From a state, generate candidate next thoughts, evaluate the resulting states, keep a frontier, and expand again. A failed branch is not the end of the run; it is one state removed from the frontier.',
        'This reframes prompting as search engineering. The central objects are no longer just tokens. They are states, branching factor, evaluator quality, selection policy, depth limit, stopping rule, and budget.',
      ],
    },
    {
      heading: 'What the views show',
      paragraphs: [
        'In the generate-evaluate-select view, follow the frontier. The root is the original problem state. Each first move creates a child state. The evaluator labels which children deserve more budget, and the selector decides which states remain alive.',
        'In the backtracking view, focus on the dead branch. The point is not that the model avoided all mistakes. The point is that a mistake can be isolated, abandoned, and replaced by another partial solution because the search tree still exists.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A ToT system needs a state representation. In Game of 24, a state can be the remaining numbers after an arithmetic move. In planning, it might be a partial plan. In writing, it might be an outline plus constraints already satisfied.',
        'The generator proposes next states. The evaluator scores them using a value prompt, vote prompt, heuristic, verifier, tool execution, or task-specific checker. The selector keeps some states by breadth-first beam, depth-first backtracking, best-first priority, or another policy. The loop stops when a solution passes the answer rule or the budget is exhausted.',
        'The data structure can be a tree, but implementations often behave like frontier search: keep a queue, heap, or beam of candidate states and store parent links only when the final reasoning path needs to be reconstructed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when partial progress is meaningful and evaluable. If the evaluator can recognize that one arithmetic state is closer to 24, one plan avoids a constraint conflict, or one proof branch preserves a useful invariant, search can allocate more budget to better states.',
        'The gain comes from reversible commitment. A single chain has to live with its earlier choices. A tree can spend a little budget on several choices, gather feedback, and then deepen the most promising ones.',
      ],
    },
    {
      heading: 'What can go wrong',
      paragraphs: [
        'The search can explode. If each state generates b children and the search runs for d levels, the naive tree grows exponentially. Practical systems cap depth, cap width, reuse evaluations, stop early, and prefer task-specific validators over open-ended self-judgment.',
        'The evaluator can become the failure point. If it rewards fluent nonsense, overconfident shortcuts, or states that look locally promising but break later constraints, ToT will amplify that bias. More branches do not help when the scoring function points in the wrong direction.',
        'ToT also does not replace missing information or computation. If the task requires a database lookup, code execution, theorem prover, calculator, or external evidence, the right move is to add that tool to the loop rather than branch unsupported guesses.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is driven by generated thoughts per state, frontier width, depth, and evaluator calls. A modest width can still multiply token usage quickly because every surviving state may need fresh generation and scoring.',
        'The behavior is also less smooth than ordinary prompting. A narrow frontier is cheap but may prune the winning branch. A wide frontier has better coverage but spends heavily and can keep many mediocre states alive. A deeper search can repair early uncertainty but increases drift and evaluator burden.',
      ],
    },
    {
      heading: 'Where it fits',
      paragraphs: [
        'ToT fits puzzles, planning, search-heavy reasoning, decomposition, program repair candidates, and structured writing when intermediate states have enough shape to score. It is strongest when early choices matter and a cheap evaluator can reject dead ends before they consume the whole budget.',
        'It is weaker for factual lookup, summarization of known material, low-branch tasks, or cases where the evaluator is no better than the generator. In those settings, retrieval, tool use, direct verification, or a simpler self-consistency pass may give a better cost-quality tradeoff.',
      ],
    },
    {
      heading: 'Relationship to other methods',
      paragraphs: [
        'Compared with beam search, ToT usually uses larger semantic chunks as states instead of individual tokens. Compared with self-consistency, it evaluates before the final answer rather than only voting afterward. Compared with process reward models, it can use weaker evaluators but pays for search control.',
        'A strong verifier changes the design. If candidate states can be executed or formally checked, the loop starts looking less like prompt engineering and more like classical heuristic search with an LLM proposal function.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'In Game of 24, the root state is the multiset 4, 5, 6, 10. Candidate thoughts are arithmetic moves that reduce the multiset: 10 - 4 = 6 leaves 5, 6, 6; 10 / 5 = 2 leaves 2, 4, 6; 6 - 4 = 2 leaves 2, 5, 10. The evaluator estimates which remaining sets are promising.',
        'The branch 10 - 4 = 6 can continue with 5 * 6 = 30 and then 30 - 6 = 24. A weaker branch can die without killing the run because the frontier still contains other states. The visualization makes that survival of alternatives visible.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the state format small and explicit. A good state names the partial answer, the constraints already satisfied, the remaining work, and the score evidence. If the state is just a paragraph of free text, the evaluator has to infer too much and the search becomes expensive storytelling.',
        'Start with narrow beams, shallow depth, and a task-specific checker whenever possible. Log parent links, scores, evaluator reasons, token cost, and the prune decision for every state. Those records make it possible to see whether failures came from weak generation, bad scoring, too little width, or an early stopping rule that cut off the winning branch.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Tree of Thoughts: Deliberate Problem Solving with Large Language Models at https://arxiv.org/abs/2305.10601 and the official implementation at https://github.com/princeton-nlp/tree-of-thought-llm.',
        'Study Self-Consistency Reasoning Vote first for the simpler full-path vote, then Beam Search for frontier pruning, A* Search for heuristic search, Tree Traversals for explicit tree mechanics, Process Reward Models & Verifier Search for stronger evaluators, and Monte Carlo Tree Search & UCT Primer for a classical search algorithm with exploration bonuses.',
      ],
    },
  ],
};
