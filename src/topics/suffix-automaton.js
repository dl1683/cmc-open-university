// Suffix automaton: the minimal DFA of all substrings of one text.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'suffix-automaton',
  title: 'Suffix Automaton',
  category: 'Data Structures',
  summary: 'A compact automaton for every substring of a string: extend one character at a time, follow transitions, and use suffix links to share repeated contexts.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['online build', 'substring queries'], defaultValue: 'online build' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function samGraph(title) {
  return graphState({
    nodes: [
      { id: 's0', label: '0 start', x: 0.8, y: 3.8, note: 'len 0' },
      { id: 's1', label: '1 a', x: 2.4, y: 2.4, note: 'len 1' },
      { id: 's2', label: '2 ab', x: 4.0, y: 2.4, note: 'len 2' },
      { id: 's3', label: '3 aba', x: 5.6, y: 2.4, note: 'len 3' },
      { id: 's4', label: '4 abab', x: 7.2, y: 2.4, note: 'len 4' },
      { id: 's5', label: '5 ababa', x: 8.8, y: 2.4, note: 'len 5' },
      { id: 'qA', label: 'class a', x: 3.2, y: 5.7, note: 'suffix link target' },
      { id: 'qBA', label: 'class ba', x: 6.4, y: 5.7, note: 'shared context' },
    ],
    edges: [
      { id: 'e-0-1', from: 's0', to: 's1', weight: 'a' },
      { id: 'e-1-2', from: 's1', to: 's2', weight: 'b' },
      { id: 'e-2-3', from: 's2', to: 's3', weight: 'a' },
      { id: 'e-3-4', from: 's3', to: 's4', weight: 'b' },
      { id: 'e-4-5', from: 's4', to: 's5', weight: 'a' },
      { id: 'e-s3-qA', from: 's3', to: 'qA', weight: 'suffix link' },
      { id: 'e-s5-qBA', from: 's5', to: 'qBA', weight: 'suffix link' },
      { id: 'e-qA-s2', from: 'qA', to: 's2', weight: 'b transition' },
      { id: 'e-qBA-s3', from: 'qBA', to: 's3', weight: 'a transition' },
    ],
  }, { title });
}

function* onlineBuild() {
  const text = 'ababa';
  const stateCount = 8;
  const edgeCount = 9;
  const maxStates = 2 * text.length - 1; // tight bound

  yield {
    state: samGraph('Start with a state for the empty string'),
    highlight: { active: ['s0'], compare: ['s1', 's2'] },
    explanation: `A suffix automaton for "${text}" is built online. The start state represents the empty context. Each new character creates a state for the whole prefix and then repairs transitions from suffix contexts that did not know this character yet.`,
    invariant: `After reading a prefix, every substring of that prefix is accepted by some path from the start state. The final automaton has ${stateCount} states and ${edgeCount} edges.`,
  };

  yield {
    state: samGraph('Append a and b: transitions form new substring paths'),
    highlight: { active: ['s1', 's2', 'e-0-1', 'e-1-2'], found: ['s0'] },
    explanation: `Appending a character extends the longest prefix path. For "${text}", it may also add transitions from older suffix states. Those extra transitions are what make substrings, not just prefixes, reachable.`,
  };

  yield {
    state: samGraph('Repeated contexts reuse suffix links'),
    highlight: { active: ['s3', 's4', 's5'], found: ['qA', 'qBA', 'e-s3-qA', 'e-s5-qBA'], compare: ['s1', 's2'] },
    explanation: `When text repeats, states share end-position equivalence classes. The ${stateCount} states stay within the ${maxStates}-state upper bound. Suffix links point from a longer context to the largest proper suffix context that has the same future possibilities.`,
  };

  const bookkeepingRows = 4;
  yield {
    state: labelMatrix(
      'Build bookkeeping',
      [
        { id: 'len', label: 'maxLen' },
        { id: 'link', label: 'suffix link' },
        { id: 'trans', label: 'transitions' },
        { id: 'clone', label: 'clone state' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'why', label: 'why needed' },
      ],
      [
        ['longest string in state', 'counts substring lengths'],
        ['fallback context', 'shares repeated suffixes'],
        ['DFA edges by character', 'answers substring walk'],
        ['split an equivalence class', 'keeps automaton minimal'],
      ],
    ),
    highlight: { found: ['clone:why', 'link:role'], active: ['trans:why'] },
    explanation: `The clone case is the subtle part. Each of the ${bookkeepingRows} fields (maxLen, suffix link, transitions, clone) plays a role: if a transition would make one state represent incompatible lengths, the algorithm clones it and redirects suffix links so the automaton stays minimal.`,
  };
}

function* substringQueries() {
  const pattern = 'aba';
  const patternLen = pattern.length;
  const text = 'ababa';

  yield {
    state: samGraph('Substring membership is just a transition walk'),
    highlight: { active: ['s0', 's1', 's2', 's3', 'e-0-1', 'e-1-2', 'e-2-3'], found: ['s3'] },
    explanation: `To check whether "${pattern}" occurs in "${text}", start at the initial state and follow ${patternLen} transitions: a, then b, then a. If every transition exists, the pattern is a substring of the indexed text.`,
  };

  const queryCount = 4;
  yield {
    state: labelMatrix(
      'Common queries',
      [
        { id: 'contains', label: 'contains(P)' },
        { id: 'distinct', label: 'distinct substrings' },
        { id: 'lcs', label: 'longest common substring' },
        { id: 'freq', label: 'occurrence count' },
      ],
      [
        { id: 'method', label: 'method' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['walk transitions for P', 'O(|P|)'],
        ['sum maxLen - link.maxLen', 'O(states)'],
        ['scan second string through SAM', 'linear'],
        ['propagate end counts by len', 'linear after build'],
      ],
    ),
    highlight: { active: ['contains:cost', 'lcs:method'], found: ['distinct:method'] },
    explanation: `A suffix automaton is not only a matcher. All ${queryCount} query types leverage state lengths and the suffix-link tree to expose counts, repeated substrings, and longest-common-substring style queries.`,
  };

  yield {
    state: samGraph('Suffix links turn failed extension into fallback'),
    highlight: { active: ['s5', 'qBA', 'e-s5-qBA'], compare: ['qA', 's0'] },
    explanation: `Suffix links play the same broad role as failure links in KMP and Aho-Corasick: when the current context is too specific for "${text}", fall back to the best shorter context that can still continue.`,
  };

  const familySize = 4;
  yield {
    state: labelMatrix(
      'Neighbors in the string-index family',
      [
        { id: 'trie', label: 'Trie' },
        { id: 'aho', label: 'Aho-Corasick' },
        { id: 'suffix', label: 'Suffix Array' },
        { id: 'sam', label: 'Suffix Automaton' },
      ],
      [
        { id: 'indexes', label: 'indexes' },
        { id: 'strength', label: 'strength' },
      ],
      [
        ['a set of prefixes', 'simple autocomplete'],
        ['many patterns', 'emit matches while scanning'],
        ['all suffixes sorted', 'range search and compression'],
        ['all substrings compactly', 'online build and rich queries'],
      ],
    ),
    highlight: { found: ['sam:indexes', 'sam:strength'], compare: ['suffix:strength', 'aho:strength'] },
    explanation: `The full map of ${familySize} string-index structures is now connected: tries share prefixes, Aho-Corasick adds failure links, suffix arrays sort suffixes, and suffix automata minimize all substring paths.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'online build') yield* onlineBuild();
  else if (view === 'substring queries') yield* substringQueries();
  else throw new InputError('Pick a suffix-automaton view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each node as a class of substrings with the same future behavior. A transition consumes one character, and a suffix link points to the best shorter context to try next. During online construction, the active path shows which old contexts must learn about the new final character.',
        {type: 'callout', text: 'A suffix automaton is compact because it merges substrings by identical future behavior, not by identical spelling.'},
        'A clone appears when one old state has to be split into two length ranges. The safe inference is that cloning does not invent new substrings; it separates substrings that used to share a state but no longer have the same shortest valid context. Query frames are simpler: one missing transition proves the pattern is absent.',
        {type: 'image', src: './assets/gifs/suffix-automaton.gif', alt: 'Animated walkthrough of the suffix automaton visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A string of length n can contain n(n+1)/2 substrings, and many string tasks need all-substring information. Substring membership, distinct substring count, repeated-pattern search, and longest common substring all become expensive if every substring is stored separately. A suffix automaton compresses this information into a deterministic graph with at most 2n - 1 states.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Suffix_automaton_bold.svg/250px-Suffix_automaton_bold.svg.png', alt: 'Suffix automaton state graph with labeled transitions and final states', caption: 'A suffix automaton is a deterministic graph over substrings; suffix links and clones keep that graph minimal while text is appended online. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Suffix_automaton_bold.svg.'},
        'The structure exists for online indexing. Online means the text can be processed left to right, one character at a time, while preserving a usable substring index. After construction, checking whether a pattern is a substring costs one graph step per pattern character.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a suffix trie. Insert every suffix into a trie, where each edge is a character and each root-to-node path spells a substring. A query walks characters from the root and succeeds if the path exists.',
        'This is correct and easy to reason about. The trie stores substring spelling directly, which is helpful for a first implementation. It fails because the number of trie nodes can be quadratic in the text length.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The suffix trie stores too many different paths whose future behavior is identical. In abab, the substring ab appears in more than one place, and after matching it the possible continuations are governed by where that occurrence ends. A spelling-based trie repeats structure that a behavior-based graph can merge.',
        'A suffix tree compresses long chains and keeps linear size, but it uses edge intervals and tree topology. The wall for online substring indexing is keeping linear size while supporting simple deterministic transitions. The automaton solves this by merging substrings with the same end-position behavior.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Define endpos(w) as the set of text positions where substring w ends. Two substrings belong in the same automaton state when they have the same endpos set. If their ending positions are the same, every continuation that is valid for one is valid for the other in the same way.',
        'The automaton is the minimal deterministic machine that accepts exactly the substrings of the text. Each state stores the maximum length of a substring in its class, transitions by next character, and a suffix link to the best shorter class. Clones split a class when a new character proves that one state was covering incompatible length ranges.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction appends one character ch at a time. It creates a new state cur whose maxLen is one more than the previous last state, then walks suffix links from the old last state while missing ch transitions are added to cur. This teaches every relevant suffix context that ch can now follow it.',
        'If the walk reaches no previous transition, cur links to the start state. If it reaches a state p with transition ch to q and q has the exact needed length, cur links to q. If q is too long, the algorithm clones q with a shorter maxLen, redirects the relevant ch transitions to the clone, and links both q and cur to that clone.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that after processing each prefix, the automaton accepts exactly the substrings of that prefix. Adding a character only creates new substrings that end at the new final position. The suffix-link walk visits exactly the suffix contexts that need a new transition for that character.',
        'Cloning preserves minimality. When q is too long, one state is trying to represent substrings that share transitions but need different length bounds. The clone copies q behavior but takes the shorter context range, so old and new substrings land in the correct endpos classes without changing accepted strings.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Construction is O(n) amortized for a text of length n. Each append creates one state and may create one clone, so the automaton has at most 2n - 1 states. Transitions are also linear for fixed alphabets, with a known upper bound of 3n - 4 for n at least 3.',
        'Query cost is O(m) for a pattern of length m because each character follows one transition or fails. Space behavior depends on transition representation. Arrays are fast for small alphabets, while maps save space for byte or Unicode alphabets at a higher constant cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Suffix automata are useful when all-substring structure must be built online. Competitive programming uses them for distinct substring counts, k-th substring queries, and longest common substring. Text analytics can use them to scan one document against another after building the automaton for the first document.',
        'The access pattern is one fixed text with many substring questions, or one growing text that must remain queryable. For longest common substring, build the automaton for text A and scan text B while following transitions and suffix links. The maximum maintained match length is the answer in linear total time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A suffix automaton indexes exact symbol sequences. It does not handle edit distance, wildcards, approximate matching, or semantic similarity without extra machinery. For one pattern against one text, KMP or Boyer-Moore is simpler and usually faster in practice.',
        'Memory can also be worse than a suffix array or FM-index for large static text. Transition maps add overhead, and the graph is less cache-friendly than flat arrays. If the text is static and memory is the binding constraint, compressed suffix-array structures often fit better.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For abab, the distinct substrings are a, b, ab, ba, aba, bab, and abab, so the answer is 7. A suffix automaton computes this by summing maxLen(state) - maxLen(link(state)) over non-root states. For the simple automaton, the contributions are 1, 2, 2, and 2, which sum to 7.',
        'Substring query ab walks start --a--> state for a, then --b--> the state for ab-like contexts, so it succeeds in two steps. Query aa follows a, then fails because there is no a transition from that state. The failure is definitive because the deterministic state represents all possible occurrences after reading a.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Blumer et al., "The Smallest Automaton Recognizing the Subwords of a Text," Theoretical Computer Science, 1985, for the original automaton bound. CP-Algorithms has a useful implementation-oriented suffix automaton reference for the extend and clone cases.',
        'Study tries and finite automata first, then suffix arrays and suffix trees for contrasting substring indexes. After this topic, study Aho-Corasick, FM-indexes, and palindromic trees to see how automata compress different language families.',
      ],
    },
  ],
};