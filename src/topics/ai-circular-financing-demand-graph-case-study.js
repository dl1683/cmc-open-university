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
      heading: 'Why this exists',
      paragraphs: [
        'AI infrastructure markets are full of loops. A chip vendor sells accelerators to a cloud. The cloud sells reserved capacity to a model lab. The lab sells API access to applications. The applications sell AI features to end users. Cash, contracts, vendor credit, and equity financing then flow back toward the next hardware order.',
        'That loop can be a healthy industrial buildout, a fragile capital cycle, or a mixture of both. A circular financing demand graph exists to keep those cases separate. It turns a vague debate about bubbles into a set of edges that can be checked: who paid, who borrowed, who committed, who consumed capacity, and who got real value from the workload.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to read headline revenue, backlog, and capex as if they were one signal. Revenue goes up, so demand must be real. Backlog grows, so future revenue must be safe. Capex rises, so management must see demand. That is too coarse for a looped market.',
        'The wall is timing. Hardware revenue can be recognized before the buyer has end-user ROI. Remaining performance obligations can be large while cancellation, concentration, or refinancing risk remains. A signed capacity contract can be rational for one party and still depend on future product adoption by another party. One metric cannot carry the whole story.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to model demand as a directed evidence graph instead of a moral verdict. A loop is not automatically fake. Vendor financing is not automatically bad. Long-term capacity commitments are not automatically proof of durable demand. Each edge needs its own proof object.',
        'The graph separates four questions that often get blended together: Is the asset real? Is the contract enforceable? Is the capacity being used? Is the end user earning enough value to fund the next cycle without fresh subsidy?',
      ],
    },
    {
      heading: 'How the graph works',
      paragraphs: [
        'Start with the capital loop. Chips become cloud capacity. Cloud capacity becomes model training or inference commitments. Model access becomes application features. Application features either create customer ROI or they do not. Customer cash then supports revenue recognition, debt service, new reservations, and new hardware orders.',
        'Then cut the loop into evidence rows. For the chip vendor, look for shipment volume, customer concentration, payment terms, receivables, and supply commitments. For the cloud, look for reserved capacity, utilization, debt service, customer mix, and depreciation. For the model lab, look for compute burn, gross margin, API usage, and contract duration. For the application, look for retention, workflow savings, paid seats, and churn.',
        'The ledger node in the animation is not decorative. It is the discipline that prevents a single press release from becoming the whole analysis. Every edge should be tied to a filing, contract term, invoice, usage cohort, capacity metric, or product outcome.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because circular financing risk is a graph property. A loop is healthy when many independent end users pull useful work through the chain, cash conversion improves, and replacement demand appears without relying on the same financing circle. It is fragile when the same few counterparties create the revenue, provide the financing, absorb the capacity, and justify the next order.',
        'The graph also exposes timing mismatches. The chip shipment happens now. The cloud depreciation runs for years. The lab commitment may be take-or-pay. The application ROI may appear slowly, unevenly, or not at all. A good analysis follows those clocks instead of treating all dollars as equivalent.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the capital-loop view, read each edge as a separate claim. GPU shipments are not the same thing as cloud utilization. Cloud reservations are not the same thing as profitable model usage. Model API calls are not the same thing as end-customer ROI. The important question after each frame is which proof object would make that edge believable.',
        'In the risk-cuts view, the animation changes from a loop to a checklist. Revenue, RPO, capex, usage, ROI, debt, and lock-in can each tell a different story. The strongest case has many green edges from independent evidence. The weakest case has impressive top-line numbers but thin or circular proof at the user, cash, and refinancing edges.',
      ],
    },
    {
      heading: 'Worked example: a capacity loop under stress',
      paragraphs: [
        'Suppose ChipCo extends favorable payment terms to CloudCo on a large accelerator order. CloudCo signs a three-year capacity reservation with LabCo. LabCo uses the cluster to train a model and sell inference to AppCo. AppCo launches support automation for enterprises.',
        'The loop looks strong if you stop at contracted dollars. The graph asks harder questions. How much of CloudCo capacity is actually allocated to paying workloads? How much LabCo API revenue comes from independent customers rather than promotional credits? Does AppCo reduce support cost enough to renew at full price? Can CloudCo service debt if spot GPU prices fall or LabCo slows usage?',
        'Now stress the loop. If AppCo customers renew and expand, end-user ROI pulls cash through the chain and the circular financing becomes a bridge to real demand. If AppCo churns, LabCo usage softens, CloudCo utilization falls, and ChipCo has to support another financing round to preserve the order book, the same graph turns into a fragility map.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The graph is more work than a headline multiple. It needs entity resolution, contract reading, source quality checks, and repeated updates as new filings and usage data arrive. Some edges will stay uncertain because private contracts and customer cohorts are not fully disclosed.',
        'The tradeoff is worth it when capital intensity is high. A small mistake about utilization, customer concentration, or refinancing can dominate the entire thesis. The graph makes uncertainty visible instead of hiding it inside one bullish or bearish label.',
        'The output should carry confidence by edge. A shipped accelerator with payment terms from a filing is stronger evidence than a management quote about future utilization. Mixing those evidence grades without labels is how circular stories become either hype or cynicism.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for market reviews, board risk memos, infrastructure investment diligence, vendor concentration analysis, and product ROI checks. It is especially useful when the same companies appear as suppliers, customers, investors, lenders, and strategic partners.',
        'It also helps operators. A cloud team can use the graph to decide whether to reserve more GPUs. A product team can use it to decide whether an AI feature pays for its inference cost. A finance team can use it to separate durable demand from capital-cycle pressure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The graph fails when the evidence is stale, private, or too aggregated. It can show that an edge needs proof, but it cannot invent proof. It also cannot predict model quality, regulatory shocks, hardware supply, or user adoption from structure alone.',
        'It also fails if it becomes a slogan in the other direction. Calling a loop circular is not the same as proving it is unsound. The output should be a watchlist of fragile edges, not a shortcut around evidence.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Claim Graph Source Ledger for source discipline, AI Capex Depreciation Utilization Ledger for asset pressure, GPU Cloud Capacity Reservation Orderbook Case Study for reserved capacity, LLM Unit Economics Ledger Case Study for workload cost, Evidence Freshness Refresh Scheduler Case Study for keeping claims current, and Software Supply Chain Provenance Graph for proof chains in another domain.',
      ],
    },
  ],
};
