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
      heading: 'Why this exists',
      paragraphs: [
        'Finite state machines exist for systems that should only occupy one legal situation at a time. A regex matcher is either before the first character, inside the repeating section, accepted, or rejected. A protocol is listening, handshaking, established, closing, or failed. A checkout flow is collecting shipping, collecting payment, confirming, complete, or canceled. The common structure is not the domain. It is the finite set of legal states and the finite set of events that move between them.',
        {type: 'callout', text: 'An FSM replaces scattered flags with one legal state and one explicit transition rule per event.'},
        'This model is valuable because it makes control visible. Instead of scattering behavior across conditionals, booleans, callbacks, and implicit flags, an FSM names each state and names each legal transition. That gives readers a table they can audit: from this state, on this input, what happens next? If a transition is absent, the move is illegal. That single idea prevents a large class of bugs.',
        'FSMs are also the smallest useful model of computation. They remember exactly one thing: the current state. That limitation is severe, but it is also the source of their speed and clarity. If the job fits inside finite memory, an FSM is hard to beat.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is imperative control flow. You write if statements, set flags like isOpen and hasStarted, and hope every handler checks the right combination. This works for tiny examples, but it does not scale. Illegal combinations become possible: a connection can look open and closed, a UI can look loading and submitted, a parser can look both inside and outside a quoted string.',
        'The second tempting approach is backtracking. For pattern matching, you can try one interpretation, rewind if it fails, and try another. That feels flexible, but it can become catastrophically expensive when many choices overlap. A deterministic finite automaton takes the opposite bet: compile the choices into states so runtime matching is one transition per character.',
        'The FSM move is to make the hidden control state explicit. You stop asking many booleans what the system might be doing and instead ask one state variable where the system is. That is a simpler question with a smaller answer space.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that a deterministic finite machine has one next state for each pair of current state and input symbol. The transition table is the program. Running the program means repeatedly doing a table lookup: state plus character gives next state. There is no stack, no recursive call, no remembered history except whatever the current state already summarizes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/DFAexample.svg/250px-DFAexample.svg.png', alt: 'Deterministic finite automaton accepting binary strings with an even number of zeros', caption: 'A DFA diagram makes the one-state-at-a-time rule visible through labeled transitions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:DFAexample.svg.'},
        'That summary is the trick. In the regex ab*c, state S1 does not remember how many b characters have appeared. It only remembers that the input has already seen the required a and is still allowed to consume b characters before the final c. The exact count does not matter for the language, so the machine throws it away.',
        'The trap state matters because not every bad prefix deserves special handling. Once a string begins with b for this pattern, no future suffix can repair it. The trap state represents all irrecoverable histories in one place. That compression is why finite automata can be tiny even when they summarize many possible prefixes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A deterministic finite automaton is defined by an alphabet, a set of states, one start state, a set of accepting states, and a transition function. The transition function is often written as a table. For every current state and input symbol, it returns the next state. After consuming the full input, the machine accepts if it is in an accepting state and rejects otherwise.',
        'The animation uses a DFA for ab*c over the alphabet a, b, c. S0 is the start. Reading a moves to S1. S1 has a self-loop on b because b* means any number of b characters. Reading c from S1 moves to S2, the accepting state. Anything that violates the pattern moves to R, the trap state. Once in R, every later character stays in R.',
        'This is exactly why DFA execution is predictable. The machine never asks "what if I had chosen differently?" because there was no choice at runtime. If nondeterminism exists in a higher-level regex or NFA, it can often be compiled away through subset construction, where a DFA state represents a set of possible NFA states.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The visual proves that pattern matching can be a fixed-cost state walk. Each frame consumes one character and follows one transition. The graph is not an illustration next to the algorithm; it is the compiled algorithm. The current node is all the memory the machine has.',
        'The accepting state proves that matching is about the entire consumed input, not just reaching a promising intermediate point. A string like abca reaches the accept state after abc, then the extra a pushes it into rejection. That is correct because ab*c describes complete strings in this demo, not substrings inside a larger string.',
        'The trap state proves the value of irreversible failure. Instead of carrying many different bad prefixes, the machine collapses them into one rejecting state. That is the same engineering pattern used in validators, scanners, and protocol implementations: summarize histories by what future behavior is still possible.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'FSMs work when the future only depends on a finite summary of the past. For ab*c, the only questions that matter are whether the required a has appeared, whether the machine is still reading the b* region, whether the final c has closed the pattern, or whether the prefix is already impossible. Those four summaries are the states.',
        'This is the same reason lexers work. A lexer does not need to remember every character of a number while deciding whether the next character is still part of the number. It needs a state such as inNumber, inIdentifier, inString, or error. The state carries the information needed for the next transition, while token text can be accumulated separately.',
        'The method also works socially. A state diagram gives programmers, reviewers, and operators a shared object to inspect. That matters in production systems where behavior is often wrong not because one condition is hard, but because nobody knows which combinations of conditions are legal.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Running a DFA over n input symbols costs O(n). Each step is one transition lookup. With a dense table, memory costs O(states * alphabet). With sparse maps and default transitions, memory can be much smaller. For byte-oriented machines, the table may be large but cache-friendly; for token-oriented machines, a map or switch can be easier to maintain.',
        'The tradeoff is expressiveness. A plain finite machine cannot count arbitrary nesting, match balanced parentheses, remember unbounded identifiers, or enforce cross-field equality. It can remember a bounded amount by adding more states, but if the required memory grows with input length, the model is wrong. Pushdown automata, parsers, or richer program state are needed.',
        'Another tradeoff is state explosion. Combining several independent concerns into one machine can multiply the number of states. Sometimes the right design is one product machine. Sometimes it is several smaller machines coordinated by explicit events. The goal is inspectable control, not a giant diagram nobody can reason about.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'FSMs win in lexers, byte validators, CSV scanners, protocol handshakes, device controllers, traffic lights, UI workflows, animation controllers, retry lifecycles, and game behavior. They are strongest when the legal state space is small and when illegal transitions should be impossible or obvious.',
        'They also form the base vocabulary for regular expressions. Thompson NFAs, subset construction, DFA minimization, and safe regex engines all build on this idea. The safe engines are predictable precisely because they stay inside automata semantics rather than adding features that require backtracking over unbounded history.',
        'In application code, FSMs are useful even when no formal automata theory appears. A checkout reducer, WebSocket lifecycle, OAuth device flow, or upload state can be much safer when written as states and transitions rather than as scattered booleans.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common failure is using an FSM where the problem needs richer memory. Nested JSON, balanced parentheses, arbitrary recursion, indentation-sensitive languages, and regex backreferences all need more than one finite state unless the input size is artificially bounded.',
        'Another failure is hiding the machine. Many codebases have state machines implemented as scattered conditionals, but no transition table, no diagram, and no test that enumerates legal moves. That loses the main benefit. If reviewers cannot answer what events are legal from each state, the FSM is only implied.',
        'A subtler failure is overgeneralizing the trap state. Some errors really are terminal. Others are recoverable, especially in editors and network protocols. A good machine distinguishes terminal rejection, recoverable error, timeout, retry, and resynchronization instead of collapsing all bad events into one bucket.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Trie for character-labeled state graphs, Thompson NFA Regex Engine for nondeterministic execution, Subset Construction for compiling NFA state sets into DFA states, Regex Backtracking Catastrophic Case Study for the unsafe contrast, UTF-8 Decoder DFA for a production-grade byte validator, and CSV Parser State Machine for a small real parser.',
        'Then compare FSMs with Pushdown Automata and parser stacks, UI State Machine Workflow for product flows, TCP Handshake for protocol states, and Raft Leader Election for a distributed system where the state machine idea becomes part of correctness.',
      ],
    },
  ],
};
