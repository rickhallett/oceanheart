import {
  demoClients,
  demoServices,
  demoEnquiries,
  demoTasks,
} from "../../../backend/convex/lib/demoData";
export const modules = [
  ["today", "Today", "Your day, at a glance"],
  ["inbox", "Enquiries", "Manage enquiries and replies"],
  ["calendar", "Bookings", "Manage appointments and availability"],
  ["clients", "Clients", "Client details and session history"],
  ["tasks", "Tasks", "Track and complete your tasks"],
  ["services", "Services", "The work you offer"],
  ["website", "Your website", "Edit your practice website"],
  ["knowledge", "Knowledge", "Manage documents and reference material"],
  ["assistant", "Assistant", "Draft responses and review suggested actions"],
  ["payments", "Payments", "Track payments and refunds"],
  ["shop", "Shop", "Manage products and orders"],
  [
    "portal",
    "Client portal",
    "Preview client appointments, messages and payments",
  ],
  ["support", "Support", "Requests and support conversations"],
  ["setup", "Setup", "Configure your practice"],
  ["settings", "Settings", "Practice details and connections"],
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
    citation?: Pick<
      Source,
      "id" | "title" | "version" | "content" | "audience"
    >;
    trace: string[];
  }[];
  setupStep: number;
  setupDescription: string;
  release: string;
};
export const demoDay = "2026-09-10";
const demoDate = (offset: number) =>
  new Date(Date.UTC(2026, 8, 10 + offset)).toISOString().slice(0, 10);
export const initialState: State = {
  practice: {
    name: "Rick Hallett — Demo Practice",
    owner: "Rick Hallett",
    email: "rick@example.com",
    modality: "Practical wellbeing & administrative reality checks",
    location: "The Fictional Rooms, Bristol & online",
    welcome:
      "A fictional practice for people whose productivity systems have become a second job. Come in, put the dashboard down, and take the hour you actually booked.",
    hours: "Monday to Friday, 09:00–17:00. Lunch has survived the roadmap.",
  },
  clients: demoClients.map(([name, background, note], i) => ({
    id: `c${i + 1}`,
    name,
    email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
    phone: `07700 900${String(100 + i)}`,
    status: i === 23 ? "Archived" : i % 4 === 0 ? "New" : "Returning",
    notes: ["Fictional demonstration client.", background, note],
  })),
  services: demoServices.map(([name, duration, price, description], i) => ({
    id: `s${i + 1}`,
    name,
    duration,
    price,
    description,
    active: i < 9,
  })),
  bookings: Array.from({ length: 48 }, (_, i) => ({
    id: `b${i + 1}`,
    clientId: `c${(i % 24) + 1}`,
    serviceId: `s${(i % 9) + 1}`,
    day: demoDate(Math.floor(i / 4) - 4),
    time: ["09:00", "11:00", "13:00", "15:00"][i % 4],
    status:
      i % 11 === 0
        ? "Cancelled"
        : i < 16
          ? "Completed"
          : i % 7 === 0
            ? "Awaiting payment"
            : "Confirmed",
  })),
  inbox: demoEnquiries.map(([subject, body, reply], i) => ({
    id: `m${i + 1}`,
    clientId: `c${i === 19 ? 24 : i + 1}`,
    subject,
    body,
    status: i > 16 ? "Replied" : reply ? "Draft ready" : "New",
    reply,
    messages:
      i > 16
        ? [
            "Rick: Thanks for your enquiry. This fictional conversation is resolved; no email has been sent.",
          ]
        : [],
  })),
  tasks: demoTasks.map((text, i) => ({
    id: `t${i + 1}`,
    text,
    done: i % 5 === 0,
  })),
  sources: [
    {
      id: "k1",
      title: "Booking & cancellation policy",
      kind: "Document",
      audience: "Public",
      status: "Ready",
      version: 2,
      content:
        "Fictional demo policy: cancel or reschedule with at least 24 hours' notice. Later changes are reviewed by Rick. First conversations are free and last 20 minutes. Refunds require Rick's approval. Mercury being in retrograde does not change the clock, although we appreciate the context.",
    },
    {
      id: "k2",
      title: "Your first visit",
      kind: "Document",
      audience: "Public",
      status: "Ready",
      version: 1,
      content:
        "The fictional practice is in Bristol and online. Arrive five minutes before your appointment. Wear comfortable clothing and bring yourself. No journal, personal brand or three-year vision is required. The Unoptimised Hour is 60 minutes and £65. Online joining links are in booking confirmations.",
    },
    {
      id: "k3",
      title: "Practice voice & support guide",
      kind: "Notion",
      audience: "Team only",
      status: "Ready",
      version: 2,
      content:
        "Be kind, concrete and brief. The jokes belong to the fictional demo, not to real clients' vulnerabilities. Never promise clinical outcomes. Escalate sensitive questions to Rick. If a reply contains transformational journey twice, make some tea and start again.",
    },
    {
      id: "k4",
      title: "The all-in-one manifesto, abridged",
      kind: "Document",
      audience: "Team only",
      status: "Ready",
      version: 1,
      content:
        "The app should help a person answer an enquiry, book a session and get on with their day. It does not need to become their lifestyle. Any feature proposing to optimise the feeling of having too many features must first survive a short walk outside.",
    },
    {
      id: "k5",
      title: "Payments in this demonstration",
      kind: "Document",
      audience: "Public",
      status: "Ready",
      version: 1,
      content:
        "All clients, invoices and transactions in this demo are fictional. No payments are collected and no messages are sent. The paid badges demonstrate interface states; they are not provider receipts.",
    },
    {
      id: "k6",
      title: "Availability notes",
      kind: "Notion",
      audience: "Team only",
      status: "Needs sync",
      version: 1,
      content:
        "Working hours are Monday to Friday, 09:00 to 17:00 in Europe/London. Leave time for lunch. A free rectangle in the calendar is not a moral failure.",
    },
  ],
  approvals: [
    {
      id: "a1",
      title: "Review Cressida's fictional refund",
      detail:
        "Cressida has requested a refund after a change of plans. Review the circumstances; do not automate sympathy or payments.",
      type: "refund",
      paymentId: "p2",
      amount: 65,
      status: "Pending",
    },
  ],
  payments: Array.from({ length: 24 }, (_, i) => ({
    id: `p${i + 1}`,
    clientId: `c${i + 1}`,
    description: `Demo: ${demoServices[i % 9][0]}`,
    amount: demoServices[i % 9][2],
    status: i === 22 ? "Refunded" : i % 4 === 0 ? "Pending" : "Paid",
  })),
  tickets: [
    {
      id: "ST-42",
      title: "The all-in-one app has become two apps",
      status: "Resolved",
      messages: [
        "Rick: I appear to have commissioned a second application while trying to improve the first.",
        "Support: Precision is now the only development target. The alternate universe has been closed for maintenance.",
      ],
    },
    {
      id: "ST-43",
      title: "Please make navigation feel like navigation",
      status: "Resolved",
      messages: [
        "Rick: Why do I have time to reconsider my career between Clients and Tasks?",
        "Support: We stopped rebuilding the authenticated shell on every click. The pause was implementation, not mindfulness.",
      ],
    },
    {
      id: "ST-44",
      title: "Request: fewer buttons having a group hug",
      status: "Resolved",
      messages: [
        "Rick: The enquiry actions have formed a dense social cluster.",
        "Support: Spacing restored. Each button now has enough personal space to make a decision.",
      ],
    },
    {
      id: "ST-45",
      title: "The fern would like dark mode",
      status: "Open",
      messages: [
        "Barnaby: Our head of culture has some feedback.",
        "Rick: Please establish whether this is a product requirement or a watering issue.",
      ],
    },
  ],
  priorities: {
    inbox: "Essential",
    calendar: "Essential",
    clients: "Essential",
    tasks: "Essential",
    services: "Essential",
    assistant: "Later",
    shop: "Later",
  },
  featureNotes: {
    tasks:
      "Let me finish a task before asking me to design a productivity philosophy.",
    calendar:
      "A reliable booking beats an ambitious diagram of a reliable booking.",
  },
  connections: {
    Notion: false,
    Stripe: false,
    Shopify: false,
    Calendar: false,
    Linear: false,
  },
  activity: [
    "Demo · Navigation stopped taking a contemplative pause",
    "Demo · Lunch successfully defended from a strategy session",
    "Demo · Twenty-four entirely fictional clients arrived without a CRM migration",
  ],
  published: false,
  products: [
    { id: "pr1", name: "The Good Enough Notebook", price: 12, stock: 24 },
    {
      id: "pr2",
      name: "A meeting that could have been tea — mug",
      price: 16,
      stock: 18,
    },
    {
      id: "pr3",
      name: "Premium whitespace, pocket edition",
      price: 8,
      stock: 40,
    },
    { id: "pr4", name: "Gift an Unoptimised Hour", price: 65, stock: 50 },
  ],
  orders: [
    {
      id: "DEMO-1042",
      clientId: "c3",
      item: "The Good Enough Notebook",
      status: "Processing",
    },
    {
      id: "DEMO-1043",
      clientId: "c12",
      item: "A meeting that could have been tea — mug",
      status: "Dispatched",
    },
  ],
  chatHistory: [],
  setupStep: 0,
  setupDescription:
    "Rick Hallett's fictional demonstration practice offers practical wellbeing sessions, introductory calls and a modest resistance to productivity theatre. Enquiries, appointments, tasks and records should work together without becoming a second job.",
  release: "2026.09.10.rick-demo.1",
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
export const uid = () => Math.random().toString(36).slice(2, 10);
