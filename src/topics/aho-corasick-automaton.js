// Aho-Corasick: a trie plus failure links for multi-pattern matching.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'aho-corasick-automaton',
  title: 'Aho-Corasick Automaton',
  category: 'Data Structures',
  summary: 'Multi-pattern string matching: build a trie, add failure links, and scan the text once while emitting every matched keyword.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trie failure links', 'stream matches'], defaultValue: 'trie failure links' },
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

function automaton(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 0.8, y: 4.0, note: 'state 0' },
      { id: 'h', label: 'h', x: 2.4, y: 2.3, note: '' },
      { id: 'he', label: 'he', x: 4.0, y: 1.5, note: 'output he' },
      { id: 'her', label: 'her', x: 5.6, y: 1.5, note: '' },
      { id: 'hers', label: 'hers', x: 7.2, y: 1.5, note: 'output hers' },
      { id: 'hi', label: 'hi', x: 4.0, y: 3.0, note: '' },
      { id: 'his', label: 'his', x: 5.6, y: 3.0, note: 'output his' },
      { id: 's', label: 's', x: 2.4, y: 5.8, note: '' },
      { id: 'sh', label: 'sh', x: 4.0, y: 5.4, note: '' },
      { id: 'she', label: 'she', x: 5.6, y: 5.4, note: 'output she + he' },
    ],
    edges: [
      { id: 'e-root-h', from: 'root', to: 'h', weight: 'h' },
      { id: 'e-h-he', from: 'h', to: 'he', weight: 'e' },
      { id: 'e-he-her', from: 'he', to: 'her', weight: 'r' },
      { id: 'e-her-hers', from: 'her', to: 'hers', weight: 's' },
      { id: 'e-h-hi', from: 'h', to: 'hi', weight: 'i' },
      { id: 'e-hi-his', from: 'hi', to: 'his', weight: 's' },
      { id: 'e-root-s', from: 'root', to: 's', weight: 's' },
      { id: 'e-s-sh', from: 's', to: 'sh', weight: 'h' },
      { id: 'e-sh-she', from: 'sh', to: 'she', weight: 'e' },
      { id: 'f-she-he', from: 'she', to: 'he', weight: 'fail/output' },
      { id: 'f-hers-s', from: 'hers', to: 's', weight: 'fail' },
      { id: 'f-hi-root', from: 'hi', to: 'root', weight: 'fail' },
    ],
  }, { title });
}

function* trieFailureLinks() {
  yield {
    state: automaton('Dictionary: he, she, his, hers'),
    highlight: { active: ['root', 'h', 's'], found: ['he', 'she', 'his', 'hers'] },
    explanation: 'Aho-Corasick starts with a trie of all patterns. Every prefix is a state. Output states record which keywords end there.',
  };

  yield {
    state: automaton('Failure links jump to the longest suffix state'),
    highlight: { active: ['she', 'f-she-he', 'he'], compare: ['hers', 'f-hers-s'] },
    explanation: 'Failure links are the multi-pattern version of KMP fallback. If the automaton cannot follow the next character, it jumps to the longest suffix that is also a trie prefix.',
    invariant: 'A failure link preserves the longest useful suffix of the current text suffix.',
  };

  yield {
    state: labelMatrix(
      'Build order',
      [
        { id: 'trie', label: 'insert patterns' },
        { id: 'bfs', label: 'BFS from root' },
        { id: 'fail', label: 'compute fail links' },
        { id: 'output', label: 'merge outputs' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['Trie edges', 'sum pattern lengths'],
        ['Queue by depth', 'linear states'],
        ['fallback transitions', 'linear with alphabet handling'],
        ['suffix matches', 'reported matches preserved'],
      ],
    ),
    highlight: { found: ['fail:structure', 'output:structure'], active: ['bfs:cost'] },
    explanation: 'Failure links are built breadth-first so a parent failure link is known before its children need it. Output links ensure that matching she also reports he.',
  };

  yield {
    state: labelMatrix(
      'What the automaton stores',
      [
        { id: 'goto', label: 'goto edge' },
        { id: 'fail', label: 'failure edge' },
        { id: 'out', label: 'output set' },
        { id: 'state', label: 'current state' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'neighbor', label: 'study link' },
      ],
      [
        ['consume matching char', 'Trie'],
        ['recover on mismatch', 'KMP Prefix Function'],
        ['emit pattern ids', 'Inverted Index'],
        ['longest matched suffix', 'Finite State Machine'],
      ],
    ),
    highlight: { active: ['fail:neighbor', 'state:meaning'], found: ['out:meaning'] },
    explanation: 'Aho-Corasick is best read as a finite-state machine compiled from a dictionary. Each text character causes transitions until the machine reaches the right suffix state.',
  };
}

function* streamMatches() {
  yield {
    state: labelMatrix(
      'Scan text: ushers',
      [
        { id: 'u', label: 'u' },
        { id: 's', label: 's' },
        { id: 'h', label: 'h' },
        { id: 'e', label: 'e' },
        { id: 'r', label: 'r' },
        { id: 's2', label: 's' },
      ],
      [
        { id: 'state', label: 'state after char' },
        { id: 'output', label: 'output' },
      ],
      [
        ['root', 'none'],
        ['s', 'none'],
        ['sh', 'none'],
        ['she', 'she, he'],
        ['her', 'none'],
        ['hers', 'hers'],
      ],
    ),
    highlight: { found: ['e:output', 's2:output'], active: ['e:state', 's2:state'] },
    explanation: 'The text ushers is scanned once. At e, the state she emits she and follows output inheritance to emit he. At the final s, it emits hers.',
  };

  yield {
    state: automaton('After reporting she, failure/output reports he'),
    highlight: { active: ['she', 'f-she-he'], found: ['he'] },
    explanation: 'The match she ends at the same character as he, because he is a suffix of she. Output merging is what makes overlapping dictionary matches appear without rescanning.',
  };

  yield {
    state: labelMatrix(
      'Runtime accounting',
      [
        { id: 'text', label: 'text chars' },
        { id: 'fail', label: 'failure traversals' },
        { id: 'emit', label: 'outputs' },
        { id: 'total', label: 'total' },
      ],
      [
        { id: 'bound', label: 'bound' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['O(n)', 'one stream pass'],
        ['amortized linear', 'suffix depth drops'],
        ['O(matches)', 'must report them'],
        ['O(n + matches)', 'after preprocessing'],
      ],
    ),
    highlight: { found: ['total:bound'], compare: ['emit:bound'] },
    explanation: 'The scanner is linear in the text plus the number of matches emitted. Output size is unavoidable: if a dictionary produces many matches, the algorithm has to report them.',
  };

  yield {
    state: labelMatrix(
      'Case-study uses',
      [
        { id: 'ids', label: 'intrusion signatures' },
        { id: 'filter', label: 'content filter' },
        { id: 'bio', label: 'DNA motifs' },
        { id: 'index', label: 'bibliographic search' },
      ],
      [
        { id: 'whyMany', label: 'why many-pattern matching' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['thousands of signatures', 'match explosion'],
        ['many forbidden phrases', 'normalization matters'],
        ['motif dictionary', 'alphabet small but huge text'],
        ['keyword catalog', 'historical paper use case'],
      ],
    ),
    highlight: { active: ['ids:whyMany', 'index:whyMany'], compare: ['filter:risk'] },
    explanation: 'Aho-Corasick is what you reach for when the dictionary is fixed, the stream is large, and overlapping matches matter.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trie failure links') yield* trieFailureLinks();
  else if (view === 'stream matches') yield* streamMatches();
  else throw new InputError('Pick an Aho-Corasick view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The graph is the Aho-Corasick automaton built from a small dictionary. Each node is a trie state labeled with the prefix it represents. Solid directed edges are goto transitions: consuming a matching character moves one level deeper. Dashed edges labeled "fail" are failure links (also called suffix links): they point to the longest proper suffix of the current prefix that is itself a prefix in the trie. The edge labeled "fail/output" from "she" to "he" is both a failure link and an output link, because "he" is a complete pattern that happens to be the suffix target.',
        'Nodes annotated "output" are match states. When the automaton enters one, it emits that pattern. Output links chain additional shorter patterns that also end at the same text position. In the "stream matches" view, watch the text pointer: it advances exactly once per character, never rewinds. Active highlights show the current automaton state. Found highlights show which patterns have been reported.',
        {type: 'callout', text: 'Aho-Corasick turns many keyword searches into one automaton by preserving the longest useful suffix after every mismatch.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Alfred Aho and Margaret Corasick published "Efficient String Matching: An Aid to Bibliographic Search" at Bell Labs in 1975. Their goal was the first Unix fgrep: given k fixed patterns with total length m and a text of length n, find every occurrence of every pattern, including overlaps, in O(n + m + z) time, where z is the number of matches. One pass over the text, no matter how many patterns.',
        'The need is everywhere. Network intrusion detection (Snort, Suricata) checks every packet against thousands of attack signatures. Antivirus scanners (ClamAV, YARA rules) match file bytes against malware databases. Bioinformatics tools search gigabase genomes for hundreds of known DNA motifs. The original use case, bibliographic keyword search, is the tamest example of a pattern that recurs whenever a fixed dictionary meets a large stream.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Run KMP (or Boyer-Moore) once per pattern. Each run is O(n + |p|) for a single pattern p, which is fine in isolation. With k patterns, total cost is O(k * n + m). For 10,000 attack signatures against a 1 GB packet capture, that is 10,000 full passes over the data. Each pass rediscovers the same suffix information from scratch.',
        'Rabin-Karp can hash multiple patterns and check sliding windows, but it handles varying-length patterns awkwardly and degrades to O(k * n) on hash collisions. Neither approach shares work between patterns that overlap in their prefixes ("he", "her", "hers") or suffixes ("she" contains "he").',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'k patterns means k independent passes. The text is re-read k times, and suffix fallback information discovered during one pass is invisible to every other pass. Patterns "he", "she", and "hers" all share the substring "he", but separate matchers cannot exploit that.',
        'Overlapping matches are the second wall. When "she" ends at some position, "he" also ends there. Independent matchers discover both, but only by coincidence of running separately. A single-pass solution must detect that "he" completes at the same position as "she" without rescanning any character.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compile all patterns into a single finite-state machine. A trie merges shared prefixes: "he", "her", "hers" share the path root -> h -> he. That handles prefix sharing. Failure links handle suffix sharing: when the automaton is in state "she" and the next character has no goto edge, the failure link jumps to "he" (the longest suffix of "she" that is also a trie prefix). This is KMP\'s failure function, generalized from a single string to an entire trie.',
        {type: 'image', src: 'https://iq.opengenus.org/content/images/2018/11/trie.png', alt: 'Trie structure used as the base of Aho-Corasick matching.', caption: 'The trie merges shared prefixes before failure links add suffix recovery. (Source: iq.opengenus.org)'},
        'Output links handle overlapping completions. The node "she" carries an output link to "he" because "he" is both a complete pattern and the suffix target. When "she" matches, the automaton walks the output chain and reports "he" at the same position. One character advance per text position, all matches collected.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Phase 1, trie construction: insert each pattern character by character from the root. Each root-to-node path spells a prefix. Mark nodes where a pattern ends as output nodes. For {"he", "she", "his", "hers"}, this produces 10 nodes (including root) and 9 goto edges.',
        'Phase 2, failure link construction: process nodes in BFS order (level by level from root). Every depth-1 node gets a failure link to root, since a single character has no proper suffix in the trie. For a deeper node u reached by character c from parent p: follow p\'s failure link to f(p). If f(p) has a child on c, then f(u) is that child. If not, follow f(p)\'s failure link and repeat until a match or root. BFS order guarantees that f(p) is already computed before any of p\'s children need it. Example: sh fails to h (root has a child on "h"), so she fails to he (h has a child on "e").',
        'Phase 3, output link construction: if a node\'s failure target is itself an output node, set the output link to point there. Otherwise, copy the failure target\'s output link. This chains every suffix pattern reachable from any state. For "she", the failure target "he" is an output node, so "she" gets an output link to "he".',
        'Search: start at root. For each text character c, attempt the goto transition on c. If it exists, move to that child. If not, follow the failure link and try again, repeating until a transition exists or root is reached (root always either has a child on c or stays at root). After settling into a state, walk the output link chain and report every pattern found. The text pointer advances once per character and never rewinds.',
        {type: 'image', src: 'https://bs-uploads.toptal.io/blackfish-uploads/uploaded_file/file/191788/image-1582328549102-447a1375d0c3be19c4d8039d8ba0d7a1.png', alt: 'Aho-Corasick automaton diagram with trie transitions and failure links.', caption: 'Failure links turn the trie into a stream automaton that avoids rescanning text. (Source: bs-uploads.toptal.io)'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Invariant: after reading text[0..i], the current state is the longest suffix of text[0..i] that is a prefix of some pattern. A goto transition extends that suffix by one character. A failure link shortens it to the next-longest suffix that is still a trie prefix. Failure links always move to a strictly shorter string, so the chain terminates. They move to the longest possible shorter suffix, so no potential match is skipped.',
        'The amortized cost of failure traversals is linear. Each character advance increases the current prefix length by 1. Each failure link traversal decreases it by at least 1. The prefix length starts at 0 and never goes negative, so the total number of decreases across the entire scan cannot exceed the total number of increases, which is n. The text pointer contributes O(n). Output reporting contributes O(z). Total: O(n + z) after O(m) preprocessing.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build time: O(m) to insert all patterns into the trie. Failure link construction visits each of the O(m) nodes once in BFS and follows failure chains whose total length is bounded by m. Total build: O(m) with hash-map children, or O(m * |S|) with dense arrays where |S| is the alphabet size.',
        'Build space: O(m * |S|) with dense goto arrays (one slot per character per node). Hash maps reduce this to O(m) at the cost of a constant factor per lookup.',
        'Search time: O(n + z). Each of n characters causes one goto attempt and amortized O(1) failure traversals. Each of z matches is reported in O(1). Doubling the text doubles scan time. Doubling the pattern count doubles build time and space but leaves scan time unchanged, because the text is still read once.',
        'Compare to the naive approach: O(k * n + m). For 5,000 patterns and a 100 MB text, the naive approach does 5,000 passes. Aho-Corasick does one.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Network intrusion detection: Snort and Suricata compile thousands of attack signatures into an Aho-Corasick automaton and run every packet through it. The dictionary is fixed between rule updates; the traffic stream is continuous and vast. One-pass matching at wire speed is the requirement.',
        'Antivirus scanning: ClamAV and YARA match file bytes against malware signature databases. The signature set is large (tens of thousands of byte sequences) and the files scanned are enormous. Aho-Corasick makes this linear in file size, not in file size times signature count.',
        'DNA motif search: bioinformatics tools scan gigabase genomes against dictionaries of known motifs. The alphabet is small (4 letters) but the text is huge, making one-pass scanning essential.',
        'Content filtering: profanity filters, spam blocklists, and policy-enforcement systems compile forbidden phrases into an automaton and scan user-generated text in one pass. grep -F (fixed-string grep, the descendant of fgrep) uses Aho-Corasick internally when given multiple patterns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Single-pattern search gains nothing. KMP or Boyer-Moore is simpler and often faster when there is only one pattern. Aho-Corasick\'s value comes from amortizing the automaton across many patterns.',
        'Regex patterns are out of scope. The automaton matches exact substrings. Quantifiers, alternation, backreferences, and approximate matching need NFA simulation, edit-distance automata, or full regex engines.',
        'Frequently changing pattern sets are expensive. Adding or removing a pattern means rebuilding failure and output links. If the dictionary changes every few seconds, rebuild cost dominates. Incremental variants exist but add significant complexity.',
        'Very large alphabets (full Unicode, 1,114,112 code points) make dense goto arrays impractical. Hash maps or compressed transition tables are required, adding a constant factor per transition that matters at wire speed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Patterns: {"he", "she", "his", "hers"}. Build the trie: root -h-> h -e-> he* -r-> her -s-> hers*; root -h-> h -i-> hi -s-> his*; root -s-> s -h-> sh -e-> she*. Stars mark output nodes.',
        'Failure links (BFS, level by level). Depth 1: f(h) = root, f(s) = root. Depth 2: f(he) = root (root has no "e" child). f(hi) = root. f(sh) = h (root has "h" child). Depth 3: f(she) = he (sh fails to h, and h has "e" child). f(her) = root. f(his) = s (hi fails to root, root has "s" child). f(hers) = s (her fails to root, root has "s" child). Output links: she\'s failure target he is an output node, so she gets output link -> he.',
        'Text "ushers". u: root has no "u" child, stay at root, no output. s: goto s, no output. h: goto sh, no output. e: goto she, output "she" at position 2-4; follow output link to he, output "he" at position 3-4. r: she has no "r" child; follow failure link to he; he has "r" child, goto her, no output. s: goto hers, output "hers" at position 3-6. Total: 3 matches ("she", "he", "hers") found in one pass over 6 characters, no character read twice.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Aho, A. V. and Corasick, M. J. (1975), "Efficient String Matching: An Aid to Bibliographic Search," Communications of the ACM 18(6), pp. 333-340. The foundational paper that introduced the automaton and proved the linear-time bound. Commentz-Walter (1979) later combined Aho-Corasick with Boyer-Moore\'s right-to-left scanning for speedups on certain workloads.',
        'Prerequisites: Trie (the base data structure; Aho-Corasick is a trie plus two link types), KMP Algorithm (failure function for a single string; Aho-Corasick generalizes it across an entire trie). Related: Rabin-Karp (hash-based multi-pattern matching; simpler but O(k*n) worst case), Suffix Array and Suffix Tree (preprocess the text instead of the patterns; better when the text is fixed and queries vary), Regular Expressions (when patterns need quantifiers, alternation, or approximate matching beyond exact substrings).',
      ],
    },
  ],
};
