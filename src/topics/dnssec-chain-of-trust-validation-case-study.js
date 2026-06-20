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
      heading: 'Why this exists',
      paragraphs: [
        "Classic DNS is a distributed naming system, not a proof system. It can tell a resolver that `www.example.com` has an address, but the base protocol does not prove that the answer was signed by the zone owner or left unchanged in transit. That gap made forged answers and cache poisoning valuable attacks.",
        "DNSSEC adds data origin authentication and integrity. A validating resolver does not merely ask what answer came back. It asks whether the answer can be proven by signatures and key delegations that connect back to a configured trust anchor, normally the root key.",
        {type: "callout", text: "DNSSEC validation is a proof path through delegated keys, not a signature check on the final RRset alone."},
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/d/d2/DNS_schema.svg", alt: "Schematic diagram of the domain-name hierarchy from a root node through top-level domains and subdomains.", caption: "DNS hierarchy diagram, TilmannR, based on work by Hank van Helvete and George Shuklin, CC BY-SA 2.5, via Wikimedia Commons."},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The simple idea is to let every zone sign its own records and return the public key next to the answer. That is not enough. An attacker who can forge the answer can also present a forged key unless the resolver already knows which key is authorized for the zone.",
        "The opposite simple idea is to configure every resolver with every zone key. That also fails. Zones appear, disappear, delegate, and roll keys. A resolver cannot carry the whole internet's key inventory. Validation has to follow the DNS delegation tree instead of replacing it with a global key list.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is delegation. DNS authority moves from root to top-level domain to child zone, and validation must move with it. A signature over the final answer is meaningless unless the resolver can prove that the signing key is the right key for that final zone.",
        "Time is another wall. DNSSEC signatures have inception and expiration times. Keys roll. DS records can be wrong. Resolvers cache records with TTLs. A validation system that ignores time turns old proof into live authority, which is exactly what attackers want.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "DNSSEC turns validation into a proof path. The resolver starts from a trust anchor. A signed parent DS record commits to a child DNSKEY. That child key signs its own DNSKEY RRset and the RRsets in its zone. The same bridge repeats until the requested answer is reached.",
        "Think of the data structure as a signed graph. One edge says a trusted key signed an RRset. Another says a parent DS digest matches a child DNSKEY. Another says an RRSIG is valid for this owner name, type, class, TTL, algorithm, key tag, and time window. The final verdict is the result of the whole path, not a single signature check.",
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        "The chain-validation view is about authority moving downward. Do not treat each key as equally trusted. The resolver earns trust step by step: trust anchor, signed root data, parent DS, child DNSKEY, final signed answer.",
        "The resolver-verdict view is about classification. Secure, insecure, bogus, and indeterminate are different outcomes. A missing DS at a delegation can intentionally end the chain as insecure. A present DS with a bad child signature is bogus. A network timeout or unsupported algorithm may leave the resolver unable to finish.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "A client asks for `www.example.com A`. The validating recursive resolver obtains the answer RRset and RRSIG, the `example.com` DNSKEY RRset, the DS record from `com`, the `com` DNSKEY RRset, and the DS record from root. Some of that material may already be cached, but cached proof still has TTL and signature bounds.",
        "Starting from the trust anchor, the resolver validates the signed root material, checks that the root DS points to the `com` DNSKEY, validates the `com` DNSKEY RRset, checks that the `com` DS points to the `example.com` DNSKEY, validates the child DNSKEY RRset, and finally validates the answer RRSIG. It also checks owner name, type, class, original TTL, algorithm, key tag, inception time, and expiration time.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Suppose an attacker injects an address record for `www.example.com`. The forged packet may look syntactically correct, but the resolver will ask for the RRSIG over the A RRset and the DNSKEY that should verify it. If the attacker cannot produce a valid signature under the zone key, the final answer cannot become secure.",
        "If the attacker also invents a DNSKEY, the parent DS check blocks the move. The `com` zone signed a DS digest for the real `example.com` key, not the attacker's key. A child key that does not match the parent commitment is not authorized, even if it can sign its own forged answers.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The chain works because every accepted link is authenticated by a key the resolver already trusts. A parent does not sign every child answer. Instead, it signs a DS record that commits to the child key. The child key then signs its own records. This preserves delegation while giving the resolver a cryptographic path through the namespace.",
        "The verdicts follow from that proof. Secure means the chain and final RRset signature validate. Bogus means a chain was expected but a required proof failed. Insecure means the chain intentionally ended at an unsigned delegation, often because no DS exists. Indeterminate means the resolver could not decide, which is different from proof of authenticity.",
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        "DNSSEC adds bytes, queries, signature checks, cache state, and operational failure modes. A resolver may need DNSKEY, DS, RRSIG, NSEC, or NSEC3 records in addition to the requested answer. UDP truncation, fallback to TCP, and larger responses can matter on constrained paths.",
        "Caching helps but does not remove the cost. DNSKEY and DS records can be reused across many lookups, yet signatures expire, TTLs run out, and key rollovers change the proof graph. A resolver has to balance reuse with the risk of treating old proof as fresh proof.",
      ],
    },
    {
      heading: 'Negative answers',
      paragraphs: [
        "A secure answer is not always an address. DNSSEC also has to prove absence. If a name does not exist or a type is not present at an existing name, the resolver needs authenticated denial of existence. NSEC and NSEC3 provide signed proof that a name or type falls into a covered gap.",
        "This matters because unsigned negative answers are valuable to attackers. A forged NXDOMAIN can hide a real service, and a forged NODATA can suppress a specific record type. DNSSEC turns absence into a signed claim with its own validation rules.",
      ],
    },
    {
      heading: 'Operational review',
      paragraphs: [
        "A production DNSSEC review should ask whether the resolver can explain every verdict: which trust anchor was used, which DNSKEY validated which RRset, which DS matched which child key, which signature time window was accepted, and where the chain became secure, insecure, bogus, or indeterminate.",
        "Most outages come from ordinary operations. Expired signatures, bad key rollovers, mismatched parent DS records, unsupported algorithms, bad clocks, oversized responses, or stale resolver state can break a signed domain for validating clients even when the authoritative server is answering.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "DNSSEC wins when resolvers need authenticity for DNS data even if the transport path is hostile. It protects against forged answers and cache poisoning because a forged RRset must carry a valid signature under an authorized key chained to the trust anchor.",
        "It also creates a foundation for higher-level systems. DANE can bind TLS information to DNSSEC-signed records. Signed service records can become stronger routing hints. Negative proof lets resolvers cache absence without accepting an attacker-supplied denial.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "DNSSEC does not encrypt DNS queries and does not hide the name being looked up. DNS-over-HTTPS and DNS-over-TLS protect transport privacy between client and resolver; DNSSEC protects data authenticity. These layers are complementary, not interchangeable.",
        "DNSSEC also cannot prove data below an insecure delegation. If the parent has no DS for the child, the resolver treats the child as insecure rather than bogus. That boundary is deliberate, but it means DNSSEC deployment is only as strong as the signed path that actually exists.",
        "It does not make wrong zone data correct. If the legitimate zone signs a bad address, DNSSEC proves that the zone signed it. Integrity is not truth. Operators still need good publishing pipelines, monitoring, and rollback plans.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Primary sources: RFC 4033 DNSSEC Introduction at https://www.rfc-editor.org/rfc/rfc4033, RFC 4034 DNSSEC Resource Records at https://www.rfc-editor.org/rfc/rfc4034, RFC 4035 DNSSEC Protocol Modifications at https://www.rfc-editor.org/rfc/rfc4035, RFC 5155 for NSEC3 at https://www.rfc-editor.org/rfc/rfc5155, and RFC 9276 for current NSEC3 guidance at https://www.rfc-editor.org/rfc/rfc9276.",
        "Study How DNS Works for the resolver walk, DNS Negative Cache and NXDOMAIN for absence caching, DNSSEC NSEC3 Authenticated Denial for signed non-existence proofs, Merkle Tree for commitment structure, Sparse Merkle Tree Non-Membership for a modern authenticated-absence analogy, and TLS 1.3 Handshake for the adjacent certificate-authentication layer.",
      ],
    },
  ],
};
