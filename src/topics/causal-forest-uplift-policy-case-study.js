// Causal forests: honest tree neighborhoods estimate heterogeneous treatment
// effects, then policy targeting ranks users by expected uplift.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'causal-forest-uplift-policy-case-study',
  title: 'Causal Forest Uplift Policy',
  category: 'AI & ML',
  summary: 'Estimate heterogeneous treatment effects with honest forest leaves, then target the users whose predicted uplift justifies intervention.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['honest leaves', 'uplift policy'], defaultValue: 'honest leaves' },
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

function forestGraph(title) {
  return graphState({
    nodes: [
      { id: 'logs', label: 'logs', x: 0.7, y: 3.2, note: 'T,Y,X' },
      { id: 'nuisance', label: 'nuis', x: 2.15, y: 2.0, note: 'm,e' },
      { id: 'split', label: 'split', x: 2.15, y: 4.35, note: 'honest' },
      { id: 'trees', label: 'forest', x: 3.85, y: 3.2, note: 'leaves' },
      { id: 'leaf', label: 'leaf', x: 5.35, y: 3.2, note: 'neighbors' },
      { id: 'cate', label: 'CATE', x: 6.85, y: 2.0, note: 'effect' },
      { id: 'rank', label: 'rank', x: 6.85, y: 4.35, note: 'uplift' },
      { id: 'policy', label: 'policy', x: 8.4, y: 3.2, note: 'target' },
    ],
    edges: [
      { id: 'e-logs-nuisance', from: 'logs', to: 'nuisance' },
      { id: 'e-logs-split', from: 'logs', to: 'split' },
      { id: 'e-split-trees', from: 'split', to: 'trees' },
      { id: 'e-nuisance-trees', from: 'nuisance', to: 'trees' },
      { id: 'e-trees-leaf', from: 'trees', to: 'leaf' },
      { id: 'e-leaf-cate', from: 'leaf', to: 'cate' },
      { id: 'e-cate-rank', from: 'cate', to: 'rank' },
      { id: 'e-rank-policy', from: 'rank', to: 'policy' },
    ],
  }, { title });
}

function* honestLeaves() {
  yield {
    state: forestGraph('Causal forests estimate effects that vary by covariates'),
    highlight: { active: ['logs', 'trees', 'leaf'], compare: ['policy'] },
    explanation: 'A causal forest is not just a random forest that predicts outcomes. It builds adaptive neighborhoods where treated and control outcomes can be compared to estimate heterogeneous treatment effects.',
  };

  yield {
    state: labelMatrix(
      'Honesty splits roles',
      [
        { id: 'split', label: 'split set' },
        { id: 'estimate', label: 'estimate set' },
        { id: 'nuisance', label: 'nuisance' },
        { id: 'test', label: 'test set' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'why', label: 'why' },
      ],
      [
        ['choose leaves', 'avoid bias'],
        ['estimate CATE', 'honest effects'],
        ['m(x),e(x)', 'deconfound'],
        ['evaluate', 'no peeking'],
      ],
    ),
    highlight: { active: ['split:role', 'estimate:role'], found: ['test:why'], compare: ['nuisance:role'] },
    explanation: 'Honest trees separate the data used to decide splits from the data used to estimate effects inside leaves. That reduces adaptive overfitting to noisy treatment-effect differences.',
    invariant: 'A leaf is useful only if it contains comparable treated and control evidence.',
  };

  yield {
    state: forestGraph('Leaves become adaptive causal neighborhoods'),
    highlight: { active: ['trees', 'leaf', 'cate'], found: ['nuisance'] },
    explanation: 'Each tree routes a user to a leaf. Across many trees, the forest produces weights over similar training examples. Those weighted neighbors estimate the conditional treatment effect for that user.',
  };

  yield {
    state: labelMatrix(
      'Leaf-level effect estimate',
      [
        { id: 'young', label: 'young low' },
        { id: 'loyal', label: 'loyal' },
        { id: 'new', label: 'new users' },
        { id: 'churn', label: 'churn risk' },
      ],
      [
        { id: 'treated Y', label: 'T mean' },
        { id: 'control Y', label: 'C mean' },
        { id: 'uplift', label: 'uplift' },
      ],
      [
        ['0.28', '0.23', '+0.05'],
        ['0.42', '0.41', '+0.01'],
        ['0.30', '0.18', '+0.12'],
        ['0.24', '0.29', '-0.05'],
      ],
    ),
    highlight: { found: ['new:uplift'], compare: ['loyal:uplift'], removed: ['churn:uplift'] },
    explanation: 'The forest is valuable when effects differ. A coupon may help new users, do almost nothing for loyal users, and harm churn-risk users by training them to wait for discounts.',
  };

  yield {
    state: forestGraph('CATE estimates feed policy learning'),
    highlight: { active: ['cate', 'rank', 'policy'], compare: ['leaf'] },
    explanation: 'The output is not only an average effect. It is a ranking surface: who benefits enough from treatment to justify cost, risk, and capacity limits.',
  };
}

function* upliftPolicy() {
  yield {
    state: labelMatrix(
      'Target by net uplift, not response rate',
      [
        { id: 'u1', label: 'user A' },
        { id: 'u2', label: 'user B' },
        { id: 'u3', label: 'user C' },
        { id: 'u4', label: 'user D' },
      ],
      [
        { id: 'pY', label: 'P(Y)' },
        { id: 'uplift', label: 'uplift' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['0.80', '+0.01', 'skip'],
        ['0.31', '+0.14', 'treat'],
        ['0.46', '-0.03', 'skip'],
        ['0.22', '+0.09', 'treat'],
      ],
    ),
    highlight: { found: ['u2:decision', 'u4:decision'], compare: ['u1:pY'], removed: ['u3:decision'] },
    explanation: 'Uplift targeting differs from ordinary response modeling. A user with high purchase probability may buy anyway, so the treatment effect is small. Target the incremental gain, not the raw outcome probability.',
  };

  yield {
    state: forestGraph('Policy targeting applies cost and capacity constraints'),
    highlight: { active: ['rank', 'policy'], found: ['cate'], compare: ['logs'] },
    explanation: 'A policy layer sorts by estimated treatment effect minus treatment cost, then applies budget, fairness, eligibility, and safety constraints.',
  };

  yield {
    state: labelMatrix(
      'Qini-style uplift buckets',
      [
        { id: 'top10', label: 'top 10%' },
        { id: 'top20', label: 'top 20%' },
        { id: 'top40', label: 'top 40%' },
        { id: 'all', label: 'all' },
      ],
      [
        { id: 'gain', label: 'gain' },
        { id: 'cost', label: 'cost' },
        { id: 'net', label: 'net' },
      ],
      [
        ['+120', '30', '+90'],
        ['+190', '70', '+120'],
        ['+230', '160', '+70'],
        ['+250', '400', '-150'],
      ],
    ),
    highlight: { found: ['top20:net'], compare: ['top40:net'], removed: ['all:net'] },
    explanation: 'The best policy may treat only a fraction of users. Uplift curves show whether the ranking concentrates incremental impact or merely finds people who would have converted anyway.',
  };

  yield {
    state: labelMatrix(
      'Complete case: retention coupon',
      [
        { id: 'log', label: 'logs' },
        { id: 'forest', label: 'forest' },
        { id: 'policy', label: 'policy' },
        { id: 'ab', label: 'A/B' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['randomized', 'best'],
        ['CATE rank', 'target'],
        ['top 20%', 'budget'],
        ['holdout', 'verify'],
      ],
    ),
    highlight: { active: ['forest:lesson', 'policy:lesson'], found: ['ab:lesson'] },
    explanation: 'Case study: a retention coupon should not go to everyone. A causal forest ranks users by expected incremental retention, the policy treats the top budget-constrained slice, and an A/B holdout verifies the gain.',
  };

  yield {
    state: forestGraph('Causal forests need causal design discipline'),
    highlight: { active: ['logs', 'nuisance', 'cate'], found: ['policy'], compare: ['split'] },
    explanation: 'The forest does not erase confounding. Randomized logs are strongest. Observational logs need propensity, outcome nuisance models, overlap checks, and doubly robust discipline.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'honest leaves') yield* honestLeaves();
  else if (view === 'uplift policy') yield* upliftPolicy();
  else throw new InputError('Pick a causal forest view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Causal Forest Uplift Policy. Estimate heterogeneous treatment effects with honest forest leaves, then target the users whose predicted uplift justifies intervention..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many interventions should not be sent to everyone. A coupon costs money. A notification can annoy a user. A retention call can waste staff time. A clinical treatment can carry risk. The useful targeting question is not "who has a high outcome probability?" It is "whose outcome changes because of the intervention?"',
        'Causal forests exist for that question. They estimate heterogeneous treatment effects: how the effect varies by covariates. A policy can then target the people whose predicted incremental gain is large enough to justify cost, capacity, and risk.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is response modeling. Train a model to predict who will buy, renew, recover, or click, then target the highest scores. That often sends treatment to people who would have acted anyway. High response is not the same as high uplift.',
        'The other obvious approach is to estimate one average treatment effect and apply it to every person. That hides the policy problem. The average may be positive while one segment benefits strongly, another segment is unaffected, and a third segment is harmed.',
        'The wall is causal identification. A forest can discover structure, but it cannot create counterfactual evidence out of nothing. Randomized treatment logs are strongest. Observational logs still need overlap, propensity modeling, outcome nuisance models, and defensible assumptions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A causal forest builds adaptive neighborhoods where treated and control outcomes can be compared locally. Instead of asking for one global effect, it asks which training examples are most relevant for estimating the effect at this user, patient, account, or case.',
        'Many honest trees create those neighborhoods. Each tree routes a unit to a leaf. Across the forest, the leaves define weights over similar examples. Those weighted examples are used to estimate the conditional average treatment effect, often called CATE.',
      ],
    },
    {
      heading: 'What to inspect in the visual',
      paragraphs: [
        'In the honest-leaves view, watch the data split into roles. Some data chooses tree structure. Different data estimates treatment effects inside the leaves. That separation is the honesty idea: the tree should not both search for a noisy effect pattern and then claim the same noise as evidence.',
        'In the uplift-policy view, focus on the ranking decision. The policy is not choosing the people with the highest raw outcome probability. It is choosing people whose estimated incremental effect, after cost and constraints, is worth acting on.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training starts with logs containing covariates X, treatment T, and outcome Y. In a randomized experiment, T came from the experiment. In observational data, treatment assignment must be modeled and checked more carefully.',
        'The forest grows trees that split on covariates to expose treatment-effect variation. Honest estimation separates split selection from effect estimation. Modern generalized random forest workflows also estimate nuisance functions: the expected outcome m(x) and the propensity e(x). Residualized comparisons reduce bias from baseline outcome differences and unequal treatment assignment.',
        'At prediction time, the forest gives a CATE estimate for each candidate. The policy layer then converts that estimate into an action: predicted uplift minus treatment cost, subject to budget, fairness, eligibility, safety, and capacity constraints.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when treatment effects vary by observed covariates and the data contains comparable treated and control evidence near the unit being scored. The forest is useful because it searches for local effect structure without forcing the analyst to hand-code every interaction.',
        'Honesty helps because effect heterogeneity is noisy. If the same rows choose the split and estimate the effect, a tree can chase random differences. Splitting the roles lowers that adaptive bias. Averaging many trees then stabilizes the local neighborhoods.',
        'The policy works because it shifts the target from raw outcome probability to incremental value. A customer with an 80 percent renewal probability and 1 percent uplift is a worse coupon target than a customer with a 31 percent renewal probability and 14 percent uplift.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The first cost is data. Honest forests spend data on split selection and effect estimation separately, so small datasets can become unstable. Leaves also need enough treated and control evidence. A beautiful tree structure is useless if a leaf has no real comparison.',
        'The second cost is causal discipline. Observational data needs overlap checks, propensity diagnostics, outcome nuisance modeling, and sensitivity analysis. Randomized holdouts are still needed to validate a targeting policy before it is trusted.',
        'The third cost is policy feedback. Once the model targets people, future data is no longer neutral. The system may stop observing untreated outcomes for high-uplift users, capacity limits can change who receives treatment, and user behavior can adapt to the policy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Causal forests win when the goal is a budgeted intervention and effects plausibly differ across people. They fit retention coupons, marketing campaigns, medical treatment targeting, collections outreach, student support programs, product nudges, and fraud review policies.',
        'They are especially useful when the organization can act on a ranked list. The value is not just an effect estimate; it is a treatment policy that can say who should be treated first under a fixed budget.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when treatment assignment is confounded by missing variables. If sales reps chose who got a discount based on private judgment that is absent from the data, the forest can learn a precise but biased targeting rule.',
        'It fails when overlap is weak. A leaf with treated examples but no comparable controls is not estimating a local treatment effect; it is extrapolating. It also fails when treatment spills over between units, outcomes arrive late, or the policy changes user behavior in ways the training data never observed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A subscription company can send a 20 percent renewal coupon to only 20,000 users. A normal response model ranks loyal users first because they have the highest renewal probability. Finance notices the campaign looks good by renewal rate but bad by profit because many targeted users would have renewed anyway.',
        'The company runs a randomized coupon experiment and trains a causal forest on pre-treatment covariates: tenure, usage trend, support tickets, plan price, prior discounts, renewal date, and product surface. The forest estimates that new price-sensitive users have +14 percentage points of renewal uplift, loyal heavy users have +1 point, and some chronic discount seekers have negative margin impact.',
        'The policy ranks users by estimated renewal uplift times margin minus coupon cost. It treats the top budget-constrained slice and keeps a randomized holdout inside each score band. The final report shows incremental renewals, net margin, and a Qini-style uplift curve. It does not report the raw renewal rate of treated users as success, because that would reward targeting people who were going to renew anyway.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep features pre-treatment. A variable measured after the coupon, message, or clinical intervention can leak the treatment effect into the model and make the policy look stronger than it is. Lock the feature timestamp before assignment, and audit every high-importance feature for leakage.',
        'Validate the policy with randomized holdouts, not only offline fit. Report incremental outcome, incremental profit or harm, treatment cost, calibration by score band, and uncertainty. A good uplift score is useful only if acting on the top band beats the next best targeting rule under the same budget and eligibility rules.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Generalized Random Forests at https://arxiv.org/pdf/1610.01271 and the grf project at https://grf-labs.github.io/grf/.',
        'Study Random Forest, Doubly Robust Estimation, Propensity Score Overlap Diagnostics, Causal Graphs, A/B Testing, and Multi-Armed Bandits next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for causal-forest-uplift-policy-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
