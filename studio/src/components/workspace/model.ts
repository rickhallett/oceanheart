export const modules = [
  ["today", "Today", "Your day, at a glance"],
  ["inbox", "Enquiries", "Conversations that become connections"],
  ["calendar", "Bookings", "A little shape to your week"],
  ["clients", "Clients", "The people behind your practice"],
  ["tasks", "Tasks", "A little less on your mind"],
  ["services", "Services", "The work you offer"],
  ["website", "Your website", "A clear welcome to your practice"],
  ["knowledge", "Knowledge", "One home for what your business knows"],
  ["assistant", "Assistant", "Thoughtful help, with you in control"],
  ["payments", "Payments", "A clear picture of what’s paid"],
  ["shop", "Shop", "The small things that support your work"],
  ["portal", "Client portal", "Experience the other side of your practice"],
  ["support", "Your studio partner", "A familiar person in your corner"],
  ["setup", "Set up together", "Start with the practice you have"],
  ["settings", "Settings", "Make this space your own"],
  ["operations", "Studio operations", "See how the service is running"],
  ["roadmap", "Shape the roadmap", "Decide what earns its place"],
] as const;
export type View = (typeof modules)[number][0];
export type Priority =
  "Unsorted" | "Essential" | "Next" | "Later" | "Not needed";
export type Feature = {
  id: View;
  title: string;
  description: string;
  journey: string;
  dependencies: string[];
};
export const features: Feature[] = modules.map(([id, title, description]) => ({
  id,
  title,
  description,
  journey:
    (
      {
        inbox: "Read an enquiry → draft a reply → approve → book a session",
        calendar:
          "Choose a day → create or reschedule a booking → see it on Today",
        clients: "Find a client → inspect their history → add a note",
        knowledge: "Add a source → sync → search → inspect citation",
        assistant:
          "Ask a policy question → inspect evidence → approve an action",
        setup:
          "Describe your practice → review the proposed structure → apply it",
        website: "Edit your welcome and services → preview → publish the demo",
        roadmap:
          "Try a feature → choose a priority → leave a note → export the plan",
      } as Partial<Record<View, string>>
    )[id] || `Explore ${title.toLowerCase()} → make a change → see it saved`,
  dependencies:
    (
      {
        assistant: ["knowledge", "inbox"],
        calendar: ["clients", "services"],
        payments: ["clients", "calendar"],
        website: ["services", "setup"],
        operations: ["assistant", "knowledge"],
        shop: ["payments"],
      } as Partial<Record<View, string[]>>
    )[id] || [],
}));
export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  notes: string[];
};
export type Booking = {
  id: string;
  clientId: string;
  serviceId: string;
  day: string;
  time: string;
  status: "Confirmed" | "Awaiting payment" | "Cancelled" | "Completed";
};
export type Service = {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
  active: boolean;
};
export type Message = {
  id: string;
  clientId: string;
  subject: string;
  body: string;
  status: "New" | "Draft ready" | "Replied" | "Escalated";
  reply: string;
  messages: string[];
};
export type Source = {
  id: string;
  title: string;
  kind: string;
  audience: "Public" | "Team only";
  status: "Ready" | "Needs sync";
  content: string;
  version: number;
};
export type Approval = {
  id: string;
  title: string;
  detail: string;
  type: "reply" | "refund";
  messageId?: string;
  paymentId?: string;
  status: "Pending" | "Approved" | "Declined";
  amount?: number;
};
export type Payment = {
  id: string;
  clientId: string;
  description: string;
  amount: number;
  status: "Paid" | "Pending" | "Refunded";
};
export type Ticket = {
  id: string;
  title: string;
  status: "Open" | "In progress" | "Resolved";
  messages: string[];
};
export type Practice = {
  name: string;
  owner: string;
  email: string;
  modality: string;
  location: string;
  welcome: string;
  hours: string;
};
export type State = {
  practice: Practice;
  clients: Client[];
  bookings: Booking[];
  services: Service[];
  inbox: Message[];
  tasks: { id: string; text: string; done: boolean }[];
  sources: Source[];
  approvals: Approval[];
  payments: Payment[];
  tickets: Ticket[];
  priorities: Partial<Record<View, Priority>>;
  featureNotes: Partial<Record<View, string>>;
  connections: Record<string, boolean>;
  activity: string[];
  published: boolean;
  products: { id: string; name: string; price: number; stock: number }[];
  orders: {
    id: string;
    clientId: string;
    item: string;
    status: "Processing" | "Dispatched";
  }[];
  chatHistory: {
    q: string;
    answer: string;
    sourceId?: string;
    citation?: Pick<Source, "id" | "title" | "version" | "content" | "audience">;
    trace: string[];
  }[];
  setupStep: number;
  setupDescription: string;
  release: string;
};
export const demoDay = "2026-09-08";
export const initialState: State = {
  practice: {
    name: "Stillwater Practice",
    owner: "Amelia",
    email: "amelia@example.com",
    modality: "Reflexology & holistic wellbeing",
    location: "Bristol & online",
    welcome: "A little time to come back to yourself.",
    hours: "Tuesday to Friday, 09:00–17:00",
  },
  clients: [
    {
      id: "c1",
      name: "Lucy Parker",
      email: "lucy@example.com",
      phone: "07700 900101",
      status: "Returning",
      notes: ["Prefers morning appointments."],
    },
    {
      id: "c2",
      name: "James Wood",
      email: "james@example.com",
      phone: "07700 900102",
      status: "Returning",
      notes: ["Usually books online sessions."],
    },
    {
      id: "c3",
      name: "Amira Khan",
      email: "amira@example.com",
      phone: "07700 900103",
      status: "New",
      notes: [],
    },
    {
      id: "c4",
      name: "Sophie Ellis",
      email: "sophie@example.com",
      phone: "07700 900104",
      status: "New enquiry",
      notes: [],
    },
  ],
  services: [
    {
      id: "s1",
      name: "Reflexology session",
      duration: 60,
      price: 65,
      description:
        "An unhurried, one-to-one reflexology session in the practice.",
      active: true,
    },
    {
      id: "s2",
      name: "First conversation",
      duration: 20,
      price: 0,
      description:
        "A short call to meet and talk about what you are looking for.",
      active: true,
    },
    {
      id: "s3",
      name: "Online wellbeing session",
      duration: 45,
      price: 50,
      description: "Space to reflect, wherever you are.",
      active: true,
    },
  ],
  bookings: [
    {
      id: "b1",
      clientId: "c1",
      serviceId: "s1",
      day: demoDay,
      time: "09:00",
      status: "Confirmed",
    },
    {
      id: "b2",
      clientId: "c2",
      serviceId: "s3",
      day: demoDay,
      time: "11:00",
      status: "Confirmed",
    },
    {
      id: "b3",
      clientId: "c3",
      serviceId: "s2",
      day: demoDay,
      time: "14:00",
      status: "Confirmed",
    },
    {
      id: "b4",
      clientId: "c1",
      serviceId: "s1",
      day: "2026-09-10",
      time: "10:00",
      status: "Awaiting payment",
    },
  ],
  inbox: [
    {
      id: "m1",
      clientId: "c4",
      subject: "A first appointment",
      body: "Hello Amelia, I found your practice through a friend. I’ve never tried reflexology before. Could we have a quick conversation before I book? Thursday morning would be lovely.",
      status: "New",
      reply: "",
      messages: [],
    },
    {
      id: "m2",
      clientId: "c1",
      subject: "Moving Thursday’s session",
      body: "Would it be possible to move my Thursday appointment to Friday? The same time would be ideal. Thank you!",
      status: "New",
      reply: "",
      messages: [],
    },
    {
      id: "m3",
      clientId: "c2",
      subject: "Where is the online session link?",
      body: "Looking forward to our session. Where will I find the joining link?",
      status: "Draft ready",
      reply:
        "Hi James, your joining link is included in your booking confirmation. If it hasn’t arrived, I can help you find it before the session.",
      messages: [],
    },
  ],
  tasks: [
    { id: "t1", text: "Reply to Sophie’s first enquiry", done: false },
    { id: "t2", text: "Confirm Thursday’s booking", done: false },
    { id: "t3", text: "Review the new welcome page", done: false },
    { id: "t4", text: "Update next week’s availability", done: true },
  ],
  sources: [
    {
      id: "k1",
      title: "Booking & cancellation policy",
      kind: "Notion",
      audience: "Public",
      status: "Ready",
      version: 2,
      content:
        "Clients can reschedule or cancel without charge with at least 24 hours’ notice. Changes within 24 hours are reviewed personally by Amelia. First conversations are free and last 20 minutes. Refunds always need Amelia’s approval.",
    },
    {
      id: "k2",
      title: "Your first visit",
      kind: "Document",
      audience: "Public",
      status: "Ready",
      version: 1,
      content:
        "Please arrive five minutes before your session. Wear comfortable clothing. A reflexology session lasts 60 minutes and costs £65. The practice is in Bristol. Online session links are included in the booking confirmation.",
    },
    {
      id: "k3",
      title: "Practice voice & support guide",
      kind: "Notion",
      audience: "Team only",
      status: "Needs sync",
      version: 1,
      content:
        "Use a warm, direct tone. Ask one question at a time. Hand clinical questions to Amelia. Never promise treatment outcomes. Sensitive changes need a person to review them.",
    },
  ],
  approvals: [
    {
      id: "a1",
      title: "Review a refund request",
      detail:
        "James has requested a £50 refund for an earlier online session. Check the circumstances before making a decision.",
      type: "refund",
      paymentId: "p2",
      amount: 50,
      status: "Pending",
    },
  ],
  payments: [
    {
      id: "p1",
      clientId: "c1",
      description: "Reflexology · 8 September",
      amount: 65,
      status: "Paid",
    },
    {
      id: "p2",
      clientId: "c2",
      description: "Online session · 8 September",
      amount: 50,
      status: "Paid",
    },
    {
      id: "p3",
      clientId: "c1",
      description: "Reflexology · 10 September",
      amount: 65,
      status: "Pending",
    },
  ],
  tickets: [
    {
      id: "ST-12",
      title: "Help me tidy up my booking page",
      status: "In progress",
      messages: [
        "Amelia: I’d like the first conversation to be easier to find.",
        "Rick: Absolutely. I’ll bring it to the top and make the wording clearer. You can review it before it goes live.",
      ],
    },
  ],
  priorities: {},
  featureNotes: {},
  connections: {
    Notion: true,
    Stripe: true,
    Shopify: false,
    Calendar: true,
    Linear: true,
  },
  activity: [
    "09:02 · Lucy’s payment recorded",
    "08:45 · Booking knowledge synced",
    "Yesterday · Rick updated your welcome page",
  ],
  published: false,
  products: [
    { id: "pr1", name: "A moment of calm · journal", price: 18, stock: 12 },
    { id: "pr2", name: "Gift a reflexology session", price: 65, stock: 50 },
  ],
  orders: [
    {
      id: "OH-1042",
      clientId: "c1",
      item: "A moment of calm · journal",
      status: "Processing",
    },
  ],
  chatHistory: [],
  setupStep: 0,
  setupDescription:
    "I run a small reflexology practice in Bristol. I offer one-to-one sessions and introductory calls. Most enquiries arrive by email and my diary is in a spreadsheet.",
  release: "2026.09.08.1",
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
export const uid = () => Math.random().toString(36).slice(2, 10);
