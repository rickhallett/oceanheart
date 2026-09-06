export function practiceHref(href, hostname) {
  if (!href?.startsWith('/') || href.startsWith('//') || !/^(www\.|dev\.)?oceanheart\.ai$/.test(hostname)) return href;
  if (/^\/dev(?=\/|$|[?#])/.test(href)) return `https://dev.oceanheart.ai${href.slice(4) || '/'}`;
  const owner = /^\/(systems-work|conversations-with-ai|selected-work|engineering|cv)(\/|$|[?#])/.test(href) ? 'dev' : 'www';
  return `https://${owner}.oceanheart.ai${href}`;
}
