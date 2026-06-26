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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as an authorization check over a relationship graph. Active nodes are the relation or tuple being evaluated now, compare nodes are possible paths not yet proven, and found nodes are paths that already justify access. A safe inference is this: an allow decision is valid only if a path from subject to permission exists in the chosen snapshot.',
        'A tuple is one stored relationship, such as document D has viewer team ML. A userset is a set of users named by a relation, such as the members of team ML. A zookie is an opaque freshness token that tells the checker how new the snapshot must be.',
        {type: 'callout', text: 'Zanzibar turns authorization into relationship graph evaluation with explicit freshness, so access is a data and consistency problem rather than scattered service logic.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern products have permissions that depend on relationships. Alice can view a document because she belongs to a group, the group can view a folder, and the folder contains the document. That is not a single role on Alice; it is a path through data.',
        'Zanzibar exists because every service writing its own permission logic creates inconsistent answers. A revoke that reaches Drive but not Photos would be a privacy bug. The system needs one data model, one checker, and one consistency contract for many products.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to put access-control lists in each product database. A document service checks document rows, a group service checks membership rows, and a sharing service checks link rows. This starts simple because each team owns its own tables.',
        'The approach weakens when policies compose. A document permission may depend on a folder, a group, and an organization rule. If each service caches one piece differently, the final answer can be fast but wrong.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is stale permission after change. If Bob is removed from team ML at 10:00 and can still read a confidential document at 10:01 because one cache is old, the system has failed. Authorization cannot treat freshness as an afterthought.',
        'The other wall is negative proof. To deny Bob, the checker must fail to find any valid path under the schema, not only fail one direct lookup. Deep groups and inherited folders make that search expensive unless the data model and cache keys are built for it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to store permissions as relationship tuples and evaluate access as graph reachability. A tuple has an object, a relation, and a subject or userset. For example, doc:Q has parent folder:F, folder:F has viewer team:ML#member, and team:ML has member user:alice.',
        'Schema defines how relations imply permissions. Owner may imply editor, editor may imply viewer, and parent folders may grant inherited viewing. The checker follows those rules until it either finds the user in the target userset or exhausts the valid paths.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A check request names a subject, an object, a permission, and a freshness requirement. For can Alice view doc Q, the checker expands the view permission for doc Q. It tries direct viewers, implied editors, inherited parent viewers, and usersets named by tuples.',
        'If the checker reaches team:ML#member, it recursively checks whether Alice belongs to that userset. Cache entries can store subproblem answers, but each answer must be tied to a snapshot or freshness rule. The zookie lets a client say that a later check must be at least as fresh as a write it already observed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from separating policy meaning from product code. The schema says which paths count, the tuple store says which relationships exist, and the checker applies the same traversal rule for every service. If a path exists in the required snapshot, allow is justified by data rather than by scattered if statements.',
        'Freshness is part of correctness. A cached allow from an old snapshot is not correct after a revoke that the user flow has observed. By making the snapshot requirement explicit, Zanzibar can trade latency against consistency without hiding that trade inside a cache.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main time cost is graph fanout. If a document inherits from 5 folders and each folder points to 20 groups, a check can create 100 membership subchecks before caching. A deny can be more expensive than an allow because the engine must rule out every valid path within the budget.',
        'The space cost is tuples, indexes, cached subproblems, and consistency metadata. Doubling the number of relationships roughly doubles the stored tuple data, but it can more than double hot-check load if schema fanout grows too. Production systems need depth limits, cycle handling, and explain traces for expensive answers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Zanzibar-style systems fit document sharing, cloud IAM, enterprise SaaS permissions, media libraries, organization membership, and fine-grained authorization platforms such as OpenFGA and SpiceDB. The common shape is relationship-based access control, where access depends on edges between objects and users. A global role table is too coarse for that shape.',
        'The same model matters for retrieval-augmented generation. A search system should not fetch private documents and hope the model ignores them. It should filter candidates through authorization before text enters context, then log which relationship path allowed each document.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when policy is not really graph-shaped. A rule such as allow only during business hours from a managed device is attribute and context logic, not just relationship reachability. A Zanzibar-style checker may need to work beside a policy engine rather than replace it.',
        'It also fails under bad schema design. A relation can imply too much, a parent edge can inherit farther than intended, and a public-link relation can bypass a product rule. The checker can evaluate the schema faithfully while the schema itself encodes the wrong policy.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose doc:Q has parent folder:F, folder:F has viewer team:ML#member, and team:ML has member user:alice. The check can alice view doc:Q starts at doc:Q view, follows parent to folder:F, follows viewer to team:ML#member, and then finds Alice in team ML. That four-edge path is the reason for allow.',
        'Now remove Alice from team ML at tuple version 50. If a later read carries a zookie requiring version at least 50, a checker using snapshot 49 cannot safely answer allow. It must read a fresher snapshot or fail the consistency requirement, because the old path may no longer exist.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Pang et al., Zanzibar: Google\'s Consistent, Global Authorization System, at https://www.usenix.org/conference/atc19/presentation/pang. Then read OpenFGA and SpiceDB documentation as implementation descendants, while keeping the paper as the primary system design source.',
        'Study Graph BFS for reachability, Cache Invalidation for stale answers, Spanner Case Study for globally consistent storage, OPA Rego Policy Decision Graph for rule-based policy, and UCAN Delegation Proof Chain for a contrasting capability model.',
      ],
    },
  ],
};
