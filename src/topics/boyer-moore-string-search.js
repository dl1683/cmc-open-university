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
        'The search-trace view runs Boyer-Moore on the text "HERE IS A SIMPLE EXAMPLE" searching for the pattern "EXAMPLE". Each step shows one alignment of the pattern against the text. Active cells mark the portion of the text currently under the pattern window. The compare color highlights the single character being tested at that moment.',
        'Notice the direction: every comparison starts at the rightmost character of the pattern and moves left. Found cells mark characters that matched before a mismatch ended the alignment, or all seven characters when the full match is found at position 17.',
        {type: 'image', src: './assets/gifs/boyer-moore-string-search.gif', alt: 'Animated walkthrough of the boyer moore string search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Watch for the jumps between alignments. When the mismatched text character is absent from the pattern entirely, the window leaps forward by the full pattern length. When the mismatched character does exist somewhere in the pattern, the window slides just far enough to line that character up. Those variable-length jumps are the mechanism that makes Boyer-Moore faster than scanning every character.',
        'The shift-rules view breaks the two jump mechanisms apart: the bad character table and the good suffix table. Each step shows which rule fires, how far the pattern shifts, and a short proof that no valid alignment was skipped.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Robert Boyer and J Strother Moore published "A Fast String Searching Algorithm" in Communications of the ACM in October 1977. The problem they attacked: given a short pattern of length m and a long text of length n, find where (if anywhere) the pattern occurs in the text. Every prior algorithm -- including the Knuth-Morris-Pratt (KMP) algorithm published two years earlier -- examined every character in the text at least once, giving O(n) as the best possible time.',
        'Boyer and Moore broke that barrier. By comparing characters from the right end of the pattern instead of the left, they showed that a single mismatch can prove multiple text positions impossible in one shot. The best case drops to O(n/m): for a 7-character pattern in a million-character text, the algorithm can finish after inspecting only about 143,000 characters. That is sublinear -- it finds the answer without reading most of the input.',
        'This is why grep, text editors, and file search utilities use Boyer-Moore or one of its descendants. It is the fastest known practical algorithm for searching a single pattern in a large text over a large alphabet.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The brute-force method: place the pattern at position 0 in the text. Compare the first character of the pattern with the first character of the text, then the second, then the third, working left to right. If every character matches, report the occurrence. If any character mismatches, slide the pattern one position to the right and start the comparison over from the beginning of the pattern.',
        'This is called the naive or brute-force string search. It is correct and simple. For a pattern of length m and text of length n, the algorithm tries at most n - m + 1 alignments. At each alignment, it compares up to m characters. The worst case is O(nm) comparisons, but on typical English text the inner loop usually fails on the first or second character, so average performance is closer to O(n).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The naive approach has two structural problems. First, it compares left to right, so a mismatch at position j means j characters were examined and all that work is thrown away. The pattern slides forward by exactly one position and re-examines characters it already looked at.',
        'Second, left-to-right comparison misses a powerful inference. Suppose the pattern is 7 characters long and the very last character mismatches. The naive approach already wasted 6 comparisons confirming the earlier positions. Worse, if the mismatched text character does not appear anywhere in the pattern, then every alignment that overlaps that character must also fail -- but naive search does not notice this. It checks them one by one, sliding forward by one each time.',
        'The worst case is concrete: search for "AAAB" in "AAAAAAAAAA". At every alignment, the first three characters match before the fourth fails. That is 3 wasted comparisons per position, giving O(nm) total work. The naive approach treats every mismatch as equally uninformative, which is the fundamental limitation.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'callout',
          text: 'Boyer-Moore gets speed by comparing the most informative end of the pattern first, then turning a mismatch into a safe jump.',
        },
        'Compare the pattern against the text from right to left instead of left to right. A mismatch at the rightmost position of the pattern is now the cheapest possible failure: one comparison, and the current alignment is dead. But that one comparison also reveals the identity of the text character that caused the mismatch, and that identity carries information about how far the pattern can safely jump forward.',
        {
          type: 'image',
          src: 'https://i.sstatic.net/6cEJT.png',
          alt: 'Boyer-Moore text alignment trace with mismatches and safe shifts',
          caption: 'Boyer-Moore trace showing how mismatch characters drive pattern shifts. Source: Stack Overflow answer by Tim Skov Jacobsen, https://stackoverflow.com/questions/53623770/understanding-boyer-moore-visually.',
        },
        'If the mismatched text character does not appear in the pattern at all, no alignment overlapping that character can ever succeed. The pattern jumps past it entirely -- a shift of up to m positions from a single comparison. If the character does appear in the pattern, the pattern shifts just far enough to line up the rightmost occurrence of that character. Either way, the mismatch is converted into a safe multi-position jump rather than a cautious slide of one.',
        'When a mismatch occurs deeper in the pattern (after several right-to-left matches), the matched suffix at the right end provides additional information. The good suffix rule uses that matched suffix to compute an independent shift. The algorithm takes whichever shift -- bad character or good suffix -- is larger.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The algorithm has two phases: preprocessing and search. Preprocessing builds two lookup tables from the pattern alone. The search phase uses those tables to decide how far to jump after each mismatch.',
        'The bad character table records, for each character in the alphabet, its rightmost position within the pattern (or -1 if it does not appear). Building this takes O(m + |alphabet|) time. When a mismatch occurs at pattern position j against text character c, the table says: the nearest place c could match in the pattern is at index badChar[c]. The shift is j - badChar[c]. If c is absent from the pattern, badChar[c] = -1 and the shift is j + 1, which pushes the pattern entirely past the mismatched character.',
        'The good suffix table is indexed by how many characters matched at the right end before the mismatch. Suppose k characters matched (the suffix pattern[m-k..m-1] equals the corresponding text characters) and then a mismatch occurred at pattern position m-k-1. The good suffix table gives the smallest shift that either (a) re-aligns another copy of that k-character suffix within the pattern, preceded by a different character, or (b) aligns the longest prefix of the pattern that matches a suffix of the matched portion. Building this table takes O(m) time using the pattern\'s border (failure function) array.',
        'During search, align the pattern at position 0 of the text. Compare pattern[m-1] with text[m-1], then pattern[m-2] with text[m-2], moving right to left. If all m characters match, report the match and shift by the good suffix value for a complete match. On mismatch, look up both the bad character shift and the good suffix shift, take the maximum, and slide the pattern forward by that amount. Continue until the pattern slides past the end of the text.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one claim: both shift rules skip only impossible alignments. Consider the bad character rule. When text character c at position i mismatches pattern position j, any valid alignment must have pattern[j] = c. The rightmost occurrence of c in pattern[0..j-1] is at index k. Any alignment between the current one and the one placing pattern[k] at text position i would require c to appear at some pattern index between k+1 and j -- but by definition, k is the rightmost occurrence, so no such index exists. Those intermediate alignments are provably impossible.',
        'The good suffix rule works similarly. The matched suffix s appeared at the right end of the pattern. For any alignment to succeed, s must appear in the pattern at the new position. The rule finds the nearest such re-occurrence (preceded by a different character, to avoid re-triggering the same mismatch). If no re-occurrence exists, it falls back to the longest prefix of the pattern matching a suffix of s. Alignments between the current position and the chosen one cannot contain s at the right position, so they are impossible.',
        'Taking the maximum of two independently safe shifts is still safe. If shift A skips only impossible alignments and shift B skips only impossible alignments, then max(A, B) also skips only impossible alignments -- the set of impossible alignments for A is a subset of the first A positions, and similarly for B, and the union of two sets of impossible alignments is still impossible. The algorithm never misses a valid match.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Best case: O(n/m). This happens when every rightmost comparison mismatches on a character absent from the pattern. The pattern jumps by m positions each time, so only n/m comparisons are needed. For a 7-character pattern in a 1,000,000-character English text, that is about 143,000 comparisons -- the algorithm skips roughly 86% of the text. Longer patterns skip even more: a 20-character pattern would need only about 50,000 comparisons on the same text.',
        'Worst case: O(nm) for the original 1977 algorithm. The pathological input is a pattern like "AAA" in a text of all A\'s: every alignment produces a near-complete match before failing. Galil (1979) fixed this by recording the portion of text that was already verified during the previous full match, reducing the worst case to O(n). The Apostolico-Giancarlo variant (1986) achieves O(n) worst case for all inputs by tracking matched suffixes more carefully.',
        'Preprocessing takes O(m + |alphabet|) time and O(m + |alphabet|) space. For the 26-letter English alphabet and a 7-character pattern, that is 33 entries -- negligible. The key behavioral insight: doubling the pattern length roughly halves the best-case comparisons. Boyer-Moore gets faster as the pattern gets longer, the opposite of naive search.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GNU grep uses a Boyer-Moore variant (combined with Horspool\'s simplification and a few heuristics for short patterns) as its inner loop for fixed-string search. When you grep a 10 GB log file for a 15-character error message, Boyer-Moore is why the result appears in seconds rather than minutes. The longer your search string, the faster grep runs -- counterintuitive until you understand the O(n/m) best case.',
        'Text editors implement Ctrl+F / Cmd+F with Boyer-Moore or the closely related Horspool algorithm. The typical scenario -- a short pattern in a large open file -- is exactly where right-to-left scanning and bad character shifts dominate. The user perceives instant results because the algorithm skips most of the file.',
        'Bioinformatics tools use Boyer-Moore variants when searching for long DNA motifs. A 20-base primer in a 3-billion-base genome is a perfect fit for sublinear search. The alphabet is small (A, C, G, T), which weakens the bad character rule, but the good suffix rule still provides useful shifts for longer patterns. Tools like BLAST use related ideas at the core of their seeding phase.',
        'File search utilities like ripgrep and The Silver Searcher (ag) use Boyer-Moore or Horspool as one layer in their search pipeline, often switching to SIMD-vectorized methods for patterns shorter than about 4 characters where Boyer-Moore\'s preprocessing overhead is not worth the sublinear payoff.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Short patterns kill the advantage. A 1-character pattern has m = 1, so the best case is O(n/1) = O(n) -- no better than brute force. For patterns of 2-3 characters, the preprocessing cost and branch overhead often lose to a simple SIMD scan. Most production implementations detect short patterns and fall back to memchr or vectorized search.',
        'Small alphabets weaken the bad character rule. On binary data (alphabet size 2), almost every character appears in any pattern longer than 2 characters, so bad character shifts are tiny. The good suffix rule still helps, but KMP or the bitap algorithm (used by agrep) are simpler and competitive. On DNA\'s 4-letter alphabet, Boyer-Moore still beats naive search, but the gap over KMP narrows.',
        'Multiple simultaneous patterns are outside Boyer-Moore\'s design. Searching for 1,000 patterns at once requires Aho-Corasick, which builds a trie of all patterns with failure links and scans the text exactly once regardless of pattern count. Commentz-Walter extends Boyer-Moore to multiple patterns, but it is rarely used in practice because Aho-Corasick is simpler and has better worst-case guarantees.',
        'The good suffix table is notoriously hard to implement correctly. The original Boyer-Moore paper had a subtle bug in the good suffix preprocessing, later fixed by Knuth. Most production code avoids the complexity by using the Horspool simplification (bad character rule only, indexed by the text character aligned with the last pattern position) or the Sunday variant (look at the character one position past the alignment window). These variants give up the O(n) worst-case guarantee but deliver nearly identical speed in practice.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Text: "HERE IS A SIMPLE EXAMPLE" (24 characters, indices 0-23). Pattern: "EXAMPLE" (7 characters, indices 0-6: E=0, X=1, A=2, M=3, P=4, L=5, E=6). Bad character table built by scanning left to right, recording the rightmost index of each character: E->6, X->1, A->2, M->3, P->4, L->5. Any character not in this table gets -1.',
        'Alignment 0: pattern covers text[0..6] = "HERE IS". Compare pattern[6]=E with text[6]=S. Mismatch. S is not in the pattern (badChar[S] = -1). Bad character shift = 6 - (-1) = 7. The pattern jumps 7 positions forward. One comparison eliminated 7 text positions.',
        'Alignment 7: pattern covers text[7..13] = " A SIMP". Compare pattern[6]=E with text[13]=P. Mismatch. P is in the pattern at index 4 (badChar[P] = 4). Bad character shift = 6 - 4 = 2. The pattern slides 2 positions so that pattern[4]=P lines up with the P at text[13].',
        'Alignment 9: pattern covers text[9..15] = " SIMPLE". Compare right to left: pattern[6]=E vs text[15]=E (match), pattern[5]=L vs text[14]=L (match), pattern[4]=P vs text[13]=P (match), pattern[3]=M vs text[12]=M (match), pattern[2]=A vs text[11]=I (mismatch). Four characters matched, then I failed. I is not in the pattern (badChar[I] = -1), so bad character shift = 2 - (-1) = 3. The matched suffix "MPLE" does not reappear elsewhere in "EXAMPLE", and no prefix of "EXAMPLE" matches a suffix of "MPLE", so the good suffix shift = 7 (full pattern length). Take max(3, 7) = 7.',
        'Alignment 16: pattern covers text[16..22] = " EXAMPL". Compare pattern[6]=E with text[22]=L. Mismatch. L is in the pattern at index 5 (badChar[L] = 5). Bad character shift = 6 - 5 = 1. The pattern slides 1 position forward.',
        'Alignment 17: pattern covers text[17..23] = "EXAMPLE". Compare right to left: E=E, L=L, P=P, M=M, A=A, X=X, E=E. All 7 characters match. Pattern found at position 17.',
        'Scorecard: 5 alignments, approximately 14 character comparisons to search 24 characters of text. The naive worst case for this input is (24 - 7 + 1) x 7 = 126 comparisons. Boyer-Moore used about 11% of that budget. On longer texts with larger alphabets, the savings compound further because full-pattern jumps become more frequent.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Robert S. Boyer and J Strother Moore, "A Fast String Searching Algorithm," Communications of the ACM 20(10), October 1977. Galil\'s worst-case improvement: Zvi Galil, "On Improving the Worst Case Running Time of the Boyer-Moore String Matching Algorithm," Communications of the ACM 22(9), 1979. Horspool\'s simplification: R. Nigel Horspool, "Practical Fast Searching in Strings," Software: Practice and Experience 10(6), 1980.',
        'Study next, organized by what problem you face. If you need guaranteed O(n+m) with no worst case: learn Knuth-Morris-Pratt (KMP), which preprocesses the pattern into a failure function so the text pointer never retreats. If you want a simpler implementation with expected O(n+m): learn Rabin-Karp, which uses rolling hash fingerprints and extends naturally to multi-pattern search. If you need to search for thousands of patterns simultaneously: learn Aho-Corasick, which builds a trie with failure links and scans the text once for all patterns. If your text is fixed and queries are many: learn suffix arrays or suffix trees, which index the text once and answer pattern queries in O(m log n) or O(m) time. If you want Boyer-Moore\'s speed with simpler code: learn Horspool (bad character rule only) or Sunday (look one position past the window), both of which sacrifice worst-case guarantees for nearly identical practical performance.',
      ],
    },
  ],
};
