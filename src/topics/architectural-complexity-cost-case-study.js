// Architectural complexity as a measurable cost driver: dependency structure,
// propagation cost, defects, productivity, and turnover.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'architectural-complexity-cost-case-study',
  title: 'Architectural Complexity Cost Case Study',
  category: 'Systems',
  summary: 'A software architecture case study: hierarchy and modularity control change propagation, while tangled core-periphery structure raises defects, slows work, and increases turnover risk.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dependency structure', 'cost of complexity'], defaultValue: 'dependency structure' },
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

function dependencyGraph(title) {
  return graphState({
    nodes: [
      { id: 'ui', label: 'UI', x: 0.8, y: 5.0, note: 'edge' },
      { id: 'api', label: 'API', x: 2.6, y: 5.0, note: 'control' },
      { id: 'service', label: 'service', x: 4.4, y: 5.0, note: 'core' },
      { id: 'db', label: 'DB', x: 6.2, y: 5.0, note: 'utility' },
      { id: 'auth', label: 'auth', x: 2.6, y: 6.0, note: 'shared' },
      { id: 'flags', label: 'flags', x: 4.4, y: 6.0, note: 'shared' },
      { id: 'queue', label: 'queue', x: 6.2, y: 6.0, note: 'shared' },
    ],
    edges: [
      { id: 'e-ui-api', from: 'ui', to: 'api', weight: '' },
      { id: 'e-api-service', from: 'api', to: 'service', weight: '' },
      { id: 'e-service-db', from: 'service', to: 'db', weight: '' },
      { id: 'e-api-auth', from: 'api', to: 'auth', weight: '' },
      { id: 'e-service-flags', from: 'service', to: 'flags', weight: '' },
      { id: 'e-service-queue', from: 'service', to: 'queue', weight: '' },
      { id: 'e-flags-api', from: 'flags', to: 'api', weight: 'back' },
      { id: 'e-queue-service', from: 'queue', to: 'service', weight: 'cycle' },
    ],
  }, { title });
}

function* dependencyStructure() {
  yield {
    state: dependencyGraph('Architectural complexity is dependency shape, not just file count'),
    highlight: { active: ['service', 'flags', 'queue'], compare: ['e-flags-api', 'e-queue-service'] },
    explanation: 'The MIT thesis studies architectural complexity as breakdowns in hierarchy and modularity. The dangerous structure is not merely many files; it is change propagation through cycles, back edges, and core modules that many other modules can reach.',
  };

  yield {
    state: labelMatrix(
      'Design structure matrix snapshot',
      [
        { id: 'UI', label: 'UI' },
        { id: 'API', label: 'API' },
        { id: 'Service', label: 'Service' },
        { id: 'DB', label: 'DB' },
        { id: 'Flags', label: 'Flags' },
      ],
      [
        { id: 'UI', label: 'UI' },
        { id: 'API', label: 'API' },
        { id: 'Service', label: 'Service' },
        { id: 'DB', label: 'DB' },
        { id: 'Flags', label: 'Flags' },
      ],
      [
        ['', 'x', '', '', ''],
        ['', '', 'x', '', 'x'],
        ['', '', '', 'x', 'x'],
        ['', '', '', '', ''],
        ['', 'back', '', '', ''],
      ],
    ),
    highlight: { active: ['Flags:API'], found: ['API:Service', 'Service:DB', 'Service:Flags'] },
    explanation: 'A design structure matrix makes dependencies visible. A clean layered system has dependencies mostly in one direction. A back edge from flags to API breaks the hierarchy and can make changes propagate upward.',
    invariant: 'Architecture is a graph; complexity is often graph reachability wearing a codebase costume.',
  };

  yield {
    state: labelMatrix(
      'Component categories from reachability',
      [
        { id: 'peripheral', label: 'peripheral' },
        { id: 'utility', label: 'utility' },
        { id: 'control', label: 'control' },
        { id: 'core', label: 'core' },
      ],
      [
        { id: 'pattern', label: 'pattern' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['few in, few out', 'local cost'],
        ['many depend on it', 'shared breakage'],
        ['depends on many', 'coordination load'],
        ['many in, many out', 'blast radius'],
      ],
    ),
    highlight: { active: ['core:pattern', 'core:risk'], compare: ['peripheral:risk'] },
    explanation: 'The thesis uses network and DSM techniques to classify files by visibility and reachability. Core components are costly because they both depend on many things and are depended on by many things.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'change', label: 'small change', x: 0.8, y: 3.8, note: 'one file' },
        { id: 'tests', label: 'test updates', x: 2.7, y: 2.4, note: 'ripple' },
        { id: 'api', label: 'API contract', x: 2.7, y: 5.2, note: 'ripple' },
        { id: 'deploy', label: 'deploy plan', x: 4.9, y: 3.8, note: 'coordination' },
        { id: 'bugs', label: 'defects', x: 7.2, y: 2.4, note: 'more paths' },
        { id: 'delay', label: 'delay', x: 7.2, y: 5.2, note: 'slower work' },
      ],
      edges: [
        { id: 'e-change-tests', from: 'change', to: 'tests', weight: '' },
        { id: 'e-change-api', from: 'change', to: 'api', weight: '' },
        { id: 'e-tests-deploy', from: 'tests', to: 'deploy', weight: '' },
        { id: 'e-api-deploy', from: 'api', to: 'deploy', weight: '' },
        { id: 'e-deploy-bugs', from: 'deploy', to: 'bugs', weight: '' },
        { id: 'e-deploy-delay', from: 'deploy', to: 'delay', weight: '' },
      ],
    }, { title: 'Propagation cost is the lived experience of complexity' }),
    highlight: { active: ['change'], found: ['bugs', 'delay'] },
    explanation: 'Architectural complexity becomes real when a small change touches many files, tests, owners, rollout paths, and failure modes. The architecture graph predicts the social cost of modifying the system.',
  };
}

function* costOfComplexity() {
  yield {
    state: labelMatrix(
      'Reported cost links in the thesis setting',
      [
        { id: 'productivity', label: 'productivity' },
        { id: 'defects', label: 'defects' },
        { id: 'turnover', label: 'turnover' },
      ],
      [
        { id: 'observed link', label: 'observed link' },
        { id: 'interpretation', label: 'interpretation' },
      ],
      [
        ['up to 50% drops', 'slower change'],
        ['3x increases', 'more bug work'],
        ['order-of-mag risk', 'harder ownership'],
      ],
    ),
    highlight: { active: ['productivity:observed link', 'defects:observed link', 'turnover:observed link'] },
    explanation: 'Within the thesis research setting, architectural complexity was associated with large productivity, defect, and turnover costs. Treat the exact magnitudes as context-specific, but the mechanism is widely recognizable.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'architectural complexity', min: 0, max: 10 }, y: { label: 'relative cost', min: 0, max: 4.0 } },
      series: [
        { id: 'defects', label: 'defect cost', points: [
          { x: 1, y: 1.0 }, { x: 3, y: 1.4 }, { x: 5, y: 2.0 }, { x: 7, y: 2.8 }, { x: 9, y: 3.5 },
        ] },
        { id: 'speed', label: 'lost speed', points: [
          { x: 1, y: 0.2 }, { x: 3, y: 0.5 }, { x: 5, y: 1.0 }, { x: 7, y: 1.6 }, { x: 9, y: 2.3 },
        ] },
      ],
    }),
    highlight: { active: ['defects', 'speed'] },
    explanation: 'The toy curve visualizes why architecture debt compounds. More tangled dependencies make every future change less local, so the same product roadmap buys less delivered value.',
    invariant: 'Complexity tax is paid on every change, not once.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'measure', label: 'measure DSM', x: 0.8, y: 3.8, note: 'current graph' },
        { id: 'hotspots', label: 'find core files', x: 2.8, y: 3.8, note: 'visibility' },
        { id: 'value', label: 'price pain', x: 4.8, y: 2.4, note: 'defects/speed' },
        { id: 'refactor', label: 'refactor', x: 4.8, y: 5.2, note: 'cut edges' },
        { id: 'verify', label: 'verify cost drop', x: 7.2, y: 3.8, note: 'trend' },
      ],
      edges: [
        { id: 'e-measure-hotspots', from: 'measure', to: 'hotspots', weight: '' },
        { id: 'e-hotspots-value', from: 'hotspots', to: 'value', weight: '' },
        { id: 'e-hotspots-refactor', from: 'hotspots', to: 'refactor', weight: '' },
        { id: 'e-refactor-verify', from: 'refactor', to: 'verify', weight: '' },
        { id: 'e-value-verify', from: 'value', to: 'verify', weight: '' },
      ],
    }, { title: 'Refactoring becomes an investment case when complexity is measured' }),
    highlight: { active: ['measure', 'hotspots', 'value'], found: ['verify'] },
    explanation: 'The strongest lesson is managerial: architecture metrics can justify refactoring by tying tangled structure to defects, productivity, and retention risk. Refactoring stops being aesthetic preference and becomes cost control.',
  };

  yield {
    state: labelMatrix(
      'Architecture audit questions',
      [
        { id: 'cycles', label: 'cycles' },
        { id: 'core', label: 'core files' },
        { id: 'owners', label: 'owners' },
        { id: 'interfaces', label: 'interfaces' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'local fix', label: 'local fix' },
      ],
      [
        ['what depends both ways?', 'break cycle'],
        ['who touches everything?', 'split core'],
        ['who must coordinate?', 'clear boundaries'],
        ['what leaks through?', 'narrow API'],
      ],
    ),
    highlight: { found: ['cycles:question', 'core:question', 'interfaces:question'] },
    explanation: 'The practical version is a dependency review. Look for cycles, high-visibility core files, unclear ownership, and interfaces that leak internal detail. Those are the places where future changes will keep paying interest.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dependency structure') yield* dependencyStructure();
  else if (view === 'cost of complexity') yield* costOfComplexity();
  else throw new InputError('Pick an architectural complexity view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        "The architectural complexity cost case study comes from Daniel Sturtevant's MIT thesis \"System Design and the Cost of Architectural Complexity.\" The thesis studies complexity that arises from breakdowns in hierarchy and modularity. Instead of treating complexity as a vague feeling, it represents software architecture as dependency networks and design structure matrices, then relates those structures to organizational costs.",
        'The key idea is propagation cost. If a change in one file can reach many other files through dependencies, the system is harder to change safely. Core-periphery structure, cycles, and back edges make local edits nonlocal. Developers experience that as coordination burden, more tests to update, more regressions, and slower delivery.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A design structure matrix places components on both axes and marks dependencies in the cells. Clean hierarchy tends to have dependencies flowing one way. A tangled matrix shows cycles and unexpected back edges. The thesis classifies components by reachability into categories such as peripheral, utility, control, and core. Core components have high visibility because many components can reach them or are reached by them.',
        'The study then links architectural complexity to cost variables such as defect density, developer productivity, and staff turnover. Within the studied organization, differences in architectural complexity were associated with large productivity drops, defect increases, and turnover risk. The exact numbers are context-specific, but the causal story is familiar: tangled architecture makes every future change more expensive.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Architectural complexity is a recurring tax. A one-time shortcut that adds a cycle or leaks an abstraction can increase the cost of hundreds of future changes. That is why refactoring needs a cost model. If dependency metrics identify a small set of core files driving many defects or coordination costs, a refactor can be evaluated as an investment rather than a cleanup preference.',
        'The cost is not only technical. Complex architecture affects ownership and staffing. If only a few people can safely touch core files, work queues behind them. If new developers cannot understand the dependency structure, onboarding slows. If teams repeatedly fight the architecture, turnover risk rises. Architecture is a socio-technical data structure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This case study applies to monoliths, microservice meshes, internal platforms, ML feature pipelines, distributed tracing stacks, feature flag systems, and queue-heavy systems. Message Queues, Cache Invalidation & Versioning, Feature Flag Control Plane, Circuit Breakers, and Distributed Tracing all solve real problems, but each can also add hidden edges. The architecture question is whether those edges are controlled by clear boundaries.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse size with complexity. A large layered system can be easier to change than a smaller cyclic system. Do not treat architecture metrics as a replacement for engineering judgment; they are maps of risk, not verdicts. Also, microservices do not automatically reduce complexity. They can move dependency cycles from code into network calls, deployment order, schemas, and incident response.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the MIT thesis landing page at https://dspace.mit.edu/entities/publication/ebd0af23-ad35-4dee-995e-47f09e8bbc3e and a PDF copy at https://dsmsuite.github.io/external/CostOfComplexityReport.pdf. Study Distributed Tracing, Message Queues, Feature Flag Control Plane, Cache Invalidation & Versioning, Circuit Breakers, Kubernetes Reconciliation Case Study, and MLOps: Velocity, Validation, Versioning next.',
      ],
    },
  ],
};
