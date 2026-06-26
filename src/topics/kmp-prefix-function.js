// KMP prefix function: reuse the longest border instead of backing up text.

import { sequenceState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kmp-prefix-function',
  title: 'KMP Prefix Function',
  category: 'Data Structures',
  summary: 'Linear string matching by precomputing borders: when a mismatch happens, the pattern falls back without rewinding the text.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['prefix table', 'search fallback'], defaultValue: 'prefix table' },
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

function chars(text, title) {
  return sequenceState('queue', [...text].map((ch, i) => ({ id: `c${i}`, value: `${i}:${ch}` })), { title });
}

function prefixTable(title) {
  return labelMatrix(
    title,
    [
      { id: 'i0', label: 'i=0 a' },
      { id: 'i1', label: 'i=1 b' },
      { id: 'i2', label: 'i=2 a' },
      { id: 'i3', label: 'i=3 b' },
      { id: 'i4', label: 'i=4 a' },
      { id: 'i5', label: 'i=5 c' },
    ],
    [
      { id: 'border', label: 'longest border' },
      { id: 'pi', label: 'pi[i]' },
      { id: 'fallback', label: 'fallback on mismatch' },
    ],
    [
      ['', '0', 'none'],
      ['', '0', 'none'],
      ['a', '1', 'pi[0]'],
      ['ab', '2', 'pi[1]'],
      ['aba', '3', 'pi[2]'],
      ['', '0', 'pi[2] -> pi[0] -> 0'],
    ],
  );
}

function* buildPrefixTable() {
  const pattern = 'ababac';
  const patternLen = pattern.length;

  yield {
    state: chars('ababac', 'Pattern: ababac'),
    highlight: { active: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'] },
    explanation: `KMP starts by studying the ${patternLen}-character pattern, not the text. For each prefix ending at i, it records the length of the longest proper prefix that is also a suffix, called a border.`,
  };

  yield {
    state: prefixTable('Prefix-function table for ababac'),
    highlight: { found: ['i2:border', 'i3:border', 'i4:border'], compare: ['i5:fallback'] },
    explanation: `At i=${patternLen - 2}, the prefix ababa has border aba, so pi[${patternLen - 2}] = 3. That means if the next character mismatches after matching ababa, the pattern can fall back to length 3 without losing useful work.`,
    invariant: `pi[i] is always a border length of pattern[0..i] for the ${patternLen}-character pattern.`,
  };

  yield {
    state: prefixTable('Mismatch while building c: fall through old borders'),
    highlight: { active: ['i5:fallback'], compare: ['i4:pi', 'i2:pi', 'i0:pi'] },
    explanation: `When ${pattern[patternLen - 1]} mismatches the expected b after ababa, the builder does not restart from scratch. It tries the next shorter border: aba, then a, then empty. Each fallback is another prefix-function lookup.`,
  };

  yield {
    state: labelMatrix(
      'Why the builder is linear',
      [
        { id: 'advance', label: 'match advances i' },
        { id: 'fallback', label: 'mismatch lowers j' },
        { id: 'noTextBack', label: 'text never rewinds' },
        { id: 'total', label: 'total work' },
      ],
      [
        { id: 'movement', label: 'movement' },
        { id: 'bound', label: 'bound' },
      ],
      [
        ['i increases', 'at most m times'],
        ['j follows pi[j-1]', 'at most m drops'],
        ['single pass', 'core KMP idea'],
        ['all table work', 'O(m)'],
      ],
    ),
    highlight: { found: ['total:bound'], active: ['fallback:bound'] },
    explanation: `KMP builds the table in O(${patternLen}) time — an amortized pointer argument over borders. The fallback pointer can drop many times, but it can only drop after previous successful advances.`,
  };
}

function* searchFallback() {
  const text = 'ababababac';
  const textLen = text.length;
  const pattern = 'ababac';
  const patternLen = pattern.length;
  const matchPos = 4;

  yield {
    state: chars('ababababac', 'Text: ababababac, pattern: ababac'),
    highlight: { active: ['c0', 'c1', 'c2', 'c3', 'c4'], compare: ['c5'] },
    explanation: `The search scans all ${textLen} text characters once. Suppose the pattern has matched ${patternLen - 1} characters and the next text character is b, but the pattern expects c. Naive search would slide the pattern and recheck characters.`,
  };

  yield {
    state: prefixTable('Fallback from length 5 to length 3'),
    highlight: { active: ['i4:pi'], found: ['i4:border'], compare: ['i5:fallback'] },
    explanation: `KMP uses pi[${patternLen - 2}] = 3. The already matched suffix aba can also be the ${patternLen}-character pattern's prefix aba, so the algorithm keeps those three matched characters and continues from pattern index 3.`,
  };

  yield {
    state: chars('ababababac', 'Continue from the same text position'),
    highlight: { active: ['c5', 'c6', 'c7', 'c8', 'c9'], found: ['c4', 'c5', 'c6', 'c7', 'c8', 'c9'] },
    explanation: `The text index never moves backward across all ${textLen} characters. After enough fallback and forward matches, the pattern ${pattern} is found at text position ${matchPos}. The saved work is exactly the overlap encoded in the prefix table.`,
  };

  yield {
    state: labelMatrix(
      'KMP versus nearby string tools',
      [
        { id: 'naive', label: 'naive search' },
        { id: 'kmp', label: 'KMP' },
        { id: 'aho', label: 'Aho-Corasick' },
        { id: 'suffix', label: 'Suffix Array' },
      ],
      [
        { id: 'preprocess', label: 'preprocess' },
        { id: 'best', label: 'best for' },
      ],
      [
        ['none', 'tiny inputs'],
        ['one pattern', 'streaming exact search'],
        ['many patterns', 'dictionary matching'],
        ['whole text index', 'many arbitrary queries'],
      ],
    ),
    highlight: { active: ['kmp:best'], compare: ['aho:best', 'suffix:best'] },
    explanation: `KMP searches ${textLen} characters in O(${textLen} + ${patternLen}) time — the single-pattern streaming member of the string-search family. It is the simplest place to learn failure links before Aho-Corasick generalizes them to a trie.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'prefix table') yield* buildPrefixTable();
  else if (view === 'search fallback') yield* searchFallback();
  else throw new InputError('Pick a KMP view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the prefix table as a record of pattern self-overlap. Active cells are being computed, found cells are finalized border lengths, and compare cells show the fallback chain through shorter borders.',
        { type: 'callout', text: 'KMP never moves the text pointer backward because every fallback is a proof about pattern self-overlap, not a guess about the text.' },
        'The safe inference rule is that a border can be reused after a mismatch. A border is a proper prefix that is also a suffix, so the already matched suffix can become the next candidate prefix without rereading text.',
        {type: 'image', src: './assets/gifs/kmp-prefix-function.gif', alt: 'Animated walkthrough of the kmp prefix function visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Substring search asks whether a pattern appears inside a text. The naive method can repeat the same comparisons many times when the pattern has internal repetition.',
        'KMP exists to reuse the information learned from a partial match. It preprocesses the pattern once, then scans the text left to right without backing up the text pointer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious method aligns the pattern at text position 0 and compares characters left to right. On mismatch, it shifts the pattern one position and starts again.',
        'This is correct and easy to code. It is also forgetful because a mismatch after five matched characters throws away what those five comparisons proved about the text.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears on repeated characters. Searching for AAAAAB inside a long run of A characters makes naive search match five A characters, fail on B, shift one step, and repeat.',
        'For text length n and pattern length m, that worst case is O(nm). The input is not hard because it has rich structure; it is hard because the algorithm keeps reproving the same overlaps.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A prefix function stores, for every pattern prefix ending at i, the length of its longest border. In ABABA, the substring ABA is a border because it is both the start and the end.',
        { type: 'image', src: 'https://cgi.cse.unsw.edu.au/~cs2521/19T1/lecs/week09a/Pic/kmp-shift.png', alt: 'KMP shift after mismatch using a prefix that is also a suffix', caption: 'The failure shift keeps the matched border and resumes without re-reading earlier text characters. Source: https://cgi.cse.unsw.edu.au/~cs2521/19T1/lecs/week09a/.' },
        'After a mismatch at pattern index j, pi[j-1] tells which prefix can still match the suffix just seen. The pattern pointer falls back to that length, while the text pointer stays where it is.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First build the prefix table from the pattern alone. Walk the pattern with index i and candidate border length j; on a match, extend j, and on a mismatch, set j to pi[j-1] until a shorter border works or j reaches zero.',
        { type: 'image', src: 'https://cgi.cse.unsw.edu.au/~cs2521/19T1/lecs/week09a/Pic/kmp-failure-function.png', alt: 'KMP failure function values for pattern abaaba', caption: 'The failure function stores the longest usable border at each pattern position, which turns mismatch recovery into an array lookup. Source: https://cgi.cse.unsw.edu.au/~cs2521/19T1/lecs/week09a/.' },
        'Then scan the text with match length j. If text[i] matches pattern[j], advance; if it mismatches and j is positive, fall back with j = pi[j-1]; if j is zero, advance the text pointer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that j characters of the pattern match the suffix of the text already scanned. On mismatch, the longest border is the largest prefix that could still be aligned with that suffix.',
        'No skipped alignment can be valid. A valid skipped alignment would require a longer border than pi[j-1], which contradicts the definition of the prefix function.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building the table costs O(m) time and O(m) space for pattern length m. Searching costs O(n) time for text length n, so total time is O(n + m).',
        'The text pointer advances at most n times. The pattern pointer can fall back many times locally, but each fallback cancels a previous advance, so the total number of fallbacks is linear.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'KMP fits streaming exact search where the input should be read once. Text editors, log scanners, packet inspection tools, and DNA motif searches all benefit from deterministic linear behavior.',
        'It is also the cleanest bridge to multi-pattern matching. Aho-Corasick generalizes KMP-style failure links from one pattern to a trie of many patterns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'KMP is not usually the fastest practical string search on natural language. Boyer-Moore variants and two-way search can skip more text on large alphabets and are common in standard libraries.',
        'It also handles exact single-pattern matching only. Approximate matching, regular expressions, many arbitrary queries over one fixed text, and semantic search need different tools.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build pi for pattern ABCABD. The prefixes A, AB, and ABC have no non-empty border, so pi starts [0, 0, 0].',
        'For ABCA, the border A has length 1, so pi[3] = 1. For ABCAB, the border AB has length 2, so pi[4] = 2.',
        'At ABCABD, the next expected border character would be C, but the pattern has D. Fall back from border AB to the empty border, record pi[5] = 0, and the final table is [0, 0, 0, 1, 2, 0].',
        'Search ABCABD in ABCABCABD. After matching ABCAB, the text has C where the pattern expects D, so KMP uses pi[4] = 2, keeps the suffix AB, compares C with pattern[2], and finds the full match starting at text position 3.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Knuth, Morris, and Pratt, Fast Pattern Matching in Strings, SIAM Journal on Computing, 1977. The paper proves linear-time exact matching by using the pattern failure function.',
        'Study Rabin-Karp for hashing, Boyer-Moore for practical skip heuristics, and Aho-Corasick for many patterns at once. Study suffix arrays when the text is fixed and many future pattern queries must be answered.',
      ],
    },
  ],
};
