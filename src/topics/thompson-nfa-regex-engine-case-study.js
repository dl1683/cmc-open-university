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
      heading: 'What it is',
      paragraphs: [
        'A Thompson NFA regex engine compiles a regular expression into a nondeterministic finite automaton and then simulates all possible paths in parallel. The pattern is no longer a string of metacharacters; it is a graph of literal states, split states, eps transitions, and one match state.',
        'The key data structures are fragments and active-state lists. During compilation, each subexpression becomes a fragment with a start state and dangling exits. During matching, the engine keeps the eps closure of active states, consumes one input character, and closes again.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a literal, create a state that consumes that character and leaves one dangling next pointer. For concatenation, patch the exits of the left fragment to the start of the right fragment. For alternation, create a split state that points to both alternatives. For star, create a split state that can enter the body or exit, and patch the body exits back to the split. Finally, patch remaining exits to a match state.',
        'At runtime, eps closure prevents recursive guessing. Start from the current active states, follow every eps edge until no new states appear, then consume the next character from all active literal states. The next active list is de-duplicated by state id. This keeps one frontier per input position instead of an exploding tree of choices.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For the pattern (ab|a)*c, the star split can either repeat another ab or a branch, or exit to c. On input abc, the first a advances both alternatives: the long branch waits for b while the short branch loops back and reopens the exit. After b, the frontier returns to the repeat closure. After c, the match state is active, so the input is accepted.',
        'This example is small, but the production lesson is large. The matcher never commits to the ab branch and then backtracks into the a branch. Both possibilities stay in the active set at the same time. That is why Thompson simulation has predictable behavior on patterns that make recursive backtracking engines thrash.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For a pattern with m NFA states and input length n, straightforward Thompson simulation is O(mn): each input character can inspect the active state list and traverse eps closures. Space is O(m) for the active and next state lists. A DFA can reduce matching to O(n), but full subset construction may create exponentially many DFA states in the worst case.',
        'Backtracking engines often run quickly on friendly inputs, but their worst case can be exponential because they explore alternatives one at a time. Thompson-style engines spend steadier work per character and trade some expressiveness for predictable resource use.',
      ],
    },
    {
      heading: 'Primary sources and study next',
      paragraphs: [
        'Primary sources: Russ Cox, Regular Expression Matching Can Be Simple And Fast at https://swtch.com/~rsc/regexp/regexp1.html; Google RE2 README at https://github.com/google/re2; and Aho and Verma, Regular Expressions and Finite Automata lecture notes at https://www.cs.columbia.edu/~aho/cs3261/Lectures/L4-Regular_Expressions_and_Finite_Automata.html.',
        'Study Finite State Machines first for deterministic matching, then Subset Construction: NFA to DFA for the state-set conversion. Regex Backtracking & ReDoS Case Study shows what goes wrong when choices are stored as a recursive stack. Stack, Graph BFS, Hash Table, UTF-8 Decoder DFA Case Study, CSV Parser State Machine Case Study, and Parser Design Patterns Primer are the surrounding data-structure vocabulary.',
      ],
    },
  ],
};
