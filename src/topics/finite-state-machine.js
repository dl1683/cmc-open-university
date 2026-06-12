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
      heading: 'What it is',
      paragraphs: [
        `A finite state machine is a computational model consisting of a finite set of states, a starting state, one or more accepting states, and a transition function that maps each (state, input symbol) pair to exactly one next state. The two simplest and most useful flavors are DFAs (Deterministic Finite Automata), where every pair has one move and no lookahead, and NFAs (Nondeterministic Finite Automata), where a pair might have zero, one, or multiple moves and can "guess" freely. This visualization focuses on DFAs, which are what actually run inside grep, RE2, and most practical pattern matchers. The machine has no memory beyond which state it's in; it cannot pop a stack, rewind input, or remember how many times something happened. That simplicity is its strength.`,
        `The DFA for the regex ab*c has four states: S0 (start), S1 (consumed 'a', now reading b*), S2 (the 'c' arrived, accept), and R (trap: a wrong move, no escape). From each state, each input character has exactly one outgoing arrow. Once the machine enters the trap state R, it stays there; the input is doomed. There is one and only one path through the state graph for any given input, and that uniqueness is why DFAs guarantee O(n) matching time — the machine never has to try multiple paths or backtrack.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The matching algorithm is elementary: keep a current state (initially S0), and for each character in the input, look it up in a transition table — one row per state, one column per symbol — and jump to the next state. The table is a nested object or 2D array; lookup is O(1). In the ab*c DFA, reading 'a' from S0 jumps to S1; reading 'b' from S1 stays in S1 (self-loop, the * in b*); reading 'c' from S1 jumps to S2. Reading any 'a', 'b', or 'c' after reaching S2 jumps to trap R. When the input is exhausted, check the current state: if it's an accepting state (S2), the input matches; otherwise, it doesn't.`,
        `DFA construction usually happens offline, before any matching begins. A regex engine compiles the pattern into this table, then feeds strings through it in linear time. The Trie (Prefix Tree), which you likely know as a dictionary of strings, is secretly a DFA: each node is a state, each edge is labeled with a character, and leaf nodes mark the end of stored words. Both machines export the same interface to the world: given an input stream, accept or reject it, step by step.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time complexity is O(n), where n is the length of the input string. Each character triggers one table lookup (O(1)) and one state transition; no character is examined twice, no lookahead, no backtracking. Space for the transition table is O(k²) in the worst case, where k is the number of states, since we must store one entry for each (state, symbol) pair. For small alphabets (like {a, b, c}) and modest state counts (like 4 or 10), this table is tiny and fits in cache. Even a DFA for the full ASCII alphabet (256 symbols) compiled from a modest regex pattern stays compact. By contrast, regex engines that support backreferences (capturing groups and numbered back-references) must abandon the DFA model, use backtracking and recursion instead, and can hit EXPONENTIAL time on crafted inputs — the "catastrophic backtracking" attack. grep and RE2 sidestep this by forbidding backreferences and sticking to pure automata, trading expressiveness for bulletproof performance.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Lexical analysis (tokenization) in compilers and interpreters is the canonical use: a compiler's lexer is a single DFA (or a small bank of them) that reads characters and outputs tokens (NUMBER, IDENTIFIER, STRING, PLUS, etc.). When you type code and your editor highlights keywords in blue and strings in green, a DFA is usually doing the heavy lifting. Regular expression engines like grep, awk, and RE2 (Google's regex library, used in products like Kubernetes) compile patterns to DFAs or something DFA-adjacent to guarantee linear-time matching. In network protocols, the TCP connection state machine (CLOSED → LISTEN → SYN_RECEIVED → ESTABLISHED → FIN_WAIT_1 → … → TIME_WAIT) is a famous (if somewhat more complex) FSM: it governs which packets are valid at each phase and prevents illegal transitions. Game AI often uses FSMs: an enemy might be in states IDLE, PATROLLING, CHASING, ATTACKING, DYING, and the transitions depend on proximity and hit points. UI/UX flows — a checkout wizard, a navigation menu, a modal dialog — can be modeled as FSMs to ensure that illegal states are unreachable: you can't confirm an order without filling in an address; the code structure reflects the legal state space.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common beginner mistake is conflating DFAs with NFAs and thinking backtracking is free. It's not: backtracking (trying multiple possible moves) is exponential in the worst case and is why some regex engines are slow on adversarial input. DFAs have no choice to make, so they're fast; the cost is paid at compile time, not match time. Another trap is forgetting the trap state: if the machine has no arrow for a given (state, symbol) pair, it implicitly moves to a silent reject state. In this FSM, the trap state R is explicit and self-loops so the input is consumed even if it's already wrong. Beginners sometimes expect an FSM to "remember" how many times a loop ran or to backtrack if a later part fails; neither is possible. FSMs are memoryless (except for the current state). If you need to count matches or enforce dependencies across distant parts of the input, you need a more powerful model — a stack machine or a Turing machine. Finally, be wary of the term "state machine" in marketing: UI frameworks call their state management "state machines" even when they're really just objects mapping (state, event) to actions. True FSMs are mathematically defined and come with proofs; a loose metaphor is weaker.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To deepen your understanding, explore Trie (Prefix Tree), where you'll see FSM structure applied to dictionary storage and prefix search. Study Graph BFS to understand how to traverse state diagrams with multiple states active at once (useful when moving from DFAs to NFAs). Tokenization (BPE) shows how FSMs power text preprocessing in language models. For concurrency and distributed systems, Raft Leader Election is a modern state machine in disguise, coordinating a cluster via state transitions. Topological Sort reveals how to reason about dependencies in DAGs, a close cousin to FSM state ordering. Finally, return to the DFA visualization and watch a few more inputs to build intuition for how tight the O(n) guarantee really is.`,
      ],
    },
  ],
};

