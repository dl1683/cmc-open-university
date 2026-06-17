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
        'LinUCB is a contextual bandit algorithm for choosing among actions when the system sees features before acting and receives reward only for the action it chose. The Yahoo personalized news case is the canonical example: a visitor arrives, a pool of eligible news articles is available, the system chooses one story, and the only immediate reward is whether that visitor clicked the displayed story.',
        'The algorithm combines a linear reward estimate with an uncertainty bonus. For each candidate article, it asks two questions: how good does this article look for this visitor, and how uncertain is the estimate in this feature direction? The selected article is the one with the highest upper confidence bound, not necessarily the one with the highest current mean. That optimism is how LinUCB explores without choosing randomly all the time.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is greedy ranking. Estimate click-through rate for every article and show the story with the highest estimate. This works when the estimates are already reliable. It fails badly for fresh news, where articles appear and disappear before the system can collect much direct evidence. A newly published article may look weak only because nobody has seen it yet. A greedy ranker can bury it forever and never learn whether it was valuable.',
        'A second obvious approach is random exploration. Give new articles traffic until the estimates stabilize. That solves the blindness problem but wastes attention. Users see irrelevant stories, product metrics drop, and the system explores articles even when their upside is small. The wall is partial feedback. After showing one article, the system does not observe whether the user would have clicked the others. Learning requires exploration, but exploration has to be targeted.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is optimism under uncertainty. LinUCB does not explore every unknown action equally. It explores actions whose estimated upper confidence bound is high. An article with a moderate mean but large uncertainty can beat an article with a higher mean and low uncertainty, because the uncertain article might turn out to be better after a small amount of traffic.',
        'This is different from epsilon-greedy exploration. Epsilon-greedy usually flips a coin between exploitation and broad random exploration. LinUCB uses geometry. It asks whether the current visitor-article feature vector points through a well-known region of the data or through a region where the model still has little evidence. The uncertainty term is largest in directions the model has not learned well.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The disjoint version stores one ridge-regression state per action. For each article, keep a d by d matrix A, a d-vector b, and often A inverse for fast scoring. A starts as lambda times the identity matrix. b starts at zero. After the system shows article a with feature vector x and observes reward r, it updates only that article: A_a <- A_a + x x^T and b_a <- b_a + r x. The estimate is theta_a = A_a^-1 b_a.',
        'The uncertainty for a candidate feature vector is sqrt(x^T A_a^-1 x). This is the matrix expression behind the confidence bonus. It is not merely a count of impressions. Ten examples can reduce uncertainty a lot if they cover the relevant feature direction, or very little if they all lie somewhere else. In production, a system may update A inverse with a Sherman-Morrison rank-one update instead of recomputing a matrix inverse after every click.',
      ],
    },
    {
      heading: 'Mechanism step by step',
      paragraphs: [
        'For each visitor, the news system builds a candidate pool of eligible articles. It constructs a feature vector for each visitor-article pair. Features can include user segment, geography, article topic, article age, time of day, and cross features such as topic by user segment. For every candidate, LinUCB computes score(a) = theta_a dot x_a + alpha * sqrt(x_a^T A_a^-1 x_a). The first term is expected reward. The second is the exploration bonus.',
        'The article with the highest score is served. The logger records the context, eligible pool, chosen action, score, exploration parameters, timestamp, and propensity if the system uses randomized logging. When the reward arrives, usually a click or no click, only the chosen article receives an update. The unchosen articles are counterfactuals. This is why contextual bandit systems care so much about logs: without a faithful decision log, later evaluation cannot reconstruct what the policy knew and what it could have chosen.',
      ],
    },
    {
      heading: 'Disjoint and hybrid models',
      paragraphs: [
        'The disjoint model treats each article as its own action with its own parameters. That is simple and useful when there is enough traffic per action. It also matches the intuition of a small regression model attached to each arm. The weakness is cold start. A brand-new article has little direct evidence, and news articles often expire quickly. By the time the model is confident, the story may no longer matter.',
        'The hybrid model adds shared parameters across user and article features. Shared structure lets a new politics article borrow signal from earlier politics articles, or lets a topic-segment interaction carry over to a fresh story. This is why LinUCB belongs in a curriculum on data structures and generalization. The stored state is not just a scoreboard of arms. It is a set of matrices that encode what the system has learned about feature directions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'LinUCB works when the reward is approximately linear in the chosen features and the uncertainty estimate is meaningful. The ridge state summarizes past evidence compactly. A grows in directions where examples have accumulated, so A inverse shrinks in those directions. The confidence bonus therefore fades where the system has evidence and remains large where it is still ignorant. This is targeted exploration expressed as linear algebra.',
        'The method also fits the news setting because content is dynamic. Collaborative filtering often needs repeated interactions with stable items. Front-page news has fast turnover. Contextual features let the system make useful guesses before direct click history exists. A new article is not completely unknown if its topic, age, source, and audience features resemble things the system has already seen.',
      ],
    },
    {
      heading: 'Where it is useful and where it fails',
      paragraphs: [
        'LinUCB is useful for recommendations, ads, notifications, ranking modules, experiment allocation, and any setting where the system must learn from partial feedback while serving users. It is especially useful when actions have features, new actions arrive frequently, and random exploration is too expensive. The algorithm gives product teams a clear knob, alpha, for exploration strength and a clear state update after each observed reward.',
        'It fails when the linear model is a poor approximation, when features omit the real signal, when rewards are delayed or joined incorrectly, or when unlogged eligibility makes evaluation impossible. It can also become unfair or unstable if sensitive features, feedback loops, or popularity bias are handled casually. A high confidence bound is not a moral claim that an article deserves exposure. It is an optimization rule under assumptions that must be checked.',
      ],
    },
    {
      heading: 'Operational and evaluation signals',
      paragraphs: [
        'Track click-through rate, regret proxies, exploration rate, average and tail bonus size, article cold-start performance, time-to-learn for new stories, reward delay, update lag, matrix conditioning, feature drift, eligible-pool coverage, and slice metrics by topic, user segment, geography, device, and article age. Watch for alpha settings that create too much random-looking traffic or too little discovery. Watch for stale articles whose old state keeps them over-ranked.',
        'Offline evaluation needs special care. The Yahoo replay protocol used random traffic logs: if the candidate policy would have chosen the same article that was randomly shown, keep the row and reveal the reward; otherwise skip it. More general logged-policy evaluation uses propensities, inverse propensity weighting, doubly robust estimators, support checks, and effective sample size. A contextual bandit without replayable logs is hard to improve safely.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study the Yahoo LinUCB paper and the companion offline evaluation paper. Then study multi-armed bandits, Thompson sampling, contextual bandit logged-policy evaluation, inverse propensity weighting, doubly robust estimation, regularization, ridge regression, Sherman-Morrison updates, eigenvalues and eigenvectors, PCA, and online learning systems such as FTRL-Proximal. Vowpal Wabbit and Open Bandit Pipeline are useful implementation references.',
        'For data structures, focus on matrices, vectors, rank-one updates, feature stores, append-only decision logs, replay filters, and evaluation ledgers. LinUCB is a small formula sitting on top of a larger operational contract: choose with context, log what was possible, learn only from observed rewards, and evaluate future policies against data that preserves support.',
      ],
    },
  ],
};
