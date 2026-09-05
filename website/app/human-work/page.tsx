
import { ArrowIcon } from '@/app/components/arrow-icon';
import type { Metadata } from 'next';
import Link from '@/app/components/site-link';
import { EditorialPage, ReadingSection } from '../components/editorial';

export const metadata: Metadata = {
  title: 'Therapy, bodywork and massage with Rick — Oceanheart',
  description: 'Individual therapeutic sessions and standalone massage. An integrative practice drawing on talking therapy, mindfulness, breathwork and work with the body.',
};

export default function HumanWork() {
  return <EditorialPage tone="human" image="/images/kai-looking-left.png" label="Therapy, bodywork & massage"
    title="Space to talk. Space to feel."
    intro="Individual therapeutic sessions shaped around what you need, with space for talking, contemplative practice and work with the body."
    invitation="Find a place to begin."
    bookingKinds={['therapy', 'massage', 'exploration']}
    bookingDescription="Choose a therapeutic session or a standalone massage. If you’re unsure, start with a free, short exploration conversation. There’s no need to send a detailed personal history in your first email.">
    <ReadingSection label="Therapeutic sessions">
      <p>You might arrive with something specific, a pattern that keeps returning, or a sense that you need some space. We’ll start with what’s happening for you and agree how to work together.</p>
      <p>My practice draws on cognitive behavioural therapy (CBT), acceptance and commitment therapy (ACT), mindfulness and meditation, somatic release, breathwork, yoga and chi gong. These offer different ways to explore your experience; we’ll choose what feels appropriate together.</p>
    </ReadingSection>
    <ReadingSection label="Massage on its own">
      <p>You can book a massage without beginning a wider therapeutic process. We’ll discuss what you’re looking for and agree the focus and boundaries of the session before we begin.</p>
    </ReadingSection>
    <ReadingSection label="Your first session">
      <p>We’ll make time to understand what brings you here, what you hope for and what feels comfortable. You don’t need to arrive with a clear explanation.</p>
      <p>Sessions can centre on talking or include work with the body and contemplative practices.</p>
    </ReadingSection>
    <ReadingSection label="Experience & practice">
      <p>My background includes cognitive behavioural therapy in NHS and private practice. I trained in CBT and am no longer BABCP-accredited. This is my own integrative practice, rather than a standard CBT programme.</p>
      <p>I have maintained a contemplative practice for twenty years, both within and outside the Rinzai and Soto Zen traditions. Within Zenways, led by Daizan Roshi, I am a junior Zen teacher in training.</p>
      <Link className="depth-next" href="/about">More about my background <ArrowIcon /></Link>
    </ReadingSection>
    <ReadingSection label="Time & cost">
      <p>Therapeutic sessions and standalone massage are currently £35 per hour. We’ll agree the session length, location and format when arranging your booking.</p>
      <p>A short exploration conversation is free of charge, if you’d like to discuss what you need before choosing a session.</p>
    </ReadingSection>
  </EditorialPage>;
}
