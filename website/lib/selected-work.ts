export const selectedWork = [
  {
    slug: 'sarah-mozer-studio', title: 'Sarah Mozer Studio', kind: 'Client work',
    summary: 'An artist’s shop, with an editing workflow she can own.',
    paragraphs: [
      'Sarah needed a place to sell her artwork, prints and cards, and a manageable way to look after it. I built the shop, catalogue, checkout and inventory controls together with the editing workflow.',
      'She can change customer-facing words and photographs while technical fields remain protected. An owner guide and support using annotated screenshots help her make routine changes. My work included discovery, implementation, deployment and ongoing support.',
    ],
    status: 'Delivered client system. Availability and product details are maintained by the studio.',
    stack: 'Next.js, TypeScript, TinaCMS, Stripe, Neon',
    url: 'https://www.sarahmozer.org',
  },
  {
    slug: 'becoming-diamond', title: 'Becoming Diamond', kind: 'Client work',
    summary: 'A course and membership business, brought into one customer journey.',
    paragraphs: [
      'The brief combined a public website with a paid learning experience. I built a member portal for a 30-day video course, with membership payments, access controls and an AI assistant scoped to the course material.',
      'The client can edit their own content through a CMS. The work covered the interface, backend integrations, payments, content workflow and deployment.',
    ],
    status: 'Delivered client product. The client owns the course and its claims.',
    stack: 'Next.js, React, TypeScript, Stripe, Decap CMS',
    url: 'https://becoming-diamond.vercel.app',
  },
  {
    slug: 'loanslam', title: 'LoanSlam', kind: 'Independent prototype',
    summary: 'Exploring how to constrain an AI conversation when mistakes matter.',
    paragraphs: [
      'LoanSlam explores a lending conversation in which the model proposes a response and deterministic code decides whether it can be shown. Each turn records the proposal, the final action and the reasons for any override.',
      'It is my independent, post-contract prototype, demonstrated with synthetic data. It is not a customer-ready lending service, and does not expose the contracted client system or customer records.',
    ],
    status: 'Synthetic-data engine proof. No claim of production readiness.',
    stack: 'TypeScript, Node.js, Vue, Zod',
    flow: ['Synthetic question', 'Model proposes', 'Rules validate', 'Answer or human handoff'],
  },
  {
    slug: 'human-os', title: 'Human OS', kind: 'Client platform',
    summary: 'A living interface to an author’s work, voice and ideas across time.',
    paragraphs: [
      'Built for my client Olivia, Human OS turns an authored archive into a place to explore. She can ask questions of her work, follow its development through time, revisit earlier writing and keep what she discovers. Responses lead back to their sources.',
      'The platform brings together a timeline, era-bounded conversation, daily resurfacing, a notebook, patterns in reader exchanges and carefully controlled invitation workflows. The experience was designed around her creative practice, with different rooms for different kinds of attention.',
      'This is separate from Agent OS, my personal agent-governance experiment. A public Human OS demonstration will use a wholly synthetic person and corpus; the client platform and its data remain private.',
    ],
    status: 'Private client platform with implemented exploration and invitation surfaces. Public synthetic demonstration pending.',
    stack: 'Next.js, React, TypeScript, scoped corpus packs, validated model output, filesystem and Convex storage adapters',
    flow: ['An authored body of work', 'Explore across time', 'Follow sources and connections', 'Keep, reflect and create'],
  },
  {
    slug: 'the-pit', title: 'The Pit', kind: 'Engineering',
    summary: 'A place to inspect how agents behave and compare their work.',
    paragraphs: ['The Pit brings agent configurations, tasks and observable runs into one platform. Its engineering work explores how evaluation, failure records and cost visibility can inform decisions about which systems to use.'],
    status: 'Experimental platform. The published record distinguishes the shipped arena from staged evaluation work; the account is not a readiness guarantee.',
    stack: 'Next.js, TypeScript, Postgres, model providers, tracing and billing integrations',
    flow: ['Task and agent configuration', 'Run and capture trace', 'Evaluate result and cost', 'Compare and revise'],
  },
  {
    slug: 'sortie', title: 'Sortie', kind: 'Engineering',
    summary: 'Independent model reviews, with a recorded decision about what matters.',
    paragraphs: ['Sortie sends a code change to several reviewers, brings their findings together and applies a severity policy before a merge. The retained findings make agreement and disagreement inspectable. Model agreement is evidence to examine, not proof that a change is correct.'],
    status: 'Experimental review tooling. Implementation versions need reconciling before publishing a definitive stack.',
    stack: 'Parallel reviewers, synthesis, severity policy, retained findings',
    flow: ['One code change', 'Independent model reviews', 'Synthesis and severity policy', 'Merge decision and ledger'],
  },
  {
    slug: 'halo', title: 'Halo', kind: 'Engineering',
    summary: 'Shared records and useful actions for a person and an AI agent.',
    paragraphs: [
      'Halo is an experiment in giving a person and an AI agent access to the same records and tools: logging activity, tracking work and preparing briefings.',
      'It also explores a harder question: how much machinery does that collaboration actually need? The project includes a distributed advisor system, but its complexity needs to justify itself against a simpler arrangement using the same tools and data.',
    ],
    status: 'Personal infrastructure experiment, not a packaged customer product. A smaller architecture is a direction to evaluate, not a completed redesign or a demonstrated improvement.',
    stack: 'Python, SQLite, NATS, Docker, Kubernetes',
    flow: ['Human or agent', 'Shared command surface', 'Module store and event stream', 'Inspection and recovery'],
  },
];

export const selectedNotes = [
  { title: 'What happens to your judgement when AI joins the conversation?', original: 'What happens to your judgement when AI joins the conversation?', href: '/blog/2026-09-05-when-ai-joins-the-conversation/', summary: 'The thinking behind Conversations with AI: practical encounters, therapeutic attention and software that keeps people involved in the thinking.' },
  { title: 'Keeping your own judgement', original: 'Keeping up with my own agents', href: '/blog/2026-08-20-keeping-up-with-my-own-agents/', summary: 'I agreed with a sequence of design decisions, then found I could not explain them the next morning. An account of the gap between following an argument and owning a decision.' },
  { title: 'When the system becomes the work', original: 'My agent system passed 331 tests. I retired it anyway.', href: '/blog/2026-08-18-my-agent-system-passed-331-tests/', summary: 'A technically functioning agent system became too costly to understand and operate. Why I retired it, and what I kept.' },
  { title: 'Helping someone use what you built', original: 'The agent knew which plus button Sarah meant', href: '/blog/2026-07-23-the-agent-knew-which-plus-button-she-meant/', summary: 'A question about editing an artist’s shop led to a closer look at the actual screen, the content model and the help she needed.' },
];
