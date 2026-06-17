// Linear search: check every element until the target appears.
// The simplest search, and the honest baseline every other search beats.

import { arrayState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'linear-search',
  title: 'Linear Search',
  category: 'Searching',
  summary: 'Walk the array one element at a time until you find the target.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '7, 3, 15, 9, 4, 11' },
    { id: 'target', label: 'Search for', type: 'number', defaultValue: '9' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values);
  const target = parseNumber(input.target, { label: 'a target' });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `We are looking for ${target}. This array gives us no order, index, or hash table, so every unchecked slot could still be the answer.`,
  };

  for (let index = 0; index < values.length; index += 1) {
    const visited = values.slice(0, index).map((_, i) => `i${i}`);
    const isMatch = values[index] === target;
    yield {
      state: arrayState(values),
      highlight: { active: [`i${index}`], visited },
      explanation: `At position ${index}, the value ${values[index]} ${isMatch ? `matches ${target}, so the search can stop after proving this exact slot is the answer.` : `does not match ${target}. Only this position has been ruled out, so the cursor must move one step right.`}`,
      invariant: 'Everything to the left of the current position has been checked and ruled out.',
    };
    if (isMatch) {
      yield {
        state: arrayState(values),
        highlight: { found: [`i${index}`], visited },
        explanation: `Found ${target} at position ${index} after ${index + 1} comparison${index === 0 ? '' : 's'}. Early exit is the best part of linear search; the worst case still checks every element.`,
      };
      return;
    }
  }

  yield {
    state: arrayState(values),
    highlight: { visited: values.map((_, i) => `i${i}`) },
    explanation: `All ${values.length} elements were checked, so ${target} is not here. Absence is proven only by exhaustion because the data had no structure to skip work.`,
  };
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Linear search exists for data that gives you no structure to exploit. The values may be unsorted, streaming from a file, changing constantly, or too small to justify an index. In that setting, every unchecked item could still be the target.`,
        `It is also the baseline that makes other searches meaningful. Binary Search buys speed with sorted random-access data. Hash Table lookup buys speed with hashing and a table built ahead of time. Linear search needs only a way to read the next item.`,
      ],
    },
    {
      heading: `Baseline and wall`,
      paragraphs: [
        `The reasonable baseline is to look directly: compare the first item, then the next, and stop when the target appears or the input ends. For a short list or a one-time scan, it is often the clearest and fastest code.`,
        `The wall appears when the data grows or the same lookup pattern repeats. A target at index 0 costs one comparison. A target at the last index costs n comparisons. A missing target costs n comparisons. Thousands of repeated lookups turn those full scans into the bottleneck.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core invariant is simple: everything before the cursor has been checked and rejected. Everything at or after the cursor is still possible.`,
        `That invariant is why absence is expensive. A failed comparison proves only one slot. Without sorted order, a hash table, or another index, no comparison says anything about the rest of the data.`,
        `The same invariant makes linear search work on streams. The algorithm doesn't need to know the length in advance. It only needs the current item, the target predicate, and the fact that the input hasn't ended yet.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Keep one cursor. Compare the current value with the target. If they are equal, return the current position. If they are different, move the cursor one step right. If the cursor passes the end, return not found.`,
        `On 7, 3, 15, 9, 4, 11 with target 9, the scan rejects 7, then 3, then 15. At index 3 it finds 9 and stops. The algorithm doesn't inspect 4 or 11 because the requested result is the first match.`,
        `If you need every match, do not stop after the first hit. Keep scanning and collect each position. If the predicate is more complex than equality, such as "line contains ERROR" or "record belongs to this user," the shape is the same: one item, one test, one decision.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `The animation is deliberately plain because the algorithm's strength and weakness are both in the same cursor. The active cell is the only cell being tested. Visited cells matter because they are now evidence: that prefix has been ruled out.`,
        `Watch what a failed comparison does not prove. When 7 is not 9, nothing has been learned about 3, 15, 9, 4, or 11. A sorted array, trie, or hash table gives one observation more reach. Linear search has no such reach, so it earns certainty one position at a time.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Correctness comes from direct evidence. At the start, no positions have been ruled out. After each failed comparison, one more position is impossible because it was checked against the target.`,
        `If a match is found, returning that position is correct because the equality test succeeded there. If the scan ends with no match, the rejected prefix is the whole input. The target is absent because every possible position has been tested.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Best case is O(1): the first item matches. If the target exists and is equally likely to be anywhere, the expected number of comparisons is (n + 1) / 2. If the target is absent, the cost is n comparisons. Worst case is O(n), and extra space is O(1).`,
        `Doubling the input can double the work. The constants are good for small contiguous arrays because the CPU can walk through memory cleanly, but the growth behavior doesn't change.`,
        `Preprocessing changes the trade-off. Sorting once can enable O(log n) Binary Search. Building a Hash Table can enable average O(1) exact lookup. Those setup costs pay off only when enough future queries reuse the structure.`,
        `Locality can make linear search surprisingly competitive at small sizes. A modern CPU can stream contiguous memory quickly, and branch prediction is simple when misses dominate. That is why production code often keeps tiny arrays, short handler lists, and compact option tables as scans instead of building a heavier structure too early.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Linear search wins when the data is small, unsorted, changing constantly, or read once. A runtime can scan a tiny options array faster than it can build an index. A command-line tool can stream a file that may never be queried again.`,
        `It also wins as a final verification step. A Bloom Filter can reject many absent queries, but a possible hit still needs a real check. A database index can narrow candidates, then a scan can apply the remaining predicate to that small result set.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Linear search fails when large data receives repeated exact lookups. Scanning 8 values is fine. Scanning 8,000,000 values for every request is usually the wrong structure. The missing ingredient is reusable structure: sorted order, a hash table, an index, or a filter.`,
        `It also fails when equality isn't well defined. Searching objects by reference is different from searching by an id field. Searching strings may require case folding or Unicode normalization. Searching floating-point values may require a tolerance. The loop is simple; the predicate can still be wrong.`,
      ],
    },
    {
      heading: `Implementation traps`,
      paragraphs: [
        `The most common bug is returning the wrong absence signal. Pick one convention and keep it consistent: -1 for an index search, null or undefined for an object lookup, or an empty array for a collect-all search. Mixing these makes callers write fragile checks.`,
        `The second bug is hiding work behind a pleasant helper. Calling linear search inside another loop can quietly create O(n * m) behavior. Before replacing it, count how often the scan runs and whether the input is stable enough to index. A slow one-time scan is not the same problem as a repeated lookup service.`,
      ],
    },
    {
      heading: `Decision rule`,
      paragraphs: [
        `Use linear search first when the collection is small, the lookup is rare, or the data is arriving as a stream. Replace it when the same collection is queried repeatedly, when missing values are common and expensive, or when latency needs a predictable upper bound smaller than a full scan.`,
        `The honest engineering question is not "is O(n) bad?" It is "how large is n, how often does the scan run, and what structure could this workload reuse?" That question keeps you from both premature indexing and accidental full-scan bottlenecks.`,
      ],
    },
    {
      heading: `Concrete example`,
      paragraphs: [
        `A CLI tool searching one build log for the first line containing "ERROR" should usually scan. Building an index costs time and memory, and the file may be read only once. The tool reads a line, tests the predicate, stops at the first hit, or finishes the file and reports no error.`,
        `Change the constraint and the answer changes. If a service must answer thousands of queries over the same logs by request id, timestamp, and component, repeated scans waste work. That is now an indexing problem, and a Hash Table or sorted range becomes worth its setup cost.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Binary Search to see how sorted order lets one comparison reject many positions. Study Hash Table to see how preprocessing makes repeated exact lookup average O(1). Study Bloom Filter for fast negative answers with false positives. Big-O Growth Rates gives scale intuition, while Sliding Window and Two Pointers show how controlled scans become more targeted than a plain one-cursor pass.`,
      ],
    },
  ],
};
