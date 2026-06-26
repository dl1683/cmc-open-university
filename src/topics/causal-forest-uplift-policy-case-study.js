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
        'The animation shows a causal forest, which is a set of decision trees used to estimate treatment effect for different kinds of users. A treatment is an action such as a coupon, email, feature, or policy. Uplift means the extra outcome caused by the treatment compared with doing nothing.',
        'Watch the forest view as a measurement process, not as an ordinary prediction model. A highlighted leaf is a local comparison group, the green result is an estimated conditional average treatment effect, and the policy view spends budget only where the estimated gain beats the cost.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'A causal forest is useful only when it ranks incremental treatment effect, not raw outcome likelihood, and the policy keeps testing that ranking against held-out causality.'},
        'A company often has limited budget for an intervention. It may have 100,000 customers near renewal and only enough money to give 20,000 discounts. The useful question is not who is likely to renew; it is whose renewal probability changes because of the discount.',
        'The missing fact is the counterfactual outcome, which means the outcome that would have happened under the other choice. One customer cannot both receive and not receive the same coupon at the same time. Causal forests exist to build local comparison groups that make that missing outcome estimable.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a response model. Train a classifier to predict renewal probability, sort users by churn risk, and send discounts to the users most likely to leave. That is reasonable because churn risk is visible and easy to validate from historical labels.',
        'A second obvious approach is one average treatment effect from an A/B test. If the experiment says coupons raise renewal by 4 percentage points on average, the team treats everyone it can afford. The average is real, but it hides whether the effect comes from a narrow group or spreads across the population.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Response probability and treatment effect are different targets. A loyal user with 90 percent renewal probability might rise to 91 percent with a coupon, while a risky user with 30 percent probability might rise to 44 percent. The second user is the better target even though the first user has the higher raw outcome probability.',
        'Manual subgroup analysis also breaks down. Splitting users by age, region, tenure, plan, and activity creates many small cells, and noise starts to look like discovery. The system needs adaptive neighborhoods that are learned from data while keeping the effect estimate honest.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A causal forest uses tree leaves as local neighborhoods for causal comparison. Each tree groups similar users, then the forest estimates how treated outcomes differ from control outcomes near the user being scored. The prediction is a conditional average treatment effect, usually shortened to CATE.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/ff/Decision_tree_model.png', alt:'Decision tree model splitting examples by outlook, humidity, and wind', caption:'A causal forest is an ensemble of tree neighborhoods, but the target is local treatment effect rather than ordinary outcome classification. Source: Wikimedia Commons, T-kita, public domain.'},
        'The key guardrail is honesty. One sample can choose the tree splits, while a separate sample estimates effects inside the resulting leaves. That separation reduces the chance that the model finds random effect patterns and then counts the same noise as evidence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training data contains features X, a treatment flag T, and an outcome Y. The model first estimates baseline outcome and treatment propensity, which means the probability that a unit receives treatment. Those estimates help remove predictable background differences before the forest compares treated and untreated outcomes.',
        'Each tree chooses splits that make treatment effects differ across child nodes. For a new user, the forest routes the user through many trees and collects training examples that land in the same leaves. Those examples become weighted neighbors for a local treated-versus-control comparison.',
        'The policy layer then converts effect into value. If a renewal is worth 120 dollars of margin and a coupon costs 10 dollars, a user with estimated uplift above 8.33 percentage points has positive expected value before other constraints. Budget, eligibility, fairness rules, and capacity limits are applied after the effect estimate.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local comparability. Within the weighted neighborhood around a user, treated and untreated examples should be similar except for treatment assignment after adjustment. If that condition holds, the local outcome difference estimates the user-level treatment effect rather than baseline risk.',
        'Honest splitting supports that argument because the data that discovers a promising split is not reused to measure the effect in that split. Subsampling and averaging reduce variance across many noisy trees. The policy is correct only in the weaker operational sense: it acts on the best available effect ranking and keeps validating that ranking on held-out randomized traffic.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training cost grows with the number of trees, rows, features considered at splits, and tree depth. Doubling rows usually more than doubles training work because each tree has more candidates to split and more examples to route. Prediction is cheaper but still routes each candidate through every tree.',
        'The real cost is data discipline. The system needs randomized or well-controlled treatment assignment, enough treated and control examples inside neighborhoods, stable logging, and monitoring for policy feedback. Once the policy starts targeting high-uplift users, future data can become biased unless the team reserves exploration traffic.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Causal forests fit retention offers, credit-line changes, medical treatment selection, public policy targeting, and product experiments where the action has a cost or risk. They are most useful when the system can randomize some decisions and observe outcomes reliably. They are poor substitutes for randomized trials when the logs are confounded beyond repair.',
        'The pattern also appears in policy learning. The model estimates individual effect, then a separate decision rule spends limited resources where effect minus cost is highest. That separation keeps measurement and allocation from being confused.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when treatment assignment is badly confounded and the model cannot adjust for the missing reason. If sales reps gave discounts only to angry customers, and anger was never logged, the forest may mistake salesperson judgment for coupon effect. More trees do not fix missing causal information.',
        'It also fails when effects are too small for the available sample. A leaf with 12 treated users and 9 controls cannot support a precise estimate for a tiny uplift. In production, another failure is using the uplift ranking forever without fresh randomized holdout traffic.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume 10,000 renewal users, a coupon cost of 10 dollars, and renewal margin of 120 dollars. A response model chooses 2,000 highest-risk users with average renewal probability of 30 percent, but the experiment shows their coupon uplift is only 3 percentage points. Expected incremental value is 0.03 * 120 - 10, or minus 6.40 dollars per treated user.',
        'A causal forest finds 1,500 users with estimated uplift of 14 percentage points and 500 users with estimated uplift of 9 percentage points. The expected gains are 6.80 dollars and 0.80 dollars per user after coupon cost. Spending the same 20,000 dollars now targets 11,600 dollars of expected net value instead of a loss, subject to validation on a holdout.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Wager and Athey, "Estimation and Inference of Heterogeneous Treatment Effects using Random Forests"; Athey, Tibshirani, and Wager, "Generalized Random Forests"; and Holland, "Statistics and Causal Inference." Study randomized experiments before using causal forests on observational logs.',
        'Study next: propensity scores for treatment assignment, doubly robust estimation for adjustment, uplift modeling for targeting, policy evaluation for budgeted decisions, and exploration systems for keeping future data causal.',
      ],
    },
  ],
};
