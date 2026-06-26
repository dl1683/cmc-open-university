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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the dependency view as a graph of possible change travel. Active edges are paths a local edit can follow, and compare edges are the back edges or cycles that make local reasoning fail.',
        'Read the cost view as the lived behavior of that graph. Defects, delay, and coordination are not separate from architecture; they are what dependency reachability becomes during real changes.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'Architectural complexity is not size; it is the distance a change can travel. The more dependencies a local edit can reach, the more the organization pays for every future change.'},
        'Architectural complexity exists because software change is rarely contained to the edited line. A small change can require client updates, tests, rollout sequencing, monitoring changes, and coordination with other teams.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/36/A_sample_Design_Structure_Matrix_%28DSM%29.png', alt:'Sample design structure matrix with dependency marks between seven elements', caption:'A design structure matrix makes dependency marks visible as cells — the thesis uses this representation to link architecture shape to defect and productivity costs. Source: Wikimedia Commons, A sample Design Structure Matrix (DSM).png, DeKXer, CC BY-SA 3.0/GFDL.'},
        'This case study treats architecture as dependency structure. A design structure matrix, or DSM, puts modules on both axes and marks which module depends on which other module.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to judge complexity is size. Count files, lines of code, services, endpoints, or teams, then assume larger systems are harder to change.',
        'That approach is not useless because scale does add surface area. A million-line codebase usually contains more behavior than a thousand-line tool, so size is a real warning signal.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Size misses the main mechanism. A large layered system can be easy to change if dependencies flow one way, while a small cyclic system can make every edit touch distant modules.',
        'The wall is propagation. If a feature flag module imports the API layer and the API layer imports the feature flag module, a local change now crosses a boundary that was supposed to protect it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that architecture cost is reachability. A component is expensive when changes to it can reach many modules, or when many modules can force changes into it.',
        'This turns architecture review into a graph problem. Cycles, back edges, high-visibility core files, and leaky interfaces are expensive because they make future work nonlocal.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A DSM records dependencies as matrix cells. In a clean hierarchy, most marks stay on one side of the diagonal, which means lower layers do not depend back on higher layers.',
        'Reachability analysis then classifies modules by how many other modules they depend on and how many modules depend on them. Peripheral modules have local cost, while core modules have large blast radius because they sit on many paths.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a preservation argument about change locality. If boundaries point one way and interfaces hide internal detail, a change can be checked against a small set of callers and tests.',
        'If a cycle exists, that locality invariant is gone. A change in either side can require both sides to move together, so the graph predicts why the organization experiences delay and defects.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Complexity cost is paid on every future change, not only when the shortcut is created. If a back edge saves one day today but adds one hour to 200 later changes, the total cost is 200 engineering hours before counting incidents.',
        'The behavior shows up as larger review sets, wider test scope, more rollout coordination, and slower onboarding. When dependency reach doubles, the same feature can touch twice as many modules even if the product requirement is unchanged.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This model helps during modularization, service extraction, platform rewrites, and code ownership reviews. It tells teams whether a proposed boundary is real or only a folder name.',
        'It also helps price refactoring. A refactor is valuable when it removes a propagation path, reduces owner coordination, narrows an API, or turns a core module into several smaller modules with clearer direction.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Architecture metrics fail when treated as verdicts instead of maps. A dependency graph can show risky paths, but engineers still need domain judgment about which dependencies are essential and which are accidental.',
        'They also fail when the system boundary is drawn too narrowly. Microservices can reduce code dependencies while adding dependency cycles through APIs, schemas, deploy order, incident response, and shared data ownership.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a billing policy file imports UI formatting, feature flags, audit logging, and three product services, while 40 modules import billing constants. A one-line policy change now touches 40 direct dependents plus tests, mocks, dashboards, and rollout plans.',
        'After refactoring, billing policy exposes a narrow interface, UI formatting moves to an adapter, and audit emission becomes an output port. If reachability drops from 40 modules to 8 modules, each future policy change has a smaller review and test bill.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is Daniel Sturtevant, System Design and the Cost of Architectural Complexity, from MIT. Read it for DSM methods, hierarchy breakdown, modularity measures, and the empirical cost links.',
        'Study graph reachability, dependency inversion, microservice boundaries, feature flag control planes, distributed tracing, and Conway law next. Then draw a DSM for one real subsystem and identify the top three propagation paths.',
      ],
    },
  ],
};