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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a proof path, not as a lookup tree alone. DNSSEC is the DNS Security Extensions protocol family, an RRset is a set of DNS records with the same owner name and type, and a validating resolver is a resolver that checks signatures before trusting data. Active state is the link being checked, visited state is proof material already validated, and found state is a final verdict.',
        'The safe inference is chained trust. If the resolver trusts the root key, and the root signs a DS record for com, and com signs a DS record for example.com, then a valid example.com DNSKEY can be trusted to verify records in that child zone. A final signature is not enough without the parent commitments that authorize the key.',
        {type: "callout", text: "DNSSEC validation is a proof path through delegated keys, not a signature check on the final RRset alone."},
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/d/d2/DNS_schema.svg", alt: "Schematic diagram of the domain-name hierarchy from a root node through top-level domains and subdomains.", caption: "DNS hierarchy diagram, TilmannR, based on work by Hank van Helvete and George Shuklin, CC BY-SA 2.5, via Wikimedia Commons."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Classic DNS tells a resolver what answer came back, but it does not prove that the answer came from the zone owner. Attackers have exploited that gap through forged responses and cache poisoning. DNSSEC adds origin authentication and integrity to DNS data.',
        'The resolver needs more than a signature over the final answer. It needs to know that the signing key is authorized for the zone that owns the answer. The chain of trust solves that authorization problem by following DNS delegation from a configured trust anchor.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first simple idea is to let every zone publish a public key next to its signed records. That fails because an attacker who can forge the record can also send a forged key. The resolver needs an independent reason to trust the key.',
        'The second simple idea is to configure every resolver with every zone key. That does not scale because zones delegate, appear, disappear, and roll keys. A resolver needs a smaller root of trust and a repeatable way to authorize child keys.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Delegation is the wall. DNS authority moves from root to top-level domain to child zone, so validation must move with it. A signature by example.com matters only if the resolver can prove that the example.com key was authorized by its parent chain.',
        'Time is part of the wall. DNSSEC signatures have inception and expiration times, records have TTLs, and keys roll. A resolver that accepts expired proof can turn yesterday authority into today false trust.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'DNSSEC validation is a sequence of authenticated commitments. A trust anchor authorizes a parent DNSKEY, the parent signs a DS record that commits to a child DNSKEY, and the child key signs records in its zone. Each link narrows which key is allowed to speak for the next zone.',
        'The resolver verdict comes from the whole path. Secure means the chain and final RRset signature validate. Bogus means required proof failed, insecure means the signed chain intentionally ended at an unsigned delegation, and indeterminate means the resolver could not decide.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For www.example.com A, the resolver collects the answer RRset and RRSIG, the example.com DNSKEY RRset, the DS record from com, the com DNSKEY RRset, and the DS record from the root zone. Cached material can be reused only inside its TTL and signature validity window. Each piece has a role in the proof.',
        'Starting from the root trust anchor, the resolver validates signed root material, checks the root DS commitment to the com DNSKEY, validates com DNSKEY material, checks the com DS commitment to the example.com DNSKEY, and then validates the final answer signature. It also checks algorithm, key tag, owner name, record type, class, original TTL, and signature time.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is induction over delegation. The trust anchor is accepted as the base case. If a trusted parent signs a DS record that matches a child DNSKEY, and that child DNSKEY validates its DNSKEY RRset, then the child key is authorized for that zone.',
        'The final answer is accepted only after the authorized zone key validates the RRset signature. A forged DNSKEY fails at the parent DS check. A forged answer under the real zone fails at the RRSIG check. Expired or mismatched proof fails before it can become cached authority.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'DNSSEC adds records and computation to ordinary DNS resolution. A lookup may need DNSKEY, DS, and RRSIG records in addition to the requested answer. Larger responses can cause UDP truncation and TCP fallback, and each signature check consumes CPU.',
        'Caching changes the behavior. Once a resolver has valid com DNSKEY and DS material, many child lookups can reuse it until TTL or signature expiration. The cost then shifts from repeated chain fetches to careful cache lifetime management and operational handling of key rollovers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DNSSEC is useful where resolvers must reject forged DNS data even on hostile networks. It protects the cache because a fake RRset cannot be stored as secure unless the attacker can produce a valid chain to the trust anchor. That changes DNS from unauthenticated data delivery into verifiable data delivery.',
        'It also supports higher-level protocols that bind security data to DNS. DANE can use DNSSEC-signed records to authenticate TLS-related information. Authenticated denial records let resolvers reject forged negative answers instead of trusting an unsigned no.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DNSSEC does not encrypt DNS queries or hide which names are looked up. DNS-over-HTTPS and DNS-over-TLS protect transport privacy between client and resolver, while DNSSEC protects data authenticity. Those layers solve different problems.',
        'DNSSEC also proves authenticity, not correctness. If a zone operator signs a wrong address, validation proves that the zone signed the wrong address. Bad clocks, expired signatures, broken key rollovers, wrong parent DS records, and unsupported algorithms can also make valid domains fail for validating clients.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an attacker injects www.example.com A 198.51.100.77. The resolver asks for the RRSIG over the A RRset and the DNSKEY that should verify it. If the attacker cannot sign with the authorized example.com key, the answer is bogus.',
        'Suppose the attacker also sends a fake DNSKEY that signs the forged answer. The com zone has a DS digest for the real example.com key, not the fake key. If the fake key digest does not match the signed parent DS, the proof stops before the final answer is considered secure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include RFC 4033 at https://www.rfc-editor.org/rfc/rfc4033, RFC 4034 at https://www.rfc-editor.org/rfc/rfc4034, RFC 4035 at https://www.rfc-editor.org/rfc/rfc4035, RFC 5155 at https://www.rfc-editor.org/rfc/rfc5155, and RFC 9276 at https://www.rfc-editor.org/rfc/rfc9276. Study recursive DNS lookup first, then DNSSEC NSEC3 for authenticated denial, Merkle trees for commitment structure, and TLS certificate validation for a neighboring chain-of-trust model.',
      ],
    },
  ],
};
