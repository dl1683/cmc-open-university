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
  yield {
    state: samGraph('Start with a state for the empty string'),
    highlight: { active: ['s0'], compare: ['s1', 's2'] },
    explanation: 'A suffix automaton is built online. The start state represents the empty context. Each new character creates a state for the whole prefix and then repairs transitions from suffix contexts that did not know this character yet.',
    invariant: 'After reading a prefix, every substring of that prefix is accepted by some path from the start state.',
  };

  yield {
    state: samGraph('Append a and b: transitions form new substring paths'),
    highlight: { active: ['s1', 's2', 'e-0-1', 'e-1-2'], found: ['s0'] },
    explanation: 'Appending a character extends the longest prefix path. It may also add transitions from older suffix states. Those extra transitions are what make substrings, not just prefixes, reachable.',
  };

  yield {
    state: samGraph('Repeated contexts reuse suffix links'),
    highlight: { active: ['s3', 's4', 's5'], found: ['qA', 'qBA', 'e-s3-qA', 'e-s5-qBA'], compare: ['s1', 's2'] },
    explanation: 'When text repeats, states share end-position equivalence classes. Suffix links point from a longer context to the largest proper suffix context that has the same future possibilities.',
  };

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
    explanation: 'The clone case is the subtle part. If a transition would make one state represent incompatible lengths, the algorithm clones it and redirects suffix links so the automaton stays minimal.',
  };
}

function* substringQueries() {
  yield {
    state: samGraph('Substring membership is just a transition walk'),
    highlight: { active: ['s0', 's1', 's2', 's3', 'e-0-1', 'e-1-2', 'e-2-3'], found: ['s3'] },
    explanation: 'To check whether aba occurs, start at the initial state and follow a, then b, then a. If every transition exists, the pattern is a substring of the indexed text.',
  };

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
    explanation: 'A suffix automaton is not only a matcher. Its state lengths and suffix-link tree expose counts, repeated substrings, and longest-common-substring style queries.',
  };

  yield {
    state: samGraph('Suffix links turn failed extension into fallback'),
    highlight: { active: ['s5', 'qBA', 'e-s5-qBA'], compare: ['qA', 's0'] },
    explanation: 'Suffix links play the same broad role as failure links in KMP and Aho-Corasick: when the current context is too specific, fall back to the best shorter context that can still continue.',
  };

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
    explanation: 'The full map is now connected: tries share prefixes, Aho-Corasick adds failure links, suffix arrays sort suffixes, and suffix automata minimize all substring paths.',
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
      heading: 'What it is',
      paragraphs: [
        'A suffix automaton is a compact deterministic finite automaton that accepts every substring of one fixed text. It is often described as the minimal DFA of the text substrings. The structure has at most 2n - 1 states for a string of length n, so it is linear-size even though the text can have quadratically many substrings.',
        'The core abstraction is an end-position equivalence class. Substrings that end in exactly the same set of positions have the same future behavior, so the automaton stores one state for that shared behavior instead of one node per substring.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The standard construction appends characters one at a time. Each append creates a current state for the whole new prefix, walks suffix links to add missing transitions, and either links directly to an existing state or creates a clone when an old state has to be split by length.',
        'A state stores maxLen, a suffix link, and outgoing transitions. The number of new distinct substrings contributed by a state is maxLen(state) - maxLen(link(state)). That small formula is why the structure is so useful for substring counting.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build time is O(n) with a suitable transition dictionary, and memory is O(n) states plus transitions. Membership for a pattern P is O(|P|). Longest common substring can be found by scanning another string through the automaton while falling back through suffix links.',
        'The implementation complexity is concentrated in clone creation. The clone copies transitions, receives a shorter maxLen, and becomes the suffix-link target of states that previously pointed at the unsplit state. That operation preserves minimality.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Suffix automata are used in string algorithms, plagiarism and near-duplicate analysis, bioinformatics exercises, compression research, competitive programming, and substring analytics where online construction matters.',
        'A complete case study is finding the longest phrase shared by two documents. Build the suffix automaton for document A. Then stream document B through it, extending when transitions exist and following suffix links on failures. The longest reached length is the answer, without sorting every suffix of both texts.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A suffix automaton is not the same as a suffix tree. It merges equivalent substring futures instead of storing explicit text intervals on edges. It is also not automatically smaller than every compressed suffix index in practice; transition maps and alphabet size matter.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Blumer, Blumer, Haussler, McConnell, and Ehrenfeucht, Complete Inverted Files for Efficient Text Retrieval and Analysis, at https://www.cs.cornell.edu/courses/cs786/2004sp/Lectures/l15-blumer.pdf. Study Trie, KMP Prefix Function, Aho-Corasick Automaton, Eertree Palindromic Tree, Suffix Array & LCP, and FM-Index next.',
      ],
    },
  ],
};
