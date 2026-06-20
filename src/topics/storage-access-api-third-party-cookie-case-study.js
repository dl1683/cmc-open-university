// Storage Access API: embedded cross-site documents, partitioned vs
// unpartitioned storage, user activation, permission grants, and fallbacks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'storage-access-api-third-party-cookie-case-study',
  title: 'Storage Access API Third-Party Cookie Gate',
  category: 'Security',
  summary: 'How embedded cross-site documents check and request access to third-party cookies and unpartitioned state under modern browser privacy controls.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['embed request', 'fallback design'], defaultValue: 'embed request' },
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

function storageGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'top', label: 'top site', x: 0.5, y: 4.2, note: notes.top ?? 'publisher' },
      { id: 'frame', label: 'iframe', x: 2.8, y: 4.2, note: notes.frame ?? 'idp/embed' },
      { id: 'part', label: 'partition', x: 4.7, y: 2.8, note: notes.part ?? 'top+embed' },
      { id: 'unpart', label: 'unpart', x: 4.7, y: 5.6, note: notes.unpart ?? 'embed site' },
      { id: 'check', label: 'check', x: 6.4, y: 4.2, note: notes.check ?? 'hasAccess' },
      { id: 'prompt', label: 'grant', x: 8.0, y: 2.8, note: notes.prompt ?? 'user/UA' },
      { id: 'cookie', label: 'cookie', x: 8.0, y: 5.6, note: notes.cookie ?? 'session' },
      { id: 'result', label: 'result', x: 9.5, y: 4.2, note: notes.result ?? 'allow/deny' },
    ],
    edges: [
      { id: 'e-top-frame', from: 'top', to: 'frame', weight: '' },
      { id: 'e-frame-part', from: 'frame', to: 'part', weight: '' },
      { id: 'e-frame-unpart', from: 'frame', to: 'unpart', weight: '' },
      { id: 'e-frame-check', from: 'frame', to: 'check', weight: '' },
      { id: 'e-check-prompt', from: 'check', to: 'prompt', weight: '' },
      { id: 'e-prompt-cookie', from: 'prompt', to: 'cookie', weight: '' },
      { id: 'e-cookie-result', from: 'cookie', to: 'result', weight: '' },
      { id: 'e-check-result', from: 'check', to: 'result', weight: '' },
    ],
  }, { title });
}

function* embedRequest() {
  yield {
    state: storageGraph('A cross-site iframe may start with partitioned storage only'),
    highlight: { active: ['top', 'frame', 'part', 'e-top-frame', 'e-frame-part'], compare: ['unpart'] },
    explanation: 'Modern browsers often block or partition third-party cookies. An embedded document should not assume it can read the same unpartitioned cookie jar it has when visited as a top-level site.',
    invariant: 'The top site is part of the storage context for embedded third-party state.',
  };

  yield {
    state: storageGraph('The embed checks whether it already has storage access', { check: 'hasStorageAccess', result: 'false' }),
    highlight: { active: ['frame', 'check', 'result', 'e-frame-check', 'e-check-result'], compare: ['cookie'] },
    explanation: 'The Storage Access API gives the embed a capability check. If access is unavailable, the frame can request access instead of failing silently or assuming cookies work.',
  };

  yield {
    state: labelMatrix(
      'Request gates',
      [
        { id: 'embed', label: 'embedded' },
        { id: 'gesture', label: 'gesture' },
        { id: 'policy', label: 'policy' },
        { id: 'browser', label: 'browser' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'failure' },
      ],
      [
        ['third party', 'top-level only'],
        ['user intent', 'no activation'],
        ['iframe allow', 'blocked'],
        ['privacy gate', 'denied'],
      ],
    ),
    highlight: { active: ['gesture:role', 'policy:role', 'browser:role'], compare: ['embed:failure'] },
    explanation: 'Requests are intentionally gated. Browsers may require user activation, iframe delegation, prior first-party interaction, or other privacy conditions before granting unpartitioned access.',
  };

  yield {
    state: storageGraph('A granted request opens the embed site cookie jar', { prompt: 'granted', cookie: 'unpart ok', result: 'logged in' }),
    highlight: { active: ['prompt', 'cookie', 'result', 'e-prompt-cookie', 'e-cookie-result'], found: ['unpart'] },
    explanation: 'When granted, the embedded document can access its unpartitioned cookies and state according to browser rules. The grant should be treated as scoped and revocable, not a permanent entitlement.',
  };

  yield {
    state: storageGraph('A denied request must degrade without breaking the page', { prompt: 'denied', cookie: 'none', result: 'fallback' }),
    highlight: { removed: ['cookie'], active: ['check', 'prompt', 'result', 'e-check-prompt'], compare: ['part'] },
    explanation: 'The embed needs a fallback: open a top-level login, use a signed one-time token, show a logged-out widget, or use partitioned state. Silent broken iframes are a product bug.',
  };
}

function* fallbackDesign() {
  yield {
    state: labelMatrix(
      'Embed patterns',
      [
        { id: 'sso', label: 'SSO' },
        { id: 'pay', label: 'payment' },
        { id: 'comments', label: 'comments' },
        { id: 'ads', label: 'ads' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'fallback' },
      ],
      [
        ['login state', 'top login'],
        ['session', 'redirect'],
        ['account', 'guest mode'],
        ['tracking?', 'no access'],
      ],
    ),
    highlight: { found: ['sso:fallback', 'pay:fallback'], removed: ['ads:need'] },
    explanation: 'Different embeds have different legitimacy. SSO and payments may need first-party state. Ads and broad tracking usually should not get unpartitioned storage access.',
    invariant: 'Storage access is a narrow compatibility valve, not a tracking entitlement.',
  };

  yield {
    state: storageGraph('A top-level bounce can establish first-party state', { top: 'embed site', frame: 'top login', unpart: 'first party', cookie: 'session set', result: 'return' }),
    highlight: { active: ['top', 'unpart', 'cookie', 'result'], compare: ['frame'] },
    explanation: 'Some flows use a top-level visit to the embedded service for login or consent, then return to the original site. That makes state explicit instead of relying on invisible third-party cookies.',
  };

  yield {
    state: storageGraph('Partitioned state keeps per-top-site isolation', { part: 'per publisher', cookie: 'partitioned', result: 'limited' }),
    highlight: { active: ['frame', 'part', 'cookie', 'result', 'e-frame-part'], compare: ['unpart'] },
    explanation: 'Partitioned cookies or storage can let an embed keep state per top-level site without linking identity across all publishers. That is often better for privacy than requesting unpartitioned state.',
  };

  yield {
    state: labelMatrix(
      'Design checklist',
      [
        { id: 'check', label: 'check first' },
        { id: 'gesture', label: 'gesture UX' },
        { id: 'token', label: 'token alt' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'risk' },
      ],
      [
        ['precheck', 'false assume'],
        ['user intent', 'dark pattern'],
        ['one-time flow', 'replay'],
        ['grant history', 'privacy'],
      ],
    ),
    highlight: { active: ['check:purpose', 'gesture:purpose', 'token:purpose'], compare: ['audit:risk'] },
    explanation: 'A well-designed embed checks access, explains the request, supports a top-level or token fallback, and logs the grant path for privacy review.',
  };

  yield {
    state: storageGraph('The complete case study is an embedded identity widget', { top: 'news site', frame: 'idp frame', check: 'request', prompt: 'user click', result: 'sign in' }),
    highlight: { active: ['top', 'frame', 'check', 'prompt', 'cookie', 'result'], found: ['e-top-frame', 'e-check-prompt'] },
    explanation: 'An identity provider embedded on a news site checks storage access. If denied, it asks after a user click or opens a top-level login. If granted, it reads its session cookie and renders the signed-in widget.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'embed request') yield* embedRequest();
  else if (view === 'fallback design') yield* fallbackDesign();
  else throw new InputError('Pick a Storage Access view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'The Storage Access API exists because the web is moving away from ambient third-party cookies. For years, an embedded iframe could often read cookies for its own origin while the user was visiting a different top-level site. That made single sign-on widgets, comment boxes, payment frames, and subscription checks easy to build. It also let trackers join a user across unrelated sites without a meaningful moment of consent.',
        'Modern browsers increasingly block or partition cross-site state. That is the right privacy direction, but it creates a compatibility problem for user-facing embeds that really do need first-party account state. The API is a narrow request path: an embedded document can check whether it has access to unpartitioned storage, ask the browser for access when appropriate, and handle denial without pretending the old cookie model still exists.',
        {type:'callout', text:'The API turns ambient cross-site cookie reach into a browser-mediated capability with explicit granted, denied, and fallback states.'},
      ],
    },
    {
      heading: 'The obvious shortcut and why it broke',
      paragraphs: [
        'The old shortcut was global cookie reach. If idp.example set a session cookie during a first-party visit, every idp.example iframe could try to read it later inside news.example, shop.example, forum.example, or any other top-level site. One login session appeared everywhere.',
        'That shortcut collapsed two very different cases. A visible sign-in widget may have a legitimate reason to know whether the user is signed in. A hidden tracking iframe does not. Browsers could not rely on every embed to draw that line honestly, so they started making the top-level site part of the storage context or blocking access altogether.',
        'The Storage Access API is not a promise that old behavior will come back. It is a way to make the exceptional case explicit and browser-mediated. Code asks for a capability. The browser applies policy. The user may be involved. Denial is a normal result.',
      ],
    },
    {
      heading: 'Partitioned versus unpartitioned state',
      paragraphs: [
        'The browser keeps two ideas separate. Partitioned state is scoped to the pair of top-level site and embedded site. An idp.example frame inside news.example gets a different partition from an idp.example frame inside shop.example. That preserves local functionality without giving the embed a single cross-site identity thread.',
        'Unpartitioned state belongs to the embedded site as a first party. It is the cookie jar or storage the user would see when visiting idp.example directly, subject to browser rules. Storage access is a capability that may let the iframe reach that unpartitioned state from inside a third-party context.',
        'This distinction is the center of the design. An embed should ask: can I finish this flow with partitioned state, a top-level redirect, or a one-time token? If yes, it should avoid requesting unpartitioned access. If not, it should request access only at the moment the user understands the reason.',
      ],
    },
    {
      heading: 'The privacy invariant',
      paragraphs: [
        'The invariant is that cross-site identity state should not flow silently from an embedded origin into every top-level site that includes it. The top-level site remains part of the storage context unless the browser grants a narrower exception.',
        'Capability gating is the practical enforcement method. Before a grant, the iframe can use public resources, partitioned state, and explicit messages from the top page. It cannot assume it can read the unpartitioned session. After a grant, access is scoped by browser policy and may be temporary or revocable.',
        'Application code should reflect that invariant. There should be a state for "unknown," a state for "no access," a state for "request pending," a state for "granted," and a state for "denied." Treating denial as an error path creates brittle products and encourages dark patterns.',
      ],
    },
    {
      heading: 'Request flow',
      paragraphs: [
        'A good embedded flow starts with a check. If the document already has storage access, it can use the relevant unpartitioned state according to browser rules. If it does not, it should render the best state it can without access, usually a signed-out widget, a limited guest mode, or a button that starts a visible login flow.',
        'The request should be tied to meaningful user intent. A click on "sign in," "continue payment," or "show my subscription" gives the browser and the user context. A request on page load is weaker because the user did not ask the frame to cross a privacy boundary.',
        'The browser can consider iframe permissions, user activation, prior first-party interaction, tracking-prevention rules, user settings, and implementation-specific policy. That variability is not a bug in the application contract. It is the reason the application must branch on granted and denied outcomes.',
      ],
    },
    {
      heading: 'Worked identity example',
      paragraphs: [
        'A news site embeds an identity-provider frame so subscribers can see whether they are signed in. On load, the frame has partitioned state for the pair (news.example, idp.example). It checks access and receives false. It can still render a sign-in button because that public UI does not require the unpartitioned session cookie.',
        'When the user clicks sign in, the frame requests access. If the browser grants it, the frame can read the idp.example session cookie and render the signed-in subscription widget. If the browser denies it, the frame can open a top-level login, use an OAuth-style redirect, exchange a short-lived token, or remain in guest mode.',
        'The important design detail is that every branch is planned. The iframe does not spin forever, hide the denial, or tell the user to disable privacy settings. It explains the next action in product terms and keeps the top-level page usable.',
      ],
    },
    {
      heading: 'Using the views',
      paragraphs: [
        'In the embed request view, the important split is partitioned state versus unpartitioned state. The frame starts in a context tied to the top site. The check node decides which branch the application is in. The grant node marks a capability boundary, not just a UI prompt.',
        'In the fallback design view, compare the use cases. Single sign-on and payment flows have visible user tasks that may justify a request. Broad ad tracking does not. The top-level bounce pattern shows a safer alternative: make the identity action first-party and visible instead of relying on invisible third-party cookie access.',
      ],
    },
    {
      heading: 'Fallback patterns',
      paragraphs: [
        'The first fallback is a top-level login or consent visit. The embedded service opens as the top-level site, establishes first-party state, then returns to the original page. This is more visible than silent iframe access and fits OAuth-style flows well.',
        'The second fallback is a signed, short-lived token passed through a server or redirect flow. This can answer a narrow question, such as "does this user have access to this article," without giving the iframe broad storage access. Token design must include audience, expiration, replay protection, and server-side authorization.',
        'The third fallback is partitioned mode. A comments widget, support chat, or embedded preference panel may keep separate state per top-level site. That does not give the user one global account experience, but it can preserve useful local behavior with better privacy boundaries.',
      ],
    },
    {
      heading: 'Authentication is still separate',
      paragraphs: [
        'Storage access is not an authentication protocol. It does not prove who the user is, issue tokens, rotate sessions, prevent CSRF, or authorize an action. It only affects whether an embedded document can access some browser storage that would otherwise be unavailable in a third-party context.',
        'A secure login or payment flow still needs normal web security: SameSite and Secure cookie attributes, CSRF defenses where cookies authenticate requests, OAuth or OIDC state and nonce handling, PKCE for public clients, server-side session validation, token expiration, and careful postMessage origin checks when frames communicate.',
        'This separation matters because storage access can make an existing session visible to an iframe. It does not make every action safe. The server must still decide what the session is allowed to do inside this top-level context.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start by inventorying every third-party embed and the state it expects. Classify each need as public UI, partitioned state, top-level redirect, one-time token, or true unpartitioned storage access. Many uses disappear once the flow is made explicit.',
        'In the iframe, check access before reading cookies that might not exist. Gate the request behind a clear user action. Record which branch happened so support and privacy review can understand real behavior. Never assume that a grant in one browser, one top-level site, or one session means future grants everywhere.',
        'When the iframe needs cooperation from the top-level page, use explicit integration points. Permissions Policy, sandbox attributes, postMessage origin checks, and server-issued tokens are part of the design. A third-party frame should not depend on incidental embedding behavior.',
      ],
    },
    {
      heading: 'Browser variability',
      paragraphs: [
        'Browser behavior differs and evolves. Some browsers may require prior first-party interaction with the embedded site. Some may require user activation. Some may deny requests in private browsing, under tracking-prevention settings, or when iframe policy does not delegate the capability. Some may support related APIs differently.',
        'A robust product tests the states, not just the happy path. Test access already granted, access denied, request unavailable, missing user activation, blocked iframe policy, third-party cookies disabled, partitioned cookies present, and top-level login return. The denial path should be as intentional as the grant path.',
      ],
    },
    {
      heading: 'Where it fits and where it does not',
      paragraphs: [
        'The API fits user-facing embeds whose purpose is understandable at the moment of request: SSO, account widgets, subscription checks, payment flows, comment systems, and support chat that needs an account session. In those cases, the user can connect the storage request to a visible task.',
        'It does not fit hidden tracking, broad analytics joins, or flows that can be implemented with partitioned state or top-level authentication. It is also the wrong abstraction for server-to-server identity, native-app login, or authorization between services. Those are protocol problems, not browser-storage problems.',
        'The API is also useful as an audit signal. Every call marks a place where the product still depends on unpartitioned third-party state. That list can guide migration toward partitioned cookies, first-party sets where appropriate, OAuth PKCE redirects, signed server tokens, or first-party integrations.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is designing only for the granted path. Users with stricter browser settings then get blank iframes, infinite spinners, or misleading sign-in loops. The second failure is requesting access too early, before the user has taken an action that explains why the frame needs it.',
        'The third failure is scope creep. A compatibility valve can become a tracking surface if every embed asks for access by default. Teams should log, review, and justify each request. The question is not "can we get the cookie back?" The question is "is unpartitioned storage the least invasive way to finish this user-facing task?"',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Storage Access API usage guide at https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API/Using, MDN Storage Access API reference at https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API, and the Privacy CG Storage Access draft at https://privacycg.github.io/storage-access/.',
        'Study SameSite Cookies and CSRF for cookie attachment rules, Browser Cache Partitioning Network Key for the wider state-isolation pattern, Permissions Policy Feature Gate for iframe delegation, OAuth PKCE Token Lifecycle Case Study for top-level login redirects, WebAuthn Passkey Credential Discovery for account discovery, postMessage Origin Validation for frame communication, and Content Security Policy for reducing script-level token theft.',
      ],
    },
  ],
};
