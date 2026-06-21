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
        'In the online-build view, each highlighted node is the state just created for the newest prefix. Suffix links appear as dashed arcs pointing to shorter context states. The critical frame is not the one that adds a transition -- it is the one that clones a state because two substring classes need to split.',
        {type: 'callout', text: 'A suffix automaton is compact because it merges substrings by identical future behavior, not by identical spelling.'},
        'In the query view, the walk from the start state follows one transition per character. If every transition exists, the pattern is a substring. If any transition is missing, the pattern is not. The animation is deliberately simple here because the sophistication lives in construction, not lookup.',
        'Active (bright) nodes mark the current extend path. Found (green) nodes mark suffix-link targets. Compare (dimmed) nodes show states that already existed before this step. Read each frame as: "we just extended by one character -- which states changed, and did any state need to be cloned?"',
      
        {type: 'image', src: './assets/gifs/suffix-automaton.gif', alt: 'Animated walkthrough of the suffix automaton visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A string of length n has up to n(n+1)/2 substrings. Many tasks -- substring membership, counting distinct substrings, finding the longest common substring between two texts, locating repeated patterns -- need access to all of them. Storing every substring explicitly takes quadratic space and quadratic build time. The suffix automaton compresses all substring information into a deterministic finite automaton with at most 2n-1 states, built in O(n) time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Suffix_automaton_bold.svg/250px-Suffix_automaton_bold.svg.png', alt: 'Suffix automaton state graph with labeled transitions and final states', caption: 'A suffix automaton is a deterministic graph over substrings; suffix links and clones keep that graph minimal while text is appended online. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Suffix_automaton_bold.svg.'},
        'Blumer, Blumer, Haussler, McConnell, and Ehrenfeucht introduced the structure in 1985 under the name DAWG (Directed Acyclic Word Graph). The key promise: one linear-time, linear-space pass over the text produces an index that answers substring queries in time proportional to the query length, not the text length.',
        {
          type: 'note',
          text: 'The suffix automaton is the minimal DFA that accepts exactly the set of all substrings of the input string. Minimal means no other DFA for the same language has fewer states.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a suffix trie: insert every suffix of the text into a trie. Each node in the trie represents one substring, so every substring is reachable by a path from the root. Membership is a walk down the trie in O(|pattern|) time.',
        'This works, and the query interface is clean. The problem is size. The suffix trie for a string of length n can have O(n^2) nodes because every suffix spawns its own path, and shared prefixes between suffixes are the only savings. For "abcabc" the trie stores separate nodes for "abc", "bc", "c", "abcabc", "bcabc", "cabc", and so on -- many of these share identical future behavior but sit in different parts of the trie.',
        'A suffix tree compresses chains of single-child nodes into edge labels, bringing the node count to O(n). But suffix trees carry edge-label bookkeeping, and their construction (Ukkonen or McCreight) is notoriously hard to implement correctly. The suffix automaton offers the same linear guarantees with a different tradeoff: instead of compressing edges, it merges states that have the same future behavior.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The suffix trie breaks on size: O(n^2) nodes for a string of length n. The suffix tree fixes the node count but introduces complex edge-label management and offline construction in most implementations.',
        'The deeper issue is redundancy of futures. In "abab", the substrings "ab" and "ab" (at positions 1 and 3) end at the same set of positions, so they must have identical continuations. A suffix trie gives them separate subtrees. A suffix tree collapses edges but still keeps separate leaf paths. The suffix automaton asks: if two substrings always end at the same positions in the text, why keep two states? One state suffices, because the set of valid continuations is identical.',
        'The wall is that naive structures track substring identity (which exact characters were matched) instead of substring behavior (what can follow from here). The automaton crosses this wall by merging substrings into equivalence classes defined by their ending positions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The suffix automaton is built online, one character at a time. Each character triggers an "extend" step that creates at most one new state and potentially clones one existing state. The algorithm maintains three fields per state: maxLen (the length of the longest substring in the state equivalence class), link (the suffix link pointing to the next shorter equivalence class), and trans (a map from characters to successor states).',
        {
          type: 'code',
          language: 'javascript',
          text: `function extend(ch) {
  // Create state for the new prefix
  let cur = { len: last.len + 1, link: null, trans: {} };
  states.push(cur);

  // Walk suffix links, adding transitions
  let p = last;
  while (p && !p.trans[ch]) {
    p.trans[ch] = cur;
    p = p.link;
  }

  if (!p) {
    // No existing state has this transition -- link to root
    cur.link = start;
  } else {
    let q = p.trans[ch];
    if (q.len === p.len + 1) {
      // q already represents the right length -- link directly
      cur.link = q;
    } else {
      // Clone q: split its equivalence class
      let clone = { len: p.len + 1, link: q.link,
                    trans: { ...q.trans } };
      states.push(clone);
      // Redirect suffix-link chain through the clone
      while (p && p.trans[ch] === q) {
        p.trans[ch] = clone;
        p = p.link;
      }
      q.link = clone;
      cur.link = clone;
    }
  }
  last = cur;
}`,
        },
        'The extend step has three cases. First: no ancestor state has a transition on the new character, so the new state links directly to the root. Second: an ancestor has a transition to state q, and q.len equals p.len + 1, meaning q already represents exactly the right length class -- link directly. Third: q.len is too large, so q must be cloned. The clone gets the correct shorter length, copies transitions and suffix link from q, and then all ancestors that pointed to q are redirected to the clone.',
        'Each extend call does O(1) amortized work. The total construction is O(n) for a string of length n, with at most 2n-1 states and at most 3n-4 transitions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness rests on endpos equivalence classes. Define endpos(w) as the set of ending positions where substring w occurs in the text. Two substrings u and v belong to the same equivalence class if and only if endpos(u) = endpos(v). Each state in the automaton represents exactly one equivalence class.',
        {
          type: 'diagram',
          label: 'Endpos equivalence classes and suffix links for "abab"',
          text: `State 0 (start):  endpos = {}         len = 0
  |
  |-- a --> State 1:  endpos = {1,3}     len = 1
  |           |-- b --> State 2: endpos = {2,4}  len = 2
  |                       |-- a --> State 4: endpos = {3}  len = 3
  |                                   |-- b --> State 5: endpos = {4}  len = 4
  |
  |-- b --> State 3:  endpos = {2,4}     len = 1
              (suffix link target of State 2)

Suffix links (each points to longest proper suffix class):
  State 5 --link--> State 2  (endpos {2,4} contains {4})
  State 4 --link--> State 1  (endpos {1,3} contains {3})
  State 2 --link--> State 3  (endpos {2,4} = {2,4}, but len differs)
  State 3 --link--> State 0
  State 1 --link--> State 0`,
        },
        'Suffix links form a tree rooted at the start state. Each link points from a state with endpos set S to the state whose endpos set is the smallest proper superset of S (or equivalently, the longest proper suffix whose endpos differs). This tree has at most 2n-1 nodes, and every path from a leaf to the root strictly increases the endpos set.',
        'Cloning preserves the invariant. When extending by a new character would force one state to represent substrings with incompatible length ranges, the clone splits that state into two: one keeps the original longer substrings, the other takes the shorter ones. After the split, both states have consistent endpos sets and the automaton remains minimal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Build time: suffix automaton, suffix tree, and FM-index construction can be linear; suffix array construction ranges from linear to O(n log n) depending on the algorithm.',
            'Build space: suffix automata store O(n) states and transitions, suffix trees store O(n) nodes plus edge labels, suffix arrays store n integers plus LCP, and FM-indexes compress the suffix-array idea.',
            'Substring membership: suffix automata and suffix trees walk O(|P|); suffix arrays use binary search unless LCP acceleration is added; FM-indexes use backward search.',
            'Distinct substrings: suffix automata sum maxLen minus suffix-link maxLen over states; suffix trees sum edge-label lengths; suffix arrays subtract LCP overlap.',
            'Online construction: suffix automata extend one character at a time with compact state repair; suffix arrays and FM-indexes are normally rebuilt for static text.',
            'Size bounds: a suffix automaton has at most 2n - 1 states and 3n - 4 transitions, while a suffix tree has linear nodes and edges but heavier pointers.',
          ],
        },
        'The suffix automaton has at most 2n-1 states and 3n-4 transitions for a string of length n. Both bounds are tight: the string "abbb...b" achieves the state bound, and "abb...bcc...c" achieves the transition bound. Construction is O(n) amortized because each extend step does constant work plus a suffix-link walk whose total length across all steps is O(n).',
        'Distinct substring count is computed in O(n) after construction: each state contributes maxLen(state) - maxLen(link(state)) distinct substrings, and the total over all states equals the number of distinct substrings of the text. For "abab" with n=4, the count is 4+3+2+1 - 1(duplicate "ab") - 1(duplicate "a") - 1(duplicate "b") = 7 distinct substrings.',
        'Space depends on how transitions are stored. For a small alphabet (DNA: |A|=4), fixed arrays give O(1) transition lookup with O(n|A|) total space. For Unicode or byte alphabets, hash maps save space at the cost of higher constant factors. The suffix automaton tends to use less memory than a suffix tree because it avoids storing edge-label intervals.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The suffix automaton is the right tool when the text arrives online and substring queries must begin before the text is complete. Unlike suffix arrays and FM-indexes, it does not require the full text up front. Unlike suffix trees, its construction logic fits in under 40 lines of code with no edge-splitting bookkeeping.',
        {
          type: 'bullets',
          items: [
            'Competitive programming: problems asking for distinct substring counts, k-th smallest substring, or longest common substring between two strings are natural suffix-automaton territory.',
            'Plagiarism detection: build the automaton over one document, then scan a second document through it to find the longest matching substring in linear time.',
            'Bioinformatics: counting distinct k-mers or finding repeated motifs in DNA/RNA sequences, where the alphabet is small and online construction matters.',
            'Compression research: the suffix automaton exposes repeated structure that Lempel-Ziv-style compressors exploit, and its state count is a measure of string complexity.',
            'Text analytics: counting how many distinct substrings appear, or finding the shortest unique substring at each position, which is useful for fingerprinting and deduplication.',
          ],
        },
        'The longest common substring application deserves emphasis. Build the automaton for text T1. Then scan T2 character by character, maintaining the current state and current match length. When a transition exists, advance. When it does not, follow suffix links (shortening the match) until a transition exists or the start state is reached. The maximum match length seen during the scan is the LCS length. Total time: O(|T1| + |T2|).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The suffix automaton indexes exact symbol sequences. It does not handle approximate matching, edit distance, or wildcards without layering additional logic on top. If the task requires fuzzy search, a different index is needed.',
        'For static, read-heavy workloads on large texts where memory is constrained, the FM-index (based on the Burrows-Wheeler transform) compresses better. The suffix automaton transition maps can be memory-hungry for large alphabets: with 256 byte values and 2n states, a naive array-based implementation uses 512n bytes just for transitions.',
        'It is also the wrong tool for simple problems. If the task is matching one pattern against one text, KMP or Boyer-Moore is simpler and faster in practice. If the task is matching many fixed patterns simultaneously, Aho-Corasick is more direct. The suffix automaton earns its complexity only when the problem requires all-substring structure.',
        {
          type: 'note',
          text: 'A suffix automaton is not a suffix tree. It does not store edge-label intervals or support top-down traversal with branching on string depth. Converting between the two is possible but not free. Choose based on which query interface you actually need.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'The smallest automaton recognizing the subwords of a text.',
          attribution: 'Blumer, Blumer, Haussler, Ehrenfeucht, Chen, Seiferas (1985)',
        },
        {
          type: 'bullets',
          items: [
            'Primary source: A. Blumer, J. Blumer, D. Haussler, R. McConnell, A. Ehrenfeucht, "Complete Inverted Files for Efficient Text Retrieval and Analysis," Journal of the ACM, 1987. The 1985 conference version introduced the DAWG construction.',
            'Foundational companion: A. Blumer, J. Blumer, D. Haussler, A. Ehrenfeucht, M.T. Chen, J. Seiferas, "The Smallest Automaton Recognizing the Subwords of a Text," Theoretical Computer Science, 1985. Proves the 2n-1 state bound and 3n-4 transition bound.',
            'Implementation reference: the CP-Algorithms suffix automaton tutorial (cp-algorithms.com/string/suffix-automaton.html) provides clean pseudocode and worked examples for competitive programming applications.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Trie -- understand prefix sharing before substring sharing.',
            'Prerequisite: KMP Prefix Function -- failure links are the single-pattern ancestor of suffix links.',
            'Sibling structure: Suffix Array and LCP -- the sorted-suffix alternative for static text.',
            'Extension: Aho-Corasick Automaton -- multi-pattern matching with failure links.',
            'Extension: FM-Index -- compressed full-text search through the Burrows-Wheeler transform.',
            'Related structure: Eertree or Palindromic Tree -- similar online construction for palindromic substrings.',
          ],
        },
      ],
    },
  ],
};
