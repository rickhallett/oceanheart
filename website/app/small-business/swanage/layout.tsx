import type { Metadata } from 'next';
import './swanage.css';
export const metadata: Metadata={title:'Swanage working studies | Oceanheart',description:'Independent, illustrative AI coaching concepts grounded in the public identities of Swanage businesses. Not commissioned or endorsed by the businesses shown.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}) {return <div className="sw-root">{children}</div>;}
