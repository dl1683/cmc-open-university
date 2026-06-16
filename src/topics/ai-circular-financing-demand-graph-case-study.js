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
      heading: 'What it is',
      paragraphs: [
        'An AI circular financing demand graph is a way to analyze market structure without collapsing everything into a single label. The local corpus frames the controversy well: vendor financing, committed compute, customer concentration, and synthetic-looking demand can resemble a bubble, but the infrastructure may still be durable if real workloads and payback emerge.',
        'The graph separates chip supply, AI cloud capacity, lab commitments, application adoption, end-customer ROI, revenue recognition, remaining obligations, financing, and lock-in. Each edge is evidence to verify, not a vibe to accept.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The graph starts with a chip vendor and a cloud capacity buyer. It then follows reserved GPU capacity into labs and applications, then follows user demand and cash back through contracts and financing. Claim Graph Source Ledger provides the evidence discipline: every major edge should point to a filing, contract disclosure, usage metric, customer cohort, or financial statement.',
        'AI Capex Depreciation Utilization Ledger explains the asset pressure inside a participant. GPU Cloud Capacity Reservation Orderbook explains the reservation and take-or-pay layer. Inference ROI Payback Cohort Ledger explains the product proof layer. Together they keep the capital story connected to actual workloads.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Circularity is not automatically fraud. Industrial buildouts often use capital loops, long-term commitments, vendor financing, and standard-setting before demand fully matures. The risk is timing and concentration: if capital commitments outrun useful demand, the graph has to contract through idle capacity, price pressure, refinancing, consolidation, or write-downs.',
        'The model is also path-dependent. A tight loop can make a hardware and software stack the default before alternatives mature. That can create real productivity and ecosystem benefits. It can also create brittle dependence if the loop is financed by a few counterparties and weak end-customer ROI.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'NVIDIA fiscal 2026 reporting provides the hardware-side scale signal, including record revenue and record data-center revenue: https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2026. NVIDIA 10-K risk and accounting disclosures are useful for grounding depreciation, supply, demand, and segment context: https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm.',
        'CoreWeave filings provide the AI-cloud capacity side: committed contracts, take-or-pay capacity reservations, capital expenditure requirements, debt, and customer concentration risks. See the S-1 at https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm and the FY25 10-K at https://s205.q4cdn.com/133937190/files/doc_financials/2025/q4/CoreWeave-Inc-FY25-10-K-7.pdf.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'An investor can use this graph to separate revenue, backlog, utilization, and ROI instead of treating them as one number. A platform leader can use it to ask whether a capacity reservation is matched by product demand. A product leader can use it to identify which AI features are generating payback rather than only consuming reserved compute.',
        'A researcher can also use the graph to study standardization. Capital loops can make an ecosystem stronger when they finance common tooling, model serving practices, developer adoption, and performance learning curves. The same loops become risky when all demand evidence points back to the same financing circle.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not call every circular deal fake demand. Do not call every signed contract proof of end-user ROI. Do not compare a chip vendor, an AI cloud, a model lab, and an enterprise app with one metric. Each layer has different timing, risk, and proof.',
        'Do not ignore survivorship of infrastructure. Even if valuations reset, the physical and software infrastructure can keep producing value if workloads remain. The question is not only whether prices correct. It is which graph edges survive a correction.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA FY2026 results at https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2026, NVIDIA FY2026 10-K at https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm, CoreWeave S-1 at https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm, CoreWeave FY25 10-K at https://s205.q4cdn.com/133937190/files/doc_financials/2025/q4/CoreWeave-Inc-FY25-10-K-7.pdf, AWS capacity reservations at https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html, and Azure capacity reservations at https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-overview. Study Claim Graph Source Ledger, AI Capex Depreciation Utilization Ledger, GPU Cloud Capacity Reservation Orderbook Case Study, Inference ROI Payback Cohort Ledger Case Study, LLM Unit Economics Ledger Case Study, Software Supply Chain Provenance Graph, and Evidence Freshness Refresh Scheduler Case Study next.',
      ],
    },
  ],
};
