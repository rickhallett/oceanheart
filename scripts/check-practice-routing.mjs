import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { practiceHref } from '../website/lib/practice-routing.mjs';
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
assert.equal(config.rewrites.find(r => r.has?.some(h => h.type === 'host' && h.value === 'dev.oceanheart.ai')).destination, '/dev');
assert.equal(config.rewrites.at(-1).destination, '/flagship');
// A physical root index silently overrides Vercel's hostname rewrite.
assert.ok(!(await readdir(new URL('../public/', import.meta.url))).some(name => /^index\./.test(name)), 'Vercel treats any index.* file as a root document');
await access(new URL('../public/dev.html', import.meta.url));
for (const route of ['practice','sessions','act','breathwork','deep-tissue-massage','events']) {
 assert.equal(practiceHref('/'+route,'localhost'),'/'+route);
 assert.equal(practiceHref('/'+route,'dev.oceanheart.ai'),'https://www.oceanheart.ai/'+route);
 const html=await readFile(new URL(`../public/${route}.html`,import.meta.url),'utf8');
 assert.ok(html.includes('https://www.oceanheart.ai/'+route));
}
for (const route of ['systems-work','conversations-with-ai','selected-work','selected-work/the-pit','engineering','cv']) {
 assert.equal(practiceHref('/'+route,'www.oceanheart.ai'),'https://dev.oceanheart.ai/'+route);
 assert.equal(practiceHref('/'+route,'preview.vercel.app'),'/'+route);
}
assert.equal(practiceHref('/dev','www.oceanheart.ai'),'https://dev.oceanheart.ai/');
assert.equal(practiceHref('#book','www.oceanheart.ai'),'#book');
assert.equal(practiceHref('mailto:rick@oceanheart.ai','dev.oceanheart.ai'),'mailto:rick@oceanheart.ai');
const home=await readFile(new URL('../public/flagship.html',import.meta.url),'utf8');
const studio=await readFile(new URL('../public/studio.html',import.meta.url),'utf8');
assert.ok(home.includes('Put the power'));
assert.ok(home.includes('to change things'));
assert.ok(home.includes('rel="canonical" href="https://www.oceanheart.ai"'));
assert.ok(studio.includes('Put the power'));
assert.ok(studio.includes('https://www.oceanheart.ai/studio'));
assert.ok(!home.includes('aria-label="Studio possibilities"'));
assert.ok(!studio.includes('aria-label="Studio possibilities"'));
assert.ok(home.includes('href="/the-technical-bit"'));
assert.ok(home.includes('href="/sessions"'));
assert.ok(!home.includes('href="/dev"'));
assert.ok(!home.includes('href="/systems-work"'));
const technical=await readFile(new URL('../public/the-technical-bit.html',import.meta.url),'utf8');
assert.ok(technical.includes('Studio system architecture'));
assert.ok(technical.includes('Workflow execution'));
assert.ok(technical.includes('real-client billing remains a separate milestone'));
const navigation=await readFile(new URL('../website/app/components/practice.ts',import.meta.url),'utf8');
const headerNavigation=navigation.match(/flagshipNavigation = (\[[^;]+\])/s)?.[1] ?? '';
const footerNavigation=navigation.match(/flagshipFooterNavigation = (\[[^;]+\])/s)?.[1] ?? '';
for (const route of ['/sessions', '/consulting', '/about']) {
 assert.ok(!headerNavigation.includes(`'${route}'`), `${route} stays out of the flagship header`);
 assert.ok(footerNavigation.includes(`'${route}'`), `${route} remains in the flagship footer`);
}
console.log('Studio homepage, technical page and dev routing verified.');
