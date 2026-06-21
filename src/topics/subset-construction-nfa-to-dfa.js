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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/subset-construction-nfa-to-dfa.gif', alt: 'Animated walkthrough of the subset construction nfa to dfa visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An NFA is a compact way to represent many possible paths through a regular expression. A Thompson-style matcher can simulate those paths safely by carrying the whole active frontier after each input character.',
        {type: 'callout', text: 'Subset construction buys a one-edge scan loop by making each deterministic state remember a whole NFA frontier.'},
        'That is reliable, but it still does work during every scan. Lexers, tokenizers, protocol filters, and hot regexes often want the scan loop to be as small as possible: current state plus input byte gives next state.',
        'Subset construction moves work from matching time to construction time. It turns each reachable NFA frontier into one deterministic DFA state, so the runtime scanner no longer has to reason about eps edges or multiple active paths.',
      ],
    },
    {
      heading: 'The obvious approach and its limit',
      paragraphs: [
        'The direct approach is NFA simulation. Start with the eps closure of the NFA start state. For each input character, follow all matching labeled edges from the active set, then close over eps edges again.',
        'This approach is compact because the matcher stores only the NFA and the current frontier. It is also robust because it avoids backtracking explosions. The limit is repeated frontier computation.',
        'If the same frontier appears many times, the same move and closure calculation will be repeated many times. Subset construction names that frontier once and reuses the answer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A set of NFA states can itself be a state. If the NFA frontier after some input prefix is {R, A, L, S, C}, assign that set a DFA id such as D0. If reading a from D0 always leads to another set, assign that set D1 and store the transition D0 --a--> D1.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/DFAexample.svg', alt: 'Deterministic finite automaton state diagram with labeled transitions', caption: 'After subset construction, the scanner sees an ordinary DFA: one current state and one outgoing transition per input symbol. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:DFAexample.svg.'},
        'The data-structure move is interning. Represent each set with a canonical key, usually a bitset or sorted state-id list. A hash map turns that key into one stable DFA id. The queue explores only sets that have not been seen before.',
        'Deterministic does not mean the underlying language became simpler. It means the representation has one next state per symbol. The complexity was pushed into the state identity.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'The start DFA state is epsClosure(startNfaState). For each DFA state S and each input symbol c, compute move(S, c), then epsClosure of that move result. That closed set is the target DFA state.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Finite_state_machine_example_with_comments.svg', alt: 'Annotated finite state machine with states, transitions, and transition conditions', caption: 'Finite-state diagrams make the determinization contract visible: the current state and symbol fully determine the next state. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Finite_state_machine_example_with_comments.svg.'},
        'If the target set has no id yet, intern it, assign a new DFA state number, and enqueue it. Then record the transition from the source id on c to the target id. If the set is empty, send the transition to a dead state or leave it implicit depending on the engine design.',
        'A DFA state is accepting when its NFA-state set contains at least one accepting NFA state. If multiple accepting states are present, a lexer also needs priority rules such as earliest rule order or longest-match handling.',
      ],
    },
    {
      heading: 'Invariant and proof sketch',
      paragraphs: [
        'The invariant is prefix reachability. After reading any input prefix p, the DFA state names exactly the set of NFA states reachable after p.',
        'The start state satisfies the invariant because epsClosure(start) is exactly what the NFA can reach before consuming input. The transition step preserves it because move(S, c) follows all c-labeled edges out of the current reachable set, and epsClosure adds all zero-cost states reachable after consuming c.',
        'Acceptance follows immediately. If the current DFA set contains an accepting NFA state, then the NFA has at least one accepting path for the consumed input. If it does not, no active NFA path is accepting.',
      ],
    },
    {
      heading: 'Cost and blowup',
      paragraphs: [
        'A completed DFA scans in O(n) time for n input symbols, with one transition lookup per symbol. That is the reason DFAs are attractive for hot scanning workloads.',
        'The construction cost can be exponential. An NFA with m states has at most 2^m subsets, and some patterns really can force a large fraction of that space. Each reachable subset may need transitions across the alphabet or across compressed byte classes.',
        'Lazy construction changes the cost profile. Build a state only when the scanner reaches it, cache it if memory allows, and fall back to NFA simulation or evict cold DFA states when the cache hits its budget.',
      ],
    },
    {
      heading: 'Implementation details that matter',
      paragraphs: [
        'The set key should be cheap to compare and hash. Bitsets are fast for dense state numbers. Sorted vectors can be smaller for sparse frontiers. Either way, canonical representation is required; two equivalent sets must map to the same key.',
        'Eps closure should be cached or computed with care. A compiler can precompute closure for each NFA state and combine bitsets, or it can run graph search from the current move set. The right choice depends on NFA size and memory budget.',
        'The alphabet is usually compressed. Regex engines rarely build a separate transition for every Unicode scalar value. They group input bytes or characters into equivalence classes so many symbols share one transition column.',
        'Accepting-state priority also belongs in the state metadata. A lexer must know which rule won when a subset contains several accepting NFA states, otherwise determinization can preserve language membership while losing token-selection semantics.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins when a pattern is reused or the input is large enough to amortize construction. Lexers, tokenizers, network filters, log scanners, syntax highlighters, and high-throughput regex services all benefit from table-driven scanning.',
        'It is also the conceptual bridge behind hybrid engines. Thompson simulation is compact and predictable. DFA execution is fast once states exist. Lazy DFA caching combines them by determinizing hot frontiers and keeping a fallback for cold or explosive regions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Eager full construction is a bad default for arbitrary user-supplied patterns. The deterministic representation can be far larger than the NFA even though both accept the same language.',
        'Subset construction also does not support non-regular features such as backreferences. It can be part of a regex engine, but it only applies to the regular portion of the language.',
        'The failure mode in production is usually resource exhaustion, not mathematical incorrectness. Without limits on state count, transition-table size, cache memory, and compile time, determinization can become the expensive operation an attacker targets.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the state-sets view, read each DFA label as a named NFA frontier. D0 is not a single original NFA node; it is the whole eps-closed start set. D1 is the set reached after reading a.',
        'The matrix row for each D state is the deterministic transition table being built. The cells on a, b, and c are the result of move plus eps closure. Once a cell points to an interned set, future scans use that id directly.',
        'In the dfa-blowup view, the important contrast is between accepted language and representation size. The NFA and DFA recognize the same strings, but the DFA cache and table nodes show why engines need budgets and fallbacks.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Aho and Verma, Regular Expressions and Finite Automata lecture notes at https://www.cs.columbia.edu/~aho/cs3261/Lectures/L4-Regular_Expressions_and_Finite_Automata.html; Russ Cox, Regular Expression Matching Can Be Simple And Fast at https://swtch.com/~rsc/regexp/regexp1.html; and Google RE2 README at https://github.com/google/re2.',
        'Study Thompson NFA Regex Engine Case Study first, then Regex Backtracking & ReDoS Case Study for the contrasting execution model. Finite State Machines, Graph BFS, Hash Table, Stack, UTF-8 Decoder DFA Case Study, and Parser Design Patterns Primer provide the surrounding structures.',
      ],
    },
  ],
};
