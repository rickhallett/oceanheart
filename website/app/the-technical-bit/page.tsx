import type { Metadata } from 'next';
import { Footer, SiteNav } from '../components/editorial';
import './technical.css';

const title = 'The technical bit | Oceanheart Studio';
const description = 'Inside Oceanheart Studio: the architecture, workflow runtime and engineering behind supported client delivery.';
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: 'https://www.oceanheart.ai/the-technical-bit' },
  openGraph: { title, description, url: 'https://www.oceanheart.ai/the-technical-bit' },
  twitter: { card: 'summary_large_image', title, description },
};

function SystemDiagram() {
  const box = (x: number, y: number, label: string, detail: string, accent = false) => <g key={label}>
    <rect x={x} y={y} width="238" height="66" rx="5" className={accent ? 'diagram-node diagram-node-accent' : 'diagram-node'} />
    <text x={x + 18} y={y + 27} className="diagram-label">{label}</text>
    <text x={x + 18} y={y + 47} className="diagram-detail">{detail}</text>
  </g>;
  return <figure className="system-figure">
    <div className="figure-bar"><span>System architecture</span><span>Application + dedicated runtime</span></div>
    <div className="diagram-scroll" tabIndex={0} role="region" aria-label="System architecture diagram; scroll horizontally on small screens">
      <svg viewBox="0 0 850 438" role="img" aria-labelledby="system-title system-description">
        <title id="system-title">Studio system architecture</title>
        <desc id="system-description">Clients and the delivery team use Studio, authenticated through WorkOS. Studio connects to Convex for access-checked records and versioned sources. Separately, its authenticated workflow API resolves a server-owned client binding and invokes Pi tools. SQLite stores jobs, effects and traces. Release credentials remain with Oceanheart operations.</desc>
        <defs><marker id="tech-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#718b83" /></marker></defs>
        <g className="diagram-path" markerEnd="url(#tech-arrow)">
          <path d="M262 65H305" /><path d="M588 65H549" />
          <path d="M424 98V134H181V167" /><path d="M424 134H668V167" />
          <path d="M181 234V275" /><path d="M668 234V275" /><path d="M668 342V379" />
        </g>
        {box(24,32,'Client + delivery team','Shared operational knowledge')}
        {box(306,32,'Studio application','Next.js · React · TypeScript',true)}
        {box(588,32,'WorkOS AuthKit','Verified identity and sessions')}
        {box(62,168,'Convex','Client access checks and queries')}
        {box(550,168,'Workflow API','Verified client binding')}
        {box(62,276,'Practice data','Records · approved source versions')}
        {box(550,276,'Pi runtime','Typed inputs · explicit tools',true)}
        <text x="668" y="401" textAnchor="middle" className="diagram-detail">SQLite / jobs · effects · traces</text>
        <path d="M330 196H515" className="diagram-boundary" />
        <text x="423" y="219" textAnchor="middle" className="diagram-annotation">separate execution path</text>
      </svg>
    </div>
    <div className="system-mobile" aria-label="Studio system architecture">
      <div className="mobile-system-node"><strong>Client + delivery team</strong><span>WorkOS verifies identity and sessions.</span></div>
      <div className="mobile-system-node"><strong>Studio application</strong><span>Next.js, React and TypeScript</span></div>
      <div className="mobile-system-branch"><h3>Application data</h3><div className="mobile-system-node"><strong>Convex</strong><span>Client access checks and queries</span></div><div className="mobile-system-node"><strong>Practice records</strong><span>Records and approved source versions</span></div></div>
      <div className="mobile-system-branch"><h3>Dedicated workflow runtime</h3><div className="mobile-system-node"><strong>Workflow API</strong><span>Verified identity and server-owned client binding</span></div><div className="mobile-system-node"><strong>Pi runtime</strong><span>Typed inputs and explicit tools</span></div><div className="mobile-system-node"><strong>SQLite</strong><span>Jobs, effects and traces</span></div></div>
    </div>
    <figcaption>The workspace and workflow runtime have distinct responsibilities. The public website has its own release line.</figcaption>
  </figure>;
}

const sections = [['01','Architecture','architecture'],['02','Client delivery','delivery'],['03','Workflow execution','execution'],['04','Development & release','development'],['05','Technology','technology']] as const;
const technologyIcons: Record<string, string> = {
  'GitHub': 'github', 'exe.dev': 'exedev', 'Pi SDK': 'pi', 'vinext': 'cloudflare', 'WorkOS AuthKit': 'workos', 'jose (JWT)': 'jsonwebtokens', 'Ubuntu 24.04': 'ubuntu',
  'React 19': 'react', 'Vite': 'vite', 'Vercel': 'vercel', 'Next.js 16': 'nextdotjs',
  'TypeScript': 'typescript', 'Chakra UI': 'chakraui', 'Convex': 'convex',
  'Node.js 24': 'nodedotjs', 'SQLite': 'sqlite', 'GitHub Actions': 'githubactions',
};
const stack = [
  ['Website','React 19 · vinext · Vite · Vercel','Public pages, with Hugo for the writing archive.'],
  ['Workspace','Next.js 16 · TypeScript · Chakra UI · Ubuntu 24.04 · GitHub','Client workspace and authenticated server routes. Dedicated exe.dev instances run Ubuntu 24.04 LTS.'],
  ['Identity','WorkOS AuthKit · jose (JWT)','Sessions and server-side identity verification.'],
  ['Application data','Convex','Records, source versions and authorised mutations.'],
  ['Execution','Node.js 24 · Pi SDK · TypeBox','Typed inputs and bounded workflow tools.'],
  ['Runtime storage','SQLite','Dedicated instance runtime: jobs, leases, retry keys, effects and traces. Application records remain in Convex.'],
  ['Operations','GitHub Actions · Vercel · exe.dev','Verification, hosting, identified releases and recovery.'],
];

export default function TechnicalBit() {
  return <div className="technical-page">
    <SiteNav />
    <main className="technical-shell">
      <header className="technical-intro">
        <div className="tech-intro-copy">

        <h1>The technical bit.</h1>
        <p className="tech-deck">Application architecture and workflow runtime.</p>
        <div className="tech-intro-bottom"><p>Next.js and Convex provide the authenticated workspace and client data. On dedicated instances, Pi executes workflow tools and SQLite persists their jobs, effects and traces.</p><a href="https://github.com/rickhallett/oceanheart">Explore the repository </a></div>
        </div>
        <figure className="technical-frontispiece"><img src="/images/studio/technical-hero-variant.png" alt="A technical cutaway of Studio’s miniature machine, held in the same hand as the Studio hero." width="1254" height="1254" /></figure>
      </header>
      <div className="technical-layout">
        <aside className="technical-index"><nav aria-label="On this page">{sections.map(([,label,id])=><a key={id} href={`#${id}`}>{label}</a>)}</nav><a className="tech-readme" href="https://github.com/rickhallett/oceanheart#readme">Project README</a></aside>
        <div className="tech-reading">
          <section id="architecture" className="tech-section">
            <div className="tech-section-heading"><h2>Architecture</h2></div>
            <p>Studio combines an authenticated web application, client-scoped data and a workflow runtime. The application holds the practice’s records and source material. The runtime executes specific jobs and records what happened.</p>
            <SystemDiagram />
            <div className="tech-two-columns"><div><h3>Client data</h3><p>Convex checks access to application records and source versions. Workflow requests resolve a verified identity to a server-owned client binding.</p></div><div><h3>Operational authority</h3><p>Provisioning and release credentials stay with the operator. The runtime receives only the tools and authority required for its job.</p></div></div>
          </section>
          <section id="delivery" className="tech-section">
            <div className="tech-section-heading"><h2>From knowledge to a client workflow</h2></div>
            <p>The starting point is the client’s documents, policies, examples and exceptions. Versioned sources and cited answers give the client and delivery team a shared basis for deciding what to build.</p>
            <ol className="delivery-sequence">
              <li><div><h3>Understand the work</h3><p>Consult the source material, ask specific questions and return to the client when facts are missing or conflicting.</p></div></li>
              <li><div><h3>Agree the workflow</h3><p>Describe the intended outcome, inputs, decisions and approval points. Review the proposal with its owner.</p></div></li>
              <li><div><h3>Build, check and use</h3><p>Develop a bounded change, test relevant examples and introduce it through supervised use.</p></div></li>
              <li><div><h3>Learn from the result</h3><p>Use observed results, exceptions and corrections to decide what changes next.</p></div></li>
            </ol>
            <p className="tech-margin-note">Documents provide evidence. The client’s agreement defines permission to act.</p>
          </section>
          <section id="execution" className="tech-section">
            <div className="tech-section-heading"><h2>Workflow execution</h2></div>
            <p>A job needs to remain understandable after an interrupted connection or process restart. The runtime persists the job, request key, configuration references and outcome so a retry can recover an existing result.</p>
            <div className="execution-strip" aria-label="Workflow execution sequence"><span>Validate request</span><span>Persist job</span><span>Run tool</span><span>Record outcome</span></div>
            <dl className="execution-outcomes"><div><dt><i className="outcome-dot" />Complete</dt><dd>Persist the result and effect receipt; return the result and trace.</dd></div><div><dt><i className="outcome-dot pending" />Missing facts</dt><dd>Request clarification before continuing.</dd></div><div><dt><i className="outcome-dot uncertain" />Uncertain effect</dt><dd>Hold for provider-specific reconciliation before attempting another action.</dd></div></dl>
            <div className="tech-example"><h3>Clara: invoice draft generation</h3><p>Clara uses validated session records and rate references to prepare a draft. A private pilot has exercised evaluation, activation and rollback of a supported rule change. This is bounded engineering evidence; real-client billing remains a separate milestone.</p></div>
          </section>
          <section id="development" className="tech-section">
            <div className="tech-section-heading"><h2>Development and release</h2></div>
            <p><strong>Agentic Client Workflows</strong> do the client’s work. <strong>Agentic Developer Workflows</strong> help the engineering team implement, test and maintain the software. Oceanheart supplies the interpretation and development work, and remains responsible for scope and release.</p>
            <p>Changes start with a concrete need and examples. Focused checks cover the changed behaviour and its boundaries. Releases identify the code and configuration in use, with recovery or rollback when something goes wrong.</p>
            <div className="tech-status"><div><h3>One supported engagement</h3><p>The authenticated workspace and bounded runtime provide the foundations. The next delivery milestone is a practitioner’s authorised document set, reliable answers to their questions and one workflow reviewed with its owner. Real-user outcomes will come from that work.</p></div></div>
          </section>
          <section id="technology" className="tech-section">
            <div className="tech-section-heading"><h2>Technology</h2></div>
            <div className="tech-stack">{stack.map(([layer,tools,role])=><div key={layer}><h3>{layer}</h3><div><div className="technology-logos">{tools.split(' · ').map(tool => <span className="technology-logo" key={tool}>{technologyIcons[tool] && <img src={`/images/technology/${technologyIcons[tool]}.${tool === 'exe.dev' ? 'png' : 'svg'}?v=brand-colour-1`} alt="" width="24" height="24" />}<span>{tool}</span></span>)}</div><span>{role}</span></div></div>)}</div>
            <div className="tech-source-links"><a href="https://github.com/rickhallett/oceanheart#readme">Read the README </a><a href="/studio/case-study">Studio case study </a></div>
          </section>
        </div>
      </div>
    </main>
    <Footer />
  </div>;
}
