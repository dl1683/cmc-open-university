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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization builds a deterministic finite automaton (DFA) for the pattern ab*c, then feeds it several test strings one character at a time. Watch the highlighted node: it is the machine\'s entire memory. Each frame reads one input character, follows the matching arrow, and lands on the next state. When the input runs out, the machine checks whether it stopped on an accepting state (match) or anywhere else (reject).',
        'Pay attention to the trap state labeled R. Once the machine enters R, every future character loops back to R. That is how the machine encodes permanent failure without needing a separate error path for every bad prefix.',
        {type: 'image', src: './assets/gifs/finite-state-machine.gif', alt: 'Animated walkthrough of the finite state machine visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Software systems constantly need to track "where am I in a process." A network connection is listening, handshaking, established, or closing. A checkout flow is collecting shipping, collecting payment, confirming, or complete. A regex matcher is before the first character, inside a repeating section, accepted, or rejected. All of these share the same skeleton: a finite set of legal situations and a finite set of events that move between them. A finite state machine (FSM) is the name for that skeleton.',
        {type: 'callout', text: 'An FSM replaces scattered flags with one legal state and one explicit transition rule per event.'},
        'The value is visibility. Instead of spreading behavior across nested if-else chains, boolean flags, and callbacks, an FSM names every state and every legal transition in one place. You can audit it as a table: from state X, on event Y, go to state Z. If a transition is absent, the move is illegal. That single rule prevents entire classes of bugs where a system ends up in a combination of flags that should never exist.',
        'FSMs are also the smallest useful model of computation. They remember exactly one thing: the current state. That limitation is severe, but it is also why they are fast and easy to reason about. If the job fits inside a fixed amount of memory, an FSM is hard to beat.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach to tracking process state is imperative control flow. You declare boolean flags like isOpen, hasStarted, and isAuthenticated, then scatter if-checks across every handler that cares. For two or three flags this works. At five flags you have 32 possible combinations, most of which are illegal, and nobody can enumerate which ones are reachable.',
        'For pattern matching specifically, another tempting approach is backtracking: try one interpretation of the input, and if it fails, rewind and try another. This feels flexible, but the cost can explode when many choices overlap. Some regex engines have been crashed by carefully crafted inputs that force exponential backtracking.',
        'The FSM move is different. You make the hidden control state explicit by replacing all of those flags with a single state variable drawn from a known, finite set. You stop asking "which combination of booleans describes the system right now" and start asking "which named state is the system in." The second question has a smaller, auditable answer space.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The flag approach hits a wall when processes grow. A parser with 6 boolean flags has 64 combinations, and you need to verify that every handler transitions between valid ones. Adding one flag doubles the space. Bugs hide in the combinations you forgot to test, and they manifest as impossible states: a connection that is simultaneously open and closed, a form that is both loading and submitted.',
        'Backtracking hits a different wall. For the pattern (a|a)*b, a naive backtracking engine on a string of 25 a\'s without a trailing b will explore 2^25 paths, over 33 million, before giving up. The problem is that the engine cannot tell early that no path will work because it has no compiled summary of what the pattern actually requires.',
        'Both approaches fail for the same deep reason: they defer the work of understanding the structure to runtime. The FSM approach front-loads it. You compile the structure into a graph of states and transitions once, then runtime execution is a simple walk through that graph.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A deterministic finite automaton has exactly one next state for every combination of current state and input symbol. The transition table is the entire program. Running the program means one table lookup per input character: look up the row for the current state, find the column for the current character, read off the next state. There is no stack, no recursion, no memory beyond which state the machine currently occupies.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/DFAexample.svg/250px-DFAexample.svg.png', alt: 'Deterministic finite automaton accepting binary strings with an even number of zeros', caption: 'A DFA diagram makes the one-state-at-a-time rule visible through labeled transitions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:DFAexample.svg.'},
        'The power comes from compression. In the pattern ab*c, state S1 does not remember how many b characters have appeared. It only remembers that the required a has already been seen and that the machine is still allowed to consume more b characters before the final c. The exact count of b\'s is irrelevant to whether the string matches, so the machine discards it. Every state is a summary of all the histories that still have the same future behavior.',
        'The trap state is the ultimate compression. Once a string starts with b for this pattern, no future suffix can rescue it. Rather than tracking every distinct bad prefix, the machine collapses them all into one rejecting state R. That is why a DFA can be tiny even when the set of possible inputs is enormous.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A DFA is defined by five components: an alphabet (the set of input symbols), a set of states, one designated start state, a set of accepting states, and a transition function. The transition function maps every (state, symbol) pair to exactly one next state. After consuming the entire input string, the machine accepts if it ends in an accepting state and rejects otherwise.',
        'The animation\'s DFA recognizes the language ab*c over the alphabet {a, b, c}. State S0 is the start. Reading a from S0 moves to S1. From S1, reading b loops back to S1 (the b* part, meaning zero or more b\'s). Reading c from S1 moves to S2, the sole accepting state. Any character that violates the expected sequence sends the machine to R, the trap state, where it stays forever.',
        'Consider the input "abbc". The machine starts at S0, reads a and moves to S1, reads b and stays at S1, reads another b and stays at S1, reads c and moves to S2. The input is exhausted and S2 is accepting, so the string matches. Now consider "abba". After the same first three steps the machine is at S1. It reads a, which has no valid transition from S1 in the pattern, so it goes to R. Result: reject.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'FSMs work whenever the future behavior of a system depends only on a finite summary of the past, not on the full history. For ab*c, there are exactly four situations that matter: the machine has not yet seen the leading a (S0), it has seen the a and is in the b* region (S1), it has completed the full pattern (S2), or the prefix is already irrecoverable (R). No finer distinction changes what should happen next.',
        'This property is called the Myhill-Nerode equivalence. Two input histories are equivalent if, for every possible future continuation, both histories give the same accept/reject answer. If the number of equivalence classes is finite, a DFA exists. If it is infinite, no DFA can do the job. That is a precise boundary, not a judgment call.',
        'The same logic explains why lexers work. A lexer scanning source code does not need to remember every character of a number literal to decide whether the next character extends it. It needs a state like inNumber, inIdentifier, or inString. The state carries the information needed for the next transition. The actual text can be accumulated in a separate buffer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Running a DFA on an input of length n costs O(n) time. Each character triggers exactly one transition lookup. If the transition table is stored as a two-dimensional array indexed by state and symbol, each lookup is O(1). Total: n lookups, no backtracking, no branching that depends on input content.',
        'Memory for the table is O(S * A) where S is the number of states and A is the alphabet size. For the ab*c machine, that is 4 states times 3 symbols, 12 entries. For a byte-oriented scanner with 256 possible input values and 50 states, the table is 12,800 entries. At one byte each, that is about 12.5 KB, which fits comfortably in L1 cache.',
        'The cost that hides is construction. Converting a nondeterministic finite automaton (NFA) to a DFA via subset construction can produce up to 2^n states where n is the NFA state count. In practice this worst case is rare, but it means you should measure the compiled DFA size, not just the regex length, when evaluating whether the approach is viable.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every regex engine compiles patterns into automata. The safe ones (RE2, Rust\'s regex crate) build DFAs or lazily construct DFA states on demand, guaranteeing linear-time matching. Your text editor\'s syntax highlighter runs a lexer DFA to color keywords, strings, and comments. The TCP protocol\'s connection lifecycle (LISTEN, SYN_SENT, ESTABLISHED, FIN_WAIT, CLOSED) is a state machine defined in RFC 793.',
        'In UI engineering, libraries like XState model checkout flows, form wizards, and authentication sequences as explicit state machines. The benefit is that illegal screens become unrepresentable: you cannot show a payment form before shipping is complete because the transition does not exist. Game AI uses FSMs for enemy behavior, patrol/chase/flee, where each state has clear entry and exit conditions.',
        'At the hardware level, every digital circuit is a finite state machine. A traffic light controller cycles through green, yellow, red with timed transitions. A USB controller negotiates connection states. The FSM is not just a software pattern; it is the fundamental abstraction for any system with a finite number of configurations.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'FSMs cannot count without bound. Matching balanced parentheses like ((())), where nesting depth is unlimited, requires remembering the current depth. A DFA with k states can only count up to k, so for unbounded nesting you need a pushdown automaton (a state machine plus a stack). This is why HTML and JSON cannot be parsed by regular expressions alone.',
        'FSMs also fail when the machine is hidden. Many codebases contain implicit state machines: scattered booleans and conditionals that collectively implement state transitions, but with no transition table, no diagram, and no test that enumerates legal moves. That loses the main benefit. If a reviewer cannot answer "from this state, which events are legal," the FSM is only accidental, not intentional.',
        'A subtler failure is collapsing all errors into one trap state. In a text editor or network protocol, some errors are recoverable. A good machine distinguishes permanent rejection, recoverable error, timeout, and resynchronization as separate states. Lumping them together makes the machine simpler but throws away information the system needs to respond correctly.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build a DFA that accepts binary strings containing an even number of 0s. The alphabet is {0, 1}. You need two states: E (even count of 0s seen so far, including zero) and O (odd count). E is the start state and the only accepting state.',
        'Transition table: from E on input 1, stay at E (1 does not change the count). From E on input 0, move to O (count goes from even to odd). From O on input 1, stay at O. From O on input 0, move to E (count goes from odd back to even). That is the complete machine: 2 states, 4 transitions.',
        'Test it on the string "1001". Start at E. Read 1: stay at E. Read 0: move to O. Read 0: move to E. Read 1: stay at E. Final state is E, which is accepting. The string has two 0s (even), so the answer is correct. Now test "100". Start at E, read 1 (E), read 0 (O), read 0 (E). Accept. Three characters, one 0-pair, even count. Test "10": E, read 1 (E), read 0 (O). Reject. One zero is odd. Each test costs exactly n steps where n is the string length.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The canonical reference is Sipser\'s Introduction to the Theory of Computation, chapters 1 and 2, which proves the equivalence of DFAs, NFAs, and regular expressions. Hopcroft, Motwani, and Ullman\'s Introduction to Automata Theory covers DFA minimization and the Myhill-Nerode theorem. For practical regex engines, Cox\'s "Regular Expression Matching Can Be Simple And Fast" (2007, https://swtch.com/~rsc/regexp/regexp1.html) explains why DFA-based engines avoid catastrophic backtracking.',
        'On this site, study Trie (Prefix Tree) for character-labeled state graphs, Thompson NFA Regex Engine for nondeterministic execution, Subset Construction for compiling NFA state sets into DFA states, and CSV Parser State Machine for a small applied parser. For the broader computation hierarchy, compare with Pushdown Automata (FSM plus a stack) and Turing Machine (FSM plus an infinite tape).',
      ],
    },
  ],
};
