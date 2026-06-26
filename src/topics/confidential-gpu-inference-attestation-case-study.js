// Confidential GPU inference: attest CPU and GPU trust state, release encrypted
// model weights, protect inference traffic, and audit the serving path.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'confidential-gpu-inference-attestation-case-study',
  title: 'Confidential GPU Inference Attestation Case Study',
  category: 'AI & ML',
  summary: 'A secure-AI deployment case study: CPU TEE, GPU attestation, driver trust, encrypted model release, protected inference traffic, tenant policy, and audit traces.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['gpu trust', 'inference path'], defaultValue: 'gpu trust' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function gpuGraph(title) {
  return graphState({
    nodes: [
      { id: 'cpu', label: 'CPU TEE', x: 0.8, y: 3.5, note: 'VM' },
      { id: 'driver', label: 'drv', x: 2.4, y: 2.0, note: 'stack' },
      { id: 'gpu', label: 'GPU', x: 2.4, y: 5.0, note: 'device' },
      { id: 'quote', label: 'quote', x: 4.1, y: 3.5, note: 'CPU+GPU' },
      { id: 'root', label: 'root', x: 5.8, y: 2.0, note: 'vendor' },
      { id: 'policy', label: 'policy', x: 5.8, y: 5.0, note: 'tenant' },
      { id: 'keys', label: 'keys', x: 7.4, y: 3.5, note: 'release' },
      { id: 'model', label: 'model', x: 9.0, y: 2.0, note: 'weights' },
      { id: 'audit', label: 'audit', x: 9.0, y: 5.0, note: 'trace' },
    ],
    edges: [
      { id: 'e-cpu-driver', from: 'cpu', to: 'driver' },
      { id: 'e-cpu-gpu', from: 'cpu', to: 'gpu' },
      { id: 'e-driver-quote', from: 'driver', to: 'quote' },
      { id: 'e-gpu-quote', from: 'gpu', to: 'quote' },
      { id: 'e-root-policy', from: 'root', to: 'policy' },
      { id: 'e-quote-policy', from: 'quote', to: 'policy' },
      { id: 'e-policy-keys', from: 'policy', to: 'keys' },
      { id: 'e-keys-model', from: 'keys', to: 'model' },
      { id: 'e-keys-audit', from: 'keys', to: 'audit' },
    ],
  }, { title });
}

function inferGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 3.5, note: 'tenant' },
      { id: 'tls', label: 'TLS', x: 2.2, y: 3.5, note: 'channel' },
      { id: 'cpu', label: 'CPU', x: 3.7, y: 2.0, note: 'pre/post' },
      { id: 'gpu', label: 'GPU', x: 3.7, y: 5.0, note: 'tokens' },
      { id: 'kv', label: 'KV', x: 5.4, y: 1.6, note: 'tenant' },
      { id: 'batch', label: 'batch', x: 5.4, y: 5.4, note: 'mix' },
      { id: 'out', label: 'out', x: 7.1, y: 3.5, note: 'cipher' },
      { id: 'meter', label: 'meter', x: 8.6, y: 2.0, note: 'cost' },
      { id: 'log', label: 'log', x: 8.6, y: 5.0, note: 'redact' },
    ],
    edges: [
      { id: 'e-client-tls', from: 'client', to: 'tls' },
      { id: 'e-tls-cpu', from: 'tls', to: 'cpu' },
      { id: 'e-cpu-gpu', from: 'cpu', to: 'gpu' },
      { id: 'e-gpu-kv', from: 'gpu', to: 'kv' },
      { id: 'e-gpu-batch', from: 'gpu', to: 'batch' },
      { id: 'e-batch-out', from: 'batch', to: 'out' },
      { id: 'e-kv-out', from: 'kv', to: 'out' },
      { id: 'e-out-meter', from: 'out', to: 'meter' },
      { id: 'e-out-log', from: 'out', to: 'log' },
    ],
  }, { title });
}

function* gpuTrust() {
  yield {
    state: gpuGraph('Confidential inference needs CPU and GPU trust state'),
    highlight: { active: ['cpu', 'driver', 'gpu', 'quote', 'e-cpu-driver', 'e-cpu-gpu', 'e-driver-quote', 'e-gpu-quote'], found: ['policy'] },
    explanation: 'A GPU inference server has more than one trust boundary: confidential VM state, GPU device state, driver stack, fabric path, and model-release policy.',
    invariant: 'A trusted CPU VM is not enough if model weights run on an untrusted accelerator path.',
  };
  yield {
    state: labelMatrix(
      'GPU attn',
      [
        { id: 'cpu', label: 'CPU' },
        { id: 'gpu', label: 'GPU' },
        { id: 'drv', label: 'drv' },
        { id: 'model', label: 'model' },
        { id: 'tenant', label: 'tenant' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['VM meas', 'host'],
        ['device', 'firmware'],
        ['version', 'shim'],
        ['digest', 'wrong wts'],
        ['policy', 'mixup'],
      ],
    ),
    highlight: { active: ['cpu:claim', 'gpu:claim', 'drv:claim', 'model:claim'], compare: ['tenant:risk'] },
    explanation: 'The verifier wants a joined evidence row: CPU measurement, GPU attestation, driver and firmware versions, model digest, tenant policy, and session public key.',
  };
  yield {
    state: gpuGraph('Policy releases model keys only to approved accelerator state'),
    highlight: { active: ['quote', 'root', 'policy', 'keys', 'model', 'e-root-policy', 'e-quote-policy', 'e-policy-keys', 'e-keys-model'], compare: ['audit'] },
    explanation: 'Encrypted model weights should remain unusable until the verifier accepts both workload state and accelerator trust state. The released key should be scoped to that model and deployment.',
  };
  yield {
    state: gpuGraph('Audit links model release to exact hardware evidence'),
    highlight: { active: ['quote', 'policy', 'keys', 'audit', 'e-keys-audit'], compare: ['model'] },
    explanation: 'A later incident investigation needs to know which CPU image, GPU device state, driver stack, model digest, tenant, and policy version received the decryption key.',
  };
}

function* inferencePath() {
  yield {
    state: inferGraph('Inference traffic crosses protected and shared resources'),
    highlight: { active: ['client', 'tls', 'cpu', 'gpu', 'e-client-tls', 'e-tls-cpu', 'e-cpu-gpu'], found: ['out'] },
    explanation: 'Confidential inference must protect prompts, responses, model weights, and per-tenant runtime state while still using high-throughput batching and GPU memory.',
  };
  yield {
    state: labelMatrix(
      'State',
      [
        { id: 'prompt', label: 'prompt' },
        { id: 'weights', label: 'weights' },
        { id: 'kv', label: 'KV' },
        { id: 'batch', label: 'batch' },
        { id: 'logs', label: 'logs' },
      ],
      [
        { id: 'protect', label: 'protect' },
        { id: 'leak', label: 'leak' },
      ],
      [
        ['TLS/session', 'host'],
        ['enc at rest', 'key scope'],
        ['tenant map', 'cross req'],
        ['policy', 'side channel'],
        ['redact', 'PII'],
      ],
    ),
    highlight: { active: ['prompt:protect', 'weights:protect', 'kv:protect', 'logs:protect'], compare: ['batch:leak'] },
    explanation: 'The serving data structures need tenant tags on KV cache, batch entries, logs, metering rows, and output buffers. Confidential hardware does not remove ordinary isolation bookkeeping.',
  };
  yield {
    state: inferGraph('Batching must preserve tenant and policy boundaries'),
    highlight: { active: ['gpu', 'kv', 'batch', 'out', 'e-gpu-kv', 'e-gpu-batch', 'e-batch-out', 'e-kv-out'], compare: ['client'] },
    explanation: 'Continuous batching is useful, but protected serving must keep tenant ownership and policy state attached to every token stream, KV block, and output chunk.',
  };
  yield {
    state: inferGraph('Telemetry should meter without leaking payloads'),
    highlight: { active: ['out', 'meter', 'log', 'e-out-meter', 'e-out-log'], compare: ['client'] },
    explanation: 'Operators still need latency, tokens, errors, and cost. The telemetry ledger should prefer ids, hashes, counters, and redacted summaries over raw prompts or outputs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'gpu trust') yield* gpuTrust();
  else if (view === 'inference path') yield* inferencePath();
  else throw new InputError('Pick a confidential GPU inference view.');
}


export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'The GPU trust view joins evidence from the CPU TEE, driver stack, GPU device, model digest, tenant policy, and verifier. Active nodes are the evidence currently being bound into the release decision; found nodes are accepted pieces of the trust row.',
      'The inference-path view follows data after key release. A prompt, KV cache block, batch slot, output buffer, log row, and metering row must keep tenant and policy labels until the request is gone.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'LLM and image inference move sensitive data through accelerators. Model weights, prompts, retrieval context, KV cache, logits, completions, and logs can all touch GPU memory or queues near it.',
      'CPU-only confidential computing leaves a gap when plaintext leaves the protected VM and enters an ordinary accelerator path. Confidential GPU inference tries to close that gap while preserving the throughput that made GPU serving useful in the first place.',
      {type:'callout', text:'Confidential GPU inference only holds if key release and every serving queue bind CPU evidence, accelerator state, model identity, and tenant labels together.'},
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is TLS for traffic, encrypted storage for weights, and a normal GPU VM protected by cloud IAM. That works when the model owner, data owner, and infrastructure owner all trust the same operator.',
      'A stronger first attempt attests the confidential VM before releasing model keys. That still ignores whether the GPU, firmware, driver, and serving queues are inside the evidence boundary.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is that inference is a chain, not a box. CPU TEE state, GPU attestation, firmware, driver, model artifact, request router, batch scheduler, KV cache, output stream, telemetry, and fallback path all affect confidentiality.',
      'The second wall is software ownership. A correctly attested GPU cannot save a scheduler that strips tenant ids from KV blocks or a logging path that writes raw prompts to a shared analytics sink.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Key release must bind a joined trust row, not one certificate. The row should include CPU measurement, GPU evidence, driver and firmware versions, GPU mode, model digest, tenant policy, session public key, and policy version.',
      'The runtime invariant is that confidentiality labels move with the data. Prompt buffers, batch entries, KV blocks, output chunks, logs, and cost rows need tenant id, model id, session id, policy id, and deletion state.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A deployment boots a confidential VM, initializes the serving stack, gathers CPU evidence, gathers GPU attestation evidence, and sends the joined row to a verifier. The verifier checks roots, firmware and driver allow lists, model digest, tenant policy, and the session public key before releasing a model key.',
      'After release, the server decrypts the requested model and serves traffic through labeled queues. Continuous batching can mix token streams for throughput, but every stream and KV block must retain ownership so one tenant never receives another tenant\'s state.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The release side works because encrypted weights stay unusable until the verifier accepts both workload and accelerator state. A copied model file, wrong GPU mode, stale driver, or wrong tenant label does not receive the key.',
      'The runtime side works only if data structures preserve labels. If every prompt, KV block, batch slot, output chunk, and telemetry row carries ownership until deletion, throughput optimizations can coexist with policy boundaries.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The direct cost is more setup on the critical path. Attestation, key release, model decrypt, and audit logging may add seconds to cold start and tens of milliseconds to session setup, while GPU throughput still depends on batching efficiency.',
      'The behavior cost is slower change. A driver upgrade, GPU firmware update, model refresh, or new serving container becomes a policy rollout because the trust row changes and old keys should not silently apply.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'This fits hosted private inference where a model provider runs encrypted weights on cloud GPUs, or a regulated tenant sends private prompts to a provider it does not fully trust. Healthcare, finance, legal review, confidential RAG, and model evaluation are natural candidates.',
      'It also fits multi-party AI products. A customer can require attested serving, model digest evidence, redacted telemetry, and a release audit before private data or licensed weights enter the runtime.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Confidential GPU inference is not a model-safety system. It does not prove the model is truthful, fair, non-toxic, or robust against prompt injection.',
      'It fails when surrounding systems leak. Retrieval outside the protected path, cross-tenant KV reuse, raw prompt logs, permissive debug dumps, and fallback routes that disable confidential mode can leak the same data the GPU path protected.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A tenant requests model M7 on GPU class G with policy P3. The verifier receives CPU hash C1, GPU firmware F9, driver D12, model digest SHA256:m7, tenant T4, nonce N8, and session public key S.',
      'Policy P3 requires C1, F9, D12, model M7, tenant T4, and debug disabled, so the verifier wraps key K_m7 to S and stores audit row A55. If the same server later runs driver D13 before policy admits it, K_m7 is denied even if CPU attestation still passes.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: NVIDIA Attestation documentation, NVIDIA Trusted Computing Solutions, Azure confidential GPU documentation, AMD SEV-SNP, Intel TDX, and AWS Nitro Enclaves attestation. Study GPU firmware trust, key-release policy, and tenant-labeled serving queues next.',
      'Then read LLM Continuous Batching, KV Cache, SLO-Aware LLM Request Router, Confidential Computing Attestation Chain, and Private RAG Confidential Enclave. The core transfer is that security evidence and scheduler metadata must describe the same request.',
    ] },
  ],
};
