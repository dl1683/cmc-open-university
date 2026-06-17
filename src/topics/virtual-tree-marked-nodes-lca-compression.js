// Virtual tree / auxiliary tree: compress marked tree queries to marked nodes plus LCAs.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'virtual-tree-marked-nodes-lca-compression',
  title: 'Virtual Tree LCA Compression',
  category: 'Data Structures',
  summary: 'Compress a huge rooted tree query to the marked nodes plus their LCAs, then run DP on an O(k)-size auxiliary tree.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['compress nodes', 'stack build', 'incident case study'], defaultValue: 'compress nodes' },
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

const FULL_NODES = [
  { id: 'root', label: 'root', x: 5.0, y: 0.6 },
  { id: 'auth', label: 'auth', x: 2.5, y: 2.1 },
  { id: 'shop', label: 'shop', x: 5.4, y: 2.1 },
  { id: 'search', label: 'search', x: 7.8, y: 2.1 },
  { id: 'login', label: 'login', x: 1.4, y: 3.9 },
  { id: 'oauth', label: 'oauth', x: 3.2, y: 3.9 },
  { id: 'billing', label: 'billing', x: 4.4, y: 3.9 },
  { id: 'cart', label: 'cart', x: 6.6, y: 3.9 },
  { id: 'indexer', label: 'idx', x: 8.1, y: 5.8 },
  { id: 'cache', label: 'cache', x: 9.1, y: 3.9 },
  { id: 'tax', label: 'tax', x: 3.4, y: 5.8 },
  { id: 'invoices', label: 'invoices', x: 4.8, y: 5.8 },
  { id: 'checkout', label: 'check', x: 6.9, y: 5.8 },
];

const FULL_EDGES = [
  { id: 'e-root-auth', from: 'root', to: 'auth' },
  { id: 'e-root-shop', from: 'root', to: 'shop' },
  { id: 'e-root-search', from: 'root', to: 'search' },
  { id: 'e-auth-login', from: 'auth', to: 'login' },
  { id: 'e-auth-oauth', from: 'auth', to: 'oauth' },
  { id: 'e-shop-billing', from: 'shop', to: 'billing' },
  { id: 'e-shop-cart', from: 'shop', to: 'cart' },
  { id: 'e-search-indexer', from: 'search', to: 'indexer' },
  { id: 'e-search-cache', from: 'search', to: 'cache' },
  { id: 'e-billing-tax', from: 'billing', to: 'tax' },
  { id: 'e-billing-invoices', from: 'billing', to: 'invoices' },
  { id: 'e-cart-checkout', from: 'cart', to: 'checkout' },
];

const VIRTUAL_NODES = [
  { id: 'root', label: 'root', x: 5.0, y: 0.7 },
  { id: 'auth', label: 'auth', x: 2.8, y: 2.5 },
  { id: 'login', label: 'login', x: 1.6, y: 4.4 },
  { id: 'oauth', label: 'oauth', x: 3.8, y: 4.4 },
  { id: 'shop', label: 'shop', x: 6.3, y: 2.5 },
  { id: 'invoices', label: 'invoices', x: 5.3, y: 4.4 },
  { id: 'checkout', label: 'checkout', x: 7.4, y: 4.4 },
  { id: 'cache', label: 'cache', x: 8.7, y: 2.8 },
];

const VIRTUAL_EDGES = [
  { id: 'v-root-auth', from: 'root', to: 'auth', weight: '1' },
  { id: 'v-auth-login', from: 'auth', to: 'login', weight: '1' },
  { id: 'v-auth-oauth', from: 'auth', to: 'oauth', weight: '1' },
  { id: 'v-root-shop', from: 'root', to: 'shop', weight: '1' },
  { id: 'v-shop-invoices', from: 'shop', to: 'invoices', weight: '2' },
  { id: 'v-shop-checkout', from: 'shop', to: 'checkout', weight: '2' },
  { id: 'v-root-cache', from: 'root', to: 'cache', weight: '2' },
];

function withNotes(nodes, notes) {
  return nodes.map((node) => ({ ...node, note: notes[node.id] ?? '' }));
}

function fullTreeGraph(title, notes = {}) {
  return graphState({
    nodes: withNotes(FULL_NODES, notes),
    edges: FULL_EDGES,
  }, { title });
}

function virtualGraph(title, shownEdgeIds = VIRTUAL_EDGES.map((edge) => edge.id), notes = {}) {
  const shown = new Set(shownEdgeIds);
  return graphState({
    nodes: withNotes(VIRTUAL_NODES, notes),
    edges: VIRTUAL_EDGES.filter((edge) => shown.has(edge.id)),
  }, { title });
}

function stackGraph(title, shownEdgeIds, { stack = '', scan = '', notes = {} } = {}) {
  const shown = new Set(shownEdgeIds);
  return graphState({
    nodes: [
      ...withNotes(VIRTUAL_NODES, notes),
      { id: 'stack', label: 'stack', x: 0.6, y: 1.0, note: stack },
      { id: 'scan', label: 'scan', x: 0.6, y: 3.0, note: scan },
    ],
    edges: [
      { id: 'e-stack-root', from: 'stack', to: 'root', weight: 'top' },
      { id: 'e-scan-root', from: 'scan', to: 'root', weight: 'tin' },
      ...VIRTUAL_EDGES.filter((edge) => shown.has(edge.id)),
    ],
  }, { title });
}

function* compressNodes() {
  yield {
    state: fullTreeGraph('Start with a large rooted tree and a small marked set', {
      login: 'marked',
      oauth: 'marked',
      invoices: 'marked',
      checkout: 'marked',
      cache: 'marked',
    }),
    highlight: { active: ['login', 'oauth', 'invoices', 'checkout', 'cache'], compare: ['root'] },
    explanation: 'A virtual tree starts from a query subset. Here the original service tree has 13 nodes, but the incident touches only five marked services.',
    invariant: 'Only marked nodes and LCAs that preserve their ancestry relationships are needed for this query.',
  };

  yield {
    state: labelMatrix(
      'Sort marked nodes by Euler entry time',
      [
        { id: 'm1', label: 'login' },
        { id: 'm2', label: 'oauth' },
        { id: 'm3', label: 'invoices' },
        { id: 'm4', label: 'checkout' },
        { id: 'm5', label: 'cache' },
      ],
      [{ id: 'tin', label: 'tin' }, { id: 'role', label: 'role' }],
      [
        ['3', 'marked'],
        ['4', 'marked'],
        ['8', 'marked'],
        ['10', 'marked'],
        ['13', 'marked'],
      ],
    ),
    highlight: { active: ['m1:tin', 'm2:tin', 'm3:tin', 'm4:tin', 'm5:tin'], found: ['m1:role'] },
    explanation: 'Euler order turns the tree geometry into a linear scan. Adjacent marked nodes in this order reveal the LCAs needed to keep the compressed tree connected.',
  };

  yield {
    state: labelMatrix(
      'Add LCAs of adjacent marked nodes',
      [
        { id: 'p1', label: 'm1-m2' },
        { id: 'p2', label: 'm2-m3' },
        { id: 'p3', label: 'm3-m4' },
        { id: 'p4', label: 'm4-m5' },
        { id: 'done', label: 'dedupe' },
      ],
      [{ id: 'lca', label: 'LCA' }, { id: 'action' }],
      [
        ['auth', 'add'],
        ['root', 'add'],
        ['shop', 'add'],
        ['root', 'seen'],
        ['8 nodes', 'sort again'],
      ],
    ),
    highlight: { active: ['p1:lca', 'p2:lca', 'p3:lca'], found: ['done:action'], compare: ['p4:action'] },
    explanation: 'The closure step adds auth, root, and shop. After deduplication, the virtual tree has eight nodes rather than the full original tree.',
  };

  yield {
    state: virtualGraph('The virtual tree preserves only relevant ancestor jumps', undefined, {
      root: 'added LCA',
      auth: 'added LCA',
      shop: 'added LCA',
      login: 'marked',
      oauth: 'marked',
      invoices: 'marked',
      checkout: 'marked',
      cache: 'marked',
    }),
    highlight: {
      active: ['login', 'oauth', 'invoices', 'checkout', 'cache'],
      found: ['root', 'auth', 'shop'],
      compare: ['v-shop-invoices', 'v-root-cache'],
    },
    explanation: 'Each virtual edge may stand for a whole original path. The edge weight stores the skipped distance, so later dynamic programming does not lose path length.',
  };

  yield {
    state: labelMatrix(
      'Size and cost shape',
      [
        { id: 'orig', label: 'orig' },
        { id: 'marks', label: 'marks' },
        { id: 'virtual', label: 'virt' },
        { id: 'query', label: 'DP' },
      ],
      [{ id: 'size', label: 'size' }, { id: 'reason' }],
      [
        ['n=13', 'all'],
        ['k=5', 'set'],
        ['<=2k-1', 'closed'],
        ['O(k)', 'run'],
      ],
    ),
    highlight: { found: ['virtual:size', 'query:size'], compare: ['orig:size'] },
    explanation: 'The useful bound is structural: after adding adjacent LCAs and deduping, a virtual tree has O(k) nodes. Large background subtrees disappear from the query.',
  };
}

function* stackBuild() {
  yield {
    state: stackGraph('Scan the closed node set in Euler order', [], {
      stack: 'empty',
      scan: 'root auth login ...',
      notes: { root: 'first' },
    }),
    highlight: { active: ['scan', 'root'], compare: ['stack'] },
    explanation: 'After sorting marked nodes plus LCAs by tin, the stack algorithm builds parent-child links between nearest kept ancestors.',
    invariant: 'The stack always stores a chain of ancestors in the original tree.',
  };

  yield {
    state: stackGraph('Push root, auth, then login', ['v-root-auth', 'v-auth-login'], {
      stack: 'root/auth/login',
      scan: 'at login',
      notes: { root: 'ancestor', auth: 'ancestor', login: 'top' },
    }),
    highlight: { active: ['root', 'auth', 'login', 'v-root-auth', 'v-auth-login'], found: ['stack'] },
    explanation: 'When the next node is inside the subtree of the stack top, connect it as a child and push it. root -> auth -> login is a clean ancestor chain.',
  };

  yield {
    state: stackGraph('Process oauth by popping login back to auth', ['v-root-auth', 'v-auth-login', 'v-auth-oauth'], {
      stack: 'root/auth/oauth',
      scan: 'at oauth',
      notes: { login: 'popped', auth: 'parent', oauth: 'new top' },
    }),
    highlight: { active: ['auth', 'oauth', 'v-auth-oauth'], removed: ['login'], compare: ['stack'] },
    explanation: 'oauth is not inside login, so login is popped. auth is still an ancestor, so auth becomes the parent of oauth in the virtual tree.',
  };

  yield {
    state: stackGraph(
      'Move to shop and attach its marked descendants',
      ['v-root-auth', 'v-auth-login', 'v-auth-oauth', 'v-root-shop', 'v-shop-invoices', 'v-shop-checkout'],
      {
        stack: 'root/shop/checkout',
        scan: 'at checkout',
        notes: { shop: 'parent', invoices: 'done', checkout: 'top', auth: 'closed' },
      },
    ),
    highlight: { active: ['shop', 'invoices', 'checkout', 'v-root-shop', 'v-shop-invoices', 'v-shop-checkout'], compare: ['auth'] },
    explanation: 'Leaving the auth subtree pops back to root. Then shop attaches under root, and its marked descendants attach to the nearest kept ancestor shop.',
  };

  yield {
    state: stackGraph('Finish by attaching cache under root with distance 2', VIRTUAL_EDGES.map((edge) => edge.id), {
      stack: 'root/cache',
      scan: 'done',
      notes: { cache: 'last mark', root: 'parent' },
    }),
    highlight: { active: ['cache', 'root', 'v-root-cache'], found: ['scan'], compare: ['v-shop-invoices', 'v-shop-checkout'] },
    explanation: 'cache lives under search, but search is not marked and not an LCA of marked nodes. The virtual edge root -> cache records a compressed path of length two.',
  };
}

function* incidentCaseStudy() {
  yield {
    state: fullTreeGraph('Incident query marks a few services inside a much larger tree', {
      login: 'alert',
      oauth: 'alert',
      invoices: 'alert',
      checkout: 'alert',
      cache: 'alert',
      auth: 'team',
      shop: 'team',
      search: 'team',
    }),
    highlight: { active: ['login', 'oauth', 'invoices', 'checkout', 'cache'], compare: ['auth', 'shop', 'search'] },
    explanation: 'Suppose an incident page receives five affected services from traces. The ownership tree is much larger than the alert set, so scanning every subtree per incident is wasteful.',
  };

  yield {
    state: virtualGraph('Build a per-incident auxiliary tree', undefined, {
      root: 'incident root',
      auth: '2 alerts',
      shop: '2 alerts',
      cache: '1 alert',
    }),
    highlight: { active: ['login', 'oauth', 'invoices', 'checkout', 'cache'], found: ['auth', 'shop', 'root'], compare: ['v-root-auth', 'v-root-shop', 'v-root-cache'] },
    explanation: 'The incident system builds a virtual tree for just the affected services. It can now aggregate impact by ownership boundary without touching unrelated branches.',
  };

  yield {
    state: labelMatrix(
      'Postorder impact DP',
      [
        { id: 'auth', label: 'auth' },
        { id: 'shop', label: 'shop' },
        { id: 'cache', label: 'cache' },
        { id: 'root', label: 'root' },
      ],
      [{ id: 'marked', label: 'alerts' }, { id: 'rollup', label: 'rollup' }],
      [
        ['2', 'team page'],
        ['2', 'team page'],
        ['1', 'single svc'],
        ['5', 'incident'],
      ],
    ),
    highlight: { active: ['auth:rollup', 'shop:rollup'], found: ['root:marked'], compare: ['cache:marked'] },
    explanation: 'A postorder DP over the virtual tree counts marked descendants per compressed branch. The same pattern can compute minimum distance, risk score, or affected owners.',
  };

  yield {
    state: labelMatrix(
      'Per-query budget',
      [
        { id: 'prep', label: 'preprocess' },
        { id: 'sort', label: 'sort marks' },
        { id: 'lca', label: 'add LCAs' },
        { id: 'stack', label: 'stack build' },
        { id: 'dp', label: 'DP' },
      ],
      [{ id: 'cost', label: 'cost' }, { id: 'scope', label: 'scope' }],
      [
        ['O(n log n)', 'once'],
        ['O(k log k)', 'query'],
        ['O(k log n)', 'query'],
        ['O(k)', 'query'],
        ['O(k)', 'virtual'],
      ],
    ),
    highlight: { found: ['stack:cost', 'dp:cost'], active: ['sort:scope', 'lca:scope'], compare: ['prep:scope'] },
    explanation: 'The full tree pays for LCA preprocessing once. Each incident then scales with k, the number of marked services, not n, the size of the ownership tree.',
  };

  yield {
    state: labelMatrix(
      'Production checklist',
      [
        { id: 'lca', label: 'LCA' },
        { id: 'dedupe', label: 'uniq' },
        { id: 'weight', label: 'dist' },
        { id: 'clear', label: 'clear' },
        { id: 'change', label: 'rebuild' },
      ],
      [{ id: 'rule', label: 'rule' }, { id: 'bug', label: 'risk' }],
      [
        ['adj only', 'broken'],
        ['unique', 'dupes'],
        ['depth', 'no dist'],
        ['scratch', 'leaks'],
        ['new tin', 'stale'],
      ],
    ),
    highlight: { active: ['lca:rule', 'weight:rule', 'clear:rule'], found: ['change:bug'], compare: ['dedupe:bug'] },
    explanation: 'The common failures are mechanical: missing LCAs, duplicate nodes, forgetting compressed edge lengths, or reusing per-query adjacency after the query is done.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'compress nodes') yield* compressNodes();
  else if (view === 'stack build') yield* stackBuild();
  else if (view === 'incident case study') yield* incidentCaseStudy();
  else throw new InputError('Pick a virtual-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many tree problems have a large stable tree and a small query set. A filesystem audit may mark a few files, a service incident may mark a few failing services, and a contest problem may mark k special vertices inside a tree with hundreds of thousands of nodes. The answer usually depends on the connections among the marked vertices, not on every unrelated branch.',
        'A virtual tree, also called an auxiliary tree, is the standard compression for that situation. It replaces the original tree for one query with the marked vertices plus the lowest common ancestors needed to keep their ancestry relationships correct. The downstream dynamic program then runs on O(k) vertices instead of n.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The simplest answer is to run the query over the full tree and ignore branches with no marked descendants. That is easy to write, but it pays O(n) per query even when k is tiny. Repeating that for many queries loses the benefit of the static tree preprocessing.',
        'The other tempting answer is to add the LCA of every pair of marked vertices. That keeps the compressed tree connected, but it costs O(k^2) LCA calls and can dominate the query. The virtual tree trick is useful because it avoids both full-tree scanning and all-pairs closure.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'DFS order turns the tree into a line while preserving subtree intervals. If the marked vertices are sorted by Euler entry time, every branch point needed by the compressed tree appears as the LCA of two adjacent marked vertices in that order. Add those adjacent LCAs, dedupe, sort again, and the node set is closed enough to rebuild the induced ancestry tree.',
        'The edge set is then built with a stack. Scan the closed set in Euler order. The stack stores the current chain of kept ancestors. Before inserting the next vertex, pop until the stack top is an ancestor of that vertex. That top is the parent in the virtual tree.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'The original tree is preprocessed once with entry times, exit times, depths, and an LCA structure such as binary lifting or an Euler-tour RMQ. For one query, collect the k marked vertices, sort them by entry time, add LCA(marked[i], marked[i + 1]) for adjacent pairs, remove duplicates, and sort the resulting set by entry time.',
        'During the stack scan, an ancestor test usually uses tin[u] <= tin[v] and tout[v] <= tout[u]. When a parent-child relation is added in the virtual tree, the edge often stores depth[child] - depth[parent]. That distance is not cosmetic: many DPs need path length, edge weight sums, permission inheritance, or aggregate path metadata from the skipped original vertices.',
      ],
    },
    {
      heading: 'Invariants and proof shape',
      paragraphs: [
        'The closure invariant is that every branching point among marked vertices is present. In Euler order, the marked vertices inside a subtree form a contiguous block. The boundary between consecutive marked vertices is where the traversal crosses from one relevant branch to another, so the adjacent LCA exposes the needed branch point. Adding adjacent LCAs therefore includes all LCAs needed for the induced compressed tree.',
        'The construction invariant is that the stack is always an ancestor chain in the original tree. Popping removes closed subtrees. The first remaining ancestor is the nearest kept ancestor of the next node, so the virtual edge connects exactly the parent relation in the compressed tree. Because at most k - 1 adjacent LCAs are added, the closed set has at most 2k - 1 vertices before duplicates reduce it further.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'With binary lifting, preprocessing is O(n log n) time and memory. A query costs O(k log k) to sort, O(k log n) for adjacent LCA calls, O(k log k) or less to sort the closed set, O(k) to build the virtual edges, and O(k) for a typical DP. With constant-time LCA, the LCA part drops to O(k).',
        'The working memory is per-query scratch. Production implementations often keep temporary adjacency lists only for touched virtual vertices and then clear those lists after the query. Clearing the entire n-sized structure per query quietly reintroduces the cost the virtual tree was meant to avoid.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common correctness bug is missing an LCA because the marked vertices were not sorted by Euler order before adjacent pairs were considered. Another is forgetting to dedupe before the stack scan, which can create zero-length self edges or duplicate adjacency. A third is treating virtual edges as original edges and losing the skipped distance.',
        'The lifecycle bugs are just as important. If the base tree changes, the entry times and LCA table are stale. If temporary virtual adjacency is not cleared, one query leaks into the next. If the DP needs information from skipped vertices, the virtual edge must carry that information or be able to query it from a prefix structure.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Virtual trees win when the topology is stable, LCA preprocessing is reusable, and each query touches a small marked subset. Typical uses include Steiner-tree-style DP on trees, distance among special vertices, color or permission rollups, service ownership incidents, taxonomy aggregation, and batch queries on rooted hierarchies.',
        'They are especially strong when the next computation is already tree-shaped. Once the virtual tree is built, postorder and preorder DPs can be written almost the same way they would be on the original tree, just over the compressed query graph.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'A virtual tree is not the right abstraction when every query touches most of the original tree, when the tree is changing continuously, or when the answer depends on arbitrary interior vertices that cannot be summarized on compressed edges. In those cases, the compression either saves little or hides necessary state.',
        'For dynamic forests, look at Link-Cut Trees, Euler Tour Trees, or rebuild strategies. For path queries on a static tree where many path segments must be updated or queried directly, Heavy-Light Decomposition may be the more direct tool.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the compress-nodes view, first notice the five marked services in the full tree. The Euler-order table shows the move from geometry to a sorted list. The adjacent-LCA table then adds auth, root, and shop, which are exactly the branch points needed to connect the marks. The final virtual tree shows which original paths were collapsed into weighted jumps.',
        'In the stack-build view, follow the stack note rather than the whole tree. A push means the next kept vertex lies inside the current subtree. A pop means that subtree is finished. In the incident case study, read the postorder table as the reason the compression exists: ownership impact can be aggregated without scanning unrelated services.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose a company has a rooted ownership tree with thousands of teams and services. An incident marks five affected leaf services. The virtual tree adds the common team ancestors and the root organization, then runs a postorder DP over the compressed tree to count affected descendants by owner.',
        'The same virtual edges can also carry escalation distance, blast-radius weights, or policy metadata. A dashboard can show that auth owns two alerts, shop owns two alerts, and a cache service is isolated under a different branch, all without traversing unaffected parts of the organization tree for this incident.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: USACO Guide Virtual Tree at https://usaco.guide/plat/VT, OI Wiki virtual tree at https://oi-wiki.org/graph/virtual-tree/, CP-Algorithms binary-lifting LCA at https://cp-algorithms.com/graph/lca_binary_lifting.html, and CP-Algorithms LCA overview at https://cp-algorithms.com/graph/lca.html.',
        'Study Rerooting DP: All Roots Tree DP, Binary Lifting LCA, Tree Traversals, Heavy-Light Decomposition, Centroid Decomposition, Small-to-Large Merging & DSU on Tree, Euler Tour Tree, and Link-Cut Tree next. Virtual trees are the bridge between static tree ancestry and fast per-query tree DP.',
      ],
    },
  ],
};
