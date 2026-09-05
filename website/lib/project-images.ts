export type ProjectImage = {
  file: string;
  title: string;
  caption: string;
  alt: string;
  kind: 'Live website' | 'Concept' | 'Published capture' | 'Synthetic prototype';
};

export const projectImages: Record<string, ProjectImage[]> = {
  'sarah-mozer-studio': [
    { file: 'sarah-home', title: 'The work comes first', kind: 'Live website', alt: 'Sarah Mozer Studio homepage with a large coastal painting and links to landscapes and pet portraits.', caption: 'A painting fills the opening view. The navigation leads directly to the kinds of work a visitor can buy or commission.' },
    { file: 'sarah-landscapes', title: 'A place for each collection', kind: 'Live website', alt: 'Dorset landscapes collection introduction with a harbour painting.', caption: 'The landscape collection has its own introduction and visual identity. Captured September 2026; stock and availability change.' },
  ],
  'becoming-diamond': [
    { file: 'diamond-home', title: 'The public entrance', kind: 'Live website', alt: 'Becoming Diamond homepage in black, white and blue, with navigation to the book, training and member portal.', caption: 'The public site brings the book, training offers and member portal into one navigation. This is the client’s live marketing copy, not an Oceanheart claim about the course.' },
  ],
  loanslam: [
    { file: 'loanslam-workspace', title: 'The conversation beside the controls', kind: 'Synthetic prototype', alt: 'LoanSlam support chat beside a decision-state diagram showing validation and routing.', caption: 'The demonstration exposes the decision machinery alongside the conversation. This capture shows the initial state, before a question is submitted.' },
    { file: 'loanslam-report', title: 'An inspectable test result', kind: 'Synthetic prototype', alt: 'LoanSlam gauntlet report showing 122 scenarios, 95 passes and a Needs work verdict.', caption: 'The report keeps failures visible: 95 of 122 scenarios passed in this June 2026 run. It is evidence from one synthetic test run, not a production-readiness claim.' },
  ],
  'human-os': [
    { file: 'human-os-threshold', title: 'An invitation into the archive', kind: 'Concept', alt: 'Human OS concept screens: an earlier piece of writing and ways into the archive, alongside a notebook of saved discoveries.', caption: 'The Threshold offers a piece of earlier writing before asking what to do next. The Notebook gives discoveries somewhere to stay. Original concept screens with synthetic example content, not client-runtime captures.' },
    { file: 'human-os-ask', title: 'An answer with a visible past', kind: 'Concept', alt: 'Two Ask concept screens with dates in the margin connecting each answer to archive sources.', caption: 'Dates sit beside the answer rather than interrupting every sentence. A follow-up question can trace a phrase back through the archive; keeping the answer is a separate choice. Synthetic examples.' },
    { file: 'human-os-arc', title: 'Two periods, held together', kind: 'Concept', alt: 'The Arc concept showing a single year with source excerpts beside a comparison of two periods.', caption: 'The Arc moves from a year to its individual pieces, or compares two periods of writing. The reader can inspect the sources behind the interpretation. Synthetic examples.' },
  ],
  'the-pit': [
    { file: 'pit-arena', title: 'Choosing the conditions', kind: 'Live website', alt: 'The Pit arena showing demo availability, a custom lineup and a preset experiment.', caption: 'The arena exposes the choice of agents and conditions before a run. The public community credit pool was empty at capture, so no new run was started.' },
  ],
};
