import { Marked } from 'marked';
import { selectedNotes } from './selected-work';
import keepingUp from '../content/blog/2026-08-20-keeping-up-with-my-own-agents.md?raw';
import retiring from '../content/blog/2026-08-18-my-agent-system-passed-331-tests.md?raw';
import sarah from '../content/blog/2026-07-23-the-agent-knew-which-plus-button-she-meant.md?raw';
import conversations from '../content/blog/2026-09-05-when-ai-joins-the-conversation.md?raw';

const sources: Record<string, string> = {
  '2026-09-05-when-ai-joins-the-conversation': conversations,
  '2026-08-20-keeping-up-with-my-own-agents': keepingUp,
  '2026-08-18-my-agent-system-passed-331-tests': retiring,
  '2026-07-23-the-agent-knew-which-plus-button-she-meant': sarah,
};

// Only explicitly approved articles are imported. Never glob a
// source repository: its archive also contains intentionally unpublished work.
export const articles = selectedNotes.map(note => ({
  ...note,
  slug: note.href.split('/').filter(Boolean).at(-1)!,
}));

const markdown = new Marked({ renderer: { html: () => '' } });

export function readArticle(slug: string) {
  const article = articles.find(item => item.slug === slug);
  if (!article) return null;
  const source = sources[slug];
  const match = source.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n([\s\S]*)$/);
  if (!match || !/^draft = false$/m.test(match[1]) || !/^render = "always"$/m.test(match[1])) {
    throw new Error(`Article is not explicitly published: ${slug}`);
  }
  return { ...article, date: slug.slice(0, 10), html: markdown.parse(match[2], { async: false }) };
}
