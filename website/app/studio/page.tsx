import type { Metadata } from "next";
import { Footer, SiteNav } from "../components/editorial";
import { ProductExplorer } from "./product-explorer";
import { SmallArrow } from "./possibilities/brand-marks";
import { ConnectionExplorer, WorkflowExplorer } from "./possibilities/workflow-explorer";
import "./studio.css";
import "./possibilities/possibilities.css";

export const metadata: Metadata = {
  title: "Studio + Oceanheart | More room for the work that matters",
  description: "AI agents for everyday practice administration, configured, tested and maintained with Rick at Oceanheart. A private workspace shaped around you.",
  alternates: { canonical: "https://www.oceanheart.ai/studio" },
  robots: { index: true, follow: true },
  openGraph: { title: "Studio + Oceanheart | More room for the work that matters", url: "https://www.oceanheart.ai/studio" },
};

const contact = "mailto:rick@oceanheart.ai?subject=Let%E2%80%99s%20talk%20about%20my%20practice";
const demo = "https://studio.oceanheart.ai/app?demo=1";
const possibilities = [
  { title: "Turn a workaround into a useful little tool", need: "“I keep a spreadsheet because nothing else quite does this.”", text: "Show Rick what the spreadsheet helps you do. It might become a small screen or an agent workflow in your Studio, shaped around the real need and maintained as your practice changes." },
  { title: "Give people more ways to participate", need: "“The form is simple to me. It’s a barrier for them.”", text: "Explore a shorter journey, clearer language, larger text, audio or a supported route through the process. Build with the people who need the alternative and check whether it helps them take the next step." },
  { title: "Remember the small things you promised", need: "“I said I’d send it. Then the day happened.”", text: "An assistant could help surface unfinished administrative commitments from the records you authorise it to use. Each suggestion would show where it came from, with a useful next action and room to correct it." },
  { title: "Rehearse a change before people depend on it", need: "“What happens if someone joins late, or a payment fails?”", text: "Try a new service or workflow with fictional cases. Walk through the awkward exceptions together, see confusing messages and repair the gaps before inviting real participants." },
  { title: "Track the sessions. Prepare the paperwork.", need: "“The work is done. The invoicing still takes my evening.”", text: "Shape an agent around your session records, agreed rates and cancellation rules. It could prepare an invoice for review, show where each line came from and ask about anything missing. Test the exceptions together and improve the instructions as your practice changes." },
  { title: "Keep changing as life changes", need: "“The setup made sense last year. My work is different now.”", text: "Review the way the tools serve you as your services, capacity or working preferences change. Adapt the parts that have become awkward and keep useful foundations in place. A working relationship can continue after the first build." },
  { title: "Ask for the change you need", need: "“Could it work a little differently for me?”", text: "We’re building Studio so a conversation with your assistant can become a request to change your setup. That might mean different instructions, another connection or a new tool. Rick can work with your agent to build and test the change, keeping a record of what changed and why." },
];

export default function PossibilitiesPage() {
  return <main className="studio-page possibilities-page" id="possibilities-top">
    <SiteNav />
    <nav className="studio-product-nav" aria-label="Studio possibilities">
      <a className="studio-product-name" href="#possibilities-top">Studio <span className="p-nav-plus">+ Oceanheart</span></a>
      <div><a href="#everyday">Everyday possibilities</a><a href="#connections">Your tools</a><a href="#vision">The bigger picture</a><a href={contact}>Talk to Rick</a></div>
    </nav>

    <section className="p-hero studio-wide" aria-labelledby="possibilities-title">
      <div className="p-hero-copy">

        <h1 id="possibilities-title">Don’t learn<br /><span>another tool.</span></h1>
        <p className="studio-lead">Work with a human who makes the tools work for you.</p>
        <p className="p-hero-description">Put AI agents to work on the administration that takes up your day. Rick connects the information and tools they need, tests their work and keeps improving the setup with you.</p>
        <div className="studio-actions"><a className="studio-button" href="#everyday">See what could help <SmallArrow down /></a><a className="studio-link" href={demo}>Try the current demo</a></div>
        <p className="p-small p-hero-note">For independent therapists, coaches, bodyworkers and other individual practitioners.</p>
      </div>
      <figure className="p-hero-art"><img src="/images/studio-possibilities/hero-selected-refined.png" width="1254" height="1254" alt="Enterprise-grade. Human-sized. A hand holding a miniature technological structure, recreated from the approved Oceanheart artwork in a light palette." fetchPriority="high" /></figure>
    </section>

    <section className="p-foundation studio-wide" aria-labelledby="foundation-title">
      <div className="p-foundation-statement"><h2 id="foundation-title">Good software.<br />Someone on your side.<br /><span>A way to make it yours.</span></h2><p>Getting useful work from an agent takes context, clear instructions and practice. Oceanheart brings that experience. We’re developing Studio as your private space for the results, the tools and the changes we make together.</p></div>
      <div className="p-foundation-combination"><img className="p-foundation-art" src="/images/studio-possibilities/studio-oceanheart.png" alt="Studio: clients, enquiries, appointments and tasks, brought together. Plus Oceanheart: work directly with Rick to adapt, connect and build." width="1536" height="1024" loading="lazy" /></div>
    </section>

    <section id="everyday" className="p-section studio-wide" aria-labelledby="everyday-title">
      <div className="p-section-intro"><h2 id="everyday-title">Recognise any of this?</h2><p>Choose a familiar difficulty. These examples show workflows we could build and test around your practice.</p></div>
      <WorkflowExplorer />
    </section>

    <section id="connections" className="p-connections" aria-labelledby="connections-title"><div className="studio-wide">
      <div className="p-section-intro"><h2 id="connections-title">Your practice lives<br />across more than one app.</h2><p>Keep the tools that serve you, including your current mailbox. We can connect an agent to the information it needs and bring the results into Studio, with a setup shaped around how you work.</p></div>
      <ConnectionExplorer />
    </div></section>

    <section id="workspace" className="p-section studio-wide" aria-labelledby="workspace-title">
      <div className="p-workspace-heading"><div><h2 id="workspace-title">Meet Studio.</h2></div><p>Explore the current workspace with fictional practice data. We’re building on this foundation so each practitioner can have their own setup, with agents and workflows shaped around them.</p></div>
      <ProductExplorer gentleMotion />
      <div className="p-status"><div><span className="p-status-dot" /><h3>Try the current workspace</h3><p>Explore the fictional practice demo without an account. The agent workflows above illustrate what we could build together.</p></div><div><span className="p-status-dot outlined" /><h3>Build your first workflow</h3><p>Bring one recurring administrative job. We’ll agree what the agent needs to know, what it should do and how to check the result.</p></div><div><span className="p-status-dot pale" /><h3>Adapt it through use</h3><p>Review the results with Rick, ask for changes and improve the workflow as you discover what helps.</p></div></div>
    </section>

    <section id="vision" className="p-vision" aria-labelledby="vision-title"><div className="studio-wide p-vision-grid">
      <div><h2 id="vision-title">The tide is turning.<br /><span>You deserve<br />a hand in it.</span></h2><p>Capable agents can work across your tools, prepare useful work and help build the pieces that are missing. Getting them to do that well takes context, clear instructions and someone who knows how to test the result.</p><p>You shouldn’t have to learn all of that before it can help you.</p><p>An enquiry ready to answer. Sessions accounted for. A working week that leaves something of you at the end of it.</p><p>We’re building Studio so you can see the information behind a result, what the agent did and what needs your attention. Ask for a change in the same place. We can test it, refine the instructions or build something new around you.</p><div className="p-vision-line">More say in your tools.<br />More room for your work.</div></div>
      <figure><a href="/images/studio-possibilities/tide-turning.png" aria-label="Open The tide is turning campaign artwork"><img src="/images/studio-possibilities/tide-turning.png" width="1054" height="1492" loading="lazy" alt="The tide is turning: an engraved wave of digital threads above a small independent coastal business." /></a></figure>
    </div></section>

    <section className="p-section studio-wide" aria-labelledby="more-title">
      <div className="p-section-intro"><h2 id="more-title">What have you wished<br />your tools could do?</h2><p>A need can be particular, personal or hard to put into technical words. Bring the example. We can work out the shape together.</p></div>
      <div className="p-possibility-list">{possibilities.map((item, index) => <details key={item.title}><summary><span className="p-list-number">0{index + 1}</span><h3>{item.title}</h3><span className="p-expand" aria-hidden="true">+</span></summary><div className="p-expanded"><p className="p-need-quote">{item.need}</p><p>{item.text}</p></div></details>)}</div>
    </section>

    <section id="together" className="p-together studio-wide" aria-labelledby="together-title">
      <figure className="p-portrait"><img src="/images/rick-portrait-looking-left-v2.png" alt="Rick Hallett" width="1128" height="1938" loading="lazy" /></figure>
      <div><h2 id="together-title">Show me where<br />it gets difficult.</h2><p>I’m Rick. My background brings together fifteen years in clinical practice, software engineering, and a life spent around contemplative and wellness communities.</p><p>I work with AI every day. I turn a practical need into instructions, context and a working workflow, then test it against ordinary cases and awkward exceptions. We refine it together as you use it.</p><p>You work with the person who can understand the difficulty, make the change and help keep it working.</p><ol className="p-collaboration"><li><strong>Bring one real example.</strong><span>Include the workarounds and the tools you already use.</span></li><li><strong>Try a useful change.</strong><span>Give the agent the context it needs. Try its work against examples from your practice.</span></li><li><strong>Make it part of the working day.</strong><span>Review the results, ask for changes and agree ongoing support as things evolve.</span></li></ol></div>
    </section>

    <section className="p-closing studio-wide" aria-labelledby="closing-title"><h2 id="closing-title">You don’t have to<br /><span>figure it all out alone.</span></h2><p>Bring one piece of administration you keep putting off. We’ll work out whether an agent could help, what it needs to know and how you’ll judge the result.</p><div className="studio-actions"><a className="studio-button" href={contact}>Have a free first conversation <SmallArrow /></a><a className="studio-link" href={demo}>Try the Studio demo</a></div><a className="p-email" href="mailto:rick@oceanheart.ai">rick@oceanheart.ai</a></section>
    <Footer />
  </main>;
}
