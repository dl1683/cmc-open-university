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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Generate evaluate select" traces the full ToT loop on a Game of 24 instance: root state generates candidate thoughts, the evaluator scores them, the selector keeps the best frontier, and expansion continues until a branch reaches 24. "Backtracking search" focuses on what happens when a branch dies and the search recovers.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the current frontier: states being generated, evaluated, or expanded.',
            'Found nodes are confirmed outcomes: a solved state, a pruning decision, or a selected next step.',
            'Removed nodes are pruned branches: states the evaluator judged too weak to deserve more budget.',
            'Compare nodes show alternatives being weighed against each other during selection.',
          ],
        },
        'In the matrix views, rows are candidate thoughts or search parameters and columns show their evaluations. Watch which rows survive selection -- that is the search policy making its bet.',
        {
          type: 'note',
          text: 'The animation uses Game of 24 with the input {4, 5, 6, 10} because this is the same task used in the original ToT paper (Yao et al., 2023). Each "thought" is one arithmetic operation that reduces the remaining number set. The tree is small enough to trace by hand but large enough to show why one-shot decoding fails.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The key limitation of existing approaches is that they generate the final answer by sampling from a language model in a single pass, without the ability to explore different continuations of a partial solution or to evaluate the quality of intermediate steps.',
          attribution: 'Yao et al., "Tree of Thoughts: Deliberate Problem Solving with Large Language Models" (NeurIPS 2023), Section 1',
        },
        'Some problems punish early commitment. In Game of 24, the first arithmetic operation determines which numbers remain for the second and third moves. A bad first move -- say, 6 - 4 = 2, leaving {2, 5, 10} -- can make 24 unreachable no matter how clever the remaining moves are. The problem is not that any single step is hard. The problem is that the first step silently constrains all later steps, and a left-to-right decoder has no mechanism to undo that constraint.',
        'Planning, puzzle-solving, constrained writing, program synthesis, and mathematical proof all share this structure: partial progress is meaningful, early choices propagate, and the right move at depth 1 depends on what is reachable at depth 3.',
        {
          type: 'table',
          headers: ['Domain', 'What a "thought" is', 'Why early commitment hurts'],
          rows: [
            ['Game of 24', 'One arithmetic operation reducing the number set', 'Wrong first op can make 24 unreachable from remaining numbers'],
            ['Creative writing', 'A paragraph plan or outline decision', 'A weak opening premise constrains every paragraph that follows'],
            ['Crossword puzzle', 'A word placement filling one slot', 'A wrong 5-across blocks valid fills for 5-down and 7-across'],
            ['Program repair', 'A candidate fix at one location', 'A patch that fixes one test may break three others downstream'],
            ['Proof construction', 'A lemma choice or case split', 'Wrong decomposition creates an unprovable subgoal'],
          ],
        },
        'Tree of Thoughts exists because these problems need deliberate search over intermediate reasoning states, not just more tokens in a single pass.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is chain-of-thought (CoT) prompting: ask the model to "think step by step" and produce a complete reasoning trace in one left-to-right pass. CoT works remarkably well for problems where each step follows naturally from the previous one -- arithmetic word problems, logical deductions, reading comprehension. It earned its popularity.',
        {
          type: 'diagram',
          text: 'Chain-of-thought (single path):\n\n  Input: Use 4, 5, 6, 10 to make 24\n  Step 1: 6 - 4 = 2      (remaining: 2, 5, 10)\n  Step 2: 10 / 5 = 2      (remaining: 2, 2)\n  Step 3: 2 + 2 = 4       --> 4, not 24. Failed.\n\n  No backtracking. No alternative first moves explored.\n  The model committed to 6 - 4 at step 1 and is stuck.\n\nSelf-consistency (multiple independent paths):\n\n  Path A: 6 - 4 = 2, 10 / 5 = 2, 2 + 2 = 4   --> fail\n  Path B: 10 / 5 = 2, 2 * 6 = 12, 12 + 4 = 16 --> fail\n  Path C: 5 * 6 = 30, 30 - 10 = 20, 20 + 4 = 24 --> success!\n\n  Path C found it, but paths A and B burned their full budgets\n  on doomed branches before anyone checked intermediate states.',
          label: 'CoT commits once; self-consistency samples independently but evaluates only at the end',
        },
        'The next improvement, self-consistency (Wang et al., 2023), samples multiple independent reasoning paths and takes a majority vote on the final answer. This helps when at least one sampled path happens to be correct. But each path runs to completion before any evaluation occurs. If 8 out of 10 paths choose a bad first move, all 8 waste their entire budgets discovering the dead end independently.',
        'Both approaches share a structural blind spot: they never evaluate partial progress. The model either commits to one trace (CoT) or runs many traces to completion and votes afterward (self-consistency). Neither can say "this intermediate state looks unpromising, stop spending tokens on it and try something else."',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not "CoT sometimes fails." The wall is that left-to-right decoding has no representation of intermediate states, so it cannot compare, prune, or revisit partial solutions.',
        {
          type: 'diagram',
          text: 'Why the wall is structural, not just statistical:\n\n  CoT with input {4, 5, 6, 10}:\n\n  Token 1-5:   "6 - 4 = 2"    <-- committed, no undo\n  Token 6-10:  "10 / 5 = 2"   <-- still committed\n  Token 11-15: "2 + 2 = 4"    <-- dead end reached\n  Token 16:    [EOS]           <-- too late\n\n  At token 5, the model has no data structure storing:\n    - alternative first moves (10 - 4, 5 * 6, ...)\n    - evaluations of partial states ({2,5,10} vs {5,6,6} vs ...)\n    - a frontier of live candidates\n    - parent pointers for path reconstruction\n\n  The autoregressive format encodes ONE path in ONE sequence.\n  Search requires a TREE of states with SCORES and SELECTION.',
          label: 'Autoregressive decoding is a commitment device, not a search procedure',
        },
        'The Yao et al. paper quantifies this gap. On Game of 24, GPT-4 with standard CoT prompting solves 7.3% of problems. With CoT plus self-consistency (sampling 100 paths and voting), the success rate rises to only 9%. The bottleneck is not sampling variance -- it is that no amount of independent full-path sampling helps when the problem requires evaluating intermediate states to find the right branch.',
        {
          type: 'table',
          headers: ['Method', 'Game of 24 success rate', 'Why'],
          rows: [
            ['Standard IO prompt', '7.3%', 'One shot, no reasoning trace'],
            ['Chain-of-thought', '4.0%', 'One trace, often commits to bad first move'],
            ['CoT + self-consistency (k=100)', '9.0%', '100 independent traces, vote at end, no intermediate evaluation'],
            ['Tree of Thoughts (b=5, BFS)', '74%', 'Evaluates intermediate states, prunes dead branches, keeps live frontier'],
          ],
        },
        {
          type: 'note',
          text: 'CoT actually scores worse than the standard prompt on Game of 24. This is not a fluke. When the model narrates its reasoning step by step, it locks in early arithmetic choices with high confidence. The narrative momentum of "I chose 6 - 4 = 2, so now I have..." makes it harder, not easier, to explore alternatives. CoT helps when steps are individually easy and sequentially independent. It hurts when early steps constrain later ones and the model needs to compare alternatives.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat each coherent chunk of reasoning as a state in a search tree. Generate multiple candidate next states, evaluate them before committing, select a frontier of the most promising ones, and expand again. A failed branch is not a wasted run -- it is one node pruned from a living frontier.',
        {
          type: 'diagram',
          text: 'ToT reframes prompting as search:\n\n  Classical search           Tree of Thoughts\n  ----------------           -----------------\n  State space          <-->  Partial reasoning traces\n  Successor function   <-->  LLM thought generator\n  Heuristic function   <-->  LLM state evaluator\n  Search algorithm     <-->  BFS / DFS / best-first over thoughts\n  Goal test            <-->  Answer verification\n  Backtracking         <-->  Prune state, return to frontier\n\n  The LLM plays TWO roles: it proposes moves AND evaluates states.\n  The search algorithm is OUTSIDE the LLM -- it is code.',
          label: 'ToT maps classical AI search onto language model reasoning',
        },
        'The key design decisions are: (1) what constitutes a "thought" -- the granularity of each reasoning chunk; (2) how to generate candidate thoughts -- sampling, prompting for distinct approaches, or structured enumeration; (3) how to evaluate states -- value estimation, voting, heuristic, or external verification; and (4) which search algorithm to use -- BFS beam search, DFS with backtracking, or best-first with a priority queue.',
        {
          type: 'code',
          language: 'python',
          text: '# Core ToT loop (simplified from Yao et al. reference implementation)\ndef tree_of_thoughts_bfs(initial_state, generate_fn, evaluate_fn, b, T):\n    """BFS-style ToT: keep best b states at each of T depths."""\n    frontier = [initial_state]\n    for step in range(T):  # T = number of thought steps\n        candidates = []\n        for state in frontier:\n            # Generate: propose k candidate next thoughts\n            thoughts = generate_fn(state)\n            for thought in thoughts:\n                new_state = state + thought  # append thought to partial solution\n                candidates.append(new_state)\n        # Evaluate: score every candidate state\n        scores = evaluate_fn(candidates)\n        # Select: keep the best b states as the new frontier\n        ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)\n        frontier = [s for s, _ in ranked[:b]]\n    return frontier[0]  # best final state',
        },
        {
          type: 'note',
          text: 'The generate and evaluate functions are both LLM calls, but they serve different roles. The generator is creative -- it proposes diverse candidate moves. The evaluator is critical -- it estimates whether a partial state can lead to a solution. Separating these roles means the model can be "optimistic" during generation (explore widely) and "skeptical" during evaluation (prune aggressively). A single CoT trace forces the model to be both at once.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A ToT system has four components: state representation, thought generator, state evaluator, and search algorithm. Each is a design choice, not a fixed recipe.',
        {
          type: 'table',
          headers: ['Component', 'Game of 24 (paper)', 'Creative writing (paper)', 'General pattern'],
          rows: [
            ['State', 'Remaining numbers after operations', 'Current paragraph plan', 'Partial solution + constraints satisfied + work remaining'],
            ['Thought', 'One arithmetic operation', 'One paragraph outline', 'Coherent chunk of reasoning (not a single token)'],
            ['Generator', '"propose 4 possible next steps"', '"write the next paragraph plan"', 'LLM prompted for diverse candidates; or structured enumeration'],
            ['Evaluator', '"can these numbers reach 24? sure/likely/impossible"', '"rate this plan 1-10 on coherence"', 'LLM value prompt, voting, heuristic, verifier, or tool'],
            ['Search', 'BFS with beam width b=5', 'BFS with beam width b=5', 'BFS, DFS+backtrack, best-first, or MCTS'],
          ],
        },
        'The thought generator calls the LLM with the current partial state and asks for k candidate next moves. For Game of 24, the prompt includes the remaining numbers and asks the model to propose possible arithmetic operations. The key is asking for multiple distinct candidates in one call or sampling multiple completions, not generating one "best" next step.',
        'The state evaluator calls the LLM again with a different prompt. For Game of 24, the paper uses a value prompt: "Given these remaining numbers, can you reach 24? Answer: sure / likely / impossible." The evaluator can also use voting -- generate several assessments and take the majority -- or an external tool like a calculator or code executor.',
        {
          type: 'diagram',
          text: 'BFS-style ToT on Game of 24 with {4, 5, 6, 10}, b=3:\n\n  Depth 0 (root):  {4, 5, 6, 10}\n                   |\n  Generate:        propose 5 candidate first moves\n                   |\n  Depth 1:    10-4=6     5*6=30    10/5=2    6-4=2    4+5=9\n              {5,6,6}   {4,10,30} {2,4,6}   {2,5,10} {6,9,10}\n                   |\n  Evaluate:   sure       likely    likely    impossible  impossible\n                   |\n  Select b=3: {5,6,6}   {4,10,30} {2,4,6}  [pruned]    [pruned]\n                   |\n  Depth 2:    generate next moves from each surviving state...\n              5*6=30    30-4=26   2*6=12   ...\n              {6,30}    {10,26}   {2,4}    ...\n                   |\n  Evaluate + Select again, continue to depth 3...',
          label: 'At each depth, generate candidates, evaluate, keep the best b, expand',
        },
        'DFS-style ToT works differently: it follows one promising branch to completion, but maintains a stack. If the evaluator returns "impossible" at any intermediate state, the search backtracks to the most recent unexplored sibling. This uses less memory (no beam of b states per level) but may miss globally better branches that a wider search would find.',
        {
          type: 'code',
          language: 'python',
          text: '# DFS-style ToT with backtracking\ndef tree_of_thoughts_dfs(state, generate_fn, evaluate_fn, T, depth=0):\n    """DFS with pruning: follow one branch, backtrack on failure."""\n    if depth == T:\n        return state if is_solution(state) else None\n    thoughts = generate_fn(state)\n    scores = evaluate_fn([state + t for t in thoughts])\n    # Try candidates in order of score, best first\n    for thought, score in sorted(zip(thoughts, scores), key=lambda x: x[1], reverse=True):\n        if score == "impossible":\n            continue  # prune: do not expand this branch\n        result = tree_of_thoughts_dfs(state + thought, generate_fn, evaluate_fn, T, depth + 1)\n        if result is not None:\n            return result  # found a solution\n    return None  # all children pruned or failed; backtrack',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'ToT works when two conditions hold: intermediate states carry enough information to evaluate, and the evaluator is accurate enough to distinguish promising from doomed branches.',
        'The correctness argument rests on completeness and pruning safety. If the search is complete (it can eventually explore every reachable state), it will find any solution that exists. Pruning trades completeness for efficiency: an imperfect evaluator may prune the winning branch. The practical question is whether the evaluator is right often enough that the budget saved by pruning outweighs the occasional loss of a correct branch.',
        {
          type: 'table',
          headers: ['Property', 'What it requires', 'When it breaks'],
          rows: [
            ['State evaluability', 'Partial solutions have enough structure to score', 'Free-form text with no checkable constraints; evaluator guesses'],
            ['Evaluator accuracy', 'Scores correlate with true reachability of a solution', 'Evaluator rewards fluency over correctness; locally good states are globally stuck'],
            ['Branching diversity', 'Generator produces genuinely different candidates', 'Generator collapses to one dominant mode; all candidates are paraphrases'],
            ['Budget allocation', 'Pruning saves more than it loses', 'Evaluator is barely better than random; pruning is random deletion'],
          ],
        },
        'The gain over CoT comes from reversible commitment. A single chain must live with every choice it makes. A tree can invest a small budget in several first moves, evaluate the resulting states, and concentrate remaining budget on the most promising ones. This is the same principle that makes alpha-beta pruning or beam search effective: partial evaluation enables informed allocation.',
        {
          type: 'note',
          text: 'ToT does not require the evaluator to be perfect. On Game of 24, the LLM evaluator is wrong sometimes -- it says "sure" for states that cannot reach 24, or "impossible" for states that can. But it is right often enough (the paper reports roughly 70% accuracy on reachability judgments) that pruning dead branches saves far more budget than it loses from occasional mis-pruning. The threshold for "good enough" depends on the branching factor: higher branching needs a more accurate evaluator to avoid exponential waste.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost of ToT is measured in LLM calls, not FLOPs or memory, because each generate and evaluate step is an API call or inference pass.',
        {
          type: 'table',
          headers: ['Parameter', 'Symbol', 'Effect on cost', 'Game of 24 setting'],
          rows: [
            ['Thoughts per state', 'k', 'k candidates generated per frontier state per depth', '5 proposals per state'],
            ['Beam width', 'b', 'b states survive selection at each depth', 'b = 5 (BFS) or b = 1 (DFS)'],
            ['Search depth', 'T', 'T levels of generate-evaluate-select', 'T = 3 (three arithmetic ops)'],
            ['Evaluator calls', 'e', 'e evaluations per candidate (1 for value, >1 for voting)', '3 votes per candidate'],
            ['Total LLM calls', '', 'T * (b * k generate + b * k * e evaluate)', '~150 calls for one puzzle'],
          ],
        },
        'For Game of 24 with BFS (b=5, k=5, T=3, e=3): at each depth, 5 frontier states each generate 5 candidates = 25 generation calls, then 25 candidates each get 3 evaluation votes = 75 evaluation calls. Over 3 depths: roughly 300 LLM calls per puzzle. Compare this to CoT (1 call) or self-consistency with k=100 (100 calls). ToT uses 3x more calls than 100-sample self-consistency but solves 74% vs 9% of puzzles.',
        'The cost scales multiplicatively, not additively. Doubling beam width doubles generation calls AND evaluation calls at every depth. Doubling depth multiplies total cost by the per-depth factor. This makes ToT expensive for deep problems with wide branching. Practical deployments need either cheap evaluators (code execution, rule checkers) or aggressive early pruning to stay within budget.',
        {
          type: 'note',
          text: 'The original paper reports wall-clock times of roughly 5-15 minutes per Game of 24 puzzle with GPT-4, due to sequential API calls. Parallelizing generation and evaluation across candidates at the same depth reduces latency significantly. The token cost is the binding constraint, not the wall time.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a complete BFS-style ToT run on the Game of 24 input {4, 5, 6, 10} with beam width b = 2 (narrower than the paper for readability).',
        {
          type: 'diagram',
          text: 'Depth 0: State = {4, 5, 6, 10}\n\nGenerate 4 candidate first moves:\n  (a) 10 - 4 = 6  --> remaining {5, 6, 6}\n  (b) 10 / 5 = 2  --> remaining {2, 4, 6}\n  (c) 6 - 4 = 2   --> remaining {2, 5, 10}\n  (d) 5 + 4 = 9   --> remaining {6, 9, 10}\n\nEvaluate each:\n  (a) {5, 6, 6}: "sure"      -- 5*6-6=24, multiple paths visible\n  (b) {2, 4, 6}: "likely"    -- 2*6+4=16, 4*6=24 yes\n  (c) {2, 5, 10}: "impossible" -- 2*5+10=20, 2*10+5=25, 2+5+10=17...\n  (d) {6, 9, 10}: "likely"   -- 10-9=1, 6*1=6 no; 9-6=3, hard...\n\nSelect b=2: keep (a) and (b). Prune (c) and (d).',
          label: 'Depth 0: generate, evaluate, select the best 2 states',
        },
        {
          type: 'diagram',
          text: 'Depth 1: Expand from {5, 6, 6} and {2, 4, 6}\n\nFrom {5, 6, 6}:\n  (a1) 5 * 6 = 30 --> {6, 30}    eval: "sure" (30-6=24)\n  (a2) 6 + 6 = 12 --> {5, 12}    eval: "likely" (12+5=17, 12*5=60...)\n  (a3) 6 - 5 = 1  --> {1, 6}     eval: "impossible" (max 7)\n\nFrom {2, 4, 6}:\n  (b1) 4 * 6 = 24 --> {2, 24}    eval: "sure" (24+2=26, 24-2=22, 24/2=12... wait, 24*2=48)\n  (b2) 2 * 6 = 12 --> {4, 12}    eval: "likely" (12+4=16, 12*4=48)\n\nSelect b=2: keep (a1) {6, 30} and (b1) {2, 24}.',
          label: 'Depth 1: both surviving branches produce promising children',
        },
        {
          type: 'diagram',
          text: 'Depth 2: Expand from {6, 30} and {2, 24}\n\nFrom {6, 30}:\n  30 - 6 = 24  --> SOLUTION FOUND\n  Expression: (5 * (10 - 4)) - 6 = 24\n\nFrom {2, 24}:\n  24 + 2 = 26, 24 - 2 = 22, 24 * 2 = 48, 24 / 2 = 12\n  None equal 24 with one remaining number.\n  (Actually 4 * 6 = 24 already, so 24 op 2 cannot reach 24.)\n\nSearch terminates: solution found via branch (a) --> (a1).',
          label: 'Depth 2: the winning branch reaches 24; the other branch was a distraction',
        },
        'Total cost: 4 + 5 + 2 = 11 generation calls, plus 11 evaluation calls with 3 votes each = 33 evaluation calls. About 44 LLM calls total to solve a puzzle that CoT fails on 96% of the time.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Application', 'Thought granularity', 'Evaluator type', 'Why ToT fits'],
          rows: [
            ['Mathematical reasoning', 'One proof step or equation transformation', 'Formal verifier or LLM consistency check', 'Wrong lemma choice at depth 1 wastes all subsequent effort'],
            ['Code generation', 'A function skeleton or algorithm choice', 'Unit test execution on partial code', 'Early architectural decision constrains all later code'],
            ['Planning and scheduling', 'One sub-goal assignment or resource allocation', 'Constraint checker or simulation', 'Upstream task assignment cascades through dependency graph'],
            ['Constrained text generation', 'One paragraph or section outline', 'Rubric-based LLM scoring', 'An outline that misses a constraint cannot be fixed by better paragraphs'],
            ['Puzzle solving (Sudoku, crosswords)', 'One cell or word placement', 'Constraint propagation', 'Each placement eliminates options for intersecting entries'],
          ],
        },
        'ToT is strongest when three conditions align: early choices constrain later ones, intermediate states have enough structure to evaluate cheaply, and the branching factor is moderate enough that the search does not explode. Game of 24, crosswords, and Sudoku are almost ideal: the state is compact, evaluation is cheap (can the remaining numbers/letters reach the goal?), and the branching factor is small.',
        'Production systems increasingly combine ToT with stronger evaluators. Using a code interpreter to run partial programs, a theorem prover to check proof steps, or a constraint solver to validate plans replaces the LLM-as-evaluator with a ground-truth signal. This moves ToT from "prompt engineering with search" toward classical AI planning with a learned proposal distribution.',
        {
          type: 'quote',
          text: 'The language model serves as an approximate world model, proposing candidate actions, while the search procedure ensures systematic exploration. This division of labor mirrors the policy-value split in AlphaGo: the policy network proposes moves, the value network evaluates board states, and MCTS provides the search.',
          attribution: 'Analogy drawn from Yao et al. (2023) Section 4 and Silver et al. (2016)',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ToT has four failure modes, and the last two are silent.',
        {
          type: 'bullets',
          items: [
            'Evaluator collapse: the LLM evaluator rewards fluency or surface plausibility rather than actual progress toward the goal. All candidates score "likely," pruning becomes random, and the search degenerates to expensive self-consistency. This is the most common failure on open-ended tasks without checkable constraints.',
            'Generator mode collapse: the thought generator produces k candidates that are syntactic variations of the same idea. The tree has breadth on paper but explores one direction in practice. Prompting for "distinct approaches" helps but does not guarantee diversity.',
            'Silent budget waste (subtle): the search keeps all b states alive at every depth, but only one branch ever had a chance. The other b-1 branches consume generate + evaluate calls at every level without contributing. There is no signal that budget is being wasted until the run finishes.',
            'Evaluator-generator collusion (subtle): when the same LLM serves as both generator and evaluator, it can systematically prefer its own most confident outputs. A thought the model generates with high probability tends to also score highly under the same model, even if an external checker would flag it as wrong. This creates a self-reinforcing loop that looks like progress but is circular validation.',
          ],
        },
        {
          type: 'table',
          headers: ['Task type', 'ToT effectiveness', 'Why'],
          rows: [
            ['Factual lookup ("What year was X born?")', 'Poor', 'No intermediate state to evaluate; answer is retrieved, not searched'],
            ['Summarization', 'Poor', 'Each summary sentence is weakly constrained by others; evaluation is subjective'],
            ['Single-step reasoning', 'Unnecessary', 'No sequential dependency; CoT or direct prompting suffices'],
            ['Tasks needing external data', 'Poor without tools', 'Branching guesses about facts is worse than one retrieval call'],
            ['Very deep reasoning (>10 steps)', 'Expensive', 'Cost grows multiplicatively with depth; evaluator accuracy degrades at later steps'],
          ],
        },
        'The general rule: ToT adds value when the ratio of evaluator accuracy to branching factor is high, and when the problem has sequential dependencies that make backtracking valuable. When either condition fails, the overhead of search outweighs the benefit.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'State representation matters more than search algorithm. A good state captures: what has been decided, what constraints are satisfied, what remains to be done, and what resources (numbers, variables, budget) are left. If the state is just concatenated text, the evaluator has to re-parse everything.',
            'Start with b=2 or b=3 and shallow depth. Most of the gain comes from having any branching at all versus zero. Going from b=1 (CoT) to b=3 captures most of the value; going from b=3 to b=10 usually adds cost faster than accuracy.',
            'Use task-specific evaluators whenever possible. A calculator for math, a test runner for code, a constraint checker for planning. The LLM evaluator is the fallback, not the first choice.',
            'Log everything: for each state, record the parent state, the generating thought, the evaluation score, the pruning decision, and the token cost. Without these records, debugging a failed search is guesswork.',
            'Parallelize generation and evaluation within each depth level. Candidates at the same depth are independent. The sequential bottleneck is depth, not width.',
          ],
        },
        {
          type: 'code',
          language: 'javascript',
          text: '// Minimal ToT state for Game of 24\nconst state = {\n  numbers: [5, 6, 6],       // remaining numbers after operations\n  ops: ["10 - 4 = 6"],      // operations taken so far (for path reconstruction)\n  depth: 1,                  // current depth in the search tree\n  score: "sure",             // evaluator verdict\n  parentId: "root",          // link back to parent state\n  tokenCost: 47,             // tokens spent generating + evaluating this state\n};\n// A good state is small, serializable, and carries enough\n// information for the evaluator to judge without re-reading\n// the entire conversation history.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Role', 'Link'],
          rows: [
            ['Yao et al., "Tree of Thoughts: Deliberate Problem Solving with Large Language Models" (NeurIPS 2023)', 'Primary paper defining ToT framework', 'https://arxiv.org/abs/2305.10601'],
            ['Official implementation (Princeton NLP)', 'Reference code for Game of 24 and crossword experiments', 'https://github.com/princeton-nlp/tree-of-thought-llm'],
            ['Long, "Large Language Model Guided Tree-of-Thought" (2023)', 'Independent ToT variant using a single prompt for the controller', 'https://arxiv.org/abs/2305.08291'],
            ['Wei et al., "Chain-of-Thought Prompting" (NeurIPS 2022)', 'The baseline that ToT extends', 'https://arxiv.org/abs/2201.11903'],
            ['Wang et al., "Self-Consistency Improves Chain of Thought Reasoning" (ICLR 2023)', 'The sampling-and-voting baseline', 'https://arxiv.org/abs/2203.11171'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Chain-of-Thought Prompting and Self-Consistency Reasoning Vote to understand the baselines ToT improves upon.',
            'Companion: study Beam Search for the frontier-management algorithm that BFS-style ToT directly uses.',
            'Extension: study Monte Carlo Tree Search (MCTS) for a more sophisticated search policy with exploration bonuses (UCB) and rollout-based evaluation.',
            'Deeper evaluator: study Process Reward Models for training a dedicated step-level evaluator instead of using the LLM as its own judge.',
            'Classical roots: study A* Search and Tree Traversals (BFS/DFS) for the search algorithms underlying ToT.',
          ],
        },
      ],
    },
  ],
};

