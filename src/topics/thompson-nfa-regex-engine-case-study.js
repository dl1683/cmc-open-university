// Thompson NFA regex engine: compile regex syntax into small fragments, patch
// eps edges, then simulate all active states in parallel instead of guessing.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'thompson-nfa-regex-engine-case-study',
  title: 'Thompson NFA Regex Engine Case Study',
  category: 'Concepts',
  summary: 'Compile a regex into Thompson NFA fragments, follow eps closures, and match by carrying a set of active states instead of a recursive backtracking stack.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fragment construction', 'epsilon closure simulation'], defaultValue: 'fragment construction' },
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

function pipelineGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'regex', label: 'regex', x: 0.7, y: 4.0, note: notes.regex ?? '(ab|a)*c' },
      { id: 'parse', label: 'parse', x: 2.3, y: 4.0, note: notes.parse ?? 'operators' },
      { id: 'frag', label: 'frags', x: 4.0, y: 2.5, note: notes.frag ?? 'start+outs' },
      { id: 'patch', label: 'patch', x: 5.6, y: 4.0, note: notes.patch ?? 'wire outs' },
      { id: 'nfa', label: 'NFA', x: 7.2, y: 4.0, note: notes.nfa ?? 'eps graph' },
      { id: 'list', label: 'list', x: 8.8, y: 2.5, note: notes.list ?? 'active set' },
      { id: 'match', label: 'match', x: 9.4, y: 5.7, note: notes.match ?? 'accept?' },
    ],
    edges: [
      { id: 'e-regex-parse', from: 'regex', to: 'parse', weight: '' },
      { id: 'e-parse-frag', from: 'parse', to: 'frag', weight: '' },
      { id: 'e-frag-patch', from: 'frag', to: 'patch', weight: '' },
      { id: 'e-patch-nfa', from: 'patch', to: 'nfa', weight: '' },
      { id: 'e-nfa-list', from: 'nfa', to: 'list', weight: '' },
      { id: 'e-list-match', from: 'list', to: 'match', weight: '' },
    ],
  }, { title });
}

function nfaGraph(title) {
  return graphState({
    nodes: [
      { id: 'start', label: 'start', x: 0.5, y: 4.0, note: '' },
      { id: 'repeat', label: 'split', x: 1.8, y: 4.0, note: '* or exit' },
      { id: 'alt', label: 'split', x: 3.2, y: 4.0, note: 'ab | a' },
      { id: 'a1', label: 'a', x: 4.8, y: 2.2, note: 'long' },
      { id: 'b1', label: 'b', x: 6.3, y: 2.2, note: '' },
      { id: 'a2', label: 'a', x: 4.8, y: 5.8, note: 'short' },
      { id: 'c', label: 'c', x: 7.4, y: 5.0, note: 'exit' },
      { id: 'match', label: 'match', x: 9.0, y: 5.0, note: 'accept' },
    ],
    edges: [
      { id: 'e-start-repeat', from: 'start', to: 'repeat', weight: 'eps' },
      { id: 'e-repeat-alt', from: 'repeat', to: 'alt', weight: 'eps' },
      { id: 'e-repeat-c', from: 'repeat', to: 'c', weight: 'eps' },
      { id: 'e-alt-a1', from: 'alt', to: 'a1', weight: 'eps' },
      { id: 'e-alt-a2', from: 'alt', to: 'a2', weight: 'eps' },
      { id: 'e-a1-b1', from: 'a1', to: 'b1', weight: 'a' },
      { id: 'e-b1-repeat', from: 'b1', to: 'repeat', weight: 'b' },
      { id: 'e-a2-repeat', from: 'a2', to: 'repeat', weight: 'a' },
      { id: 'e-c-match', from: 'c', to: 'match', weight: 'c' },
    ],
  }, { title });
}

function closureTable() {
  return labelMatrix(
    'Simulating (ab|a)*c on abc',
    [
      { id: 's0', label: 'S' },
      { id: 's1', label: 'a' },
      { id: 's2', label: 'b' },
      { id: 's3', label: 'c' },
    ],
    [
      { id: 'input', label: 'input' },
      { id: 'move', label: 'move' },
      { id: 'closure', label: 'closure' },
    ],
    [
      ['-', 'start', 'R,A,L,S,C'],
      ['a', 'a1+a2', 'B,R,A,L,S,C'],
      ['b', 'b1', 'R,A,L,S,C'],
      ['c', 'c1', 'M'],
    ],
  );
}

function* fragmentConstruction() {
  yield {
    state: pipelineGraph('A Thompson engine compiles before it matches'),
    highlight: { active: ['regex', 'parse', 'frag'], found: ['nfa'] },
    explanation: 'The regex is first parsed into operators such as literal, concatenation, alternation, and star. Thompson construction turns each operator into a tiny fragment with one start state and a list of dangling exits to patch later.',
    invariant: 'The compiler builds graph fragments; the matcher never reparses the pattern.',
  };

  yield {
    state: labelMatrix(
      'Fragment rules',
      [
        { id: 'lit', label: 'lit' },
        { id: 'cat', label: 'cat' },
        { id: 'alt', label: 'x | y' },
        { id: 'star', label: 'x*' },
        { id: 'accept', label: 'match' },
      ],
      [
        { id: 'node', label: 'new' },
        { id: 'outs', label: 'outs' },
      ],
      [
        ['char', 'next'],
        ['none', 'patch'],
        ['split', 'x+y'],
        ['split', 'loop'],
        ['accept', 'none'],
      ],
    ),
    highlight: { active: ['alt:node', 'star:outs'], found: ['cat:outs'] },
    explanation: 'The core data structure is a fragment: start plus outs. Concatenation is patching. Alternation and star create split states. This is why regex compilation feels like AST reduction plus linked-list patching.',
  };

  yield {
    state: nfaGraph('Compiled NFA for (ab|a)*c'),
    highlight: { active: ['repeat', 'alt', 'e-repeat-alt', 'e-repeat-c'], found: ['match'] },
    explanation: 'The star node can either enter another repetition or exit to c. The alternation node can choose the long branch ab or the short branch a. Those choices are eps edges: they consume no input.',
  };

  yield {
    state: pipelineGraph('The matcher carries a set, not a call stack', { nfa: 'graph', list: 'closure', match: 'linear' }),
    highlight: { active: ['nfa', 'list', 'e-nfa-list'], compare: ['match'] },
    explanation: 'At runtime the engine keeps the eps closure of active NFA states. For each input character, it takes every matching labeled edge from that set, then closes over eps edges again. No path is retried later because all paths move together.',
    invariant: 'One input character advances a whole frontier of possible states.',
  };

  yield {
    state: labelMatrix(
      'Engine tradeoffs',
      [
        { id: 'thompson', label: 'NFA' },
        { id: 'dfa', label: 'DFA' },
        { id: 'backtrack', label: 'BT' },
        { id: 'hybrid', label: 'hybrid' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'guarantee', label: 'bound' },
      ],
      [
        ['list', 'O(mn)'],
        ['table', 'O(n)'],
        ['stack', '2^n'],
        ['cache', 'capped'],
      ],
    ),
    highlight: { active: ['thompson:guarantee', 'hybrid:memory'], compare: ['backtrack:guarantee'] },
    explanation: 'Thompson simulation pays a small per-character cost for predictability. DFA matching can be faster after compilation, but the state table can grow. Production engines often combine these ideas with caches and resource limits.',
  };
}

function* epsilonClosureSimulation() {
  yield {
    state: nfaGraph('Start with the eps closure of start'),
    highlight: { active: ['start', 'repeat', 'alt', 'a1', 'a2', 'c', 'e-start-repeat', 'e-repeat-alt', 'e-repeat-c', 'e-alt-a1', 'e-alt-a2'], found: ['match'] },
    explanation: 'Before reading a character, the matcher follows every eps edge reachable from start. The active set contains all states where a real character could be consumed next: a1, a2, and c.',
    invariant: 'eps closure means: include every state reachable without consuming input.',
  };

  yield {
    state: closureTable(),
    highlight: { active: ['s0:closure', 's1:closure'], found: ['s3:closure'] },
    explanation: 'The table is the whole simulation. After each symbol move, the engine expands eps edges again. The set may contain many possible paths, but each state is listed once per step.',
  };

  yield {
    state: nfaGraph('Read a: both branches make progress'),
    highlight: { active: ['a1', 'a2', 'b1', 'repeat', 'alt', 'c', 'e-a1-b1', 'e-a2-repeat'], compare: ['match'] },
    explanation: 'The long branch consumes a and waits at b1. The short branch consumes a and loops back through repeat, which reopens the alternation and the exit-to-c path. Parallelism replaces guessing.',
  };

  yield {
    state: nfaGraph('Read b, then c reaches match'),
    highlight: { active: ['b1', 'repeat', 'c', 'match', 'e-b1-repeat', 'e-c-match'], found: ['match'] },
    explanation: 'After b, the engine is again at the closure around repeat and c. The final c transition enters match. The NFA accepted abc without ever choosing one branch and later regretting it.',
  };

  yield {
    state: pipelineGraph('Why this matters in production', { regex: 'user rule', nfa: 'safe core', list: 'bounded', match: 'service' }),
    highlight: { active: ['nfa', 'list', 'match'], compare: ['frag'] },
    explanation: 'Russ Cox popularized this lesson with tiny pathological regexes where backtracking engines stall but Thompson NFA simulation stays predictable. RE2 follows the same safety-first philosophy by rejecting constructs that require backtracking, such as backreferences and look-around.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fragment construction') yield* fragmentConstruction();
  else if (view === 'epsilon closure simulation') yield* epsilonClosureSimulation();
  else throw new InputError('Pick a Thompson NFA view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Regular expressions often sit on service boundaries: log filters, routing rules, validation checks, search boxes, security policies, and data pipelines. The input may be large, messy, or controlled by someone trying to waste your CPU.',
        'A Thompson NFA engine exists because a matcher should not turn a small ambiguous pattern into an exponential search. It compiles the pattern into a graph and scans the input with a bounded frontier of active states.',
        {type:'callout', text:'A Thompson engine avoids catastrophic guessing by turning regex ambiguity into a bounded frontier of active graph states.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The intuitive engine is recursive backtracking. For alternation, try the first branch and rewind if it fails. For `*`, take another repetition and later give one back if the suffix does not match. This maps directly to a recursive parser and is easy to extend with captures and look-around.',
        'The wall is repeated uncertainty. Ambiguous repetitions can make the engine revisit the same input position and pattern position through many different guess histories. A regex that looks small can create a search tree whose size grows exponentially with the input.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Do not guess one path. Keep all possible paths at once. Thompson construction turns regular syntax into an NFA whose split states represent choices, and the matcher carries a set of every state reachable after the input prefix read so far.',
        'A split is not a recursive call. It is two graph states in the same frontier. That one representation change turns backtracking search into repeated set update: close over eps edges, consume one character, close again.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In fragment construction, watch the compiler build small start-plus-outs fragments. The important state change is patching: dangling exits are wired into later fragments so concatenation and repetition become graph edges instead of runtime string surgery.',
        'In epsilon-closure simulation, watch the active set, not a single highlighted path. When the set grows, the engine has kept alternatives alive. When duplicate paths meet at the same state, they collapse to one entry, which is why the matcher does not retry the same state history later.',
        'The useful comparison is with a backtracking trace. Backtracking remembers a stack of guesses. Thompson simulation remembers a set of reachable states. When two guesses reach the same state after the same input prefix, the set representation merges them. That merge is the educational point because it explains both the safety bound and the loss of backreference-style features.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Compilation reduces each operator to a fragment. A literal creates a character-consuming state with a dangling exit. Concatenation patches the left fragment\'s outs to the right fragment\'s start. Alternation creates a split to two starts. Star creates a split that can enter the body or exit, then patches the body outs back to the split.',
        'Matching starts with the eps closure of the start state: every state reachable without consuming input. For each input character, the engine follows matching labeled edges from the current active set, then computes eps closure again. A state id appears at most once in a frontier.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is prefix reachability. After k characters, the active set contains exactly the NFA states reachable by consuming those k characters and any number of eps edges. The empty prefix starts with the eps closure of the start state.',
        'The step case follows every labeled edge that matches the next character, then closes over eps edges. That is exactly the transition rule for an NFA, so the simulation loses no valid path and invents no impossible one. Acceptance is simple: after the whole input, the match state is active.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For `(ab|a)*c` on `abc`, the start closure reaches the repetition split, the alternation split, both `a` states, and the exit-to-`c` state. Before reading input, the engine is already prepared for the long branch `ab`, the short branch `a`, or zero repetitions followed by `c`.',
        'After reading `a`, the long branch waits for `b`, while the short branch loops back to the repetition split and reopens the same choices. After `b`, the long branch also loops back. The final `c` reaches match. No branch is guessed and regretted; all live branches move together.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'For a pattern with m NFA states and input length n, straightforward Thompson simulation is O(mn). Each input character can scan a bounded frontier and traverse eps edges. Space is O(m) for the compiled graph plus current and next frontiers.',
        'The cost is steady rather than speculative. Backtracking can be faster on friendly cases and supports nonregular extensions, but its worst case can explode. A DFA can match in O(n), but full subset construction can create too many states, so production engines often use lazy DFA caches or hybrid strategies.',
        'Implementation quality still matters. Frontier sets should use generation counters, sparse sets, or bitsets so duplicate suppression is cheap. Epsilon closure should avoid revisiting the same state in one step. Character-class matching should be compiled into compact predicates or tables. The algorithm gives the bound, but the representation decides whether the bound is fast enough.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Thompson simulation wins when predictable resource use matters more than supporting every regex feature. User-supplied filters, service routing, policy matching, and log processing need a bound that survives adversarial input.',
        'It also gives a clean data-structure split. Fragments belong to compilation. Graph edges belong to the automaton. Active-state lists belong to execution. Keeping those roles separate makes the engine easier to test and reason about.',
        'For course design, this topic belongs after finite-state machines and before ReDoS. Students should first see that regex syntax becomes a graph, then see why active-state simulation keeps all regular alternatives without exponential guessing. Only then should they compare the features that safety-first engines reject.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The Thompson core handles regular constructs. Backreferences and general look-around depend on captured text or future context in ways that do not fit the same NFA simulation. Safety-first engines such as RE2 reject constructs that require backtracking.',
        'The O(mn) bound can still be too much for very large patterns, huge alphabets, or hot loops where a compact DFA table would fit. Captures, Unicode character classes, anchors, word boundaries, and submatch reporting add engineering work even when the core matching idea stays the same.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Forgetting eps closure is the common correctness bug. The engine will miss matches because it sees only character-consuming states and ignores choices that cost no input. Letting duplicate states accumulate is the common performance bug; the active frontier becomes a bag of histories instead of a set of states.',
        'A second failure is mixing parser, compiler, and matcher responsibilities. If runtime matching reparses pattern structure or mutates fragment wiring, it becomes hard to preserve the prefix-reachability invariant and hard to enforce resource limits.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Russ Cox, "Regular Expression Matching Can Be Simple And Fast" at https://swtch.com/~rsc/regexp/regexp1.html and the RE2 README at https://github.com/google/re2. RE2 documents the safety tradeoff: alternatives are evaluated in parallel, and features that require backtracking, including backreferences and look-around assertions, are not supported.',
        'Study finite state machines first, then subset construction from NFA to DFA. Study Regex Backtracking & ReDoS Case Study for the failure mode, UTF-8 Decoder DFA Case Study for table-driven deterministic matching, CSV Parser State Machine Case Study for parser boundaries, and Graph BFS for the frontier-set pattern.',
      ],
    },
  ],
};
