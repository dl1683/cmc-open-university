// Fractional indexing and LexoRank: product ordering keys for drag/drop,
// multiplayer lists, issue ranking, canvas z-order, and database-backed order.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'fractional-indexing-lexorank-case-study',
  title: 'Fractional Indexing & LexoRank Case Study',
  category: 'Data Structures',
  summary: 'Maintain user-visible order by assigning sortable keys, inserting between neighbors, and rebalancing only when key space gets crowded.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['insert between', 'collisions and rebalance', 'product case study'], defaultValue: 'insert between' },
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

function* insertBetween() {
  yield {
    state: labelMatrix(
      'One moved card rewrites one key',
      [
        { id: 'todo', label: 'Todo' },
        { id: 'bug', label: 'Bug' },
        { id: 'api', label: 'API' },
        { id: 'docs', label: 'Docs' },
      ],
      [
        { id: 'old', label: 'old key' },
        { id: 'action', label: 'action' },
        { id: 'new', label: 'new key' },
      ],
      [
        ['a0', 'keep', 'a0'],
        ['a1', 'keep', 'a1'],
        ['a2', 'move', 'a1V'],
        ['a3', 'keep', 'a3'],
      ],
    ),
    highlight: { active: ['api:action', 'api:new'], found: ['todo:new', 'bug:new', 'docs:new'] },
    explanation: 'Fractional indexing keeps order in a sortable key field. To move one item between two neighbors, generate a key that sorts between their keys. The neighbors do not need updates.',
    invariant: 'Order is sort(items by orderKey), not array position in storage.',
  };

  yield {
    state: labelMatrix(
      'Between two keys',
      [
        { id: 'wide', label: 'wide gap' },
        { id: 'tight', label: 'tight gap' },
        { id: 'front', label: 'prepend' },
        { id: 'back', label: 'append' },
      ],
      [
        { id: 'left', label: 'left' },
        { id: 'right', label: 'right' },
        { id: 'middle', label: 'new key' },
      ],
      [
        ['a1', 'a2', 'a1V'],
        ['a1V', 'a1W', 'a1VV'],
        ['null', 'a0', 'Zz'],
        ['a3', 'null', 'a4'],
      ],
    ),
    highlight: { found: ['wide:middle', 'tight:middle'], active: ['front:middle', 'back:middle'] },
    explanation: 'Greenspan-style fractional indexing uses lexicographically sortable strings rather than fixed-precision floats. When there is no short midpoint, the key can grow by adding more digits.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'a0', label: 'a0', x: 1.0, y: 4.0, note: 'A' },
        { id: 'a1', label: 'a1', x: 2.8, y: 4.0, note: 'B' },
        { id: 'mid', label: 'a1V', x: 4.6, y: 4.0, note: 'new' },
        { id: 'a2', label: 'a2', x: 6.4, y: 4.0, note: 'C' },
        { id: 'a3', label: 'a3', x: 8.2, y: 4.0, note: 'D' },
      ],
      edges: [
        { id: 'e-a0-a1', from: 'a0', to: 'a1' },
        { id: 'e-a1-mid', from: 'a1', to: 'mid' },
        { id: 'e-mid-a2', from: 'mid', to: 'a2' },
        { id: 'e-a2-a3', from: 'a2', to: 'a3' },
      ],
    }, { title: 'The database stores keys; the UI sorts by keys' }),
    highlight: { active: ['mid'], found: ['a0', 'a1', 'a2', 'a3'] },
    explanation: 'This is why fractional keys fit drag-and-drop UIs and multiplayer canvases. A reorder is a small write to the moved record, not a cascade of position updates over the whole list.',
  };

  yield {
    state: labelMatrix(
      'Compared with simple alternatives',
      [
        { id: 'integers', label: '1,2,3 ints' },
        { id: 'gaps', label: '1000 gaps' },
        { id: 'fractional', label: 'fractional keys' },
        { id: 'linked', label: 'linked list' },
      ],
      [
        { id: 'moveCost', label: 'move cost' },
        { id: 'readCost', label: 'read cost' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['many rewrites', 'sort easy', 'renumber'],
        ['one rewrite', 'sort easy', 'gap exhaustion'],
        ['one rewrite', 'sort easy', 'long keys'],
        ['two pointers', 'walk links', 'hard queries'],
      ],
    ),
    highlight: { found: ['fractional:moveCost', 'fractional:readCost'], compare: ['integers:moveCost', 'linked:readCost'] },
    explanation: 'The technique is a pragmatic order-maintenance tradeoff. It is not asymptotic magic; it chooses short writes and simple reads, then handles long-key pressure with rebalance.',
  };
}

function* collisionsAndRebalance() {
  yield {
    state: labelMatrix(
      'Concurrent inserts in the same gap',
      [
        { id: 'alice', label: 'Alice' },
        { id: 'bob', label: 'Bob' },
        { id: 'server', label: 'server/sync' },
      ],
      [
        { id: 'left', label: 'left key' },
        { id: 'right', label: 'right key' },
        { id: 'chosen', label: 'chosen key' },
      ],
      [
        ['a1', 'a2', 'a1V'],
        ['a1', 'a2', 'a1V'],
        ['tie', 'detected', 'repair or tiebreak'],
      ],
    ),
    highlight: { compare: ['alice:chosen', 'bob:chosen'], active: ['server:chosen'] },
    explanation: 'If two clients compute the same midpoint independently, the list needs a tiebreaker, jitter, uniqueness constraint, or server-side repair. Fractional indexing reduces rewrite scope; it does not erase concurrency design.',
    invariant: 'The final ordering key must be unique enough for deterministic sort order.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'repeated inserts in one gap', min: 0, max: 20 }, y: { label: 'key length', min: 0, max: 18 } },
      series: [
        { id: 'exact', label: 'exact midpoint', points: [{ x: 0, y: 2 }, { x: 5, y: 4 }, { x: 10, y: 8 }, { x: 15, y: 12 }, { x: 20, y: 16 }] },
        { id: 'bulk', label: 'spaced bulk keys', points: [{ x: 0, y: 2 }, { x: 5, y: 3 }, { x: 10, y: 5 }, { x: 15, y: 7 }, { x: 20, y: 9 }] },
      ],
    }),
    highlight: { active: ['exact'], found: ['bulk'] },
    explanation: 'Repeated inserts into the same tiny gap make keys longer. Libraries expose bulk key generation to space several new items evenly and keep keys shorter for common workflows.',
  };

  yield {
    state: labelMatrix(
      'LexoRank-style maintenance',
      [
        { id: 'normal', label: 'normal rank' },
        { id: 'long', label: 'long rank' },
        { id: 'bucket', label: 'bucket move' },
        { id: 'rebalance', label: 'rebalance' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'action' },
      ],
      [
        ['short strings', 'do nothing'],
        ['rank length grows', 'schedule repair'],
        ['active bucket shifts', 'keep writes safe'],
        ['rewrite spaced keys', 'background job'],
      ],
    ),
    highlight: { active: ['long:signal', 'rebalance:action'], found: ['normal:action'] },
    explanation: 'Atlassian documents LexoRank maintenance as a managed ranking system with balancing and integrity checks. In production, rank keys need operations tooling, not just a midpoint function.',
  };

  yield {
    state: labelMatrix(
      'Operational guardrails',
      [
        { id: 'unique', label: 'unique index' },
        { id: 'atomic', label: 'atomic move' },
        { id: 'rebalance', label: 'rebalance lock' },
        { id: 'audit', label: 'audit trail' },
      ],
      [
        { id: 'prevents', label: 'prevents' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['duplicate rank', 'retry path'],
        ['ghost item', 'move API'],
        ['race repair', 'single writer'],
        ['mystery reorder', 'storage'],
      ],
    ),
    highlight: { found: ['unique:prevents', 'atomic:prevents', 'rebalance:prevents'], compare: ['rebalance:cost'] },
    explanation: 'The production lesson is sharper than the algorithm: use a uniqueness check, make move a single logical operation, and make rebalance serialized or server-owned.',
  };
}

function* productCaseStudy() {
  yield {
    state: graphState({
      nodes: [
        { id: 'drag', label: 'drag', x: 0.8, y: 4.0, note: 'UI' },
        { id: 'neighbors', label: 'bounds', x: 2.4, y: 4.0, note: 'keys' },
        { id: 'key', label: 'key', x: 4.0, y: 4.0, note: 'mid' },
        { id: 'write', label: 'write', x: 5.6, y: 4.0, note: 'one row' },
        { id: 'sync', label: 'sync', x: 7.2, y: 4.0, note: 'clients' },
        { id: 'sort', label: 'sort', x: 8.8, y: 4.0, note: 'view' },
      ],
      edges: [
        { id: 'e-drag-neighbors', from: 'drag', to: 'neighbors' },
        { id: 'e-neighbors-key', from: 'neighbors', to: 'key' },
        { id: 'e-key-write', from: 'key', to: 'write' },
        { id: 'e-write-sync', from: 'write', to: 'sync' },
        { id: 'e-sync-sort', from: 'sync', to: 'sort' },
      ],
    }, { title: 'Kanban reorder path' }),
    highlight: { active: ['neighbors', 'key', 'write'], found: ['sort'] },
    explanation: 'A Trello/Jira/Linear-style board should not rewrite every card when one card moves. The write path reads neighboring order keys, generates a new key, writes one record, and lets every client sort.',
    invariant: 'A reorder is data mutation plus deterministic projection, not DOM shuffling.',
  };

  yield {
    state: labelMatrix(
      'Where it shows up',
      [
        { id: 'figma', label: 'Figma tree' },
        { id: 'jira', label: 'Jira rank' },
        { id: 'kanban', label: 'Kanban board' },
        { id: 'canvas', label: 'canvas z-order' },
      ],
      [
        { id: 'ordered', label: 'ordered thing' },
        { id: 'why', label: 'why keys help' },
      ],
      [
        ['children of node', 'multiplayer order'],
        ['issues in backlog', 'cluster-safe rank'],
        ['cards in column', 'one-row moves'],
        ['layers/shapes', 'stable render order'],
      ],
    ),
    highlight: { found: ['figma:why', 'jira:why', 'kanban:why'], active: ['canvas:ordered'] },
    explanation: 'Figma publicly described using fractional indexing for ordered sequences. Atlassian exposes LexoRank as the managed ranking system behind Jira Software issue order.',
  };

  yield {
    state: labelMatrix(
      'Design checklist',
      [
        { id: 'keyType', label: 'key type' },
        { id: 'precision', label: 'precision' },
        { id: 'ties', label: 'ties' },
        { id: 'repair', label: 'repair' },
        { id: 'filters', label: 'filters' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['string or numeric?', 'bad sorting'],
        ['unbounded enough?', 'no midpoint'],
        ['deterministic?', 'same key'],
        ['single writer?', 'rank churn'],
        ['order per scope?', 'cross-list bugs'],
      ],
    ),
    highlight: { active: ['precision:question', 'ties:question', 'repair:question'], compare: ['filters:failure'] },
    explanation: 'A rank is scoped. A card rank usually means order within one column or parent, not one global order for every card in the database.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'items moved', min: 0, max: 1000 }, y: { label: 'rows rewritten', min: 0, max: 1000 } },
      series: [
        { id: 'renumber', label: 'renumber integers', points: [{ x: 1, y: 200 }, { x: 10, y: 400 }, { x: 100, y: 900 }] },
        { id: 'fractional', label: 'fractional keys', points: [{ x: 1, y: 1 }, { x: 10, y: 10 }, { x: 100, y: 100 }] },
        { id: 'rebalance', label: 'rare rebalance', points: [{ x: 1, y: 1 }, { x: 400, y: 1 }, { x: 450, y: 600 }, { x: 1000, y: 600 }] },
      ],
    }),
    highlight: { found: ['fractional'], compare: ['renumber', 'rebalance'] },
    explanation: 'Conceptually, fractional indexing makes ordinary moves proportional to moved items. Rebalance is the occasional background maintenance cost that keeps future keys healthy.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'insert between') yield* insertBetween();
  else if (view === 'collisions and rebalance') yield* collisionsAndRebalance();
  else if (view === 'product case study') yield* productCaseStudy();
  else throw new InputError('Pick a Fractional Indexing view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many products need user-maintained order: kanban cards, issue backlogs, design layers, playlist entries, outline nodes, comments, tabs, and canvas objects. The order is not derived from timestamp or score. The user creates it by dragging, inserting, moving, and grouping items.',
        'The storage problem is easy when the list is tiny and single-user. Store an array, update the array, and render it. The problem becomes harder when the list lives in a database, many clients observe it, offline edits may sync later, and one drag should not rewrite hundreds or thousands of rows.',
        'Fractional indexing and LexoRank-style systems exist to make visible order a sortable-key problem. The durable representation is an order key on each item. A move generates a key between the destination neighbors, writes the moved item, and lets every reader sort by the key.',
      ],
    },
    {
      heading: 'The naive baselines and their wall',
      paragraphs: [
        'The first baseline is dense integer position: 1, 2, 3, 4. Moving an item between positions 2 and 3 forces a renumber, or at least a suffix rewrite. That is tolerable in a local array. It is poor for a shared database because one drag can update many rows, cause conflicts, and generate noisy sync traffic.',
        'The second baseline is gapped integers: 1000, 2000, 3000. A move can use 1500. That works until users repeatedly insert into the same gap. Eventually there is no integer between two neighbors unless the system renumbers part of the list.',
        'The third baseline is floating-point midpoint. It feels natural, but fixed precision runs out in hot gaps and database sorting across languages can become subtle. Linked lists avoid numeric gaps, but reads become awkward: sorting a query result by next pointers is expensive, and repairing broken links is operationally painful.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The hard case is a hot gap. A user may keep dragging new items to the top of a column, automation may insert tasks after the same milestone, or two offline clients may choose a midpoint for the same neighbor pair. The key space has to create more room without rewriting the whole list every time.',
        'The second wall is determinism. Every client and database query must agree on the same sort order. If one layer uses locale-aware collation, another uses bytewise order, and another appends actor IDs as tiebreakers, the product can show different orders to different users.',
        'The third wall is scope. A rank usually means order within one parent, column, playlist, issue group, or layer stack. A key that is valid in one scope may collide or be meaningless in another. Moving an item across scopes must update both the parent identity and the order key as one logical operation.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store a sortable order key, not a dense array index. To insert or move an item, read the left and right neighbor keys in the destination scope and generate a new key that sorts strictly between them. Reads use an ordinary sorted index over scope plus order key.',
        'The trick is that the key space is variable length. Lexicographic string keys can grow by adding more digits when no short midpoint exists. Bulk key generation can place several new items evenly in a gap. A rebalance job can rewrite a crowded scoped region with fresh spacing while preserving the same visible order.',
        'LexoRank is the production-flavored version of the idea: rank strings, buckets or maintenance phases, integrity checks, and balancing. The midpoint function is only the center. A real ranking system also owns collisions, retries, background repair, and observability.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A move begins with destination bounds. If an item is dropped between cards with keys a1 and a2, the server or client asks for a key between those two strings. In the toy visual, that key might be a1V. The database row for the moved item receives the new key, and later reads sort by orderKey.',
        'The key-generation function must handle missing bounds. Inserting at the front asks for a key before the first item. Appending asks for a key after the last item. Inserting many items at once should use a bulk function so the new keys are spaced across the available interval instead of packed into one edge.',
        'Concurrent inserts need a policy. A uniqueness constraint can reject duplicate keys and force a retry. The server can own key generation so clients never commit the same midpoint. A client-side system can append deterministic jitter or a tiebreaker. In collaborative systems with offline writes, a sequence CRDT may be a better fit than plain fractional indexing.',
        'Rebalance is maintenance, not failure. When keys become too long or a region becomes too crowded, the system can lock or single-write a scoped list and rewrite ranks into evenly spaced values. The visible order stays the same; the key space becomes healthy again.',
      ],
    },
    {
      heading: 'What the visual shows',
      paragraphs: [
        'The insert-between view shows the small-write path. The UI moves one card, but storage changes one order key. The neighbors keep their keys. The sorted projection changes because the moved item now sorts between its new neighbors.',
        'The collision and rebalance views show the production boundary. Two clients can choose the same key. Repeated inserts into one gap can lengthen keys. LexoRank-style maintenance detects unhealthy rank ranges and schedules a repair instead of pretending midpoint generation is the whole system.',
        'The product case study view shows why this pattern appears in boards, design tools, and issue trackers. The user wants immediate reorder feedback. The backend wants one-row writes and simple sorted queries. The key field is the contract between those two needs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is sorted order within a scope. If newKey is greater than the left neighbor and less than the right neighbor under the database comparator, sorting by orderKey places the item in the intended position. The database does not need to know about drag gestures; it only needs deterministic comparison.',
        'The method avoids suffix rewrites because the order is encoded locally in the moved item. A dense integer position says "I am item 17 in a sequence that may have to change around me." A fractional key says "I sort between these neighboring key values." That local statement is enough for ordinary moves.',
        'Rebalance is safe when it preserves relative order. If a scoped list currently sorts as A, B, C, D, a rebalance can assign fresh keys k1, k2, k3, k4 in that same order. Readers may see a maintenance update, but the product order does not change.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The happy path is cheap. A move updates O(1) rows, often only the moved item. Reads use a database index such as (column_id, order_key). Pagination, filtering, and subscription queries remain familiar because order is a sortable field rather than a linked traversal.',
        'The hidden costs are key length, rebalance, uniqueness conflicts, transaction boundaries, and collation discipline. Long keys increase storage and index size. Rebalance can rewrite many rows in a scope. Duplicate keys need retry logic. Cross-scope moves must update parent and rank atomically. Sorting must be bytewise or otherwise exactly specified.',
        'There is also a product tradeoff. Fractional keys preserve explicit user order. They are not the right tool when order is computed continuously from priority score, due date, ranking model, or timestamp. If the system owns the order, store the score and recompute views. If the user owns the order, sortable rank keys fit.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Duplicate keys are the obvious failure. They can come from concurrent midpoint generation, offline clients, bugs, or collation mismatch. A unique index on (scope_id, order_key) plus a retry path is the simplest guardrail for server-owned ranking.',
        'Hot gaps are the slow failure. Keys grow longer and operations remain correct, but storage and index costs rise. Track maximum key length, average key length by scope, rebalance count, and the locations that repeatedly need repair.',
        'Wrong scope is a product failure. Sorting all cards by rank across a board may mix columns that should be independent. Moving a card from one column to another must update column_id and rank together, otherwise clients may see a ghost item in the old column or a duplicate order in the new one.',
        'Plain fractional indexing is not a full collaborative text algorithm. It can support many realtime product lists, especially with a server ordering authority, but it does not by itself solve delayed delivery, intent-preserving rich text, tombstone compaction, or CRDT convergence.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Make the move API explicit. It should receive item identity, destination scope, left neighbor, right neighbor, and an expected version when needed. The server should validate that the neighbors are still in the destination scope or decide how to repair when they are stale.',
        'Use a stable comparator and test it end to end. The key-generation library, application sort, database index, and any search or cache layer must agree. Avoid locale collation for rank keys unless the entire system is designed around that comparator.',
        'Instrument maintenance. Good dashboards show duplicate-key retries, rebalance duration, scopes waiting for rebalance, max key length, failed cross-scope moves, and client retry rates. A ranking system usually looks simple until the first hot board or offline sync wave creates a crowded gap.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A board column has cards with keys a0, a1, a2, a3. The user drags the card currently at a2 between a0 and a1. The server reads the destination neighbors, generates a key such as a0V, writes that value to the moved card, and broadcasts the updated row. Every client sorts the column by order_key and sees the new order.',
        'Now two users insert into the same gap while offline and both create a0V. On sync, a unique constraint can reject the second write and ask the client or server to regenerate a key between the now-current neighbors. Another design can accept both by adding a deterministic tiebreaker, but then every reader must include that tiebreaker in the sort.',
        'After months of automation, the top of one backlog has very long keys because new tickets are always inserted after the same header. A background rebalance locks that project backlog or routes it through one maintenance writer, assigns fresh evenly spaced ranks, and records the operation. The product order is unchanged; future inserts have room again.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary and practical sources: Figma Realtime Editing of Ordered Sequences at https://www.figma.com/blog/realtime-editing-of-ordered-sequences/, Figma multiplayer architecture at https://www.figma.com/blog/how-figmas-multiplayer-technology-works/, David Greenspan Implementing Fractional Indexing at https://observablehq.com/@dgreensp/implementing-fractional-indexing, Rocicorp fractional-indexing at https://github.com/rocicorp/fractional-indexing, Atlassian Managing LexoRank at https://confluence.atlassian.com/spaces/ADMINJIRASERVER/pages/938847803/Managing%2BLexoRank, and Atlassian LexoRank troubleshooting at https://support.atlassian.com/jira/kb/troubleshooting-lexorank-system-issues.',
        'Study Order Maintenance & List Labeling, Packed Memory Array, B-Tree, Database Indexing, Sequence CRDTs, Peritext Rich-Text CRDT Case Study, Yjs Struct Store & Updates, and Automerge Change Graph & Columnar Storage next. The contrast to remember is simple: fractional keys are a pragmatic product-ordering system; CRDT sequence structures are a replicated convergence system.',
      ],
    },
  ],
};
