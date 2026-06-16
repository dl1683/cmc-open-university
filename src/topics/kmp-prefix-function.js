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
      heading: 'What it is',
      paragraphs: [
        'KMP, the Knuth-Morris-Pratt algorithm, is a linear-time exact string matching algorithm. It searches for one pattern in a text without backing up the text pointer. The trick is a prefix function that records reusable border lengths of the pattern.',
        'A border is a proper prefix that is also a suffix. For pattern ababac, the prefix ababa has border aba. If a mismatch happens after matching ababa, KMP can keep the suffix aba as an already matched prefix and continue from there.',
        'The useful mental shift is that a mismatch is not a failure of all previous work. It is evidence about which shorter prefix could still be alive. The prefix table encodes that evidence before the text scan begins.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Preprocessing builds pi[i], the length of the longest border of pattern[0..i]. During search, j is the number of pattern characters currently matched. If text[i] matches pattern[j], both advance. If they mismatch and j is not zero, j becomes pi[j - 1]. If j is zero, the text advances.',
        'The text pointer never rewinds. All the recovery happens inside the pattern pointer. This is why KMP is friendly to streams and external files: once a character has been consumed, it never has to be read again.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Prefix computation is O(m) for pattern length m. Search is O(n) for text length n. Space is O(m) for the prefix table. The linear proof follows the same amortized shape as Monotonic Queue: pointers can fall back, but only after they previously advanced.',
        'The algorithm is deterministic and exact. There are no hashes, false positives, or probabilistic shortcuts. Its cost does not depend on the alphabet size except for ordinary character comparisons.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'KMP is used in streaming search, text editors, log scanners, network payload inspection, DNA motif search, compiler tools, and anywhere a fixed pattern must be found without rereading input. It is also pedagogically important because Aho-Corasick extends the failure-link idea from one pattern to many patterns.',
        'A complete case study is searching a large log stream for ERROR:TIMEOUT. A naive algorithm may reread overlapping prefixes when repeated text appears. KMP preprocesses the pattern once, then scans the stream exactly once while preserving overlaps through the prefix table.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The prefix function is not a table of shifts in text coordinates. It is a table of pattern border lengths. Another trap is using KMP for many patterns independently; Aho-Corasick is usually better when the dictionary is known in advance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Knuth, Morris, and Pratt, Fast Pattern Matching in Strings, at https://www.cs.jhu.edu/~misha/Spring23/Knuth77.pdf. Study Trie, Aho-Corasick Automaton, Suffix Array & LCP, Suffix Automaton, Eertree Palindromic Tree, Finite State Machines, and Big-O Growth Rates next.',
      ],
    },
  ],
};
