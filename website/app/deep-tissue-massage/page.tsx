import type { Metadata } from 'next';
import { EditorialPage, ReadingSection } from '../components/editorial';
export const metadata: Metadata = { title: "Deep tissue massage | Oceanheart", description: "Hands-on massage with Rick, shaped around what you’re looking for and what feels comfortable for you.", alternates: { canonical: 'https://www.oceanheart.ai/deep-tissue-massage' } };
export default function Page() { return <EditorialPage tone="human" image="/images/oceanheart-beach-step.jpg" label="Deep tissue massage" title="Give your body some time." intro="Hands-on massage with Rick, shaped around what you’re looking for and what feels comfortable for you." bookingKinds={["massage", "exploration"]} invitation="Make some time for yourself." bookingDescription="Book a massage or start with a free, short conversation. We’ll confirm the location and session length when arranging your booking.">
<ReadingSection label="Your massage"><p>We’ll begin by discussing what you’d like from the session and which areas you want to focus on. The pressure and pace are agreed with you, and you can ask for adjustments throughout.</p></ReadingSection>
<ReadingSection label="What to expect"><p>There’s time to settle, ask questions and agree the focus and boundaries of the session before we begin. You can book massage as a session in its own right.</p></ReadingSection>
<ReadingSection label="Time & cost"><p>Massage is currently £35 per hour. We’ll agree the session length and location when arranging your booking.</p></ReadingSection>
</EditorialPage>; }
