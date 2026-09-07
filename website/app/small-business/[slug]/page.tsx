import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { variants } from '../content';
import VariantPage from '../variant-page';
export function generateStaticParams() { return variants.map(({slug})=>({slug})); }
export async function generateMetadata({ params }: { params: Promise<{slug:string}> }): Promise<Metadata> {
 const {slug}=await params; const v=variants.find(item=>item.slug===slug);
 return { title: `${v?.name || 'Practical AI'} | Oceanheart`, description:v?.intro, alternates: {canonical:`https://www.oceanheart.ai/small-business/${slug}`}, openGraph:{title:v?.title.replace('\n',' '),description:v?.intro,url:`https://www.oceanheart.ai/small-business/${slug}`} };
}
export default async function Page({ params }: { params: Promise<{slug:string}> }) { const {slug}=await params; const v=variants.find(item=>item.slug===slug); if(!v) notFound(); return <VariantPage v={v}/>; }
