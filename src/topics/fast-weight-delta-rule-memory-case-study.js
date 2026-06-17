// Fast weight delta-rule memory: linear attention as a writable key-value
// memory whose updates can correct old associations instead of only adding.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'fast-weight-delta-rule-memory-case-study',
  title: 'Fast Weight Delta-Rule Memory Case Study',
  category: 'AI & ML',
  summary: 'A sequence-memory case study: linear attention as fast weights, additive outer-product writes, delta-rule corrections, gates, chunkwise training, and retrieval audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fast weight writes', 'delta and gates'], defaultValue: 'fast weight writes' },
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

function memoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'key', label: 'key', x: 0.8, y: 2.3, note: 'addr' },
      { id: 'val', label: 'value', x: 0.8, y: 4.8, note: 'data' },
      { id: 'write', label: 'write', x: 2.8, y: 3.5, note: 'outer' },
      { id: 'mem', label: 'W fast', x: 4.8, y: 3.5, note: 'memory' },
      { id: 'query', label: 'query', x: 6.7, y: 2.3, note: 'read' },
      { id: 'pred', label: 'pred', x: 6.7, y: 4.8, note: 'current' },
      { id: 'err', label: 'error', x: 8.4, y: 4.8, note: 'delta' },
      { id: 'out', label: 'out', x: 8.4, y: 2.3, note: 'answer' },
    ],
    edges: [
      { id: 'e-key-write', from: 'key', to: 'write' },
      { id: 'e-val-write', from: 'val', to: 'write' },
      { id: 'e-write-mem', from: 'write', to: 'mem' },
      { id: 'e-query-mem', from: 'query', to: 'mem' },
      { id: 'e-mem-pred', from: 'mem', to: 'pred' },
      { id: 'e-pred-err', from: 'pred', to: 'err' },
      { id: 'e-err-write', from: 'err', to: 'write' },
      { id: 'e-mem-out', from: 'mem', to: 'out' },
    ],
  }, { title });
}

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x_t', x: 0.7, y: 3.5, note: 'token' },
      { id: 'erase', label: 'erase', x: 2.5, y: 2.2, note: 'gate' },
      { id: 'delta', label: 'delta', x: 2.5, y: 4.8, note: 'error' },
      { id: 'mem', label: 'memory', x: 4.7, y: 3.5, note: 'state' },
      { id: 'chunk', label: 'chunk', x: 6.7, y: 2.2, note: 'parallel' },
      { id: 'hybrid', label: 'hybrid', x: 6.7, y: 4.8, note: 'attn/SSM' },
      { id: 'eval', label: 'eval', x: 8.7, y: 3.5, note: 'recall' },
    ],
    edges: [
      { id: 'e-x-erase', from: 'x', to: 'erase' },
      { id: 'e-x-delta', from: 'x', to: 'delta' },
      { id: 'e-erase-mem', from: 'erase', to: 'mem' },
      { id: 'e-delta-mem', from: 'delta', to: 'mem' },
      { id: 'e-mem-chunk', from: 'mem', to: 'chunk' },
      { id: 'e-mem-hybrid', from: 'mem', to: 'hybrid' },
      { id: 'e-chunk-eval', from: 'chunk', to: 'eval' },
      { id: 'e-hybrid-eval', from: 'hybrid', to: 'eval' },
    ],
  }, { title });
}

function* fastWeightWrites() {
  yield {
    state: memoryGraph('Linear attention as fast weight memory'),
    highlight: { active: ['key', 'val', 'write', 'mem', 'e-key-write', 'e-val-write', 'e-write-mem'], found: ['query', 'out'] },
    explanation: 'Fast weight memory reads linear attention as a writable key-value map. Each token programs a temporary weight matrix with an outer-product write.',
    invariant: 'The memory is changed by the sequence itself.',
  };

  yield {
    state: labelMatrix(
      'Fast-weight operations',
      [
        { id: 'addr', label: 'addr' },
        { id: 'write', label: 'write' },
        { id: 'read', label: 'read' },
        { id: 'decay', label: 'decay' },
        { id: 'reset', label: 'reset' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['key', 'locate', 'clash'],
        ['k x v', 'store', 'stale'],
        ['qW', 'lookup', 'blur'],
        ['gate', 'forget', 'loss'],
        ['state', 'bound', 'cut'],
      ],
    ),
    highlight: { active: ['write:job', 'read:job', 'decay:job'], compare: ['addr:risk', 'read:risk'] },
    explanation: 'The memory has database-like operations: address, write, read, decay, and reset. The challenge is that all of them are learned and compressed.',
  };

  yield {
    state: memoryGraph('Additive writes cannot easily correct stale mappings'),
    highlight: { active: ['pred', 'err', 'write', 'e-pred-err', 'e-err-write'], compare: ['val'], found: ['mem'] },
    explanation: 'Pure additive outer-product writes can pile up conflicting associations. A delta-style update uses the current prediction error to modify the mapping more precisely.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'conflicting writes to same key', min: 0, max: 8 }, y: { label: 'retrieval quality, conceptual', min: 0, max: 1 } },
      series: [
        { id: 'add', label: 'additive', points: [{ x: 0, y: 0.95 }, { x: 2, y: 0.80 }, { x: 4, y: 0.58 }, { x: 6, y: 0.42 }, { x: 8, y: 0.32 }] },
        { id: 'delta', label: 'delta rule', points: [{ x: 0, y: 0.95 }, { x: 2, y: 0.86 }, { x: 4, y: 0.75 }, { x: 6, y: 0.64 }, { x: 8, y: 0.55 }] },
      ],
      markers: [
        { id: 'conflict', x: 4, y: 0.75, label: 'correct' },
      ],
    }),
    highlight: { active: ['delta', 'conflict'], compare: ['add'] },
    explanation: 'This is an intuition chart. The delta rule is valuable when the memory must revise an old key-value mapping instead of only accumulating another write.',
  };
}

function* deltaAndGates() {
  yield {
    state: gateGraph('Gated DeltaNet combines erase and delta updates'),
    highlight: { active: ['erase', 'delta', 'mem', 'e-erase-mem', 'e-delta-mem'], found: ['eval'] },
    explanation: 'Gated DeltaNet combines two complementary controls: a gate that can erase or retain memory, and a delta update that corrects the current key-value prediction.',
    invariant: 'Good memory needs both write precision and forgetting control.',
  };

  yield {
    state: labelMatrix(
      'Update mechanisms',
      [
        { id: 'add', label: 'add' },
        { id: 'delta', label: 'delta' },
        { id: 'gate', label: 'gate' },
        { id: 'gdn', label: 'GDN' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'best', label: 'best' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['append', 'simple', 'clash'],
        ['correct', 'updates', 'noise'],
        ['erase', 'forget', 'loss'],
        ['both', 'recall', 'hard'],
      ],
    ),
    highlight: { active: ['delta:does', 'gate:does', 'gdn:best'], compare: ['add:risk'] },
    explanation: 'The useful comparison is operational. Additive writes store evidence, delta writes correct evidence, gates remove stale evidence, and Gated DeltaNet combines both controls.',
  };

  yield {
    state: gateGraph('Chunkwise training preserves hardware efficiency'),
    highlight: { active: ['mem', 'chunk', 'e-mem-chunk'], compare: ['erase', 'delta'], found: ['eval'] },
    explanation: 'Delta-style memory is only practical if training can be scheduled efficiently. Modern versions use chunkwise parallel algorithms so the recurrence does not become a slow serial loop.',
  };

  yield {
    state: labelMatrix(
      'Mutable fact trace',
      [
        { id: 'old', label: 'old' },
        { id: 'new', label: 'new' },
        { id: 'fix', label: 'fix' },
        { id: 'test', label: 'test' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['A->1', 'write'],
        ['A->2', 'clash'],
        ['delta', 'correct'],
        ['ask A', 'pass'],
      ],
    ),
    highlight: { active: ['new:proof', 'fix:proof', 'test:proof'], removed: ['old:state'] },
    explanation: 'A long trace says an API changed from version 1 to version 2. Additive memory may blur both facts. Delta memory has an explicit correction path and the recall test checks the latest mapping.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fast weight writes') yield* fastWeightWrites();
  else if (view === 'delta and gates') yield* deltaAndGates();
  else throw new InputError('Pick a fast-weight memory view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Long sequences do not only contain facts. They contain changes to facts. A document can introduce a person's old title, then later say the person moved to a new role. A repository trace can show an API returning one shape, then a migration changing the return value. A useful sequence memory should store evidence, but it should also revise old evidence when the sequence itself says the world changed.`,
        `Fast-weight memory is one way to think about that problem. Instead of treating attention as a lookup over all past tokens, linear attention can be read as a small writable memory inside the model. Each token writes into a temporary weight matrix. Later tokens query that matrix. The memory is "fast" because it changes during the sequence, unlike the model's trained parameters.`,
        `The delta-rule version asks a sharper question: if the memory already returns something for this key, should the new token add another value, or should it correct the current mapping? That distinction matters whenever a later fact is supposed to replace, refine, or override an earlier one.`,
      ],
    },
    {
      heading: 'The simple approach and the wall',
      paragraphs: [
        `The simple linear-attention update is additive. A token produces a key and a value, and the model writes an outer product into a fast matrix. A later query multiplies against that matrix to recover a value-like answer. This is elegant because the memory has fixed size and can be updated as the sequence streams by.`,
        `Additive writing behaves like an append-only summary. That is fine when evidence accumulates, such as repeated mentions of the same name or topic. It is weaker when evidence conflicts. If key A first maps to version 1 and later maps to version 2, blindly adding both associations can make the readout a blurred mixture rather than the current answer.`,
        `The wall is interference. The memory matrix has finite capacity. Similar keys collide. Old associations do not vanish just because a newer token is more relevant. Long-context tasks often fail exactly there: the model remembers that something was said, but not which later statement should control the answer.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to make the write depend on the current error. Before updating memory for a key, read what the memory already predicts. Compare that prediction with the value the current token says should be stored. Then write a correction. This is the old delta-rule idea recast as a learned sequence-memory mechanism.`,
        `A correction update is different from an additive update. If the memory already returns the right value, the correction can be small. If the memory returns a stale or wrong value, the correction can point at the mismatch. The memory is no longer just piling evidence into a matrix. It is trying to move the mapping toward what the latest context says it should return.`,
        `Gates add the other missing control. Some state should persist. Some should decay. Some should be erased when the sequence marks an overwrite. Delta updates give write precision; gates give forgetting policy. A good fast-weight memory needs both, because not every conflict should be handled by adding more signal.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The fast-weight view shows the memory as a key-value structure implemented by a matrix. The key addresses the memory, the value supplies data, the write changes the matrix, and a later query reads from it. The important lesson is that linear attention can be studied as a data structure, not only as a neural-network formula.`,
        `The conflict frame shows why naive additive writing breaks down. When old and new associations share a key or nearby keys, the read can return a mixture. The delta path introduces the prediction error as part of the update, so the write has a chance to correct the old mapping instead of only adding another association beside it.`,
        `The gated view adds time control. An erase gate can remove stale information, a delta update can repair a mapping, and chunkwise training keeps the mechanism practical on accelerators. The animation is not saying the memory is a database with perfect keys. It is showing the operations a learned compressed memory must approximate: address, write, read, correct, forget, and audit.`,
      ],
    },
    {
      heading: 'The data structure inside the model',
      paragraphs: [
        `The core objects are key vectors, value vectors, a fast weight matrix, query vectors, predicted values, delta errors, update rates, erase gates, chunk summaries, and retrieval tests. The model learns the keys, values, gates, and update strengths. The programmer does not assign symbolic keys the way an external database would.`,
        `Still, the data-structure comparison is useful. Additive writes are append-only inserts into compressed state. Delta writes are corrective updates. Gates act like deletion or decay policy. Chunkwise algorithms are execution plans that make many recurrence steps trainable in parallel. Retrieval audits are tests that ask whether the compressed state still answers the right question after conflicts.`,
        `The hard part is that every piece is soft and learned. Keys are not exact strings. Values are not exact rows. The matrix stores many associations superposed in continuous space. That gives the model speed and differentiability, but it also means collisions, drift, and imperfect erasure are normal failure modes rather than rare bugs.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `In additive fast-weight attention, each token contributes an update shaped like an outer product between a key and a value. Accumulating those outer products builds a matrix that later queries can read. Conceptually, the matrix maps addresses to stored content. In practice, it is a compressed learned state.`,
        `In a delta-rule memory, the token first checks the current mapping. The model reads the memory with the relevant key or query, gets a predicted value, compares that prediction with the target value, and writes the difference. This turns the update into "make the current memory more correct for this key" instead of "add this value again."`,
        `Gated DeltaNet-style mechanisms combine this correction with learned gates. A gate can retain old state, weaken old state, or erase aggressively. The update can be scheduled in chunks so training does not become a purely serial loop across every token. That execution detail is not cosmetic. Without chunkwise or parallel-friendly algorithms, a nice recurrence can be too slow to scale.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `It works when the memory's own readout is a useful diagnostic. If a key already maps to the desired value, the error is small and the update does not need to disturb the matrix much. If the key maps to a stale value, the error names the direction of repair. That is the corrective advantage over plain accumulation.`,
        `It also works because many sequence tasks have local overwrite structure. A paragraph says the default setting is false, then later says the migration sets it to true. A code diff shows a method removed and replaced. A legal document defines a term, then amends it. In each case, the later token is not just more evidence. It changes which association should be retrieved.`,
        `Gates make the time horizon learnable. Some facts should last for the whole document. Some should expire after a local block. Some should be overwritten immediately. A single decay constant cannot express all of that. Learned gates give the model a way to choose retention behavior from the content of the sequence.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Imagine a model reading a long repository trace. Early in the trace, it sees "API A returns shape v1." Many lines later, a migration says "API A now returns shape v2." Later still, a test asks what shape API A returns today. The answer should be v2, but the model may still need to explain that v1 existed historically.`,
        `With additive memory, both associations can be present under similar keys. A query for API A may retrieve a blend, or it may choose the old association because it appeared in a stronger local pattern. The model looks like it has memory, but its memory does not know which write was a replacement.`,
        `With delta-rule memory, the later v2 statement can read the current A mapping, see that the memory still points toward v1, and write a correction. A gate can reduce stale v1 state while preserving enough context to answer historical questions. The retrieval audit should test both facts: current value is v2, and v1 was the old value before the migration.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The first cost is capacity. A fast-weight matrix is not unlimited memory. It compresses many associations into fixed state, so collisions are expected. Larger hidden states can help, but they raise compute and memory cost. Better update rules can help, but they do not remove the information bottleneck.`,
        `The second cost is kernel and training complexity. Additive linear attention is attractive partly because it can be made efficient. Delta updates, gates, and chunkwise scans add machinery. If the implementation is slow or numerically fragile, the model can lose the very hardware advantage that made linear-time memory appealing.`,
        `The third cost is evaluation. Language-model loss can improve while the overwrite behavior remains weak. A serious evaluation needs mutable key-value traces, entity updates, code migrations, multi-hop retrieval after edits, latency, memory footprint, and ablations against ordinary attention, state-space layers, and retrieval-augmented systems.`,
      ],
    },
    {
      heading: 'Where it wins and where it fails',
      paragraphs: [
        `Delta-rule memory is strongest when the sequence contains mutable associations: revised instructions, changing API behavior, updated entity attributes, evolving plans, or facts where the latest value should dominate the old one. It is also useful as a conceptual bridge between linear attention, recurrent state, and learned memory updates.`,
        `It fails when keys collide too strongly, when the correction target is noisy, or when gates erase information the task later needs. Correction can amplify mistakes if the model writes confidently in the wrong direction. Forgetting can become destructive when the task needs both the old and new facts.`,
        `It can also fail as an engineering choice. A mechanism that wins a synthetic overwrite benchmark but requires immature kernels, worse throughput, or delicate training may be the wrong layer for a production model. The right comparison includes quality, speed, memory, stability, and task mix.`,
      ],
    },
    {
      heading: 'Misconceptions and pitfalls',
      paragraphs: [
        `One misconception is that fast-weight memory is an external database. It is not. There are no exact keys, no durable rows, and no guarantee that a later query can recover an arbitrary past fact. It is a learned compressed memory inside the model's forward pass.`,
        `Another misconception is that the delta rule simply makes memory longer. The real benefit is not length by itself. It is better handling of corrections. Long memory that preserves stale facts too strongly can be worse than shorter memory for tasks where the current value matters.`,
        `A third pitfall is ignoring the difference between overwrite and accumulation. Some evidence should accumulate, such as repeated support for a topic. Some evidence should replace, such as a changed API contract. A good evaluation separates those cases instead of rewarding any mechanism that remembers more tokens.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Linear Transformers Are Secretly Fast Weight Programmers at https://arxiv.org/abs/2102.11174, Gated Delta Networks: Improving Mamba2 with Delta Rule at https://arxiv.org/abs/2412.06464 and https://openreview.net/forum?id=r8H7xhYPwz, the NVLabs implementation at https://github.com/NVlabs/GatedDeltaNet, and Mamba-2 SSD at https://arxiv.org/abs/2405.21060.`,
        `Study Linear Attention Prefix-State Primer to understand the state carried by linear attention. Study Mamba-2 Structured State Space Duality Case Study for the connection between attention-like and state-space views. Study RetNet Retention State Case Study and Hybrid Attention State Budget Case Study for other ways to budget sequence state. Then compare all of them against external retrieval, because learned internal memory and explicit retrieved context solve different parts of the long-context problem.`,
        `A useful exercise is to design three traces: one where facts accumulate, one where a fact is overwritten, and one where the old fact must remain historically answerable. A memory mechanism that treats all three traces the same has not learned the distinction this topic is about.`,
      ],
    },
  ],
};
