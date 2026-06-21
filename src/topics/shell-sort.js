// Shell sort: diminishing-increment insertion sort. Large gaps fix gross
// disorder cheaply; shrinking gaps refine toward a final insertion pass on
// nearly-sorted data. The first algorithm to break the O(n^2) barrier for
// in-place comparison sorting (Shell, CACM 1959).

import { arrayState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'shell-sort',
  title: 'Shell Sort',
  category: 'Sorting',
  summary: 'Diminishing-increment sort: insertion sort with long-range element swaps, closing the gap to O(n log n).',
  controls: [
    { id: 'size', label: 'Array size', type: 'select', options: ['8', '12', '16'], defaultValue: '8' },
  ],
  run,
};

const ids = (count) => Array.from({ length: count }, (_, i) => `i${i}`);

function generateArray(n) {
  const arr = [];
  for (let i = 0; i < n; i += 1) {
    arr.push(Math.floor(Math.random() * 50) + 1);
  }
  return arr;
}

function shellGaps(n) {
  // Shell's original sequence: n/2, n/4, ..., 1
  const gaps = [];
  let g = Math.floor(n / 2);
  while (g >= 1) {
    gaps.push(g);
    g = Math.floor(g / 2);
  }
  return gaps;
}

export function* run(input) {
  const n = parseIntegerInRange(input.size, { min: 8, max: 16, label: 'Array size' });
  const values = generateArray(n);
  const gaps = shellGaps(n);
  let comparisons = 0;
  let swaps = 0;

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Starting array of ${n} values. Shell sort will run insertion sort at decreasing gap sizes ${gaps.join(', ')}. Large gaps move far-apart elements early, so the final gap-1 pass works on nearly-sorted data.`,
  };

  for (const gap of gaps) {
    const subarrayCount = Math.min(gap, n);
    yield {
      state: arrayState(values),
      highlight: {},
      explanation: `Gap = ${gap}: the array splits into ${subarrayCount} interleaved subarray${subarrayCount > 1 ? 's' : ''} (elements ${gap} apart). Each subarray gets insertion-sorted independently.`,
      invariant: `After this pass the array will be "${gap}-sorted" — every element is in order relative to elements ${gap} positions away.`,
    };

    // Gapped insertion sort
    for (let i = gap; i < n; i += 1) {
      const key = values[i];

      // Highlight the element about to be inserted
      yield {
        state: arrayState(values),
        highlight: { active: [`i${i}`] },
        explanation: `Subarray ${(i % gap)}: insert ${key} (position ${i}) into its sorted place among elements at positions ${Array.from({ length: Math.floor(i / gap) + 1 }, (_, k) => (i % gap) + k * gap).filter(p => p < i).join(', ')}.`,
      };

      let j = i;
      while (j >= gap && values[j - gap] > key) {
        comparisons += 1;

        yield {
          state: arrayState(values),
          highlight: { compare: [`i${j - gap}`, `i${j}`] },
          explanation: `Compare ${values[j - gap]} (position ${j - gap}) with ${key}. ${values[j - gap]} > ${key}, so shift ${values[j - gap]} right by ${gap} position${gap > 1 ? 's' : ''}.`,
        };

        values[j] = values[j - gap];
        swaps += 1;

        yield {
          state: arrayState(values),
          highlight: { swap: [`i${j - gap}`, `i${j}`] },
          explanation: `Shifted ${values[j]} to position ${j}. Continue checking further left in the same subarray.`,
        };

        j -= gap;
      }

      if (j >= gap) {
        comparisons += 1;
      }

      values[j] = key;

      if (j === i) {
        yield {
          state: arrayState(values),
          highlight: { found: [`i${j}`] },
          explanation: `${key} is already in place at position ${j} — no shifting needed in this subarray.`,
        };
      } else {
        yield {
          state: arrayState(values),
          highlight: { found: [`i${j}`] },
          explanation: `${key} lands at position ${j}. It moved ${i - j} position${i - j > 1 ? 's' : ''} left within its gap-${gap} subarray.`,
        };
      }
    }

    yield {
      state: arrayState(values),
      highlight: {},
      explanation: `Gap-${gap} pass complete. The array is now ${gap}-sorted: within every subarray of elements ${gap} apart, values are in order.`,
      invariant: `${gap}-sorted: for all valid i, values[i] <= values[i + ${gap}].`,
    };
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: ids(n) },
    explanation: `Array is sorted. Shell sort completed with ${comparisons} comparisons and ${swaps} shifts. The large-gap passes reduced disorder so the final gap-1 pass (plain insertion sort) had very little shifting left to do.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation runs Shell sort in multiple passes, each with a decreasing gap. In each pass, elements that are gap positions apart form an interleaved subarray, and that subarray gets insertion-sorted.',
        {
          type: 'callout',
          text: 'Shell sort makes insertion sort cheaper by moving far-away elements early, then finishing with a nearly sorted gap-1 pass.',
        },
        'The active highlight marks the element being inserted. The compare highlights show it being tested against the element gap positions to its left. When a shift occurs, the swap highlight marks both positions. The found highlight marks where the element lands.',
        'Watch how the early large-gap passes move small values leftward and large values rightward in big jumps. By the time the final gap-1 pass runs, the array is nearly sorted and very few shifts are needed. That is the entire point of Shell sort: do the expensive long-distance moves when the subarrays are small and cheap.',
      
        {type: 'image', src: './assets/gifs/shell-sort.gif', alt: 'Animated walkthrough of the shell sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1959, Donald Shell published "A High-Speed Sorting Procedure" in Communications of the ACM. It was the first algorithm to break the O(n squared) barrier for in-place comparison sorting without using divide-and-conquer or auxiliary storage. Before Shell sort, in-place sorts were all quadratic. After it, the question became: how good can you get with a simple loop modification?',
        'Shell sort matters historically because it proved that a small algorithmic insight — comparing elements far apart before comparing neighbors — could turn a slow algorithm into a fast one. It is also one of the simplest sub-quadratic sorts to implement: the code is insertion sort with one extra loop around it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Insertion sort is the natural starting point. It grows a sorted prefix by sliding each new element leftward until it finds its place. On nearly-sorted data it runs in nearly O(n) time, because each element moves only a few positions. On random data it is O(n squared) because elements must travel long distances.',
        'The key observation: insertion sort is fast when elements are close to their final positions. If you could get the array close to sorted cheaply, the final insertion pass would be almost free.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Insertion sort moves elements one position at a time. A small element sitting at the far right of the array must be shifted left through every larger element — up to n minus 1 shifts for a single value. The total work is proportional to the number of inversions, and random data has O(n squared) inversions.',
        'The problem is not that insertion sort is bad. The problem is that each comparison-and-shift fixes exactly one inversion. When elements are far from their final positions, you need a way to fix many inversions with a single move.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a decreasing sequence of gap values ending with 1. For each gap g, divide the array into g interleaved subarrays: subarray 0 contains positions 0, g, 2g, 3g, and so on; subarray 1 contains positions 1, g+1, 2g+1, and so on. Insertion-sort each subarray independently. When all g subarrays are sorted, the array is "g-sorted."',
        {
          type: 'image',
          src: 'https://www.programiz.com/sites/tutorial2program/files/shell-sort-0.0.png',
          alt: 'Eight-element input array used in a Shell sort gap-pass example',
          caption: 'A Shell sort trace starts from a fixed array, then applies decreasing gap passes to move distant values early. Source: Programiz Shell Sort tutorial https://www.programiz.com/dsa/shell-sort.',
        },
        'After the g-sorted pass, move to the next smaller gap and repeat. Each pass sorts longer subarrays, but those subarrays are already partially ordered by the previous passes. The final pass uses gap 1, which is plain insertion sort over the entire array — but by now the array is nearly sorted, so this pass is fast.',
        'Shell\'s original gap sequence is n/2, n/4, n/8, ..., 1. The implementation is just insertion sort with the inner loop stepping by gap instead of 1, wrapped in an outer loop that shrinks the gap.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Large gaps fix gross disorder cheaply. When the gap is n/2, each subarray has only two elements. Sorting two elements costs at most one comparison and one swap — but that single swap moves a value n/2 positions, eliminating up to n/2 inversions at once. With n/2 subarrays, the total work for this pass is O(n), and it halves the average displacement of each element.',
        'Small gaps finish efficiently because the array is already almost sorted. The critical property is that an h-sorted array remains h-sorted after being k-sorted for any k less than h. Each pass preserves the ordering work done by previous passes and refines it further.',
        'The combination is more than the sum of its parts. The gap-4 pass does not merely sort subarrays of size n/4; it also partially sorts the subarrays that the gap-2 pass will handle. This cascading partial order is what makes the total work sub-quadratic.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The complexity of Shell sort depends entirely on the gap sequence, and optimal gap sequences are still an open research problem.',
        'Shell\'s original sequence (n/2, n/4, ..., 1): O(n squared) worst case. The worst case arises because even-indexed and odd-indexed elements never interact until the final gap-1 pass, so the last pass can face O(n) inversions.',
        'Knuth\'s sequence ((3 to the k minus 1) / 2: ..., 364, 121, 40, 13, 4, 1): O(n to the 3/2) worst case. Consecutive gaps are not multiples of each other, so elements from different subarrays interact earlier.',
        'Ciura\'s empirically optimized sequence (1, 4, 10, 23, 57, 132, 301, 701, ...): the best known for practical use, roughly O(n to the 4/3) on average. No closed-form proof of its complexity exists.',
        'Space is O(1) in all cases. Shell sort is in-place, uses only a constant number of temporary variables, requires no recursion, and allocates no auxiliary arrays. It is adaptive: nearly-sorted input finishes faster because the inner insertion-sort loops detect order and stop early.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Embedded systems and constrained environments. Shell sort requires no recursion (so no stack overflow risk), no memory allocation, and the code is tiny — often under 20 lines. For microcontrollers with kilobytes of RAM, it is the go-to sort. The uClibc library uses Shell sort internally.',
        'Small to medium arrays. For arrays under a few thousand elements, Shell sort with a good gap sequence is competitive with quicksort and often faster than heapsort, because its inner loop has excellent cache locality and minimal branch overhead.',
        'When simplicity matters more than optimal asymptotics. Shell sort is dramatically simpler to implement correctly than quicksort (no partition logic, no pivot selection, no recursion), merge sort (no auxiliary array, no merge step), or heapsort (no heap property maintenance). When you need a reasonably fast sort and cannot afford implementation bugs, Shell sort is a pragmatic choice.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No O(n log n) worst-case guarantee with any known gap sequence. For applications that need guaranteed performance (real-time systems, adversarial inputs), heapsort or merge sort are safer choices.',
        'Unstable. Elements with equal keys may be reordered because the gapped passes move elements past each other across subarrays. If stability is required, Shell sort cannot be used.',
        'The optimal gap sequence is an open problem. No one has proved which gap sequence minimizes the worst case. Practitioners must choose a gap sequence based on empirical data and hope it matches their input distribution. This uncertainty makes Shell sort hard to analyze and hard to trust for worst-case guarantees.',
        'Outperformed on large arrays. On arrays of millions of elements, quicksort (with median-of-three pivot), merge sort, or introsort are significantly faster. Shell sort\'s sub-quadratic but super-linearithmic complexity cannot compete at scale.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [8, 3, 6, 1, 5, 2, 7, 4]. Size 8, so Shell\'s gap sequence is [4, 2, 1].',
        'Gap 4: four subarrays of two elements each. Subarray 0: positions 0,4 = [8,5] -> compare 8>5, swap -> [5,8]. Subarray 1: positions 1,5 = [3,2] -> compare 3>2, swap -> [2,3]. Subarray 2: positions 2,6 = [6,7] -> 6<7, no swap. Subarray 3: positions 3,7 = [1,4] -> 1<4, no swap. Array after gap-4: [5, 2, 6, 1, 8, 3, 7, 4]. Two swaps fixed disorder across distance 4.',
        'Gap 2: two subarrays of four elements. Subarray 0: positions 0,2,4,6 = [5,6,8,7]. Insertion sort: 6 in place, 8 in place, 7 shifts past 8 -> [5,6,7,8]. One shift. Subarray 1: positions 1,3,5,7 = [2,1,3,4]. Insertion sort: 1 shifts past 2 -> [1,2,3,4]. One shift. Array after gap-2: [5, 1, 6, 2, 7, 3, 8, 4]. Wait — let us recompute carefully with the actual gap-4 output [5,2,6,1,8,3,7,4]. Subarray 0 (positions 0,2,4,6): [5,6,8,7]. Insert 6: in place. Insert 8: in place. Insert 7: 7<8, shift 8 right, 7>=6, land at position 4. Result: [5,6,7,8]. Subarray 1 (positions 1,3,5,7): [2,1,3,4]. Insert 1: 1<2, shift 2 right, land at position 1. Insert 3: in place. Insert 4: in place. Result: [1,2,3,4]. Array after gap-2: [5,1,6,2,7,3,8,4] — interleaving back: positions 0,2,4,6 get [5,6,7,8] and positions 1,3,5,7 get [1,2,3,4], giving [5,1,6,2,7,3,8,4].',
        'Gap 1: plain insertion sort on [5,1,6,2,7,3,8,4]. Insert 1: shifts past 5, lands at 0 -> [1,5,6,2,7,3,8,4]. Insert 6: in place. Insert 2: shifts past 6,5, lands at 1 -> [1,2,5,6,7,3,8,4]. Insert 7: in place. Insert 3: shifts past 7,6,5, lands at 2 -> [1,2,3,5,6,7,8,4]. Insert 8: in place. Insert 4: shifts past 8,7,6,5, lands at 3 -> [1,2,3,4,5,6,7,8]. Done.',
        'Total shifts across all passes: 2 (gap-4) + 2 (gap-2) + 10 (gap-1) = 14. Plain insertion sort on the original array would have taken 20 shifts. Shell sort saved work by fixing long-distance disorder in the early passes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Shell, D.L., "A High-Speed Sorting Procedure," Communications of the ACM, 2(7):30-32, 1959. The original paper introducing diminishing-increment sorting.',
        'Knuth, D.E., The Art of Computer Programming, Vol. 3: Sorting and Searching, Section 5.2.1. Comprehensive analysis of gap sequences, including the (3^k-1)/2 sequence and its O(n^{3/2}) bound.',
        'Ciura, M., "Best Increments for the Average Case of Shellsort," 13th International Symposium on Fundamentals of Computation Theory, 2001. Empirically derived gap sequence that outperforms all known closed-form sequences.',
        'Prerequisites: Insertion Sort (the base algorithm that Shell sort wraps with gaps). Extensions: Comb Sort (applies the same diminishing-gap idea to bubble sort). Related: Quicksort and Merge Sort (the O(n log n) algorithms that dominate for large arrays), Heapsort (in-place O(n log n) with guaranteed worst case).',
      ],
    },
  ],
};
