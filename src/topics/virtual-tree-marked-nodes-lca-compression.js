// Virtual tree / auxiliary tree: compress marked tree queries to marked nodes plus LCAs.

import { graphState, matrixState, InputError } from '../core/state.js';

const r2 = (v) => Math.round(v * 100) / 100;

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
  const markedIds = ['login', 'oauth', 'invoices', 'checkout', 'cache'];
  const markedCount = markedIds.length;
  const lcaIds = ['auth', 'root', 'shop'];
  const lcaCount = lcaIds.length;
  const tinValues = [3, 4, 8, 10, 13];

  yield {
    state: fullTreeGraph('Start with a large rooted tree and a small marked set', {
      login: 'marked',
      oauth: 'marked',
      invoices: 'marked',
      checkout: 'marked',
      cache: 'marked',
    }),
    highlight: { active: ['login', 'oauth', 'invoices', 'checkout', 'cache'], compare: ['root'] },
    explanation: `A virtual tree starts from a query subset. Here the original service tree has ${FULL_NODES.length} nodes, but the incident touches only ${markedCount} marked services.`,
    invariant: `Only ${markedCount} marked nodes and LCAs that preserve their ancestry relationships are needed for this query.`,
  };

  yield {
    state: labelMatrix(
      `Sort ${markedCount} marked nodes by Euler entry time`,
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
    explanation: `Euler order turns the tree geometry into a linear scan. Adjacent marked nodes in this order (tin ${tinValues.join(', ')}) reveal the LCAs needed to keep the compressed tree connected.`,
  };

  yield {
    state: labelMatrix(
      `Add LCAs of ${markedCount - 1} adjacent marked pairs`,
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
        [`${VIRTUAL_NODES.length} nodes`, 'sort again'],
      ],
    ),
    highlight: { active: ['p1:lca', 'p2:lca', 'p3:lca'], found: ['done:action'], compare: ['p4:action'] },
    explanation: `The closure step adds ${lcaIds.join(', ')}. After deduplication, the virtual tree has ${VIRTUAL_NODES.length} nodes rather than the full ${FULL_NODES.length}-node original tree.`,
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
    explanation: `Each of the ${VIRTUAL_EDGES.length} virtual edges may stand for a whole original path. The edge weight stores the skipped distance, so later dynamic programming does not lose path length.`,
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
        [`n=${FULL_NODES.length}`, 'all'],
        [`k=${markedCount}`, 'set'],
        [`<=${2 * markedCount - 1}`, 'closed'],
        ['O(k)', 'run'],
      ],
    ),
    highlight: { found: ['virtual:size', 'query:size'], compare: ['orig:size'] },
    explanation: `The useful bound is structural: after adding ${markedCount - 1} adjacent LCAs and deduping, a virtual tree has at most ${2 * markedCount - 1} nodes (here ${VIRTUAL_NODES.length}). Large background subtrees disappear from the query.`,
  };
}

function* stackBuild() {
  const scanOrder = VIRTUAL_NODES.map((n) => n.id);
  const cacheEdge = VIRTUAL_EDGES.find((e) => e.to === 'cache');
  const cacheDistance = cacheEdge ? cacheEdge.weight : '?';

  yield {
    state: stackGraph(`Scan the ${VIRTUAL_NODES.length} closed nodes in Euler order`, [], {
      stack: 'empty',
      scan: `${scanOrder[0]} ${scanOrder[1]} ${scanOrder[2]} ...`,
      notes: { root: 'first' },
    }),
    highlight: { active: ['scan', 'root'], compare: ['stack'] },
    explanation: `After sorting ${VIRTUAL_NODES.length} nodes (marked plus LCAs) by tin, the stack algorithm builds parent-child links between nearest kept ancestors.`,
    invariant: `The stack always stores a chain of ancestors in the original ${FULL_NODES.length}-node tree.`,
  };

  yield {
    state: stackGraph(`Push ${scanOrder[0]}, ${scanOrder[1]}, then ${scanOrder[2]}`, ['v-root-auth', 'v-auth-login'], {
      stack: `${scanOrder[0]}/${scanOrder[1]}/${scanOrder[2]}`,
      scan: `at ${scanOrder[2]}`,
      notes: { root: 'ancestor', auth: 'ancestor', login: 'top' },
    }),
    highlight: { active: ['root', 'auth', 'login', 'v-root-auth', 'v-auth-login'], found: ['stack'] },
    explanation: `When the next node is inside the subtree of the stack top, connect it as a child and push it. ${scanOrder[0]} -> ${scanOrder[1]} -> ${scanOrder[2]} is a clean ancestor chain.`,
  };

  yield {
    state: stackGraph(`Process ${scanOrder[3]} by popping ${scanOrder[2]} back to ${scanOrder[1]}`, ['v-root-auth', 'v-auth-login', 'v-auth-oauth'], {
      stack: `${scanOrder[0]}/${scanOrder[1]}/${scanOrder[3]}`,
      scan: `at ${scanOrder[3]}`,
      notes: { login: 'popped', auth: 'parent', oauth: 'new top' },
    }),
    highlight: { active: ['auth', 'oauth', 'v-auth-oauth'], removed: ['login'], compare: ['stack'] },
    explanation: `${scanOrder[3]} is not inside ${scanOrder[2]}, so ${scanOrder[2]} is popped. ${scanOrder[1]} is still an ancestor, so ${scanOrder[1]} becomes the parent of ${scanOrder[3]} in the virtual tree.`,
  };

  yield {
    state: stackGraph(
      `Move to ${scanOrder[4]} and attach its marked descendants`,
      ['v-root-auth', 'v-auth-login', 'v-auth-oauth', 'v-root-shop', 'v-shop-invoices', 'v-shop-checkout'],
      {
        stack: `${scanOrder[0]}/${scanOrder[4]}/${scanOrder[6]}`,
        scan: `at ${scanOrder[6]}`,
        notes: { shop: 'parent', invoices: 'done', checkout: 'top', auth: 'closed' },
      },
    ),
    highlight: { active: ['shop', 'invoices', 'checkout', 'v-root-shop', 'v-shop-invoices', 'v-shop-checkout'], compare: ['auth'] },
    explanation: `Leaving the ${scanOrder[1]} subtree pops back to ${scanOrder[0]}. Then ${scanOrder[4]} attaches under ${scanOrder[0]}, and its marked descendants (${scanOrder[5]}, ${scanOrder[6]}) attach to the nearest kept ancestor ${scanOrder[4]}.`,
  };

  yield {
    state: stackGraph(`Finish by attaching ${scanOrder[7]} under ${scanOrder[0]} with distance ${cacheDistance}`, VIRTUAL_EDGES.map((edge) => edge.id), {
      stack: `${scanOrder[0]}/${scanOrder[7]}`,
      scan: 'done',
      notes: { cache: 'last mark', root: 'parent' },
    }),
    highlight: { active: ['cache', 'root', 'v-root-cache'], found: ['scan'], compare: ['v-shop-invoices', 'v-shop-checkout'] },
    explanation: `${scanOrder[7]} lives under search, but search is not marked and not an LCA of marked nodes. The virtual edge ${scanOrder[0]} -> ${scanOrder[7]} records a compressed path of length ${cacheDistance}. All ${VIRTUAL_EDGES.length} edges are now built.`,
  };
}

function* incidentCaseStudy() {
  const alertServices = ['login', 'oauth', 'invoices', 'checkout', 'cache'];
  const alertCount = alertServices.length;
  const teamNodes = ['auth', 'shop', 'search'];
  const authAlerts = alertServices.filter((s) => s === 'login' || s === 'oauth').length;
  const shopAlerts = alertServices.filter((s) => s === 'invoices' || s === 'checkout').length;
  const cacheAlerts = alertServices.filter((s) => s === 'cache').length;
  const totalRollup = authAlerts + shopAlerts + cacheAlerts;
  const checklistItems = 5;

  yield {
    state: fullTreeGraph(`Incident query marks ${alertCount} services inside a ${FULL_NODES.length}-node tree`, {
      login: 'alert',
      oauth: 'alert',
      invoices: 'alert',
      checkout: 'alert',
      cache: 'alert',
      auth: 'team',
      shop: 'team',
      search: 'team',
    }),
    highlight: { active: alertServices, compare: teamNodes },
    explanation: `Suppose an incident page receives ${alertCount} affected services (${alertServices.join(', ')}) from traces. The ownership tree has ${FULL_NODES.length} nodes, so scanning every subtree per incident is wasteful.`,
  };

  yield {
    state: virtualGraph(`Build a ${VIRTUAL_NODES.length}-node per-incident auxiliary tree`, undefined, {
      root: 'incident root',
      auth: `${authAlerts} alerts`,
      shop: `${shopAlerts} alerts`,
      cache: `${cacheAlerts} alert`,
    }),
    highlight: { active: alertServices, found: ['auth', 'shop', 'root'], compare: ['v-root-auth', 'v-root-shop', 'v-root-cache'] },
    explanation: `The incident system builds a virtual tree with ${VIRTUAL_NODES.length} nodes and ${VIRTUAL_EDGES.length} edges for just the ${alertCount} affected services. It can now aggregate impact by ownership boundary without touching unrelated branches.`,
  };

  yield {
    state: labelMatrix(
      `Postorder impact DP over ${VIRTUAL_NODES.length} virtual nodes`,
      [
        { id: 'auth', label: 'auth' },
        { id: 'shop', label: 'shop' },
        { id: 'cache', label: 'cache' },
        { id: 'root', label: 'root' },
      ],
      [{ id: 'marked', label: 'alerts' }, { id: 'rollup', label: 'rollup' }],
      [
        [`${authAlerts}`, 'team page'],
        [`${shopAlerts}`, 'team page'],
        [`${cacheAlerts}`, 'single svc'],
        [`${totalRollup}`, 'incident'],
      ],
    ),
    highlight: { active: ['auth:rollup', 'shop:rollup'], found: ['root:marked'], compare: ['cache:marked'] },
    explanation: `A postorder DP over the ${VIRTUAL_NODES.length}-node virtual tree counts marked descendants per compressed branch. auth rolls up ${authAlerts}, shop rolls up ${shopAlerts}, root totals ${totalRollup}.`,
  };

  yield {
    state: labelMatrix(
      `Per-query budget (n=${FULL_NODES.length}, k=${alertCount})`,
      [
        { id: 'prep', label: 'preprocess' },
        { id: 'sort', label: 'sort marks' },
        { id: 'lca', label: 'add LCAs' },
        { id: 'stack', label: 'stack build' },
        { id: 'dp', label: 'DP' },
      ],
      [{ id: 'cost', label: 'cost' }, { id: 'scope', label: 'scope' }],
      [
        [`O(n log n)`, 'once'],
        [`O(k log k)`, 'query'],
        [`O(k log n)`, 'query'],
        [`O(k)`, 'query'],
        [`O(k)`, 'virtual'],
      ],
    ),
    highlight: { found: ['stack:cost', 'dp:cost'], active: ['sort:scope', 'lca:scope'], compare: ['prep:scope'] },
    explanation: `The full ${FULL_NODES.length}-node tree pays for LCA preprocessing once. Each incident then scales with k=${alertCount}, the number of marked services, not n=${FULL_NODES.length}.`,
  };

  yield {
    state: labelMatrix(
      `Production checklist (${checklistItems} items)`,
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
    explanation: `The ${checklistItems} common failures are mechanical: missing LCAs, duplicate nodes, forgetting ${VIRTUAL_EDGES.length} compressed edge lengths, or reusing per-query adjacency after the query is done.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The compression view starts with a large rooted tree and a small set of marked nodes. A marked node is relevant to the query; unmarked branches matter only if they contain an ancestor needed to connect marked nodes correctly.',
        {type: 'image', src: './assets/gifs/virtual-tree-marked-nodes-lca-compression.gif', alt: 'Animated walkthrough of the virtual tree marked nodes lca compression visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference is lowest-common-ancestor closure. If marked nodes are sorted by Euler entry time, the LCAs of adjacent marked nodes are enough to expose the branch points needed for the compressed tree.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many tree problems have a huge stable tree and a small query set. A service incident, filesystem audit, taxonomy rollup, or programming-contest query may mark only k nodes inside a tree with hundreds of thousands of vertices.',
        {type: 'callout', text: 'A virtual tree keeps exactly the ancestors needed to preserve relationships among marked nodes, then lets the query run on the compressed shape.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'The compression problem starts as reachability and ancestry in a directed rooted graph. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'A virtual tree exists so the per-query computation runs on O(k) relevant vertices instead of O(n) original vertices. It preserves ancestry among the marked nodes while collapsing irrelevant paths into weighted edges.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run the query on the whole tree and ignore branches that do not contain marked nodes. That is easy to write and correct, but it costs O(n) per query.',
        'A second approach is to add the LCA of every pair of marked nodes. That preserves connectivity, but it costs O(k squared) LCA calls and can be slower than the original query when k is large.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated work over irrelevant structure. If n = 200,000 and k = 30, scanning the whole tree for each query spends most of its time proving that unrelated branches do not matter.',
        'All-pairs LCA has a different wall. With k = 30 it needs 435 pairs, but with k = 10,000 it needs about 50 million pairs, even though the compressed tree can have at most about 2k - 1 useful vertices.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that Euler order turns subtree ancestry into intervals. Marked vertices in the same branch appear close together, and the boundary between adjacent marked vertices exposes the LCA where relevant branches meet.',
        'After adding LCAs of adjacent marked nodes, sorting and deduping gives the closed vertex set. A stack scan over that set rebuilds parent-child relations in the compressed tree.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Preprocess the base tree with tin, tout, depth, and an LCA structure such as binary lifting. For one query, sort marked nodes by tin and add lca(marked[i], marked[i + 1]) for each adjacent pair.',
        'Deduplicate the combined set and sort it by tin again. Scan it with a stack whose contents are always an ancestor chain; pop until the top is an ancestor of the next node, then add a virtual edge from that top to the next node.',
        'The virtual edge usually stores distance depth[child] - depth[parent]. If the downstream DP needs path sums or policy metadata from skipped vertices, the edge must also carry that aggregate or a way to query it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The closure proof uses the Euler interval property. For any branching point needed to connect marked nodes, there are marked descendants in at least two child subtrees, and the transition between those descendants appears between adjacent marked nodes in Euler order.',
        'The stack proof uses the ancestor-chain invariant. When the next closed vertex arrives, every popped vertex belongs to a finished subtree, and the first remaining ancestor is the nearest kept ancestor, so the emitted virtual edge is the correct compressed parent relation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Preprocessing with binary lifting costs O(n log n) time and memory. A query costs O(k log k) for sorting, O(k log n) for adjacent LCA calls, O(k) for stack construction, and O(k) for a typical DP.',
        'Cost behaves with the marked set, not the whole tree. If k doubles, query work roughly doubles after sorting; if n doubles but k stays fixed, the query cost barely changes except for the LCA table depth.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Virtual trees are common in competitive programming for Steiner-tree-style DP, distance among special vertices, color aggregation, and repeated marked-subset queries on a static tree. They are also a practical model for incident trees and ownership hierarchies.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of server racks in a datacenter', caption: 'Incident trees often summarize real production infrastructure; the virtual tree keeps the affected branches without walking every service. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg.'},
        'They work best when the base topology is stable and many queries reuse the same preprocessing. Once built, the compressed tree can be processed with ordinary tree DP patterns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The structure is weak when every query marks most of the original tree. In that case compression saves little and adds sorting, LCA, and scratch-adjacency overhead.',
        'It is also wrong when the base tree changes frequently or when skipped interior vertices contain information that cannot be summarized on an edge. Dynamic forests need link-cut trees, Euler-tour trees, heavy-light decomposition, or rebuild strategies instead.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose marked nodes have Euler order [7, 11, 18, 22, 31]. Adjacent LCAs are lca(7,11)=4, lca(11,18)=1, lca(18,22)=16, and lca(22,31)=1.',
        'The closed set is {1, 4, 7, 11, 16, 18, 22, 31}, only 8 vertices instead of the full tree. If the original tree has 100,000 vertices, the query now runs on 8 compressed vertices plus edge distances.',
        'During the stack scan, 1 becomes the root, 4 is attached under 1, 7 and 11 under 4, 16 under 1, and 18 and 22 under 16, while 31 attaches at its nearest kept ancestor. The compressed tree preserves all marked ancestry relationships without scanning unrelated branches.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study USACO Guide Virtual Tree, OI Wiki virtual tree, CP-Algorithms binary lifting LCA, and CP-Algorithms LCA overview. These sources show the standard adjacent-LCA closure and stack construction used in contests and static-tree query engines.',
        'Study Euler tours, binary lifting, RMQ-based LCA, tree DP, heavy-light decomposition, centroid decomposition, DSU on tree, Euler-tour trees, and link-cut trees next. The main lesson is to pay query cost for the relevant marked topology, not for the full base tree every time.',
      ],
    },
  ],
};
