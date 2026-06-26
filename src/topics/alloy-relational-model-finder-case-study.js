// Alloy model finder: describe sets and relations under a finite scope, then
// ask the analyzer for satisfying instances or counterexamples.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'alloy-relational-model-finder-case-study',
  title: 'Alloy Relational Model Finder Case Study',
  category: 'Concepts',
  summary: 'A bounded relational analysis primer: signatures, relations, facts, predicates, assertions, scopes, SAT translation, instances, unsat cores, and counterexamples.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['relational scope', 'counterexample model'], defaultValue: 'relational scope' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function alloyGraph(title) {
  return graphState({
    nodes: [
      { id: 'sig', label: 'sig', x: 0.8, y: 2.0, note: 'sets' },
      { id: 'rel', label: 'rel', x: 0.8, y: 5.0, note: 'edges' },
      { id: 'fact', label: 'facts', x: 2.5, y: 3.5, note: 'always' },
      { id: 'cmd', label: 'run/check', x: 4.2, y: 3.5, note: 'scope' },
      { id: 'kodkod', label: 'kodkod', x: 5.8, y: 2.0, note: 'bounds' },
      { id: 'sat', label: 'SAT', x: 5.8, y: 5.0, note: 'solve' },
      { id: 'instance', label: 'instance', x: 7.6, y: 2.0, note: 'model' },
      { id: 'counter', label: 'counter', x: 7.6, y: 5.0, note: 'bug' },
      { id: 'viz', label: 'viz', x: 9.0, y: 3.5, note: 'inspect' },
    ],
    edges: [
      { id: 'e-sig-fact', from: 'sig', to: 'fact' },
      { id: 'e-rel-fact', from: 'rel', to: 'fact' },
      { id: 'e-fact-cmd', from: 'fact', to: 'cmd' },
      { id: 'e-cmd-kodkod', from: 'cmd', to: 'kodkod' },
      { id: 'e-kodkod-sat', from: 'kodkod', to: 'sat' },
      { id: 'e-sat-instance', from: 'sat', to: 'instance' },
      { id: 'e-sat-counter', from: 'sat', to: 'counter' },
      { id: 'e-instance-viz', from: 'instance', to: 'viz' },
      { id: 'e-counter-viz', from: 'counter', to: 'viz' },
    ],
  }, { title });
}

function scopePlot() {
  return plotState({
    axes: {
      x: { label: 'scope atoms', min: 1, max: 9 },
      y: { label: 'relations', min: 0, max: 260 },
    },
    series: [
      { id: 'unary', label: 'sets', points: [{ x: 2, y: 4 }, { x: 4, y: 8 }, { x: 6, y: 12 }, { x: 8, y: 16 }] },
      { id: 'binary', label: 'binary rel', points: [{ x: 2, y: 8 }, { x: 4, y: 32 }, { x: 6, y: 72 }, { x: 8, y: 128 }] },
      { id: 'ternary', label: 'ternary rel', points: [{ x: 2, y: 16 }, { x: 4, y: 64 }, { x: 6, y: 160 }, { x: 8, y: 250 }] },
    ],
    markers: [
      { id: 'scope', x: 6, y: 160, label: 'scope' },
    ],
  });
}

function* relationalScope() {
  yield {
    state: alloyGraph('Alloy searches finite relational scopes'),
    highlight: { active: ['sig', 'rel', 'fact', 'cmd', 'kodkod', 'sat', 'e-sig-fact', 'e-rel-fact', 'e-fact-cmd', 'e-cmd-kodkod', 'e-kodkod-sat'], found: ['instance'] },
    explanation: 'Alloy models a design as atoms, sets, and relations. The analyzer searches a finite scope for an instance that satisfies a command or for a counterexample to an assertion.',
    invariant: 'Alloy analysis is bounded: no counterexample in scope is not the same as proof for all sizes.',
  };

  yield {
    state: labelMatrix(
      'Relational model',
      [
        { id: 'User', label: 'User' },
        { id: 'Role', label: 'Role' },
        { id: 'Grant', label: 'grant' },
        { id: 'Admin', label: 'admin' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['sig', 'atoms'],
        ['sig', 'atoms'],
        ['rel', 'User->Role'],
        ['fact', 'one role'],
      ],
    ),
    highlight: { active: ['Grant:kind', 'Grant:meaning'], found: ['Admin:kind'] },
    explanation: 'The relational vocabulary is the data structure. Sets hold atoms. Relations connect atoms. Facts constrain every instance. Predicates and assertions ask the analyzer questions.',
  };

  yield {
    state: scopePlot(),
    highlight: { active: ['unary', 'binary', 'ternary', 'scope'] },
    explanation: 'Scope controls cost. Binary and ternary relations expand quickly because the analyzer considers possible tuples within the chosen atom bounds.',
  };

  yield {
    state: labelMatrix(
      'Command choices',
      [
        { id: 'run', label: 'run' },
        { id: 'check', label: 'check' },
        { id: 'scope', label: 'scope' },
        { id: 'core', label: 'unsat core' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'returns', label: 'returns' },
      ],
      [
        ['find example', 'instance'],
        ['break assert', 'counter'],
        ['bound atoms', 'cost'],
        ['why none', 'constraints'],
      ],
    ),
    highlight: { active: ['run:returns', 'check:returns', 'scope:asks'], compare: ['core:returns'] },
    explanation: '`run` finds a satisfying design instance. `check` searches for a counterexample. Scope decides how much universe the analyzer may use.',
  };
}

function* counterexampleModel() {
  yield {
    state: labelMatrix(
      'Counterexample adjacency',
      [
        { id: 'u0', label: 'u0' },
        { id: 'u1', label: 'u1' },
        { id: 'r0', label: 'r0' },
        { id: 'r1', label: 'r1' },
      ],
      [
        { id: 'admin', label: 'admin' },
        { id: 'writer', label: 'writer' },
        { id: 'reader', label: 'reader' },
      ],
      [
        ['yes', 'yes', 'no'],
        ['no', 'yes', 'yes'],
        ['role', 'role', 'role'],
        ['role', 'role', 'role'],
      ],
    ),
    highlight: { active: ['u0:admin', 'u0:writer'], found: ['u1:writer'] },
    explanation: 'A counterexample is a concrete relational instance. Here one user has two roles when the assertion expected at most one.',
  };

  yield {
    state: alloyGraph('SAT assignment maps back to a visual instance'),
    highlight: { active: ['sat', 'counter', 'viz', 'e-sat-counter', 'e-counter-viz'], compare: ['instance'] },
    explanation: 'The analyzer translates the bounded relational problem to SAT, solves it, then maps the boolean assignment back to atoms and relation tuples.',
  };

  yield {
    state: labelMatrix(
      'What the counterexample means',
      [
        { id: 'under', label: 'under spec' },
        { id: 'over', label: 'over spec' },
        { id: 'real', label: 'real bug' },
        { id: 'scope', label: 'scope gap' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['too many models', 'add fact'],
        ['no models', 'relax fact'],
        ['bad instance', 'fix design'],
        ['no bug yet', 'raise scope'],
      ],
    ),
    highlight: { active: ['under:response', 'real:response'], compare: ['over:response'] },
    explanation: 'The first job is classifying the instance. It might show an underspecified model, an overspecified model, a real design bug, or a scope too small to exercise the risk.',
  };

  yield {
    state: labelMatrix(
      'Design uses',
      [
        { id: 'auth', label: 'auth' },
        { id: 'schema', label: 'schema' },
        { id: 'protocol', label: 'protocol' },
        { id: 'config', label: 'config' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'bug', label: 'bug' },
      ],
      [
        ['roles', 'privilege'],
        ['foreign keys', 'orphan'],
        ['messages', 'bad order'],
        ['options', 'invalid combo'],
      ],
    ),
    highlight: { found: ['auth:bug', 'schema:bug', 'config:bug'] },
    explanation: 'Alloy is especially good when the bug is structural: bad relationships, missing constraints, impossible configurations, and unexpected counterexample shapes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'relational scope') yield* relationalScope();
  else if (view === 'counterexample model') yield* counterexampleModel();
  else throw new InputError('Pick an Alloy model-finder view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation treats a design as a small universe of atoms and relations. An atom is one abstract object, such as a User or Role. A relation is a set of tuples, such as user u0 has role admin.',
        'Active nodes are the modeling pieces being translated into a finite search problem. Found nodes are concrete instances or counterexamples. The scope plot shows why bounded analysis has a cost: more atoms and higher-arity relations create many more possible tuples.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'Alloy finds the small counterexample that invalidates a design claim — two active roles where only one should exist, orphaned records, impossible configuration combinations. The value is falsification: a concrete three-atom bad world is more useful than a long review meeting because you can inspect exactly which relation tuple violates the invariant.'},
        'Alloy exists because many design bugs are relational before they are procedural. A system can compile and pass unit tests while still allowing two active roles, an orphaned record, a forbidden cycle, or an impossible configuration. These failures live in the shape of the state space.',
        'Alloy lets the designer write signatures, relations, facts, predicates, and assertions, then asks a solver to search a finite scope. A finite scope means a fixed maximum number of atoms of each type. The result is either an example, a counterexample, or no such world within that scope.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to draw boxes and arrows, write prose invariants, and add a few unit tests. That works while the design is small and the tested cases match the designer\'s imagination. It fails when the bad case is a tiny combination nobody thought to draw.',
        'Another approach is code review. Reviewers can spot missing constraints, but they must mentally enumerate possible worlds. Alloy makes that enumeration executable for bounded worlds, so the review can inspect a concrete bad instance instead of arguing from intuition.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is combinatorial growth. With 3 users and 3 roles, a binary grant relation has 9 possible user-role pairs, so there are 2^9 possible grant sets. Add organizations and time states, and manual reasoning stops being reliable.',
        'The second wall is ambiguity. A sentence like "a user has one role" might mean one role globally, one role per organization, or one active role at a time. Alloy forces that sentence into a relation constraint, and the first counterexample usually reveals which meaning was missing.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Alloy reduces a structural design question to bounded relational satisfiability. Signatures define sets of atoms. Relations define possible tuples among atoms. Facts constrain every allowed world. Assertions state properties that should survive those facts.',
        'The Analyzer translates the bounded model into a Boolean satisfiability problem, often called SAT. If the formula has a satisfying assignment, Alloy maps it back to atoms and tuples. If a checked assertion fails, the assignment becomes a counterexample the designer can inspect.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A typical session starts with signatures such as User, Org, Role, and Invite. Relations might include member: User -> Org and grant: User -> Org -> Role. Facts might say every invite targets exactly one organization, and no grant exists for a deleted organization.',
        'The designer first uses run to find ordinary examples. If no ordinary example exists, the model is probably overconstrained. Then the designer uses check to search for counterexamples to claims such as no user has two active roles in the same organization.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Within the chosen scope, Alloy is exhaustive. It does not sample a few diagrams; it searches all assignments allowed by the bounds and facts. A counterexample is therefore not a suggestion. It is a concrete world that satisfies the model and violates the assertion.',
        'The correctness limit is just as important. No counterexample up to 5 users is not a proof for 500 users unless a separate small-scope theorem applies. The honest claim is bounded evidence under this model and this scope.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with atoms, relation arity, and constraints. A unary set over 6 atoms has 6 membership choices, but a ternary relation over 6 by 6 by 6 atoms has 216 possible tuples. The SAT encoding must reason about those choices and the constraints that connect them.',
        'The behavior is manageable when the model is focused. If the design claim concerns role grants, model roles, users, organizations, and time state, not UUID parsing or HTTP handlers. Raising scope from 4 to 8 atoms can change a fast check into a slow one, so scope is a modeling decision.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Alloy is useful for permissions, schemas, dependency graphs, protocol state, configuration systems, file-system invariants, and object models. These are domains where a small bad relation can violate a large product promise. A three-atom counterexample can invalidate a design before implementation starts.',
        'It also works as design documentation. A reviewer can read the signatures, facts, and assertions as a compact version of the system contract. Running the model checks whether the written contract admits worlds the team did not intend.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Alloy fails when the model omits the real source of risk. If time, deletion, identity, or concurrency matters but is not represented, the Analyzer cannot find bugs that require those concepts. The solver answers the model, not the real system.',
        'It also fails when users overmodel implementation detail. Encoding strings, database indexes, request handlers, and every field can make the SAT problem large while hiding the invariant. The right model is small enough to inspect and precise enough to contain the bug.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose product policy says each user has at most one active role per organization. Model 2 users, 1 organization, and 2 roles: admin and writer. If grant is only constrained as User -> Role, Alloy can return u0->admin and u0->writer in the same organization.',
        'That counterexample has only 4 atoms, but it proves the written facts are too weak. The fix is to constrain role uniqueness over the pair (user, org), not just the user. Rechecking at scope 3 users, 2 organizations, and 3 roles then searches 18 possible user-org-role tuples for the same class of violation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Alloy Analyzer documentation, Alloy command documentation, and the Alloy FAQ on bounded analysis. Study SAT solvers, relational algebra, TLA+ for temporal systems, SMT solvers for richer theories, and property-based testing for executable counterexample generation.',
        'The next exercise is to model one permission rule from a real system. Write run first, inspect a normal instance, then write the assertion and check it at several scopes. Keep the counterexample if it finds a real design gap.',
      ],
    },
  ],
};