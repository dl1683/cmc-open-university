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
      heading: 'What it is',
      paragraphs: [
        'A virtual tree, also called an auxiliary tree, is a compressed tree built for one query over a subset of marked nodes. It keeps the marked nodes and the lowest common ancestors needed to preserve their relationships, then connects them with weighted edges that stand for skipped paths in the original tree.',
        'This is not a new persistent copy of the whole tree. It is a per-query working structure. If the original tree has n nodes but a query marks only k nodes, the virtual tree has O(k) nodes after LCA closure and deduplication.',
        'Virtual trees are useful when many offline or batched queries touch small subsets of a large static tree: service ownership incidents, permission checks over selected folders, taxonomy rollups, Steiner-style DP, and marked-node distance problems.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Preprocess the original tree with DFS entry times, depths, and an LCA structure such as Binary Lifting LCA. For one query, sort the marked nodes by Euler entry time. Add the LCA of every adjacent pair in that sorted order, then dedupe and sort again.',
        'The stack build scans that closed set in Euler order. While the top of the stack is not an ancestor of the next node, pop. The remaining top is the nearest kept ancestor, so add a virtual edge from top to node with weight depth[node] - depth[top], then push the node.',
        'The adjacent-LCA trick is why the structure stays small. You do not need all pairwise LCAs. Once marked nodes are sorted by Euler order, LCAs of neighboring marked nodes are enough to recover the branch points of the induced compressed tree.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With binary lifting, preprocessing is O(n log n). Per query, sorting marked nodes costs O(k log k), adjacent LCA calls cost O(k log n), stack construction costs O(k), and any postorder DP over the virtual tree costs O(k). With O(1) LCA preprocessing, the LCA part can be O(k).',
        'The virtual tree has at most 2k - 1 nodes after adding LCAs and deduping, assuming k marked nodes. That bound is the reason the method is powerful: every unmarked background branch vanishes unless it is needed as a branch point.',
        'Memory should be treated as per-query scratch space. Production implementations often use arrays of touched node ids so they can clear only the temporary adjacency lists that were used, rather than sweeping the whole n-node tree after every query.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a large service ownership tree. Every service belongs to a team, every team rolls up to an organization, and incidents arrive as a small set of affected services from traces. The incident dashboard needs affected-owner counts and distance-weighted blast radius. Rewalking the whole ownership tree for every incident wastes time and loads cold metadata.',
        'A virtual tree makes each incident local. Mark the affected services, add adjacent LCAs such as the owning teams and root organization, build the virtual tree, then run a postorder DP. The result says auth owns two affected services, shop owns two, cache is isolated under search, and the incident root sees five total affected services. The system can also keep compressed edge weights to estimate escalation distance.',
        'The same pattern applies to permission analysis in a file tree. Mark the files selected by a policy audit, add folder LCAs, and run DP only on the compressed folder/file tree. The algorithm keeps enough folder structure to explain inherited permissions without scanning unrelated directories.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The edge in a virtual tree is usually not an original edge. It may represent a path through skipped nodes, so store depth differences or path aggregates when the downstream DP needs distances, costs, permissions, or capacities.',
        'Do not add LCAs of all pairs unless the query is tiny. That destroys the point of the method. Sort by Euler order and add adjacent LCAs. Also dedupe aggressively: the same LCA can appear many times, especially the root.',
        'Virtual trees assume a stable rooted tree during the query batch. If the topology changes, entry times and LCA tables can become stale. For online link/cut topology changes, study Euler Tour Tree and Link-Cut Tree instead.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: USACO Guide Virtual Tree at https://usaco.guide/plat/VT, OI Wiki virtual tree at https://oi-wiki.org/graph/virtual-tree/, CP-Algorithms binary-lifting LCA at https://cp-algorithms.com/graph/lca_binary_lifting.html, and CP-Algorithms LCA overview at https://cp-algorithms.com/graph/lca.html.',
        'Study Rerooting DP: All Roots Tree DP, Binary Lifting LCA, Tree Traversals, Heavy-Light Decomposition, Centroid Decomposition, Small-to-Large Merging & DSU on Tree, Euler Tour Tree, and Link-Cut Tree next. Virtual trees are the bridge between static tree ancestry and fast per-query tree DP.',
      ],
    },
  ],
};
