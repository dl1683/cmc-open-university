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
      heading: 'What it is',
      paragraphs: [
        'Aho-Corasick is a multi-pattern string matching automaton. Given a dictionary of keywords, it builds a trie, adds failure links, and scans the text once while emitting every dictionary word that ends at each position.',
        'It generalizes KMP. KMP keeps one fallback chain for one pattern. Aho-Corasick keeps fallback links across a trie of many patterns, so a failed transition can reuse the longest suffix that is also a dictionary prefix.',
        'The payoff is especially clear when patterns overlap. If the dictionary contains he, she, and hers, one pass through ushers must report multiple matches ending at nearby positions. The automaton carries those overlaps as state instead of restarting separate searches.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First insert all patterns into a trie. Then build failure links breadth-first. For a state representing some prefix, its failure link points to the state for the longest proper suffix that is also a trie prefix. Output sets are merged through failure links so suffix patterns are reported too.',
        'During search, the automaton reads one text character at a time. If a goto edge exists, follow it. If not, follow failure links until a transition exists or the root is reached. After each transition, emit the output set for the current state.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Construction is linear in the total pattern length, up to alphabet-transition representation choices. Search is O(n + z), where n is text length and z is the number of matches reported. Space is proportional to trie states, transitions, failure links, and output references.',
        'The output term matters. A dictionary with many overlapping patterns can produce many matches at one character. That is not inefficiency; it is the required result size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Aho-Corasick is used in intrusion detection, antivirus signatures, spam filters, content moderation, token scanners, log inspection, DNA motif search, and bibliographic keyword search. The original paper frames it as an aid to bibliographic search, but the same compiled-dictionary idea appears across modern systems.',
        'A complete case study is a network payload scanner. Thousands of signatures are compiled once. Each packet stream is scanned in one pass. When a signature suffix overlaps another signature, output inheritance reports both without restarting the scan.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Aho-Corasick assumes a known dictionary. If patterns change constantly, rebuild cost or dynamic variants matter. Another trap is ignoring normalization: case folding, Unicode, token boundaries, and escaping can decide whether matches are meaningful.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Aho and Corasick, Efficient String Matching: An Aid to Bibliographic Search, at https://cr.yp.to/bib/1975/aho.pdf. Study Trie, KMP Prefix Function, Finite State Machines, Inverted Index, Suffix Array & LCP, and Bloom Filter next.',
      ],
    },
  ],
};
