// Dynamic array (ArrayList / std::vector): append with amortized O(1) by
// doubling the backing array when full. The animation shows the backing
// storage, logical size, capacity, and the copy cost of each resize.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'dynamic-array',
  title: 'Dynamic Array (Amortized Analysis)',
  category: 'Data Structures',
  summary: 'A growable array that doubles its backing storage when full — making append O(1) amortized even though individual resizes cost O(n).',
  controls: [
    { id: 'values', label: 'Append (in order)', type: 'number-list', defaultValue: '1, 2, 3, 4, 5' },
  ],
  run,
};

// Build a state snapshot showing the backing array.
// Slots beyond `size` are shown as empty (null value) to visualize spare
// capacity.  `meta` carries size and capacity for the overlay display.
function backingState(backing, size, capacity) {
  const items = [];
  for (let i = 0; i < capacity; i++) {
    items.push({ id: `s${i}`, value: i < size ? backing[i] : null });
  }
  return {
    kind: 'array',
    items,
    meta: { label: `size ${size} / capacity ${capacity}` },
  };
}

export function* run(input) {
  const values = parseNumberList(input.values, { min: 1, max: 12 });

  let capacity = 2;
  let size = 0;
  let backing = new Array(capacity).fill(null);
  let totalCopies = 0;

  yield {
    state: backingState(backing, size, capacity),
    highlight: {},
    explanation:
      'Start with an empty backing array of capacity 2. The grey/empty slots are allocated but unused. ' +
      'Size is 0 — no elements stored yet. The dynamic array owns the whole backing buffer, but only ' +
      'the first `size` slots hold real data.',
  };

  for (const value of values) {
    if (size < capacity) {
      // Room available — O(1) append.
      backing[size] = value;
      size += 1;
      yield {
        state: backingState(backing, size, capacity),
        highlight: { active: [`s${size - 1}`] },
        explanation:
          `Append ${value}: there is room (size ${size - 1} < capacity ${capacity}), so write ` +
          `it at index ${size - 1}. Cost: 1 operation. No copy needed — the backing array has spare capacity.`,
      };
    } else {
      // Full — must resize.
      const oldCapacity = capacity;
      const newCapacity = capacity * 2;

      // Show the full state before resize.
      yield {
        state: backingState(backing, size, capacity),
        highlight: { found: backing.slice(0, size).map((_, i) => `s${i}`) },
        explanation:
          `Append ${value}: the array is FULL (size ${size} == capacity ${capacity}). ` +
          `Must allocate a new backing array of capacity ${newCapacity} (double the old) and copy all ${size} elements.`,
      };

      // Perform the resize: allocate new array, copy, then append.
      const newBacking = new Array(newCapacity).fill(null);
      for (let i = 0; i < size; i++) {
        newBacking[i] = backing[i];
      }
      totalCopies += size;
      backing = newBacking;
      capacity = newCapacity;

      // Show after the copy, before the append.
      yield {
        state: backingState(backing, size, capacity),
        highlight: { swap: backing.slice(0, size).map((_, i) => `s${i}`) },
        explanation:
          `Copied ${size} elements into the new array of capacity ${capacity}. ` +
          `That copy cost ${size} operations — expensive for this single append. But the new array ` +
          `now has ${capacity - size} empty slots, so the NEXT ${capacity - size} appends will each cost only 1.`,
      };

      // Now append the new value.
      backing[size] = value;
      size += 1;
      yield {
        state: backingState(backing, size, capacity),
        highlight: { active: [`s${size - 1}`] },
        explanation:
          `Write ${value} at index ${size - 1} in the new array. Size is now ${size}, capacity ${capacity}. ` +
          `Total copy cost so far: ${totalCopies} element copies across all resizes.`,
      };
    }
  }

  yield {
    state: backingState(backing, size, capacity),
    highlight: { sorted: backing.slice(0, size).map((_, i) => `s${i}`) },
    explanation:
      `All ${values.length} values appended. Final size: ${size}, capacity: ${capacity}. ` +
      `Total element copies from resizing: ${totalCopies}. Each append cost O(1) amortized — ` +
      `the occasional expensive resize is paid for by the many cheap appends that follow it. ` +
      `This is the core of amortized analysis: average the rare expensive operation over the many cheap ones.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows the backing array — the fixed-size block of memory that the dynamic array owns. Slots with values are live data; slots shown as empty (null) are allocated capacity that has not been used yet. The label below tracks size (how many elements are stored) and capacity (how many slots are allocated).',
        {type: 'callout', text: 'A dynamic array makes rare copies pay for many future O(1) appends by buying spare capacity geometrically.'},
        'When an append fits in the existing capacity, the new value appears in the next empty slot and the size increments by one. This is a single O(1) write.',
        'When the array is full (size equals capacity), a resize fires. The animation highlights all existing elements, allocates a new array with double the capacity, copies every element into it, and then writes the new value. Watch the capacity jump: 2 to 4, 4 to 8, 8 to 16. Each resize is expensive, but notice how the gaps between resizes keep growing — that is the source of the amortized cost.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A plain array has a fixed size set at allocation time. If you know exactly how many elements you need, that is fine. But most real programs do not know in advance: a user types search results, a server collects log entries, a parser builds a token list. The program needs an array that grows on demand while still providing O(1) random access by index.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/1D_array_diagram.svg/250px-1D_array_diagram.svg.png', alt: 'One-dimensional array diagram with adjacent indexed cells', caption: 'A dynamic array keeps the same contiguous indexed layout, then swaps in a larger backing store when full. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:1D_array_diagram.svg.'},
        'Every mainstream language has one. Java calls it ArrayList. Python calls it list. C++ calls it std::vector. Go calls it a slice. JavaScript arrays are dynamic arrays internally. The idea is the same everywhere: own a fixed backing buffer, track how much of it is used, and replace it with a bigger one when it fills up.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Allocate a backing array of exactly the current size. When a new element arrives, allocate an array one slot larger, copy everything over, and write the new element at the end. Every append works. Random access is still O(1).',
        'This is correct but slow. Each append copies all existing elements, so the i-th append costs i operations. Appending n elements costs 1 + 2 + 3 + ... + n = n(n+1)/2, which is O(n^2). Append 1,000 items and you perform roughly 500,000 copies. Append 1,000,000 items and you perform roughly 500 billion copies. The cost per append grows linearly with the array size.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Growing by one slot at a time means every single append triggers a full copy. The copy cost equals the current size, and the current size grows by one each time. The total work is the sum of the first n integers: O(n^2). For any workload that appends frequently, this quadratic cost dominates everything else.',
        'The root cause is that the grow-by-one strategy earns zero future benefit from each copy. You pay n operations to copy n elements into a new array, and the very next append requires another copy of n+1 elements. The expensive work never buys you any breathing room.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of growing by one, double the capacity each time the array fills up. After a resize, the new array is half empty. The next half of all appends are free — they just fill empty slots at O(1) each. By the time the array is full again, enough cheap appends have accumulated to pay for the next copy.',
        'The doubling is the key. It makes copies exponentially rarer. The first resize copies 2 elements. The next copies 4. Then 8, then 16. But between each resize, you get 2, 4, 8, 16 free appends. The expensive operations and the cheap ones grow at the same rate, so the average cost per append stays constant.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The dynamic array stores three things: a pointer to the backing array, the current size (number of live elements), and the current capacity (number of allocated slots).',
        'Append: if size < capacity, write the value at index size and increment size. Cost: O(1). If size == capacity, allocate a new array of capacity 2 * capacity, copy all size elements into it, free the old array, write the new value, and increment size. Cost: O(n) for this one append.',
        'Random access: return backing[index]. Cost: O(1), identical to a plain array.',
        'Insert at index i: shift elements i through size-1 one position right, write the new value at index i, increment size. Resize first if needed. Cost: O(n - i) for the shift.',
        'Delete at index i: shift elements i+1 through size-1 one position left, decrement size. Cost: O(n - i). Some implementations shrink the backing array when size drops below capacity/4 to avoid wasting memory, using the same doubling/halving discipline.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Amortized analysis proves that n appends cost O(n) total, making each append O(1) amortized. The banker\'s method makes this intuitive: charge each append 3 coins. One coin pays for the write itself. Two coins are saved in a bank. By the time the array is full, the bank holds enough coins to pay for copying every element into the doubled array.',
        'Concretely: after a resize to capacity c, the array has c/2 elements and c/2 empty slots. Each of the next c/2 appends deposits 2 coins, accumulating c coins total. The next resize copies c elements, costing c coins — exactly what the bank holds. The budget balances at every resize boundary.',
        'The potential function method gives the same result more formally. Define the potential P = 2 * size - capacity (after the most recent resize). An O(1) append increases size by 1, so P rises by 2. The amortized cost is actual cost (1) + change in potential (2) = 3. A resize of n elements has actual cost n, but capacity doubles and size increments by 1, so the potential drops by roughly n. The amortized cost is n + (drop of ~n) = O(1). Either way, each append is O(1) amortized.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Append: O(1) amortized, O(n) worst case. The worst case is a single resize, but over any sequence of n appends starting from empty, total work is at most 3n. When n doubles, the total cost doubles — the per-append cost stays constant.',
        'Random access (read or write by index): O(1). The backing array is contiguous, so index arithmetic is a single pointer addition, the same as a plain array.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Row_and_column_major_order.svg/250px-Row_and_column_major_order.svg.png', alt: 'Row-major and column-major layouts showing contiguous memory order', caption: 'Contiguous layout is the practical reward: scans follow nearby memory instead of chasing nodes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Row_and_column_major_order.svg.'},
        'Insert at index i: O(n - i). Elements after the insertion point must shift right. Inserting at the front is O(n). Inserting at the end is append, O(1) amortized.',
        'Delete at index i: O(n - i). Elements after the deletion point shift left. Deleting from the front is O(n). Deleting from the end is O(1).',
        'Space: at most 2x the number of stored elements. Right after a resize, size = capacity/2, so half the memory is unused. Right before a resize, size = capacity, so no memory is wasted. On average, about 75% of the allocated space holds real data.',
        'The hidden constant that matters: resizing requires allocating a new contiguous block and copying everything. For a 1 GB array, that means finding another 2 GB block and copying 1 GB of data. The allocator must find contiguous space, and the copy touches every cache line. This is why some systems pre-allocate or use chunked structures for very large collections.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Java ArrayList: the default growable list. Uses 1.5x growth factor instead of 2x, trading slightly more frequent resizes for less wasted space. The amortized O(1) guarantee still holds with any constant growth factor > 1.',
        'Python list: every Python list is a dynamic array. list.append() is O(1) amortized. Python uses a growth formula that is roughly 1.125x for large lists, optimized for memory over resize frequency.',
        'C++ std::vector: the workhorse container. Cache-friendly because elements are contiguous. The standard guarantees amortized O(1) push_back. Most implementations use 2x growth.',
        'JavaScript arrays: V8 and other engines implement arrays as dynamic arrays internally (when elements are dense). Array.push() is O(1) amortized.',
        'Go slices: a slice is a view into a backing array with length and capacity. append() doubles capacity when full (for small slices) and grows by ~1.25x for large ones.',
        'The pattern also powers hash tables. When a hash table\'s load factor exceeds a threshold, it allocates a new table (typically 2x the buckets) and rehashes every entry. The same amortized argument applies: rehashing is O(n) but happens rarely enough that each insert is O(1) amortized.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Insert and delete at the front are O(n). Every element must shift. If you need fast operations at both ends, use a deque (double-ended queue backed by a ring buffer or block map), which gives O(1) amortized at both ends.',
        'Worst-case O(n) for a single append. In real-time systems (audio processing, game physics ticks, hard-deadline controllers), one O(n) hiccup can miss a deadline. Real-time code uses fixed-capacity ring buffers or pre-allocated pools instead.',
        'Memory fragmentation. A resize allocates a new block of 2x the old size and frees the old block. The old block\'s memory may not be reusable for the new larger block. For very large arrays, this can cause allocation failure even when total free memory is sufficient, because no single contiguous block is large enough.',
        'Wasted space. Right after a resize, half the capacity is empty. If the array grows to just past a power of two and then stops, nearly half the memory is wasted. C++ shrink_to_fit() and Java trimToSize() let you reclaim this, but they trigger another copy.',
        'No stable pointers. Every resize moves all elements to a new memory location. Pointers or references to elements are invalidated by any append that triggers a resize. C++ iterators and pointers into a vector are invalidated on push_back if capacity changes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with an empty dynamic array, capacity 2. Append the values 1, 2, 3, 4, 5.',
        'Append 1: size 0 < capacity 2, so write at index 0. Array: [1, _]. Size 1, capacity 2. Cost: 1.',
        'Append 2: size 1 < capacity 2, so write at index 1. Array: [1, 2]. Size 2, capacity 2. Cost: 1.',
        'Append 3: size 2 == capacity 2. RESIZE: allocate capacity 4, copy [1, 2] (2 copies), write 3 at index 2. Array: [1, 2, 3, _]. Size 3, capacity 4. Cost: 2 + 1 = 3.',
        'Append 4: size 3 < capacity 4, so write at index 3. Array: [1, 2, 3, 4]. Size 4, capacity 4. Cost: 1.',
        'Append 5: size 4 == capacity 4. RESIZE: allocate capacity 8, copy [1, 2, 3, 4] (4 copies), write 5 at index 4. Array: [1, 2, 3, 4, 5, _, _, _]. Size 5, capacity 8. Cost: 4 + 1 = 5.',
        'Total cost for 5 appends: 1 + 1 + 3 + 1 + 5 = 11. Two resizes occurred at sizes 2 and 4, with copy costs 2 and 4. Average cost per append: 11/5 = 2.2. Even in this small example, the amortized cost is well under 3 per append. As n grows, the average approaches 3 (with a growth factor of 2) because the O(1) appends between resizes dominate more and more.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms (CLRS), Chapter 17: Amortized Analysis — covers the aggregate, accounting (banker\'s), and potential methods using dynamic arrays as the primary example. This is the canonical textbook treatment.',
        'Natural extensions: Hash Table uses the same amortized-doubling strategy for its bucket array when the load factor exceeds a threshold. Ring Buffer provides O(1) operations at both ends by wrapping around a fixed-capacity array — the right choice when the maximum size is known. Deque (double-ended queue) gives O(1) amortized push and pop at both ends, solving the front-insertion problem that dynamic arrays handle poorly.',
        'Contrasting alternatives: Linked List provides O(1) insertion anywhere (given a pointer to the node) without copying, but sacrifices O(1) random access and cache locality. Skip List layers randomized express lanes over a linked list to get O(log n) search without any array resizing.',
        'Prerequisite gaps: if the O(1) amortized argument felt hand-wavy, study the formal potential function method in CLRS Chapter 17. If the doubling strategy felt arbitrary, note that any constant growth factor c > 1 yields O(1) amortized append — 2x is common because it is simple and the space overhead (at most 2x) is usually acceptable.',
      ],
    },
  ],
};
