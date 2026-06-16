// Confidential-computing attestation: measurements, signed reports, quotes,
// verifier policy, freshness nonces, and secret-release decisions.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'confidential-computing-attestation-chain-case-study',
  title: 'Confidential Computing Attestation Chain Case Study',
  category: 'Security',
  summary: 'A trusted-execution case study: workload measurements, TEE reports, signed quotes, freshness nonces, verifier policy, trust roots, secret release, and audit evidence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['quote chain', 'verify policy'], defaultValue: 'quote chain' },
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

function attestationGraph(title) {
  return graphState({
    nodes: [
      { id: 'code', label: 'code', x: 0.7, y: 3.5, note: 'image' },
      { id: 'meas', label: 'meas', x: 2.0, y: 3.5, note: 'hashes' },
      { id: 'tee', label: 'TEE', x: 3.4, y: 2.0, note: 'isolate' },
      { id: 'report', label: 'report', x: 3.4, y: 5.0, note: 'local' },
      { id: 'quote', label: 'quote', x: 5.0, y: 3.5, note: 'signed' },
      { id: 'root', label: 'root', x: 6.5, y: 2.0, note: 'CA' },
      { id: 'nonce', label: 'nonce', x: 6.5, y: 5.0, note: 'fresh' },
      { id: 'verify', label: 'verify', x: 8.0, y: 3.5, note: 'policy' },
      { id: 'secret', label: 'secret', x: 9.4, y: 2.0, note: 'release' },
      { id: 'audit', label: 'audit', x: 9.4, y: 5.0, note: 'evidence' },
    ],
    edges: [
      { id: 'e-code-meas', from: 'code', to: 'meas' },
      { id: 'e-meas-tee', from: 'meas', to: 'tee' },
      { id: 'e-tee-report', from: 'tee', to: 'report' },
      { id: 'e-report-quote', from: 'report', to: 'quote' },
      { id: 'e-root-verify', from: 'root', to: 'verify' },
      { id: 'e-nonce-quote', from: 'nonce', to: 'quote' },
      { id: 'e-quote-verify', from: 'quote', to: 'verify' },
      { id: 'e-verify-secret', from: 'verify', to: 'secret' },
      { id: 'e-verify-audit', from: 'verify', to: 'audit' },
    ],
  }, { title });
}

function policyGraph(title) {
  return graphState({
    nodes: [
      { id: 'quote', label: 'quote', x: 0.8, y: 3.5, note: 'signed' },
      { id: 'sig', label: 'sig', x: 2.1, y: 1.6, note: 'root' },
      { id: 'fresh', label: 'fresh', x: 2.1, y: 5.4, note: 'nonce' },
      { id: 'meas', label: 'meas', x: 3.8, y: 1.6, note: 'allow' },
      { id: 'cfg', label: 'cfg', x: 3.8, y: 5.4, note: 'flags' },
      { id: 'id', label: 'id', x: 5.5, y: 3.5, note: 'tenant' },
      { id: 'policy', label: 'policy', x: 7.1, y: 3.5, note: 'match' },
      { id: 'allow', label: 'allow', x: 8.7, y: 2.0, note: 'key' },
      { id: 'deny', label: 'deny', x: 8.7, y: 5.0, note: 'reason' },
    ],
    edges: [
      { id: 'e-quote-sig', from: 'quote', to: 'sig' },
      { id: 'e-quote-fresh', from: 'quote', to: 'fresh' },
      { id: 'e-sig-meas', from: 'sig', to: 'meas' },
      { id: 'e-fresh-cfg', from: 'fresh', to: 'cfg' },
      { id: 'e-meas-id', from: 'meas', to: 'id' },
      { id: 'e-cfg-id', from: 'cfg', to: 'id' },
      { id: 'e-id-policy', from: 'id', to: 'policy' },
      { id: 'e-policy-allow', from: 'policy', to: 'allow' },
      { id: 'e-policy-deny', from: 'policy', to: 'deny' },
    ],
  }, { title });
}

function* quoteChain() {
  yield {
    state: attestationGraph('Attestation binds code identity to a TEE report'),
    highlight: { active: ['code', 'meas', 'tee', 'report', 'e-code-meas', 'e-meas-tee', 'e-tee-report'], found: ['quote'] },
    explanation: 'A confidential workload starts as a measured image and configuration. The trusted execution environment reports those measurements so a remote verifier can decide what is actually running.',
    invariant: 'Trust is in the measured state, not in the VM name.',
  };
  yield {
    state: labelMatrix(
      'Quote',
      [
        { id: 'm', label: 'meas' },
        { id: 'cfg', label: 'cfg' },
        { id: 'nonce', label: 'nonce' },
        { id: 'pk', label: 'pubkey' },
        { id: 'sig', label: 'sig' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['image hash', 'code id'],
        ['TEE flags', 'mode'],
        ['random', 'fresh'],
        ['session key', 'bind secret'],
        ['vendor chain', 'auth'],
      ],
    ),
    highlight: { active: ['m:field', 'nonce:field', 'pk:field', 'sig:field'], compare: ['cfg:why'] },
    explanation: 'The quote is a signed packet: measurement, configuration, freshness nonce, optional public key, and a signature chain rooted in the platform vendor or cloud provider.',
  };
  yield {
    state: attestationGraph('Verifier checks roots, nonce, and measurements'),
    highlight: { active: ['quote', 'root', 'nonce', 'verify', 'e-root-verify', 'e-nonce-quote', 'e-quote-verify'], compare: ['secret'] },
    explanation: 'The verifier rejects stale nonces, unknown trust roots, unexpected measurements, disabled security flags, or tenant identities that do not match the policy.',
  };
  yield {
    state: attestationGraph('Only verified state receives secrets'),
    highlight: { active: ['verify', 'secret', 'audit', 'e-verify-secret', 'e-verify-audit'], compare: ['code'] },
    explanation: 'The reward for a valid attestation is narrow: release a key, data token, model shard, or policy capability. The audit record should keep the quote digest and exact policy decision.',
  };
}

function* verifyPolicy() {
  yield {
    state: policyGraph('Verification is a sequence of predicates'),
    highlight: { active: ['quote', 'sig', 'fresh', 'e-quote-sig', 'e-quote-fresh'], found: ['policy'] },
    explanation: 'Remote attestation is not one boolean. It is a chain of checks: signature root, freshness, measurement allow list, security configuration, identity, and requested secret scope.',
  };
  yield {
    state: labelMatrix(
      'Predicates',
      [
        { id: 'root', label: 'root' },
        { id: 'fresh', label: 'fresh' },
        { id: 'meas', label: 'meas' },
        { id: 'mode', label: 'mode' },
        { id: 'tenant', label: 'tenant' },
      ],
      [
        { id: 'accept', label: 'accept' },
        { id: 'reject', label: 'reject' },
      ],
      [
        ['trusted', 'unknown CA'],
        ['nonce ok', 'replay'],
        ['allow hash', 'drift'],
        ['debug off', 'weak flag'],
        ['matches', 'wrong scope'],
      ],
    ),
    highlight: { active: ['root:accept', 'fresh:accept', 'meas:accept', 'mode:accept'], removed: ['fresh:reject', 'meas:reject'] },
    explanation: 'The allow list should be specific. A valid quote for the wrong image, wrong debug mode, or wrong tenant is still a denial.',
  };
  yield {
    state: policyGraph('Policy decides allow or deny with reason codes'),
    highlight: { active: ['meas', 'cfg', 'id', 'policy', 'e-meas-id', 'e-cfg-id', 'e-id-policy'], found: ['allow', 'deny'] },
    explanation: 'Good verifiers return precise denial reasons so operators know whether to rebuild the image, update the allow list, rotate trust roots, or block a suspicious launch.',
  };
  yield {
    state: labelMatrix(
      'TEEs',
      [
        { id: 'snp', label: 'SEV-SNP' },
        { id: 'tdx', label: 'TDX' },
        { id: 'nitro', label: 'Nitro' },
        { id: 'gpu', label: 'GPU' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['VM report', 'config drift'],
        ['TD quote', 'root mgmt'],
        ['att doc', 'IAM/KMS'],
        ['device att', 'driver stack'],
      ],
    ),
    highlight: { active: ['snp:proof', 'tdx:proof', 'nitro:proof', 'gpu:proof'], compare: ['gpu:risk'] },
    explanation: 'AMD SEV-SNP, Intel TDX, AWS Nitro Enclaves, and NVIDIA confidential GPUs use different packet formats, but the data-structure shape is the same: measurements, roots, nonce, policy, and release.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'quote chain') yield* quoteChain();
  else if (view === 'verify policy') yield* verifyPolicy();
  else throw new InputError('Pick a confidential-attestation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Confidential-computing attestation lets a remote party verify that code is running inside a trusted execution environment with expected measurements and configuration before it releases secrets or data.',
        'The reusable data structure is a signed quote chain: measured image, configuration flags, nonce, public key, vendor or cloud trust root, verifier policy, secret-release result, and audit record.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The workload boots in a TEE. The platform measures code and configuration. The workload asks the platform for a report or quote, usually including a nonce and sometimes a public key that will receive the released secret.',
        'The verifier checks the signature chain, verifies freshness, compares measurements to an allow list, checks security flags such as debug mode, binds the result to tenant or workload identity, and then releases only the requested scope.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Attestation adds operational state: allow lists, trusted roots, quote parsers, policy versions, key release logs, and measurement rollouts. It is easy to break deployment by changing a build without updating measurement policy.',
        'The upside is strong blast-radius reduction. Secrets can be withheld from unexpected images, debug configurations, stale launches, or workloads outside the expected tenant and platform boundary.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'AWS Nitro Enclaves attestation docs describe attestation documents used to prove enclave identity to external services: https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html. AWS KMS documents condition keys that restrict decrypt operations based on Nitro Enclave attestation claims: https://docs.aws.amazon.com/kms/latest/developerguide/conditions-nitro-enclave.html.',
        'AMD SEV-SNP documentation describes memory encryption and integrity protections with guest attestation reports: https://www.amd.com/en/developer/sev.html. Intel Trust Domain Extensions describes isolated trust domains and attestation for confidential VMs: https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/overview.html.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A payment service can release card-processing keys only to an enclave with the expected image hash. An AI inference service can release model weights only after verifying the serving stack. A data clean room can release a dataset token only to a workload that has audit logging and egress policy enabled.',
        'This pattern connects to SLSA and Sigstore. Supply-chain provenance says what was built. Attestation says what is running now. Secret-release policy joins those claims.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat attestation as magic trust. It verifies measured code and platform state; it does not prove the code is correct, free of side channels, or authorized to access every secret.',
        'Do not release broad long-lived secrets after one quote. Bind secrets to session keys, scopes, policies, and expiration. Keep denial reasons and quote digests for incident response.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS Nitro Enclaves attestation at https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html, AWS KMS Nitro Enclave conditions at https://docs.aws.amazon.com/kms/latest/developerguide/conditions-nitro-enclave.html, AMD SEV at https://www.amd.com/en/developer/sev.html, Intel TDX at https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/overview.html, and Azure confidential computing overview at https://learn.microsoft.com/en-us/azure/confidential-computing/overview. Study Enclave Secret Release Policy Case Study, Confidential GPU Inference Attestation Case Study, Software Supply Chain Provenance Graph, Sigstore Keyless Signing Transparency, and OPA Rego Policy Decision Graph next.',
      ],
    },
  ],
};
