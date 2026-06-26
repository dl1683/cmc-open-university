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
        'Read each pass as sorting by one digit position. The active digit might be ones, tens, hundreds, or a byte in a binary implementation.',
        { type: 'callout', text: 'Radix sort wins by changing the question: it sorts by bounded digit values instead of asking pairwise comparisons.' },
        'The safe inference is stability. After a pass sorts by the current digit, values with equal current digits keep the order created by earlier less-significant passes.',
        'At the final pass, every digit position has participated. The array is sorted because the most significant digit groups are ordered, and ties inside each group already preserve lower-digit order.',
      
        {type: 'image', src: './assets/gifs/radix-sort.gif', alt: 'Animated walkthrough of the radix sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Comparison sorting has a lower bound of O(n log n) comparisons for arbitrary orderings. Radix sort exists for keys that are not arbitrary: fixed-width integers, bytes, zip codes, dates, and other values that decompose into bounded digits.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/SEACComputer_038.jpg/250px-SEACComputer_038.jpg', alt: 'Historical punched-card sorting machine with operator', caption: 'Card sorting made the radix idea physical: read one column, distribute into buckets, gather, and repeat. Source: Wikimedia Commons, SEACComputer 038.jpg, public domain: https://commons.wikimedia.org/wiki/File:SEACComputer_038.jpg' },
        'When digit range is small, sorting by digits can be linear in the number of items. The algorithm pays for a few counting-sort passes instead of comparing pairs until a total order is discovered.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is quicksort, merge sort, or another comparison sort. It works for any values with a comparator and is usually the right default.',
        'Counting sort is the next obvious idea for integers. It counts how many times each value appears, but it needs one bucket for every possible value in the whole range.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Direct counting sort fails when the value range is huge. Sorting 32-bit integers by one bucket per value would require billions of counters.',
        'Comparison sorting has the opposite problem. It uses little extra range memory, but it ignores the fact that a 32-bit key is only four bytes and each byte has only 256 possible values.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split each key into small bounded digits and sort one digit at a time with a stable counting sort. The count array only needs one slot per digit value, not one slot per full key value.',
        'Least-significant-digit radix sort starts with the low digit and moves upward. Stability preserves earlier digit order inside later digit groups, which is why the passes compose into a full sort.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For base 10, extract digit floor(value / exp) % 10, where exp is 1 for ones, 10 for tens, and 100 for hundreds. For byte radix sort, use masks and shifts to extract 8-bit chunks.',
        'Each pass runs stable counting sort on the extracted digit. Count digit frequencies, convert counts to prefix positions, place items into an output array, then copy the output back for the next pass.',
        'The number of passes is the number of digits in the largest key. For 32-bit unsigned integers with base 256, there are four passes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Counting sort is correct for one digit because prefix sums compute how many items belong before each digit group. Stable placement keeps equal-digit items in their previous order.',
        'Radix correctness follows by induction on passes. After pass k, the array is sorted by its k least significant digits; pass k + 1 orders the next digit and stability preserves the already-sorted lower digits inside each equal higher-digit group.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time is O(d(n + b)), where d is digit count and b is the base. If d and b are fixed constants, doubling n roughly doubles the work.',
        'Space is O(n + b) because the algorithm needs an output array and a count array reused each pass. Larger bases reduce d but increase the count array and can hurt cache behavior.',
        'For 1,000,000 32-bit integers with base 256, radix sort performs four full placement passes plus small 256-counter scans. A comparison sort needs on the order of 20,000,000 comparisons before constant factors.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Radix sort is used for large arrays of fixed-width integer keys, GPU sorting primitives, database operators on integer columns, and suffix-array construction techniques that sort small tuples.',
        'It also fits structured keys such as IP addresses or packed timestamps. The common pattern is a bounded representation where digit extraction is cheap and a stable output buffer is acceptable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Radix sort is not general comparator sorting. Locale-aware strings, arbitrary objects, and custom orderings usually need comparison sorts or more complex MSD radix handling.',
        'Small inputs can lose to quicksort because multiple full-array passes and extra memory have fixed overhead. Floating-point keys need bit transformations before their binary representation sorts numerically.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Sort [170, 45, 75, 90, 802, 24, 2, 66]. The largest value 802 has three decimal digits, so LSD radix sort uses ones, tens, and hundreds passes.',
        'Ones digits are [0, 5, 5, 0, 2, 4, 2, 6]. Stable counting sort gives [170, 90, 802, 2, 24, 45, 75, 66]. Values with ones digit 0 kept their original order: 170 before 90.',
        'Tens sorting gives [802, 2, 24, 45, 66, 170, 75, 90]. Hundreds sorting then groups all 0-hundreds values first, then 170, then 802, giving [2, 24, 45, 66, 75, 90, 170, 802].',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Historical sources include Hollerith punched-card sorting practice and Harold Seward\'s 1954 work on counting sort. Standard references include Knuth, The Art of Computer Programming, Volume 3, and CLRS, Introduction to Algorithms, Chapter 8.',
        'Study counting sort first because it is the stable engine. Then study bucket sort, MSD radix sort for strings, comparison-sort lower bounds, and GPU prefix sums for parallel implementations.',
      ],
    },
  ],
};