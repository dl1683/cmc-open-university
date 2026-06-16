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
    {
      heading: 'What it is',
      paragraphs: [
        'Confidential GPU inference extends confidential computing from CPU memory into accelerator-backed AI serving. The goal is to protect prompts, outputs, model weights, and runtime state while still using high-throughput GPUs.',
        'The key data structure is a joined trust record: CPU confidential-VM quote, GPU device attestation, driver and firmware state, model digest, tenant policy, session key, and audit span.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The server boots in a confidential VM, attests the CPU environment, attests or verifies GPU trust state, and asks a verifier or KMS to release encrypted model weights only if the whole serving path matches policy.',
        'During inference, request state crosses TLS, CPU pre-processing, GPU kernels, KV cache, batching, output buffers, metering, and logs. Each data structure needs tenant and policy tags so confidentiality is not lost in ordinary serving mechanics.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Confidential GPU deployments add launch checks, driver constraints, attestation APIs, key-release policy, telemetry redaction, and more difficult debugging. They may also restrict low-level profiling or custom kernels depending on platform support.',
        'The payoff is that model owners and data owners can reduce trust in the cloud host. That matters for proprietary weights, regulated prompts, data clean rooms, private fine-tuning, and multi-tenant inference.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'NVIDIA confidential computing documentation describes protecting accelerated workloads and attesting platform state: https://docs.nvidia.com/confidential-computing/latest/. NVIDIA NVTrust documentation covers components for GPU attestation and confidential computing: https://docs.nvidia.com/nvtrust/latest/index.html.',
        'Microsoft Azure confidential computing documentation covers confidential VMs and trusted execution environments: https://learn.microsoft.com/en-us/azure/confidential-computing/overview. Google Cloud Confidential Computing documents confidential workloads and Confidential Space: https://cloud.google.com/confidential-computing/confidential-space/docs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A model provider can serve encrypted weights on cloud GPUs without handing plaintext weights to the host environment. A healthcare customer can send prompts into an attested serving enclave and require redacted telemetry. A data clean room can run GPU inference over private data with a measurable release policy.',
        'This also changes procurement. The question is no longer only tokens per second; it is tokens per second under a verifiable trust boundary with usable audit evidence.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume confidential hardware solves application leakage. Logs, metrics, batching metadata, retrieval documents, and outputs can still leak. Do not ignore tenant tags on KV cache and batch queues.',
        'Do not treat a GPU attestation as a model-quality proof. It proves hardware and software state claims, not correctness, fairness, safety, or absence of prompt injection.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA Confidential Computing at https://docs.nvidia.com/confidential-computing/latest/, NVIDIA NVTrust at https://docs.nvidia.com/nvtrust/latest/index.html, Azure confidential computing at https://learn.microsoft.com/en-us/azure/confidential-computing/overview, Google Confidential Space at https://cloud.google.com/confidential-computing/confidential-space/docs, and AMD SEV at https://www.amd.com/en/developer/sev.html. Study Private RAG Confidential Enclave Case Study, Enclave Secret Release Policy Case Study, LLM Continuous Batching, KV Cache, and SLO-Aware LLM Request Router next.',
      ],
    },
  ],
};
