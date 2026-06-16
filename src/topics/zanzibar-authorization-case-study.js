// Zanzibar case study: global authorization with relationship tuples,
// namespace configs, recursive checks, caveats around freshness, and zookies.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'zanzibar-authorization-case-study',
  title: 'Zanzibar Authorization Case Study',
  category: 'Papers',
  summary: 'Google Zanzibar as an authorization-system lesson: relation tuples, recursive checks, consistency tokens, and graph-shaped permissions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['relationship graph', 'consistency and zookies'], defaultValue: 'relationship graph' },
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

function relationGraph(title) {
  return graphState({
    nodes: [
      { id: 'alice', label: 'alice', x: 0.9, y: 4.0, note: 'user' },
      { id: 'team', label: 'team:ml', x: 2.6, y: 2.6, note: 'group' },
      { id: 'folder', label: 'folder:F', x: 4.6, y: 2.6, note: 'parent' },
      { id: 'doc', label: 'doc:D', x: 6.6, y: 4.0, note: 'object' },
      { id: 'bob', label: 'bob', x: 2.6, y: 5.4, note: 'direct user' },
      { id: 'public', label: 'public', x: 4.6, y: 5.4, note: 'special set' },
      { id: 'check', label: 'check?', x: 8.5, y: 4.0, note: 'can view doc D' },
    ],
    edges: [
      { id: 'e-alice-team', from: 'alice', to: 'team', weight: 'member' },
      { id: 'e-team-folder', from: 'team', to: 'folder', weight: 'viewer' },
      { id: 'e-folder-doc', from: 'folder', to: 'doc', weight: 'parent grants' },
      { id: 'e-bob-doc', from: 'bob', to: 'doc', weight: 'owner' },
      { id: 'e-public-doc', from: 'public', to: 'doc', weight: 'maybe viewer' },
      { id: 'e-doc-check', from: 'doc', to: 'check', weight: 'evaluate' },
    ],
  }, { title });
}

function* relationshipGraphView() {
  yield {
    state: relationGraph('Authorization as a relationship graph'),
    highlight: { active: ['alice', 'team', 'folder', 'doc'], compare: ['bob', 'public'] },
    explanation: 'Zanzibar stores authorization as relationship tuples: user U has relation R to object O. Permissions are computed by walking and rewriting a graph: Alice is a member of team:ml, team:ml is viewer on folder:F, folder:F grants view on doc:D.',
  };

  yield {
    state: labelMatrix(
      'Relation tuples are the data model',
      [
        { id: 't1', label: 'tuple 1' },
        { id: 't2', label: 'tuple 2' },
        { id: 't3', label: 'tuple 3' },
        { id: 't4', label: 'tuple 4' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'relation', label: 'relation' },
        { id: 'user', label: 'user or userset' },
      ],
      [
        ['team:ml', 'member', 'user:alice'],
        ['folder:F', 'viewer', 'team:ml#member'],
        ['doc:D', 'parent', 'folder:F'],
        ['doc:D', 'owner', 'user:bob'],
      ],
    ),
    highlight: { active: ['t1:user', 't2:user', 't3:object'], found: ['t4:relation'] },
    explanation: 'The userset idea is what makes the model powerful. A tuple can point to a concrete user or to another relation such as team:ml#member. That makes groups, folders, organizations, sharing links, and inherited permissions one uniform graph problem.',
    invariant: 'Authorization is data plus schema, not hand-coded if statements in every service.',
  };

  yield {
    state: relationGraph('A check recursively expands usersets'),
    highlight: { found: ['alice', 'team', 'folder', 'doc', 'check'], active: ['e-alice-team', 'e-team-folder', 'e-folder-doc', 'e-doc-check'] },
    explanation: 'A check request asks whether a subject has a permission on an object. Zanzibar expands the relation definition, follows tuples, and stops when it proves or disproves membership. This connects to Graph BFS and Finite State Machines, but the stakes are privacy and security.',
  };
}

function* consistencyAndZookies() {
  yield {
    state: labelMatrix(
      'Freshness matters for permissions',
      [
        { id: 'grant', label: 'grant access' },
        { id: 'check1', label: 'check soon after grant' },
        { id: 'revoke', label: 'revoke access' },
        { id: 'check2', label: 'check soon after revoke' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'need', label: 'system need' },
        { id: 'link', label: 'study link' },
      ],
      [
        ['stale deny', 'read fresh enough', 'Spanner Case Study'],
        ['user blocked wrongly', 'causal token', 'Clocks & Ordering: Lamport to TrueTime'],
        ['stale allow', 'privacy violation', 'Transaction Isolation Levels'],
        ['user still sees doc', 'bounded freshness', 'Distributed Tracing'],
      ],
    ),
    highlight: { removed: ['check2:risk'], active: ['revoke:need'], found: ['grant:link'] },
    explanation: 'Authorization freshness is asymmetric. A stale deny after a grant is annoying; a stale allow after a revoke can be a privacy incident. Zanzibar therefore has to expose consistency choices instead of hiding replication delay.',
  };

  yield {
    state: labelMatrix(
      'Zookie: a consistency token carried by clients',
      [
        { id: 'write', label: 'write tuple' },
        { id: 'token', label: 'receive zookie' },
        { id: 'check', label: 'later check' },
        { id: 'serve', label: 'serve content' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['doc:D viewer alice', 'relation changed'],
        ['zookie >= t42', 'at least this fresh'],
        ['check with zookie', 'do not answer older'],
        ['allow/deny', 'fresh enough decision'],
      ],
    ),
    highlight: { active: ['token:data', 'check:data'], found: ['serve:meaning'] },
    explanation: 'A zookie is a consistency token. After a client observes a permissions write, it can carry the zookie into later authorization checks so the system does not answer from a snapshot older than the observed change.',
    invariant: 'The permission answer must be fresh enough for the caller context.',
  };

  yield {
    state: labelMatrix(
      'Why Zanzibar is a systems composition',
      [
        { id: 'model', label: 'relation tuples' },
        { id: 'graph', label: 'recursive checks' },
        { id: 'storage', label: 'global storage' },
        { id: 'cache', label: 'caching' },
        { id: 'trace', label: 'auditability' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'site', label: 'study link' },
      ],
      [
        ['uniform auth data', 'Hash Table'],
        ['userset expansion', 'Graph BFS'],
        ['consistent snapshots', 'Spanner Case Study'],
        ['low-latency checks', 'Cache Invalidation & Versioning'],
        ['explain access decision', 'Distributed Tracing'],
      ],
    ),
    highlight: { found: ['storage:site', 'cache:site'], active: ['graph:mechanism'] },
    explanation: 'Zanzibar is not just an ACL table. It is a graph evaluator, schema language, replicated storage system, cache hierarchy, and consistency contract, all aimed at one question: is this access allowed right now?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'relationship graph') yield* relationshipGraphView();
  else if (view === 'consistency and zookies') yield* consistencyAndZookies();
  else throw new InputError('Pick a Zanzibar view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Zanzibar is Google\'s global authorization system. It stores relationship tuples and evaluates authorization checks for many products, including systems with billions of objects and users. It provides one data model and configuration language for a wide range of access-control policies.',
        'The case study matters because authorization is not just a boolean function. It is graph traversal, schema design, caching, replication, consistency, latency, and auditability under privacy constraints.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The core data model is a relation tuple: object, relation, user or userset. A userset can refer to another relation, such as group:eng#member. Namespace configuration defines how relations imply permissions. A check request recursively expands those definitions and relation tuples until it can answer allow or deny.',
        'Zanzibar also exposes freshness through consistency tokens called zookies. A client that observes a permission update can require later checks to be at least that fresh, which prevents stale authorization answers in important flows.',
        'The schema is the other half of the system. Tuples are facts, but namespace definitions say how those facts compose: owner may imply editor, editor may imply viewer, parent folders may grant inherited view, and group membership may expand into many users. That makes authorization a query over a typed relationship graph rather than scattered service-specific if statements.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The hard parts are recursion depth, hot groups, cycles, cache invalidation, consistency choices, and debugging why access was allowed or denied. Low latency pushes aggressive caching, but revocation safety pushes freshness. A production authorization system has to make that trade visible and auditable.',
        'Large deployments need more than a fast check endpoint. They need bulk list APIs for "which documents can Alice see?", explain APIs for "why was Alice allowed?", bounded-depth or bounded-cost traversal, tuple-change streams for cache invalidation, and operational dashboards that separate schema bugs from storage lag. The new-enemy problem is the classic failure: a permission change should not let a user see content through a stale snapshot after access was revoked.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Zanzibar-style authorization has influenced OpenFGA, SpiceDB, Authzed, cloud IAM systems, collaboration products, document sharing, enterprise SaaS permissions, and fine-grained authorization design. The relation-tuple model is now one of the dominant ways to explain modern authorization systems.',
        'The model is especially relevant to AI systems that retrieve private documents. A RAG system should not retrieve first and ask the model to ignore unauthorized text later. It should pre-filter or post-filter candidates using relationship checks, then log the authorization path that allowed each document into context. That links Zanzibar directly to Multi-Index RAG, Prompt Injection Threat Model, Model Context Protocol, and enterprise search.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A Zanzibar-style model does not remove the need for product-specific policy judgment. It gives a uniform engine for representing and checking relationships. Bad namespace design can still create privilege escalation, unbounded recursion, confusing inheritance, or expensive checks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "Zanzibar: Google\'s Consistent, Global Authorization System" at https://www.usenix.org/system/files/atc19-pang.pdf and Google Research overview at https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/. Current descendants and implementation references include OpenFGA concepts at https://openfga.dev/docs/concepts, OpenFGA relationship queries at https://openfga.dev/docs/interacting/relationship-queries, SpiceDB schema docs at https://authzed.com/docs/spicedb/concepts/schema, and SpiceDB relationship docs at https://authzed.com/docs/spicedb/concepts/relationships. Study Graph BFS, Cache Invalidation & Versioning, Spanner Case Study, Distributed Tracing, Transaction Isolation Levels, Capability Security & Attenuation, OPA Rego Policy Decision Graph, UCAN Delegation Proof Chain, and Clocks & Ordering: Lamport to TrueTime next.',
      ],
    },
  ],
};
