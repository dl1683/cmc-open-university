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
    { heading: 'How to read the animation', paragraphs: [
        'Read the regex as a graph, not as a recursive program. Active states are NFA nodes reachable after the input prefix already consumed, and epsilon edges are moves that cost no input character.',
        'NFA means nondeterministic finite automaton, a graph that can have several possible next states. The safe inference rule is that after k input characters, the active set must contain exactly the states reachable by consuming those k characters and any number of epsilon moves.',
        {type:'callout', text:'A Thompson engine avoids catastrophic guessing by turning regex ambiguity into a bounded frontier of active graph states.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
        'Regular expressions sit on service boundaries: log filters, routing rules, validation checks, search boxes, security policies, and data pipelines. Inputs may be large, messy, or controlled by a user trying to waste CPU.',
        'A Thompson NFA engine exists because a small ambiguous pattern should not create an exponential runtime surprise. It compiles regular syntax into a graph and scans input with a bounded frontier of active states.',
      ],
    },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious engine is recursive backtracking. For alternation, try the first branch and rewind if it fails; for star, take another repetition and later give one back if the suffix does not match.',
        'This approach is easy to implement and easy to extend with captures, backreferences, and look-around. It also matches how many people mentally read a regex, which is one possible path at a time.',
      ],
    },
    { heading: 'The wall', paragraphs: [
        'The wall is repeated uncertainty. Ambiguous repetitions can make a backtracking engine revisit the same input position and pattern position through many different histories.',
        'A pattern such as (a?){20}a{20} on twenty a characters creates a large tree of choices about whether each optional a was used. The engine keeps guessing histories even though many histories reach the same state after the same input prefix.',
      ],
    },
    { heading: 'The core insight', paragraphs: [
        'The core insight is to keep all regular alternatives at once instead of guessing one path. Thompson construction turns regex operators into graph fragments, and the matcher carries a set of reachable graph states.',
        'A split state is not a recursive call. It adds two states to the frontier, and when two paths reach the same state after the same prefix, the set representation merges them into one entry.',
      ],
    },
    { heading: 'How it works', paragraphs: [
        'Compilation reduces each regex operator to a fragment. A literal creates a character-consuming state, concatenation patches one fragment into the next, alternation creates a split, and star creates a split that can enter the body or exit.',
        'Matching starts with the epsilon closure of the start state, which means every state reachable without consuming input. For each character, the engine follows matching labeled edges from the current active set, computes epsilon closure again, and suppresses duplicate state ids.',
      ],
    },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument is the prefix-reachability invariant. Before reading input, epsilon closure gives exactly the states reachable after consuming zero characters.',
        'For the next character, the engine follows exactly the labeled transitions that match and then adds every no-input transition reachable afterward. That is the NFA transition rule, so the simulation loses no valid path and invents no impossible path.',
      ],
    },
    { heading: 'Cost and complexity', paragraphs: [
        'For m NFA states and n input characters, straightforward Thompson simulation costs O(mn) time. Each character can examine a bounded frontier and traverse epsilon edges, while memory is O(m) for the graph plus current and next frontier sets.',
        'The cost is steady instead of speculative. Backtracking may be faster on friendly inputs and supports nonregular extensions, but its worst case can explode; a DFA can match in O(n), but building all DFA states can itself become too large.',
      ],
    },
    { heading: 'Real-world uses', paragraphs: [
        'Thompson simulation fits user-supplied filters, service routing, policy matching, search tools, and log processing where predictable resource use matters. RE2 is the production reference point for this safety-first design.',
        'The data-structure split is also useful in teaching and implementation. Parser, compiler fragments, NFA graph, frontier sets, and matcher loop each have a separate responsibility, which makes correctness easier to test.',
      ],
    },
    { heading: 'Where it fails', paragraphs: [
        'The Thompson core handles regular constructs. Backreferences and general look-around depend on captured text or future context in ways that do not fit the same finite-state simulation.',
        'The O(mn) bound can still be too much for huge patterns, hot loops, or large Unicode character-class machinery. Production engines need compact state sets, efficient epsilon closure, and careful character predicates to make the theoretical bound fast in practice.',
      ],
    },
    { heading: 'Worked example', paragraphs: [
        'Use pattern (ab|a)*c on input abc. Before reading input, epsilon closure reaches the star split, the alternation split, both a states, and the exit path to c, so the active set already represents zero repetitions, the short branch, and the long branch.',
        'After reading a, the long branch is waiting for b while the short branch loops back to the star split. After reading b, the long branch also loops back, reopening the same choices without duplicating the state already in the set.',
        'After reading c, the match state becomes active. If the NFA has 8 states and the input has 3 characters, a simple simulator performs at most about 24 state checks plus epsilon traversal, not a tree of guessed histories.',
      ],
    },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: Russ Cox, Regular Expression Matching Can Be Simple And Fast at https://swtch.com/~rsc/regexp/regexp1.html and the RE2 README at https://github.com/google/re2. RE2 documents the safety tradeoff: it avoids features that require backtracking, including backreferences and look-around assertions.',
        'Study finite-state machines first, then NFA to DFA subset construction, regex backtracking and ReDoS, UTF-8 decoder DFAs, parser state machines, and graph BFS. The shared idea is frontier simulation under an invariant.',
      ],
    },
  ],
};
