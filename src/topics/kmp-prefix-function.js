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
        'The prefix-table view builds the failure function for pattern ababac. Active cells mark the position being computed. Found cells show border lengths already finalized. The compare color traces the fallback chain when a character fails to extend the current border -- watch it cascade through shorter borders until one works or the chain bottoms out at zero.',
        { type: 'callout', text: 'KMP never moves the text pointer backward because every fallback is a proof about pattern self-overlap, not a guess about the text.' },
        'The search-fallback view runs KMP on text ababababac. Active cells are the text window currently aligned with the pattern. Found cells mark characters confirmed as part of a match. On mismatch, the pattern pointer drops through the fallback chain while the text pointer stays fixed. That frozen text pointer is the visual proof that KMP never backtracks through the text.',
        'In both views, track two things: the text pointer only moves right, and every fallback of the pattern pointer was paid for by an earlier advance. Those two facts make the algorithm linear.',
      
        {type: 'image', src: './assets/gifs/kmp-prefix-function.gif', alt: 'Animated walkthrough of the kmp prefix function visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Knuth, Morris, and Pratt published "Fast Pattern Matching in Strings" in 1977 to kill redundant work in substring search. The paper circulated as a Stanford technical report from 1974. The problem: when a naive search matches several characters of a pattern and then fails, it slides the pattern forward by one position and re-examines characters it already compared. If the pattern has internal repetition, those re-examinations compound to O(nm) comparisons.',
        'KMP eliminates them with a precomputed table called the failure function (also called the partial match table or prefix function). The table encodes the pattern\'s self-overlap so that on any mismatch, the algorithm knows exactly how far to shift without re-reading a single text character. The result is the first guaranteed linear-time single-pattern string matcher: O(n+m) time, no exceptions. KMP is also the cleanest introduction to failure links, the structural idea that Aho-Corasick later generalizes to a trie of many patterns.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Align the pattern at text position 0 and compare left to right. On mismatch, slide the pattern one position forward and start over. This brute-force method is correct and works fine for short inputs or low-repetition text.',
        'The problem is not correctness -- it is amnesia. If the pattern matched five characters before failing, the algorithm has learned something about those five text characters. Sliding by one and restarting throws that information away. Every discarded partial match is wasted work that a smarter algorithm could reuse.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The worst cases are built from repetition. Search for AAAAAB in a text of ten thousand A characters followed by a B. At each alignment the naive algorithm matches five A characters, fails at B versus A, slides by one, and repeats almost the same comparisons. For text length n and pattern length m, this costs O(nm) comparisons.',
        'The text is not large because it contains rich information. It is large because the algorithm keeps forgetting what it already proved. KMP exists to remember just enough about the pattern\'s internal structure to avoid that repeated proof.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The key concept is a border: a proper prefix of a string that is also a suffix. In ABABA, the string ABA is a border because ABABA starts with ABA and ends with ABA. The prefix function pi[i] stores the length of the longest border of pattern[0..i].',
        { type: 'image', src: 'https://cgi.cse.unsw.edu.au/~cs2521/19T1/lecs/week09a/Pic/kmp-shift.png', alt: 'KMP shift after mismatch using a prefix that is also a suffix', caption: 'The failure shift keeps the matched border and resumes without re-reading earlier text characters. Source: https://cgi.cse.unsw.edu.au/~cs2521/19T1/lecs/week09a/.' },
        'When a mismatch occurs after matching j characters, the matched portion pattern[0..j-1] has a longest border of length pi[j-1]. That border is simultaneously the end of what was just matched and the beginning of the pattern. So the algorithm can jump the pattern pointer to position pi[j-1] -- keeping those already-matched border characters -- and continue comparing from there. The text pointer never moves backward. Every skipped alignment is provably impossible: it would require a border longer than the one pi already records.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'KMP runs two passes. First, build the prefix table from the pattern alone. Walk through the pattern with index i and a candidate border length j. If pattern[i] equals pattern[j], extend the border: pi[i] = j+1, advance both. If they differ and j > 0, fall back: j = pi[j-1] and retry with the next shorter border. If j = 0, record pi[i] = 0 and advance i. This builds the entire table in O(m) time.',
        { type: 'image', src: 'https://cgi.cse.unsw.edu.au/~cs2521/19T1/lecs/week09a/Pic/kmp-failure-function.png', alt: 'KMP failure function values for pattern abaaba', caption: 'The failure function stores the longest usable border at each pattern position, which turns mismatch recovery into an array lookup. Source: https://cgi.cse.unsw.edu.au/~cs2521/19T1/lecs/week09a/.' },
        'Second, scan the text. Maintain a match length j (how many pattern characters are currently matched). If text[i] equals pattern[j], advance both pointers. If they differ and j > 0, set j = pi[j-1] -- the pattern pointer drops to the next viable border while the text pointer stays put. If j = 0, advance only the text pointer. When j reaches m, a full match is found.',
        'The critical detail: a fallback changes the pattern position, not the text position. The algorithm holds the current text character fixed and asks whether a shorter prefix of the pattern can still be extended by that character. This is why KMP works on streams, pipes, and network sockets where rewinding the input is expensive or impossible.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the border invariant. At every point during the scan, j characters of the pattern are matched against the text ending at position i. When a mismatch occurs, pi[j-1] gives the longest proper prefix of the matched portion that is also a suffix. Jumping to that length preserves exactly the characters that are still matched. Any alignment between the old position and the border position would require a longer border than pi records, which contradicts the maximality of the prefix function.',
        'The algorithm never misses a match because every skipped alignment is impossible. If an alignment were valid, the pattern would have to have a border longer than pi[j-1] at that position -- but pi already stores the longest one. No valid alignment is skipped; no invalid alignment is tried.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building the prefix table costs O(m) time and O(m) space, where m is the pattern length. The search pass costs O(n) time, where n is the text length. Total: O(n+m) time, O(m) space. The text pointer advances at most n times and never retreats. The pattern pointer can fall back many times on a single text character, but each fallback cancels a previous advance -- total fallbacks across the entire search are bounded by n.',
        'Doubling the text doubles the search time. Doubling the pattern doubles the table-build time and table size but does not change how many text characters are inspected. For a 1,000-character pattern in a 1,000,000-character text, KMP performs at most about 1,001,000 comparisons. Naive search in the worst case: up to 1,000,000,000. KMP is deterministic: no hash collisions, no probabilistic false positives, no dependence on alphabet size or character distribution.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Text editors and IDEs use KMP-style failure links for find and replace -- the user types a search string once, and the editor scans the buffer in a single forward pass without backtracking. Grep implementations on streams use the same principle: read once, match once, never rewind.',
        'Intrusion detection systems scan network packets for known attack signatures. The packet stream cannot be re-read, and worst-case guarantees matter because an attacker can craft input to trigger O(nm) behavior in naive matchers. Bioinformatics searches for short DNA motifs in genomes billions of bases long -- linear time is the difference between minutes and days.',
        'KMP also serves as a teaching bridge. The prefix table is a compact failure function for one pattern. Aho-Corasick generalizes that failure function to a trie of many patterns. Understanding KMP first makes Aho-Corasick, suffix trees, and automaton-based matchers far easier to learn.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'On average-case inputs -- natural language with large alphabets and low repetition -- brute force often terminates mismatches after one or two characters, making its practical speed close to KMP. The guaranteed linear bound matters mainly on adversarial or highly repetitive inputs.',
        'Boyer-Moore compares from the end of the pattern and uses bad-character and good-suffix heuristics to skip entire sections of text. On English text it often inspects fewer than n characters total, which KMP cannot do. Most production string-search routines (glibc strstr, Python str.find) use Boyer-Moore variants or two-way search, not KMP.',
        'Rabin-Karp uses rolling hashes and is simpler to code, with expected O(n+m) time, though hash collisions can degrade the worst case to O(nm). For searching many patterns simultaneously, Aho-Corasick is the right tool. For many queries over one fixed text, suffix arrays or suffix trees are better -- they preprocess the text once so each query costs O(m log n) or O(m). KMP does not handle approximate matching, regular expressions, edit distance, or semantic similarity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build the failure table for ABCABD. pi[0]=0: A alone has no proper border. pi[1]=0: AB -- no prefix equals a suffix. pi[2]=0: ABC -- no prefix equals a suffix. pi[3]=1: ABCA starts and ends with A, border length 1. pi[4]=2: ABCAB starts with AB and ends with AB, extending the previous border to length 2. pi[5]=0: ABCABD -- the character after border AB is C, but we need D. Fall back: check the border of AB, which is empty (pi[1]=0). No match at length 0 either. Record pi[5]=0. Final table: [0, 0, 0, 1, 2, 0].',
        'Search for ABCABD in text ABCABCABD. Match positions 0-4: A,B,C,A,B all match pattern[0..4]. Position 5: text has C, pattern expects D. Mismatch. Consult pi[4]=2: the suffix AB of the matched portion is also the pattern prefix AB, so jump the pattern pointer to index 2 without moving the text pointer backward. Now compare pattern[2]=C with text[5]=C: match. pattern[3]=A with text[6]=A: match. pattern[4]=B with text[7]=B: match. pattern[5]=D with text[8]=D: match. Full pattern found at text position 3. The smart shift saved re-examining the AB that was already matched -- one shift instead of sliding the pattern forward by one position four separate times.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Knuth, Morris, and Pratt, "Fast Pattern Matching in Strings," SIAM Journal on Computing 6(2), 1977. The paper includes a proof that KMP is optimal in the number of text character inspections for the comparison-based model.',
        'Study next by role. Hashing approach: Rabin-Karp rolls a hash window over the text -- simpler code, expected O(n+m) time, but worst-case O(nm) from collisions. Practical fastest: Boyer-Moore matches right to left with bad-character and good-suffix rules, often sub-linear on large alphabets. Multi-pattern generalization: Aho-Corasick builds a trie with failure links (KMP\'s idea extended to branching), searching thousands of patterns in one pass. Full-text indexing: suffix arrays sort all suffixes of the text so any later pattern query costs O(m log n), ideal when the text is fixed and queries are many. Related structures: tries for prefix lookup, suffix trees for all-occurrence queries.',
      ],
    },
  ],
};
