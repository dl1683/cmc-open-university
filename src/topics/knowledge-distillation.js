// Knowledge distillation: a giant teacher model trains a tiny student —
// not with right answers, but with its full probability distribution.
// The "wrongness pattern" is the knowledge.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'knowledge-distillation',
  title: 'Knowledge Distillation',
  category: 'AI & ML',
  summary: 'A big teacher model trains a small student with soft probabilities — dark knowledge included.',
  controls: [
    { id: 'labels', label: 'Train the student on', type: 'select', options: ['teacher\'s soft labels', 'hard labels only'], defaultValue: 'teacher\'s soft labels' },
  ],
  run,
};

const CLASSES = ['cat', 'dog', 'fox', 'car', 'tree'];
// The big teacher's output for one photo of a cat — note the STRUCTURE:
// dog and fox get real probability (they look cat-like); car and tree don't.
const TEACHER = [0.78, 0.13, 0.06, 0.02, 0.01];
const HARD = [1, 0, 0, 0, 0];
// An untrained student starts near-uniform.
const STUDENT_START = [0.24, 0.20, 0.19, 0.19, 0.18];

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const cols = CLASSES.map((c, j) => ({ id: `c${j}`, label: c }));

export function* run(input) {
  const soft = String(input.labels) !== 'hard labels only';
  if (!['teacher\'s soft labels', 'hard labels only'].includes(String(input.labels))) {
    throw new InputError('Pick a training signal.');
  }
  const target = soft ? TEACHER : HARD;

  yield {
    state: matrixState({
      title: 'The teacher (7B params) sees a photo of a cat',
      rows: [{ id: 'teacher', label: 'teacher' }],
      columns: cols,
      values: [TEACHER],
      format: pct,
    }),
    highlight: { active: ['teacher:c0'] },
    explanation: 'A huge model is accurate but expensive to serve. We want a model 10× smaller — but training the small one from scratch on the same data gives mediocre results. Distillation\'s insight: the teacher\'s FULL output distribution holds more lessons per example than the right answer alone. Look at this prediction: 78% cat, but 13% dog, 6% fox… and ~0 for car. The teacher is revealing which mistakes are REASONABLE — what the field calls dark knowledge.',
  };

  yield {
    state: matrixState({
      title: soft ? 'Training target: the teacher\'s soft distribution' : 'Training target: the hard label (one-hot)',
      rows: [{ id: 'target', label: 'target' }],
      columns: cols,
      values: [target],
      format: pct,
    }),
    highlight: soft ? {} : { active: ['target:c0'] },
    explanation: soft
      ? 'The student\'s training target is the whole row — every probability, not just the winner. One example now teaches: "this is a cat, dogs and foxes are nearby concepts, cars and trees are unrelated." (In practice both models\' logits are softened with a temperature around T=2–4 first — see Softmax & Temperature — which amplifies exactly those small, information-rich probabilities.)'
      : 'The hard label says one thing: "cat, and nothing else matters." 100% cat, 0% everything — the fact that a dog resembles a cat more than a car does has been erased. The student will have to rediscover all of that structure on its own, example by example.',
  };

  let student = [...STUDENT_START];
  const rows = [{ id: 'e0', label: 'epoch 0' }];
  const values = [STUDENT_START];
  for (let epoch = 1; epoch <= 3; epoch += 1) {
    student = student.map((s, j) => s + 0.55 * (target[j] - s));
    const total = student.reduce((a, b) => a + b, 0);
    student = student.map((s) => s / total);
    rows.push({ id: `e${epoch}`, label: `epoch ${epoch}` });
    values.push([...student]);
    yield {
      state: matrixState({
        title: 'The student (tiny model) learning',
        rows: rows.map((r) => ({ ...r })),
        columns: cols,
        values: values.map((v) => [...v]),
        format: pct,
      }),
      highlight: { active: [`e${epoch}`] },
      explanation: `Epoch ${epoch}: the student's distribution moves toward the target. ${soft
        ? `It is absorbing the SHAPE: cat dominant, dog second, fox third — the teacher's worldview compressing into a smaller brain.`
        : `It is collapsing toward the one-hot spike — increasingly confident about "cat," learning nothing about what nearly-cat looks like.`}`,
      invariant: 'The student row always sums to 100% — it is still a softmax output.',
    };
  }

  yield {
    state: matrixState({
      title: soft ? 'Distilled student vs teacher' : 'Hard-label student vs teacher',
      rows: [{ id: 'student', label: 'student' }, { id: 'teacher', label: 'teacher' }],
      columns: cols,
      values: [[...student], TEACHER],
      format: pct,
    }),
    highlight: {},
    explanation: soft
      ? 'After full training the student mimics the teacher\'s judgments — including its calibrated doubts — at a fraction of the size. This is not hypothetical: DistilBERT kept ~97% of BERT\'s quality at 40% smaller and 60% faster, and today\'s strongest small LLMs are routinely trained on frontier-model outputs (distillation at dataset scale). Stack Quantization on top of a distilled student and the compression multiplies.'
      : 'The hard-label student became confidently narrow: high accuracy on easy cases, but it never inherited the teacher\'s sense of which alternatives are plausible — so it generalizes worse on ambiguous inputs. Flip the control to soft labels and compare the final rows: the difference IS the dark knowledge.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Knowledge distillation is the idea of training a small, fast neural network (the student) by learning from a large, accurate one (the teacher). Instead of training the student on the same raw data and hard labels that humans provide, you feed it the teacher's full probability distribution — the soft, fuzzy, calibrated judgments the teacher makes. The reason: a teacher's confidences encode patterns you can't recover from one-hot labels alone.`,
        `Consider a photo of a cat. A hard label says: "this is a cat, period." But the teacher's distribution might say: "78% cat, 13% dog, 6% fox, 2% car, 1% tree." That structure is the signal. It reveals which mistakes are plausible — dogs and foxes share features with cats; cars don't. Teaching a student those relationships accelerates learning and improves generalization. This hidden knowledge is called dark knowledge, and it is why distillation works.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The teacher is trained normally on your task and frozen. You then create a student model — much smaller, maybe 10× fewer parameters — and train it to mimic the teacher's outputs. The training happens in two steps. First, both models' logits (pre-softmax numbers) are passed through a softened softmax with a temperature parameter, typically T=2 to 4. Temperature stretches the probability distribution, smoothing sharp peaks into gentler curves. A hard label [1, 0, 0, 0, 0] stays a spike no matter what; but [0.78, 0.13, 0.06, 0.02, 0.01] with T=3 becomes much flatter and richer in information. Second, the student's loss is computed against these soft targets, and backpropagation (Gradient Descent) updates the student to match.`,
        `The student gradually absorbs the teacher's entire worldview — not just which answer is correct, but the teacher's calibrated confidence in alternatives. After training, you can use the student alone in production. It runs 3–10× faster and uses a fraction of the memory, while retaining most of the teacher's quality. Many production systems do this: serve the distilled student and retire the teacher. For a dataset-scale example, today's frontier small language models like Llama 3.2B are trained on outputs from GPT-4o and Claude 3.5, inheriting reasoning patterns that training from scratch alone could never produce in a 3B model.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The student itself is smaller, so inference is much cheaper. But distillation adds one upfront cost: you must first train the teacher. If the teacher is a huge model like BERT or GPT, that is expensive and slow — though it happens once. The student trains faster than the teacher did, and on the same data. In practice, distillation is applied at three scales: small student, large dataset (e.g., DistilBERT on Wikipedia); small student, student dataset created by the teacher (e.g., Llama 3.2B trained on synthetic reasoning traces from GPT-4o); and stacking, where you quantize the distilled student further, achieving 2–3× compression on top of the 10× baseline. The combined effect can be a model 100× smaller than the original teacher while keeping 95% of quality.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The prototypical success is DistilBERT, released in 2019. BERT was a breakthrough but huge — 340M parameters. DistilBERT achieved 97% of BERT's quality on downstream tasks (GLUE benchmark) while being 40% smaller and 60% faster. It is now the default choice for production NLP tasks where inference latency matters. Modern small language models follow the same pattern: Llama 3.2B, Mistral 7B, and Phi 3.5 are all trained partly or wholly on outputs from larger frontier models, compressing reasoning into tiny footprints. Mobile models, edge deployment, real-time chat — everywhere you see a fast, small model that still seems smart, distillation is at work. Quantization stacked on top (int8 or lower) shrinks it further: a distilled-and-quantized model can fit on a phone with room to spare.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A common mistake is assuming the teacher must be much larger than the student. Not always. A larger teacher helps, but a slightly-larger or equal-size teacher, trained longer or on more data, can also teach well. Another trap: hard labels are not just slower — they are fundamentally different. Flipping between soft and hard targets in your control above shows the dramatic difference. A student trained on hard labels becomes overconfident on easy cases and brittle on ambiguous ones, because it never learned the teacher's calibrated alternatives. Temperature is critical. T=1 collapses the teacher's distribution back toward hard labels; T too high makes everything almost uniform and uninformative. T=2–4 is the sweet spot, balancing smoothness with signal. Finally, distillation does not create knowledge from nothing. The teacher must be accurate to begin with. If the teacher makes systematic errors, the student inherits them, sometimes amplified.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `To deepen your intuition: study Softmax & Temperature to understand how temperature smooths distributions; Neural Network Forward Pass to see how logits flow through a model; Gradient Descent to grasp how the student's weights update toward the teacher; Dropout to see another form of regularization that improves generalization; and Quantization to learn how distillation pairs with compression for extreme efficiency.`,
      ],
    },
  ],
};

