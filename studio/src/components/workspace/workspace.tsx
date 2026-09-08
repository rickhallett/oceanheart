"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  Inbox as InboxIcon,
  CalendarDays,
  Users,
  SquareCheck,
  Flower2,
  Globe,
  BookOpen,
  Sparkles,
  CreditCard,
  ShoppingBag,
  Heart,
  SlidersHorizontal,
  Map,
  Layers,
  Menu,
  X,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { Mark } from "../ui";
import { modules, type View } from "./model";
import { Provider, useStudio, FeatureVote, Action, Avatar } from "./context";
import {
  Today,
  Inbox,
  Calendar,
  Clients,
  Tasks,
  Services,
  BookingForm,
} from "./practice";
import { Knowledge, Assistant } from "./intelligence";
import {
  Website,
  Payments,
  Shop,
  Support,
  Setup,
  Settings,
  Roadmap,
  Operations,
  Portal,
} from "./business";
import "./workspace.css";
const icons = {
  portal: Users,
  today: House,
  inbox: InboxIcon,
  calendar: CalendarDays,
  clients: Users,
  tasks: SquareCheck,
  services: Flower2,
  website: Globe,
  knowledge: BookOpen,
  assistant: Sparkles,
  payments: CreditCard,
  shop: ShoppingBag,
  support: Heart,
  setup: Layers,
  settings: SlidersHorizontal,
  operations: Layers,
  roadmap: Map,
};
const screens = {
  portal: Portal,
  today: Today,
  inbox: Inbox,
  calendar: Calendar,
  clients: Clients,
  tasks: Tasks,
  services: Services,
  website: Website,
  knowledge: Knowledge,
  assistant: Assistant,
  payments: Payments,
  shop: Shop,
  support: Support,
  setup: Setup,
  settings: Settings,
  operations: Operations,
  roadmap: Roadmap,
};
export function Workspace() {
  const router = useRouter();
  const path = usePathname();
  const view = (path.split("/")[2] || "today") as View;
  const safeView = modules.some((m) => m[0] === view) ? view : "today";
  return (
    <div className="ws-root">
      <Provider go={(v) => router.push(v === "today" ? "/app" : `/app/${v}`)}>
        <Shell view={safeView} />
      </Provider>
    </div>
  );
}
function Shell({ view }: { view: View }) {
  const { state, go, open } = useStudio();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 700px)").matches,
  );
  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const sync = () => {
      setMobile(media.matches);
      setMenu(false);
    };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!mobile || !menu) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = drawer.current;
    const controls = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = controls();
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [mobile, menu]);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const Screen = screens[view];
  const title = modules.find((m) => m[0] === view)!;
  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [view]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  return (
    <>
      <a className="ws-skip" href="#workspace-main">
        Skip to workspace
      </a>
      {mobile && menu && (
        <button
          className="ws-mobile-backdrop"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        ref={drawer}
        id="practice-navigation"
        className={`ws-sidebar ${menu ? "open" : ""}`}
        inert={mobile && !menu}
        aria-hidden={mobile && !menu ? true : undefined}
        role={mobile && menu ? "dialog" : undefined}
        aria-modal={mobile && menu ? true : undefined}
        aria-label="Practice navigation"
      >
        {mobile && menu && (
          <button
            className="ws-icon-button"
            aria-label="Close navigation"
            style={{ alignSelf: "flex-end", margin: "12px 12px 0" }}
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        )}
        <Link className="ws-brand" href="/">
          <Mark />
          <span>
            Oceanheart<small>STUDIO</small>
          </span>
        </Link>
        <div className="ws-practice-identity">
          <span className="ws-practice-monogram">{state.practice.name[0]}</span>
          <div>
            <strong>{state.practice.name}</strong>
            <small>Your practice workspace</small>
          </div>
        </div>
        <nav aria-label="Practice navigation">
          {[
            {
              label: "YOUR DAY",
              ids: ["today", "inbox", "calendar", "clients", "tasks"],
            },
            {
              label: "YOUR PRACTICE",
              ids: [
                "services",
                "website",
                "portal",
                "knowledge",
                "assistant",
                "payments",
                "shop",
              ],
            },
            {
              label: "WITH YOU",
              ids: ["support", "setup", "settings", "operations", "roadmap"],
            },
          ].map((group) => (
            <div className="ws-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.ids.map((id) => {
                const key = id as View;
                const Icon = icons[key];
                return (
                  <Link
                    key={id}
                    onClick={() => setMenu(false)}
                    href={id === "today" ? "/app" : `/app/${id}`}
                    aria-current={view === id ? "page" : undefined}
                  >
                    <Icon size={17} strokeWidth={1.5} />
                    <span>{modules.find((m) => m[0] === id)![1]}</span>
                    {id === "inbox" && (
                      <small>
                        {state.inbox.filter((m) => m.status === "New").length}
                      </small>
                    )}
                    {id === "assistant" &&
                      state.approvals.some((a) => a.status === "Pending") && (
                        <i />
                      )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <button className="ws-user" onClick={() => go("settings")}>
          <Avatar name={state.practice.owner} />
          <div>
            <strong>{state.practice.owner}</strong>
            <small>Practice owner · sample</small>
          </div>
        </button>
      </aside>
      <div className="ws-body" inert={mobile && menu}>
        <header className="ws-topbar">
          <button
            className="ws-menu-toggle"
            onClick={() => setMenu(!menu)}
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="practice-navigation"
          >
            <Menu size={21} />
          </button>
          <div className="ws-breadcrumb">
            Your practice <span>/</span> <strong>{title[1]}</strong>
          </div>
          <div className="ws-topbar-right">
            <button
              className="ws-search-trigger"
              aria-label="Find anything"
              aria-expanded={search}
              onClick={() => setSearch(!search)}
            >
              <Search size={16} />
              <span>Find anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="ws-demo-label">
              <i /> Interactive prototype
            </span>
            <Link href="/">
              The studio <ArrowUpRight size={14} />
            </Link>
          </div>
        </header>
        {search && (
          <div className="ws-command">
            <div className="ws-search">
              <Search size={18} />
              <input
                autoFocus
                aria-label="Find a workspace feature"
                placeholder="Find a feature…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="ws-icon-button"
                aria-label="Close search"
                onClick={() => setSearch(false)}
              >
                <X size={18} />
              </button>
            </div>
            {modules
              .filter((m) =>
                (m[1] + " " + m[2]).toLowerCase().includes(query.toLowerCase()),
              )
              .map(([id, name, description]) => (
                <button key={id} onClick={() => go(id)}>
                  <strong>{name}</strong>
                  <small>{description}</small>
                  <ArrowUpRight size={14} />
                </button>
              ))}
          </div>
        )}
        <main id="workspace-main" className="ws-main" tabIndex={-1}>
          <div className="ws-demo-note">
            A sample practice to explore. Changes stay in this browser. No
            messages, bookings or payments are sent.
          </div>
          {view !== "today" && (
            <div className="ws-page-heading">
              <h1>{title[1]}</h1>
              <p>{title[2]}</p>
            </div>
          )}
          <Screen />
          {view !== "roadmap" && <FeatureVote view={view} />}
        </main>
        <footer className="ws-footer">
          <span>Oceanheart Studio · thoughtfully put together</span>
          <button onClick={() => go("roadmap")}>
            Help shape what comes next <ArrowRightIcon />
          </button>
        </footer>
      </div>
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={13} />;
}
