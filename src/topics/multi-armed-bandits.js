// Multi-armed bandits: A/B testing that learns WHILE it runs. Instead of
// splitting traffic evenly until a verdict, shift traffic toward whatever
// is winning — and pay only a small "exploration tax" to stay honest.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-armed-bandits',
  title: 'Multi-Armed Bandits',
  category: 'AI & ML',
  summary: 'Explore a little, exploit a lot — adaptive experiments that stop wasting traffic on losers.',
  controls: [
    { id: 'epsilon', label: 'Exploration rate ε', type: 'select', options: ['20%', '10%'], defaultValue: '20%' },
  ],
  run,
};

// True (unknown to the algorithm!) conversion rates of three button variants.
const ARMS = [
  { id: 'A', rate: 0.04 },
  { id: 'B', rate: 0.06 },
  { id: 'C', rate: 0.05 },
];
const ROUND_TRAFFIC = 300;
const ROUNDS = 6;

export function* run(input) {
  const eps = String(input.epsilon) === '20%' ? 0.2 : String(input.epsilon) === '10%' ? 0.1 : null;
  if (eps === null) throw new InputError('Pick an exploration rate.');

  const pulls = [0, 0, 0];
  const wins = [0, 0, 0];
  const est = (i) => (pulls[i] === 0 ? 0 : (wins[i] / pulls[i]) * 100);
  const rows = ARMS.map((a) => ({ id: `arm${a.id}`, label: a.id }));
  const cols = [{ id: 'pulls', label: 'visitors' }, { id: 'wins', label: 'converted' }, { id: 'est', label: 'est. %' }];
  const snapshot = (title) => matrixState({
    title, rows, columns: cols,
    values: ARMS.map((_, i) => [pulls[i], wins[i], Math.round(est(i) * 10) / 10]),
  });

  yield {
    state: snapshot('Three variants, three unknown conversion rates'),
    highlight: {},
    explanation: `Three checkout buttons; their TRUE conversion rates (4%, 6%, 5%) are unknown to us. Classic A/B Testing & p-values splits traffic evenly until significance — rigorous, but every visitor sent to a loser while you wait is money burned. The bandit asks: why not LEARN while serving? ε-greedy, the simplest version: send ε = ${eps * 100}% of traffic to explore all arms evenly, and the rest to whichever arm currently LOOKS best.`,
  };

  let uniformWins = 0;
  for (let round = 1; round <= ROUNDS; round += 1) {
    const explore = Math.floor((eps * ROUND_TRAFFIC) / ARMS.length);
    const best = est(0) >= est(1) && est(0) >= est(2) ? 0 : est(1) >= est(2) ? 1 : 2;
    const alloc = ARMS.map((_, i) => explore + (i === best ? ROUND_TRAFFIC - explore * ARMS.length : 0));
    ARMS.forEach((arm, i) => {
      pulls[i] += alloc[i];
      wins[i] += Math.round(arm.rate * alloc[i]);
      uniformWins += Math.round(arm.rate * (ROUND_TRAFFIC / ARMS.length));
    });
    yield {
      state: snapshot(`Round ${round}: ${alloc.map((a, i) => `${ARMS[i].id}:${a}`).join('  ')}`),
      highlight: { active: [`arm${ARMS[best].id}:pulls`], found: rows.map((r) => `${r.id}:est`) },
      explanation: `Round ${round} (${ROUND_TRAFFIC} visitors): ${round === 1 ? `no estimates yet, so the exploit share goes to the first arm by default -- early rounds are noisy and that is fine` : `current leader is ${ARMS[best].id} (estimated ${est(best).toFixed(1)}%), so it receives ${alloc[best]} visitors while ${explore} each keep auditing the others`}. The explore share is the honesty tax: without it, a lucky early streak on a bad arm could lock in forever.`,
      invariant: 'Every arm keeps receiving some traffic — estimates never stop improving.',
    };
  }

  const banditWins = wins.reduce((a, b) => a + b, 0);
  const bestArm = ARMS.reduce((m, a, i) => (est(i) > est(m.i) ? { i, id: a.id } : m), { i: 0, id: 'A' });
  yield {
    state: snapshot('After 1,800 visitors'),
    highlight: { found: [`arm${bestArm.id}:pulls`, `arm${bestArm.id}:wins`, `arm${bestArm.id}:est`] },
    explanation: `The bandit found B (estimates: ${ARMS.map((a, i) => `${a.id} ${est(i).toFixed(1)}%`).join(', ')} — true rates 4/6/5) AND earned while learning: ${banditWins} conversions versus ${uniformWins} from an even three-way split — ${banditWins - uniformWins} extra sales that classic testing would have burned as "experiment cost". The gap between what you earned and what all-B-from-day-one would have earned is called REGRET; bandit algorithms are judged by how slowly it grows.`,
  };

  yield {
    state: snapshot('The explore/exploit spectrum'),
    highlight: {},
    explanation: 'ε-greedy explores blindly; smarter bandits explore PROPORTIONALLY TO UNCERTAINTY -- UCB picks the arm with the highest plausible value ("optimism under uncertainty"), Thompson sampling draws from each arm belief distribution. This is the explore/exploit dilemma of Value Iteration (Reinforcement Learning) in its purest form, and it runs everywhere decisions repeat: headline selection at news sites, ad ranking, Netflix artwork. The honest trade-off versus A/B Testing & p-values: bandits maximize earnings but their adaptive traffic makes clean statistical inference harder -- optimize with bandits, PROVE with fixed experiments.',
  };
}

export const article = {
  references: [
    { title: 'Robbins, H. "Some Aspects of the Sequential Design of Experiments" (1952)', url: 'https://doi.org/10.1090/S0002-9904-1952-09620-8' },
    { title: 'Auer, P. et al. "Finite-time Analysis of the Multiarmed Bandit Problem" (2002)', url: 'https://doi.org/10.1023/A:1013689704352' },
    { title: 'Chapelle, O. & Li, L. "An Empirical Evaluation of Thompson Sampling" (NeurIPS 2011)', url: 'https://proceedings.neurips.cc/paper/2011/hash/e53a0a2978c28872a4505bdb51db06dc-Abstract.html' },
    { title: 'Slivkins, A. "Introduction to Multi-Armed Bandits" (2019)', url: 'https://arxiv.org/abs/1904.07272' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'A bandit policy is an experiment ledger that turns uncertainty into traffic allocation every round.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Slot_machine.jpg', alt: 'Slot machine front panel with spinning reels', caption: 'The bandit name comes from choosing among slot-machine arms with unknown payoff rates. Source: Wikimedia Commons, Jeff Kubina, CC BY-SA 2.0.'},
        'The table is a live experiment ledger with three arms (A, B, C). Each row tracks one checkout-button variant. Columns show visitors sent, conversions observed, and the current estimated conversion rate.',
        {
          type: 'bullets',
          items: [
            'Active cells (highlighted) show the arm receiving the exploit share this round -- the current leader by estimated conversion rate.',
            'Found cells (green) show estimated rates updating after each batch of visitors. These are empirical means, not final verdicts.',
            'The title bar shows the per-arm traffic allocation for each round, so you can see the explore/exploit split in real numbers.',
          ],
        },
        'Watch how the exploit share shifts between arms as estimates change. In early rounds, noise dominates and the leader may be wrong. In later rounds, the true best arm (B at 6%) captures most traffic while A and C keep receiving the exploration tax. The final frame compares bandit conversions against an equal-split baseline.',
        {
          type: 'note',
          text: 'The true conversion rates (A=4%, B=6%, C=5%) are hidden from the algorithm. The animation uses deterministic rounding for reproducibility, so estimates converge cleanly. Real traffic would show more noise, which is exactly why exploration must never stop completely.',
        },
      
        {type: 'image', src: './assets/gifs/multi-armed-bandits.gif', alt: 'Animated walkthrough of the multi armed bandits visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Any system that repeatedly chooses between options with unknown payoffs faces a cost: time spent learning is time not spent earning. A website testing three checkout buttons, a news site rotating headlines, an ad platform selecting creatives -- each visitor routed to a weak option is revenue lost. The question is whether the system can learn and earn simultaneously instead of freezing traffic in an experiment and paying the full price of ignorance until it ends.',
        {
          type: 'quote',
          text: 'Every visitor sent to a losing variant while you wait for significance is money you will never get back.',
          attribution: 'The opportunity cost that motivates adaptive experimentation',
        },
        'The multi-armed bandit is the smallest formal model of this tension. There are k choices (arms). Each arm pays a reward drawn from an unknown distribution. The learner picks one arm per round, observes the reward, and updates its beliefs. The goal is not just to identify the best arm -- it is to accumulate as much total reward as possible while learning. That accumulated loss relative to always playing the best arm is called regret, and it is the single number bandit algorithms are judged by.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Run a fixed A/B/n test. Split traffic evenly across all variants, wait until sample sizes are large enough for statistical significance, then deploy the winner. This is the standard randomized controlled trial applied to product decisions.',
        {
          type: 'diagram',
          label: 'Fixed A/B/n test: equal allocation for the entire experiment duration',
          text: [
            '  Round 1    Round 2    Round 3    Round 4    Round 5    Round 6',
            '  A: 100     A: 100     A: 100     A: 100     A: 100     A: 100',
            '  B: 100     B: 100     B: 100     B: 100     B: 100     B: 100',
            '  C: 100     C: 100     C: 100     C: 100     C: 100     C: 100',
            '',
            '  Total: 1,800 visitors.  Each arm gets exactly 600.',
            '  Arm A (4%) converts ~24.  Arm B (6%) converts ~36.  Arm C (5%) converts ~30.',
            '  Total conversions from equal split: ~90.',
          ].join('\n'),
        },
        'The design is clean. Each arm gets identical exposure, so standard statistical tests apply directly. If the goal is to produce a defensible causal estimate -- "B converts 2 percentage points higher than A with 95% confidence" -- this is the right tool. It separates the learning phase from the deployment phase.',
        'For pure measurement, a fixed split is hard to beat. The trouble is that measurement and earning are different objectives, and an even split optimizes only the first.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fixed split keeps sending equal traffic to every arm for the entire experiment, even after early evidence makes some arms look clearly worse. In this animation, arm A converts at 4%. After round 2, the estimate is already near 4%, yet the equal split continues routing 100 visitors per round to A for four more rounds. Those 400 visitors could have gone to B or C and earned more conversions.',
        {
          type: 'bullets',
          items: [
            'Worst-arm exposure: a fixed equal split sends about 600 visitors to A; epsilon-greedy with e=0.2 sends about 140.',
            'Best-arm exposure: a fixed split sends about 600 visitors to B; epsilon-greedy sends about 1,400 once B leads.',
            'Reward: the toy run earns about 97 conversions under epsilon-greedy versus about 90 under equal split.',
            'Inference: equal split gives cleaner p-value analysis; adaptive allocation needs propensity-aware analysis.',
          ],
        },
        'The wall is that equal allocation maximizes inferential cleanliness at the cost of cumulative reward. Every round of equal traffic to a known-weak arm is a payment for symmetry the system no longer needs. The gap between what you earned and what you would have earned by always playing the best arm is regret, and a fixed split accumulates regret linearly in the number of rounds spent on inferior arms.',
        {
          type: 'note',
          text: 'This is not a flaw in A/B testing -- it is a different objective. A/B tests optimize for proof quality. Bandits optimize for cumulative reward. The wall appears only when you want both at once and realize equal allocation cannot deliver both.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Epsilon-greedy splits each round into two budgets: an exploration share and an exploitation share.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Each round with T visitors and k arms:\nexplore_per_arm = floor(epsilon * T / k);\nbest = argmax(estimated_rate);  // current empirical leader\n\n// Exploration: spread epsilon*T visitors evenly across all arms\n// Exploitation: send the remaining visitors to the current best\nalloc[i] = explore_per_arm + (i === best ? T - explore_per_arm * k : 0);',
        },
        'The exploration share (epsilon of total traffic) is divided equally among all arms. This is the honesty tax: it guarantees every arm keeps receiving observations, so a lucky or unlucky early streak cannot permanently lock in a wrong leader. The exploitation share (1 - epsilon of total traffic) goes entirely to whichever arm has the highest estimated conversion rate right now.',
        {
          type: 'diagram',
          label: 'Epsilon-greedy allocation with e=0.2 and 300 visitors per round',
          text: [
            '  explore_per_arm = floor(0.2 * 300 / 3) = 20',
            '',
            '  If B is the current leader:',
            '    A gets  20  visitors  (explore only)',
            '    B gets 260  visitors  (20 explore + 240 exploit)',
            '    C gets  20  visitors  (explore only)',
            '',
            '  Invariant: every arm receives >= 20 visitors per round.',
            '  No arm can be permanently starved of data.',
          ].join('\n'),
        },
        'The algorithm maintains three numbers per arm: total pulls, total wins, and the ratio (estimated rate). After each round, these update and the leader may change. In round 1, there are no prior estimates, so ties break arbitrarily -- the exploit share goes to the first arm by default. This is intentionally naive. The exploration share still seeds the other arms with data, and by round 2 the estimates have enough signal to route traffic usefully.',
        'The key invariant: every arm receives at least explore_per_arm visitors every round. Estimates never stop improving. A bad arm is not abandoned -- it is demoted to audit-level traffic while the best arm earns.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density functions', caption: 'Uncertainty-aware bandits keep testing arms whose plausible payoff range is still wide. Source: Wikimedia Commons, Inductiveload, public domain.'},
        'Epsilon-greedy works because it prevents two failure modes simultaneously. The exploration share prevents total ignorance: no arm can go unobserved, so the system always has fresh evidence to correct mistakes. The exploitation share converts that evidence into reward: most traffic goes to the arm with the best current estimate, so the system earns while it learns.',
        {
          type: 'quote',
          text: 'Exploration without exploitation wastes resources. Exploitation without exploration locks in mistakes. The epsilon split is the simplest contract that prevents both.',
          attribution: 'The explore-exploit invariant',
        },
        'If the reward distributions are stationary (arm payoffs do not change over time) and exploration continues indefinitely, the law of large numbers guarantees that estimated conversion rates converge to true rates. Once estimates are accurate, the exploit share routes almost all traffic to the true best arm. Regret accumulates only from the exploration tax and from early rounds where the wrong arm led.',
        'The method is not regret-optimal. A fixed epsilon keeps spending exploration traffic on clearly inferior arms forever, so cumulative regret grows linearly with time (O(T) for T rounds). Decaying epsilon -- reducing exploration as confidence grows -- can improve this to O(log T). UCB and Thompson sampling achieve O(log T) regret without manual decay schedules by making exploration proportional to uncertainty rather than fixed.',
        {
          type: 'bullets',
          items: [
            'Fixed epsilon-greedy: explores uniformly with probability e, is easy to deploy, but keeps paying exploration tax forever.',
            'Decaying epsilon-greedy: shrinks e over time, improving regret when the environment is stationary.',
            'UCB1: picks the arm with empirical mean plus confidence bonus, so exploration follows uncertainty.',
            'Thompson sampling: samples from each posterior and chooses the highest draw, so uncertain arms still win traffic sometimes.',
          ],
        },
        'UCB works by adding a confidence bonus proportional to sqrt(log(t) / n_i) to each arm estimate, where t is total pulls and n_i is pulls for arm i. Under-sampled arms get a larger bonus, so they are tried until uncertainty shrinks. Thompson sampling maintains a Beta distribution for each arm and draws a random sample from each; uncertain arms sometimes produce high samples and get tried. Both make exploration responsive to evidence rather than blind.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Standard deviation regions under a normal distribution', caption: 'The engineering cost is not arithmetic; it is logging enough uncertainty and exposure information to analyze adaptive decisions later. Source: Wikimedia Commons, M. W. Toews, public domain.'},
        {
          type: 'bullets',
          items: [
            'Epsilon-greedy selection: O(k) time and O(k) space for counts and totals.',
            'UCB1 selection: O(k) time and O(k) space for counts, totals, and confidence terms.',
            'Thompson sampling selection: O(k) time and O(k) space for posterior parameters per arm.',
            'Reward update: O(1) in-place increment for the selected arm.',
            'Contextual LinUCB: O(k * d^2) time and space when each arm tracks a d-dimensional covariance matrix.',
          ],
        },
        'For product experiments with k in the range of 2-10 arms, the computational cost is negligible. The bottleneck is measurement quality, not CPU time. What matters is the logging infrastructure.',
        {
          type: 'note',
          text: 'A production bandit log must record: decision ID, timestamp, eligible arms, chosen arm, action probability (the propensity score), reward definition, reward value, reward delay, policy version, and any context features. Without the action probability, off-policy evaluation later becomes much harder or impossible. This is the most commonly omitted field and the most expensive to reconstruct.',
        },
        'Contextual bandits scale differently. Instead of one scalar mean per arm, the policy estimates reward conditioned on a feature vector (user segment, device, page location). LinUCB maintains a d-by-d matrix per arm, where d is the feature dimension. With 10 arms and 50 features, that is 10 matrices of size 50x50 = 25,000 floats -- still small, but the per-decision cost grows as O(k * d^2) for the matrix-vector operations.',
        'Memory is rarely the constraint. The real cost is the reward delay. If the reward (a purchase, a subscription renewal, a 30-day retention event) arrives hours or days after the decision, the policy update loop is slow and the system must handle partial feedback. Bandits work best when rewards arrive within the decision cycle.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Bandits win when four conditions hold: decisions repeat at volume, rewards arrive fast enough to update the policy, arms are cheap to try, and the cost of serving a weak arm is real.',
        {
          type: 'bullets',
          items: [
            'Ad creative allocation -- dozens of creatives, fast click/conversion signals, each impression on a weak ad is wasted spend.',
            'Headline and thumbnail testing -- news sites rotate hundreds of headlines daily; waiting for fixed-sample significance on each wastes peak-traffic hours.',
            'Recommendation slots -- Netflix artwork selection, Spotify playlist covers, app store feature banners. The reward (click-through) is immediate.',
            'Notification copy and onboarding flows -- small copy changes compound over millions of sends; bandits converge faster than sequential A/B tests.',
            'Model routing -- choose which ML model variant serves a request based on observed quality/latency tradeoffs.',
            'Hyperparameter tuning -- Bayesian optimization is a contextual bandit over the parameter space.',
          ],
        },
        'Bandits are especially useful as a controlled rollout mechanism. Instead of a binary launch decision, a bandit gradually shifts traffic toward winners while keeping audit traffic on alternatives. If a previously winning arm degrades (code change, seasonality, inventory shift), the exploration share detects the change and the exploit share follows. This converts experimentation from a separate phase into part of normal operation.',
        'Bandits are also the conceptual bridge to reinforcement learning. In a bandit, the action affects only the immediate reward. In RL, the action also changes the future state. Learning bandits first isolates exploration, uncertainty, and regret before adding delayed consequences and state transitions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'quote',
          text: 'Optimize with bandits. Prove with experiments designed for proof.',
          attribution: 'The fundamental tradeoff between adaptive allocation and clean inference',
        },
        'Bandits fail in five specific ways:',
        {
          type: 'bullets',
          items: [
            'Delayed rewards -- if a purchase arrives days after the click, a policy updating on immediate clicks optimizes the wrong signal. The feedback loop is too slow for the decision cycle.',
            'Nonstationarity -- weekday/weekend traffic, seasonality, novelty effects, inventory changes, and competitor actions make old estimates misleading. A fixed epsilon cannot distinguish "arm B degraded" from "arm B had a noisy batch."',
            'Narrow reward definitions -- a headline bandit maximizing clicks can damage trust. A recommender maximizing watch time can reduce user welfare. An ad system can exploit demographic correlations. The reward function encodes values whether you intended it to or not.',
            'Inferential demands -- adaptive allocation changes the exposure probability based on earlier outcomes, which breaks the assumptions behind standard p-values and confidence intervals. If the organization needs a defensible causal estimate, the adaptive log requires propensity weighting, doubly robust estimators, or a follow-up fixed experiment.',
            'Small effect sizes with few arms -- when the true difference between arms is tiny (e.g., 5.0% vs 5.1%), a bandit needs enormous sample sizes to detect the difference, and the reward gain from adaptive allocation is negligible. A fixed A/B test with proper power analysis is simpler and equally effective.',
          ],
        },
        {
          type: 'note',
          text: 'The ethical failure mode deserves emphasis. A treatment allocation system (medical trials, loan approvals, content moderation thresholds) can harm people if the reward signal is misspecified or if safety constraints are weaker than reward maximization. Bandits are optimization tools, not safety tools. Safety constraints must be enforced outside the bandit loop.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Robbins 1952, "Some Aspects of the Sequential Design of Experiments": original sequential-allocation framing for the bandit problem.',
            'Auer et al. 2002, "Finite-time Analysis of the Multiarmed Bandit Problem": foundational finite-time regret proof for UCB1.',
            'Chapelle and Li 2011, "An Empirical Evaluation of Thompson Sampling": modern empirical case for posterior sampling.',
            'Slivkins 2019, "Introduction to Multi-Armed Bandits": broad textbook treatment of stochastic, adversarial, and contextual bandits.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: A/B Testing & p-values -- understand fixed-sample inference before learning why bandits depart from it.',
            'Extension: Thompson Sampling -- Bayesian exploration that replaces the fixed epsilon with posterior sampling.',
            'Extension: Upper Confidence Bound -- deterministic confidence-bonus exploration with provable regret bounds.',
            'Contextual: LinUCB Personalized News Case Study -- contextual bandits with per-user features and confidence ellipsoids.',
            'Contrast: Softmax and Temperature -- probability-shaped exploration as an alternative to hard argmax.',
            'Downstream: Importance Sampling and Off-Policy Estimation -- how to learn from adaptive logs without pretending they came from a fixed split.',
            'Downstream: Value Iteration and Policy Gradients -- the full RL setting where actions change future states, not just immediate rewards.',
          ],
        },
      ],
    },
  ],
};
