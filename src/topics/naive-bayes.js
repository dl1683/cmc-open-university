// Naive Bayes: the spam filter as courtroom — every word testifies, the
// running odds shift with each one, and Bayes' theorem renders the verdict.
// "Naive" because it assumes words are independent. Wrong, and it works.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'naive-bayes',
  title: 'Naive Bayes (Spam Filter)',
  category: 'AI & ML',
  summary: 'Watch each word shift the odds spam-ward or ham-ward — Bayes\' theorem reading your email.',
  controls: [
    { id: 'email', label: 'Classify', type: 'select', options: ['free winner click', 'project meeting tomorrow', 'free project meeting'], defaultValue: 'free winner click' },
  ],
  run,
};

// Word likelihoods learned by counting in labeled mail: P(word | class).
const LIKELIHOOD = {
  free: { spam: 0.30, ham: 0.02 },
  winner: { spam: 0.20, ham: 0.01 },
  click: { spam: 0.25, ham: 0.05 },
  project: { spam: 0.02, ham: 0.25 },
  meeting: { spam: 0.01, ham: 0.20 },
  tomorrow: { spam: 0.03, ham: 0.15 },
};
const PRIOR = { spam: 0.4, ham: 0.6 };

const fmt = (v) => (v >= 0.001 ? v.toFixed(4) : v.toExponential(1));

export function* run(input) {
  const words = String(input.email).split(' ');
  if (!words.every((w) => LIKELIHOOD[w])) throw new InputError('Pick one of the listed emails.');

  const vocab = Object.keys(LIKELIHOOD);
  yield {
    state: matrixState({
      title: 'The learned likelihood table: P(word | class)',
      rows: vocab.map((w) => ({ id: `w_${w}`, label: w })),
      columns: [{ id: 'spam', label: 'in spam' }, { id: 'ham', label: 'in ham' }],
      values: vocab.map((w) => [LIKELIHOOD[w].spam, LIKELIHOOD[w].ham]),
    }),
    highlight: { active: words.map((w) => `w_${w}:spam`) },
    explanation: `Training a naive Bayes filter is just COUNTING: in a pile of labeled mail, "free" appeared in 30% of spam but 2% of ham; "meeting" in 1% of spam but 20% of ham. This table — plus the base rates (40% of mail is spam, 60% ham) — is the entire model. Now classify "${words.join(' ')}" by asking Bayes' question: which class better explains these words?`,
  };

  let spamScore = PRIOR.spam;
  let hamScore = PRIOR.ham;
  yield {
    state: matrixState({
      title: 'Start with the priors: P(spam) and P(ham)',
      rows: [{ id: 'spam', label: 'spam' }, { id: 'ham', label: 'ham' }],
      columns: [{ id: 'score', label: 'score' }],
      values: [[spamScore], [hamScore]],
      format: fmt,
    }),
    highlight: {},
    explanation: 'Before reading a single word, the smart bet is the BASE RATE: 40% spam, 60% ham. (Ignoring priors is the classic probability blunder — if only 1 in 1000 emails were spam, even "free winner" should barely move you.) Now each word multiplies in its evidence: score(class) Ã—= P(word | class). The "NAIVE" assumption is right there — treating words as independent witnesses, ignoring that "free" and "winner" travel together. False in reality, yet the verdicts come out right: the boundary survives the lie.',
  };

  for (const word of words) {
    const before = [spamScore, hamScore];
    spamScore *= LIKELIHOOD[word].spam;
    hamScore *= LIKELIHOOD[word].ham;
    const pullsSpam = LIKELIHOOD[word].spam > LIKELIHOOD[word].ham;
    yield {
      state: matrixState({
        title: `Evidence: "${word}"`,
        rows: [{ id: 'spam', label: 'spam' }, { id: 'ham', label: 'ham' }],
        columns: [{ id: 'before', label: 'before' }, { id: 'lik', label: `P(${word}|Â·)` }, { id: 'after', label: 'after' }],
        values: [[before[0], LIKELIHOOD[word].spam, spamScore], [before[1], LIKELIHOOD[word].ham, hamScore]],
        format: fmt,
      }),
      highlight: { active: [pullsSpam ? 'spam:after' : 'ham:after'] },
      explanation: `"${word}" testifies: it is ${pullsSpam ? `${Math.round(LIKELIHOOD[word].spam / LIKELIHOOD[word].ham)}Ã— more common in spam — the spam score surges` : `${Math.round(LIKELIHOOD[word].ham / LIKELIHOOD[word].spam)}Ã— more common in ham — the ham score pulls ahead`}. Notice the scores shrinking toward zero as they multiply — real filters add LOG-probabilities instead of multiplying raw ones, or a 200-word email underflows to 0.0.`,
      invariant: 'After each word, the score ratio equals the posterior odds given the evidence so far.',
    };
  }

  const posterior = spamScore / (spamScore + hamScore);
  const verdict = posterior > 0.5;
  yield {
    state: matrixState({
      title: `Verdict: P(spam | "${words.join(' ')}") = ${(posterior * 100).toFixed(1)}%`,
      rows: [{ id: 'spam', label: 'spam' }, { id: 'ham', label: 'ham' }],
      columns: [{ id: 'post', label: 'posterior' }],
      values: [[posterior], [1 - posterior]],
      format: (v) => `${(v * 100).toFixed(1)}%`,
    }),
    highlight: { found: [verdict ? 'spam:post' : 'ham:post'] },
    explanation: `Normalize the two scores so they sum to 100% and the verdict appears: ${(posterior * 100).toFixed(1)}% spam — ${verdict ? 'into the junk folder' : 'safely to the inbox'}${words.includes('free') && words.includes('meeting') ? '. Note how the mixed email produced a MODERATE posterior: "free" pushed one way, "project meeting" pushed back harder. Evidence ACCUMULATES; no single word dictates' : ''}. One practical guard the demo skips: a word never seen in training would multiply a zero through everything — LAPLACE SMOOTHING (add one phantom count everywhere) keeps any single witness from having infinite power.`,
  };

  yield {
    state: matrixState({
      title: 'One theorem, twenty-five years of spam',
      rows: [{ id: 'spam', label: 'spam' }, { id: 'ham', label: 'ham' }],
      columns: [{ id: 'post', label: 'posterior' }],
      values: [[posterior], [1 - posterior]],
      format: (v) => `${(v * 100).toFixed(1)}%`,
    }),
    highlight: {},
    explanation: 'Paul Graham\'s 2002 essay "A Plan for Spam" made this filter famous, and it gatekept the world\'s inboxes for years — fast, trainable on a laptop, accurate enough. It remains the baseline every text classifier must beat, and the same evidence-accumulation runs in medical triage and fraud scoring. The Bayesian update at its heart is exactly Thompson Sampling\'s engine pointed at classification — and the words it counts are the tokens of Tokenization (BPE), one site topic feeding another, as always.',
  };
}

const legacyArticle = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Naive Bayes is a tiny probabilistic classifier: count how often each word appears in spam and ham, start from the base rate, then ask which class better explains the words in front of you. The demo uses six learned likelihoods, such as free appearing in 30% of spam but 2% of ham, and meeting appearing in 1% of spam but 20% of ham. It begins with priors of 40% spam and 60% ham, then multiplies in each word\'s evidence. It is called naive because it treats words as independent witnesses. That is false in English, but the class ranking often remains useful. Compared with Logistic Regression, which learns weights by iterative optimization, Naive Bayes gets its model by counting.`,
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `Read each table as a running odds ledger. The first table is the trained model: rows are words, columns are classes, and each cell says how often that word appeared in that class. The next tables start from the prior odds and multiply in one word at a time. The highlighted cell shows which class the current word supports. The invariant is the score ratio: after every word, spam score divided by ham score equals the prior odds times all likelihood ratios seen so far. The naive baseline is counting suspicious words or ignoring base rates; the animation shows why evidence strength and priors both matter. Watch for the two practical taxes: tiny products require log probabilities, and unseen words require smoothing.`,
      
        {type: 'image', src: './assets/gifs/naive-bayes.gif', alt: 'Animated walkthrough of the naive bayes visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `For each candidate class, compute prior times likelihoods. On free winner click, the spam score is 0.4 * 0.30 * 0.20 * 0.25 = 0.006, while the ham score is 0.6 * 0.02 * 0.01 * 0.05 = 0.000006, so normalization makes the posterior overwhelmingly spam. On project meeting tomorrow, the ham likelihoods dominate. On the mixed free project meeting example, one spammy word fights two work words and ham wins. Real systems add log probabilities instead of multiplying tiny decimals, and they use Laplace smoothing so an unseen word does not zero out an entire class.`,
        `The posterior in this demo is a ranking signal, not a guarantee that the probability is perfectly calibrated. Calibration & Reliability Diagrams is the topic that checks whether 90% really means 90%. Once a score exists, Precision, Recall & the Confusion Matrix and Picking a Threshold with Real Costs decide how aggressively to act on it.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Training is a single pass over the labeled text: tokenize each message, increment word counts per class, then convert counts into conditional probabilities. If the corpus contains T total tokens and C classes, training is O(T), plus O(V * C) storage for V vocabulary items. Prediction for a message with M tokens is O(M * C), usually just a few dictionary lookups and additions of log probabilities. This is why old spam filters could train on a laptop and classify mail in real time. The demo\'s whole model is the six-row likelihood table plus two priors.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Spam filtering is the classic use, but the pattern is broader: symptoms vote for diagnoses, transaction attributes vote for fraud, and words vote for sentiment or topic. Text pipelines often pair Tokenization (BPE) or simpler word tokenization with a Naive Bayes baseline before trying larger models. It is also a useful sanity check in search, support-ticket routing, and moderation: if a complex neural classifier cannot beat the count-based baseline, the extra machinery may not be earning its keep.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Do not ignore priors. A rare disease or rare fraud class needs far more evidence than a balanced classroom example suggests. Do not read the independence assumption literally; it is a simplifying approximation, not a theory of language. Do not trust raw posteriors as calibrated confidence without checking them. Watch for leakage too: if the word table contains labels, future information, or duplicated test messages, the filter can look brilliant while cheating. Finally, smoothing is not optional; zero likelihoods make one unseen token infinitely powerful.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Thompson Sampling to see Bayesian updating used for decisions instead of classification. Use A/B Testing & p-values to prove a new filter beats the old one rather than winning by noise. Softmax & Temperature explains another way scores become probabilities. Random Forest shows a very different baseline, where many unstable trees vote instead of words multiplying likelihood ratios.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        'Full Bayesian classification requires the joint probability P(words|class) over all features. With a vocabulary of V words and binary presence features, the joint distribution has 2^V entries. Even a modest vocabulary of 50,000 words makes this impossible to estimate from any realistic training set.',
        'The naive independence assumption collapses 2^V parameters into V independent counts per class. This is mathematically wrong: "Nigerian" and "prince" are not independent in spam. But the classification boundary survives because errors in likelihood products tend to cancel when comparing classes.',
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        'Email: "free winner click". Prior: P(spam)=0.4, P(ham)=0.6. After "free": spam score = 0.4 * 0.30 = 0.12, ham score = 0.6 * 0.02 = 0.012. After "winner": spam = 0.12 * 0.20 = 0.024, ham = 0.012 * 0.01 = 0.00012. After "click": spam = 0.024 * 0.25 = 0.006, ham = 0.00012 * 0.05 = 0.000006. Normalize: P(spam) = 0.006 / (0.006 + 0.000006) = 99.9% spam.',
        'Email: "free project meeting". After "free": spam = 0.12, ham = 0.012. After "project": spam = 0.12 * 0.02 = 0.0024, ham = 0.012 * 0.25 = 0.003. After "meeting": spam = 0.0024 * 0.01 = 0.000024, ham = 0.003 * 0.20 = 0.0006. Normalize: P(ham) = 96%. Two work words overpower one spam word.',
      ],
    },
],
};

export const article = {
  sections: [

    { heading: 'How to read the animation', paragraphs: ['Read the tables as an odds ledger. The first table is the trained model: each cell estimates how often a word appears in spam or ham, where ham means legitimate mail. The later tables start from prior probabilities and multiply in one word at a time, so the spam-to-ham score ratio equals the prior odds times all likelihood ratios seen so far.']},
    { heading: 'Why this exists', paragraphs: ['Classification often begins with many weak clues rather than one decisive signal. A mail filter sees words, a risk model sees transaction attributes, and a triage model sees symptoms. Naive Bayes estimates how likely each feature is under each class, starts from the base rate for each class, and asks which class best explains the observed features.', {type: 'callout', text: 'Naive Bayes wins by turning many weak likelihood ratios into one odds ledger, then accepting the independence tax.'}]},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is a keyword rule: if an email contains free or winner, mark it as spam. That fails when legitimate mail contains those words or spam uses different language. Another shortcut is to ignore base rates, which fails when one class is rare and a suspicious token should not dominate the decision alone.']},
    { heading: 'The wall', paragraphs: ['The full Bayesian classifier would need the joint probability of every feature combination under every class. With 50,000 possible words, the number of word-present or word-absent combinations is two raised to 50,000, far beyond any training set. The model needs a simplification that turns an impossible joint table into counts that can actually be learned.']},
    { heading: 'The core insight', paragraphs: ['The core insight is conditional independence. Naive Bayes assumes that once the class is known, features can be multiplied as if they were independent evidence pieces. That assumption is false for language, but the classifier can still rank classes well when many likelihood ratios point in useful directions.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Bayes_theorem_visual_proof.svg', alt: 'Visual proof of Bayes theorem with overlapping events and probability formulas', caption: 'Bayes theorem converts priors and likelihoods into posterior odds; Naive Bayes repeats that update feature by feature. Source: Wikimedia Commons, CMG Lee, CC BY-SA 4.0.'}]},
    { heading: 'How it works', paragraphs: ['Training counts features by class. If free appears in 30 percent of spam and 2 percent of ham, the likelihood ratio for that word is 0.30 / 0.02 = 15 in favor of spam. Prediction computes one score per class: prior times the likelihoods of observed features, usually using log probabilities and smoothing in real systems.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Probability_tree.svg', alt: 'Probability tree with conditional branches and joint event leaves', caption: 'A probability tree makes the multiplication rule visible: each branch multiplies prior mass by conditional evidence. Source: Wikimedia Commons, Erzbischof, CC0 1.0.'}]},
    { heading: 'Why it works', paragraphs: ['The correctness argument is Bayes rule plus the independence approximation. For each class, the posterior score is the class prior multiplied by the likelihood of every observed feature under that class, then normalized across classes. The posterior may be poorly calibrated when evidence is correlated, but the ranking can still be useful when the likelihood ratios point the right way.']},
    { heading: 'Cost and complexity', paragraphs: ['Training is one pass over labeled data. If the corpus has T tokens and C classes, counting costs O(T), and storage is O(V * C) for vocabulary size V. Prediction for a message with M tokens costs O(M * C), so doubling message length roughly doubles prediction work while doubling vocabulary mostly increases storage.']},
    { heading: 'Real-world uses', paragraphs: ['Spam filtering is the classic use because words are cheap to count and email classification needs fast decisions. Naive Bayes also works as a baseline for sentiment, topic routing, language identification, risk triage, and symptom scoring. Its best role is often baseline and explanation before heavier models are justified.']},
    { heading: 'Where it fails', paragraphs: ['It fails when feature dependence controls the answer. Phrases, word order, negation, and syntax can matter more than isolated word counts, so not good and good can look too similar. It also fails when raw posteriors are treated as calibrated confidence without checking smoothing, leakage, priors, and duplicates.']},
    { heading: 'Worked example', paragraphs: ['Use priors P(spam) = 0.4 and P(ham) = 0.6. For free winner click, spam score = 0.4 * 0.30 * 0.20 * 0.25 = 0.006, and ham score = 0.6 * 0.02 * 0.01 * 0.05 = 0.000006. Normalizing gives 0.006 / (0.006 + 0.000006) = 0.999, or 99.9 percent spam.']},
    { heading: 'Sources and study next', paragraphs: ['Study Bayes theorem, conditional independence, Laplace smoothing, log probabilities, calibration, precision and recall, and logistic regression. Paul Graham A Plan for Spam is useful historical context, but modern systems usually combine richer features and stricter evaluation.']},
  ],
};
