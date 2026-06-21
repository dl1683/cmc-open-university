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
        'The animation has three phases. Phase 1 builds the count array: each input value lights up its matching slot and increments the counter there. Phase 2 converts counts into prefix sums (cumulative counts): each slot accumulates the total of all slots up to and including itself. Phase 3 builds the sorted output by scanning the input backwards, using each prefix sum as a placement cursor.',
        {
          type: 'callout',
          text: 'Counting sort escapes comparison sorting by using small integer keys as addresses, then prefix sums turn counts into stable positions.',
        },
        'Active highlights mark the slot being written. Compare highlights during the prefix-sum phase show which neighbor contributes. At the end, the sorted highlight confirms every position is final.',
        'The backwards scan in phase 3 is the detail that matters most. When two copies of the same value exist, the copy scanned first (the one further right in the input) is placed at the higher output index. The copy scanned second lands one position lower. Their original left-to-right order survives in the output. That is stability, and the animation makes it visible step by step.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Comparison-based sorting has a proven floor: any algorithm that decides order by comparing pairs needs at least O(n log n) comparisons in the worst case. The decision-tree argument shows that n elements can be arranged in n! ways, and a binary decision tree over n! leaves needs at least log2(n!) levels. For a million elements, that is about 20 million comparisons, and no amount of clever engineering can reduce it.',
        'Counting sort dodges this floor entirely. It never compares two elements. If every key is an integer in a known range [0, k), it counts how many times each key appears and computes output positions by arithmetic. The cost is O(n + k) -- linear in the input size plus the range size. When k is small relative to n, this is far cheaper than any comparison sort.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use a comparison sort. Merge sort and quicksort both achieve O(n log n) time, and for arbitrary data that is the best you can do. They work on any comparable type, need no assumptions about the range of values, and their implementations are battle-tested.',
        'The cost is real, though. A million elements require about 20 million comparisons. Each comparison is a branching decision that the CPU cannot easily predict, and the merge or partition step moves data through memory on every pass. For general objects this is unavoidable. But when keys are small integers, every comparison is doing less work than it could -- it answers one binary question ("is a < b?") when the key itself carries more information than that.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The O(n log n) bound is mathematical, not a tuning problem. It follows from the decision-tree model: if the only way to learn about the input is pairwise comparisons, any correct sort must make enough of them to distinguish all n! permutations. That requires log2(n!) comparisons, which is Theta(n log n).',
        'Counting sort breaks through by refusing to compare. It uses each key as an array index -- a direct memory lookup, not a branch. This operation extracts more information per step than a comparison does, so the decision-tree argument no longer applies. The tradeoff: the algorithm needs integer keys in a bounded range, and it needs O(k) extra memory to hold the counts.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Pass 1 -- Count. Scan the input left to right. For each value v, increment count[v]. After this pass, count[v] holds the number of times v appears. Cost: O(n).',
        {
          type: 'image',
          src: 'https://www.growingwiththeweb.com/images/2014/05/25/counting-sort.svg',
          alt: 'Counting sort maps unsorted values into an auxiliary array and reads them back sorted',
          caption: 'Counting sort value mapping diagram. Source: https://www.growingwiththeweb.com/images/2014/05/25/counting-sort.svg',
        },
        'Pass 2 -- Prefix sum. Walk the count array from index 1 to k-1, adding each entry to its predecessor: count[i] += count[i-1]. After this pass, count[v] holds the number of elements with value <= v. This number is the placement ceiling: value v\'s last copy belongs at output index count[v] - 1. Cost: O(k).',
        'Pass 3 -- Place backwards. Scan the input from right to left. For each value v, decrement count[v] and write v at output[count[v]]. The decrement moves the cursor down, so the next copy of v lands one position earlier. Iterating backwards is the key to stability: the rightmost copy of v is placed first at the highest available slot, and the leftmost copy is placed last at the lowest available slot. Their original order is preserved. Cost: O(n).',
        'The prefix sum is the engine. Without it, you would know how many 3s exist but not where they belong relative to all the 2s and 1s. The prefix sum answers that in O(k) time: count[3] tells you the total number of elements with value <= 3, which is exactly the first index after the 3-block ends.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'After the prefix sum, count[v] equals the number of elements with value <= v. That means position count[v] - 1 is where the last copy of v belongs. Decrementing count[v] after placing one copy of v is correct because there is now one fewer element with value <= v remaining to place. The next copy of v goes one slot earlier.',
        'Every element lands at a unique index because each placement decrements the counter. No two elements share a position, and no position is skipped, because the prefix sum accounts for exactly n elements total. The output is sorted because every value v sits after all values less than v and before all values greater than v -- the prefix sum guarantees this partitioning.',
        'Stability: suppose the input has two copies of value 3, at positions i and j with i < j. The backwards scan visits j first and places it at the higher output index. Then it visits i and places it at the next lower index. In the output, the copy from position i comes before the copy from position j -- the same relative order as the input. If you scanned left to right instead, the copy from i would take the higher index and j the lower, inverting their order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(n + k). One pass counts (O(n)), one pass builds prefix sums (O(k)), one pass places (O(n)). When k = O(n), total work is linear. When k >> n, the prefix sum pass dominates and the algorithm degrades.',
        'Space: O(n + k). The count array needs k slots, the output array needs n slots. This is not in-place. Heapsort, by contrast, sorts in O(n log n) time with O(1) auxiliary space.',
        'Scaling: double n with fixed k and work roughly doubles. Double k with fixed n and work roughly doubles. The practical sweet spot is k comparable to or smaller than n. Sorting ages (k = 150) for a million records: about 1,000,150 operations. Sorting exam scores (k = 101) for a university: trivially fast. Sorting pixel intensities (k = 256) in an image: the same counting-and-prefix-sum structure underlies histogram equalization.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Radix sort depends on counting sort. Radix sort processes one digit at a time, and each digit-level sort must be stable so that the ordering from previous digits is preserved. Counting sort on a single digit (k = 10 for decimal, k = 256 for byte-level radix) is fast, stable, and exactly the right tool.',
        'Suffix array construction algorithms like SA-IS use counting sort internally to sort characters and induced suffixes. The alphabet size is fixed and small, making counting sort the natural choice over comparison-based alternatives.',
        'Histogram-based algorithms in image processing are counting sort without the placement phase. Building a histogram, computing a cumulative distribution function, equalizing contrast -- all use the same count-then-prefix-sum skeleton.',
        'Database engines sorting on low-cardinality columns (status codes, country codes, letter grades) use distribution sorts. The query planner sees column statistics showing small k and chooses a counting or bucket sort over a comparison sort.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'When k >> n, counting sort wastes memory on a mostly-empty count array. Sorting 5 values in the range [0, 10^9] allocates a billion-entry array with 5 nonzero slots. A comparison sort ignores the range entirely and finishes in microseconds.',
        'It only works for non-negative integer keys. Floating-point values, strings, and structured objects need either a mapping to integers or a different algorithm. Negative integers require an offset (subtract the minimum value), which adds a preprocessing step and shifts the range.',
        'The space cost is O(n + k) with no way to avoid it. An in-place comparison sort like heapsort uses O(1) extra memory. In memory-constrained settings, that difference matters more than the time saved.',
        'Cache behavior suffers when k is large. The count array may not fit in L1/L2 cache, and the placement phase writes to scattered output positions determined by prefix sums, causing cache misses that erode the theoretical linear-time advantage.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [4, 2, 2, 8, 3, 3, 1]. Seven values, max value 8, so k = 9 (slots 0 through 8).',
        'Pass 1 -- Count. Scan left to right: count[4]++, count[2]++, count[2]++, count[8]++, count[3]++, count[3]++, count[1]++. Result: count = [0, 1, 2, 2, 1, 0, 0, 0, 1]. Two 2s, two 3s, one each of 1, 4, and 8.',
        'Pass 2 -- Prefix sum. Accumulate left to right: [0, 0+1, 1+2, 3+2, 5+1, 6+0, 6+0, 6+0, 6+1] = [0, 1, 3, 5, 6, 6, 6, 6, 7]. Read it: 1 element has value <= 1, 3 elements have value <= 2, 5 elements have value <= 3, 6 elements have value <= 4, 7 elements have value <= 8. The last entry equals n = 7 -- every element is accounted for.',
        'Pass 3 -- Place backwards. Input[6] = 1: decrement prefixSum[1] from 1 to 0, place 1 at output[0]. Input[5] = 3: decrement prefixSum[3] from 5 to 4, place 3 at output[4]. Input[4] = 3: decrement prefixSum[3] from 4 to 3, place 3 at output[3]. The 3 from position 4 (earlier in input) lands at output[3], before the 3 from position 5 at output[4] -- stability. Input[3] = 8: decrement prefixSum[8] from 7 to 6, place 8 at output[6]. Input[2] = 2: decrement prefixSum[2] from 3 to 2, place 2 at output[2]. Input[1] = 2: decrement prefixSum[2] from 2 to 1, place 2 at output[1]. The 2 from position 1 lands at output[1], before the 2 from position 2 at output[2] -- stable again. Input[0] = 4: decrement prefixSum[4] from 6 to 5, place 4 at output[5].',
        'Output: [1, 2, 2, 3, 3, 4, 8]. Seven counts + eight prefix sums + seven placements = 22 operations, zero comparisons. At n = 1,000,000 with k = 9, counting sort does about 1,000,009 operations. Merge sort on the same input needs roughly 20 million comparisons plus 20 million merge writes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Harold Seward introduced counting sort in his 1954 MIT master\'s thesis, "Information Sorting in the Application of Electronic Digital Computers to Business Operations." Knuth covers it in The Art of Computer Programming, Volume 3, Section 5.2.5 (1973). Cormen, Leiserson, Rivest, and Stein treat it in Introduction to Algorithms, Chapter 8, as the stable building block of radix sort.',
        'Study next: Radix Sort uses counting sort as its stable inner loop to sort integers digit by digit -- the natural extension. Bucket Sort scatters elements into ranges and sorts each bucket, a complementary distribution sort. Merge Sort is the stable O(n log n) comparison sort -- compare how it preserves order through merging versus counting sort\'s prefix-sum placement. The comparison sort lower bound (decision-tree argument) explains why O(n log n) is a wall and how non-comparison sorts escape it.',
      ],
    },
  ],
};
