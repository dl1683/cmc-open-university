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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a contextual bandit, which is a learner that sees context, chooses one action, and only receives feedback for that action. Active nodes are the score components being used now, found nodes are the selected article or observed reward, and compare nodes separate estimated reward from uncertainty. The safe inference rule is that an article with little evidence may deserve traffic only when its upper confidence bound is high enough to beat known alternatives.',
        {type: 'callout', text: 'LinUCB explores through uncertainty geometry, choosing the action with the best upper confidence bound instead of random novelty.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Personalized news has to choose before it knows what a visitor would click. A front page may have 20 eligible stories, but the system shows one and learns only whether that one was clicked. LinUCB exists for this partial-feedback setting: it uses visitor and article features to learn while it is already serving users.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is greedy ranking: estimate click-through rate for each story and always show the highest estimate. That works after the system has enough clean evidence for every story. It fails for news because stories arrive cold, expire quickly, and can be buried before the model ever learns their value.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is missing counterfactual feedback. If the system shows a sports story, it does not learn whether the same visitor would have clicked a finance story. Random exploration fixes blindness but spends user attention badly, so the system needs exploration that is aimed at uncertain but plausible winners.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'LinUCB uses optimism under uncertainty. For each action, it adds a confidence bonus to the current reward estimate, then chooses the largest upper bound. The bonus is large in feature directions where the model has little evidence and small where repeated examples have already reduced uncertainty.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each article, the disjoint LinUCB model stores a matrix A and vector b for ridge regression, where ridge regression is linear regression with a penalty that keeps estimates stable. A starts as lambda times the identity matrix, and b starts at zero. For a visitor-article feature vector x, the model computes theta = A^-1 b and score = theta dot x + alpha * sqrt(x^T A^-1 x).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant about evidence. Every observed reward updates only the chosen article with A = A + x x^T and b = b + r x, so A records which feature directions have been tested and b records the rewards seen in those directions. As A grows along a direction, A^-1 shrinks there, which lowers the bonus and shifts traffic toward either proven winners or genuinely under-tested directions.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With d features and k candidate articles, scoring costs O(k d^2) if each uncertainty term is computed as x^T A^-1 x. Updating one chosen article costs O(d^2) with a rank-one inverse update, or O(d^3) if the inverse is recomputed from scratch. Doubling the candidate pool doubles scoring work, while doubling feature count roughly quadruples matrix-vector work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LinUCB fits news ranking, ad selection, notification choice, search result exploration, and experiment allocation when actions have features and fresh actions appear often. The method is useful when random exploration would waste attention but a pure winner-take-all ranker would starve new options. Production systems pair it with strict logging because later evaluation needs the context, candidate pool, chosen action, reward, and policy parameters.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'LinUCB fails when rewards are not close to linear in the provided features, when important features are missing, or when delayed rewards are joined to the wrong decision. It also fails if the log omits eligible actions, because offline replay cannot know what the policy could have chosen. Bias can feed itself if the model keeps sending traffic to the same slice and treats the resulting data as neutral evidence.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a visitor has feature vector x = [1, 0.6] for a politics story. Article A has theta dot x = 0.030 and uncertainty sqrt(x^T A^-1 x) = 0.020; article B has theta dot x = 0.036 and uncertainty = 0.004. With alpha = 0.5, A scores 0.040 and B scores 0.038, so LinUCB shows A even though its current mean is lower.',
        'If the visitor clicks A, r = 1 and the system updates only A with A = A + x x^T and b = b + x. If the same feature direction appears again, the uncertainty term for A is smaller because that direction now has evidence. Exploration cost becomes behavior: traffic shifts away from A unless its observed reward supports the optimistic bet.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Li et al., A Contextual-Bandit Approach to Personalized News Article Recommendation, and the Yahoo logged-policy evaluation work that uses random traffic for replay. Then study ridge regression, Sherman-Morrison rank-one updates, inverse propensity scoring, doubly robust estimation, Thompson sampling, feature stores, and append-only decision logs. The next practical exercise is to write a replay evaluator that rejects any row where the candidate policy would not have chosen the logged action.',
      ],
    },
  ],
};