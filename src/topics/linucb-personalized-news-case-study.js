// LinUCB personalized news case study: contextual exploration with one
// ridge-regression state per action and a confidence bonus for uncertainty.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'linucb-personalized-news-case-study',
  title: 'LinUCB Personalized News Case Study',
  category: 'Papers',
  summary: 'A contextual bandit primer from the Yahoo news case: per-action ridge state, confidence bonuses, rank-one updates, replay evaluation, and dynamic articles.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['confidence bonus', 'news system'], defaultValue: 'confidence bonus' },
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

function linucbGraph(title) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.6, y: 3.3, note: 'ctx' },
      { id: 'pool', label: 'pool', x: 2.0, y: 3.3, note: 'articles' },
      { id: 'feat', label: 'features', x: 3.5, y: 3.3, note: 'x_a' },
      { id: 'state', label: 'A,b', x: 5.0, y: 2.0, note: 'per arm' },
      { id: 'mean', label: 'mean', x: 6.4, y: 2.0, note: 'theta.x' },
      { id: 'bonus', label: 'bonus', x: 6.4, y: 4.6, note: 'uncert' },
      { id: 'ucb', label: 'UCB', x: 7.8, y: 3.3, note: 'score' },
      { id: 'serve', label: 'serve', x: 9.1, y: 3.3, note: 'chosen' },
      { id: 'click', label: 'click', x: 9.1, y: 5.1, note: 'reward' },
      { id: 'update', label: 'update', x: 5.0, y: 5.1, note: 'rank-1' },
    ],
    edges: [
      { id: 'e-user-pool', from: 'user', to: 'pool' },
      { id: 'e-pool-feat', from: 'pool', to: 'feat' },
      { id: 'e-feat-state', from: 'feat', to: 'state' },
      { id: 'e-state-mean', from: 'state', to: 'mean' },
      { id: 'e-state-bonus', from: 'state', to: 'bonus' },
      { id: 'e-mean-ucb', from: 'mean', to: 'ucb' },
      { id: 'e-bonus-ucb', from: 'bonus', to: 'ucb' },
      { id: 'e-ucb-serve', from: 'ucb', to: 'serve' },
      { id: 'e-click-update', from: 'click', to: 'update' },
      { id: 'e-update-state', from: 'update', to: 'state' },
    ],
  }, { title });
}

function newsGraph(title) {
  return graphState({
    nodes: [
      { id: 'traffic', label: 'traffic', x: 0.7, y: 3.4, note: 'visits' },
      { id: 'pool', label: 'pool', x: 2.2, y: 3.4, note: 'fresh' },
      { id: 'score', label: 'score', x: 3.8, y: 3.4, note: 'LinUCB' },
      { id: 'show', label: 'show', x: 5.3, y: 3.4, note: 'story' },
      { id: 'log', label: 'log', x: 6.8, y: 2.0, note: 'row' },
      { id: 'reward', label: 'reward', x: 6.8, y: 4.8, note: 'click' },
      { id: 'replay', label: 'replay', x: 8.4, y: 2.0, note: 'offline' },
      { id: 'learn', label: 'learn', x: 8.4, y: 4.8, note: 'update' },
    ],
    edges: [
      { id: 'e-traffic-pool', from: 'traffic', to: 'pool' },
      { id: 'e-pool-score', from: 'pool', to: 'score' },
      { id: 'e-score-show', from: 'score', to: 'show' },
      { id: 'e-show-log', from: 'show', to: 'log' },
      { id: 'e-show-reward', from: 'show', to: 'reward' },
      { id: 'e-log-replay', from: 'log', to: 'replay' },
      { id: 'e-reward-learn', from: 'reward', to: 'learn' },
      { id: 'e-learn-score', from: 'learn', to: 'score' },
    ],
  }, { title });
}

function* confidenceBonus() {
  yield {
    state: linucbGraph('LinUCB chooses by mean plus uncertainty'),
    highlight: { active: ['feat', 'state', 'mean', 'bonus', 'ucb', 'serve'], compare: ['click', 'update'] },
    explanation: 'LinUCB turns each article into a small linear model. For every eligible article, compute an estimated click rate from its context features and add a confidence bonus. The bonus is large where the article has little data for users like this one, so exploration is targeted instead of blind.',
    invariant: 'score(a) = theta_a dot x_a + alpha * sqrt(x_a^T A_a^-1 x_a).',
  };

  yield {
    state: labelMatrix(
      'Per-article scores for one visitor',
      [
        { id: 'world', label: 'world' },
        { id: 'tech', label: 'tech' },
        { id: 'sports', label: 'sports' },
        { id: 'fresh', label: 'fresh' },
      ],
      [
        { id: 'mean', label: 'mean' },
        { id: 'unc', label: 'bonus' },
        { id: 'ucb', label: 'UCB' },
        { id: 'data', label: 'data' },
      ],
      [
        ['0.42', '0.08', '0.50', 'lots'],
        ['0.38', '0.18', '0.56', 'some'],
        ['0.46', '0.03', '0.49', 'many'],
        ['0.31', '0.30', '0.61', 'new'],
      ],
    ),
    highlight: { active: ['fresh:unc', 'fresh:ucb'], compare: ['sports:mean', 'sports:unc'] },
    explanation: 'Sports has the highest predicted mean, but the model already knows that region well, so its bonus is small. The fresh story has a lower mean and a much larger uncertainty bonus, so it wins this visit. LinUCB explores exactly where the confidence interval still has upside.',
  };

  yield {
    state: labelMatrix(
      'State carried for each article',
      [
        { id: 'A', label: 'A matrix' },
        { id: 'b', label: 'b vector' },
        { id: 'inv', label: 'A inverse' },
        { id: 'theta', label: 'theta' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'role', label: 'role' },
      ],
      [
        ['sum x xT', 'curvature'],
        ['sum r x', 'rewards'],
        ['uncertainty', 'bonus'],
        ['A^-1 b', 'mean'],
      ],
    ),
    highlight: { active: ['A:stores', 'b:stores', 'inv:stores'], found: ['theta:role'] },
    explanation: 'The data structure is ridge regression state, repeated per action. A starts as lambda times identity. Each click example adds x x^T to A and reward times x to b. theta is the regularized linear estimate. A inverse tells the model how uncertain it still is in this feature direction.',
  };

  yield {
    state: labelMatrix(
      'Only the served article updates',
      [
        { id: 'before', label: 'before' },
        { id: 'rank1', label: 'rank-1' },
        { id: 'bump', label: 'b add' },
        { id: 'after', label: 'after' },
      ],
      [
        { id: 'A', label: 'A_fresh' },
        { id: 'b', label: 'b_fresh' },
      ],
      [
        ['old A', 'old b'],
        ['+ x xT', 'same'],
        ['same', '+ r x'],
        ['tighter', 'new mean'],
      ],
    ),
    highlight: { active: ['rank1:A', 'bump:b', 'after:A', 'after:b'] },
    explanation: 'Partial feedback is the hard part. If the fresh article is served, only that article receives an update. The system never observes whether the user would have clicked sports or tech. That is why exploration and logged-policy evaluation matter.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'times article was shown', min: 0, max: 200 }, y: { label: 'bonus size', min: 0, max: 0.35 } },
      series: [
        { id: 'new', label: 'new story', points: [{ x: 0, y: 0.31 }, { x: 10, y: 0.23 }, { x: 30, y: 0.15 }, { x: 80, y: 0.09 }, { x: 200, y: 0.05 }] },
        { id: 'old', label: 'old story', points: [{ x: 0, y: 0.12 }, { x: 10, y: 0.10 }, { x: 30, y: 0.08 }, { x: 80, y: 0.05 }, { x: 200, y: 0.03 }] },
      ],
      markers: [
        { id: 'fade', x: 80, y: 0.09, label: 'fades' },
      ],
    }),
    highlight: { active: ['new', 'fade'], compare: ['old'] },
    explanation: 'The exploration bonus decays as evidence accumulates. New articles receive optimism because the system has not mapped their reward surface yet. Once enough matching users have seen the story, A grows in that direction, A inverse shrinks, and the bonus fades.',
    invariant: 'Uncertainty is geometric: the same sample count can help a lot or little depending on whether x points through a well-known direction.',
  };

  yield {
    state: linucbGraph('From static arms to feature-aware actions'),
    highlight: { active: ['user', 'pool', 'feat', 'state', 'ucb'], found: ['serve'] },
    explanation: 'A context-free bandit learns one number per article. LinUCB learns how user and article features interact, so it can generalize across sparse traffic. That is the reason the Yahoo paper reported larger gains when data was scarce: context lets a new decision borrow structure from similar past decisions.',
  };
}

function* newsSystem() {
  yield {
    state: newsGraph('Complete case: Yahoo-style front page news'),
    highlight: { active: ['traffic', 'pool', 'score', 'show', 'reward', 'learn'], compare: ['log', 'replay'] },
    explanation: 'The Yahoo front-page case has a dynamic article pool, high traffic, partial feedback, and rapidly decaying content. LinUCB scores each eligible article for the current user, serves one, logs the decision, observes click feedback, and updates only the served article state.',
    invariant: 'Dynamic content makes collaborative filtering brittle; contextual bandits use features and fresh feedback instead.',
  };

  yield {
    state: labelMatrix(
      'Feature blocks in a hybrid news ranker',
      [
        { id: 'user', label: 'user' },
        { id: 'article', label: 'article' },
        { id: 'cross', label: 'cross' },
        { id: 'time', label: 'time' },
      ],
      [
        { id: 'examples', label: 'examples' },
        { id: 'why', label: 'why' },
      ],
      [
        ['segment,geo', 'taste'],
        ['topic,age', 'content'],
        ['topic x seg', 'fit'],
        ['hour,recency', 'freshness'],
      ],
    ),
    highlight: { active: ['cross:examples', 'time:examples'], compare: ['article:why'] },
    explanation: 'The original LinUCB paper describes both disjoint and hybrid models. A disjoint model stores separate state per article. A hybrid model also shares parameters across article/user feature interactions, so new articles can start with useful priors instead of total ignorance.',
  };

  yield {
    state: labelMatrix(
      'Offline replay protocol',
      [
        { id: 'rand', label: 'random log' },
        { id: 'cand', label: 'candidate' },
        { id: 'match', label: 'match row' },
        { id: 'skip', label: 'skip row' },
        { id: 'score', label: 'score' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'why', label: 'why' },
      ],
      [
        ['uniform show', 'support'],
        ['chooses art', 'policy'],
        ['same action', 'use reward'],
        ['diff action', 'no label'],
        ['CTR over use', 'unbiased'],
      ],
    ),
    highlight: { active: ['rand:why', 'match:does', 'score:why'], removed: ['skip:does'] },
    explanation: 'The companion offline-evaluation paper uses random traffic as a replay log. If the candidate policy would have chosen the same article that was randomly displayed, keep the row and reveal its reward. Otherwise skip it. The kept rows form an unbiased evaluation stream because random logging gave every eligible action a known chance.',
  };

  yield {
    state: labelMatrix(
      'Operational knobs',
      [
        { id: 'alpha', label: 'alpha' },
        { id: 'lambda', label: 'lambda' },
        { id: 'pool', label: 'pool' },
        { id: 'warm', label: 'warm start' },
        { id: 'ttl', label: 'TTL' },
        { id: 'log', label: 'log' },
      ],
      [
        { id: 'sets', label: 'sets' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['explore', 'regret'],
        ['shrinkage', 'bias'],
        ['eligible set', 'support'],
        ['priors', 'cold start'],
        ['expiry', 'stale news'],
        ['propensity', 'no replay'],
      ],
    ),
    highlight: { active: ['alpha:sets', 'lambda:sets', 'log:sets'], compare: ['pool:risk', 'ttl:risk'] },
    explanation: 'Most production work lives around the formula. alpha controls exploration. lambda controls ridge shrinkage. The eligible pool must be logged. New articles need warm-start priors. Expired articles need state cleanup. Every served article needs a propensity if future replay matters.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'days since story entered pool', min: 0, max: 5 }, y: { label: 'relative value', min: 0, max: 1.1 } },
      series: [
        { id: 'news', label: 'news value', points: [{ x: 0, y: 1.0 }, { x: 1, y: 0.74 }, { x: 2, y: 0.47 }, { x: 3, y: 0.25 }, { x: 5, y: 0.08 }] },
        { id: 'data', label: 'data value', points: [{ x: 0, y: 0.12 }, { x: 1, y: 0.36 }, { x: 2, y: 0.53 }, { x: 3, y: 0.62 }, { x: 5, y: 0.67 }] },
      ],
      markers: [
        { id: 'race', x: 2, y: 0.50, label: 'race' },
      ],
    }),
    highlight: { active: ['news', 'data', 'race'] },
    explanation: 'News personalization is a race: by the time a story has enough data to estimate perfectly, the story may be stale. LinUCB exists for this regime. It uses context and optimism to learn useful routing before the content lifetime is gone.',
  };

  yield {
    state: newsGraph('System lesson: optimize with logs you can replay'),
    highlight: { active: ['log', 'replay', 'learn', 'score'], found: ['show'] },
    explanation: 'The system should serve, log, learn, and replay from the same event contract. That connects this module back to Contextual Bandit Logged Policy Evaluation Case Study: without a replayable log, you cannot know whether a better-looking contextual policy is real or just a simulator artifact.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'confidence bonus') yield* confidenceBonus();
  else if (view === 'news system') yield* newsSystem();
  else throw new InputError('Pick a LinUCB view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'LinUCB is a contextual bandit algorithm for choosing actions when each action has features and rewards arrive only for the action you served. It was popularized by the Yahoo front-page news recommendation work: choose a news article for the current visitor, learn from click feedback, and keep exploring where uncertainty remains.',
        'The core idea is optimism under uncertainty. For each eligible article, estimate a linear reward model and add an upper-confidence bonus. The system does not merely pick the article with the highest predicted click rate; it picks the article with the highest plausible click rate after accounting for uncertainty.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The disjoint LinUCB version stores one ridge-regression state per action: a d by d matrix A, a d-vector b, and often A inverse for fast scoring. A starts as lambda times the identity. After serving an action with feature vector x and reward r, update only that action: A <- A + x x^T and b <- b + r x. The estimate is theta = A^-1 b. The uncertainty for a candidate context is sqrt(x^T A^-1 x). Sherman-Morrison Rank-One Update Primer explains how that inverse can be updated after x x^T without recomputing it from scratch.',
        'A hybrid model adds shared parameters for user/article interaction features. That matters for dynamic content: a newly published article cannot wait for thousands of direct clicks before being ranked. Shared feature structure lets it borrow signal from similar topics, segments, and time patterns.',
      ],
    },
    {
      heading: 'How scoring works',
      paragraphs: [
        'For each candidate article a, compute score(a) = theta_a dot x_a + alpha * sqrt(x_a^T A_a^-1 x_a). The first term is exploitation: estimated click reward. The second term is exploration: a confidence radius. alpha controls how optimistic the system is. A large alpha explores aggressively and can waste traffic; a tiny alpha behaves greedily and may miss promising new stories.',
        'The bonus is geometric, not just a count. If new traffic arrives in a direction already well covered by previous feature vectors, A inverse is small in that direction and the bonus shrinks. If the feature combination is new, the bonus stays large. Eigenvectors and PCA are useful prerequisites because the confidence ellipsoid is shaped by the same matrix geometry.',
      ],
    },
    {
      heading: 'Complete case study: personalized news',
      paragraphs: [
        'A front-page news module has a changing article pool, short content lifetime, huge traffic, and partial feedback. Traditional collaborative filtering struggles because items appear and disappear quickly. LinUCB uses user features, article features, and interaction features to rank articles immediately, then updates from clicks. The Yahoo paper reports that a contextual bandit approach improved click lift over a context-free bandit and was especially useful when data was scarce.',
        'Offline evaluation is part of the case. The companion replay paper used random traffic logs: if a candidate policy would have chosen the same article that was randomly displayed, keep the event and reveal the reward; otherwise skip it. This gives an unbiased offline stream under the random logger. Contextual Bandit Logged Policy Evaluation Case Study generalizes the same idea to propensity logs, IPW, DR, support checks, and ESS.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'LinUCB assumes the linear reward model and confidence shape are useful. If the features omit the real signal, the model can be confidently wrong. If alpha is tuned by repeatedly peeking at the same replay log, offline estimates become overfit. If the eligible article set is not logged, support is unclear. If clicks arrive late and are joined incorrectly, the update target is wrong even when the algorithm is mathematically correct.',
        'Another trap is treating LinUCB as a replacement for product evaluation. It is an online optimizer. High-impact changes still need randomized launch guards, slice metrics, and delayed-label audits. The algorithm can reduce regret while learning; it does not make causality, logging, or measurement disappear.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Li, Chu, Langford, and Schapire, A Contextual-Bandit Approach to Personalized News Article Recommendation at https://arxiv.org/abs/1003.0146; Li, Chu, Langford, and Wang, Unbiased Offline Evaluation of Contextual-bandit-based News Article Recommendation Algorithms at https://arxiv.org/abs/1003.5956; Vowpal Wabbit contextual bandit tutorial at https://vowpalwabbit.org/docs/vowpal_wabbit/python/latest/tutorials/python_Contextual_bandits_and_Vowpal_Wabbit.html; and Open Bandit Pipeline estimator documentation at https://zr-obp.readthedocs.io/en/latest/estimators.html.',
        'Study next: Contextual Bandit Logged Policy Evaluation Case Study, Sherman-Morrison Rank-One Update Primer, Gaussian Process Bayesian Optimization Primer, Multi-Armed Bandits, Thompson Sampling, Importance Sampling & Off-Policy Estimation, Doubly Robust Estimation, Regularization, PCA: Principal Component Analysis, Eigenvalues & Eigenvectors, and FTRL-Proximal Online CTR Case Study.',
      ],
    },
  ],
};
