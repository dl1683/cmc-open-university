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
  yield {
    state: chars('ababac', 'Pattern: ababac'),
    highlight: { active: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'] },
    explanation: 'KMP starts by studying the pattern, not the text. For each prefix ending at i, it records the length of the longest proper prefix that is also a suffix, called a border.',
  };

  yield {
    state: prefixTable('Prefix-function table for ababac'),
    highlight: { found: ['i2:border', 'i3:border', 'i4:border'], compare: ['i5:fallback'] },
    explanation: 'At i=4, the prefix ababa has border aba, so pi[4] = 3. That means if the next character mismatches after matching ababa, the pattern can fall back to length 3 without losing useful work.',
    invariant: 'pi[i] is always a border length of pattern[0..i].',
  };

  yield {
    state: prefixTable('Mismatch while building c: fall through old borders'),
    highlight: { active: ['i5:fallback'], compare: ['i4:pi', 'i2:pi', 'i0:pi'] },
    explanation: 'When c mismatches the expected b after ababa, the builder does not restart from scratch. It tries the next shorter border: aba, then a, then empty. Each fallback is another prefix-function lookup.',
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
    explanation: 'KMP is an amortized pointer argument over borders. The fallback pointer can drop many times, but it can only drop after previous successful advances.',
  };
}

function* searchFallback() {
  yield {
    state: chars('ababababac', 'Text: ababababac, pattern: ababac'),
    highlight: { active: ['c0', 'c1', 'c2', 'c3', 'c4'], compare: ['c5'] },
    explanation: 'The search scans the text once. Suppose the pattern has matched ababa and the next text character is b, but the pattern expects c. Naive search would slide the pattern and recheck characters.',
  };

  yield {
    state: prefixTable('Fallback from length 5 to length 3'),
    highlight: { active: ['i4:pi'], found: ['i4:border'], compare: ['i5:fallback'] },
    explanation: 'KMP uses pi[4] = 3. The already matched suffix aba can also be the pattern prefix aba, so the algorithm keeps those three matched characters and continues from pattern index 3.',
  };

  yield {
    state: chars('ababababac', 'Continue from the same text position'),
    highlight: { active: ['c5', 'c6', 'c7', 'c8', 'c9'], found: ['c4', 'c5', 'c6', 'c7', 'c8', 'c9'] },
    explanation: 'The text index never moves backward. After enough fallback and forward matches, the pattern ababac is found at text position 4. The saved work is exactly the overlap encoded in the prefix table.',
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
    explanation: 'KMP is the single-pattern streaming member of the string-search family. It is the simplest place to learn failure links before Aho-Corasick generalizes them to a trie.',
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
      heading: `Why this exists`,
      paragraphs: [
        `KMP exists because exact substring search can waste work on repeated structure. A mismatch after several matching characters does not always mean the whole attempt is useless. If the pattern overlaps with itself, a suffix of the text already matched may also be a prefix of the pattern. The algorithm should reuse that fact instead of backing the text pointer up and proving it again.`,
        `This is a small idea with a large payoff. KMP turns single-pattern search into a linear scan by moving the pattern pointer through precomputed fallback links. It is also the cleanest first example of failure links, the same family of ideas that later appears in Aho-Corasick, automata, and other string-processing tools.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The obvious algorithm aligns the pattern at text position 0 and compares left to right. On mismatch, it slides the pattern one position and starts over. This is correct and often fine for short patterns, short text, or ordinary library calls where the implementation is already optimized.`,
        `The problem is not correctness. The problem is that the naive method throws away information. If the pattern matched five characters before failing, the algorithm has learned something about the last five text characters. Starting over from the next text position ignores that evidence and can recompare the same characters many times.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The worst cases are built from repetition. Search for a pattern such as aaaaab inside a long run of a characters followed by something else. At each alignment, the naive algorithm matches many a characters, fails near the end, shifts by one, and repeats almost the same comparisons.`,
        `For text length n and pattern length m, that can cost O(nm) comparisons. The text is not large because it contains rich information. It is large because the algorithm keeps forgetting. KMP's goal is to remember just enough about the pattern to avoid this repeated proof.`,
      ],
    },
    {
      heading: `Borders`,
      paragraphs: [
        `The key word is border. A border of a string is a proper prefix that is also a suffix. In ababa, the string aba is a border because ababa starts with aba and ends with aba. The string a is also a border. The whole string is not counted as a proper border.`,
        `The prefix function pi[i] stores the length of the longest border of pattern[0..i]. For pattern ababac, the prefix ending at index 4 is ababa, whose longest border is aba, so pi[4] = 3. That number is saved overlap. It says how much of the pattern can remain matched after a mismatch at the next character.`,
      ],
    },
    {
      heading: `Core insight and mechanism`,
      paragraphs: [
        `KMP does two passes. First it builds the prefix table from the pattern. Then it scans the text using that table. During the scan, j is the number of pattern characters currently matched. If text[i] equals pattern[j], both pointers advance. If they differ and j is positive, j becomes pi[j - 1]. If j is zero, only the text pointer advances.`,
        `The important detail is that a fallback changes the pattern position, not the text position. The algorithm keeps the text character under inspection and asks whether a shorter border can still be extended by that same character. This is why KMP works in streams and files where rewinding input is expensive or impossible.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `The prefix-table view shows the pattern ababac. The table is not a list of shift amounts. It is a list of border lengths. A value of 3 means the current matched prefix has a length-3 suffix that is also the pattern's length-3 prefix.`,
        `The search-fallback view shows the payoff. The text pointer stays in place while the pattern pointer drops from a longer prefix to a shorter border. Alignments that contradict already compared characters are skipped without being tried one by one.`,
      ],
    },
    {
      heading: `Building the prefix table`,
      paragraphs: [
        `The prefix table is built with the same fallback idea used during search. Walk through the pattern with i as the current position and j as the length of the current candidate border. If pattern[i] equals pattern[j], extend the border and set pi[i] to j + 1. If they differ, replace j with pi[j - 1] and try the next shorter border.`,
        `For ababac, the builder reaches ababa with border length 3. The next character is c, but the character expected after border aba is b. The builder falls back from aba to a, then from a to empty, and records pi[5] = 0. Those fallback steps are not wasted; they are exactly the facts the search will need later.`,
      ],
    },
    {
      heading: `Searching with fallback`,
      paragraphs: [
        `Now search for ababac inside ababababac. The scan matches ababa and then sees a text b where the pattern expects c. Naive search would slide the pattern and recheck characters. KMP uses pi[4] = 3, keeping the suffix aba as an already matched prefix candidate.`,
        `The next comparison continues from pattern index 3 at the same text position. After another advance and fallback sequence, the full pattern is found starting at text position 4. The search feels like it is skipping alignments, but it is really proving those alignments impossible from the border structure.`,
      ],
    },
    {
      heading: `Why it is linear`,
      paragraphs: [
        `The linear-time proof is an amortized pointer argument. The text pointer i only moves forward. The pattern pointer j can move forward on matches and backward on fallbacks. A long chain of fallbacks is possible, but every drop is paid for by earlier increases in j. It cannot drop below zero, so the total amount of falling is bounded by the total amount of rising.`,
        `Prefix construction is O(m). Search is O(n). Space is O(m) for the prefix table. KMP is deterministic and exact; it has no hash collisions, no probabilistic false positives, and no dependency on character distribution. That predictability is the main reason it remains worth learning even when library substring search uses other tricks.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Use zero-based indexing and be precise about what pi means. pi[i] is a length, not an index. When a mismatch happens after j matched characters, the next candidate length is pi[j - 1]. Many bugs come from using pi[j] or from advancing the text pointer during a fallback when j is still positive.`,
        `Handle the empty pattern deliberately. Decide whether it matches at position 0, every position, or is invalid for the API. Normalize text before search if the domain needs case folding, Unicode normalization, accent handling, or token boundaries. KMP only sees equality over the sequence it is given; it does not know what a human considers the same character.`,
      ],
    },
    {
      heading: `Worked case`,
      paragraphs: [
        `Pattern ababac has prefix values 0, 0, 1, 2, 3, 0. The value 3 at index 4 corresponds to the border aba. During search, matching ababa means the last five consumed text characters equal that prefix. If the next text character is not c, the suffix aba is still useful because it can serve as the beginning of a new match.`,
        `KMP falls back to length 3 and compares from there. It does not claim the earlier alignment was successful. It claims that any alignment longer than the border is impossible because it would require characters already compared to be different from what they were. That is the exact piece of reasoning the prefix table encodes.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `KMP wins when one fixed pattern is searched through a stream, external file, log feed, network payload, DNA sequence, editor buffer, or any source where rereading is costly. It is also useful when predictable worst-case behavior matters more than average-case skipping.`,
        `As a learning topic, it is the best bridge from simple arrays to automata. The prefix table is a compact failure function for one pattern. Aho-Corasick generalizes that failure function to a trie of many patterns. Suffix arrays and suffix automata solve a different problem: indexing a text so many later queries become fast.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `KMP is not always the fastest practical substring matcher. Boyer-Moore-style algorithms can skip farther on ordinary text, vectorized library routines can compare many bytes at once, and specialized engines can exploit CPU instructions. KMP's strength is simple linear worst-case behavior, not universal real-world speed.`,
        `It also does not solve approximate matching, regular expressions, edit distance, tokenization, locale policy, or semantic matching. If the query is many patterns, use Aho-Corasick or another multi-pattern index. If the query is many searches over one static text, study suffix arrays, suffix trees, suffix automata, or full-text indexing.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary source: Knuth, Morris, and Pratt, Fast Pattern Matching in Strings, at https://www.cs.jhu.edu/~misha/Spring23/Knuth77.pdf.`,
        `Study Trie and Aho-Corasick Automaton next to see failure links over many patterns. Then study Suffix Array & LCP, Suffix Automaton, Eertree Palindromic Tree, Finite State Machines, Rolling Hash, Rabin-Karp, and Big-O Growth Rates for the surrounding string-search landscape.`,
      ],
    },
  ],
};
