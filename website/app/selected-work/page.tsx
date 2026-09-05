
import { ArrowIcon } from '@/app/components/arrow-icon';
import Link from '@/app/components/site-link';
import { DepthPage, WorkLinks } from '../components/depth';
export const metadata = { title: 'Selected work | Oceanheart' };
export default function SelectedWork() {
  return <DepthPage title="Selected work" label="Systems in practice"><WorkLinks slugs={['sarah-mozer-studio', 'becoming-diamond', 'loanslam', 'human-os']} /><Link className="depth-next" href="/engineering">Experiments and engineering <ArrowIcon /></Link></DepthPage>;
}
