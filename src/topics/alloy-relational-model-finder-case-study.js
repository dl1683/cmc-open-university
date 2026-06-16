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
    { heading: 'What it is', paragraphs: ['Alloy is a relational modeling language and analyzer. You describe sets, relations, facts, predicates, and assertions, then ask the analyzer for examples or counterexamples within a finite scope.', 'The Alloy docs describe the Analyzer as the tool that checks a spec and converts the model into a SAT formula to solve: https://alloy.readthedocs.io/en/latest/tooling/analyzer.html.'] },
    { heading: 'How it works', paragraphs: ['A signature declares atoms. A relation declares tuples over atoms. A fact constrains all instances. A `run` command asks for an example. A `check` command asks for a counterexample to an assertion.', 'The command docs state that commands run the analyzer and either find models satisfying a specification or counterexamples to properties: https://alloy.readthedocs.io/en/latest/language/commands.html.'] },
    { heading: 'Complete case study', paragraphs: ['An authorization design says each user should have at most one active role per workspace. Alloy finds a model with one user related to both admin and writer because the fact constrained role existence but not uniqueness. The instance is small, visual, and actionable.', 'The fix is to add the missing uniqueness constraint or change the design to allow multi-role users explicitly.'] },
    { heading: 'Data structures', paragraphs: ['Alloy is built on relational structures: sets, tuples, joins, transitive closure, scopes, SAT variables, and a visualized instance graph. The analyzer maps between design concepts and finite relational instances.', 'Scope is a first-class parameter. Small scopes catch many design bugs quickly, but bounded analysis cannot rule out all larger counterexamples.'] },
    { heading: 'Pitfalls', paragraphs: ['No instance can mean the design is impossible or only that the facts are too strong. No counterexample can mean the property holds within scope or only that the scope is too small.', 'Alloy works best when you keep the model structural. If you encode too much low-level execution detail, the SAT problem grows and the counterexample becomes harder to understand.'] },
    { heading: 'Study next', paragraphs: ['Study TLA+ State-Space Model Checking, SMT Solver Theory Combination, Symbolic Execution Path Constraints, Hash Table, Graph BFS, and Property-Based Testing Shrinking next.'] },
  ],
};
