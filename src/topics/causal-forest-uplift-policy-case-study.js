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
        'The animation has two views. "Honest leaves" traces how a causal forest splits data into roles, grows honest trees, and estimates conditional treatment effects at the leaf level. "Uplift policy" shows the targeting decision: ranking users by predicted incremental gain and applying budget constraints to decide who receives treatment.',
        {type: 'bullets', items: [
          'Active (highlighted): the current stage in the causal pipeline -- data splitting, tree growing, leaf estimation, or policy ranking.',
          'Found (green): a result the forest has committed to -- an estimated CATE, a targeting decision, a validated gain.',
          'Compare (blue): a contrast case that clarifies the active decision -- loyal users with low uplift shown against new users with high uplift.',
          'Removed (red): a case where treatment is harmful or wasteful -- negative uplift users excluded from the policy.',
        ]},
        {type: 'note', text: 'The key visual contrast is between the honest-leaves view (how the forest estimates effects) and the uplift-policy view (how the policy acts on those estimates). The forest is a measurement tool. The policy is a decision tool. They solve different problems and fail for different reasons.'},
        'At each frame, ask: what evidence supports this treatment effect estimate, and would you trust it enough to spend real money on it?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'A causal forest is useful only when it ranks incremental treatment effect, not raw outcome likelihood, and the policy keeps testing that ranking against held-out causality.'},
        'A subscription company has 100,000 users approaching renewal and budget for 20,000 coupons. Marketing wants to send coupons to the users most likely to churn. Finance wants to send them to the users where coupons actually change behavior. These are different lists.',
        {type: 'quote', text: 'The fundamental problem of causal inference is that we can never observe the same unit in both the treated and untreated state at the same time.', attribution: 'Holland, "Statistics and Causal Inference" (1986)'},
        'A user either receives the coupon or does not. The counterfactual outcome -- what would have happened under the other assignment -- is never observed. Causal forests exist to estimate that missing counterfactual by finding the right comparison group for each individual user, not just the population average.',
        'The business value is targeting precision. A blanket treatment wastes budget on people who would have converted anyway and misses the people whose behavior actually changes. A causal forest produces a ranked list where position reflects estimated incremental impact, not raw outcome probability.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is response modeling: train a classifier to predict P(renew | features), rank users by predicted probability, and treat the bottom of the list (highest churn risk). This is not stupid -- it identifies who is likely to leave.',
        {type: 'table', headers: ['User', 'P(renew)', 'P(renew | coupon)', 'Uplift', 'Response model rank', 'Uplift rank'], rows: [
          ['Alice', '0.90', '0.91', '+0.01', '4th (low risk)', '4th'],
          ['Bob', '0.30', '0.44', '+0.14', '1st (high risk)', '1st'],
          ['Carol', '0.50', '0.47', '-0.03', '2nd', 'Exclude'],
          ['Diana', '0.85', '0.86', '+0.01', '3rd (low risk)', '3rd'],
        ]},
        'The response model sends coupons to Bob and Carol because they have the lowest renewal probability. But Carol has negative uplift -- the coupon actually reduces her renewal probability (perhaps it signals the company expects her to leave, triggering a search for alternatives). The uplift model sends coupons to Bob and Diana, treating only users where the coupon causes a positive change.',
        'The second instinct is a single average treatment effect (ATE) from an A/B test. If the average coupon effect is +4 percentage points, treat everyone. But that average hides the structure: Bob gains +14 points, Alice and Diana gain +1 point each, and Carol loses 3 points. Treating everyone wastes 80% of the budget on near-zero or negative returns.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Response models rank by P(Y), not by P(Y|T=1) - P(Y|T=0). The highest-probability users are often the ones who need treatment least. The lowest-probability users may be unreachable regardless of intervention. The model optimizes the wrong objective.',
        'Average treatment effects assume homogeneity. They answer "does the treatment work on average?" but not "for whom does the treatment work?" A positive ATE can mask a population where 20% of users gain substantially, 70% are unaffected, and 10% are harmed.',
        {type: 'note', text: 'The wall is not statistical -- it is economic. Both response models and ATEs can be estimated precisely. The problem is that precise answers to the wrong question still produce bad targeting decisions. The right question is conditional: what is the treatment effect for this specific user given their covariates?'},
        'Heterogeneous treatment effect (HTE) estimation requires comparing treated and control outcomes within local neighborhoods of the covariate space. Doing this manually -- subgroup analysis by hand-picked segments -- does not scale past a few dimensions and invites multiple-testing problems.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A causal forest uses tree structure not to predict outcomes but to partition the covariate space into regions where treatment effects are locally homogeneous. Each leaf is an adaptive neighborhood: a group of training examples similar enough that the local difference between treated and control means is a credible estimate of the conditional average treatment effect (CATE).',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/ff/Decision_tree_model.png', alt:'Decision tree model splitting examples by outlook, humidity, and wind', caption:'A causal forest is an ensemble of tree neighborhoods, but the target is local treatment effect rather than ordinary outcome classification. Source: Wikimedia Commons, T-kita, public domain.'},
        {type: 'diagram', text: '  Logs (T, Y, X)\n       |\n       +--- split sample ---> Split Set (choose tree structure)\n       |                          |\n       +--- estimate sample --> Estimate Set (compute CATE in leaves)\n       |\n       +--- nuisance ---------> m(x) = E[Y|X],  e(x) = P(T=1|X)\n                                     |\n                              Residualize: Y - m(x),  T - e(x)\n                                     |\n                              Forest of honest trees\n                                     |\n                              CATE(x) = weighted local comparison\n                                     |\n                              Policy: rank by CATE - cost, apply constraints', label: 'The generalized random forest pipeline from logs to policy'},
        'The key word is "honest." An honest tree uses one sample to decide where to split and a separate sample to estimate effects within the chosen leaves. This prevents the tree from both hunting for noisy effect patterns and then claiming that same noise as evidence -- the statistical analogue of grading your own homework.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The generalized random forest (GRF) pipeline has four stages: nuisance estimation, tree growing, effect estimation, and policy construction.',
        'Stage 1: Nuisance estimation. Estimate the baseline outcome function m(x) = E[Y|X] and propensity score e(x) = P(T=1|X) using separate cross-fitted models. These "nuisance" functions let the forest work with residualized outcomes Y - m(x) and residualized treatments T - e(x), removing the influence of baseline differences.',
        {type: 'code', text: '# GRF pseudocode (R-style, maps to grf library)\n# 1. Fit nuisance models via cross-fitting\nY.hat <- cross_fit_predict(Y ~ X)      # m(x)\nW.hat <- cross_fit_predict(T ~ X)      # e(x)\n\n# 2. Grow causal forest on residualized problem\ncf <- causal_forest(\n  X = X,\n  Y = Y,\n  W = T,\n  Y.hat = Y.hat,\n  W.hat = W.hat,\n  honesty = TRUE,              # split/estimate separation\n  num.trees = 2000\n)\n\n# 3. Predict CATE for each candidate\ntau.hat <- predict(cf, X.new)$predictions\n\n# 4. Build policy: treat if CATE > cost\ncost.per.coupon <- 5.00\npolicy <- ifelse(tau.hat * margin.per.renewal > cost.per.coupon,\n                 "treat", "skip")', language: 'r'},
        'Stage 2: Tree growing. Each tree draws a subsample without replacement and splits it into a split half and an estimate half. The split half determines the tree structure by maximizing heterogeneity in the treatment effect across children. The splitting criterion is not prediction accuracy -- it is treatment-effect variation.',
        'Stage 3: Effect estimation. The estimate half populates the leaves. For a new user x, the forest routes x through every tree, identifies the leaf in each tree, and collects the estimate-half observations that share those leaves. This produces a set of forest-weights alpha_i(x) that define the local neighborhood. The CATE estimate is a weighted local comparison of treated vs. control outcomes using those weights.',
        {type: 'note', text: 'The forest weights alpha_i(x) are the key object. Each weight says: "training observation i is relevant for estimating the treatment effect at x because many trees put them in the same leaf." The CATE is just a weighted regression on those neighbors, not a single tree prediction.'},
        'Stage 4: Policy construction. The CATE estimates rank every candidate by expected incremental value. The policy layer applies business constraints: budget caps, eligibility rules, fairness requirements, minimum effect thresholds, and capacity limits. The output is a treatment assignment list.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Three properties make the estimates trustworthy under the right conditions.',
        {type: 'bullets', items: [
          'Honesty: the data that chooses tree structure never estimates effects. This eliminates adaptive bias -- the tendency for trees to overfit to noise when the same data drives both structure and estimation.',
          'Subsampling: each tree sees a random subsample, so the forest averages over many different local comparisons. Individual trees may be noisy, but the ensemble stabilizes. Under regularity conditions, the CATE estimates are asymptotically normal with valid confidence intervals.',
          'Doubly robust residualization: by working with Y - m(x) and T - e(x), the estimator is consistent if either the outcome model or the propensity model is correctly specified. Both can be somewhat wrong and the effect estimate still converges, as long as the errors are not perfectly correlated.',
        ]},
        {type: 'quote', text: 'Generalized random forests achieve pointwise asymptotic normality under regularity conditions, enabling valid confidence intervals for heterogeneous treatment effects.', attribution: 'Athey, Tibshirani, and Wager, "Generalized Random Forests" (2019)'},
        'The policy works because it shifts the optimization target. Instead of maximizing P(Y=1), it maximizes E[Y(1) - Y(0) | X=x] -- the conditional effect. A user with 90% renewal probability and 1% uplift is a worse target than a user with 30% renewal probability and 14% uplift, because the second user is where the coupon actually changes the outcome.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'table', headers: ['Resource', 'Cost', 'What drives it'], rows: [
          ['Training time', 'O(B * n * p * log n)', 'B trees, n observations, p candidate split features, log n depth'],
          ['Prediction time', 'O(B * log n) per user', 'Route through B trees to collect leaf memberships'],
          ['Memory', 'O(B * n) for forest weights', 'Each tree stores leaf assignments for the estimate sample'],
          ['Data requirement', '~2x a standard forest', 'Honesty splits each subsample in half; each half needs treated + control units'],
          ['Nuisance estimation', 'Separate model fitting cost', 'Cross-fitted outcome and propensity models add a full modeling step'],
        ]},
        'The practical bottleneck is rarely compute. It is data. Each honest leaf needs enough treated and control observations to estimate a local mean difference with tolerable variance. With 10 covariates and 2,000 trees, a dataset under 5,000 observations often produces CATE estimates too noisy to rank on. At 50,000 observations with balanced treatment, the estimates stabilize meaningfully.',
        {type: 'note', text: 'Rule of thumb: if your randomized experiment was too small to detect the ATE with confidence, a causal forest will not magically detect heterogeneous effects. The forest partitions the data further, so it needs more observations per subgroup than the aggregate test needed overall.'},
        'Policy evaluation adds its own cost. The targeting rule must be validated on held-out data or, better, a randomized holdout within the deployed policy. Offline evaluation with inverse-propensity weighting or doubly robust estimators is possible but sensitive to propensity estimation quality at the tails.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A SaaS company wants to reduce annual churn with a 20% renewal discount. Budget covers 20,000 of 100,000 eligible users. The marketing team previously used a churn-risk model: target the 20,000 most likely to churn.',
        {type: 'table', headers: ['Metric', 'Churn-risk targeting', 'Causal forest targeting'], rows: [
          ['Coupons sent', '20,000', '20,000'],
          ['Incremental renewals', '~800', '~2,400'],
          ['Cost per incremental renewal', '$125', '$42'],
          ['Net margin impact', '-$200K (many would churn regardless)', '+$480K'],
          ['Coupon waste (user would renew anyway)', '~3,000', '~1,200'],
        ]},
        'The churn-risk model sent coupons to deeply disengaged users. Many of them churned despite the coupon (low uplift). It also missed moderately engaged users where the coupon tipped the decision (high uplift but not high churn risk).',
        'The causal forest pipeline:',
        {type: 'bullets', items: [
          'Step 1: Run a 10% randomized coupon holdout for 8 weeks. Collect renewal outcomes, treatment assignment, and 15 pre-treatment covariates (tenure, usage frequency, support tickets, plan tier, price sensitivity index, last login recency, feature adoption breadth, contract type, prior discount history, payment method, company size, industry, referral source, device mix, NPS score).',
          'Step 2: Fit cross-validated nuisance models for E[renew | X] and P(coupon | X). The propensity model should be nearly flat (10% treatment rate by design) but verifying uniformity catches assignment bugs.',
          'Step 3: Train a causal forest with 2,000 honest trees. Extract CATE estimates and 95% confidence intervals for all 100,000 users.',
          'Step 4: Rank users by (CATE * annual_margin) - coupon_cost. Apply constraints: exclude users with pending support escalations, cap at 20,000 treatments, ensure demographic parity across pricing tiers.',
          'Step 5: Deploy with a 5% within-policy holdout. Compare renewal rates in the treated-by-policy group vs. the within-policy holdout to measure actual incremental impact.',
        ]},
        {type: 'code', text: '# Policy scoring (simplified)\nfor user in candidates:\n  tau = cf.predict(user.features)         # CATE estimate\n  ci  = cf.predict_ci(user.features)      # 95% confidence interval\n  net_value = tau * user.annual_margin - coupon_cost\n  user.score = net_value\n  user.ci_lower = ci[0] * user.annual_margin - coupon_cost\n\n# Rank and apply constraints\nranked = sorted(candidates, key=lambda u: u.score, reverse=True)\npolicy = []\nfor user in ranked:\n  if len(policy) >= budget: break\n  if user.has_pending_escalation: continue\n  if user.ci_lower < 0 and conservative_mode: continue\n  policy.append(user)', language: 'python'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'table', headers: ['Domain', 'Treatment', 'Outcome', 'Why HTE matters'], rows: [
          ['SaaS retention', 'Renewal discount', 'Retained/churned', 'Loyal users renew without the coupon; discount-seekers learn to wait for offers'],
          ['Clinical trials', 'Drug/dosage', 'Recovery/adverse event', 'Treatment may help one genotype, harm another; blanket prescription is dangerous'],
          ['Education', 'Tutoring program', 'Test score gain', 'Advanced students gain less; struggling students may need a different intervention type'],
          ['Collections', 'Outreach call', 'Payment/default', 'Some debtors pay when contacted; others perceive the call as harassment and disengage'],
          ['Ad targeting', 'Display ad', 'Purchase', 'Brand-loyal users buy anyway; ad-averse users are annoyed; persuadable users are the only profitable targets'],
          ['Public policy', 'Job training subsidy', 'Employment', 'Workers with some skills gain most; those without need prerequisite education first'],
        ]},
        'The common thread: treatment has a cost (money, risk, annoyance, staff time), the effect varies across people, and the organization can only treat a subset. Causal forests turn heterogeneous effects into a ranked targeting list.',
        {type: 'note', text: 'Causal forests are not limited to binary treatments. The GRF framework extends to continuous treatments (dose-response), instrumental variables (encouragement designs), and local average treatment effects (LATE). The policy layer changes accordingly -- instead of treat/skip, it becomes dose optimization or instrument selection.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Failure modes fall into three categories: identification failures, estimation failures, and deployment failures.',
        {type: 'table', headers: ['Failure mode', 'Symptom', 'Consequence'], rows: [
          ['Unobserved confounding', 'Treatment assignment correlates with unmeasured variables', 'CATE estimates are biased; policy targets the wrong users'],
          ['Overlap violation', 'Some covariate regions have only treated or only control units', 'Leaves extrapolate instead of comparing; variance explodes'],
          ['Small samples in leaves', 'Wide confidence intervals, unstable rankings', 'Policy ranking is noise; top-20% list changes on resample'],
          ['Post-treatment features', 'A covariate measured after treatment leaks the effect', 'CATE looks huge but reflects outcome contamination, not real uplift'],
          ['Spillover/interference', 'Treating user A changes user B\'s outcome', 'SUTVA violated; individual CATE estimates are not meaningful'],
          ['Policy feedback loops', 'Deployed policy changes the data distribution', 'Future training data is biased toward treated-by-policy users'],
        ]},
        {type: 'diagram', text: '  Confounding check:\n\n  Sales rep judgment (unobserved)\n        |           |\n        v           v\n  Discount (T)   Renewal (Y)\n        |           ^\n        +-----------+\n            ^\n        X (observed covariates)\n\n  If rep judgment drives both T and Y but is absent from X,\n  the forest learns the rep\'s selection bias, not the coupon effect.\n  The CATE will be high for users reps already believed would renew.', label: 'Unobserved confounding invalidates CATE even with perfect estimation'},
        'The most common production failure is not statistical -- it is organizational. Teams deploy the policy, stop running holdouts because "we already proved it works," and the model drifts without detection. The fix is permanent randomized holdouts: always treat a small random fraction outside the policy to maintain an unbiased benchmark.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {type: 'bullets', items: [
          'Lock feature timestamps before treatment assignment. Any covariate measured after the coupon was sent can leak the treatment effect. Audit the top-10 most important features for temporal leakage.',
          'Check overlap before training. Plot propensity score distributions for treated and control groups. If they barely overlap in some covariate region, the forest cannot estimate effects there -- trim or flag those regions.',
          'Use cross-fitting for nuisance models. K-fold cross-fitting prevents overfitting the outcome and propensity models to the same data the forest will train on. K=5 is standard.',
          'Report confidence intervals, not just point estimates. A CATE of +0.12 with a 95% CI of [-0.05, +0.29] should not be ranked the same as a CATE of +0.08 with a CI of [+0.04, +0.12]. Consider ranking by the lower bound of the CI for conservative policies.',
          'Validate with calibration plots. Bin users by predicted CATE decile, compute the actual treatment effect within each bin (using the holdout), and check that the ranking is monotone. A flat calibration curve means the forest found no actionable heterogeneity.',
        ]},
        {type: 'code', text: '# Calibration check: does predicted CATE rank match actual effect?\nimport numpy as np\n\ndeciles = np.quantile(tau_hat, np.arange(0.1, 1.1, 0.1))\nfor i, (lo, hi) in enumerate(zip([tau_hat.min()] + list(deciles), deciles)):\n  mask = (tau_hat >= lo) & (tau_hat < hi)\n  treated = (Y[mask & (T == 1)]).mean()\n  control = (Y[mask & (T == 0)]).mean()\n  actual_effect = treated - control\n  predicted_avg = tau_hat[mask].mean()\n  print(f"Decile {i+1}: predicted={predicted_avg:.3f}  actual={actual_effect:.3f}")\n\n# Good: actual effect increases monotonically with predicted CATE\n# Bad:  actual effect is flat or non-monotonic => forest found no real heterogeneity', language: 'python'},
        {type: 'note', text: 'The most important diagnostic is the simplest: does acting on the top CATE band produce better incremental outcomes than treating a random subset of the same size? If not, the heterogeneity is either absent or too noisy to exploit, and a flat policy (treat random 20%) is the honest recommendation.'},
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'bullets', items: [
          'Athey, Tibshirani, and Wager, "Generalized Random Forests," Annals of Statistics (2019). The foundational paper: proves asymptotic normality, introduces honesty and the forest-weight framework. https://arxiv.org/abs/1610.01271',
          'The grf R package: production implementation with causal_forest(), predict(), and diagnostic tools. https://grf-labs.github.io/grf/',
          'EconML Python library (Microsoft Research): CausalForestDML class implements the doubly robust causal forest for Python users. https://econml.azurewebsites.net/',
          'Athey and Imbens, "Recursive Partitioning for Heterogeneous Causal Effects," PNAS (2016). The honest causal tree paper that preceded GRF.',
          'Radcliffe and Surry, "Real-World Uplift Modelling with Significance-Based Uplift Trees," Stochastic Solutions white paper (2011). Early practical uplift modeling with Qini curves and net-value targeting.',
        ]},
        'Study next by role:',
        {type: 'bullets', items: [
          'Prerequisite: Random Forest (bagging, subsampling, ensemble averaging), A/B Testing (randomized treatment assignment, power analysis).',
          'Estimation foundations: Doubly Robust Estimation (why residualizing protects against partial model misspecification), Propensity Score (overlap, trimming, IPW).',
          'Extensions: Multi-Armed Bandits (adaptive treatment assignment that learns while treating), Policy Learning (optimal treatment rules beyond simple CATE ranking).',
          'Diagnostics: Causal Graphs (DAGs for identifying confounding paths), Regression Discontinuity (when treatment is assigned by a threshold, not randomization).',
        ]},
      ],
    },
  ],
};
