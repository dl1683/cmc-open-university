// AI circular financing demand graph: separate real demand, vendor financing,
// committed capacity, revenue timing, and dependency lock-in.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ai-circular-financing-demand-graph-case-study',
  title: 'AI Circular Financing Demand Graph Case Study',
  category: 'Systems',
  summary: 'A market-structure case study: chip vendors, AI clouds, labs, enterprise customers, committed capacity, vendor financing, revenue timing, and evidence cuts.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['capital loop', 'risk cuts'], defaultValue: 'capital loop' },
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

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'chip', label: 'chip', x: 0.8, y: 3.4, note: 'supply' },
      { id: 'cloud', label: 'cloud', x: 2.4, y: 1.8, note: 'capacity' },
      { id: 'lab', label: 'lab', x: 4.2, y: 1.8, note: 'models' },
      { id: 'app', label: 'apps', x: 6.0, y: 1.8, note: 'features' },
      { id: 'user', label: 'users', x: 7.8, y: 3.4, note: 'demand' },
      { id: 'cash', label: 'cash', x: 6.0, y: 5.0, note: 'pay' },
      { id: 'contract', label: 'terms', x: 4.2, y: 5.0, note: 'commit' },
      { id: 'finance', label: 'fin', x: 2.4, y: 5.0, note: 'capital' },
      { id: 'ledger', label: 'ledger', x: 9.2, y: 3.4, note: 'evidence' },
    ],
    edges: [
      { id: 'e-chip-cloud', from: 'chip', to: 'cloud', weight: 'GPU' },
      { id: 'e-cloud-lab', from: 'cloud', to: 'lab', weight: 'slots' },
      { id: 'e-lab-app', from: 'lab', to: 'app', weight: 'API' },
      { id: 'e-app-user', from: 'app', to: 'user', weight: 'use' },
      { id: 'e-user-cash', from: 'user', to: 'cash', weight: 'ROI' },
      { id: 'e-cash-contract', from: 'cash', to: 'contract', weight: 'rev' },
      { id: 'e-contract-finance', from: 'contract', to: 'finance', weight: 'backlog' },
      { id: 'e-finance-chip', from: 'finance', to: 'chip', weight: 'orders' },
      { id: 'e-user-ledger', from: 'user', to: 'ledger' },
      { id: 'e-contract-ledger', from: 'contract', to: 'ledger' },
      { id: 'e-finance-ledger', from: 'finance', to: 'ledger' },
    ],
  }, { title });
}

function cutGraph(title) {
  return graphState({
    nodes: [
      { id: 'claim', label: 'claim', x: 0.7, y: 3.5, note: 'story' },
      { id: 'source', label: 'src', x: 2.1, y: 3.5, note: 'filing' },
      { id: 'capex', label: 'capex', x: 3.8, y: 1.5, note: 'assets' },
      { id: 'rpo', label: 'RPO', x: 3.8, y: 3.5, note: 'backlog' },
      { id: 'usage', label: 'use', x: 3.8, y: 5.5, note: 'tokens' },
      { id: 'roi', label: 'ROI', x: 5.7, y: 1.5, note: 'value' },
      { id: 'debt', label: 'debt', x: 5.7, y: 3.5, note: 'service' },
      { id: 'lock', label: 'lock', x: 5.7, y: 5.5, note: 'moat' },
      { id: 'verdict', label: 'cut', x: 8.1, y: 3.5, note: 'stress' },
      { id: 'watch', label: 'watch', x: 9.5, y: 3.5, note: 'next' },
    ],
    edges: [
      { id: 'e-claim-source', from: 'claim', to: 'source' },
      { id: 'e-source-capex', from: 'source', to: 'capex' },
      { id: 'e-source-rpo', from: 'source', to: 'rpo' },
      { id: 'e-source-usage', from: 'source', to: 'usage' },
      { id: 'e-capex-roi', from: 'capex', to: 'roi' },
      { id: 'e-rpo-debt', from: 'rpo', to: 'debt' },
      { id: 'e-usage-lock', from: 'usage', to: 'lock' },
      { id: 'e-roi-verdict', from: 'roi', to: 'verdict' },
      { id: 'e-debt-verdict', from: 'debt', to: 'verdict' },
      { id: 'e-lock-verdict', from: 'lock', to: 'verdict' },
      { id: 'e-verdict-watch', from: 'verdict', to: 'watch' },
    ],
  }, { title });
}

function stressPlot() {
  return plotState({
    axes: {
      x: { label: 'end-customer utilization', min: 0, max: 100 },
      y: { label: 'loop health', min: 0, max: 10 },
    },
    series: [
      { id: 'healthy', label: 'real demand', points: [
        { x: 10, y: 2.0 }, { x: 30, y: 4.0 }, { x: 55, y: 6.5 }, { x: 80, y: 8.2 }, { x: 100, y: 8.8 },
      ] },
      { id: 'synthetic', label: 'thin ROI', points: [
        { x: 10, y: 6.0 }, { x: 30, y: 5.4 }, { x: 55, y: 4.2 }, { x: 80, y: 3.4 }, { x: 100, y: 3.2 },
      ] },
    ],
    markers: [
      { id: 'prove', x: 55, y: 6.5, label: 'prove' },
      { id: 'risk', x: 25, y: 5.6, label: 'risk' },
    ],
  });
}

function concentrationPlot() {
  return plotState({
    axes: {
      x: { label: 'customer concentration', min: 0, max: 100 },
      y: { label: 'financing fragility', min: 0, max: 10 },
    },
    series: [
      { id: 'diverse', label: 'diverse use', points: [
        { x: 10, y: 2.0 }, { x: 25, y: 2.7 }, { x: 40, y: 3.5 }, { x: 60, y: 5.0 }, { x: 80, y: 6.2 },
      ] },
      { id: 'narrow', label: 'narrow use', points: [
        { x: 10, y: 3.0 }, { x: 25, y: 4.6 }, { x: 40, y: 6.2 }, { x: 60, y: 8.0 }, { x: 80, y: 9.0 },
      ] },
    ],
    markers: [
      { id: 'single', x: 70, y: 8.5, label: 'single' },
    ],
  });
}

function* capitalLoop() {
  yield {
    state: loopGraph('Circular financing is a directed graph'),
    highlight: { active: ['chip', 'cloud', 'lab', 'app', 'user', 'cash', 'contract', 'finance', 'e-chip-cloud', 'e-cloud-lab', 'e-lab-app', 'e-app-user'], found: ['ledger'] },
    explanation: 'The useful model is a graph, not a slogan. Chips become cloud capacity, labs reserve capacity, applications expose features, users create or fail to create value, and contracts finance the next capital cycle.',
    invariant: 'Separate real usage, committed capacity, revenue timing, and financing dependence.',
  };

  yield {
    state: labelMatrix(
      'Loop',
      [
        { id: 'supply', label: 'supply' },
        { id: 'cloud', label: 'cloud' },
        { id: 'lab', label: 'lab' },
        { id: 'app', label: 'app' },
        { id: 'user', label: 'user' },
        { id: 'cash', label: 'cash' },
      ],
      [
        { id: 'edge', label: 'edge' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['GPU ship', 'rev'],
        ['reserve', 'RPO'],
        ['API buy', 'usage'],
        ['feature', 'retain'],
        ['workflow', 'ROI'],
        ['payback', 'cash'],
      ],
    ),
    highlight: { active: ['supply:proof', 'cloud:proof', 'lab:proof', 'user:proof'], compare: ['cash:proof'] },
    explanation: 'Each edge needs a different proof object. Hardware revenue, remaining obligations, token usage, customer retention, and realized workflow ROI are not interchangeable evidence.',
  };

  yield {
    state: stressPlot(),
    highlight: { active: ['healthy', 'prove'], compare: ['synthetic', 'risk'] },
    explanation: 'A circular loop can be an industrial bootstrap if end-customer utilization rises and payback appears. It becomes fragile when committed capacity keeps expanding faster than real workload ROI.',
  };

  yield {
    state: loopGraph('The ledger cuts the loop into evidence'),
    highlight: { active: ['ledger', 'e-user-ledger', 'e-contract-ledger', 'e-finance-ledger'], compare: ['finance', 'contract'], found: ['user'] },
    explanation: 'The graph should cut the loop into evidence rows: who funded whom, what capacity was committed, how much was consumed, what product value appeared, and what obligation remains.',
  };
}

function* riskCuts() {
  yield {
    state: cutGraph('Risk cuts turn headlines into rows'),
    highlight: { active: ['claim', 'source', 'capex', 'rpo', 'usage', 'e-claim-source', 'e-source-capex', 'e-source-rpo', 'e-source-usage'], found: ['verdict'] },
    explanation: 'A serious analysis does not stop at "bubble" or "not bubble." It asks which rows are real, which rows are timed, which rows are financed, and which rows still need product ROI evidence.',
  };

  yield {
    state: labelMatrix(
      'Cuts',
      [
        { id: 'rev', label: 'rev' },
        { id: 'rpo', label: 'RPO' },
        { id: 'capex', label: 'capex' },
        { id: 'use', label: 'use' },
        { id: 'roi', label: 'ROI' },
        { id: 'debt', label: 'debt' },
      ],
      [
        { id: 'good', label: 'good' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['cash sales', 'related'],
        ['backlog', 'cancel'],
        ['assets', 'idle'],
        ['tokens', 'low value'],
        ['payback', 'missing'],
        ['funding', 'refi'],
      ],
    ),
    highlight: { active: ['rev:good', 'rpo:good', 'use:good', 'roi:watch'], compare: ['debt:watch', 'capex:watch'] },
    explanation: 'The cut table prevents one metric from carrying the whole story. Revenue can be real while ROI is unproven. Backlog can be strong while customer concentration is dangerous. Capex can be rational while utilization is late.',
  };

  yield {
    state: concentrationPlot(),
    highlight: { active: ['narrow', 'single'], compare: ['diverse'] },
    explanation: 'The loop is more fragile when demand depends on a narrow set of counterparties. Diverse enterprise, consumer, research, and batch workloads make the capacity base less brittle.',
  };

  yield {
    state: cutGraph('Watchlist edges decide the next update'),
    highlight: { active: ['roi', 'debt', 'lock', 'verdict', 'watch', 'e-roi-verdict', 'e-debt-verdict', 'e-lock-verdict', 'e-verdict-watch'], compare: ['rpo'] },
    explanation: 'The durable output is a watchlist: utilization, end-customer ROI, contract concentration, debt service, hardware refresh, and whether lock-in is creating useful standardization or brittle dependence.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'capital loop') yield* capitalLoop();
  else if (view === 'risk cuts') yield* riskCuts();
  else throw new InputError('Pick an AI circular financing view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the capital-loop view as a directed graph. A directed graph has arrows, and each arrow means one party depends on another for capacity, cash, usage, or proof.',
        'Active nodes show the current leg of the loop, compare nodes show fragile alternatives, and found nodes show the evidence ledger. The safe inference is that one strong edge never proves the whole loop; each edge needs its own proof object.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/84/NVIDIA_headquarters%2C_Santa_Clara_-_panoramio.jpg', alt:'NVIDIA headquarters in Santa Clara, a central node in the AI infrastructure capital loop', caption:'NVIDIA headquarters in Santa Clara. The chip vendor sits at the top of the AI capital loop: GPUs flow to clouds, clouds sell to labs, labs sell to apps, apps sell to users, and financing flows back to the next hardware order. Source: Wikimedia Commons, Coolcaesar, CC BY-SA 3.0'},
        {type:'callout', text:'The core analytical question is not "bubble or not." It is: which edges in the capital loop carry real end-user ROI, which carry committed-but-unproven capacity, and which depend on financing that assumes future demand that has not yet materialized? A directed evidence graph keeps those cases separate instead of collapsing them into a single verdict.'},
        'AI infrastructure markets can look circular because suppliers, clouds, labs, applications, customers, lenders, and investors often fund one another. The graph exists to separate real demand from capacity commitments and financing arrangements.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach reads revenue, backlog, and capex as one combined signal. If revenue rises, demand must be real; if backlog rises, future demand must be safer; if capex rises, management must see demand.',
        'That shortcut is reasonable because each number contains useful information. The mistake is treating dollars recognized today, obligations remaining tomorrow, and end-customer value next year as the same kind of evidence.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is timing and dependence. A chip vendor can recognize hardware revenue before the cloud buyer proves utilization, and a cloud can sign a reservation before the model lab proves durable gross margin.',
        'The loop becomes fragile when the same few counterparties buy capacity, provide financing, create backlog, and justify the next capital raise. The graph has to show whether cash comes from end users or from another financed edge inside the loop.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model the market as an evidence graph with typed edges. A shipment edge needs proof of delivered hardware and payment terms, a capacity edge needs proof of reservation and utilization, and an ROI edge needs proof that the end customer receives economic value.',
        'The invariant is edge-local evidence. No edge may inherit confidence from a different edge, because shipped GPUs, signed backlog, consumed tokens, and customer payback fail in different ways.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with the physical edge: chips become cloud capacity. Then record the contract edge from cloud to lab, the usage edge from lab to application, and the value edge from application to end customer.',
        'For each edge, attach the strongest available proof. Public filings, remaining performance obligations, utilization data, cohort retention, receivables, debt service, and renewal behavior should be stored as separate rows rather than merged into one verdict.',
        'The risk-cuts view then tests the loop under stress. Customer concentration, refinancing need, low utilization, missing ROI, and lock-in dependence are separate cuts because each points to a different failure mode.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is separation of evidence types. The graph is trustworthy when every conclusion can be traced to the edge it describes, rather than to a neighboring edge that happens to look strong.',
        'A loop is healthy when independent users pull value through the chain and cash conversion improves without recurring support from the same financing circle. It is fragile when accounting growth outruns workload value and debt service.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is source work. Entity resolution, contract reading, filing comparison, customer-concentration tracking, and cohort evidence require repeated updates as new disclosures arrive.',
        'Cost behaves like an uncertainty budget. A public hardware shipment can be high confidence, a take-or-pay reservation can be medium confidence, and undisclosed end-user ROI can remain low confidence until renewal or retention evidence appears.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The graph is useful for market reviews, vendor diligence, board risk memos, lender analysis, and infrastructure planning. It is strongest when companies appear as suppliers, customers, investors, lenders, and strategic partners in the same market.',
        'Operators can use the same structure. A cloud team can decide whether to reserve more capacity, and a product team can test whether a feature creates enough workflow value to fund its compute bill.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The graph fails when evidence is private, stale, or too aggregated. It can mark an edge as unproven, but it cannot invent utilization data, contract terms, or customer ROI.',
        'It also fails when circularity becomes a slogan. A looped financing structure is not automatically unsound, and a signed contract is not automatically durable demand.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'ChipCo sells 1 billion dollars of accelerators to CloudCo on favorable terms, and CloudCo signs a 900 million dollar three-year reservation with LabCo. LabCo then sells inference to AppCo, which promises enterprises a support automation product.',
        'If AppCo customers pay 12 million dollars per month and renew at 90 percent, cash is being pulled from outside the loop. If AppCo churns after pilots, LabCo slows usage, CloudCo utilization falls from 75 percent to 35 percent, and ChipCo extends another financing package, the same loop becomes a fragility map.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study public company filings for revenue recognition, remaining performance obligations, receivables, capex, depreciation, debt maturity, and customer concentration. Pair those with product evidence such as retention, paid seats, usage, and workflow savings.',
        'Next study capex depreciation ledgers, GPU capacity reservation orderbooks, claim-source ledgers, evidence freshness schedulers, and LLM unit economics. Those topics provide the mechanics behind each edge in the graph.',
      ],
    },
  ],
};
