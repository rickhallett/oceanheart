import Link from 'next/link';
import { EditorialPage, ReadingSection } from '../components/editorial';
import { NoteLinks } from '../components/depth';

export default function ConversationsWithAI() {
  return <EditorialPage tone="light" image="/images/oceanheart-beach-step.jpg"
    label="Conversations with AI · Practical guidance"
    title="Work with AI. Stay in the conversation."
    intro={<>Be a part of research that matters.<br /><br />Guided sessions using something that matters to you: a task, a decision, a piece of work or an idea. We’ll explore what AI can contribute, question its answers and keep your own judgement involved.</>}
    invitation="Bring something you’d like to work through."
    bookingKinds={['ai', 'exploration']}
    bookingDescription="Pilot sessions are currently free. Tell me what you’re interested in and whether you’ve used AI before. You don’t need a polished brief; if you’d like to talk first, choose a free exploration conversation."
    afterBooking={<ReadingSection label="Further reading"><NoteLinks limit={2} /></ReadingSection>}>
    <ReadingSection label="What you could bring">
      <p>A task you suspect AI could help with. An answer you don’t know whether to trust. An idea you want to develop while staying involved in the thinking.</p>
      <p>You might be curious, sceptical or already using AI every day. We’ll start with where you are and what you want to work through.</p>
    </ReadingSection>
    <ReadingSection label="What happens in a session">
      <p>We’ll start with what you want to do, then work with an AI tool together. Along the way, we’ll question its answers, notice your assumptions, make room for you, and try different approaches.</p>
      <p>We’ll finish by considering what was useful, what remains uncertain and what you want to do next.</p>
    </ReadingSection>
    <ReadingSection label="What you can take away">
      <p>The aim is to make progress on what you brought, develop practical approaches you can use again, and get a clearer sense of when to trust, question or set aside an AI response.</p>
    </ReadingSection>
    <ReadingSection label="Why work with me">
      <p>I bring the attention of a therapist and the practical experience of a software engineer. I’m interested in both what the tool can do and what happens to your thinking when you use it.</p>
      <p>The focus here is working with AI. For a therapeutic session, you can explore my <Link href="/human-work">therapy and bodywork practice</Link>.</p>
    </ReadingSection>
    <ReadingSection label="A free pilot">
      <p>Conversations with AI is currently free of charge as a pilot study. I’m developing a product centred on people’s actual needs, judgement and experience, and these sessions will help shape that work.</p>
      <p>We’ll agree the session length, format and tools beforehand, and discuss what participation in the pilot involves before you decide to take part.</p>
    </ReadingSection>
  </EditorialPage>;
}
