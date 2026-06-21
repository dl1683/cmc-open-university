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
        "Read the animation as the execution trace for Zanzibar Authorization Case Study. Google Zanzibar as an authorization-system lesson: relation tuples, recursive checks, consistency tokens, and graph-shaped permissions..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type: "callout", text: "Zanzibar turns authorization into relationship graph evaluation with explicit freshness, so access is a data and consistency problem rather than scattered service logic."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Zanzibar exists because modern authorization is too large and too subtle for scattered if statements. A collaboration product may have users, groups, folders, documents, organizations, public links, inherited permissions, owners, editors, viewers, and temporary grants. A single page load can need many access checks, and a single revocation can become a privacy incident if stale permissions are accepted.`,
        `The core problem is not only deciding allow or deny. It is deciding allow or deny for billions of objects, across many services, with low latency, explainable policy, global replication, cache pressure, and consistency requirements after grants and revokes. Zanzibar is the case study that turns fine-grained authorization into a systems problem: data model, schema language, recursive graph evaluation, consistency tokens, storage, caching, and operational audit all have to work together.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The naive approach is to put authorization logic inside each service. A document service has an ACL table. A folder service has inheritance rules. A team service has group membership. A sharing service has links. Each product writes its own checks, caches its own answers, and tries to remember every edge case. This starts simple and then becomes untestable. Different services interpret policy differently, and a permission change may take effect in one path but not another.`,
        `A second naive approach is role-based access control with a few global roles. That works for coarse systems, but it does not express relationship-heavy products well. "Alice can view doc D because she is a member of team ML, which is viewer on folder F, which is parent of doc D" is not a simple global role. It is a path through a relationship graph.`,
        `A third naive approach is to cache answers aggressively and hope the cache expires soon. That creates the new-enemy problem: after access is revoked, a user who should no longer see the object may still get an allow answer from an old snapshot. Authorization caching has to be tied to a freshness contract, not only a time-to-live.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to represent authorization as relationship data plus schema, then evaluate checks as graph queries. The basic record is a tuple: object, relation, user or userset. For example, team:ml has member user:alice. Folder F has viewer team:ml#member. Doc D has parent folder:F. A userset such as team:ml#member means "the users who are members of team ML."`,
        `Namespace configuration tells the system how relations compose into permissions. Owner may imply editor. Editor may imply viewer. A document may inherit viewers from its parent folder. A group relation may expand into its members. The check engine asks whether a subject belongs to the userset defined by a permission on an object. That is why Zanzibar-style authorization is often described as relationship-based access control.`,
        `This separates product policy from service code. Product teams define namespaces and write relationship tuples. The authorization service stores the tuples, expands usersets, applies the schema, observes consistency rules, and returns an answer. The product can evolve policy without copying graph traversal logic into every backend.`,
      ],
    },
    {
      heading: 'How checks work',
      paragraphs: [
        `A check request has a subject, an object, a permission, and a desired consistency level. "Can alice view doc:D?" starts by expanding the view permission for doc:D using the document namespace. The definition may include direct viewers, owners, editors, public links, or inherited viewers from a parent folder. Each clause becomes a search over relationship tuples.`,
        `If the check reaches a tuple that names alice directly, it can return allow for that branch. If it reaches a userset, the engine recursively expands that userset. Team membership, folder inheritance, organization membership, and nested groups all become edges in a graph. The engine needs cycle handling, depth limits, cache keys, and short-circuit rules because real relationship graphs can be large and uneven.`,
        `Zanzibar also supports consistency tokens called zookies. After a client observes a permission write, it can carry a zookie into later checks. The check should not be answered from a snapshot older than the one the client has already observed. That gives clients a way to ask for an answer that is fresh enough for the current user flow, instead of pretending all replicas are instantly current.`,
        `The result is a distributed graph evaluator with a storage and consistency contract. It is not just an ACL table. It is a query engine for authorization state.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `It works because the data model is uniform. Users, groups, folders, documents, and organizations can all be represented as objects with relations. Direct permissions and inherited permissions are both tuples plus schema. That uniformity lets one service answer many product-specific questions without every product inventing a new access-control engine.`,
        `It also works because usersets compose. A tuple does not need to point only to one concrete user. It can point to another relation. That makes nested groups, folder inheritance, and sharing through teams expressible as graph reachability. The engine can evaluate the same model recursively and cache repeated subproblems.`,
        `The consistency model works because freshness is explicit. Some checks can tolerate a slightly older snapshot. Others, especially after revocation or during a write-followed-by-read flow, require an answer at least as fresh as a known token. Zanzibar exposes that distinction instead of hiding replication lag behind a single endpoint.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The relationship graph visual proves that an allow decision can be a path, not a row lookup. Alice is allowed because alice is a member of team:ml, team:ml#member is viewer on folder:F, and folder:F is a parent that grants view on doc:D. The edge labels are the policy. The traversal is the proof.`,
        `The tuple matrix proves the important modeling move: the third column can be a user or a userset. That is what lets the system point from one relation to another. The consistency visual proves that the answer is not complete unless the system can say what snapshot it used. The zookie is part of the authorization result because freshness is part of correctness.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The cost is graph work under latency pressure. A check may fan out through groups, folders, and inherited relations. Hot groups can appear in many checks. Deep nesting can consume budget. Cycles must be detected. Negative answers may be expensive because the engine has to prove that no valid path exists within the schema.`,
        `Caching is both necessary and dangerous. Low latency needs cached tuple reads, cached subproblem answers, and local replicas. Revocation safety needs freshness. A stale deny after a grant is usually frustrating. A stale allow after a revoke can expose private data. Production systems need explicit consistency choices, invalidation streams, tuple-versioning discipline, and observability for why a cache entry was trusted.`,
        `Schema design is another tradeoff. A flexible namespace language lets products model real policy, but it also lets teams create confusing inheritance, privilege escalation, or checks that are too expensive. A serious Zanzibar-style deployment needs schema review, depth limits, explain tools, static analysis where possible, and runtime budgets.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Zanzibar-style systems are used or imitated in document sharing, cloud IAM, enterprise SaaS permissions, collaboration tools, organization membership, consumer media sharing, and fine-grained authorization platforms such as OpenFGA and SpiceDB. The pattern is useful whenever permissions depend on relationships rather than a few global roles.`,
        `The model is also central to enterprise AI. A RAG system should not retrieve private documents and ask the model to ignore unauthorized text. It should use authorization checks before or during retrieval, filter candidates by the current user, and log which relationship path allowed each document into context. In AI systems, Zanzibar is part of the data boundary, not a final UI check.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The first failure mode is bad schema design. A relation may imply too much, inheritance may flow farther than intended, or a public-link relation may bypass a product rule. The second is unbounded traversal. Nested groups and parent chains can create checks that are correct in theory but too slow in practice. The third is stale authorization after revocation. This is the failure Zanzibar's consistency model is designed to make explicit.`,
        `The fourth failure mode is poor explainability. Users and support teams need to know why access was allowed or denied. Without an explain path, authorization becomes a black box and policy bugs are hard to fix. The fifth is list-query mismatch. "Can Alice view doc D?" is not the same as "which docs can Alice view?" A production system often needs check, expand, lookup, list, and watch APIs, each with its own cost profile.`,
        `A Zanzibar-style system also does not decide product policy for you. It provides a powerful representation and evaluator. Humans still have to define the policy, review the schema, manage migrations, and decide which consistency level each user flow requires.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study the Zanzibar paper beside Graph BFS, Cache Invalidation and Versioning, Spanner, Distributed Tracing, Transaction Isolation Levels, Capability Security and Attenuation, OPA Rego Policy Decision Graph, UCAN Delegation Proof Chain, and Clocks and Ordering from Lamport to TrueTime. The point is to see authorization as a composition of graph search, storage consistency, and policy language design.`,
        `For practice, model a document product with users, groups, folders, and documents. Write tuples for direct owners, group membership, folder parents, and inherited viewers. Then answer three questions: can Alice view doc D, why can Alice view doc D, and what must become fresh after Alice is removed from the group? If the model cannot answer all three clearly, it is not ready for production authorization.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Zanzibar Authorization Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

