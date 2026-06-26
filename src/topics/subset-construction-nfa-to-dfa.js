// Subset construction: every DFA state is a set of NFA states, usually created
// lazily so a regex engine only materializes states it actually reaches.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'subset-construction-nfa-to-dfa',
  title: 'Subset Construction: NFA to DFA',
  category: 'Concepts',
  summary: 'Turn an NFA active-state frontier into deterministic DFA states: eps closure, move by symbol, intern the resulting set, and cache transitions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['state sets', 'dfa blowup'], defaultValue: 'state sets' },
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

function subsetGraph(title) {
  return graphState({
    nodes: [
      { id: 'nfa', label: 'NFA', x: 0.7, y: 4.0, note: 'many paths' },
      { id: 'closure', label: 'closure', x: 2.5, y: 2.5, note: 'eps' },
      { id: 'move', label: 'move', x: 2.5, y: 5.5, note: 'by char' },
      { id: 'key', label: 'key', x: 4.4, y: 4.0, note: 'sorted ids' },
      { id: 'cache', label: 'cache', x: 6.2, y: 4.0, note: 'hash map' },
      { id: 'dfa', label: 'DFA', x: 8.0, y: 4.0, note: 'one edge' },
      { id: 'scan', label: 'scan', x: 9.4, y: 4.0, note: 'O(n)' },
    ],
    edges: [
      { id: 'e-nfa-closure', from: 'nfa', to: 'closure', weight: '' },
      { id: 'e-closure-move', from: 'closure', to: 'move', weight: '' },
      { id: 'e-move-key', from: 'move', to: 'key', weight: '' },
      { id: 'e-key-cache', from: 'key', to: 'cache', weight: '' },
      { id: 'e-cache-dfa', from: 'cache', to: 'dfa', weight: '' },
      { id: 'e-dfa-scan', from: 'dfa', to: 'scan', weight: '' },
    ],
  }, { title });
}

function dfaGraph(title) {
  return graphState({
    nodes: [
      { id: 'd0', label: 'D0', x: 1.0, y: 4.0, note: 'start set' },
      { id: 'd1', label: 'D1', x: 3.5, y: 2.5, note: 'after a' },
      { id: 'dm', label: 'DM', x: 6.2, y: 4.0, note: 'match' },
      { id: 'dead', label: 'dead', x: 3.5, y: 6.2, note: 'reject' },
      { id: 'table', label: 'table', x: 8.7, y: 4.0, note: 'cached' },
    ],
    edges: [
      { id: 'e-d0-d1', from: 'd0', to: 'd1', weight: 'a' },
      { id: 'e-d0-dm', from: 'd0', to: 'dm', weight: 'c' },
      { id: 'e-d1-d1', from: 'd1', to: 'd1', weight: 'a' },
      { id: 'e-d1-d0', from: 'd1', to: 'd0', weight: 'b' },
      { id: 'e-d1-dm', from: 'd1', to: 'dm', weight: 'c' },
      { id: 'e-d0-dead', from: 'd0', to: 'dead', weight: 'b' },
      { id: 'e-dead-table', from: 'dead', to: 'table', weight: '' },
      { id: 'e-dm-table', from: 'dm', to: 'table', weight: '' },
    ],
  }, { title });
}

function* stateSets() {
  const hl1 = { active: ['nfa', 'closure', 'move', 'key'], found: ['dfa'] };
  yield {
    state: subsetGraph('A DFA state can be a whole NFA frontier'),
    highlight: hl1,
    explanation: `Subset construction makes an NFA deterministic by treating each eps-closed set of ${hl1.active.length} NFA-side components (${hl1.active.join(', ')}) as one DFA state. The set becomes a cache key; the DFA transition table points from set to set, producing ${hl1.found.length} deterministic output (${hl1.found.join(', ')}).`,
    invariant: 'Deterministic does not mean simpler internally; it means one next state per input symbol.',
  };

  const rows2 = [
    { id: 'd0', label: 'D0' },
    { id: 'd1', label: 'D1' },
    { id: 'dm', label: 'DM' },
    { id: 'dead', label: 'dead' },
  ];
  const cols2 = [
    { id: 'nfa', label: 'set' },
    { id: 'a', label: 'on a' },
    { id: 'b', label: 'on b' },
    { id: 'c', label: 'on c' },
  ];
  const hl2 = { active: ['d0:a', 'd1:b', 'd1:c'], found: ['dm:nfa'] };
  yield {
    state: labelMatrix(
      'State-set conversion for (ab|a)*c',
      rows2,
      cols2,
      [
        ['R,A,L,S,C', 'D1', 'dead', 'DM'],
        ['B,R,A,L,S,C', 'D1', 'D0', 'DM'],
        ['M', 'dead', 'dead', 'dead'],
        ['empty', 'dead', 'dead', 'dead'],
      ],
    ),
    highlight: hl2,
    explanation: `The ${rows2.length}x${cols2.length} table maps ${rows2.length} DFA states (${rows2.map(r => r.label).join(', ')}) across ${cols2.length} columns. ${hl2.active.length} transition cells are highlighted (${hl2.active.join(', ')}); the start set D0 contains every state reachable by eps edges. Reading a creates D1 because both alternatives in the NFA can be relevant. From D1, a loops, b returns to D0, and c accepts.`,
  };

  const hl3 = { active: ['d0', 'd1', 'dm', 'e-d0-d1', 'e-d1-d0', 'e-d1-dm'], found: ['table'] };
  const hl3Nodes = hl3.active.filter(id => !id.startsWith('e-'));
  const hl3Edges = hl3.active.filter(id => id.startsWith('e-'));
  yield {
    state: dfaGraph('The cached DFA has one edge per symbol'),
    highlight: hl3,
    explanation: `Once the state sets are interned, matching is simple table lookup across ${hl3Nodes.length} active nodes (${hl3Nodes.join(', ')}) and ${hl3Edges.length} edges. The runtime scanner no longer sees eps transitions or multiple active paths. It just moves ${hl3Nodes.join(', ')}, or dead, landing results in ${hl3.found.join(', ')}.`,
  };

  const rows4 = [
    { id: 'work', label: 'queue' },
    { id: 'set', label: 'set' },
    { id: 'key', label: 'key' },
    { id: 'map', label: 'map' },
    { id: 'table', label: 'table' },
  ];
  const cols4 = [
    { id: 'job', label: 'job' },
    { id: 'why', label: 'why' },
  ];
  const hl4 = { active: ['work:job', 'map:why', 'table:why'], compare: ['key:job'] };
  yield {
    state: labelMatrix(
      'Implementation data structures',
      rows4,
      cols4,
      [
        ['new sets', 'BFS'],
        ['NFA ids', 'frontier'],
        ['bitset', 'identity'],
        ['key->id', 'dedupe'],
        ['state x c', 'scan'],
      ],
    ),
    highlight: hl4,
    explanation: `The algorithm uses ${rows4.length} data structures (${rows4.map(r => r.label).join(', ')}) tracked across ${cols4.length} columns. ${hl4.active.length} cells are active (${hl4.active.join(', ')}), with ${hl4.compare.length} compared (${hl4.compare.join(', ')}). A queue explores newly discovered state sets; a hash map gives each unique set one stable DFA id; the transition table records the compiled result.`,
  };

  const hl5 = { active: ['cache', 'dfa', 'scan', 'e-cache-dfa'], compare: ['closure'] };
  const hl5Nodes = hl5.active.filter(id => !id.startsWith('e-'));
  const hl5Edges = hl5.active.filter(id => id.startsWith('e-'));
  yield {
    state: subsetGraph('Lazy construction builds only what input or cache pressure needs'),
    highlight: hl5,
    explanation: `Production engines often build DFA states lazily while scanning across ${hl5Nodes.length} active nodes (${hl5Nodes.join(', ')}) and ${hl5Edges.length} edge (${hl5Edges.join(', ')}), comparing against ${hl5.compare.length} earlier stage (${hl5.compare.join(', ')}). If a state set is already cached, use it. If not, compute it from the NFA, store it if memory allows, and continue. This is the bridge between Thompson simulation and full DFA compilation.`,
  };
}

function* dfaBlowup() {
  const rows1 = [
    { id: 'n4', label: '4 states' },
    { id: 'n8', label: '8 states' },
    { id: 'n16', label: '16 states' },
    { id: 'n32', label: '32 states' },
  ];
  const cols1 = [
    { id: 'max', label: 'max subsets' },
    { id: 'lesson', label: 'lesson' },
  ];
  const data1 = [
    ['16', 'small enough'],
    ['256', 'plausible'],
    ['65,536', 'watch memory'],
    ['4.3B', 'avoid eager'],
  ];
  const hl1 = { active: ['n16:max', 'n32:lesson'], compare: ['n8:max'] };
  yield {
    state: labelMatrix('Why full DFA construction can explode', rows1, cols1, data1),
    highlight: hl1,
    explanation: `The worst case is 2^m DFA states for m NFA states. This ${rows1.length}x${cols1.length} table shows ${rows1.length} NFA sizes (${rows1.map(r => r.label).join(', ')}), with ${hl1.active.length} cells highlighted and ${hl1.compare.length} compared (${hl1.compare.join(', ')}). Most real patterns do not reach all subsets, but a production engine must be designed as though someone will hand it the bad one.`,
  };

  const hl2 = { active: ['key', 'cache', 'dfa'], compare: ['nfa'] };
  yield {
    state: subsetGraph('The blowup is a representation problem'),
    highlight: hl2,
    explanation: `The language accepted by the NFA and DFA is the same, yet ${hl2.active.length} downstream nodes (${hl2.active.join(', ')}) expand from ${hl2.compare.length} compact source (${hl2.compare.join(', ')}). The risk is representation size: a compact NFA can describe a frontier space whose deterministic expansion is huge.`,
    invariant: 'Equivalent automata can have very different memory costs.',
  };

  const rows3 = [
    { id: 'small', label: 'small' },
    { id: 'hot', label: 'hot' },
    { id: 'wide', label: 'wide' },
    { id: 'attack', label: 'attack' },
  ];
  const cols3 = [
    { id: 'strategy', label: 'plan' },
    { id: 'guard', label: 'guard' },
  ];
  const hl3 = { active: ['hot:strategy', 'attack:strategy', 'attack:guard'], found: ['wide:strategy'] };
  yield {
    state: labelMatrix('Practical engine strategy', rows3, cols3, [
      ['eager', 'budget'],
      ['lazy', 'evict'],
      ['classes', 'compress'],
      ['fallback', 'caps'],
    ]),
    highlight: hl3,
    explanation: `Regex engines use ${rows3.length} engineering strategies (${rows3.map(r => r.label).join(', ')}) across ${cols3.length} dimensions. ${hl3.active.length} cells are active (${hl3.active.join(', ')}), with ${hl3.found.length} found (${hl3.found.join(', ')}): byte classes shrink alphabets, lazy DFA caches hot states, and a Thompson fallback preserves progress when the DFA cache would grow too large.`,
  };

  const hl4 = { active: ['table', 'd0', 'd1'], found: ['dm'], removed: ['dead'] };
  yield {
    state: dfaGraph('A cached transition table is a data structure, not magic'),
    highlight: hl4,
    explanation: `After construction, the DFA is just a transition table. ${hl4.active.length} nodes are active (${hl4.active.join(', ')}), ${hl4.found.length} accepting (${hl4.found.join(', ')}), and ${hl4.removed.length} pruned (${hl4.removed.join(', ')}). That makes matching fast and debuggable, but the table needs memory budgets, eviction policy, and clear failure behavior if compilation exceeds limits.`,
  };

  const rows5 = [
    { id: 'dfa', label: 'DFA' },
    { id: 'nfa', label: 'NFA' },
    { id: 'back', label: 'BT' },
    { id: 'hybrid', label: 'hybrid' },
  ];
  const cols5 = [
    { id: 'best', label: 'best' },
    { id: 'risk', label: 'risk' },
  ];
  const hl5 = { active: ['dfa:best', 'nfa:best', 'hybrid:best'], compare: ['back:risk'] };
  yield {
    state: labelMatrix('How to choose the model', rows5, cols5, [
      ['hot text', 'blowup'],
      ['safety', 'const'],
      ['features', '2^n'],
      ['service', 'complex'],
    ]),
    highlight: hl5,
    explanation: `Subset construction is the conceptual hinge across ${rows5.length} execution models (${rows5.map(r => r.label).join(', ')}). ${hl5.active.length} strengths are highlighted (${hl5.active.join(', ')}), with ${hl5.compare.length} risk flagged (${hl5.compare.join(', ')}). It explains why DFAs are fast, why NFAs are compact, why lazy hybrids exist, and why backtracking has such different failure modes.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'state sets') yield* stateSets();
  else if (view === 'dfa blowup') yield* dfaBlowup();
  else throw new InputError('Pick a subset construction view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each DFA label as a set of NFA states. An NFA, or nondeterministic finite automaton, may have several active states after one input prefix; a DFA, or deterministic finite automaton, has exactly one current state. The animation names each reachable NFA set as one DFA state.',
        'The active set is the frontier after the input consumed so far. A transition cell is computed by moving on one symbol and then following epsilon edges, which consume no input. The safe inference is that two equal sets are the same DFA state and should be reused, not rebuilt.',
        {type: 'image', src: './assets/gifs/subset-construction-nfa-to-dfa.gif', alt: 'Animated walkthrough of the subset construction nfa to dfa visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Regular expressions are often compiled through NFAs because NFAs are compact and easy to build from regex syntax. A Thompson NFA can represent alternation, optional parts, and repetition with epsilon edges. At runtime, an NFA simulator keeps a set of active states instead of one state.',
        {type: 'callout', text: 'Subset construction buys a one-edge scan loop by making each deterministic state remember a whole NFA frontier.'},
        'Subset construction exists when scanning speed matters enough to move work into compilation. Lexers, tokenizers, protocol filters, and hot regular expressions prefer a loop where current state plus input byte gives the next state. The compiled DFA stores the frontier work once so the scanner does not repeat it for every input.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is direct NFA simulation. Start with the epsilon closure of the start state, read the next symbol, follow every matching edge from every active state, and close over epsilon edges again. This is predictable and avoids the exponential backtracking failures of naive regex engines.',
        'The approach is still doing set work on every input character. If the same frontier appears thousands of times in a log stream, move and closure are recomputed thousands of times. The representation is compact, but the scan loop is heavier than a DFA table lookup.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated frontier computation. A lexer may scan megabytes of source code with the same few regex frontiers appearing again and again. Spending CPU to rebuild those frontiers during every scan wastes the fact that the transition result is deterministic once the set is known.',
        'The other wall is that eager determinization can explode. An NFA with m states has at most 2^m subsets, and some patterns really reach many of them. The technique is useful only when the reachable subset graph fits the memory budget or is built lazily.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A set of NFA states can be treated as one DFA state. If the active NFA frontier is {0, 1, 3}, name that set D0. For each input symbol, compute the next frontier once, intern it with a canonical key, and store the transition from D0.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/DFAexample.svg', alt: 'Deterministic finite automaton state diagram with labeled transitions', caption: 'After subset construction, the scanner sees an ordinary DFA: one current state and one outgoing transition per input symbol. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:DFAexample.svg.'},
        'Determinism is cached nondeterminism. The DFA state identity remembers all NFA paths that could still matter. Once that set has a name, the runtime scanner can ignore the internal branching.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Compute epsilonClosure(start) and assign it the first DFA id. Then process unexpanded DFA states from a queue. For each alphabet symbol, compute move(S, c), close the result under epsilon edges, intern that set, and record the transition.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Finite_state_machine_example_with_comments.svg', alt: 'Annotated finite state machine with states, transitions, and transition conditions', caption: 'Finite-state diagrams make the determinization contract visible: the current state and symbol fully determine the next state. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Finite_state_machine_example_with_comments.svg.'},
        'A DFA state is accepting if its set contains any accepting NFA state. In a lexer, the state must also record rule priority and longest-match information when several accepting NFA states are present. The set key is usually a bitset for dense state numbers or a sorted vector for sparse frontiers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is prefix reachability. After reading any input prefix p, the current DFA state names exactly the NFA states reachable after p. The start state satisfies this because epsilonClosure(start) is exactly what the NFA can reach before consuming input.',
        'The transition step preserves the invariant. move(S, c) follows all c-labeled NFA edges out of the reachable set, and epsilon closure adds every zero-cost state reachable afterward. Acceptance is therefore identical: the DFA accepts exactly when the named set contains an accepting NFA state.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A completed DFA scans n input symbols in O(n) time with one transition lookup per symbol. If the input doubles, scanning work doubles. This is the behavior lexers want: scan cost follows input length, not regex branching.',
        'Construction can cost O(2^m) states for an m-state NFA, with transitions multiplied by the alphabet size or by compressed character classes. Lazy construction changes behavior by building only states that the input reaches and caching hot ones. The memory tax is the reason production engines set budgets and keep an NFA fallback.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Compilers use DFA-style scanners for tokenization because source files are read many times and token rules are reused. Network filters and log scanners use the same pattern when many bytes flow through a small set of regular languages. Syntax highlighters and protocol parsers often use table-driven finite-state loops for predictable latency.',
        'Hybrid regex engines use subset construction selectively. They simulate NFAs for compactness, determinize hot frontiers for speed, and evict or refuse states when a pattern would blow up. The access pattern is repeated scanning where compiled-state reuse pays for the build cost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Full subset construction is a bad default for arbitrary user-supplied patterns. A small NFA can generate a huge DFA, and an attacker can target that compile-time memory. Engines need state limits, lazy construction, alphabet compression, or fallback execution.',
        'The method also applies only to regular language features. Backreferences, some lookaround semantics, and captures with complex side effects are not represented by a plain finite automaton. Determinization can preserve language membership but still lose token priority if accepting metadata is not carried with each subset.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take an NFA for a(b|c). State 0 has an a edge to 1, state 1 has epsilon edges to 2 and 4, state 2 has b to 3, state 4 has c to 5, and states 3 and 5 are accepting. The start DFA state is D0 = {0}.',
        'On input a, move({0}, a) gives {1}, and epsilon closure gives {1,2,4}, so D1 = {1,2,4}. From D1 on b, the move reaches {3}, so D2 = {3} and it accepts. From D1 on c, the move reaches {5}, so D3 = {5} and it accepts.',
        'The DFA has four useful states: D0, D1, D2, and D3, plus an optional dead state for missing transitions. Scanning ac walks D0 --a--> D1 --c--> D3 and accepts in two table lookups. The NFA would have kept the same frontier information at runtime instead of storing it in states.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the automata construction in Aho, Lam, Sethi, and Ullman, "Compilers: Principles, Techniques, and Tools," and compare it with Russ Cox, "Regular Expression Matching Can Be Simple And Fast." RE2 documentation is useful for production constraints around predictable regular-expression execution.',
        'Study Thompson NFA construction first, then finite-state machines, bitsets, hash tables, and lexer longest-match rules. After this topic, study ReDoS backtracking failures and lazy DFA caching to see why determinization is both a speed tool and a resource risk.',
      ],
    },
  ],
};