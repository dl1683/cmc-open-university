// Finite state machines: the simplest computer — a handful of states, one
// rule per (state, input) pair, no memory beyond "where am I". Yet this is
// how regex matches, how compilers read code, and how TCP connects.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'finite-state-machine',
  title: 'Finite State Machines',
  category: 'Concepts',
  summary: 'Walk a DFA matching the pattern ab*c, one character per step — regex demystified.',
  controls: [
    { id: 'input', label: 'Input string', type: 'select', options: ['abbbc (match)', 'ac (match)', 'abca (reject)', 'bc (reject)'], defaultValue: 'abbbc (match)' },
  ],
  run,
};

// The DFA for the regex ab*c over the alphabet {a, b, c}.
const STATES = [
  { id: 'S0', label: 'S0', x: 1.0, y: 4.6, note: 'start' },
  { id: 'S1', label: 'S1', x: 4.6, y: 2.6, note: 'reading b*' },
  { id: 'S2', label: 'S2', x: 8.4, y: 4.6, note: 'ACCEPT' },
  { id: 'R', label: 'R', x: 4.6, y: 8.0, note: 'trap' },
];
const EDGES = [
  { id: 'e01', from: 'S0', to: 'S1', weight: 'a' },
  { id: 'e12', from: 'S1', to: 'S2', weight: 'c' },
  { id: 'e0r', from: 'S0', to: 'R', weight: 'b,c' },
  { id: 'e1r', from: 'S1', to: 'R', weight: 'a' },
  { id: 'e2r', from: 'S2', to: 'R', weight: '*' },
];
const STEP_TABLE = {
  S0: { a: ['S1', 'e01'], b: ['R', 'e0r'], c: ['R', 'e0r'] },
  S1: { a: ['R', 'e1r'], b: ['S1', null], c: ['S2', 'e12'] },
  S2: { a: ['R', 'e2r'], b: ['R', 'e2r'], c: ['R', 'e2r'] },
  R: { a: ['R', null], b: ['R', null], c: ['R', null] },
};

export function* run(input) {
  const text = String(input.input).split(' ')[0];
  if (!/^[abc]+$/.test(text)) throw new InputError('Pick one of the listed strings.');

  const snapshot = () => graphState({ nodes: STATES, edges: EDGES });

  yield {
    state: snapshot(),
    highlight: { active: ['S0'], found: ['S2'] },
    explanation: 'This diagram IS the regex ab*c, compiled: a Deterministic Finite Automaton. Four states, and for every (state, character) pair exactly ONE move — no choices, no backtracking, no memory beyond "which circle am I standing in". S0 is the start, S2 (ACCEPT) means the pattern matched, R is the trap: once a string goes wrong, it can never recover. Self-loops (b at S1, everything at R) keep the machine in place.',
  };

  let state = 'S0';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const [next, edgeId] = STEP_TABLE[state][ch];
    const stayed = next === state;
    yield {
      state: snapshot(),
      highlight: { active: [next, ...(edgeId ? [edgeId] : [])], visited: stayed ? [] : [state] },
      explanation: `Read '${ch}' (character ${i + 1} of ${text.length}) while in ${state}: the table says ${stayed ? `STAY in ${state} — that's a self-loop${state === 'S1' ? ': b* means any number of b\'s, so S1 happily eats them' : ''}` : `move to ${next}${next === 'R' ? ' — the TRAP. \'' + ch + '\' broke the pattern, and no future character can fix it' : next === 'S2' ? " — the 'c' completes the pattern!" : ''}`}. One lookup, O(1), no matter how long the string is.`,
      invariant: 'The machine\'s entire knowledge is its current state — finite memory, by definition.',
    };
    state = next;
  }

  const accepted = state === 'S2';
  yield {
    state: snapshot(),
    highlight: accepted ? { found: ['S2'] } : { swap: [state] },
    explanation: `Input exhausted in state ${state}: "${text}" is ${accepted ? 'ACCEPTED — it matches ab*c' : `REJECTED — only S2 accepts, and we ended in ${state}`}. Total cost: ${text.length} table lookups — O(n), guaranteed, with zero backtracking. (Fancy regex engines with backreferences abandon this guarantee and can take EXPONENTIAL time on evil inputs — "catastrophic backtracking" — which is why grep and RE2 stick to pure automata.)`,
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'FSMs are everywhere once you have the lens: every regex engine compiles patterns into exactly this; a compiler\'s lexer is a DFA recognizing numbers, names, and strings (it\'s how your editor colors code); TCP\'s connection lifecycle is a famous state machine (LISTEN → SYN_SENT → ESTABLISHED…); game enemies patrol/chase/flee on one; and UI libraries model checkout flows as states to make illegal screens unrepresentable. It is the minimum viable computer — and the Trie (Prefix Tree) you already know is secretly one: each node a state, each letter a transition.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A finite state machine is the smallest useful model of computation: a finite set of states, a start state, accepting states, and a transition rule. The visualization shows a deterministic finite automaton for the pattern ab*c. It has S0 for the start, S1 for "after a, while eating b's," S2 for accept, and R for the trap. At each character there is exactly one next state, so one input string creates one path through the graph.`,
        `That "exactly one move" rule is what makes DFAs powerful. They have no Stack, no backtracking, and no memory except the current state. They cannot count arbitrary nesting, but they can scan streams at full speed. Finite State Machines are why simple regular expressions, protocol phases, UI flows, and game behaviors can be made predictable instead of ad hoc.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Implementation is just table lookup. Keep a current state, initially S0. For each character, index transition[state][character], jump, and continue. In this demo, 'a' from S0 goes to S1, 'b' from S1 loops in S1, and 'c' from S1 goes to S2. Anything impossible goes to R, and once R is reached the machine consumes the rest of the input while staying rejected.`,
        `A Trie (Prefix Tree) is the same shape applied to stored words: nodes are states, letters are transitions, and terminal nodes accept complete keys. Graph BFS becomes useful when you need to explore many possible active states, as in NFA simulation or reachability analysis. Tokenization (BPE) is a richer text pipeline, but it starts from the same discipline: consume a stream and maintain explicit state.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Matching costs O(n) for n input characters. Each character is read once, and each step is O(1). Space is O(S times A), where S is the number of states and A is the alphabet size, because every state-symbol pair needs a defined transition. Sparse tables can store only non-default edges. Backtracking regex engines that support features outside regular languages, such as backreferences, can take exponential time on adversarial patterns; automata-based engines like RE2 trade some expressiveness for predictable linear behavior.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Compilers use FSM-like lexers to turn characters into tokens such as NUMBER, IDENTIFIER, STRING, and PLUS. Editors use related scanners for syntax highlighting. TCP: Handshake & Congestion Control has a connection lifecycle that is a state machine: LISTEN, SYN_SENT, ESTABLISHED, FIN_WAIT, and TIME_WAIT describe which packets are legal. The Event Loop is not an FSM by itself, but browser runtimes use state machines to track timers, promises, worker lifecycles, and network requests.`,
        `Distributed systems use the idea too. Raft Leader Election moves servers among follower, candidate, and leader states. Topological Sort is not a state machine, but it helps reason about legal ordering when transitions must respect dependencies.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The trap state matters. If a transition is missing, the machine has not become flexible; it has silently rejected. This demo makes R visible so you can see that a bad prefix cannot be repaired by later characters. Another misconception is that a loop lets the machine count. The b* loop accepts any number of b's, but it does not remember how many there were.`,
        `Also separate the model from regex marketing. Many practical regex engines mix automata, NFAs, and backtracking features. A pure DFA gives linear matching because it never guesses. Once you add features that require remembering arbitrary text, you have left the finite-state world.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Trie (Prefix Tree) for character-labeled states, Graph BFS for exploring state graphs, and Tokenization (BPE) for a modern text-processing pipeline. TCP: Handshake & Congestion Control and Raft Leader Election show state machines governing systems where illegal transitions can break real networks. Topological Sort rounds out the ordering mindset: not every graph is an FSM, but every explicit state model benefits from clear transition rules.`,
      ],
    },
  ],
};
