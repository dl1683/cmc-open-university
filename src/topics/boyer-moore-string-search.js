// Boyer-Moore string search: compare right-to-left, skip characters the naive
// approach would examine one by one. Bad character + good suffix = big jumps.

import { sequenceState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'boyer-moore-string-search',
  title: 'Boyer-Moore String Search',
  category: 'Data Structures',
  summary: 'Right-to-left comparison with bad-character and good-suffix shift rules — often sublinear because mismatches near the pattern end skip entire windows.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['search trace', 'shift rules'], defaultValue: 'search trace' },
  ],
  run,
};

// --- helpers ---

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

// --- search trace: EXAMPLE in "HERE IS A SIMPLE EXAMPLE" ---

const TEXT = 'HERE IS A SIMPLE EXAMPLE';
const PATTERN = 'EXAMPLE';

function* searchTrace() {
  const m = PATTERN.length;
  const n = TEXT.length;
  const textArr = [...TEXT];
  const patArr = [...PATTERN];
  let alignments = 0;
  let comparisons = 0;

  // Build bad character table
  const badChar = {};
  for (let i = 0; i < m; i++) badChar[patArr[i]] = i;

  yield {
    state: chars(TEXT, `Text: "${TEXT}", Pattern: "${PATTERN}"`),
    highlight: { active: [...TEXT].map((_, i) => `c${i}`) },
    explanation: `Boyer-Moore aligns the ${m}-character pattern at the left end of the ${n}-character text but compares characters right to left, starting from pattern[${m - 1}]='${patArr[m - 1]}'. This backward scan means mismatches near the end skip the most characters.`,
  };

  // Alignment 0: text[0..6] = "HERE IS", compare from right
  let align = 0;
  alignments++;
  comparisons++;
  const textChar0 = textArr[align + m - 1];
  const patChar0 = patArr[m - 1];
  const shift0 = m; // S not in pattern
  yield {
    state: chars(TEXT, `Alignment ${align}: compare right to left`),
    highlight: { compare: [`c${align + m - 1}`], active: Array.from({ length: m - 1 }, (_, i) => `c${align + i}`) },
    explanation: `Pattern aligned at position ${align}. Compare pattern[${m - 1}]='${patChar0}' with text[${align + m - 1}]='${textChar0}'. Mismatch. '${textChar0}' does not appear anywhere in ${PATTERN}, so the bad character rule shifts the entire pattern past this position — a jump of ${shift0}. ${comparisons} comparison eliminates ${shift0} text positions.`,
  };

  // Alignment 7: text[7..13] = " A SIMP", compare from right
  align = 7;
  alignments++;
  comparisons++;
  const textChar7 = textArr[align + m - 1];
  const patPosP = badChar[textChar7];
  const shift7 = (m - 1) - patPosP;
  yield {
    state: chars(TEXT, `Alignment ${align}: bad character shifts to align ${textChar7}`),
    highlight: { compare: [`c${align + m - 1}`], active: Array.from({ length: m - 1 }, (_, i) => `c${align + i}`) },
    explanation: `Pattern aligned at position ${align}. Compare pattern[${m - 1}]='${patChar0}' with text[${align + m - 1}]='${textChar7}'. Mismatch. '${textChar7}' appears in the pattern at index ${patPosP}. The bad character rule shifts by ${m - 1}-${patPosP} = ${shift7} so that pattern[${patPosP}]='${textChar7}' aligns with text[${align + m - 1}]='${textChar7}'.`,
  };

  // Alignment 9: text[9..15] = " SIMPLE", compare from right
  align = 9;
  alignments++;
  const matchedChars9 = 4; // E, L, P, M match
  comparisons += matchedChars9 + 1;
  const mismatchPos9 = 2;
  const mismatchTextChar9 = textArr[align + mismatchPos9];
  const mismatchPatChar9 = patArr[mismatchPos9];
  const bcShift9 = mismatchPos9 - (badChar[mismatchTextChar9] !== undefined ? badChar[mismatchTextChar9] : -1);
  const gsShift9 = m;
  const shift9 = Math.max(bcShift9, gsShift9);
  yield {
    state: chars(TEXT, `Alignment ${align}: ${matchedChars9} matches then mismatch`),
    highlight: {
      found: [`c${align + 3}`, `c${align + 4}`, `c${align + 5}`, `c${align + 6}`],
      compare: [`c${align + mismatchPos9}`],
      active: [`c${align}`, `c${align + 1}`],
    },
    explanation: `Pattern aligned at position ${align}. Comparing right to left: ${patArr[6]}=${textArr[align + 6]}, ${patArr[5]}=${textArr[align + 5]}, ${patArr[4]}=${textArr[align + 4]}, ${patArr[3]}=${textArr[align + 3]} — ${matchedChars9} matches. Then pattern[${mismatchPos9}]='${mismatchPatChar9}' vs text[${align + mismatchPos9}]='${mismatchTextChar9}'. Mismatch. '${mismatchTextChar9}' is not in the pattern (bad char shift = ${bcShift9}). The matched suffix ${PATTERN.slice(mismatchPos9 + 1)} has no other occurrence in the pattern and no prefix of ${PATTERN} matches a suffix of ${PATTERN.slice(mismatchPos9 + 1)}, so the good suffix rule shifts the full pattern length (${gsShift9}). max(${bcShift9}, ${gsShift9}) = ${shift9}.`,
  };

  // Alignment 16: text[16..22] = " EXAMPL", compare from right
  align = 16;
  alignments++;
  comparisons++;
  const textChar16 = textArr[align + m - 1];
  const patPosL = badChar[textChar16];
  const shift16 = (m - 1) - patPosL;
  yield {
    state: chars(TEXT, `Alignment ${align}: bad character shifts by ${shift16}`),
    highlight: { compare: [`c${align + m - 1}`], active: Array.from({ length: m - 1 }, (_, i) => `c${align + i}`) },
    explanation: `Pattern aligned at position ${align}. Compare pattern[${m - 1}]='${patChar0}' with text[${align + m - 1}]='${textChar16}'. Mismatch. '${textChar16}' appears in the pattern at index ${patPosL}. Bad character shifts by ${m - 1}-${patPosL} = ${shift16}.`,
  };

  // Alignment 17: text[17..23] = "EXAMPLE", full match
  align = 17;
  alignments++;
  comparisons += m;
  const matchChars = patArr.slice().reverse().map((ch, i) => `${ch}=${textArr[align + m - 1 - i]}`).join(', ');
  yield {
    state: chars(TEXT, `Alignment ${align}: full match found!`),
    highlight: { found: Array.from({ length: m }, (_, i) => `c${align + i}`) },
    explanation: `Pattern aligned at position ${align}. All ${m} characters match right to left: ${patArr.slice().reverse().join(', ')}. Pattern ${PATTERN} found at text position ${align}. Total: ${alignments} alignment attempts and ${comparisons} comparisons for a ${n}-character text — well under the ${n} comparisons a naive left-to-right scan would need.`,
  };

  // Summary step
  const naiveWorst = (n - m + 1) * m;
  yield {
    state: labelMatrix(
      'Boyer-Moore skips vs. other algorithms',
      [
        { id: 'naive', label: 'Naive' },
        { id: 'kmp', label: 'KMP' },
        { id: 'bm', label: 'Boyer-Moore' },
        { id: 'rk', label: 'Rabin-Karp' },
      ],
      [
        { id: 'direction', label: 'direction' },
        { id: 'best', label: 'best case' },
        { id: 'strength', label: 'strength' },
      ],
      [
        ['left to right', `O(${n})`, 'simplicity'],
        ['left to right', `O(${n})`, 'guaranteed linear'],
        ['right to left', `O(${n}/${m})`, 'sublinear skips'],
        ['left to right', `O(${n})`, 'multi-pattern hashing'],
      ],
    ),
    highlight: { found: ['bm:best'], active: ['bm:strength'] },
    explanation: `Boyer-Moore is the only standard string matcher with sublinear best-case behavior: O(n/m) = O(${n}/${m}) = ~${Math.ceil(n / m)} comparisons in the best case. We used ${comparisons} comparisons vs naive worst-case ${naiveWorst}. Right-to-left comparison combined with shift rules means many text characters are never examined at all.`,
  };
}

// --- shift rules view ---

function* shiftRules() {
  const m = PATTERN.length;
  const patArr = [...PATTERN];

  // Build bad character positions
  const badCharMap = {};
  for (let i = 0; i < m; i++) badCharMap[patArr[i]] = i;
  const uniqueChars = Object.keys(badCharMap);
  const lastPos = m - 1;

  // Bad character table
  yield {
    state: labelMatrix(
      `Bad character table for ${PATTERN}`,
      [
        { id: 'E', label: 'E' },
        { id: 'X', label: 'X' },
        { id: 'A', label: 'A' },
        { id: 'M', label: 'M' },
        { id: 'P', label: 'P' },
        { id: 'L', label: 'L' },
        { id: 'other', label: '*' },
      ],
      [
        { id: 'pos', label: 'rightmost index' },
        { id: 'shift', label: 'shift if mismatch at end' },
      ],
      [
        [`${badCharMap['E']}`, `0 (but use 2nd rightmost: 0, shift ${lastPos})`],
        [`${badCharMap['X']}`, `${lastPos - badCharMap['X']}`],
        [`${badCharMap['A']}`, `${lastPos - badCharMap['A']}`],
        [`${badCharMap['M']}`, `${lastPos - badCharMap['M']}`],
        [`${badCharMap['P']}`, `${lastPos - badCharMap['P']}`],
        [`${badCharMap['L']}`, `${lastPos - badCharMap['L']}`],
        ['-1', `${m} (full pattern)`],
      ],
    ),
    highlight: { active: ['other:shift'], found: ['E:pos', 'L:shift'] },
    explanation: `The bad character table records each character's rightmost position in the ${m}-character pattern "${PATTERN}" (${uniqueChars.length} distinct characters: ${uniqueChars.join(', ')}). On mismatch at pattern position j with text character c, shift the pattern so that the rightmost c in pattern[0..j-1] aligns with the text. If c is absent, shift the whole pattern past the mismatch (shift = ${m}). Building this table costs O(${m} + |alphabet|).`,
  };

  // Bad character rule in action
  const exampleChar = 'S';
  const exampleShift = m;
  yield {
    state: labelMatrix(
      `Bad character shift example`,
      [
        { id: 'step1', label: `text char = ${exampleChar} at mismatch` },
        { id: 'step2', label: `${exampleChar} not in ${PATTERN}` },
        { id: 'step3', label: `shift entire pattern past ${exampleChar}` },
        { id: 'result', label: `shift = ${exampleShift}` },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'why', label: 'why it is safe' },
      ],
      [
        [`compare pattern[${lastPos}] vs text char`, 'rightmost comparison first'],
        [`lookup ${exampleChar} in bad char table`, `${exampleChar} has no entry`],
        [`no position in pattern can match ${exampleChar}`, `every alignment overlapping ${exampleChar} would fail`],
        ['jump past the mismatch entirely', 'no valid alignment was skipped'],
      ],
    ),
    highlight: { found: ['result:action'], active: ['step2:why', 'step3:why'] },
    explanation: `When the mismatched text character '${exampleChar}' does not appear in the pattern "${PATTERN}", every alignment that overlaps it must fail. The pattern jumps past the character entirely (shift = ${exampleShift}). This is why Boyer-Moore is fastest on large alphabets: most characters in the text are absent from a short ${m}-character pattern.`,
  };

  // Good suffix rule
  yield {
    state: labelMatrix(
      'Good suffix rule',
      [
        { id: 'case1', label: 'Case 1: suffix reappears' },
        { id: 'case2', label: 'Case 2: prefix matches suffix' },
        { id: 'case3', label: 'Case 3: no reoccurrence' },
      ],
      [
        { id: 'condition', label: 'condition' },
        { id: 'shift', label: 'shift' },
      ],
      [
        ['matched suffix t appears elsewhere in pattern preceded by a different char', 'align the other occurrence of t with the text'],
        ['no full reoccurrence, but a prefix of the pattern matches a suffix of t', 'align that prefix with the text suffix'],
        ['neither case applies', `shift past the entire pattern (${m})`],
      ],
    ),
    highlight: { active: ['case1:shift', 'case2:shift'], compare: ['case3:shift'] },
    explanation: `The good suffix rule uses the matched suffix to determine the shift. If the suffix appears elsewhere in the ${m}-character pattern (preceded by a different character), align that occurrence. If not, check whether any prefix of "${PATTERN}" matches a suffix of the matched portion. If neither applies, shift the full length (${m}). Preprocessing costs O(${m}).`,
  };

  // Combining both rules
  yield {
    state: labelMatrix(
      'Combining the two rules',
      [
        { id: 'bc', label: 'bad character shift' },
        { id: 'gs', label: 'good suffix shift' },
        { id: 'final', label: 'actual shift' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'note', label: 'note' },
      ],
      [
        ['shift to align mismatched char', 'can be negative if char is to the right'],
        ['shift based on matched suffix', 'always positive'],
        ['max(bad char, good suffix)', 'take the larger shift'],
      ],
    ),
    highlight: { found: ['final:value'], active: ['bc:value', 'gs:value'] },
    explanation: `Boyer-Moore takes the maximum of the two shifts. Both rules independently guarantee that no valid alignment is skipped, so the larger shift is always safe. For "${PATTERN}" (length ${m}) on text of length ${TEXT.length}, the bad character rule dominates on natural text because mismatches usually involve characters absent from the pattern.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'search trace') yield* searchTrace();
  else if (view === 'shift rules') yield* shiftRules();
  else throw new InputError('Pick a Boyer-Moore view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The search-trace view runs Boyer-Moore on text "HERE IS A SIMPLE EXAMPLE" looking for pattern "EXAMPLE". Active cells mark the text window currently aligned with the pattern. The compare color highlights the character being tested — always the rightmost unmatched position, because Boyer-Moore scans right to left. Found cells mark characters that matched before a mismatch occurred, or the final complete match.',
        'Watch for the big jumps. When a mismatch character is absent from the pattern, the entire window slides past it in one step. When the mismatched character does appear in the pattern, the window slides just far enough to align that character. Those jumps are why Boyer-Moore often examines fewer characters than the text contains.',
        {
          type: 'callout',
          text: 'Boyer-Moore gets speed by comparing the most informative end of the pattern first, then turning a mismatch into a safe jump.',
        },
        'The shift-rules view breaks down the two shift mechanisms: the bad character table and the good suffix table. Each step shows which rule fires, how far it shifts, and why the shift is safe — no valid alignment is skipped.',
      
        {type: 'image', src: './assets/gifs/boyer-moore-string-search.gif', alt: 'Animated walkthrough of the boyer moore string search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Robert Boyer and J Strother Moore published "A Fast String Searching Algorithm" in 1977. Their goal: make practical string search faster than examining every character. KMP had already achieved worst-case O(n+m) by never backtracking the text pointer, but KMP still touches every text character at least once. Boyer and Moore observed that by comparing from the right end of the pattern, a single mismatch can prove that several text positions are impossible — letting the algorithm skip past them entirely.',
        'The result is the most practically efficient exact string matcher for single patterns on large alphabets. Where KMP is O(n+m) always, Boyer-Moore is O(n/m) in the best case — sublinear, meaning it can find a pattern without reading most of the text. This is why grep, text editors, and file search utilities overwhelmingly use Boyer-Moore or its variants.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Align the pattern at text position 0. Compare left to right. On mismatch, slide the pattern one position forward and start over. This brute-force method is correct and intuitive: try every alignment, check every character.',
        'For short patterns on short texts, it works fine. The inner loop often terminates after one or two character comparisons because the first character mismatches. On average, naive search on random text with a large alphabet is close to O(n).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Naive search compares left to right, so a mismatch at position j means j characters were examined and none of that information is reused. The pattern slides forward by one and re-examines characters it already saw.',
        'Worse, left-to-right comparison misses a structural opportunity. If the last character of the pattern mismatches, the naive approach has already wasted j-1 comparisons confirming earlier positions. Comparing from the right end first would have caught the mismatch immediately. And when the mismatched text character does not appear in the pattern at all, every alignment that overlaps it must fail — but naive search does not notice this and checks them one by one. The worst case is O(nm): pattern AAAB in text AAAAAA...A triggers near-complete matches at every position.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compare the pattern against the text from right to left. A mismatch at the rightmost position is the cheapest possible failure: one comparison eliminates the entire current alignment. A mismatch after several right-to-left matches is more expensive but also more informative, because the matched suffix constrains which future alignments can succeed.',
        {
          type: 'image',
          src: 'https://i.sstatic.net/6cEJT.png',
          alt: 'Boyer-Moore text alignment trace with mismatches and safe shifts',
          caption: 'Boyer-Moore trace showing how mismatch characters drive pattern shifts. Source: Stack Overflow answer by Tim Skov Jacobsen, https://stackoverflow.com/questions/53623770/understanding-boyer-moore-visually.',
        },
        'Two precomputed tables convert mismatch information into shift distances. The bad character rule uses the mismatched text character to find the nearest position in the pattern where it could align. The good suffix rule uses the matched suffix to find the nearest position in the pattern where the same suffix appears preceded by a different character — or, failing that, the longest prefix of the pattern that matches a suffix of the matched portion. Both rules guarantee that the shift skips only impossible alignments. The algorithm takes whichever shift is larger.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Preprocessing: build two tables from the pattern. The bad character table maps each alphabet character to its rightmost index in the pattern (or -1 if absent). On mismatch at pattern position j with text character c, shift by max(1, j - badChar[c]). Building this table costs O(|alphabet|) time and space.',
        'The good suffix table is indexed by the number of matched characters. When k characters at the right end of the pattern matched before the mismatch, the table gives the smallest shift that either (a) re-aligns another occurrence of the matched suffix preceded by a different character, or (b) aligns the longest prefix of the pattern that matches a suffix of the matched portion. Building this table costs O(m) time using the pattern\'s suffix structure.',
        'Search: align the pattern at position 0. Compare pattern[m-1] with text[m-1], then pattern[m-2] with text[m-2], and so on. If all characters match, report the occurrence and shift by the good suffix value for a full match. On mismatch, compute both the bad character shift and the good suffix shift, take the maximum, and slide the pattern forward by that amount. Repeat until the pattern slides past the end of the text.',
        'The right-to-left scan means that when the alphabet is large relative to the pattern, most first comparisons mismatch on a character absent from the pattern, producing a full-length shift. The pattern effectively hops across the text in steps of m, touching only about n/m characters total.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Both shift rules are independently safe: neither skips a valid alignment. The bad character rule is safe because any alignment where the text character c appears at pattern position j requires pattern[j] = c; if the nearest such position is at index k < j, any alignment between the current one and the one placing pattern[k] at text position i would have a character other than c at a position that needs c. The good suffix rule is safe because any alignment that places the matched suffix in a different position must have that suffix appearing in the pattern; the rule finds the nearest such position.',
        'Taking the maximum of two safe shifts is still safe — if both shifts independently skip only impossible alignments, the larger one does too. Correctness does not depend on the alphabet, the text, or the pattern structure. The rules are conservative: they never over-shift.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Best case: O(n/m). When every first comparison (at the rightmost pattern position) mismatches on an absent character, the pattern jumps by m each time, touching only n/m characters. This is sublinear — a 7-character pattern in 1,000,000 characters of English text inspects roughly 150,000 characters, not 1,000,000.',
        'Worst case: O(nm) for the original algorithm. Searching for pattern AAAA in text AAAAAA...A matches most of the pattern at every alignment. Galil\'s 1979 optimization adds a rule: after a full match, the portion of the text known to match from the previous alignment is not re-examined. This brings the worst case to O(n). The Apostolico-Giancarlo variant achieves O(n) worst case for all inputs.',
        'Preprocessing: O(m + |alphabet|) for the bad character table, O(m) for the good suffix table. Space: O(m + |alphabet|). Doubling the pattern length roughly halves the number of comparisons in the best case — longer patterns skip more text, the opposite of what happens with naive search.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GNU grep uses a Boyer-Moore variant (with Horspool simplification and a few extra heuristics) as its inner loop for fixed-string search. When you run grep on a large log file with a long search term, Boyer-Moore is why it finishes faster than you would expect from the file size.',
        'Text editors implement Ctrl+F / Cmd+F with Boyer-Moore or the closely related Horspool algorithm. The pattern is usually short and the text (the open file) is large, exactly the scenario where right-to-left scanning and bad character shifts dominate.',
        'DNA sequence search benefits from Boyer-Moore when searching for long motifs. Bioinformatics tools searching for 20-base primers in gigabase genomes use Boyer-Moore variants because the sublinear best case turns days of compute into hours. The alphabet is small (A, C, G, T), so the bad character rule is less effective than on English text, but the good suffix rule still provides useful shifts for longer patterns.',
        'File search utilities like ripgrep, The Silver Searcher (ag), and mmap-based search tools use Boyer-Moore or Horspool as one layer of their matching strategy, often combined with SIMD vectorization for short patterns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Short patterns (1-3 characters) give Boyer-Moore no room to skip. The preprocessing overhead and extra bookkeeping lose to naive search or SIMD-vectorized brute force. Most implementations fall back to simpler methods for very short patterns.',
        'Small alphabets weaken the bad character rule. On binary data (alphabet size 2), every character appears in most patterns, so bad character shifts are small. The good suffix rule still helps, but KMP or bitap algorithms are often simpler and competitive. On DNA\'s 4-letter alphabet, Boyer-Moore still works but the advantage over KMP shrinks.',
        'Multiple patterns are not Boyer-Moore\'s job. Searching for 1,000 patterns simultaneously requires Aho-Corasick (a trie with failure links that scans the text once for all patterns) or Commentz-Walter (the Boyer-Moore analog for multiple patterns, rarely used in practice because Aho-Corasick is simpler).',
        'The good suffix preprocessing is tricky to implement correctly. Most production code uses the Horspool simplification (bad character rule only, shift by the rightmost occurrence of the last-compared character) or the Sunday variant (look at the character just past the alignment window). These sacrifice worst-case guarantees for implementation simplicity and near-identical practical speed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Text: "HERE IS A SIMPLE EXAMPLE" (length 24). Pattern: "EXAMPLE" (length 7). Bad character table: E->6, X->1, A->2, M->3, P->4, L->5; all others->-1.',
        'Alignment 0 (text positions 0-6 = "HERE IS"): compare pattern[6]=E with text[6]=S. Mismatch. S is not in the pattern. Bad character shift = 6 - (-1) = 7. Shift by 7.',
        'Alignment 7 (text positions 7-13 = " A SIMP"): compare pattern[6]=E with text[13]=P. Mismatch. P is at pattern index 4. Bad character shift = 6 - 4 = 2. Shift by 2.',
        'Alignment 9 (text positions 9-15 = " SIMPLE"): compare right to left. pattern[6]=E vs text[15]=E: match. pattern[5]=L vs text[14]=L: match. pattern[4]=P vs text[13]=P: match. pattern[3]=M vs text[12]=M: match. pattern[2]=A vs text[11]=I: mismatch. I is not in the pattern. Bad character shift = 2 - (-1) = 3. Good suffix: matched suffix "MPLE" does not reappear in pattern, and no prefix of EXAMPLE matches a suffix of MPLE. Good suffix shift = 7. Take max(3, 7) = 7. Shift by 7.',
        'Alignment 16 (text positions 16-22 = " EXAMPL"): compare pattern[6]=E with text[22]=L. Mismatch. L is at pattern index 5. Bad character shift = 6 - 5 = 1. Shift by 1.',
        'Alignment 17 (text positions 17-23 = "EXAMPLE"): compare right to left. E=E, L=L, P=P, M=M, A=A, X=X, E=E. All seven match. Pattern found at position 17.',
        'Total: 5 alignments, roughly 14 character comparisons for 24 characters of text. A naive search examining every position left to right would perform up to 18 x 7 = 126 comparisons in the worst case. Boyer-Moore finished in a fraction of that work.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Robert S. Boyer and J Strother Moore, "A Fast String Searching Algorithm," Communications of the ACM 20(10), October 1977. Galil\'s O(n) worst-case improvement: Zvi Galil, "On Improving the Worst Case Running Time of the Boyer-Moore String Matching Algorithm," Communications of the ACM 22(9), 1979.',
        'Study next by role. Guaranteed linear: KMP preprocesses the pattern into a failure function so the text pointer never retreats — simpler worst case, but always touches every text character. Hashing approach: Rabin-Karp uses rolling hash fingerprints for expected O(n+m) time; simpler to implement, especially for multi-pattern search. Multi-pattern: Aho-Corasick builds a trie with failure links for simultaneous search of thousands of patterns in one text pass. Full-text indexing: suffix arrays sort all suffixes once so later queries cost O(m log n) — better when the text is fixed and queries are many. Practical variants: Horspool simplifies Boyer-Moore to the bad character rule only; Sunday looks at the character after the window; both trade worst-case guarantees for simpler code and nearly identical real-world speed.',
      ],
    },
  ],
};
