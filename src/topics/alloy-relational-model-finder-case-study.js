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
  references: [
    { title: 'Alloy Analyzer Docs', url: 'https://alloy.readthedocs.io/en/latest/tooling/analyzer.html' },
    { title: 'Alloy Commands Docs', url: 'https://alloy.readthedocs.io/en/latest/language/commands.html' },
    { title: 'Alloy Analyzer FAQ', url: 'https://alloytools.org/faq/what_kind_of_analysis_does_the_alloy_analyzer_do.html' },
  ],
  sections: [
    { heading: 'Why this exists', paragraphs: ['Many design bugs are structural before they are algorithmic: two active roles where only one should exist, orphaned records, impossible configuration combinations, or a graph relation that permits a forbidden cycle.', 'Alloy exists for those small but slippery relational claims. You describe sets, relations, facts, predicates, and assertions, then ask for examples or counterexamples inside a finite scope. The Alloy docs describe the Analyzer as converting the model into a SAT formula to solve: https://alloy.readthedocs.io/en/latest/tooling/analyzer.html.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is to draw boxes and arrows, then write unit tests for a few cases. That is useful, but the examples usually mirror the designer assumptions. Missing uniqueness, missing reachability, and bad multiplicity constraints often survive because nobody drew the tiny bad instance.', 'The wall is combinatorial structure. Even with a few users, roles, workspaces, and permissions, the possible relations multiply quickly. Alloy asks the solver to search that space directly.'] },
    { heading: 'The core insight', paragraphs: ['A signature declares atoms. A relation declares tuples over atoms. A fact constrains all instances. A `run` command asks for an example. A `check` command asks for a counterexample to an assertion.', 'The command docs state that commands run the analyzer and either find models satisfying a specification or counterexamples to properties: https://alloy.readthedocs.io/en/latest/language/commands.html. The key boundary is scope: Alloy gives bounded structural evidence, not an unbounded proof of every larger world.'] },
    { heading: 'What the visual is proving', paragraphs: ['Read each atom as a concrete object in a small possible world and each edge as a relation tuple. When the analyzer shows a counterexample, it is not merely a picture. It is a model that satisfies your facts while violating your intended assertion.', 'In the authorization example, one user related to both admin and writer is the lesson. The bug is not that Alloy found a weird case; the bug is that the written facts allowed that case.', 'The scope plot is the other half of the lesson. A bounded model finder can search many relational combinations quickly, but the search space still grows with atoms and relation arity. Good Alloy work keeps the model small enough to explore while preserving the structure that could contain the bug.'] },
    { heading: 'Why it works', paragraphs: ['Alloy works by translating bounded relational logic to SAT. Within the chosen scope, either the SAT instance has a satisfying assignment that becomes an example or counterexample, or no such assignment exists in that scope.', 'That makes it excellent for falsification. A tiny counterexample can invalidate a design quickly. A lack of counterexamples is still conditional on scope, facts, and the fidelity of the model.'] },
    { heading: 'Complete case study', paragraphs: ['Imagine an authorization design with users, organizations, roles, and invitations. Product prose says a user can have at most one role per organization, an invitation must target exactly one organization, and deleting an organization should remove every role grant inside it. Those statements sound simple, but they are relational constraints across several sets.', 'In Alloy, the team can model User, Org, Role, Invite, and grant relations, then check assertions such as no user has two roles in the same org and no invite points to a missing org. A counterexample with three users and two orgs is more valuable than a long design meeting because it gives a concrete bad world the team can inspect and fix.'] },
    { heading: 'Modeling habit', paragraphs: ['Treat every fact as a claim someone could challenge. If a fact says every invite belongs to one organization, ask what breaks if it is removed. If an assertion says every resource has an owner, ask whether deleted owners, transferred resources, and pending invitations are represented. Alloy rewards this habit because weakening one line can quickly reveal which invariant was doing the real work.', 'This also makes Alloy useful in reviews. A reviewer can read the signatures, facts, and assertions as a compact design document, then run the model to see whether the prose survives contact with small possible worlds.'] },
    { heading: 'Cost and tradeoffs', paragraphs: ['The cost is modeling discipline. Alloy will answer the model you wrote, not the system you meant. If you forget time, identity, deletion, or multiplicity, the analyzer may find silly worlds or miss real ones. If you overmodel implementation detail, the solver drowns in irrelevant tuples.', 'The skill is choosing the right abstraction. Model the relationship that can break, not every line of code. Use small scopes first, inspect examples before checking assertions, then increase scope only when the model is behaving like the design.'] },
    { heading: 'How to use it well', paragraphs: ['Start by writing a `run` command before writing assertions. If Alloy cannot produce ordinary examples of the design, the model is probably overconstrained or missing basic facts. Once examples look plausible, add assertions that encode promises the product depends on.', 'Name the intended invariant in plain language before encoding it. Then compare the counterexample with that sentence. If the counterexample is allowed by the model but impossible in the real system, add the missing fact. If it is possible in the real system, you found a design bug. If no counterexample appears, raise the scope and try nearby formulations before treating the result as evidence.'] },
    { heading: 'Reader workflow', paragraphs: ['A useful Alloy session alternates between construction and criticism. First make the analyzer show a normal instance. Then make it show a deliberately bad instance by weakening a fact. Then restore the fact and check the assertion you actually care about. This prevents a common failure where a model passes only because it accidentally forbids every interesting world.', 'When the visualizer shows an instance, read it as data. Which atoms exist? Which relation tuples exist? Which expected tuple is missing? Which extra tuple violates the invariant? The small instance is not a toy afterthought; it is the artifact that lets humans understand the bug.'] },
    { heading: 'What not to model', paragraphs: ['Do not model strings, UUID formats, timestamp parsing, or database indexes unless they are part of the structural claim. Use abstract atoms for users, files, roles, states, messages, and resources. Alloy is strongest when the question is about relationships among things, not the byte-level mechanics of those things.', 'Do not translate implementation code line by line. If the design claim is "every invoice has exactly one owner account," the model should express ownership and account existence directly. A faithful miniature is better than a huge transcription that nobody can inspect.'] },
    { heading: 'Limits of bounded analysis', paragraphs: ['Alloy is intentionally bounded. Checking up to five users and three organizations is not a proof for all possible systems unless a separate small-scope theorem applies. The value is that many design bugs have small counterexamples. A two-node cycle, a missing owner, or a double grant often appears in tiny scopes.', 'The bounded nature should shape how results are reported. Say "no counterexample up to this scope under this model," not "the design is correct." That phrasing keeps the evidence honest and teaches readers what the tool actually guarantees.'] },
    { heading: 'Where it wins and fails', paragraphs: ['Alloy wins on schemas, permissions, protocol shapes, dependency graphs, file-system invariants, configuration systems, and object models where the bug is a missing relation constraint. It prevents teams from trusting prose like "at most one" before the model actually enforces it.', 'It fails when you encode too much execution detail or forget that no instance can mean either impossible design or overconstrained facts. Keep the model structural, grow scopes deliberately, and treat "no counterexample" as bounded evidence.'] },
    { heading: 'Study next', paragraphs: ['Study TLA+ State-Space Model Checking for temporal state machines, SMT Solver Theory Combination for richer formulas, Symbolic Execution Path Constraints for code paths, Hash Table and Graph BFS for the underlying search intuition, and Property-Based Testing Shrinking for executable counterexample discovery.', 'Then take one schema or permission rule from a real project and model only that rule. If Alloy finds a small counterexample, keep the model with the design docs so future changes can be checked against the same invariant.'] },
  ],
};
