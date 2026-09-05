import { DepthPage } from '../components/depth';
export const metadata = { title: 'Professional background | Oceanheart' };
export default function Background() {
  return <DepthPage title="Professional background" label="Rick Hallett">
    <div className="article-prose">
      <p>My work spans cognitive behavioural therapy in NHS and private practice, professional software engineering, and independent client delivery.</p>
      <h2>Engineering</h2>
      <ul>
        <li>Oceanheart: independent client products and applied AI systems.</li>
        <li>Loans by MAL: contracted conversational-system development.</li>
        <li>EDITED: data visualisation and enterprise integrations for retail analytics.</li>
        <li>Brandwatch: enterprise data visualisation, platform development and mentoring.</li>
        <li>Telesoft Technologies: full-stack work on network-security applications.</li>
        <li>Appius: content-management systems, customer portals and integrations.</li>
        <li>School Business Services: financial-management software for schools.</li>
      </ul>
      <h2>Training and practice</h2>
      <ul><li>PGDip Cognitive Behavioural Therapy, Royal Holloway, University of London.</li><li>PGCert Primary Mental Healthcare, University of Central Lancashire.</li><li>BSc Psychology, UWE Bristol.</li></ul>
      <p>I am no longer BABCP-accredited. My current practice brings together behavioural, somatic, existential, spiritual and physical approaches.</p>
    </div>
  </DepthPage>;
}
