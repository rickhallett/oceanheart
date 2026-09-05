import { DepthPage, NoteLinks } from '../components/depth';
export const metadata = { title: 'Selected notes | Oceanheart' };
export default function Notes() {
  return <DepthPage title="Selected notes" label="From the work"><p className="depth-intro">Three accounts of working with people and AI.</p><NoteLinks /></DepthPage>;
}
