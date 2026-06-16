// ACME certificate issuance: account keys, orders, authorizations,
// challenges, validation evidence, finalized CSRs, and logged certificates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'acme-order-challenge-certificate-issuance-case-study',
  title: 'ACME Order Challenge Certificate Issuance',
  category: 'Security',
  summary: 'How ACME turns a domain-control proof into an issued certificate through account keys, orders, authorizations, challenges, CSRs, and issuance state.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['order flow', 'challenge proof'], defaultValue: 'order flow' },
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

function acmeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'acct', label: 'acct', x: 0.7, y: 4.0, note: notes.acct ?? 'JWS key' },
      { id: 'nonce', label: 'nonce', x: 2.0, y: 2.5, note: notes.nonce ?? 'anti replay' },
      { id: 'order', label: 'order', x: 3.2, y: 4.0, note: notes.order ?? 'names' },
      { id: 'authz', label: 'authz', x: 4.6, y: 5.8, note: notes.authz ?? 'domain' },
      { id: 'chall', label: 'chall', x: 4.6, y: 2.2, note: notes.chall ?? 'http/dns' },
      { id: 'token', label: 'token', x: 6.1, y: 2.2, note: notes.token ?? 'key auth' },
      { id: 'va', label: 'VA', x: 7.3, y: 4.0, note: notes.va ?? 'validate' },
      { id: 'csr', label: 'CSR', x: 8.4, y: 5.8, note: notes.csr ?? 'finalize' },
      { id: 'cert', label: 'cert', x: 9.3, y: 4.0, note: notes.cert ?? 'issued' },
      { id: 'ct', label: 'CT', x: 8.4, y: 2.2, note: notes.ct ?? 'logged' },
    ],
    edges: [
      { id: 'e-acct-nonce', from: 'acct', to: 'nonce' },
      { id: 'e-acct-order', from: 'acct', to: 'order' },
      { id: 'e-order-authz', from: 'order', to: 'authz' },
      { id: 'e-order-chall', from: 'order', to: 'chall' },
      { id: 'e-chall-token', from: 'chall', to: 'token' },
      { id: 'e-token-va', from: 'token', to: 'va' },
      { id: 'e-authz-va', from: 'authz', to: 'va' },
      { id: 'e-va-csr', from: 'va', to: 'csr' },
      { id: 'e-csr-cert', from: 'csr', to: 'cert' },
      { id: 'e-cert-ct', from: 'cert', to: 'ct' },
    ],
  }, { title });
}

function* orderFlow() {
  yield {
    state: acmeGraph('An ACME account key signs replay-protected requests'),
    highlight: { active: ['acct', 'nonce', 'order', 'e-acct-nonce', 'e-acct-order'], compare: ['authz'] },
    explanation: 'ACME clients use an account key to sign JWS requests. Server-provided nonces make those requests replay-resistant. The first data structure is a stateful protocol ledger, not the certificate itself.',
    invariant: 'Issuance is gated by account identity, replay protection, authorization state, and final certificate request state.',
  };

  yield {
    state: acmeGraph('A new order expands into per-identifier authorizations', { order: 'api+www', authz: 'pending' }),
    highlight: { active: ['order', 'authz', 'chall', 'e-order-authz', 'e-order-chall'], found: ['acct'] },
    explanation: 'The client requests identifiers such as api.example.com and www.example.com. The ACME server creates an order and one or more authorizations, each with challenge choices that can prove control of that identifier.',
  };

  yield {
    state: acmeGraph('Successful challenges move authorizations to valid', { chall: 'dns-01', token: 'TXT ok', va: 'valid', authz: 'valid' }),
    highlight: { active: ['chall', 'token', 'va', 'authz', 'e-chall-token', 'e-token-va', 'e-authz-va'], compare: ['csr'] },
    explanation: 'A validation authority checks the challenge evidence from the public internet. For dns-01 it expects a TXT record under _acme-challenge. For http-01 it expects a token-derived response at a well-known HTTP path.',
  };

  yield {
    state: acmeGraph('Finalization signs a CSR and returns an issued certificate', { csr: 'ready', cert: 'issued', ct: 'SCT' }),
    highlight: { found: ['va', 'csr', 'cert', 'ct', 'e-va-csr', 'e-csr-cert', 'e-cert-ct'], active: ['order'] },
    explanation: 'When required authorizations are valid, the client finalizes the order with a CSR. The CA issues the certificate, usually logs it to Certificate Transparency, and the client installs it for TLS.',
  };
}

function* challengeProof() {
  yield {
    state: labelMatrix(
      'ACME object states',
      [
        { id: 'order', label: 'order' },
        { id: 'authz', label: 'authz' },
        { id: 'chall', label: 'chall' },
        { id: 'cert', label: 'cert' },
      ],
      [
        { id: 'start', label: 'start' },
        { id: 'good', label: 'good' },
        { id: 'bad', label: 'bad' },
      ],
      [
        ['pend', 'ready', 'bad'],
        ['pend', 'valid', 'bad'],
        ['pend', 'valid', 'bad'],
        ['none', 'issued', 'rev'],
      ],
    ),
    highlight: { active: ['order:good', 'authz:good', 'chall:good'], compare: ['cert:good'], removed: ['chall:bad'] },
    explanation: 'ACME is clean because it exposes state transitions. Clients poll and advance orders, authorizations, challenges, and finalization instead of treating issuance as a black-box API call.',
    invariant: 'The CA issues only after every required authorization becomes valid.',
  };

  yield {
    state: labelMatrix(
      'Challenge evidence',
      [
        { id: 'http01', label: 'http01' },
        { id: 'dns01', label: 'dns01' },
        { id: 'tlsalpn', label: 'alpn' },
        { id: 'bad', label: 'bad' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['path', 'token'],
        ['TXT', 'digest'],
        ['cert', 'ext'],
        ['private', 'no'],
      ],
    ),
    highlight: { active: ['http01:proof', 'dns01:proof', 'tlsalpn:proof'], removed: ['bad:proof'] },
    explanation: 'Each challenge maps domain control to a public lookup. The evidence must be reachable by the CA validation authority, not just by the client inside a private network.',
  };

  yield {
    state: acmeGraph('DNS-01 ties issuance to DNS propagation and cache behavior', { chall: 'dns-01', token: 'TXT', va: 'query', cert: 'wait' }),
    highlight: { active: ['chall', 'token', 'va', 'e-chall-token', 'e-token-va'], compare: ['cert'], found: ['authz'] },
    explanation: 'DNS-01 is powerful because it can issue wildcard certificates, but it inherits DNS TTL, negative-cache, and delegation behavior. A stale NXDOMAIN or slow TXT propagation can delay issuance even when the client updated the zone.',
  };

  yield {
    state: labelMatrix(
      'Issuance guardrails',
      [
        { id: 'nonce', label: 'nonce' },
        { id: 'acct', label: 'acct' },
        { id: 'CAA', label: 'CAA' },
        { id: 'CT', label: 'CT' },
      ],
      [
        { id: 'guards', label: 'guards' },
        { id: 'miss', label: 'if weak' },
      ],
      [
        ['replay', 'dup req'],
        ['client', 'takeover'],
        ['issuer', 'wrong CA'],
        ['visible', 'hidden'],
      ],
    ),
    highlight: { found: ['nonce:guards', 'acct:guards', 'CAA:guards', 'CT:guards'], compare: ['CT:miss'] },
    explanation: 'A production issuance path tracks more than the challenge. It checks account key custody, CAA policy, replay nonces, authorization reuse, CT logging, rate limits, and renewal timing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'order flow') yield* orderFlow();
  else if (view === 'challenge proof') yield* challengeProof();
  else throw new InputError('Pick an ACME view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'ACME is the protocol used by certificate authorities such as Let\'s Encrypt to automate certificate issuance and renewal. It converts domain-control evidence into a certificate through signed account requests, orders, authorizations, challenges, CSR finalization, and certificate retrieval.',
        'RFC 8555 defines ACME at https://www.rfc-editor.org/rfc/rfc8555. Let\'s Encrypt documents common challenge types such as http-01 and dns-01 at https://letsencrypt.org/docs/challenge-types/. Certificate Transparency gives issued certificates public visibility; RFC 6962 describes CT at https://datatracker.ietf.org/doc/html/rfc6962.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The ACME server maintains stateful resources: account, nonce, order, authorization, challenge, finalization URL, certificate URL, and error objects. Each client request is signed by the account key, and each server response advances or rejects a resource state.',
        'The key shape is a dependency graph. A certificate depends on an order. An order depends on authorizations. Each authorization depends on at least one successful challenge. Each challenge depends on public evidence that the CA can verify.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A service wants a certificate for api.example.com. Its ACME client creates an order, receives an authorization, chooses dns-01, publishes the required TXT record under _acme-challenge.api.example.com, and asks the server to validate. The validation authority queries DNS, checks the key authorization digest, marks the authorization valid, then accepts a CSR and issues the certificate.',
        'For renewals, the client repeats the flow before expiry, handles failed validations, watches rate limits, and installs the new certificate without breaking the running TLS service. DNSSEC, negative caching, and DNS serve-stale policies can all affect the dns-01 branch.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'ACME proves control at validation time, not eternal ownership. A DNS provider compromise, stale automation secret, dangling CNAME, or web-path takeover can still authorize a certificate. Issuance automation therefore needs secret management, CAA checks, CT monitoring, and cleanup of old challenge records.',
        'DNS-01 is not instant. Recursive resolvers can cache missing TXT records, authoritative changes can propagate slowly, and split-horizon DNS can make the CA see a different answer than the client.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study DNSSEC Chain of Trust Validation, DNS Negative Cache & NXDOMAIN, DNS Serve-Stale Resolver Cache, TLS 1.3 Handshake, TLS 1.3 Resumption & 0-RTT Tickets, Transparency Log Witnessing Case Study, and OAuth PKCE Token Lifecycle Case Study. Together they show how public identity, proof state, transport security, and operational automation fit together.',
      ],
    },
  ],
};
