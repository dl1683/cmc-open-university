// Property-based testing: generate many structured inputs for a property, then
// shrink any failing example into a small reproducible counterexample.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'property-based-testing-shrinking-case-study',
  title: 'Property-Based Testing Shrinking Case Study',
  category: 'Concepts',
  summary: 'A generative testing primer: strategies, random examples, edge cases, invariants, failing inputs, shrinking trees, minimal counterexamples, seeds, and replay packets.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['generator search', 'shrinking tree'], defaultValue: 'generator search' },
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

function pbtGraph(title) {
  return graphState({
    nodes: [
      { id: 'strategy', label: 'strategy', x: 0.8, y: 3.5, note: 'gen' },
      { id: 'examples', label: 'examples', x: 2.4, y: 2.0, note: 'many' },
      { id: 'edges', label: 'edge cases', x: 2.4, y: 5.0, note: 'bias' },
      { id: 'property', label: 'property', x: 4.2, y: 3.5, note: 'invariant' },
      { id: 'pass', label: 'pass', x: 5.9, y: 2.0, note: 'keep' },
      { id: 'fail', label: 'fail', x: 5.9, y: 5.0, note: 'counter' },
      { id: 'shrink', label: 'shrink', x: 7.5, y: 5.0, note: 'simplify' },
      { id: 'minimal', label: 'minimal', x: 9.0, y: 3.5, note: 'replay' },
    ],
    edges: [
      { id: 'e-strategy-examples', from: 'strategy', to: 'examples' },
      { id: 'e-strategy-edges', from: 'strategy', to: 'edges' },
      { id: 'e-examples-property', from: 'examples', to: 'property' },
      { id: 'e-edges-property', from: 'edges', to: 'property' },
      { id: 'e-property-pass', from: 'property', to: 'pass' },
      { id: 'e-property-fail', from: 'property', to: 'fail' },
      { id: 'e-fail-shrink', from: 'fail', to: 'shrink' },
      { id: 'e-shrink-minimal', from: 'shrink', to: 'minimal' },
    ],
  }, { title });
}

function shrinkPlot() {
  return plotState({
    axes: {
      x: { label: 'shrink attempt', min: 0, max: 12 },
      y: { label: 'input size', min: 0, max: 120 },
    },
    series: [
      { id: 'size', label: 'size', points: [{ x: 0, y: 96 }, { x: 2, y: 48 }, { x: 4, y: 19 }, { x: 6, y: 8 }, { x: 8, y: 5 }, { x: 10, y: 3 }] },
      { id: 'signal', label: 'still fails', points: [{ x: 0, y: 110 }, { x: 2, y: 70 }, { x: 4, y: 38 }, { x: 6, y: 20 }, { x: 8, y: 14 }, { x: 10, y: 9 }] },
    ],
    markers: [
      { id: 'min', x: 10, y: 3, label: 'min' },
    ],
  });
}

function* generatorSearch() {
  yield {
    state: pbtGraph('Property tests search generated inputs'),
    highlight: { active: ['strategy', 'examples', 'edges', 'property', 'e-strategy-examples', 'e-strategy-edges', 'e-examples-property', 'e-edges-property'], found: ['fail'] },
    explanation: 'Property-based testing replaces handpicked examples with generators. The test states a property that should hold for every generated input within a described domain.',
    invariant: 'The property is the specification; the generator defines the explored input space.',
  };

  yield {
    state: labelMatrix(
      'Strategy table',
      [
        { id: 'int', label: 'int' },
        { id: 'list', label: 'list' },
        { id: 'dict', label: 'dict' },
        { id: 'state', label: 'state' },
      ],
      [
        { id: 'makes', label: 'makes' },
        { id: 'edge', label: 'edge cases' },
      ],
      [
        ['numbers', '0,min,max'],
        ['arrays', 'empty,dup'],
        ['maps', 'missing key'],
        ['ops', 'weird order'],
      ],
    ),
    highlight: { active: ['int:edge', 'list:edge', 'state:edge'], found: ['dict:makes'] },
    explanation: 'Strategies are data generators with structure. Good strategies produce ordinary examples, boundary cases, and weird compositions that humans forget to write.',
  };

  yield {
    state: pbtGraph('Failing examples enter the shrinker'),
    highlight: { active: ['property', 'fail', 'shrink', 'minimal', 'e-property-fail', 'e-fail-shrink', 'e-shrink-minimal'], compare: ['pass'] },
    explanation: 'Finding a failure is only half the value. Shrinking tries to simplify the failing input while preserving the property violation.',
  };

  yield {
    state: labelMatrix(
      'Replay packet',
      [
        { id: 'seed', label: 'seed' },
        { id: 'case', label: 'case' },
        { id: 'prop', label: 'property' },
        { id: 'env', label: 'env' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['rng', 'reproduce'],
        ['input', 'debug'],
        ['name', 'intent'],
        ['version', 'drift'],
      ],
    ),
    highlight: { active: ['seed:why', 'case:why', 'prop:stores'], found: ['env:why'] },
    explanation: 'A failure should be replayable. Store the seed or example database entry, the minimal case, property name, library version, and environment details.',
  };
}

function* shrinkingTree() {
  yield {
    state: labelMatrix(
      'Shrinking attempts',
      [
        { id: 'drop', label: 'drop item' },
        { id: 'small', label: 'small num' },
        { id: 'sort', label: 'simplify' },
        { id: 'keep', label: 'keep fail' },
      ],
      [
        { id: 'candidate', label: 'candidate' },
        { id: 'result', label: 'result' },
      ],
      [
        ['[9,3,0]', 'passes'],
        ['[4,3,0]', 'fails'],
        ['[0,3,4]', 'fails'],
        ['[0,3]', 'minimal'],
      ],
    ),
    highlight: { active: ['small:result', 'sort:result', 'keep:result'], compare: ['drop:result'] },
    explanation: 'Shrinkers try simpler candidates and keep any candidate that still fails. Passing candidates are discarded because they lost the bug.',
  };

  yield {
    state: shrinkPlot(),
    highlight: { active: ['size', 'signal', 'min'] },
    explanation: 'The search should drive complexity down while preserving the failure signal. The final counterexample should be small enough to understand and commit as a regression case.',
  };

  yield {
    state: pbtGraph('The minimal counterexample is a design clue'),
    highlight: { active: ['shrink', 'minimal', 'e-shrink-minimal'], found: ['strategy', 'property'] },
    explanation: 'A minimal failure is often more useful than a stack trace. It tells you which input feature is essential to the bug and which complexity was noise.',
  };

  yield {
    state: labelMatrix(
      'Pitfalls',
      [
        { id: 'weak', label: 'weak prop' },
        { id: 'badgen', label: 'bad gen' },
        { id: 'filter', label: 'filter' },
        { id: 'nondet', label: 'nondet' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['always true', 'stronger'],
        ['misses bug', 'domain gen'],
        ['discard storm', 'construct'],
        ['flaky fail', 'control env'],
      ],
    ),
    highlight: { active: ['weak:symptom', 'badgen:symptom', 'nondet:symptom'], found: ['filter:fix'] },
    explanation: 'Property testing fails quietly when properties are weak, generators miss the domain, filters discard most inputs, or the system is nondeterministic.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'generator search') yield* generatorSearch();
  else if (view === 'shrinking tree') yield* shrinkingTree();
  else throw new InputError('Pick a property-testing view.');
}

export const article = {
  references: [
    { title: 'Hypothesis Documentation', url: 'https://hypothesis.readthedocs.io/' },
    { title: 'Hypothesis Strategies Reference', url: 'https://hypothesis.readthedocs.io/en/latest/data.html' },
    { title: 'Hypothesis Compositional Shrinking', url: 'https://hypothesis.works/articles/compositional-shrinking/' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['Property-based testing states a property that should hold across a space of generated inputs. The framework searches that space and reports concrete counterexamples when the property fails.', 'Hypothesis describes itself as a property-based testing library where you write tests that should pass for all inputs in a described range, and Hypothesis chooses examples including edge cases: https://hypothesis.readthedocs.io/.'] },
    { heading: 'How it works', paragraphs: ['A strategy generates structured examples. The property runs on each example. When a failure appears, the shrinker tries simpler variants and keeps changes that still fail until it finds a small reproducible counterexample.', 'The Hypothesis strategies reference documents how different strategies generate and shrink values, including examples that shrink toward simpler values: https://hypothesis.readthedocs.io/en/latest/data.html.'] },
    { heading: 'Complete case study', paragraphs: ['A queue implementation claims that enqueueing a list of values and then dequeuing all of them returns the original list. A generator creates operation sequences with duplicates, empty cases, and interleavings. It finds a failure after a resize. Shrinking reduces the failure to three operations: enqueue 0, enqueue 1, dequeue, enqueue 2.', 'That tiny counterexample is easier to debug than the first failing random sequence with hundreds of operations.'] },
    { heading: 'Data structures', paragraphs: ['The core records are strategies, random seeds, generated examples, property result, shrink tree, minimal failing input, replay database, and regression test material.', 'Hypothesis has written about compositional shrinking and why shrinking must work through composed strategies rather than only through type-specific simplification: https://hypothesis.works/articles/compositional-shrinking/.'] },
    { heading: 'Pitfalls', paragraphs: ['A property can be too weak, too broad, or accidentally tautological. A generator can miss the important domain. Excessive filtering wastes examples. Nondeterministic systems make shrink results unstable.', 'Property-based testing complements model checking and symbolic execution. It executes real code, but it samples. Model checking explores a bounded model exhaustively. SMT solves path formulas. Use the right tool for the claim.'] },
    { heading: 'Study next', paragraphs: ['Study TLA+ State-Space Model Checking, Alloy Relational Model Finder, SMT Solver Theory Combination, Symbolic Execution Path Constraints, Queue, Hash Table, and Bootstrap Confidence Intervals next.'] },
  ],
};
