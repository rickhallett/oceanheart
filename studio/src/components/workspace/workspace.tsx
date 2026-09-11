"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Breadcrumb,
  Button,
  CloseButton,
  Combobox,
  createListCollection,
  Dialog,
  Drawer,
  Flex,
  Heading,
  IconButton,
  Kbd,
  Portal as ChakraPortal,
  Stack,
  Text,
} from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  ArrowUpRight,
  Search,
} from "lucide-react";
import { Mark } from "../ui";
import { modules, type View } from "./model";
import { Provider, useStudio, Avatar } from "./context";
import { Today, Inbox, Calendar, Clients, Tasks, Services } from "./practice";
import { Knowledge, Assistant } from "./intelligence";
import {
  Website,
  Payments,
  Shop,
  Support,
  Setup,
  Settings,
  Roadmap,
  Portal,
} from "./business";
import "./workspace.css";
import "./shell-chakra.css";
import "./precision.css";
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
  roadmap: Roadmap,
};
export function Workspace({ demo = false }: { demo?: boolean }) {
  const path = usePathname();
  const view = (path.split("/")[2] || "today") as View;
  const safeView = modules.some((m) => m[0] === view) ? view : "today";
  return (
    <div className="ws-root">
      <Provider
        go={(v) => {
          window.history.pushState(
            null,
            "",
            `${v === "today" ? "/app" : `/app/${v}`}${demo ? "?demo=1" : ""}`,
          );
          window.scrollTo(0, 0);
        }}
      >
        <Shell view={safeView} demo={demo} />
      </Provider>
    </div>
  );
}
export type LiveShell = {
  practiceName: string;
  ownerName: string;
  role: string;
  go: (view: View) => void;
  href?: (view: View) => string;
  picker?: ReactNode;
  account?: ReactNode;
  content: ReactNode;
};
export function Shell({
  view,
  live,
  demo = false,
}: {
  view: View;
  live?: LiveShell;
  demo?: boolean;
}) {
  const studio = useStudio();
  const go = live?.go ?? studio.go;
  const practiceName = live?.practiceName ?? studio.state.practice.name;
  const ownerName = live?.ownerName ?? studio.state.practice.owner;
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuClose = useRef<HTMLButtonElement>(null);
  const featureCollection = createListCollection({
    items: modules
      .filter((m) =>
        (m[1] + " " + m[2]).toLowerCase().includes(query.toLowerCase()),
      )
      .map(([value, label, description]) => ({ value, label, description })),
  });
  const Screen = screens[view];
  const title = modules.find((m) => m[0] === view)!;
  const liveDescriptions: Partial<Record<View, string>> = {
    payments: "Payment actions for your bookings",
    support: "Guidance and a way to get in touch",
    website: "Your practice online",
    portal: "The next step in client self-service",
    shop: "Products and services for your practice",
  };
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
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLElement>(
          '.studio-sidebar a[aria-current="page"], .studio-drawer a[aria-current="page"]',
        )
        .forEach((link) => {
          if (link.getClientRects().length)
            link.scrollIntoView({ block: "nearest" });
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [view, menu]);
  const navigation = (
    <>
      <Link className="ws-brand" href="/">
        <Mark />
        <span>
          oceanheart<small>STUDIO</small>
        </span>
      </Link>
      <div className="ws-practice-identity">
        <span className="ws-practice-monogram">{practiceName[0]}</span>
        <div>
          <strong>{practiceName}</strong>
          <small>Practice workspace</small>
        </div>
      </div>
      {live?.picker}
      <nav aria-label="Practice navigation">
        {[
          {
            label: "WORKSPACE",
            ids: ["today", "inbox", "calendar", "clients", "tasks"],
          },
          {
            label: "MANAGEMENT",
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
            label: "ADMINISTRATION",
            ids: ["support", "setup", "settings", "roadmap"],
          },
        ].map((group) => (
          <div
            className={`ws-nav-group ${group.label === "WORKSPACE" ? "studio-nav-primary" : group.label === "ADMINISTRATION" ? "studio-nav-secondary" : ""}`}
            key={group.label}
          >
            <p>{group.label}</p>
            {group.ids.map((id) => {
              const key = id as View;
              const Icon = icons[key];
              return (
                <Button
                  asChild
                  variant="ghost"
                  justifyContent="flex-start"
                  w="full"
                  key={id}
                >
                  <Link
                    onClick={(event) => {
                      setMenu(false);
                      if (
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey &&
                        event.button === 0
                      ) {
                        event.preventDefault();
                        go(id as View);
                      }
                    }}
                    href={
                      live?.href?.(id as View) ??
                      `${id === "today" ? "/app" : `/app/${id}`}${demo ? "?demo=1" : ""}`
                    }
                    aria-current={view === id ? "page" : undefined}
                  >
                    <Icon size={17} strokeWidth={1.5} />
                    <span>{modules.find((m) => m[0] === id)![1]}</span>
                    {!live && id === "inbox" && (
                      <small>
                        {
                          studio.state.inbox.filter((m) => m.status === "New")
                            .length
                        }
                      </small>
                    )}
                    {!live &&
                      id === "assistant" &&
                      studio.state.approvals.some(
                        (a) => a.status === "Pending",
                      ) && <i />}
                  </Link>
                </Button>
              );
            })}
          </div>
        ))}
      </nav>
      <Button
        variant="ghost"
        height="auto"
        className="ws-user"
        onClick={() => go("settings")}
      >
        <Avatar name={ownerName} />
        <div>
          <strong>{ownerName}</strong>
          <small>{live ? live.role : "Practice owner · sample"}</small>
        </div>
      </Button>
      {live?.account}
    </>
  );
  return (
    <>
      <a className="ws-skip" href="#workspace-main">
        Skip to workspace
      </a>
      <Box
        as="aside"
        className="studio-sidebar"
        display={{ base: "none", lg: "flex" }}
        aria-label="Practice navigation"
      >
        {navigation}
      </Box>
      <Drawer.Root
        open={menu}
        onOpenChange={(details) => setMenu(details.open)}
        placement="start"
        size="xs"
        initialFocusEl={() => menuClose.current}
        finalFocusEl={() => menuTrigger.current}
      >
        <ChakraPortal>
          <Drawer.Backdrop animation="none" />
          <Drawer.Positioner>
            <Drawer.Content
              className="studio-drawer"
              animation="none"
              bg="bg.panel"
              color="fg"
            >
              <Drawer.Header pb="0">
                <Drawer.Title>Practice navigation</Drawer.Title>
              </Drawer.Header>
              <Drawer.CloseTrigger asChild>
                <CloseButton
                  ref={menuClose}
                  aria-label="Close navigation"
                  size="sm"
                />
              </Drawer.CloseTrigger>
              <Drawer.Body
                p="0"
                display="flex"
                flexDirection="column"
                overflow="hidden"
              >
                {navigation}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </ChakraPortal>
      </Drawer.Root>
      <Box
        className="studio-body"
        ml={{ base: 0, lg: "224px" }}
        minW="0"
        flex="1"
      >
        <Flex
          as="header"
          className="studio-topbar"
          align="center"
          justify="space-between"
          gap="3"
          px={{ base: 4, md: 8 }}
        >
          <Flex align="center" gap="3" minW="0">
            <IconButton
              ref={menuTrigger}
              display={{ base: "inline-flex", lg: "none" }}
              variant="ghost"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </IconButton>
            <Breadcrumb.Root>
              <Breadcrumb.List>
                <Breadcrumb.Item>
                  <Breadcrumb.CurrentLink color="fg.muted">
                    Your practice
                  </Breadcrumb.CurrentLink>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.CurrentLink color="fg">
                    {title[1]}
                  </Breadcrumb.CurrentLink>
                </Breadcrumb.Item>
              </Breadcrumb.List>
            </Breadcrumb.Root>
          </Flex>
          <Flex align="center" gap="4">
            <Button
              variant="outline"
              size="sm"
              ref={searchTrigger}
              aria-label="Find anything"
              aria-expanded={search}
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <Text as="span" display={{ base: "none", md: "inline" }}>
                Find anything
              </Text>
              <Kbd display={{ base: "none", md: "inline" }}>⌘ K</Kbd>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              display={{ base: "none", md: "inline-flex" }}
            >
              <Link href="https://www.oceanheart.ai/studio">
                About Studio <ArrowUpRight size={14} />
              </Link>
            </Button>
          </Flex>
        </Flex>
        <Dialog.Root
          open={search}
          onOpenChange={(details) => setSearch(details.open)}
          initialFocusEl={() => searchInput.current}
          finalFocusEl={() => searchTrigger.current}
          motionPreset="none"
          placement="top"
          scrollBehavior="inside"
          size="lg"
        >
          <ChakraPortal>
            <Dialog.Backdrop />
            <Dialog.Positioner p="4">
              <Dialog.Content
                bg="bg.panel"
                color="fg"
                borderRadius="2xl"
                borderWidth="2px"
                borderColor="border"
              >
                <Dialog.Header>
                  <Dialog.Title>Find anything</Dialog.Title>
                </Dialog.Header>
                <Dialog.CloseTrigger asChild>
                  <CloseButton aria-label="Close search" size="sm" />
                </Dialog.CloseTrigger>
                <Dialog.Body pb="6">
                  <Combobox.Root
                    collection={featureCollection}
                    inputValue={query}
                    onInputValueChange={(details) =>
                      setQuery(details.inputValue)
                    }
                    open
                    // Results are inline; the enclosing dialog owns dismissal.
                    disableLayer
                    loopFocus
                    selectionBehavior="preserve"
                    onValueChange={(details) => {
                      const target = details.value[0] as View;
                      if (target) {
                        setSearch(false);
                        go(target);
                      }
                    }}
                  >
                    <Combobox.Control>
                      <Combobox.Input
                        className="studio-feature-search"
                        onKeyDownCapture={(event) => {
                          if (event.key === "Escape") setSearch(false);
                        }}
                        ref={searchInput}
                        aria-label="Find a workspace feature"
                        placeholder="Find a feature…"
                      />
                    </Combobox.Control>
                    <Combobox.Content
                      position="static"
                      boxShadow="none"
                      bg="transparent"
                      maxH="55vh"
                      mt="3"
                      p="0"
                      overflowY="auto"
                    >
                      <Combobox.List>
                        {featureCollection.items.map((item) => (
                          <Combobox.Item
                            key={item.value}
                            item={item}
                            py="3"
                            px="3"
                            borderRadius="lg"
                            cursor="pointer"
                            _highlighted={{ bg: "bg.subtle", color: "fg" }}
                          >
                            <Stack gap="1">
                              <Combobox.ItemText fontWeight="semibold">
                                {item.label}
                              </Combobox.ItemText>
                              <Text fontSize="sm" color="fg.muted">
                                {item.description}
                              </Text>
                            </Stack>
                            <ArrowUpRight size={16} />
                          </Combobox.Item>
                        ))}
                      </Combobox.List>
                      <Combobox.Empty color="fg.muted" py="6">
                        No features found. Try a shorter word, or search for
                        clients, bookings or payments.
                      </Combobox.Empty>
                    </Combobox.Content>
                  </Combobox.Root>
                </Dialog.Body>
              </Dialog.Content>
            </Dialog.Positioner>
          </ChakraPortal>
        </Dialog.Root>
        <main id="workspace-main" className="ws-main" tabIndex={-1}>
          {view !== "today" &&
            !(live && ["knowledge", "assistant"].includes(view)) && (
              <Stack className="ws-page-heading" gap="2">
                <Heading as="h1" fontSize={{ base: "3xl", md: "4xl" }}>
                  {title[1]}
                </Heading>
                <Text color="fg.muted">
                  {(live && liveDescriptions[view]) || title[2]}
                </Text>
              </Stack>
            )}
          {live ? live.content : <Screen />}
        </main>
        <footer className="ws-footer">
          <a href="https://www.oceanheart.ai/studio">About Studio</a>
        </footer>
      </Box>
    </>
  );
}
