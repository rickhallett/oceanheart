
import { ArrowIcon } from '@/app/components/arrow-icon';
import type { Metadata } from 'next';
import { EditorialPage, ReadingSection } from '../components/editorial';
import Link from '@/app/components/site-link';
import { WorkLinks } from '../components/depth';

export const metadata: Metadata = {
  alternates: { canonical: 'https://dev.oceanheart.ai/' },
  openGraph: { title: 'Oceanheart Dev', url: 'https://dev.oceanheart.ai/', images: ['https://www.oceanheart.ai/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Oceanheart Dev', images: ['https://www.oceanheart.ai/og.png'] },
  title: 'Bespoke websites, software and AI tools — Oceanheart',
  description: 'Websites, bespoke software, AI tools and workflows for individuals and small organisations. Explore completed projects and arrange a free initial digital consultation.',
};

export default function SystemsWork() {
  return <EditorialPage practice="dev" tone="night" image="/images/kai-systems-desk.jpeg" label="dev.oceanheart.ai · Design, engineering & AI"
    title="Let’s make something useful."
    intro="I design and build websites, bespoke software and workflows for individuals and small organisations. We’ll start with what you need to do, understand what’s getting in the way, and build something you can use."
    invitation="What are you trying to make work better?"
    bookingKinds={['digital']}
    bookingDescription="Start with a free, short digital consultation to explore your project. Tell me what you do, what’s getting in the way, and what you’d like to change. Include a timescale or budget if you have one."
    afterBooking={<ReadingSection label="A closer look"><Link className="depth-next" href="/selected-work">More selected work <ArrowIcon /></Link><Link className="depth-next" href="/engineering">Experiments and engineering <ArrowIcon /></Link></ReadingSection>}>
    <ReadingSection label="What I can help you build">
      <p>Websites and online shops. Tools for running a practice or business. AI features that work with relevant material. Connected workflows that reduce repeated work.</p>
      <p>You don’t need to know which technology you need. We’ll work out what would be useful, including whether AI has a part to play.</p>
    </ReadingSection>
    <ReadingSection label="Practical AI guidance"><p>If you’d like help using AI in your own work, bring a task, a question or an idea. We’ll explore the tools together and keep your own judgement involved.</p><Link className="depth-next" href="/conversations-with-ai">Explore the free AI pilot <ArrowIcon /></Link></ReadingSection>
    <ReadingSection label="Things I’ve built">
      <WorkLinks slugs={['sarah-mozer-studio', 'becoming-diamond']} />
      <Link className="depth-next" href="/selected-work">Explore selected work <ArrowIcon /></Link>
    </ReadingSection>
    <ReadingSection label="How a project works">
      <p>First, we look at how things work now and agree a useful first scope. I build something you can try; your experience of using it guides what we refine.</p>
      <p>We’ll also work through how you’ll use and look after it. My background in therapy and experience design shapes how I listen, explain decisions and build around people’s ways of working.</p>
    </ReadingSection>
    <ReadingSection label="Before we start">
      <p>We’ll agree the scope, cost and timescale, along with ownership, ongoing running costs and support arrangements. The initial exploration conversation is free; project work is scoped and priced separately.</p>
    </ReadingSection>
  </EditorialPage>;
}
