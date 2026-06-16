// DNSSEC chain-of-trust validation: trust anchor, DNSKEY, DS, RRSIG,
// authenticated RRsets, and resolver verdict states.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dnssec-chain-of-trust-validation-case-study',
  title: 'DNSSEC Chain of Trust Validation',
  category: 'Security',
  summary: 'How a validating resolver walks DNSKEY, DS, and RRSIG records from a configured trust anchor to a signed DNS RRset.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['chain validation', 'resolver verdicts'], defaultValue: 'chain validation' },
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

function chainGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'ta', label: 'TA', x: 0.6, y: 4.1, note: notes.ta ?? 'root key' },
      { id: 'rootkey', label: 'rootK', x: 1.9, y: 4.1, note: notes.rootkey ?? 'DNSKEY' },
      { id: 'tldds', label: 'DS', x: 3.2, y: 2.5, note: notes.tldds ?? 'digest' },
      { id: 'tldkey', label: 'tldK', x: 4.5, y: 2.5, note: notes.tldkey ?? 'DNSKEY' },
      { id: 'zoneds', label: 'DS2', x: 5.8, y: 5.7, note: notes.zoneds ?? 'digest' },
      { id: 'zonekey', label: 'zoneK', x: 7.1, y: 5.7, note: notes.zonekey ?? 'DNSKEY' },
      { id: 'sig', label: 'sig', x: 8.1, y: 3.9, note: notes.sig ?? 'RRSIG' },
      { id: 'rrset', label: 'RRset', x: 9.2, y: 3.9, note: notes.rrset ?? 'answer' },
      { id: 'ok', label: 'ok', x: 7.1, y: 1.8, note: notes.ok ?? 'secure' },
    ],
    edges: [
      { id: 'e-ta-rootkey', from: 'ta', to: 'rootkey' },
      { id: 'e-rootkey-tldds', from: 'rootkey', to: 'tldds' },
      { id: 'e-tldds-tldkey', from: 'tldds', to: 'tldkey' },
      { id: 'e-tldkey-zoneds', from: 'tldkey', to: 'zoneds' },
      { id: 'e-zoneds-zonekey', from: 'zoneds', to: 'zonekey' },
      { id: 'e-zonekey-sig', from: 'zonekey', to: 'sig' },
      { id: 'e-sig-rrset', from: 'sig', to: 'rrset' },
      { id: 'e-zonekey-ok', from: 'zonekey', to: 'ok' },
      { id: 'e-rrset-ok', from: 'rrset', to: 'ok' },
    ],
  }, { title });
}

function verdictMatrix() {
  return labelMatrix(
    'DNSSEC resolver verdicts',
    [
      { id: 'secure', label: 'secure' },
      { id: 'bogus', label: 'bogus' },
      { id: 'insec', label: 'insec' },
      { id: 'indet', label: 'indet' },
    ],
    [
      { id: 'proof', label: 'proof' },
      { id: 'answer', label: 'answer' },
      { id: 'cache', label: 'cache' },
    ],
    [
      ['valid', 'AD bit', 'ttl+sig'],
      ['bad', 'fail', 'short'],
      ['no DS', 'plain', 'ttl only'],
      ['missing', 'retry', 'hold'],
    ],
  );
}

function* chainValidation() {
  yield {
    state: chainGraph('A validating resolver starts from a configured root trust anchor'),
    highlight: { active: ['ta', 'rootkey', 'e-ta-rootkey'], compare: ['tldds'] },
    explanation: 'DNSSEC does not make every DNS packet trusted by default. A validating resolver begins with a configured trust anchor, normally the root DNSKEY key-signing key, and uses that as the first authenticated key in the chain.',
    invariant: 'Every later proof is only useful if it connects back to a trust anchor the resolver already accepts.',
  };

  yield {
    state: chainGraph('Delegation Signer records bridge parent zones to child keys'),
    highlight: { active: ['rootkey', 'tldds', 'tldkey', 'zoneds', 'e-rootkey-tldds', 'e-tldds-tldkey', 'e-tldkey-zoneds'], compare: ['zonekey'] },
    explanation: 'A DS record is a hash commitment to a child zone DNSKEY. The parent signs that DS. The resolver checks the parent signature, hashes the child DNSKEY, and accepts the child key only when the digest and algorithm metadata match.',
  };

  yield {
    state: chainGraph('Zone DNSKEY verifies the RRSIG over the requested RRset'),
    highlight: { active: ['zoneds', 'zonekey', 'sig', 'rrset', 'e-zoneds-zonekey', 'e-zonekey-sig', 'e-sig-rrset'], found: ['rootkey', 'tldkey'] },
    explanation: 'At the final zone, the DNSKEY validates the RRSIG over the answer RRset. The resolver also checks owner name, type, class, original TTL, signature inception, signature expiration, algorithm, and key tag.',
  };

  yield {
    state: chainGraph('A secure verdict means key chain and RRset signature both validate', { ok: 'AD ok', rrset: 'A/AAAA', sig: 'valid' }),
    highlight: { found: ['ta', 'rootkey', 'tldds', 'tldkey', 'zoneds', 'zonekey', 'sig', 'rrset', 'ok', 'e-rrset-ok', 'e-zonekey-ok'], active: ['e-ta-rootkey', 'e-tldds-tldkey', 'e-zonekey-sig'] },
    explanation: 'The resolver can now mark the answer secure and may set the Authenticated Data bit for a client that requested DNSSEC validation. The data structure is a signed path: trust anchor, parent digests, child keys, and a signed RRset.',
  };
}

function* resolverVerdicts() {
  yield {
    state: verdictMatrix(),
    highlight: { active: ['secure:proof', 'secure:answer'], compare: ['bogus:answer', 'insec:answer'] },
    explanation: 'A validating resolver is not just a cache. It is a classifier. Secure means a complete proof chain validated. Bogus means a proof was expected but failed. Insecure means the chain intentionally ended at an unsigned delegation. Indeterminate means the resolver cannot finish the proof.',
    invariant: 'DNSSEC validation turns DNS from answer lookup into answer plus proof classification.',
  };

  yield {
    state: labelMatrix(
      'Validation ledger',
      [
        { id: 'key', label: 'key' },
        { id: 'ds', label: 'DS' },
        { id: 'sig', label: 'sig' },
        { id: 'time', label: 'time' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['key ok', 'bad alg'],
        ['dig ok', 'mis'],
        ['sig ok', 'bad sig'],
        ['in win', 'expired'],
      ],
    ),
    highlight: { active: ['key:check', 'ds:check', 'sig:check', 'time:check'], removed: ['sig:fail'] },
    explanation: 'The resolver keeps a validation ledger for each proof. Cryptographic success is not enough; time bounds, algorithms, key tags, DS digest types, and RRset metadata all have to line up.',
  };

  yield {
    state: chainGraph('A broken DS-to-DNSKEY link converts the answer into SERVFAIL', { tldds: 'DS ok', zonekey: 'no match', ok: 'bogus' }),
    highlight: { active: ['tldds', 'zonekey', 'e-zoneds-zonekey'], removed: ['ok', 'e-zonekey-ok'], compare: ['rrset'] },
    explanation: 'If a signed parent says the child should have a particular key and the child cannot prove possession of it, the resolver must not silently return the data. For validating clients, a bogus answer usually becomes SERVFAIL.',
  };

  yield {
    state: labelMatrix(
      'Cache with validation state',
      [
        { id: 'rrset', label: 'RRset' },
        { id: 'key', label: 'DNSKEY' },
        { id: 'neg', label: 'denial' },
        { id: 'bad', label: 'bad' },
      ],
      [
        { id: 'ttl', label: 'ttl' },
        { id: 'state', label: 'state' },
        { id: 'reuse', label: 'reuse' },
      ],
      [
        ['min', 'secure', 'yes'],
        ['key', 'secure', 'yes'],
        ['soa+sig', 'secure', 'yes'],
        ['short', 'bogus', 'limit'],
      ],
    ),
    highlight: { found: ['rrset:state', 'key:state', 'neg:state'], compare: ['bad:reuse'] },
    explanation: 'DNSSEC makes resolver caching richer. The cache stores not only the RRset, but also validation state, proof material, expiration limits, and sometimes negative proofs. Reusing stale cryptographic state carelessly can be worse than missing the cache.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'chain validation') yield* chainValidation();
  else if (view === 'resolver verdicts') yield* resolverVerdicts();
  else throw new InputError('Pick a DNSSEC validation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'DNSSEC adds data origin authentication and integrity to DNS. A validating resolver does not simply ask "what is the answer?" It asks "can this answer be proven by keys that chain back to a configured trust anchor?" The chain uses DNSKEY records, DS records, RRSIG records, and the ordinary DNS delegation hierarchy.',
        'RFC 4033 introduces DNSSEC services and limits at https://www.rfc-editor.org/rfc/rfc4033. RFC 4034 defines resource records such as DNSKEY, RRSIG, DS, and NSEC at https://www.rfc-editor.org/rfc/rfc4034. RFC 4035 defines the protocol changes and validation behavior at https://www.rfc-editor.org/rfc/rfc4035.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The resolver builds a proof path. The root trust anchor authenticates the root DNSKEY RRset. A parent zone signs a DS record that commits to a child DNSKEY. The child DNSKEY verifies its DNSKEY RRset and later signs answer RRsets. The resolver repeats this bridge until it reaches the requested zone and validates the answer RRSIG.',
        'That proof path is a graph, not a single signature. Edges include "this key signs this RRset", "this DS digest matches this child DNSKEY", and "this signature is currently valid". The resolver also tracks TTLs, RRSIG inception and expiration, algorithm constraints, name matching, type matching, and validation status.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A client asks for www.example.com A with DNSSEC validation. The recursive resolver fetches the answer RRset and RRSIG, the example.com DNSKEY RRset, the DS record from com, the com DNSKEY RRset, and the DS record from root. Starting from its root trust anchor, it verifies each signed RRset and DS digest until the final RRSIG validates the answer.',
        'If every link validates, the answer is secure and can be cached with its validation state. If the parent has no DS for the child, the child is insecure rather than bogus. If a signed link fails, the resolver treats the data as bogus and normally returns SERVFAIL instead of a forged address.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'DNSSEC does not encrypt DNS queries and does not hide the name being looked up. DNS-over-HTTPS or DNS-over-TLS can protect the transport to a resolver, but DNSSEC protects data authenticity. These are different layers.',
        'DNSSEC also does not make every operational mistake harmless. Expired RRSIGs, broken key rollovers, mismatched DS records, unsupported algorithms, or aggressive caching of bad states can take a signed domain offline for validating users.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study How DNS Works for the resolver walk, DNS Negative Cache & NXDOMAIN for absence caching, DNSSEC NSEC3 Authenticated Denial for signed non-existence proofs, Sparse Merkle Tree Non-Membership for a modern authenticated-absence analogy, Merkle Tree for hash commitments, and TLS 1.3 Handshake for the adjacent certificate-authentication layer.',
      ],
    },
  ],
};
