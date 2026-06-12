// Page bootstrap: decides between homepage and topic page, wires search,
// navigation, and the theme toggle. All content comes from the registry.

import { topics, categories, searchTopics, linkifyByTitle } from './registry.js';
import { createTopicRuntime } from './core/visualizer.js';

// Render text with the first mention of any other topic's title as an
// inline link to that topic's page. Used for explanations and study notes.
function renderLinkedText(el, text, excludeId) {
  el.textContent = '';
  for (const seg of linkifyByTitle(text, excludeId)) {
    if (seg.id) {
      const a = document.createElement('a');
      a.className = 'inline-topic-link';
      a.href = `./topic.html?topic=${seg.id}`;
      a.textContent = seg.text;
      el.appendChild(a);
    } else {
      el.appendChild(document.createTextNode(seg.text));
    }
  }
}

// ----------------------------------------------------------------- theme

function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) document.documentElement.dataset.theme = stored;
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  button.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

// ------------------------------------------------------------------ home

function entryHref(entry) {
  return entry.type === 'article' ? entry.url : `./topic.html?topic=${entry.id}`;
}

function initHome() {
  const listEl = document.querySelector('[data-topic-list]');
  const searchEl = document.querySelector('[data-search]');

  function renderSection(heading, entries) {
    const section = document.createElement('section');
    section.className = 'category';
    const h = document.createElement('h2');
    h.textContent = heading;
    section.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    for (const entry of entries) {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = entryHref(entry);
      const title = document.createElement('h3');
      title.textContent = entry.title;
      const summary = document.createElement('p');
      summary.textContent = entry.summary;
      card.append(title, summary);
      grid.appendChild(card);
    }
    section.appendChild(grid);
    listEl.appendChild(section);
  }

  function render(rawQuery = '') {
    const query = rawQuery.trim();
    listEl.replaceChildren();

    if (query) {
      // ranked, typo-tolerant results in relevance order
      const results = searchTopics(query);
      if (results.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-results';
        empty.textContent = `Nothing matches "${query}" yet — more topics are on the way.`;
        listEl.appendChild(empty);
        return;
      }
      renderSection(`Results (${results.length})`, results);
      return;
    }

    for (const category of categories) {
      const entries = topics.filter((t) => t.category === category);
      if (entries.length > 0) renderSection(category, entries);
    }
  }

  searchEl.addEventListener('input', () => render(searchEl.value));
  render();
}

// ----------------------------------------------------------------- topic

function renderTopicNav(nav, currentId) {
  for (const category of categories) {
    const entries = topics.filter((t) => t.category === category);
    if (entries.length === 0) continue;
    const heading = document.createElement('h2');
    heading.textContent = category;
    nav.appendChild(heading);
    const list = document.createElement('ul');
    for (const entry of entries) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = entryHref(entry);
      link.textContent = entry.title;
      if (entry.id === currentId) link.setAttribute('aria-current', 'page');
      item.appendChild(link);
      list.appendChild(item);
    }
    nav.appendChild(list);
  }
}

async function initTopic() {
  const root = document.querySelector('[data-page="topic"]');
  const id = new URLSearchParams(location.search).get('topic');
  const entry = topics.find((t) => t.id === id && t.type === 'visualization');
  const titleEl = root.querySelector('[data-topic-title]');

  renderTopicNav(root.querySelector('[data-topic-nav]'), id);

  if (!entry) {
    titleEl.textContent = 'Topic not found';
    root.querySelector('[data-topic-summary]').textContent =
      'That topic does not exist (yet). Pick one from the list.';
    root.querySelector('.learn-grid').hidden = true;
    return;
  }

  document.title = `${entry.title} — Visualized`;
  titleEl.textContent = entry.title;
  root.querySelector('[data-topic-summary]').textContent = entry.summary;
  renderTopicLinks(root.querySelector('[data-topic-links]'), entry);

  const mod = await entry.module();
  createTopicRuntime({
    root,
    topic: mod.topic,
    renderExplanation: (el, text) => renderLinkedText(el, text, entry.id),
  });
  renderArticle(root.querySelector('[data-topic-article]'), mod.article, entry.id);
}

// Study notes: the written course that lives under every animation.
// Modules export `article = { sections: [{heading, paragraphs: [...]}] }`.
function renderArticle(container, article, topicId) {
  if (!article || !Array.isArray(article.sections)) return;
  for (const section of article.sections) {
    const heading = document.createElement('h3');
    heading.textContent = section.heading;
    container.appendChild(heading);
    for (const text of section.paragraphs) {
      const p = document.createElement('p');
      renderLinkedText(p, text, topicId);
      container.appendChild(p);
    }
  }
  container.hidden = false;
}

// "Built from": the simpler ideas this topic is composed of.
// "Next up": computed in reverse — everything that builds on this topic.
function renderTopicLinks(container, entry) {
  const buildsOn = (entry.buildsOn ?? [])
    .map((id) => topics.find((t) => t.id === id))
    .filter(Boolean);
  const leadsTo = topics.filter((t) => (t.buildsOn ?? []).includes(entry.id));

  const addRow = (label, entries) => {
    if (entries.length === 0) return;
    const row = document.createElement('p');
    row.className = 'chip-row';
    const caption = document.createElement('span');
    caption.className = 'chip-caption';
    caption.textContent = label;
    row.appendChild(caption);
    for (const target of entries) {
      const chip = document.createElement('a');
      chip.className = 'chip';
      chip.href = entryHref(target);
      chip.textContent = target.title;
      row.appendChild(chip);
    }
    container.appendChild(row);
  };

  addRow('Built from:', buildsOn);
  addRow('Next up:', leadsTo);
}

// -------------------------------------------------------------- bootstrap

initTheme();
const page = document.body.dataset.page || document.querySelector('[data-page]')?.dataset.page;
if (page === 'home') initHome();
if (page === 'topic') initTopic();
