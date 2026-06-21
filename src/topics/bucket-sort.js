// Bucket sort: distribute elements into buckets by value range, sort each
// bucket with insertion sort, then concatenate. O(n) expected time when
// input is uniformly distributed.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'bucket-sort',
  title: 'Bucket Sort',
  category: 'Sorting',
  summary: 'Distribute elements into range-based buckets, sort each bucket, and concatenate — O(n) expected time for uniform input.',
  controls: [
    { id: 'values', label: 'Values (0–99)', type: 'number-list', defaultValue: '78, 17, 39, 26, 72, 94, 21, 12, 23, 68' },
  ],
  run,
};

function insertionSort(arr) {
  for (let i = 1; i < arr.length; i += 1) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j -= 1;
    }
    arr[j + 1] = key;
  }
}

export function* run(input) {
  const values = parseNumberList(input.values, { max: 12 });
  const n = values.length;
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal;
  const bucketCount = n;
  const buckets = Array.from({ length: bucketCount }, () => []);

  // --- Phase 0: Show input ---
  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Input: ${n} values in [${minVal}, ${maxVal}]. Bucket sort will create ${bucketCount} buckets covering this range, distribute each element into its bucket, sort each bucket with insertion sort, then concatenate.`,
  };

  // --- Phase 1: Distribute into buckets ---
  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Create ${bucketCount} empty buckets, each covering a sub-range of width ${range === 0 ? 1 : (range / bucketCount).toFixed(2)}. For each element x, its bucket index is floor(${bucketCount} * (x - ${minVal}) / ${range === 0 ? 1 : range + 1}). This maps the value range evenly across all buckets.`,
  };

  for (let i = 0; i < n; i += 1) {
    const v = values[i];
    const bi = range === 0 ? 0 : Math.min(Math.floor(bucketCount * (v - minVal) / (range + 1)), bucketCount - 1);
    buckets[bi].push(v);

    // Show bucket contents as a flat array with separators
    const flat = buckets.flatMap((b) => b);
    yield {
      state: arrayState(flat),
      highlight: { active: [`i${flat.length - 1}`] },
      explanation: `Element ${v}: bucket index = floor(${bucketCount} * (${v} - ${minVal}) / ${range + 1}) = ${bi}. Bucket ${bi} now holds [${buckets[bi].join(', ')}]. If input is uniform, each bucket gets about 1 element on average.`,
    };
  }

  // Show distribution summary
  const nonEmpty = buckets.filter((b) => b.length > 0).length;
  const maxBucket = Math.max(...buckets.map((b) => b.length));
  const flat = buckets.flatMap((b) => b);
  yield {
    state: arrayState(flat),
    highlight: {},
    explanation: `Distribution complete. ${nonEmpty} of ${bucketCount} buckets are non-empty. Largest bucket has ${maxBucket} element${maxBucket === 1 ? '' : 's'}. ${maxBucket <= 2 ? 'Good spread — insertion sort on 1–2 elements is O(1).' : maxBucket <= 3 ? 'Reasonable spread — insertion sort on small buckets is cheap.' : 'Some clustering — insertion sort cost grows quadratically within large buckets.'}`,
  };

  // --- Phase 2: Sort each bucket ---
  for (let bi = 0; bi < bucketCount; bi += 1) {
    if (buckets[bi].length <= 1) continue;

    const before = [...buckets[bi]];
    insertionSort(buckets[bi]);

    const flat2 = buckets.flatMap((b) => b);
    yield {
      state: arrayState(flat2),
      highlight: { swap: buckets[bi].map((_, j) => {
        // Find the global offset of this bucket
        let offset = 0;
        for (let k = 0; k < bi; k += 1) offset += buckets[k].length;
        return `i${offset + j}`;
      }) },
      explanation: `Sort bucket ${bi}: [${before.join(', ')}] → [${buckets[bi].join(', ')}]. Insertion sort on ${buckets[bi].length} elements: ${buckets[bi].length <= 2 ? 'at most 1 comparison.' : `at most ${buckets[bi].length * (buckets[bi].length - 1) / 2} comparisons.`} With uniform input, buckets stay small so this is O(1) expected work per bucket.`,
    };
  }

  // --- Phase 3: Concatenate ---
  const sorted = buckets.flatMap((b) => b);
  yield {
    state: arrayState(sorted),
    highlight: { sorted: sorted.map((_, i) => `i${i}`) },
    explanation: `Concatenate all buckets in order: [${sorted.join(', ')}]. Each bucket covers a higher sub-range than the previous one, so concatenation produces sorted output. Total: ${n} distributions + per-bucket insertion sorts + one concatenation. For uniform input, expected time is O(n).`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has three phases. Phase 1 distributes elements into buckets: each value is mapped to a bucket index by dividing the value range evenly across n buckets. Watch each element land in its bucket and note how the bucket index depends on the element\'s position within the range.',
        {
          type: 'callout',
          text: 'Bucket sort is fast only when the bucket map turns global ordering into many tiny local sorts.',
        },
        'Phase 2 sorts each non-trivial bucket using insertion sort. Highlighted elements show which bucket is being sorted. Most buckets contain only one or two elements when input is uniform, so these sorts finish instantly.',
        'Phase 3 concatenates all buckets left to right. Because each bucket covers a higher sub-range than the previous one, the concatenation is already in sorted order. The final sorted highlight confirms every position is correct.',
        'The key visual: if elements spread evenly across buckets, each bucket stays tiny and the per-bucket sorts are trivially cheap. If elements cluster into a few buckets, those buckets grow and insertion sort gets expensive. The distribution quality drives the total cost.',
      
        {type: 'image', src: './assets/gifs/bucket-sort.gif', alt: 'Animated walkthrough of the bucket sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Comparison-based sorting cannot beat O(n log n). The proof is information-theoretic: n elements have n! orderings, each comparison is a binary question, so any comparison tree needs at least log2(n!) levels. For a million elements, that is about 20 million comparisons, no matter how clever the algorithm.',
        'Bucket sort escapes this floor when the input distribution is known. If values are spread uniformly over a range, distributing them into n equal-width buckets puts roughly one element per bucket on average. Sorting a one-element bucket costs nothing. Concatenating n buckets costs O(n). The total expected work is O(n) -- linear.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:NcxNCsIwEEDhfU4xFyioBxBM2oqgm3YZZjGN4w-GpMSJ0tsLqVk9-Bbv5uPXPSgJnAd1sKcwZ4EP-cxvhKbZg7YXmmFaIFG4Mypd1Fid3YsFNlXaKtsqXZUdKlOkt2NMAj468n5B1a6qun_70qM1MTgSDiQMzwDTuonpygl_',
          alt: 'Flow from input values to range buckets, local sorting, and concatenation.',
          caption: 'Bucket sort replaces one global comparison problem with range buckets, local sorts, and ordered concatenation. Source: https://mermaid.ink/svg/pako:NcxNCsIwEEDhfU4xFyioBxBM2oqgm3YZZjGN4w-GpMSJ0tsLqVk9-Bbv5uPXPSgJnAd1sKcwZ4EP-cxvhKbZg7YXmmFaIFG4Mypd1Fid3YsFNlXaKtsqXZUdKlOkt2NMAj468n5B1a6qun_70qM1MTgSDiQMzwDTuonpygl_',
        },
        'The tradeoff: this speed depends on the input distribution. Uniform or near-uniform data gets O(n). Skewed data can degrade to O(n^2). Bucket sort trades generality for speed on the inputs where it fits.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use a comparison sort. Merge sort guarantees O(n log n), quicksort averages O(n log n), and both work on any comparable data without assumptions about the value distribution. They are general-purpose and battle-tested.',
        'For integer keys in a small range, counting sort achieves O(n + k) by using values as array indices. But counting sort needs the value range k to be small. Sorting a million floats in [0, 1) with counting sort requires either quantizing to integers (losing precision) or allocating an impractically large count array.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Comparison sorts treat every input distribution the same: they learn order only by asking "is a < b?" and need O(n log n) such questions regardless. If you know the values are uniformly distributed over [0, 1), every comparison is answering a question whose answer is almost predictable from the values themselves. The comparison model cannot exploit that structure.',
        'Counting sort exploits structure, but the wrong kind: it needs integer keys in a bounded range. For continuous data (floats, real-valued measurements), there is no finite set of slots to count into.',
        'Bucket sort fills the gap. It partitions the continuous range into n equal-width intervals and distributes elements into them. No comparisons for the distribution step -- just arithmetic. The only comparisons happen inside each bucket, and with uniform input, each bucket is tiny.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1 -- Create buckets. Allocate n empty lists (buckets), each responsible for a sub-range of width (max - min + 1) / n. For the classic textbook formulation with values in [0, 1): bucket i holds values in [i/n, (i+1)/n).',
        'Step 2 -- Distribute. For each element x, compute bucket index = floor(n * (x - min) / (max - min + 1)). Place x at the end of that bucket. Cost: O(n) total, one arithmetic operation per element.',
        'Step 3 -- Sort each bucket. Use insertion sort on each bucket individually. Insertion sort is O(m^2) where m is the bucket size -- but if input is uniform, the expected bucket size is O(1), so each sort is O(1) expected work. Total expected cost across all buckets: O(n).',
        'Step 4 -- Concatenate. Walk the buckets in order, appending each bucket\'s sorted contents to the output. Because bucket i contains only values in a range strictly below bucket i+1\'s range, concatenation produces a fully sorted array. Cost: O(n).',
        'For general ranges [a, b]: map each value x to (x - a) / (b - a) to normalize into [0, 1), then apply the standard bucket formula. The mapping is a single subtraction and division per element.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness: each bucket covers a disjoint sub-range of the value space, and the buckets are ordered by range. After sorting within each bucket, concatenation produces a globally sorted sequence because every element in bucket i is less than or equal to every element in bucket i+1.',
        'Expected O(n) time: suppose n elements are drawn independently and uniformly from [0, 1). The number of elements in bucket i follows a binomial distribution with parameters n and 1/n. The expected size is 1, and the variance is (1 - 1/n) < 1. Insertion sort on a bucket of size m costs O(m^2). The expected cost across all buckets is the sum of E[m_i^2] for i = 0 to n-1. Since E[m_i^2] = Var(m_i) + (E[m_i])^2 = (1 - 1/n) + 1 = 2 - 1/n, the total expected cost is n * (2 - 1/n) = 2n - 1. That is O(n).',
        'The uniformity assumption is doing the heavy lifting. It ensures that no bucket accumulates a disproportionate share of elements. If the distribution is skewed -- say, half the elements fall in one bucket -- that bucket alone costs O(n^2/4) for insertion sort, and the linear guarantee vanishes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Expected time: O(n) for uniformly distributed input. The distribution step is O(n). The per-bucket insertion sorts total O(n) in expectation. Concatenation is O(n). Doubling n doubles the expected work.',
        'Worst-case time: O(n^2). If all elements land in the same bucket, insertion sort on that bucket costs O(n^2). This happens with maximally skewed input, like sorting n copies of the same value or a distribution concentrated in one narrow interval.',
        'Space: O(n + k) where k is the number of buckets (typically k = n). The bucket lists hold n elements total, and there are k list headers. Not in-place.',
        'Stability: bucket sort is stable if the per-bucket sort is stable and elements are appended to buckets in input order. Insertion sort (as typically implemented) is stable, so the overall sort preserves the relative order of equal elements.',
        'Practical scaling: for 1,000,000 uniformly distributed values, bucket sort does roughly 2,000,000 operations. Merge sort on the same input needs about 20,000,000 comparisons plus 20,000,000 merge writes. The 10x gap is real, but only when the uniformity assumption holds.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Uniformly distributed floating-point data. Sensor readings, random samples, Monte Carlo outputs, and hash values often follow uniform or near-uniform distributions over a known range. Bucket sort handles these in linear expected time without converting to integers.',
        'Histogram-based algorithms. Building a histogram is the distribution step of bucket sort without the per-bucket sorting or concatenation. Histogram equalization, percentile computation, and density estimation all use the same scatter-into-ranges idea.',
        'External sorting. When data is too large for memory, distributing records into range-based files (buckets on disk) and sorting each file independently is the standard approach. The bucket boundaries are chosen from a sample to balance file sizes.',
        'Radix sort on floating-point numbers. IEEE 754 floats can be radix-sorted by treating their bit pattern as an integer after a sign-based transformation. Bucket sort provides the outer partitioning by exponent range, with radix sort finishing each bucket.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Skewed distributions destroy the guarantee. If 90% of values fall into 10% of the range -- exponential distributions, Zipf distributions, data with outliers -- a few buckets get most of the elements. Insertion sort on a bucket of size m costs O(m^2), and the total degrades from O(n) to O(n^2) in the worst case.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:TcxBCsIwEADAe16xH-gXBKP1pIhYT0sOMdliSM2W7YbY3wvFg-eBGSdu4eVFYbBmj4-SRpY3pDJXddB1O7B48WUFTWWFZw2ZdHHGbnTAcyrkBegzU1CK0FiyM0e8Z2oU_5ser4UgCLdI8Rc50292wlv1UbymABMHP8HCou4L',
          alt: 'Contrast between uniform input producing many tiny buckets and skewed input producing one crowded bucket.',
          caption: 'Uniform data keeps bucket-local work small; skew concentrates work into one expensive local sort. Source: https://mermaid.ink/svg/pako:TcxBCsIwEADAe16xH-gXBKP1pIhYT0sOMdliSM2W7YbY3wvFg-eBGSdu4eVFYbBmj4-SRpY3pDJXddB1O7B48WUFTWWFZw2ZdHHGbnTAcyrkBegzU1CK0FiyM0e8Z2oU_5ser4UgCLdI8Rc50292wlv1UbymABMHP8HCou4L',
        },
        'Unknown range. Bucket sort needs to know the minimum and maximum values (or the range) to compute bucket boundaries. If the range is unknown, a preliminary scan is needed, adding a pass over the data.',
        'Integer keys with a small range. Counting sort is simpler and faster: it places elements directly by value without any per-bucket sorting. Bucket sort is the right tool when keys are continuous (floats) or the range is too large for a count array.',
        'Memory cost is O(n + k). The bucket lists and their contents use space proportional to the input size. Heap sort achieves O(n log n) in O(1) auxiliary space. In memory-constrained settings, the comparison sort wins.',
        'Not general-purpose. Bucket sort assumes you know the range and the distribution is at least roughly uniform. For arbitrary data, comparison sorts make no assumptions and always deliver O(n log n).',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]. Ten values in [0, 1), ten buckets.',
        'Bucket assignment (index = floor(10 * x)): 0.78 -> bucket 7, 0.17 -> bucket 1, 0.39 -> bucket 3, 0.26 -> bucket 2, 0.72 -> bucket 7, 0.94 -> bucket 9, 0.21 -> bucket 2, 0.12 -> bucket 1, 0.23 -> bucket 2, 0.68 -> bucket 6.',
        'Bucket contents: [0]: empty, [1]: [0.17, 0.12], [2]: [0.26, 0.21, 0.23], [3]: [0.39], [4]-[5]: empty, [6]: [0.68], [7]: [0.78, 0.72], [8]: empty, [9]: [0.94].',
        'Per-bucket insertion sort: bucket 1: [0.17, 0.12] -> [0.12, 0.17] (1 comparison). Bucket 2: [0.26, 0.21, 0.23] -> [0.21, 0.23, 0.26] (3 comparisons). Bucket 7: [0.78, 0.72] -> [0.72, 0.78] (1 comparison). All other non-empty buckets have 1 element and need no sorting.',
        'Concatenate: [0.12, 0.17, 0.21, 0.23, 0.26, 0.39, 0.68, 0.72, 0.78, 0.94]. Total comparisons across all buckets: 5. A comparison sort on 10 elements needs about 23 comparisons (merge sort). Bucket sort used 10 bucket assignments + 5 insertion-sort comparisons + 10 concatenation copies = 25 operations, zero of which were full-array comparisons.',
        'At n = 1,000,000 with uniform input: each bucket gets about 1 element, total insertion-sort comparisons stay near n (about 1,000,000). Merge sort needs about 20,000,000 comparisons. The linear-versus-linearithmic gap is a 20x speedup.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cormen, Leiserson, Rivest, and Stein cover bucket sort in Introduction to Algorithms, Chapter 8, with the expected-time analysis for uniform input. Knuth discusses distribution sorting in The Art of Computer Programming, Volume 3, Section 5.2.5.',
        'Prerequisites: Insertion Sort (the per-bucket sort -- understand why it is O(m^2) in general but O(1) when m is constant), Counting Sort (the integer-key distribution sort -- bucket sort generalizes the idea to continuous keys).',
        'Extensions: Radix Sort (processes digits instead of ranges, uses counting sort as its stable sub-sort), external merge sort (the disk-based version of the distribute-and-sort strategy).',
        'Alternatives: Counting Sort (faster and simpler when keys are integers in a small range -- no per-bucket sorting needed), Merge Sort (stable O(n log n) regardless of distribution -- the safe default when you cannot assume uniformity), Quick Sort (average O(n log n) with small constants -- often faster in practice than bucket sort on non-uniform data).',
      ],
    },
  ],
};
