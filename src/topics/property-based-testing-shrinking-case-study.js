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
    {
      heading: 'Why this exists',
      paragraphs: [
        `Example tests are necessary, but they prove one story at a time. A developer writes the empty case, the happy path, and the bug they remember. That leaves the unimagined cases: duplicate values, resize boundaries, Unicode normalization, negative zero, interleaved operations, missing keys, old versions, and strange ordering. Many production bugs are not deep algorithmic failures; they are ordinary inputs arriving in a shape nobody wrote by hand.`,
        `Property-based testing exists to turn a rule into a search problem. Instead of saying "this queue works for the three examples I chose," the test says "for any generated sequence of valid queue operations, the observable behavior should match the model." Hypothesis describes this style as writing tests that should pass for all inputs in a described range while the tool chooses examples, including edge cases: https://hypothesis.readthedocs.io/.`,
        {type:'callout', text:`Property-based testing turns a specification into a search system, and shrinking turns the first failure into the smallest useful debug artifact.`},
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        `The naive answer is to add more examples. That helps, but it keeps human imagination as the coverage engine. The developer must know which length, ordering, duplicate, and boundary should be suspicious before the test can check it. Random fuzzing moves past that limit by generating many inputs, but raw fuzzing often reports a huge failure: a 500-operation sequence, a large JSON document, or a byte string that crashes the parser without explaining the essential cause.`,
        `The wall is not only finding a failure. The wall is turning the failure into a debug artifact. A massive failing input proves that something is wrong, but it may hide the actual trigger under noise. Property-based testing earns its place by pairing generation with shrinking. It searches for counterexamples, then searches again for a smaller counterexample that still violates the same property.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `A property is a behavioral claim that should hold over a family of inputs. Sorting should return an ordered permutation. Encoding then decoding should recover the original value. A cache should never exceed capacity. A queue should dequeue in the same order values were enqueued. A state machine should match a simpler reference model. The strategy describes the input space the tool is allowed to explore.`,
        `Shrinking is the second insight. Once a generated input fails, the framework tries simpler candidates: remove an operation, shorten a list, lower a number, replace a string with a simpler string, reorder a structure, or simplify one branch of a composed value. It keeps only candidates that still fail. The result is not merely smaller; it is more explanatory because everything removed was unnecessary to preserve the bug.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `The loop has several records. A strategy generates an example. The property executes real code against that example. The runner records whether it passed, failed, timed out, or was discarded. If it fails, the shrinker proposes simplifications and reruns the property. The replay database stores seeds or concrete examples so future test runs can check known failures first. A good failure report names the property, the minimal case, the seed or database key, and enough environment detail to reproduce it.`,
        `Strategies are structured generators, not just random value factories. An integer strategy knows about zero, small numbers, bounds, and shrinking toward simpler values. A list strategy knows about length and elements. A state-machine strategy can generate operation sequences with preconditions. The Hypothesis strategies reference documents how values are generated and shrunk across these structures: https://hypothesis.readthedocs.io/en/latest/data.html. Composition matters because real bugs often live in nested data, not a single primitive.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The generator-search view proves that the generator defines the explored world. The strategy node feeds ordinary examples and edge cases into the property. If the strategy never builds a resize boundary, a queue resize bug can remain invisible no matter how many examples run. The property node is the specification. Passing examples are evidence, but a failing example is more valuable because it identifies a concrete input where the rule and implementation disagree.`,
        `The shrinking-tree view proves that simplification is conditional. A shrink candidate that passes is thrown away because it lost the bug. A candidate that still fails becomes the new center of search. The size plot is the key: the framework is driving input complexity downward while preserving the failure signal. The final small case is a distilled bug report, not a random artifact.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Property-based testing works when the property captures the real contract and the generator reaches the relevant domain. In the queue case, the claim might be that a model list and the implementation produce the same dequeued values after any valid sequence of enqueue and dequeue operations. A resize bug may require just enough operations to cross an internal capacity boundary. The generator can discover that boundary, and the shrinker can remove unrelated operations until the smallest failing sequence remains.`,
        `The method is not an exhaustive proof. It executes real code but samples the space. Its strength is that it samples with structure and then preserves failures as regression material. Hypothesis has written about compositional shrinking because shrinking must respect how values were built: https://hypothesis.works/articles/compositional-shrinking/. Shrinking a JSON object, a command sequence, or a graph is not the same as shrinking a number, but the principle is the same: simpler while still failing.`,
      ],
    },
    {
      heading: 'Tradeoffs and cost',
      paragraphs: [
        `The cost is test design. A weak property can pass forever while checking almost nothing. A generator can miss the meaningful domain. Excessive filtering can discard most examples and waste time. Nondeterministic code can make shrinking unstable because a candidate fails once and passes later. Slow properties reduce the number of examples the runner can explore. State-machine tests require a reference model or oracle, which can be more work than ordinary examples.`,
        `There is also a maintenance tradeoff. Good properties become living specifications, which is valuable, but they need names, scope, and replay stability. When a counterexample is found, commit the minimal case as a regression test or keep it in the example database. When the domain changes, update the strategy and property together. Treat the failure report as an artifact: seed, minimal input, property name, implementation version, and environment matter.`,
      ],
    },
    {
      heading: 'Uses and failure modes',
      paragraphs: [
        `Property-based testing is strong for parsers, serializers, encoders, decoders, queues, heaps, hash tables, permission systems, API round trips, numeric code, date logic, and state machines. It catches the bug class where curated examples are too polite. It also pairs well with metamorphic testing: if an exact oracle is hard, check relations such as round-trip, idempotence, monotonicity, commutativity, conservation, or equivalence with a slower reference implementation.`,
        `It fails quietly when the property is tautological, when the generator only produces easy cases, or when the assertion checks implementation details rather than behavior. It can also mislead when generated values are valid syntactically but impossible in the real system. Property tests complement model checking, SMT solving, and symbolic execution. They run the real implementation, but they do not explore every path. Use them where executable invariants and rich input generation buy practical coverage.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study TLA+ State-Space Model Checking for exhaustive bounded exploration of abstract states, Alloy Relational Model Finder for structural counterexamples, SMT Solver Theory Combination and Symbolic Execution Path Constraints for solver-backed paths, Queue and Hash Table for concrete invariant practice, and Bootstrap Confidence Intervals for thinking clearly about sampled evidence. The durable skill is learning to state properties that are strong enough to find bugs and narrow enough to debug.`,
      ],
    },
  ],
};
