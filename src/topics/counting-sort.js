// Counting sort: count occurrences, prefix-sum for positions, place elements.
// Beats comparison sorts when the value range k is small relative to n.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'counting-sort',
  title: 'Counting Sort',
  category: 'Sorting',
  summary: 'Count how many times each value appears, then reconstruct the sorted output — O(n + k) with no comparisons.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '4, 2, 2, 8, 3, 3, 1' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 12 });
  const n = values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);

  if (min < 0) {
    yield {
      state: arrayState(values),
      highlight: {},
      explanation: 'Counting sort needs non-negative integers. Negative values would require an offset or a different algorithm.',
    };
    return;
  }

  const k = max + 1;
  const count = new Array(k).fill(0);
  const output = new Array(n).fill(0);

  // --- Phase 0: Show input ---
  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Input: ${n} values in range [${min}, ${max}]. Counting sort will count occurrences, compute prefix sums for placement positions, then place each element — no comparisons needed.`,
  };

  // --- Phase 1: Count occurrences ---
  yield {
    state: arrayState(count),
    highlight: {},
    explanation: `Create a count array of size ${k} (one slot per possible value 0..${max}), initialized to zeros. This array will record how many times each value appears.`,
  };

  for (let i = 0; i < n; i += 1) {
    const v = values[i];
    count[v] += 1;
    yield {
      state: arrayState(count),
      highlight: { active: [`i${v}`] },
      explanation: `Input[${i}] = ${v}. Increment count[${v}] to ${count[v]}. Each input element maps directly to its count slot — this is why there are no comparisons.`,
    };
  }

  yield {
    state: arrayState(count),
    highlight: { found: count.map((c, i) => c > 0 ? `i${i}` : null).filter(Boolean) },
    explanation: `Counting complete. Count array: [${count.join(', ')}]. Each nonzero entry tells us exactly how many copies of that value exist. Total work so far: ${n} increments.`,
  };

  // --- Phase 2: Prefix sum ---
  const prefixSum = [...count];
  yield {
    state: arrayState(prefixSum),
    highlight: {},
    explanation: `Now compute the prefix sum. Each count[i] will become the number of elements less than or equal to i. This tells us where each value's last copy belongs in the output.`,
  };

  for (let i = 1; i < k; i += 1) {
    prefixSum[i] += prefixSum[i - 1];
    yield {
      state: arrayState(prefixSum),
      highlight: { active: [`i${i}`], compare: [`i${i - 1}`] },
      explanation: `prefixSum[${i}] = prefixSum[${i - 1}] + count[${i}] = ${prefixSum[i]}. This means ${prefixSum[i]} elements have value <= ${i}, so value ${i}'s last copy goes at output index ${prefixSum[i] - 1}.`,
    };
  }

  yield {
    state: arrayState(prefixSum),
    highlight: { found: prefixSum.map((_, i) => `i${i}`) },
    explanation: `Prefix sums complete: [${prefixSum.join(', ')}]. Each entry is a placement ceiling. We will walk the input right-to-left, using prefix sums to place each element and decrementing the count — this preserves stability.`,
  };

  // --- Phase 3: Place elements (right to left for stability) ---
  yield {
    state: arrayState(output),
    highlight: {},
    explanation: `Output array initialized to ${n} zeros. We scan the input right-to-left: for each value v, decrement prefixSum[v] and place v at that index. Right-to-left scanning preserves the original order of equal elements (stability).`,
  };

  for (let i = n - 1; i >= 0; i -= 1) {
    const v = values[i];
    prefixSum[v] -= 1;
    const pos = prefixSum[v];
    output[pos] = v;

    yield {
      state: arrayState(output),
      highlight: { active: [`i${pos}`] },
      explanation: `Input[${i}] = ${v}. Decrement prefixSum[${v}] to ${prefixSum[v]}. Place ${v} at output[${pos}]. ${i > 0 ? `If another ${v} appears earlier in the input, it will go at index ${pos - 1} — earlier input position gets earlier output position. That is stability.` : 'Last element placed.'}`,
    };
  }

  yield {
    state: arrayState(output),
    highlight: { sorted: output.map((_, i) => `i${i}`) },
    explanation: `Sorted: [${output.join(', ')}]. Total work: ${n} counts + ${k - 1} prefix sums + ${n} placements = ${n + (k - 1) + n} operations. No comparisons anywhere — every element went directly to its correct position by arithmetic.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation runs in three phases. Phase 1 builds the count array: each input value lights up its matching slot and increments the counter there. Phase 2 converts counts into prefix sums -- cumulative totals where each slot accumulates the sum of all slots up to and including itself. Phase 3 builds the sorted output by scanning the input backwards, using each prefix sum as a placement cursor that decrements after every write.',
        {
          type: 'callout',
          text: 'Counting sort escapes comparison sorting by using small integer keys as addresses, then prefix sums turn counts into stable positions.',
        },
        'Active highlights mark the slot currently being written. Compare highlights during the prefix-sum phase show which neighbor is contributing its value. The sorted highlight at the end confirms that every position is final.',
        'Watch the backwards scan in phase 3 carefully -- it is the detail that makes the algorithm stable. When two copies of the same value exist, the copy scanned first (further right in the input) lands at the higher output index. The copy scanned second lands one position lower. Their original left-to-right order survives intact in the output.',
        {type: 'image', src: './assets/gifs/counting-sort.gif', alt: 'Animated walkthrough of the counting sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Comparison-based sorting has a proven floor: any algorithm that decides order by comparing pairs of elements needs at least O(n log n) comparisons in the worst case. This is not an engineering limitation -- it is a mathematical fact. The argument comes from decision trees: n elements can be arranged in n! ways, a binary tree over n! leaves needs at least log2(n!) levels, and log2(n!) is Theta(n log n). For a million elements, that works out to roughly 20 million comparisons no matter how clever the algorithm.',
        'Counting sort exists to dodge that floor entirely. It never compares two elements against each other. Instead, if every key is a non-negative integer in a known range [0, k), it counts how many times each key appears and then computes output positions by arithmetic. The total cost is O(n + k), which is linear in the input size plus the range size. When k is small relative to n, this beats any comparison sort by a wide margin.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use a comparison sort. Merge sort and quicksort both achieve O(n log n) time, work on any comparable type, need no assumptions about the range of values, and have decades of battle-tested implementations. For arbitrary data, this is genuinely the best you can do.',
        'But the cost is real. A million elements require roughly 20 million comparisons. Each comparison is a branching decision the CPU often cannot predict, and the merge or partition step moves data through memory on every pass. When keys are small integers, every comparison is extracting less information than it could -- it answers one binary question ("is a < b?") when the key itself carries far more information than a single bit.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The O(n log n) bound is mathematical, not a tuning problem. It comes from the decision-tree model: if the only operation available is pairwise comparison, any correct sort must make enough comparisons to distinguish all n! possible input orderings. That takes at least log2(n!) comparisons, which grows as Theta(n log n). No comparison-based algorithm, no matter how ingenious, can do better.',
        'To break through, you need an operation that extracts more information per step than a binary comparison. Counting sort does exactly that: it uses each key as an array index -- a direct memory lookup, not a branch. One array write tells you everything about where a value belongs. The decision-tree argument no longer applies because the algorithm is not making binary decisions. The tradeoff is that you need integer keys in a bounded range and O(k) extra memory for the count array.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A comparison asks "is a less than b?" and gets one bit of information. But a small integer key already tells you its exact rank among all possible keys. The value 3, in a range [0, 9], is by definition greater than 0, 1, and 2 and less than 4 through 9. No comparison is needed to establish this -- the value itself is the answer.',
        'Counting sort exploits this by treating each value as an address. Increment count[v] and you have recorded everything about v\'s relative position in one operation. The prefix sum then converts raw counts into placement positions: after accumulation, count[v] equals the total number of elements with value less than or equal to v, which is exactly one past the last output slot for value v. The entire sort becomes three linear scans with no branching decisions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Pass 1 -- Count. Scan the input left to right. For each value v, increment count[v]. After this pass, count[v] holds the number of times v appears in the input. Cost: one pass over n elements, O(n).',
        {
          type: 'image',
          src: 'https://www.growingwiththeweb.com/images/2014/05/25/counting-sort.svg',
          alt: 'Counting sort maps unsorted values into an auxiliary array and reads them back sorted',
          caption: 'Counting sort value mapping diagram. Source: https://www.growingwiththeweb.com/images/2014/05/25/counting-sort.svg',
        },
        'Pass 2 -- Prefix sum. Walk the count array from index 1 to k-1, adding each entry to its left neighbor: count[i] += count[i-1]. After this pass, count[v] holds the number of elements with value <= v. This is the placement ceiling: value v\'s last copy belongs at output index count[v] - 1. Cost: one pass over k entries, O(k).',
        'Pass 3 -- Place backwards. Scan the input from right to left. For each value v, decrement count[v] and write v at output[count[v]]. The decrement moves the placement cursor down so the next copy of v lands one position earlier. Iterating backwards is what makes the sort stable: the rightmost copy of v in the input is placed at the highest available slot, and the leftmost copy ends up at the lowest slot, preserving their original relative order. Cost: one pass over n elements, O(n).',
        'The prefix sum is the engine of the whole algorithm. Without it, you would know how many 3s exist but not where they belong relative to all the 2s and 1s. The prefix sum answers that question in O(k) time: count[3] gives the total number of elements with value <= 3, which tells you exactly where the block of 3s ends in the output.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'After the prefix sum, count[v] equals the number of elements with value <= v. That means position count[v] - 1 is where the last copy of v belongs in the output. When we place a copy and decrement count[v], there is now one fewer element with value <= v remaining to place, so the next copy of v correctly goes one slot earlier.',
        'Every element lands at a unique index because each placement decrements the counter. No two elements share a position, and no position is skipped, because the prefix sum accounts for exactly n elements in total. The output is sorted because every value v sits after all values less than v and before all values greater than v -- the prefix sum guarantees this partitioning.',
        'Stability deserves a separate argument. Suppose the input has two copies of value 3, at positions i and j with i < j. The backwards scan visits j first and places it at the higher output index. Then it visits i and places it one slot lower. In the output, the copy from position i appears before the copy from position j -- the same relative order as the input. Scanning left to right instead would invert their order, because the copy from i would claim the higher slot first.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(n + k). One pass counts (O(n)), one pass builds prefix sums (O(k)), one pass places elements (O(n)). When k = O(n), total work is linear. When k grows much larger than n, the prefix-sum pass dominates and performance degrades toward O(k).',
        'Space: O(n + k). The count array requires k slots and the output array requires n slots. This is not in-place. Heapsort, by comparison, sorts in O(n log n) time using only O(1) auxiliary space.',
        'Best, average, and worst case are all O(n + k). Unlike quicksort, counting sort has no bad-case inputs that cause quadratic blowup. The cost depends only on how many elements there are and how large the key range is, not on the input order.',
        'Scaling behavior is straightforward: double n with fixed k and the work roughly doubles. Double k with fixed n and the work roughly doubles. The practical sweet spot is k comparable to or smaller than n. Sorting ages (k = 150) for a million records costs about 1,000,150 operations. Sorting exam scores (k = 101) for a university class is trivially fast. Sorting pixel intensities (k = 256) in an image uses the same count-then-prefix-sum skeleton that underlies histogram equalization.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Radix sort depends on counting sort as its inner loop. Radix sort processes integers one digit at a time, and each digit-level sort must be stable so that the ordering established by previous digits is preserved. Counting sort on a single digit (k = 10 for decimal, k = 256 for byte-level radix) is fast, stable, and the exact right tool.',
        'Suffix array construction algorithms like SA-IS use counting sort internally to sort characters and induced suffixes. The alphabet size is fixed and small, making counting sort the natural choice over comparison-based alternatives.',
        'Histogram-based algorithms in image processing are essentially counting sort without the placement phase. Building a histogram, computing a cumulative distribution function, and equalizing contrast all use the same count-then-prefix-sum skeleton.',
        'Database engines sorting on low-cardinality columns (status codes, country codes, letter grades) use distribution sorts. The query planner sees column statistics showing a small number of distinct values and picks a counting or bucket sort over a comparison sort.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'When k is much larger than n, counting sort wastes both time and memory on a mostly-empty count array. Sorting 5 values in the range [0, 10^9] would allocate a billion-entry array with only 5 nonzero slots. A comparison sort ignores the range entirely and finishes in microseconds.',
        'It only works for non-negative integer keys. Floating-point values, strings, and structured objects need either a mapping to integers or a different algorithm entirely. Negative integers require an offset (subtract the minimum value to shift everything into [0, k)), which adds a preprocessing step.',
        'The space cost of O(n + k) cannot be avoided. An in-place comparison sort like heapsort uses O(1) extra memory. In memory-constrained environments, that difference can matter more than the time savings.',
        'Cache behavior degrades when k is large. The count array may not fit in L1 or L2 cache, and the placement phase writes to scattered output positions determined by prefix sums. The resulting cache misses erode the theoretical linear-time advantage, especially on modern hardware where memory latency is the dominant bottleneck.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [4, 2, 2, 8, 3, 3, 1]. Seven values, max value 8, so k = 9 (slots 0 through 8).',
        'Pass 1 -- Count. Scan left to right: count[4]++, count[2]++, count[2]++, count[8]++, count[3]++, count[3]++, count[1]++. Result: count = [0, 1, 2, 2, 1, 0, 0, 0, 1]. Two 2s, two 3s, one each of 1, 4, and 8.',
        'Pass 2 -- Prefix sum. Accumulate left to right: [0, 0+1, 1+2, 3+2, 5+1, 6+0, 6+0, 6+0, 6+1] = [0, 1, 3, 5, 6, 6, 6, 6, 7]. Interpretation: 1 element has value <= 1, 3 elements have value <= 2, 5 elements have value <= 3, 6 elements have value <= 4, 7 elements have value <= 8. The last entry equals n = 7 -- every element is accounted for.',
        'Pass 3 -- Place backwards. Input[6] = 1: decrement prefixSum[1] from 1 to 0, place 1 at output[0]. Input[5] = 3: decrement prefixSum[3] from 5 to 4, place 3 at output[4]. Input[4] = 3: decrement prefixSum[3] from 4 to 3, place 3 at output[3]. The 3 from position 4 (earlier in the input) lands at output[3], before the 3 from position 5 at output[4] -- that is stability in action. Input[3] = 8: decrement prefixSum[8] from 7 to 6, place 8 at output[6]. Input[2] = 2: decrement prefixSum[2] from 3 to 2, place 2 at output[2]. Input[1] = 2: decrement prefixSum[2] from 2 to 1, place 2 at output[1]. The 2 from position 1 lands at output[1], before the 2 from position 2 at output[2] -- stable again. Input[0] = 4: decrement prefixSum[4] from 6 to 5, place 4 at output[5].',
        'Output: [1, 2, 2, 3, 3, 4, 8]. Seven counts + eight prefix sums + seven placements = 22 operations, zero comparisons. At n = 1,000,000 with k = 9, counting sort does about 1,000,009 operations. Merge sort on the same input would need roughly 20 million comparisons plus 20 million merge writes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Harold Seward introduced counting sort in his 1954 MIT master\'s thesis, "Information Sorting in the Application of Electronic Digital Computers to Business Operations." Knuth covers it in The Art of Computer Programming, Volume 3, Section 5.2.5 (1973). Cormen, Leiserson, Rivest, and Stein treat it in Introduction to Algorithms, Chapter 8, as the stable building block for radix sort.',
        'Study next: Radix Sort uses counting sort as its stable inner loop to sort integers digit by digit -- the natural extension. Bucket Sort scatters elements into ranges and sorts each bucket, a complementary distribution sort. Merge Sort is the stable O(n log n) comparison sort -- compare how it preserves order through merging versus counting sort\'s prefix-sum placement. The comparison sort lower bound (the decision-tree argument) explains why O(n log n) is a wall and exactly how non-comparison sorts escape it.',
      ],
    },
  ],
};
