// Segment Tree Beats: range updates such as chmin become cheap when a node
// knows its maximum, second maximum, count of maxima, and sum.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'segment-tree-beats',
  title: 'Segment Tree Beats',
  category: 'Data Structures',
  summary: 'A stronger lazy segment tree: track max, second max, count, and sum so range chmin updates can stop high in the tree.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['chmin update', 'why amortized'], defaultValue: 'chmin update' },
  ],
  run,
};

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

function* chminUpdate() {
  yield {
    state: labelMatrix(
      'Node summary before range chmin(6)',
      [
        { id: 'range', label: 'range [0,7]' },
        { id: 'left', label: 'left [0,3]' },
        { id: 'right', label: 'right [4,7]' },
        { id: 'leaf', label: 'leaf example' },
      ],
      [
        { id: 'sum', label: 'sum' },
        { id: 'max1', label: 'max1' },
        { id: 'max2', label: 'max2' },
        { id: 'maxc', label: 'max count' },
      ],
      [
        ['42', '9', '5', '2'],
        ['19', '8', '4', '1'],
        ['23', '9', '5', '2'],
        ['9', '9', '-inf', '1'],
      ],
    ),
    highlight: { active: ['range:max1', 'range:max2', 'range:maxc'], found: ['range:sum'] },
    explanation: 'Segment Tree Beats augments each node with more than sum. For range chmin(x), the decisive fields are maximum, strict second maximum, and count of maximum values.',
  };

  yield {
    state: labelMatrix(
      'Can chmin(6) stop at this node?',
      [
        { id: 'skip', label: 'x >= max1' },
        { id: 'beat', label: 'max2 < x < max1' },
        { id: 'descend', label: 'x <= max2' },
        { id: 'outside', label: 'range outside' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'action', label: 'action' },
      ],
      [
        ['nothing changes', 'return'],
        ['only current maxima change', 'fix node in O(1)'],
        ['multiple value levels change', 'push and recurse'],
        ['not covered', 'return'],
      ],
    ),
    highlight: { active: ['beat:meaning', 'beat:action'], compare: ['descend:action'] },
    explanation: 'If x lies strictly between max1 and max2, only the maximum values are clipped. The sum drops by (max1 - x) * max_count, and the node can be updated without visiting children.',
    invariant: 'Beats wins when a range update affects only the top value layer of a covered node.',
  };

  yield {
    state: labelMatrix(
      'Apply chmin(6) to right node',
      [
        { id: 'before', label: 'before' },
        { id: 'delta', label: 'delta' },
        { id: 'after', label: 'after' },
        { id: 'tag', label: 'lazy tag' },
      ],
      [
        { id: 'sum', label: 'sum' },
        { id: 'max1', label: 'max1' },
        { id: 'max2', label: 'max2' },
        { id: 'maxc', label: 'max count' },
      ],
      [
        ['23', '9', '5', '2'],
        ['-6', '9->6', 'unchanged', '2'],
        ['17', '6', '5', '2'],
        ['cap maxima at 6', 'pending for max children', '', ''],
      ],
    ),
    highlight: { found: ['delta:sum', 'after:sum'], active: ['after:max1', 'tag:sum'] },
    explanation: 'The node update is arithmetic: two maximum values drop from 9 to 6, so the sum drops by 3 * 2 = 6. Children are updated only when a later operation needs to inspect them.',
  };

  yield {
    state: labelMatrix(
      'Beyond chmin',
      [
        { id: 'chmin', label: 'range chmin' },
        { id: 'chmax', label: 'range chmax' },
        { id: 'add', label: 'range add' },
        { id: 'sum', label: 'range sum' },
      ],
      [
        { id: 'metadata', label: 'metadata needed' },
        { id: 'result', label: 'result' },
      ],
      [
        ['max1/max2/max count', 'cap large values'],
        ['min1/min2/min count', 'raise small values'],
        ['lazy add tag', 'shift all summaries'],
        ['sum field', 'answer queries'],
      ],
    ),
    highlight: { found: ['chmin:metadata', 'chmax:metadata'], active: ['sum:result'] },
    explanation: 'Full Segment Tree Beats pairs max-side and min-side summaries. That supports range chmin, range chmax, range add, and range sum in one structure.',
  };
}

function* whyAmortized() {
  yield {
    state: labelMatrix(
      'Why ordinary lazy propagation is not enough',
      [
        { id: 'add', label: 'range add' },
        { id: 'assign', label: 'range assign' },
        { id: 'chmin', label: 'range chmin' },
        { id: 'mod', label: 'range modulo' },
      ],
      [
        { id: 'lazy', label: 'simple lazy?' },
        { id: 'why', label: 'why' },
      ],
      [
        ['yes', 'sum shifts uniformly'],
        ['yes', 'whole segment becomes one value'],
        ['not always', 'only values above cap change'],
        ['not always', 'different values shrink differently'],
      ],
    ),
    highlight: { active: ['chmin:lazy', 'chmin:why'], compare: ['add:lazy', 'assign:lazy'] },
    explanation: 'A plain lazy tag works when every element in a segment changes the same way. chmin is conditional: values above x change, values below x do not.',
  };

  yield {
    state: labelMatrix(
      'The beats potential argument',
      [
        { id: 'easy', label: 'easy node' },
        { id: 'hard', label: 'hard descent' },
        { id: 'drop', label: 'value levels drop' },
        { id: 'budget', label: 'amortized budget' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['max2 < x < max1', 'O(1) update'],
        ['x <= max2', 'must visit children'],
        ['distinct top values collapse', 'future work decreases'],
        ['bounded by value-level changes', 'near-logarithmic in practice'],
      ],
    ),
    highlight: { active: ['hard:event', 'drop:effect'], found: ['budget:effect'] },
    explanation: 'The reason it works is amortization. Expensive descents happen when the cap crosses multiple value levels, but that collapse reduces future diversity inside the tree.',
  };

  yield {
    state: labelMatrix(
      'Implementation hazards',
      [
        { id: 'push', label: 'push order' },
        { id: 'merge', label: 'merge summaries' },
        { id: 'edge', label: 'equal max/min' },
        { id: 'proof', label: 'complexity proof' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'discipline', label: 'discipline' },
      ],
      [
        ['stale child max', 'push caps before descent'],
        ['wrong second max', 'recompute carefully'],
        ['min/max summaries collide', 'handle degenerates'],
        ['hand-wave O(log n)', 'track amortized potential'],
      ],
    ),
    highlight: { active: ['push:risk', 'merge:risk'], compare: ['proof:discipline'] },
    explanation: 'Segment Tree Beats is powerful but brittle. The code is mostly about maintaining summary invariants across pushes, caps, adds, and merges.',
  };

  yield {
    state: labelMatrix(
      'Choose the right interval structure',
      [
        { id: 'fenwick', label: 'Fenwick tree' },
        { id: 'lazy', label: 'lazy segment tree' },
        { id: 'beats', label: 'segment tree beats' },
        { id: 'sparse', label: 'sparse table' },
      ],
      [
        { id: 'best', label: 'best for' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['prefix sums and point updates', 'smallest code'],
        ['uniform range updates', 'clean lazy algebra'],
        ['conditional caps with sums', 'hard invariants'],
        ['static idempotent queries', 'no updates'],
      ],
    ),
    highlight: { found: ['beats:best'], compare: ['fenwick:tradeoff', 'lazy:tradeoff'] },
    explanation: 'Segment Tree Beats is not the default. It is the tool you reach for when ordinary lazy propagation cannot summarize a conditional range update.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'chmin update') yield* chminUpdate();
  else if (view === 'why amortized') yield* whyAmortized();
  else throw new InputError('Pick a Segment Tree Beats view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The chmin update view walks through a range chmin(6) operation on a small tree. Each node displays four fields: sum, max1, max2 (strict second maximum), and max count. Active highlights mark the fields that decide whether the node can handle the update locally. Found highlights mark the sum field, which is the query output that must stay correct without opening children.',
        'Watch for the moment a node stops instead of recursing. That stop is the whole point of Beats: the cap lies between max1 and max2, so only the top-layer values change, and the node can compute the exact sum adjustment in O(1). If the cap is at or below max2, the highlight moves downward because the parent lacks enough information.',
        'The amortized view explains why expensive descents do not accumulate into bad total cost. When a descent happens, it collapses value layers inside children, which means future caps encounter less diversity and stop higher. The potential argument tracks total distinct-maximum changes across all nodes, not per-operation worst case.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A lazy segment tree handles range add and range assign elegantly because every element in a covered segment changes the same way. One tag captures the whole transformation. Range chmin(x) -- replace each a[i] with min(a[i], x) -- breaks that uniformity. Values above x change. Values at or below x do not. Inside one covered segment, the update is selective.',
        'Ji (2016) introduced the "Segment Tree Beats" technique (the name comes from the Chinese competitive programming community) to handle chmin and chmax alongside sum queries without descending to every leaf. The key idea: augment each node with enough metadata -- specifically the strict second maximum -- so the tree can recognize when a conditional cap affects only the current top value layer, and stop.',
        {
          type: 'quote',
          text: 'We maintain extra information in each node to avoid unnecessary recursive calls. When the maximum is the only value affected, we can update the node directly.',
          attribution: 'Ji, "Segment Beats" (2016), translated from the original Chinese writeup',
        },
        'The technique extends to range chmax (using min-side metadata), range add, and historical maximum queries. It is the standard competitive programming tool for problems that mix conditional range updates with aggregate queries.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is brute force: walk every leaf in the update range and clamp. Correct, but O(k) per update for k covered elements. Repeated large-range caps degenerate into scanning the array over and over.',
        'The second attempt is ordinary lazy propagation with a "cap" tag. Attach a pending minimum to a covered node and push it later. This sounds workable, but the node cannot apply the cap to its sum without knowing how many values exceed the cap and by how much. The maximum alone is not enough. If max1 is 9 and the cap is 6, the sum adjustment depends on whether the next-highest value is 8 or 3 -- those are different amounts of work on different numbers of elements.',
        'You could store additional statistics, but the question is which statistics are both sufficient for O(1) local updates and cheap to maintain across pushes and merges. That is the design problem Beats solves.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is selectivity within a covered segment. Consider the interval [9, 5, 9, 0]. chmin(6) changes only the two 9s: the sum drops by 6. But chmin(4) changes the two 9s and the 5 -- two different value levels are affected. A single lazy tag cannot distinguish "cap the top layer" from "cap multiple layers" without knowing where the layers are.',
        'Ordinary lazy propagation assumes every fully covered node can absorb the update locally. Beats relaxes this: some covered nodes must descend. The technique works because those forced descents are not free rides -- they collapse value structure inside the subtree, reducing the diversity that future operations must fight through.',
        'This is why the complexity proof is amortized rather than worst-case. A single chmin can touch O(n) nodes in the worst case. But each expensive descent pays for itself by reducing the total number of distinct maximum levels across the tree, and that total is bounded.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each node stores four fields: max1 (the maximum value in the segment), max2 (the strict second maximum), maxCount (how many elements equal max1), and sum. On build, leaves have max1 = value, max2 = -infinity, maxCount = 1, and sum = value. Internal nodes merge children: sum = left.sum + right.sum, max1 = max(left.max1, right.max1), maxCount counts children sharing that maximum, and max2 is the largest value strictly below max1 drawn from both children.',
        {
          type: 'diagram',
          label: 'Break / tag / skip conditions for chmin(x) at a node',
          text: [
            '                  chmin(x) arrives at node',
            '                          |',
            '              +-----------+-----------+',
            '              |           |           |',
            '         x >= max1   max2 < x < max1  x <= max2',
            '              |           |           |',
            '           SKIP        TAG          BREAK',
            '         (no-op)   (local O(1))  (push + recurse)',
            '                       |',
            '              sum -= (max1 - x) * maxCount',
            '              max1 = x',
          ].join('\n'),
        },
        'The TAG case is the payoff. Because x sits strictly between max2 and max1, only the maxCount elements equal to max1 are affected. The sum adjustment is exact: (max1 - x) * maxCount. The node sets max1 = x and stores the cap as a lazy tag for children. No child is opened.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// The break condition: must push and recurse',
            'function updateChmin(node, l, r, ql, qr, x) {',
            '  if (x >= node.max1) return;        // SKIP: nothing to do',
            '  if (ql <= l && r <= qr && x > node.max2) {',
            '    // TAG: only the top layer changes',
            '    node.sum -= (node.max1 - x) * node.maxCount;',
            '    node.max1 = x;',
            '    return;',
            '  }',
            '  // BREAK: cap crosses multiple value layers',
            '  pushDown(node);',
            '  let mid = (l + r) >> 1;',
            '  updateChmin(node.left,  l,     mid, ql, qr, x);',
            '  updateChmin(node.right, mid+1, r,   ql, qr, x);',
            '  pullUp(node);',
            '}',
          ].join('\n'),
        },
        'The push step is critical. Before recursing, a parent that has already lowered its max1 must propagate that cap to any child whose max1 exceeds the parent cap. Without this, children keep stale maxima and later merges rebuild wrong summaries. Push order -- caps before adds -- matters when both tags coexist.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness of the local update follows from the gap between max2 and max1. When max2 < x < max1, every element in the segment is either equal to max1 (and gets capped to x) or strictly below max2 (and is untouched). No element sits between max2 and max1 -- max2 is the strict second maximum by definition. So the sum change is exactly (max1 - x) * maxCount, and no non-maximum element is disturbed.',
        'Correctness of the merge follows from completeness of the four fields. After any update, the parent recomputes sum, max1, max2, and maxCount from its two children. These four fields are sufficient to classify the next chmin as SKIP, TAG, or BREAK. No hidden state is lost.',
        'The amortized bound uses a potential function over the number of distinct values that appear as max1 across all tree nodes. Each TAG operation does O(1) work and does not increase the potential. Each BREAK descends into children, doing O(log n) work per descent, but the descent merges or eliminates distinct maximum levels in the subtree. Ji shows the total work across m operations on an n-element array is O((n + m) log^2 n) for chmin alone, and the same bound holds when combined with range add.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Structure', 'Range chmin + sum', 'Amortized per op', 'Extra node fields', 'Implementation difficulty'],
          rows: [
            ['Lazy segment tree', 'Not supported', '--', 'lazy tag only', 'Low'],
            ['Segment Tree Beats', 'Supported', 'O(log^2 n)', 'max1, max2, maxCount', 'High'],
            ['Chtholly tree (ODT)', 'Supported (assign-heavy)', 'O(n) worst case, fast with random data', 'None (interval set)', 'Low'],
            ['Brute force', 'Supported', 'O(n)', 'None', 'Trivial'],
          ],
        },
        'Space is O(n), same shape as any segment tree, but each node carries heavier metadata. The constant factor is roughly 3-4x a plain lazy tree in both memory and code volume. For the full variant supporting chmin + chmax + add + sum, each node stores max1, max2, maxCount, min1, min2, minCount, sum, and separate lazy tags for caps and additions.',
        'When n doubles, per-operation cost grows by roughly two factors of log. In practice, n = 10^5 means about 17^2 ~ 289 units of amortized work per operation, which is fast enough for competitive programming time limits but not negligible. The constant in front of log^2 n is modest because most operations hit the TAG path and stop in O(1) per node.',
        {
          type: 'note',
          text: 'The O(log^2 n) bound is for chmin alone or chmin + add. Combining chmin + chmax + add + sum is supported but the tight amortized bound is harder to prove; competitive programmers rely on it empirically passing within time limits.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Competitive programming is the primary home. Problems that ask for range chmin/chmax combined with range sum queries appear regularly in Chinese and Japanese competitive programming (e.g., HDU "Gorgeous Sequence," various Codeforces problems). Before Beats, these required offline tricks or sqrt decomposition with worse constants.',
        'Historical maximum queries are another strength. By maintaining an additional field -- the all-time historical maximum at each position -- Beats can answer "what was the largest value position i ever held across all updates?" alongside live queries. This requires a second layer of lazy tags tracking historical caps, but fits naturally into the Beats framework.',
        'The design pattern transfers beyond competitive programming. Any system that maintains block-level summaries and skips block-interior inspection when a metadata certificate proves the update is uniform over the affected subset uses the same idea. Database page-level min/max filters that skip scanning pages, SIMD lane masks that skip unchanged lanes, and GPU warp-level predicates all echo this structure: store enough summary to prove the block is safe to shortcut.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a general-purpose range structure. For pure range-add and range-sum, a lazy segment tree or Fenwick tree is simpler, faster, and less error-prone. For static range queries, a sparse table gives O(1) query time with zero update cost. Beats is a specialized extension, not a replacement.',
        'It fails for arbitrary conditional updates. The amortized argument depends on hard descents collapsing value diversity. If an update can force repeated BREAK descents without simplifying node summaries -- range modulo is the classic counterexample -- the potential argument breaks and the structure degenerates to O(n) per operation.',
        'It is brittle to implement. Interactions between chmin tags, chmax tags, and add tags create subtle ordering dependencies in pushDown. Merging max2 from two children requires careful case analysis when the children share the same max1. Off-by-one errors in the strict-second-maximum computation are common. A brute-force O(n^2) checker over small random arrays is practically mandatory during development.',
        'Persistence and concurrency are hard. The lazy state couples parent and child in ways that make path-copying persistent trees expensive and lock-free concurrent access nearly impossible without redesigning the push protocol.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Ji, "Segment Beats" (2016) -- the original technique, presented at a Chinese competitive programming camp. The translated writeup is the primary reference for the break/tag/skip framework and the amortized potential argument.',
            'HDU 5306 "Gorgeous Sequence" -- the canonical practice problem. Range chmin updates, range max queries, range sum queries.',
            'Codeforces blog posts by Al.Cash and others provide English-language implementations and extensions to historical queries.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic'],
          rows: [
            ['Prerequisite', 'Segment Tree with lazy propagation -- you must understand push/pull and tag composition before Beats adds a second tag layer'],
            ['Prerequisite', 'Amortized analysis -- the potential method is essential to understanding why Beats is not O(n) per operation'],
            ['Extension', 'Li Chao Tree -- another segment tree variant for a different problem shape (convex hull trick / line container)'],
            ['Alternative', 'Chtholly Tree (ODT) -- interval-assign structure that handles assign-heavy workloads with simpler code but no worst-case guarantee'],
            ['Practice', 'Historical maximum queries -- extend Beats with a second lazy tag layer to track all-time maxima'],
          ],
        },
      ],
    },
  ],
};
