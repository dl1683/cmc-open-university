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
      heading: `Why this exists`,
      paragraphs: [
        `Aho-Corasick exists because many systems search for a dictionary of patterns, not one pattern. Antivirus signatures, intrusion detection, content filters, token scanners, and DNA motif tools need every keyword match, including overlaps, while reading the text once.`,
        `The important constraint is that the dictionary is reused. You pay a preprocessing cost to compile all patterns into a machine, then every stream benefits. That is different from one-off search, where building the automaton may cost more than it saves.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The reasonable first attempt is to run KMP or a normal substring search once per pattern. That keeps each matcher simple, but it repeats the text scan and repeats overlap reasoning across patterns that share prefixes or suffixes.`,
        `A second approach is to build one giant regular expression. Some regex engines can optimize this, but the behavior depends on engine internals and pattern shape. Aho-Corasick gives a direct data-structure contract: one compiled automaton, one scan, every exact dictionary match.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The wall is repeated scanning and overlap handling. If the dictionary has thousands of patterns, one pass per pattern is too expensive. If patterns overlap, separate matchers also rediscover the same suffix facts instead of sharing them.`,
        `The other wall is streaming. In a network scanner or log pipeline, the text may not sit in one convenient string. The matcher needs to carry state across chunks. A finite-state automaton is a natural fit because the current state summarizes the useful suffix of everything seen so far.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Compile the dictionary into one automaton. A trie shares prefixes. Failure links share the best suffix fallback, just as KMP does for one pattern. Output inheritance makes suffix patterns visible, so matching "she" can also report "he" when both belong to the dictionary.`,
        `This turns many independent searches into one state update per character. The text pointer is sacred: it moves forward only. All the complexity is pushed into the automaton state, failure links, and output lists built before scanning begins.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        "In the trie view, read normal edges as successful character consumption and failure edges as preserved suffix knowledge. A failure edge is not an error path. It is the automaton saying, \"this longer prefix failed, but this shorter suffix is still useful.\"",
        "In the stream view, watch the text pointer: it never rewinds. The current automaton state carries the longest dictionary prefix that is also a suffix of the text seen so far. Outputs fire whenever that state, or one of its output-linked suffix states, ends a pattern.",
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Insert every pattern into a trie. Build failure links breadth-first so each parent fallback is known before its children need it. During search, read one text character, follow a goto edge if it exists, otherwise follow failure links until a transition exists or the root is reached. Emit the current state's output set after each character.`,
        `For streaming input, keep the current state between chunks. If one chunk ends with "sh" and the next begins with "e", the matcher should still emit "she". Resetting state at chunk boundaries is a common implementation bug.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The invariant is that the current state represents the longest suffix of the text prefix that is also a trie prefix. A missing transition means the current prefix cannot continue, but a shorter suffix might. Failure links move to exactly that next possible suffix, so no match is skipped and the text pointer never rewinds.`,
        `Output inheritance is the second invariant. If a state represents "she", then suffix state "he" may also be a completed pattern. The matcher must report both because both end at the current character. That is why Aho-Corasick handles overlapping matches naturally.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Construction is linear in the total pattern length, up to transition representation. Search is O(n + z), where n is text length and z is the number of matches reported. Space stores trie states, transitions, failure links, and output references. The z term is unavoidable when many patterns end at the same position.`,
        `Transition representation is the practical cost knob. A dense alphabet table gives fast transitions and high memory use. Hash maps or sorted edge lists save memory but cost lookup time. Security scanners often care about both because pattern dictionaries can be large and streams can be continuous.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Aho-Corasick wins when the dictionary is known ahead of time and the stream is large: network payload scanning, antivirus signatures, spam filters, content moderation, log inspection, DNA motif search, bibliographic keyword search, and token scanners. Compile once, scan many streams.`,
        `It also wins when false negatives are expensive. Because the automaton is exact for its normalized input, every dictionary string occurrence is found. Ranking, policy, and suppression can happen later, but the candidate generation layer remains complete.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `If patterns change constantly, rebuild cost or dynamic variants matter. If the alphabet is large, transition storage can dominate. Normalization is part of correctness: case folding, Unicode normalization, token boundaries, escaping, and word-boundary rules decide what a match means before the automaton ever runs.`,
        `It also fails when a match is not a pure substring question. Regular expressions with unbounded repetition, approximate matching, semantic equivalence, or context-sensitive policy need additional machinery. Aho-Corasick finds dictionary strings exactly and fast; it does not understand language by itself.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `With dictionary he, she, his, and hers, scanning "ushers" reaches state "she" when it reads the e. That state reports "she." Its output-linked suffix state is "he," so the same character position also reports "he." The scanner then continues to r and s and reports "hers."`,
        `A naive dictionary loop would scan the text separately for each word. Aho-Corasick turns the dictionary into one shared machine. The shared prefixes live in the trie; the shared suffix recoveries live in the failure links.`,
      ],
    },
    {
      heading: `Implementation checklist`,
      paragraphs: [
        `Normalize input before building and scanning. Decide case folding, Unicode normalization, token boundaries, punctuation handling, and escape decoding up front. The automaton can only match the byte or character stream it is given.`,
        `Store outputs as pattern ids, not as copied strings, when the dictionary is large. If suffix outputs are frequent, consider output links or compact inherited-output lists so reporting stays efficient without duplicating huge arrays on every state.`,
        `Choose transition storage based on alphabet and dictionary size. Dense arrays are fast for small fixed alphabets. Maps or sorted edge lists are better when the alphabet is large and most states have few outgoing edges.`,
      ],
    },
    {
      heading: `Rule of thumb`,
      paragraphs: [
        `Use Aho-Corasick when the dictionary is mostly fixed and the text stream is large. Compile once, scan many times. The more patterns share prefixes and suffixes, the more valuable the shared automaton becomes.`,
        `Do not use it as a policy engine by itself. It finds exact pattern occurrences. Decisions about word boundaries, allowed contexts, severity, false positives, and semantic meaning belong in layers around the matcher.`,
        `A good integration reports enough evidence for the next layer: pattern id, start offset, end offset, normalized text version, and scanner state if the match crossed a chunk boundary. That makes fast matching debuggable instead of turning it into a black box. Debuggable matchers are much easier to tune safely.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Primary source: Aho and Corasick, Efficient String Matching: An Aid to Bibliographic Search, at https://cr.yp.to/bib/1975/aho.pdf. Study Trie, KMP Prefix Function, Finite State Machines, Inverted Index, Suffix Array & LCP, and Bloom Filter next.`,
      ],
    },
  ],
};
