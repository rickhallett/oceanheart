import type { Metadata } from "next";
import { Footer, SiteNav } from "../../components/editorial";
import { ProductExplorer } from "../product-explorer";
import { ConnectionExplorer, WorkflowExplorer } from "./workflow-explorer";
import "../studio.css";
import "./possibilities.css";

export const metadata: Metadata = {
  title: "Studio + Oceanheart | More room for the work that matters",
  description: "Practice software, practical AI and a real person to shape it with you. Explore how your whole working setup could become more human.",
  robots: { index: false, follow: false },
};

const contact = "mailto:rick@oceanheart.ai?subject=Let%E2%80%99s%20talk%20about%20my%20practice";
const demo = "https://studio.oceanheart.ai/app?demo=1";
const possibilities = [
  { title: "Turn a workaround into a useful little tool", need: "“I keep a spreadsheet because nothing else quite does this.”", text: "Show Rick what the spreadsheet helps you do. It might become a small screen, a shared view or a workflow around Studio, shaped around the real need and maintained as your practice changes." },
  { title: "Give people more ways to participate", need: "“The form is simple to me. It’s a barrier for them.”", text: "Explore a shorter journey, clearer language, larger text, audio or a supported route through the process. Build with the people who need the alternative and check whether it helps them take the next step." },
  { title: "Remember the small things you promised", need: "“I said I’d send it. Then the day happened.”", text: "An assistant could help surface unfinished administrative commitments from the records you authorise it to use. Each suggestion would show where it came from, with a useful next action and room to correct it." },
  { title: "Rehearse a change before people depend on it", need: "“What happens if someone joins late, or a payment fails?”", text: "Try a new service or workflow with fictional cases. Walk through the awkward exceptions together, see confusing messages and repair the gaps before inviting real participants." },
  { title: "Help a small team hold the work together", need: "“It only works because I know where everything is.”", text: "Create a practice-specific guide, clear handoffs and shared administrative views. Your knowledge becomes something a colleague can use, with access appropriate to their role." },
  { title: "Keep changing as life changes", need: "“The setup made sense last year. My work is different now.”", text: "Review the way the tools serve you as your services, capacity or team change. Adapt the parts that have become awkward and keep useful foundations in place. A working relationship can continue after the first build." },
  { title: "Find support beyond your own practice", need: "“I’d like to work with other people, but organising it becomes another job.”", text: "Explore shared resources, practical mutual support or a referral process with a trusted circle of practitioners. Build around the relationships and agree what can be shared. Useful ideas can travel between practices while client information stays private." },
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
        <p className="p-kicker">Practice software. Practical AI. Personal support.</p>
        <h1 id="possibilities-title">Care for people.<br /><span>Make room for possibility.</span></h1>
        <p className="studio-lead">Keep the thread with clients. Make a new group happen. Have something left at the end of the day.</p>
        <p className="p-hero-description">Studio brings clients, enquiries, appointments and tasks together. Work with Rick at Oceanheart to adapt it, connect your everyday tools and build the things your particular practice needs.</p>
        <div className="studio-actions"><a className="studio-button" href="#everyday">See what could change <span aria-hidden="true">↓</span></a><a className="studio-link" href={demo}>Explore Studio</a></div>
        <p className="p-small p-hero-note">For independent therapists, coaches, bodyworkers and small practices.</p>
      </div>
      <figure className="p-hero-art"><img src="/images/studio-possibilities/street-level.png" width="1054" height="1492" alt="Oceanheart campaign artwork: Street level. Tapped in. Blue threads connect the buildings of a coastal high street." fetchPriority="high" /><figcaption>Powerful tools. Close to the work.</figcaption></figure>
    </section>

    <section className="p-foundation studio-wide" aria-label="How Studio and Oceanheart work together">
      <div><span className="p-kicker">01 / The product</span><h2>Studio</h2><p>Clients, enquiries, appointments and tasks in a shared practice workspace.</p><a href="#workspace">See the foundation <span aria-hidden="true">↗</span></a></div>
      <div><span className="p-kicker">02 / The person</span><h2>Oceanheart</h2><p>Work directly with Rick to build useful adaptations, connections and small specialist tools.</p><a href="#together">Meet the approach <span aria-hidden="true">↗</span></a></div>
      <div><span className="p-kicker">03 / The point</span><h2>Your way of working</h2><p>Less to carry in your head. More room for care, creativity and a life beyond the calendar.</p><a href="#vision">Where this is headed <span aria-hidden="true">↗</span></a></div>
    </section>

    <section id="everyday" className="p-section studio-wide" aria-labelledby="everyday-title">
      <div className="p-section-intro"><p className="p-kicker">Start with the part that gets in the way</p><h2 id="everyday-title">Recognise any of this?</h2><p>Choose a familiar difficulty. Walk through how we could change the work around it.</p></div>
      <WorkflowExplorer />
      <p className="p-example-caption">These are fictional examples of workflows we could build together. They illustrate possibilities beyond today’s Studio features; connections and adaptations are agreed for each practice.</p>
    </section>

    <section id="connections" className="p-connections" aria-labelledby="connections-title"><div className="studio-wide">
      <div className="p-section-intro"><p className="p-kicker">Around Studio, too</p><h2 id="connections-title">Your practice lives<br />across more than one app.</h2><p>Keep the tools that serve you. We can build the connections that help them work together, and small additions for the bits they leave you doing by hand.</p></div>
      <ConnectionExplorer />
      <div className="p-connection-footnote"><span className="p-kicker">Built for your setup</span><p>We agree what connects, what information moves and which actions need your review. Availability depends on each service, account and plan. These examples are a starting point for a conversation.</p></div>
    </div></section>

    <section id="workspace" className="p-section studio-wide" aria-labelledby="workspace-title">
      <div className="p-workspace-heading"><div><p className="p-kicker">A foundation you can explore</p><h2 id="workspace-title">Meet Studio.</h2></div><p>See the current workspace through a fictional practice. Open the demo to try it without an account.</p></div>
      <ProductExplorer />
      <div className="p-status"><div><span className="p-status-dot" /><h3>Explore now</h3><p>Today, clients, services, bookings, enquiries and tasks in the public browser demo.</p></div><div><span className="p-status-dot outlined" /><h3>Shape with Rick</h3><p>Discuss a workflow, integration or small tool. Agree what can be built, how it works and how it will be maintained.</p></div><div><span className="p-status-dot pale" /><h3>Develop together</h3><p>Assistant tools, client experiences and deeper adaptations, guided by the needs of the practices involved.</p></div></div>
    </section>

    <section id="vision" className="p-vision" aria-labelledby="vision-title"><div className="studio-wide p-vision-grid">
      <div><p className="p-kicker">The bigger picture</p><h2 id="vision-title">The tide is turning.<br /><span>You deserve<br />a hand in it.</span></h2><p>Software is becoming easier to create and reshape. An idea that once needed a large budget or a whole development team can become something we explore together.</p><p>That opens up a different question: what would help you live and work better?</p><p>A resource someone can actually use. A group you finally have the support to run. A working week that leaves something of you at the end of it.</p><p>Oceanheart brings practical AI engineering into that conversation. We can start with a need that is specific to you, try a small working answer and develop it with the people it affects.</p><div className="p-vision-line">More say in your tools.<br />More room for your work.</div></div>
      <figure><a href="/images/studio-possibilities/tide-turning.png" aria-label="Open The tide is turning campaign artwork"><img src="/images/studio-possibilities/tide-turning.png" width="1054" height="1492" loading="lazy" alt="The tide is turning: an engraved wave of digital threads above a small independent coastal business." /></a></figure>
    </div></section>

    <section className="p-section studio-wide" aria-labelledby="more-title">
      <div className="p-section-intro"><p className="p-kicker">Small beginnings. Real possibilities.</p><h2 id="more-title">What have you wished<br />your tools could do?</h2><p>A need can be particular, personal or hard to put into technical words. Bring the example. We can work out the shape together.</p></div>
      <div className="p-possibility-list">{possibilities.map((item, index) => <details key={item.title}><summary><span className="p-list-number">0{index + 1}</span><h3>{item.title}</h3><span className="p-expand" aria-hidden="true">+</span></summary><div className="p-expanded"><p className="p-need-quote">{item.need}</p><p>{item.text}</p></div></details>)}</div>
    </section>

    <section id="together" className="p-together studio-wide" aria-labelledby="together-title">
      <figure className="p-portrait"><img src="/images/kai-outdoors.jpeg" alt="Rick Hallett outdoors" width="600" height="800" loading="lazy" /><figcaption>Rick Hallett · clinician & software engineer</figcaption></figure>
      <div><p className="p-kicker">A real person to work with</p><h2 id="together-title">Show me where<br />it gets difficult.</h2><p>I’m Rick. My background brings together fifteen years in clinical practice, software engineering, and a life spent around contemplative and wellness communities.</p><p>I work with AI every day to investigate, prototype and build. That means we can explore ideas in working software, then refine them around what you learn by using them.</p><p>You work with the person who can understand the difficulty, make the change and help keep it working.</p><ol className="p-collaboration"><li><strong>Bring one real example.</strong><span>Include the workarounds and the tools you already use.</span></li><li><strong>Try a useful change.</strong><span>Agree the scope. Explore an early version. Keep your judgement involved.</span></li><li><strong>Make it part of the working day.</strong><span>Check the whole journey and agree ongoing support as things evolve.</span></li></ol></div>
    </section>

    <section className="p-closing studio-wide" aria-labelledby="closing-title"><p className="p-kicker">Practical AI with Rick Hallett</p><h2 id="closing-title">You don’t have to<br /><span>figure it all out alone.</span></h2><p>Start with something that takes too much effort, an idea you haven’t been able to try, or a change you want your practice to make room for.</p><div className="studio-actions"><a className="studio-button" href={contact}>Have a free first conversation <span aria-hidden="true">↗</span></a><a className="studio-link" href={demo}>Try the Studio demo</a></div><a className="p-email" href="mailto:rick@oceanheart.ai">rick@oceanheart.ai</a></section>
    <div className="p-variant-link studio-wide"><a href="/studio">View the original Studio page</a><span>Studio possibilities · page variant</span></div>
    <Footer />
  </main>;
}
