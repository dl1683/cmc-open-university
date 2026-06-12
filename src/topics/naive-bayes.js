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
    explanation: 'Before reading a single word, the smart bet is the BASE RATE: 40% spam, 60% ham. (Ignoring priors is the classic probability blunder — if only 1 in 1000 emails were spam, even "free winner" should barely move you.) Now each word multiplies in its evidence: score(class) ×= P(word | class). The "NAIVE" assumption is right there — treating words as independent witnesses, ignoring that "free" and "winner" travel together. False in reality, yet the verdicts come out right: the boundary survives the lie.',
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
        columns: [{ id: 'before', label: 'before' }, { id: 'lik', label: `P(${word}|·)` }, { id: 'after', label: 'after' }],
        values: [[before[0], LIKELIHOOD[word].spam, spamScore], [before[1], LIKELIHOOD[word].ham, hamScore]],
        format: fmt,
      }),
      highlight: { active: [pullsSpam ? 'spam:after' : 'ham:after'] },
      explanation: `"${word}" testifies: it is ${pullsSpam ? `${Math.round(LIKELIHOOD[word].spam / LIKELIHOOD[word].ham)}× more common in spam — the spam score surges` : `${Math.round(LIKELIHOOD[word].ham / LIKELIHOOD[word].spam)}× more common in ham — the ham score pulls ahead`}. Notice the scores shrinking toward zero as they multiply — real filters add LOG-probabilities instead of multiplying raw ones, or a 200-word email underflows to 0.0.`,
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

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Naive Bayes is the simplest, fastest text classifier in machine learning: given a message, compute P(spam | words) — the probability it is spam, given the words you see — and output a class. It is "naive" because it assumes words are independent (wholly false: "free winner" clusters together far more than chance), yet the classification boundary between spam and ham holds firm despite this lie. Training is just counting: scan labeled emails, record what fraction of spam contained each word, what fraction of ham contained each word, store these as likelihoods, compute base rates (prior probabilities), and you are done.`,
        `The classifier runs in real time on a single machine — no matrix multiplications, no gradients, no epochs. Each new word you test multiplies evidence into a running score for each class. The final posterior (normalized odds) tells you which class is more probable. Bayes' theorem does the math: the posterior odds equal the prior odds times the likelihood ratio.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with base rates learned from training data: if 40 percent of your mail is spam and 60 percent is ham, those are your priors — the smart guess before reading a single word. For every word in your vocabulary, store two likelihoods: P(word | spam) and P(word | ham), learned by counting occurrences in labeled mail. The word "free" might appear in 30 percent of spam messages but only 2 percent of ham; "meeting" appears in 1 percent of spam but 20 percent of ham. Now, to classify "free winner click," multiply the prior for spam by the likelihood of each word given spam, and do the same for ham.`,
        `The challenge is underflow: multiply 200 words together and raw probabilities collapse toward zero, losing precision. Real systems use log-probabilities instead: store log(P(word | class)) and add them in the loop — addition stays numerically stable. Laplace smoothing handles the zero-likelihood trap: if a word never appeared in your training set, a plain likelihood table gives it zero probability, zeroing the entire class score. Instead, add one phantom count everywhere during training; now every word has some small but nonzero probability, so a single unseen witness cannot veto a class. Finally, normalize the accumulated scores: divide spam score by (spam score plus ham score) to get the posterior probability. If it exceeds 50 percent, predict spam; otherwise ham.`,
        `This is exactly what the demo shows step by step: start at the prior odds, multiply in each word's evidence in sequence, watch the score ratios shift, and end with a posterior that classifies the email.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Training: scan all labeled messages once, count word occurrences per class, store a dictionary of likelihoods. For vocabulary size V and training set size N, this is O(N × V) — linear, and very fast. A spam filter training on 10,000 emails and 5,000 word types completes in milliseconds. Testing: given a message with M words, compute M multiplications and a single normalization. O(M) — essentially instant. Storage: keep a dictionary of size V and two probability values per word: O(V). For English with 10,000 words in your model, a few MB uncompressed, or kilobytes in a real production system.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Spam filtering was the canonical use case and made Naive Bayes famous after Paul Graham's 2002 essay "A Plan for Spam" reported 99 percent accuracy; it remained the industry baseline for inboxes into the 2010s. Medical triage uses the same logic: given a patient's symptoms (words), what is the probability of each disease class? Fraud detection counts transaction features as evidence: high-value country-mismatch plus unusual merchant category pushes the fraud posterior upward. Sentiment classification (is this review positive or negative) treats words as witnesses for each sentiment. Text categorization for newswire, document routing, topic labeling — any text-to-discrete-class problem — leans on Naive Bayes as a zero-configuration baseline that is hard to beat on simple problems. Modern deep-learned text classifiers often are compared against Naive Bayes to prove their worth; if they do not beat it by a significant margin with a learnable representation, the Naive Bayes assumption of word independence was actually quite good for that task.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most dangerous misconception is ignoring the prior. If you know only 1 in 1000 emails are spam, starting with P(spam) = 0.001 matters enormously; words alone will not overcome it. Ignoring that base rate and relying only on word likelihood is the classic probability blunder that breaks medical testing, legal reasoning, and fraud scoring. Another trap: the "naive" independence assumption feels catastrophically broken because English words cluster (spam email rarely says "free" without other urgency words), yet the decision boundary survives the lie. The probabilities are wildly wrong; the ordering is right. Do not use the posterior as a confidence score — 95 percent in our demo means "more spam than ham," not "I am 95 percent sure."`,
        `Zero likelihood is a gotcha: a word unseen in training multiplies through a zero probability and collapses the score. This is why Laplace smoothing exists — add a phantom count so no witness gets infinite veto power. Finally, do not confuse the Bayesian update here with a confident posterior. A posterior of 60 percent spam is not high confidence; it is "slightly more likely spam." The model can only be as good as the labeled training data and the word features you choose.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Naive Bayes is a Bayesian update loop: you start with a prior belief and multiply evidence in sequentially, just as Thompson Sampling does when deciding which treatment arm to play. The words it counts are tokens — go learn Tokenization (BPE) to see how raw text becomes a vocabulary. When you have built a classifier, run A/B Testing & p-values to measure if your filter improvement is real or random noise. For production systems that need confidence, study Softmax & Temperature to turn raw log-odds into calibrated probability estimates. And when your single classifier gets beaten by an ensemble, explore Random Forest to see how many weak predictors combine into something strong.`,
      ],
    },
  ],
};

