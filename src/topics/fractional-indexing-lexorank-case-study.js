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
      heading: 'What it is',
      paragraphs: [
        'Fractional indexing is an order-maintenance technique for product lists. Instead of storing positions as 1, 2, 3 and renumbering many rows after a drag-and-drop move, each item stores a sortable order key. To insert or move an item between two neighbors, generate a new key that sorts between the neighbors. Everyone reconstructs the visible order by sorting keys.',
        'LexoRank is a production cousin used by Jira Software. It stores lexicographically sortable rank strings and includes operational machinery for balancing and integrity checks. The shared idea is simple: make ordinary reorders small writes, and repair the key space only when it gets crowded.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The simplest version uses numbers: put item C between keys 1 and 2 by assigning 1.5. That fails eventually with fixed-precision floats, so practical systems use arbitrary-precision fractions or variable-length strings. David Greenspan\'s fractional-indexing approach and the Rocicorp JavaScript library expose functions like generateKeyBetween(a, b) and generateNKeysBetween(a, b, n).',
        'Reads are straightforward: sort by orderKey. Moves are local: find the destination neighbors and write one new key to the moved item. Bulk inserts can generate evenly spaced keys so a paste of ten items does not immediately create dense key clusters.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For ordinary moves, the write cost is O(1) records and the display cost is sorting or maintaining a sorted index. The hidden cost is key growth. Repeated insertions in the same tiny gap can make longer keys. Production systems therefore need rebalance jobs, maximum key-length alerts, and a safe way to rewrite a region or bucket without racing active user moves.',
        'Concurrency is the second cost. Two clients can compute the same midpoint in the same gap. A server can reject duplicates and ask one client to retry; a peer-to-peer system may use jitter, client-id tiebreakers, or a CRDT sequence structure. Fractional indexing is an ordering key scheme, not a complete sync protocol.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a kanban board with thousands of cards and many clients watching one column. A user drags card API between Bug and Docs. The client reads Bug.order and Docs.order, generates a key between them, and sends a move operation that updates only API.order and columnId if needed. The database index on (columnId, orderKey) keeps reads efficient; clients receive the update and sort.',
        'The same pattern appears in design tools and issue trackers. Figma described using fractional indexing to order children in a multiplayer tree, with arbitrary-precision fractions to avoid running out of precision. Atlassian documents LexoRank as Jira Software\'s ranking system and exposes balancing and integrity checks because long-running rank systems need maintenance.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat fractional indexing as a CRDT by itself. It can be used inside collaborative systems, but concurrent moves still need deterministic conflict handling. A move should usually be one logical operation, not a delete plus insert that can leave ghosts if only half arrives.',
        'Do not ignore scope. A rank key is usually meaningful within one parent, column, project, or layer list. Moving an item across parents may require changing both parentId and orderKey atomically. Also avoid infinite faith in keys: if key length grows without bounds, schedule rebalance before database limits or UI performance force an emergency repair.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and practical sources: Figma Realtime Editing of Ordered Sequences at https://www.figma.com/blog/realtime-editing-of-ordered-sequences/, Figma multiplayer architecture at https://www.figma.com/blog/how-figmas-multiplayer-technology-works/, David Greenspan Implementing Fractional Indexing at https://observablehq.com/@dgreensp/implementing-fractional-indexing, Rocicorp fractional-indexing at https://github.com/rocicorp/fractional-indexing, Atlassian Managing LexoRank at https://confluence.atlassian.com/spaces/ADMINJIRASERVER/pages/938847803/Managing%2BLexoRank, and Atlassian LexoRank troubleshooting at https://support.atlassian.com/jira/kb/troubleshooting-lexorank-system-issues/. Study Order Maintenance & List Labeling, Packed Memory Array, Sequence CRDTs, Peritext Rich-Text CRDT Case Study, B-Tree, and Database Indexing next.',
      ],
    },
  ],
};
