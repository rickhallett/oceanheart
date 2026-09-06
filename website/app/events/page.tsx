import type { Metadata } from 'next';
import { Footer, SiteNav } from '../components/editorial';
import { CardArt } from '../components/card-art';
import { InterestForm } from './interest-form';
export const metadata: Metadata = { title: 'Events & classes in Swanage, Poole & Bournemouth | Oceanheart', description: 'Meditation, breathwork and somatic movement. Local gatherings with time for attention, movement and shared practice.', alternates: { canonical: 'https://www.oceanheart.ai/events' } };
export default function Page() {
  return <div className="editorial-page editorial-human events-touchstone">
    <div className="card-opening-art"><CardArt kind="stone" /></div>
    <div className="editorial-foreground">
      <SiteNav />
      <main><section className="editorial-opening">
        <p className="eyebrow">Swanage · Poole · Bournemouth</p>
        <h1>Room to practise together.</h1>
        <p className="editorial-intro">Meditation, breathwork and somatic movement. Local gatherings with time for attention, movement and shared practice.</p>
        <InterestForm />
      </section></main>
      <Footer />
    </div>
  </div>;
}
