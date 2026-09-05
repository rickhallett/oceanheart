import { DepthPage, WorkLinks } from '../components/depth';
export const metadata = { title: 'Experiments and engineering | Oceanheart' };
export default function Engineering() {
  return <DepthPage title="Experiments and engineering" label="Under the surface"><p className="depth-intro">Tools for inspecting agent behaviour, reviewing work and keeping track of what a system did.</p><WorkLinks slugs={['the-pit', 'sortie', 'halo']} /></DepthPage>;
}
