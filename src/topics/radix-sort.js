// Radix sort: sort integers digit by digit, least significant first.
// Each pass uses counting sort on one digit position.
// After d passes (one per digit), the array is fully sorted.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'radix-sort',
  title: 'Radix Sort',
  category: 'Sorting',
  summary: 'Sort integers digit by digit — each pass is counting sort on one position, and d passes finish the job in O(d·n).',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '170, 45, 75, 90, 802, 24, 2, 66' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 12 });
  const n = values.length;
  const base = 10;

  // Find the maximum value to know how many digit passes we need.
  const maxVal = Math.max(...values);
  const digitCount = maxVal === 0 ? 1 : Math.floor(Math.log10(maxVal)) + 1;

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Radix sort processes one digit position at a time, from least significant to most significant. The largest value is ${maxVal}, which has ${digitCount} digit${digitCount === 1 ? '' : 's'}, so we need ${digitCount} pass${digitCount === 1 ? '' : 'es'}.`,
  };

  let exp = 1; // current digit place: 1 = ones, 10 = tens, 100 = hundreds, ...

  for (let d = 0; d < digitCount; d += 1) {
    const placeName = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands'][d] || `10^${d}`;

    // Show the digit extraction for this pass
    const digits = values.map((v) => Math.floor(v / exp) % base);
    yield {
      state: arrayState(values),
      highlight: { active: values.map((_, i) => `i${i}`) },
      explanation: `Pass ${d + 1}: sort by the ${placeName} digit. Extract each digit: [${digits.join(', ')}]. Counting sort will rearrange the array by these digits while preserving the order from previous passes.`,
      invariant: d > 0
        ? `After ${d} pass${d === 1 ? '' : 'es'}, the array is sorted by its last ${d} digit${d === 1 ? '' : 's'}.`
        : undefined,
    };

    // Counting sort on the current digit
    const count = new Array(base).fill(0);
    for (let i = 0; i < n; i += 1) {
      count[Math.floor(values[i] / exp) % base] += 1;
    }

    yield {
      state: arrayState(values),
      highlight: {},
      explanation: `Count how many values have each ${placeName} digit: [${count.join(', ')}] for digits 0–${base - 1}. These counts tell counting sort where each group starts in the output.`,
    };

    // Prefix sum to get positions
    for (let i = 1; i < base; i += 1) {
      count[i] += count[i - 1];
    }

    // Build output array (iterate backward for stability)
    const output = new Array(n);
    for (let i = n - 1; i >= 0; i -= 1) {
      const digit = Math.floor(values[i] / exp) % base;
      count[digit] -= 1;
      output[count[digit]] = values[i];
    }

    // Show the rearranged result
    // Find which positions changed
    const moved = [];
    for (let i = 0; i < n; i += 1) {
      if (values[i] !== output[i]) moved.push(`i${i}`);
    }

    // Copy output back
    for (let i = 0; i < n; i += 1) {
      values[i] = output[i];
    }

    yield {
      state: arrayState(values),
      highlight: { swap: moved.length > 0 ? moved : undefined, sorted: d === digitCount - 1 ? values.map((_, i) => `i${i}`) : undefined },
      explanation: d < digitCount - 1
        ? `After sorting by the ${placeName} digit: [${values.join(', ')}]. The array is now sorted by its last ${d + 1} digit${d + 1 === 1 ? '' : 's'}. Values with the same ${placeName} digit kept their relative order from the previous pass — that stability is what makes multi-pass radix sort correct.`
        : `Final pass complete. After sorting by the ${placeName} digit: [${values.join(', ')}]. All ${digitCount} digit positions have been processed, so the array is fully sorted.`,
    };

    exp *= base;
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: `Sorted in ${digitCount} passes of ${n} elements each = ${digitCount * n} counting-sort placements. Each pass is O(n + b) where b is the base (${base}). Total: O(d·(n + b)) = O(${digitCount}·${n + base}) — linear in n when d and b are constants.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation processes one digit position per pass, from least significant (ones) to most significant (hundreds). Each pass begins by extracting the digit at that position from every value. The extracted digits appear in the explanation text.',
        'After the digit extraction, counting sort rearranges the array by those digits. Watch for two things: values move into digit-group order, and values that share a digit keep the same relative order they had before the pass. That preserved order is stability.',
        'After pass k, the array is sorted by its last k digits. By the final pass, all digit positions have been processed and the array is fully sorted. At each frame, ask: which digit position is active, what digit does each value have there, and where does counting sort place each value without ever comparing two values directly?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every comparison-based sorting algorithm hits a provable floor: O(n log n) comparisons in the worst case. Merge sort and heap sort reach it. No comparison sort can beat it. The proof is information-theoretic: n elements have n! possible orderings, and each comparison is a binary question, so distinguishing all orderings requires at least log2(n!) binary answers. Stirling gives log2(n!) ~ n log2 n. For a million elements, that is about 20 million comparisons, period.',
        'Herman Hollerith built the first radix sort in hardware for the 1890 US census. Operators fed punched cards through a machine that read one column at a time and dropped each card into one of ten digit buckets. They gathered the buckets in order, then repeated for the next column, least significant first. The process sorted thousands of census records without anyone comparing two cards. Harold Seward formalized counting sort — the stable single-digit sort that makes radix sort correct — in his 1954 MIT master\'s thesis.',
        'Radix sort escapes the O(n log n) floor because it never asks "is a < b?" It asks "what digit does a have at position k?" — a question with a small, fixed number of answers. That question is answered by arithmetic (division and modulo), not by comparison. The comparison-sort lower bound simply does not apply.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use a comparison sort. Quicksort averages O(n log n), merge sort guarantees it, and both handle arbitrary data types. For general-purpose sorting of objects with a custom comparator, this is the right tool.',
        'When the data is integers in a small range, a simpler option exists: counting sort. Allocate a count array of size k (one slot per possible value), tally each value, compute prefix sums, and place elements. O(n + k) time, no comparisons. For exam scores in [0, 100] or ages in [0, 120], k is tiny and this is faster than any comparison sort.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The comparison-sort wall is mathematical. n elements have n! permutations. A comparison is a binary question, so any comparison-based decision tree has at least ceil(log2(n!)) leaves. By Stirling, log2(n!) ~ n log2 n. No clever implementation can beat this — the lower bound comes from the information content of the problem itself.',
        'Counting sort breaks this bound by using values as array indices instead of comparing them. But it has its own wall: the count array must cover the entire value range. Sorting a million 32-bit integers directly with counting sort requires a 4-billion-entry count array — 16 GB of memory for the counts alone, regardless of n. When the range k dwarfs the input size n, counting sort loses to merge sort despite avoiding comparisons.',
        'Radix sort solves this by decomposing values into digits. A 32-bit integer is four 8-bit bytes. Instead of one pass with 4 billion buckets, do four passes with 256 buckets each. The 16 GB count array becomes four 256-entry arrays. Each pass costs O(n + 256). Four passes cost O(4n) — linear.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Counting sort (the single-digit engine): given n values each in range [0, k), allocate a count array of size k, initialized to zero. Scan the input and increment count[v] for each value v. Convert counts to prefix sums: count[i] += count[i-1], so count[v] holds the number of elements with value at most v. Scan the input right-to-left: for each value v, decrement count[v] and place v at output[count[v]]. The right-to-left scan preserves stability — equal values keep their original relative order.',
        'Radix sort (the multi-pass wrapper): find the maximum value and compute how many digit positions d it has (d = floor(log10(max)) + 1 for base 10, or ceil(bits/8) for base 256). For each digit position from least significant to most significant, extract the digit from every value using floor(value / exp) % base, then run counting sort on those digits. Copy the output back and advance to the next position.',
        'LSD (least significant digit first) processes ones, then tens, then hundreds. MSD (most significant digit first) processes hundreds, then tens, then ones, but requires recursive sub-bucket handling and is more complex. LSD is the standard approach because it is non-recursive and naturally stable.',
        'The stability of counting sort is not a nice property — it is the mechanism that makes multi-pass radix sort correct. If pass 2 scrambled elements that shared the same tens digit, the ones-digit ordering from pass 1 would be destroyed. Stability guarantees that within each digit group, the ordering from all previous passes is preserved.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Counting sort places each element at its correct position because the prefix sum of count[v] equals the number of elements with value at most v. That is exactly the index where the last copy of v belongs. Decrementing before placing the next copy of v moves it one position earlier, which is correct — there is one fewer element at most v left to place. Every element lands at a unique index, no position is skipped, and the right-to-left scan preserves input order among equal values.',
        'Radix sort correctness follows by induction on digit position. Base case: after pass 1 (ones digit), the array is sorted by the ones digit — counting sort handles this directly. Inductive step: assume after pass k the array is sorted by its last k digits. Pass k+1 sorts by digit k+1. Values with different digits at position k+1 land in the correct relative order (counting sort places smaller digits first). Values with the same digit at position k+1 retain their order from pass k, because counting sort is stable. So they are sorted by their last k digits within each digit-k+1 group, which means the array is sorted by its last k+1 digits.',
        'After d passes, the array is sorted by all d digits — full numerical order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Counting sort: O(n + k) time, O(n + k) space. n for the input scan and placement, k for the count array and prefix sums. When k is comparable to or smaller than n, this is linear. When k dwarfs n, the k term dominates and the algorithm is impractical.',
        'Radix sort: O(d(n + k)) time, O(n + k) space, where d is the number of digit positions and k is the base (number of buckets per pass). The output array (size n) and count array (size k) are reused across passes, so space does not multiply by d.',
        'When d and k are constants — 32-bit integers with base 256 give d = 4, k = 256 — the cost is O(4(n + 256)) = O(n). Linear time. Doubling n doubles the work. Doubling the maximum value adds one digit pass (logarithmic in the value range). The base k is a tuning knob: larger k means fewer passes but a bigger count array. Base 256 is the common engineering choice — 4 passes for 32-bit keys, 8 for 64-bit, and each 256-entry count array fits in L1 cache.',
        'Neither counting sort nor radix sort is in-place. Both require an auxiliary output array of size n. Heap sort uses O(1) extra space and guarantees O(n log n) — if memory is scarce, the comparison sort wins.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Sorting integers when the word size is bounded. A million 32-bit integers: radix sort does 4 million placements, quicksort does about 20 million comparisons. The gap widens with n because radix sort is O(n) and comparison sorts are O(n log n).',
        'GPU sorting. Counting sort decomposes into independent histogram-building and prefix-sum steps, both of which map cleanly to GPU parallel primitives. GPU radix sort (CUDA CUB, AMD ROCm) is the fastest known method for sorting large integer or float arrays on GPUs.',
        'Suffix array construction. The DC3/skew and SA-IS algorithms use radix sort to sort character triples in linear time, enabling O(n) suffix array construction.',
        'Fixed-width key sorting: IP addresses (4 byte-level passes regardless of n), zip codes, playing cards (suit then rank or vice versa), and any domain where keys decompose into a small number of bounded fields.',
        'Database integer-key joins and aggregations when column statistics confirm a bounded key space. Radix sort avoids comparison overhead and has predictable, tunable cache behavior.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Large or unbounded key ranges make counting sort impractical. Sorting 100 arbitrary 64-bit integers: 8 passes of 100 elements with base 256 is 800 placements plus overhead, while introsort does about 600 comparisons with no auxiliary array. The constant factors of radix sort lose at small n.',
        'Floating-point numbers require special handling. IEEE 754 floats are not sorted by their bit pattern (sign bit is inverted, negative exponents sort backward). Radix sorting floats requires a bit-flipping transform before sorting and an inverse transform after. It works, but it is not transparent.',
        'Variable-length keys (arbitrary-precision integers, variable-length strings) need MSD radix sort with recursive sub-bucket handling, which is significantly more complex than LSD and loses the simple non-recursive structure.',
        'O(n + k) extra space is unavoidable. Radix sort is not in-place. In memory-constrained environments, in-place heap sort (O(1) auxiliary space, O(n log n) time) is the better choice.',
        'Comparison sorts are more general. They work with any data type that supports a comparator: custom objects, composite keys, locale-sensitive string orderings. Radix sort requires keys that decompose into bounded digits.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Counting sort on [4, 2, 2, 8, 3, 3, 1] with range 0-9. Seven values, k = 10.',
        'Count: scan left to right. count = [0, 1, 2, 2, 1, 0, 0, 0, 1, 0]. Value 2 appears twice, value 3 appears twice, values 1, 4, 8 once each.',
        'Prefix sum: accumulate left to right. prefix = [0, 1, 3, 5, 6, 6, 6, 6, 7, 7]. Read: 1 element is at most 1, 3 elements are at most 2, 5 are at most 3, 6 are at most 4, 7 are at most 8. The last entry equals n = 7 — all elements accounted for.',
        'Place right-to-left: input[6]=1, prefix[1] becomes 0, place 1 at output[0]. input[5]=3, prefix[3] becomes 4, place 3 at output[4]. input[4]=3, prefix[3] becomes 3, place 3 at output[3]. input[3]=8, prefix[8] becomes 6, place 8 at output[6]. input[2]=2, prefix[2] becomes 2, place 2 at output[2]. input[1]=2, prefix[2] becomes 1, place 2 at output[1]. input[0]=4, prefix[4] becomes 5, place 4 at output[5]. Output: [1, 2, 2, 3, 3, 4, 8]. The two 2s and two 3s each kept their original relative order — stability confirmed.',
        'Now LSD radix sort on [170, 45, 75, 90, 802, 24, 2, 66]. Maximum value 802, three digits, three passes.',
        'Pass 1 (ones digit): digits = [0, 5, 5, 0, 2, 4, 2, 6]. Counting sort groups: digit 0 gets 170, 90; digit 2 gets 802, 2; digit 4 gets 24; digit 5 gets 45, 75; digit 6 gets 66. Result: [170, 90, 802, 2, 24, 45, 75, 66]. Sorted by ones digit. 170 before 90 (both digit 0) — stability preserved input order.',
        'Pass 2 (tens digit): digits = [7, 9, 0, 0, 2, 4, 7, 6]. Groups: digit 0 gets 802, 2; digit 2 gets 24; digit 4 gets 45; digit 6 gets 66; digit 7 gets 170, 75; digit 9 gets 90. Result: [802, 2, 24, 45, 66, 170, 75, 90]. Sorted by last two digits. In the digit-7 group, 170 before 75 — ones-digit order from pass 1 preserved.',
        'Pass 3 (hundreds digit): digits = [8, 0, 0, 0, 0, 1, 0, 0]. Groups: digit 0 gets 2, 24, 45, 66, 75, 90 (in that order from pass 2); digit 1 gets 170; digit 8 gets 802. Result: [2, 24, 45, 66, 75, 90, 170, 802]. Fully sorted. The six values with hundreds digit 0 kept their pass-2 order, which was already correct by two digits.',
        'Total: 3 passes of 8 elements = 24 placements. Quicksort on the same input averages about 24 comparisons. At this scale they are comparable. At n = 1,000,000 with d = 3: radix sort does 3 million placements; quicksort does roughly 20 million comparisons. Radix sort wins by nearly 7x, and the gap grows with n.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Herman Hollerith, 1890 — punched-card sorting machines for the US census, the first mechanical radix sort. Operators sorted cards column-by-column, least significant first; the LSD ordering was dictated by the stability requirement, understood mechanically before it was formalized. Harold Seward, 1954 — formalized counting sort as a stable linear-time sub-sort, MIT master\'s thesis. Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.5 (1973). Cormen, Leiserson, Rivest, Stein, Introduction to Algorithms, Chapter 8.',
        'Prerequisites: Counting Sort (the stable subroutine each radix pass uses — understand its prefix-sum placement before studying radix sort), positional number systems (digit extraction via division and modulo).',
        'Extensions: Bucket Sort (another distribution sort — partitions by value range rather than by digit), MSD Radix Sort (processes most significant digit first, recurses into sub-buckets, handles variable-length strings).',
        'Alternatives: Merge Sort (stable O(n log n) comparison sort — compare its divide-and-conquer stability with radix sort\'s digit-by-digit stability), Quick Sort (fast O(n log n) average — contrast its comparison-based partitioning with radix sort\'s digit-based partitioning to see when each wins).',
      ],
    },
  ],
};
