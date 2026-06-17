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
      heading: `Why this exists`,
      paragraphs: [
        `A suffix automaton exists because one fixed text can have quadratically many substrings, but many substring questions need a compact index. Membership, distinct-substring counting, longest common substring, repeated substring analysis, and online construction all ask for all-substring structure without storing every substring separately.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The reasonable first attempt is a suffix trie or suffix tree. A trie of all suffixes makes every substring a path, but the naive version is too large. A suffix tree compresses edges, but its construction and edge-label mechanics can be heavy when the desired interface is an online finite automaton.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The wall is duplicate future behavior. Many different substrings have the same set of possible continuations because they end at the same positions in the text. If the structure keeps separate nodes for histories that behave identically from now on, it wastes states.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Merge substrings by end-position equivalence. Substrings that end in exactly the same set of text positions have the same future possibilities, so one state can represent that behavior. Suffix links move from a longer context to the largest proper suffix context that preserves useful continuation information.`,
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        `In the online-build view, read each new state as the longest prefix seen so far and each suffix link as the best shorter context to repair next. The important moment is not simply adding an edge. It is deciding whether an existing state can keep representing its length range or whether a clone must split that behavior.`,
        `In the query view, a substring test is deliberately boring: follow transitions from the start state. The sophistication is in construction. The build has already compressed every substring path into a minimal automaton, so membership becomes a direct walk.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The standard construction appends characters one at a time. Each append creates a current state for the whole new prefix, walks suffix links to add missing transitions, and either links directly to an existing state or creates a clone when an old state must be split by length. Each state stores maxLen, a suffix link, and transitions.`,
        `For each state, maxLen is the longest substring represented by that state. The suffix link points to the state representing the largest proper suffix class. The state therefore represents a whole interval of substring lengths: maxLen(link(state)) + 1 through maxLen(state). That interval view is the easiest way to understand distinct-substring counting.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The automaton is minimal because states represent distinct future behavior, not arbitrary construction history. Clone creation preserves that invariant when one transition would otherwise make a state represent incompatible length ranges. The formula maxLen(state) - maxLen(link(state)) counts the distinct substrings introduced by a state's length interval.`,
        `End-position equivalence is the proof idea. If two substrings end at exactly the same positions in the text, then every possible continuation after one is possible after the other. Merging them loses no future behavior. If a new character proves that two histories no longer share the same length constraints, cloning separates them just enough to restore the invariant.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Build time is O(n) with suitable transition dictionaries, and memory is O(n) states plus transitions. The structure has at most 2n - 1 states for a string of length n. Pattern membership costs O(|P|). Longest common substring scans another string through the automaton while falling back by suffix links.`,
        `Alphabet representation matters. For small alphabets, fixed arrays can make transitions fast. For Unicode, bytes, or large token alphabets, maps save space but add lookup overhead. The big-O story is linear, but the practical structure is shaped by the alphabet and by how many transitions each state carries.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Suffix automata win in online substring analytics, distinct-substring counting, longest-common-substring search, plagiarism and near-duplicate analysis, compression research, bioinformatics exercises, and competitive programming tasks where all-substring structure must stay linear-size.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `A suffix automaton is not a suffix tree. It does not store explicit text intervals on edges; it merges equivalent substring futures. Transition maps and alphabet size matter, so it is not automatically smaller than every compressed suffix index. For static compressed full-text search, a suffix array or FM-index may be a better engineering target.`,
        `It is also easy to teach badly. If the explanation starts with clone pseudocode, beginners see a ritual. The better path is to start with the problem of duplicate substring futures, then show suffix links as fallback contexts, then introduce cloning as the one case where a shared future must be split by length.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `For the text ababa, many substrings share continuations. The substring a occurs at positions 1, 3, and 5; ba occurs at positions 2 and 4; aba occurs at positions 1 and 3. The automaton does not store all those substrings as separate trie paths from every suffix. It stores states for equivalence classes of where those substrings can end and what can follow them.`,
        `A query for aba starts at the initial state and follows a, b, a. A query for abb fails as soon as the second b transition is missing. Counting distinct substrings then uses state length intervals rather than enumerating strings: each state contributes the number of lengths it newly represents.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Use suffix automata when the text is built online or when substring aggregate queries matter. Store transitions in a structure appropriate for the alphabet: arrays for tiny alphabets, maps for broad alphabets, and compact encodings when memory dominates.`,
        `Test clone behavior heavily. Most implementation bugs appear when repeated contexts force a state split. Compare substring membership and distinct-substring counts against a slow suffix-set implementation on small random strings.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `A plagiarism checker receives one document as the indexed text and scans another document through the automaton to find the longest common substring. The scan keeps the current automaton state and match length. When the next character has no transition, suffix links shorten the context until a transition exists or the scan returns to the start.`,
        `That gives a linear pass over the second document after a linear build over the first. The result is not semantic plagiarism detection, but it is a strong exact-substring primitive that can feed a larger report with source positions and thresholds.`,
      ],
    },
    {
      heading: `Limits and failure modes`,
      paragraphs: [
        `Suffix automata answer substring questions over the exact symbol stream they were built from. Tokenization, case folding, Unicode normalization, and separator handling change the language being indexed. Those choices should be explicit before using counts as product evidence.`,
        `The automaton can also be overkill. If the task is one pattern against one text, KMP is simpler. If the task is many known patterns, Aho-Corasick is clearer. If the task is compressed static full-text search, FM-indexes may use less memory.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Expose the automaton's state count, transition count, alphabet size, and clone count when building indexes. A sudden increase often means the input changed shape, tokenization changed, or an expected repetitive corpus became much less repetitive.`,
        `For product use, store enough metadata to reproduce the symbol stream. A suffix automaton built over bytes, code points, words, or normalized tokens answers different questions even when the visible text looks similar. Query results should name that unit so readers do not confuse byte substrings with words or user-visible characters.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary source: Blumer, Blumer, Haussler, McConnell, and Ehrenfeucht, Complete Inverted Files for Efficient Text Retrieval and Analysis, at https://www.cs.cornell.edu/courses/cs786/2004sp/Lectures/l15-blumer.pdf. Study Trie, KMP Prefix Function, Aho-Corasick Automaton, Eertree Palindromic Tree, Suffix Array & LCP, and FM-Index next.`,
      ],
    },
  ],
};
