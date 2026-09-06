
import { ArrowIcon } from '@/app/components/arrow-icon';
import type { Metadata } from 'next';
import Link from '@/app/components/site-link';
import { EditorialPage, ReadingSection } from '../components/editorial';

export const metadata: Metadata = { title: 'About Rick | Oceanheart', description: 'I’m Rick - a therapist, experience designer and engineer.' };

export default function About() {
  return <EditorialPage tone="about" label="About Rick"
    title={<>I’m Rick - a <span className="role-therapist">therapist</span>, <span className="role-designer">experience designer</span> and <span className="role-engineer">engineer</span>.</>}
    intro="The thread through my work is attention: noticing what’s happening, understanding how things fit together and finding a useful next move."
    invitation="If this sounds like a useful way to work together, I’d like to hear what’s on your mind.">
        <ReadingSection label="Practices in conversation"><p>Therapy shapes how I listen. Experience design shapes how I think about what people encounter. Engineering gives me the means to build and test what could work better.</p></ReadingSection>
        <ReadingSection label="Working with me"><p>I’ll listen carefully, ask questions and tell you what I see. We can question each other, change our minds and work out the next move together.</p></ReadingSection>
        <ReadingSection label="Contemplative practice"><p>I have maintained a contemplative practice for twenty years, both within and outside the Rinzai and Soto Zen traditions. Within Zenways, led by Daizan Roshi, I am a junior Zen teacher in training.</p><p>This practice informs the attention I bring to my work with people and technology.</p></ReadingSection>
        <ReadingSection label="Background"><p>My background includes cognitive behavioural therapy in NHS and private practice, followed by professional software engineering at Brandwatch, EDITED, School Business Services and Telesoft.</p><p>I hold a postgraduate diploma in Cognitive Behavioural Therapy from Royal Holloway, a postgraduate certificate in Primary Mental Healthcare from the University of Central Lancashire, and a BSc in Psychology from UWE Bristol.</p><Link className="depth-next" href="/cv/">Professional background <ArrowIcon /></Link></ReadingSection>
  </EditorialPage>;
}
