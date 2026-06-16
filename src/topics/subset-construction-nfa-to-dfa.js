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
  yield {
    state: subsetGraph('A DFA state can be a whole NFA frontier'),
    highlight: { active: ['nfa', 'closure', 'move', 'key'], found: ['dfa'] },
    explanation: 'Subset construction makes an NFA deterministic by treating each eps-closed set of NFA states as one DFA state. The set becomes a cache key; the DFA transition table points from set to set.',
    invariant: 'Deterministic does not mean simpler internally; it means one next state per input symbol.',
  };

  yield {
    state: labelMatrix(
      'State-set conversion for (ab|a)*c',
      [
        { id: 'd0', label: 'D0' },
        { id: 'd1', label: 'D1' },
        { id: 'dm', label: 'DM' },
        { id: 'dead', label: 'dead' },
      ],
      [
        { id: 'nfa', label: 'set' },
        { id: 'a', label: 'on a' },
        { id: 'b', label: 'on b' },
        { id: 'c', label: 'on c' },
      ],
      [
        ['R,A,L,S,C', 'D1', 'dead', 'DM'],
        ['B,R,A,L,S,C', 'D1', 'D0', 'DM'],
        ['M', 'dead', 'dead', 'dead'],
        ['empty', 'dead', 'dead', 'dead'],
      ],
    ),
    highlight: { active: ['d0:a', 'd1:b', 'd1:c'], found: ['dm:nfa'] },
    explanation: 'The start set D0 contains every state reachable by eps edges. Reading a creates D1 because both alternatives in the NFA can be relevant. From D1, a loops, b returns to D0, and c accepts.',
  };

  yield {
    state: dfaGraph('The cached DFA has one edge per symbol'),
    highlight: { active: ['d0', 'd1', 'dm', 'e-d0-d1', 'e-d1-d0', 'e-d1-dm'], found: ['table'] },
    explanation: 'Once the state sets are interned, matching is simple table lookup. The runtime scanner no longer sees eps transitions or multiple active paths. It just moves D0, D1, DM, or dead.',
  };

  yield {
    state: labelMatrix(
      'Implementation data structures',
      [
        { id: 'work', label: 'queue' },
        { id: 'set', label: 'set' },
        { id: 'key', label: 'key' },
        { id: 'map', label: 'map' },
        { id: 'table', label: 'table' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'why', label: 'why' },
      ],
      [
        ['new sets', 'BFS'],
        ['NFA ids', 'frontier'],
        ['bitset', 'identity'],
        ['key->id', 'dedupe'],
        ['state x c', 'scan'],
      ],
    ),
    highlight: { active: ['work:job', 'map:why', 'table:why'], compare: ['key:job'] },
    explanation: 'The algorithm is graph search plus hash-consing. A queue explores newly discovered state sets; a hash map gives each unique set one stable DFA id; the transition table records the compiled result.',
  };

  yield {
    state: subsetGraph('Lazy construction builds only what input or cache pressure needs'),
    highlight: { active: ['cache', 'dfa', 'scan', 'e-cache-dfa'], compare: ['closure'] },
    explanation: 'Production engines often build DFA states lazily while scanning. If a state set is already cached, use it. If not, compute it from the NFA, store it if memory allows, and continue. This is the bridge between Thompson simulation and full DFA compilation.',
  };
}

function* dfaBlowup() {
  yield {
    state: labelMatrix(
      'Why full DFA construction can explode',
      [
        { id: 'n4', label: '4 states' },
        { id: 'n8', label: '8 states' },
        { id: 'n16', label: '16 states' },
        { id: 'n32', label: '32 states' },
      ],
      [
        { id: 'max', label: 'max subsets' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['16', 'small enough'],
        ['256', 'plausible'],
        ['65,536', 'watch memory'],
        ['4.3B', 'avoid eager'],
      ],
    ),
    highlight: { active: ['n16:max', 'n32:lesson'], compare: ['n8:max'] },
    explanation: 'The worst case is 2^m DFA states for m NFA states. Most real patterns do not reach all subsets, but a production engine must be designed as though someone will hand it the bad one.',
  };

  yield {
    state: subsetGraph('The blowup is a representation problem'),
    highlight: { active: ['key', 'cache', 'dfa'], compare: ['nfa'] },
    explanation: 'The language accepted by the NFA and DFA is the same. The risk is representation size: a compact NFA can describe a frontier space whose deterministic expansion is huge.',
    invariant: 'Equivalent automata can have very different memory costs.',
  };

  yield {
    state: labelMatrix(
      'Practical engine strategy',
      [
        { id: 'small', label: 'small' },
        { id: 'hot', label: 'hot' },
        { id: 'wide', label: 'wide' },
        { id: 'attack', label: 'attack' },
      ],
      [
        { id: 'strategy', label: 'plan' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['eager', 'budget'],
        ['lazy', 'evict'],
        ['classes', 'compress'],
        ['fallback', 'caps'],
      ],
    ),
    highlight: { active: ['hot:strategy', 'attack:strategy', 'attack:guard'], found: ['wide:strategy'] },
    explanation: 'Regex engines use engineering compromises: byte classes shrink alphabets, lazy DFA caches hot states, and a Thompson fallback preserves progress when the DFA cache would grow too large.',
  };

  yield {
    state: dfaGraph('A cached transition table is a data structure, not magic'),
    highlight: { active: ['table', 'd0', 'd1'], found: ['dm'], removed: ['dead'] },
    explanation: 'After construction, the DFA is just a transition table. That makes matching fast and debuggable, but the table needs memory budgets, eviction policy, and clear failure behavior if compilation exceeds limits.',
  };

  yield {
    state: labelMatrix(
      'How to choose the model',
      [
        { id: 'dfa', label: 'DFA' },
        { id: 'nfa', label: 'NFA' },
        { id: 'back', label: 'BT' },
        { id: 'hybrid', label: 'hybrid' },
      ],
      [
        { id: 'best', label: 'best' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hot text', 'blowup'],
        ['safety', 'const'],
        ['features', '2^n'],
        ['service', 'complex'],
      ],
    ),
    highlight: { active: ['dfa:best', 'nfa:best', 'hybrid:best'], compare: ['back:risk'] },
    explanation: 'Subset construction is the conceptual hinge. It explains why DFAs are fast, why NFAs are compact, why lazy hybrids exist, and why backtracking has such different failure modes.',
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
      heading: 'What it is',
      paragraphs: [
        'Subset construction converts an NFA into an equivalent DFA by making each DFA state represent a set of NFA states. If the NFA matcher would carry the active frontier {repeat, alt, a1, a2, c}, the DFA gives that whole set one state id such as D0.',
        'This is the data-structure bridge between elegant regex theory and fast production scanning. The algorithm uses eps closure, symbol moves, a work queue, a canonical set key, a hash map for interning, and a transition table for the finished DFA.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with epsClosure(NFA start). That set is the DFA start state. For each input symbol, move from every NFA state in the set along that symbol, then take eps closure of the result. If the resulting set has not been seen, assign it a new DFA id and enqueue it. Record the transition from the old DFA id to the new one.',
        'A set is accepting if it contains any accepting NFA state. A set is dead if it is empty or cannot reach acceptance for the relevant alphabet. The algorithm is essentially BFS over possible NFA frontiers, with a hash table preventing duplicate work.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For (ab|a)*c, the start closure is D0 = {repeat, alt, a1, a2, c}. On a, both a-labeled branches can move, producing D1 = {b1, repeat, alt, a1, a2, c}. From D1, b returns to D0 because the long branch ab has completed a repetition. From either D0 or D1, c reaches DM, the set containing match.',
        'That compact DFA now scans deterministically: D0 on a goes to D1, D1 on b goes to D0, and either D0 or D1 on c goes to DM. The original NFA choices disappeared into state-set names.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Full subset construction can create up to 2^m DFA states from m NFA states. That worst case is why production engines rarely build unbounded DFAs eagerly for arbitrary user patterns. Matching a completed DFA is O(n), but compilation memory can dominate.',
        'Lazy DFA construction computes state sets on demand and caches them. If the cache grows too large, the engine can evict cold states or fall back to Thompson NFA simulation. This keeps the performance benefit of DFA table lookup without pretending memory is infinite.',
      ],
    },
    {
      heading: 'Primary sources and study next',
      paragraphs: [
        'Primary sources: Aho and Verma, Regular Expressions and Finite Automata lecture notes at https://www.cs.columbia.edu/~aho/cs3261/Lectures/L4-Regular_Expressions_and_Finite_Automata.html; Russ Cox, Regular Expression Matching Can Be Simple And Fast at https://swtch.com/~rsc/regexp/regexp1.html; and Google RE2 README at https://github.com/google/re2.',
        'Study Thompson NFA Regex Engine Case Study first, then Regex Backtracking & ReDoS Case Study for the contrasting execution model. Finite State Machines, Graph BFS, Hash Table, Stack, UTF-8 Decoder DFA Case Study, and Parser Design Patterns Primer provide the surrounding structures.',
      ],
    },
  ],
};
