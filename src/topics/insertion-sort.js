// Insertion sort: grow a sorted prefix by inserting each new value into
// its place — exactly how people sort a hand of playing cards.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'insertion-sort',
  title: 'Insertion Sort',
  category: 'Sorting',
  summary: 'Take each value and slide it left into its place in the sorted prefix.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '7, 2, 9, 4, 4, 1' },
  ],
  run,
};

const prefixIds = (count) => Array.from({ length: count }, (_, i) => `i${i}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });

  yield {
    state: arrayState(values),
    highlight: { sorted: prefixIds(1) },
    explanation: 'Insertion sort is how you sort cards in your hand: everything to the left of your attention is already sorted, and each new card slides left until it fits. A one-element prefix is trivially sorted, so we start at position 1.',
  };

  for (let i = 1; i < values.length; i += 1) {
    const value = values[i];
    yield {
      state: arrayState(values),
      highlight: { active: [`i${i}`], sorted: prefixIds(i) },
      explanation: `Pick up ${value} (position ${i}). The prefix to its left is sorted — now slide ${value} leftward until the value before it is no bigger.`,
      invariant: `Positions 0–${i - 1} are sorted (relative to each other).`,
    };

    let j = i;
    while (j > 0 && values[j - 1] > value) {
      yield {
        state: arrayState(values),
        highlight: { compare: [`i${j - 1}`, `i${j}`], sorted: prefixIds(i) },
        explanation: `${values[j - 1]} is bigger than ${value}, so ${value} must go further left — shift ${values[j - 1]} one slot right to make room.`,
      };
      [values[j - 1], values[j]] = [values[j], values[j - 1]];
      j -= 1;
    }

    yield {
      state: arrayState(values),
      highlight: { found: [`i${j}`], sorted: prefixIds(i + 1) },
      explanation: j === i
        ? `${value} was already in place — no shifting needed. On nearly-sorted data this happens constantly, which is why insertion sort runs in almost O(n) there.`
        : `${value} settles into position ${j}. The sorted prefix now covers positions 0–${i}.`,
    };
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: prefixIds(values.length) },
    explanation: `Sorted! Worst case is O(n²) (reversed input shifts everything every time), but on nearly-sorted data it is nearly O(n) — which is why real libraries use insertion sort to finish small or almost-sorted ranges inside quick sort and merge sort.`,
  };
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Insertion sort exists for arrays that are already close to ordered, are being maintained one item at a time, or are so small that a simple loop beats heavier machinery. The problem isn't just sorting from scratch. The common problem is repairing local disorder without rebuilding the whole order.`,
        `The everyday model is a hand of cards. The cards in your left hand are sorted. A new card arrives. You don't shuffle the whole hand; you slide larger cards right until the new card fits. Insertion sort turns that local repair into an array algorithm.`,
      ],
    },
    {
      heading: `Baseline and wall`,
      paragraphs: [
        `A reasonable baseline is to scan the array for disorder and keep swapping nearby values until the whole array looks sorted. That works on small inputs because each operation is easy to see.`,
        `The wall is repeated work. Bubble-style passes keep revisiting pairs that may already be fine. Re-sorting a prefix after every new item wastes the fact that the prefix was already sorted. Insertion sort keeps one piece of structure and extends it by one value at a time.`,
      ],
    },
    {
      heading: `Core invariant`,
      paragraphs: [
        `Before processing index i, positions 0 through i - 1 are sorted. The value at i may be out of place, but only relative to that sorted prefix. Values after i are still untouched.`,
        `The active value moves left until the value before it is smaller or equal. Every larger prefix value shifts one slot right. The open slot that remains is the only place where the active value can sit without breaking the prefix order.`,
        `That invariant is stronger than "the array is getting cleaner." It gives the algorithm a boundary. Everything left of the boundary has already been repaired, the active value is the only value being inserted, and the suffix has not been promised anything yet.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `The array view keeps the sorted prefix visible. The highlighted prefix is the part of the proof that has already been earned. The active element is the new value being admitted into that proof, one comparison at a time.`,
        `The compare highlights show why insertion sort is local. The algorithm never scans unrelated suffix values while inserting the current item. It only asks whether the previous prefix value is too large, shifts that value right if needed, and repeats.`,
        `The found highlight marks the open slot. Once the active value lands there, the prefix has grown by one. The visual model is useful because it shows both the motion and the invariant: values shift right, but the sorted prefix never loses order.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start at index 1 because one value is already sorted by itself. Store the active value. Walk left through the prefix while the previous value is greater. Shift each greater value right. When the walk stops, write the active value into the open slot.`,
        `On 7, 2, 9, 4, the value 2 shifts past 7 and lands at the front. Later, 4 compares with 9 and 7, shifts both right, and stops after 2. The prefix grows from 2, 7, 9 to 2, 4, 7, 9. The algorithm never claims the suffix is sorted until those values have been inserted too.`,
        `Using greater-than rather than greater-than-or-equal matters. Equal records do not move past each other, so the normal shifting version is stable. That matters when you sort records by one key after they were already ordered by another key.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The proof is induction on the prefix length. A one-item prefix is sorted. Assume the prefix before index i is sorted. The algorithm removes the active value from consideration, shifts only values greater than it, and stops where the left neighbor is smaller or equal or where the array begins.`,
        `After the insert, every value to the left of the active value is smaller or equal. Every shifted value to its right is greater. The old prefix order is preserved because shifting moves those larger values together by one slot. The prefix of length i + 1 is sorted, so the invariant is ready for the next round.`,
      ],
    },
    {
      heading: `Stability and adaptiveness`,
      paragraphs: [
        `Insertion sort is stable in its standard shifting form because equal values are not moved past each other. If two records have the same score, the one that appeared first stays first. That makes insertion sort useful as a small stable component inside larger sorting systems.`,
        `It is also adaptive. The running time is tied to how far values must move, not only to the length of the array. A nearly sorted array has few inversions, so most values stop after one comparison. A reversed array has every pair inverted, so every new value travels across the whole prefix.`,
        `This is the central difference from selection sort. Selection sort does the same broad scan pattern no matter how ordered the input already is. Insertion sort pays for actual disorder, which is why it can be excellent on small repaired ranges even though its worst case is quadratic.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Already sorted input is the best case: each item checks the previous value once and stays where it is. That is O(n) time and O(1) extra space.`,
        `Reverse-sorted input is the worst case. The kth item shifts across k earlier items, so the algorithm performs about n(n - 1) / 2 comparisons and moves. Random input is also O(n^2) on average. Doubling a random array roughly quadruples the work.`,
        `A more useful way to think about insertion sort is inversions. An inversion is a pair that is out of order. Insertion sort fixes inversions by moving a value left across larger values, so inputs with few inversions run close to linear time. Binary search can reduce comparisons inside the prefix, but it can't remove the array shifts.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Insertion sort wins on small arrays because the loop is tiny, cache-friendly, and has almost no setup cost. Production hybrid sorts often hand small partitions to insertion sort after a divide-and-conquer algorithm has done the large-scale work.`,
        `It also wins on nearly sorted data. Appending a few late records to a sorted UI table, repairing a small sorted buffer, or extending a naturally ordered run can be cheaper than building a new structure. Stability and O(1) extra space make it useful when record order matters and memory is tight.`,
        `It can also win when comparisons are cheap and data movement stays inside cache. For tiny fixed-size arrays, avoiding recursion, heap setup, auxiliary buffers, and complex branch structure can matter more than asymptotic growth.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Insertion sort fails as a standalone sorter for large random arrays. One million random values can require trillions of primitive operations. Merge Sort, Quick Sort, Heap Sort, or a tuned hybrid is the right family at that scale.`,
        `It also fails when the data structure makes backward movement expensive. In an array, shifting is contiguous memory movement. In a linked list, finding the insertion point still costs a scan, and poor locality can erase the benefit. The lesson is conditional: insertion sort is a local repair tool, not a universal sorting strategy.`,
        `It is especially weak when records are huge and must be moved by value. In that case the algorithm may spend more time copying payloads than comparing keys. Sorting references, indexes, or small records can make the same idea much cheaper.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Use insertion sort when the input is small, nearly sorted, or naturally maintained by incremental inserts. Do not pick it because it is easy to implement and then hope it scales. Its job is to exploit locality and existing order.`,
        `In hybrid sorts, choose the cutoff by measurement. A cutoff around a few dozen elements is common, but the best value depends on the language runtime, comparison cost, record size, branch prediction, and cache behavior. The cutoff is an engineering parameter, not a theorem.`,
        `Prefer the shifting implementation over repeated swaps for arrays. Store the active value once, shift larger values right, and write the active value into the final gap. That reduces assignments and makes the invariant clearer. Use binary insertion only when comparisons are much more expensive than moves, because binary search does not remove the shifting cost.`,
      ],
    },
    {
      heading: `Concrete example`,
      paragraphs: [
        `Suppose a gradebook is already sorted by score: 70, 75, 82, 91. A late grade of 80 arrives. Insertion sort compares 80 with 91 and 82, shifts both right, stops after 75, and writes 80 into the gap. Only the disturbed tail moves.`,
        `If late grades arrive in roughly sorted order, that local repair stays cheap. If the whole gradebook is random every time, the same algorithm spends most of its time pushing values across long prefixes.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Selection Sort to see the opposite trade-off: fixed comparison work but few swaps. Study Bubble Sort to understand adjacent inversion repair. Then move to Merge Sort and Quick Sort for the divide-and-conquer escape from O(n^2) behavior. Binary Search explains how to find an insertion point faster, and Big-O Growth Rates explains why shifting still dominates large arrays.`,
      ],
    },
  ],
};
