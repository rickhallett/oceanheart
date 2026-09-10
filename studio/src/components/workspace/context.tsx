"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Avatar as ChakraAvatar,
  Badge,
  Button,
  Card,
  CloseButton,
  Dialog,
  EmptyState,
  Field as ChakraField,
  Flex,
  Portal,
  Spinner,
  Stack,
  Toast,
  Toaster,
  createToaster,
} from "@chakra-ui/react";
import { StudioSelect } from "@/components/studio-controls";
import { Check, ArrowUpRight } from "lucide-react";
import { initialState, type State, type View, type Priority } from "./model";
import { restoreState } from "./persisted-state";
const toaster = createToaster({ placement: "bottom-end", duration: 4500 });
const ModalActionContext = createContext(false);
// Keep earlier demo edits under their original key; this dataset has its own workspace.
const key = "oceanheart-studio-rick-demo-v1";
type Context = {
  state: State;
  update: (fn: (draft: State) => void, notice?: string) => void;
  open: (title: string, body: ReactNode, size?: DialogSize) => void;
  close: () => void;
  go: (view: View) => void;
  reset: () => void;
};
type DialogSize = "compact" | "form" | "reading" | "editor";
const dialogWidths = { compact: "400px", form: "480px", reading: "560px", editor: "640px" };
export const StudioContext = createContext<Context>(null!);
export const useStudio = () => useContext(StudioContext);
export function Provider({
  children,
  go,
}: {
  children: ReactNode;
  go: (v: View) => void;
}) {
  const [state, setState] = useState<State>(initialState);
  const [ready, setReady] = useState(false);
  const setToast = (description: string) =>
    toaster.create({ description, type: "success" });
  const [storageError, setStorageError] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [modal, setModal] = useState<{ title: string; body: ReactNode; size: DialogSize } | null>(
    null,
  );
  const close = useCallback(() => setModal(null), []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        let restored: State | null = null;
        try {
          restored = restoreState(JSON.parse(saved));
        } catch {
          /* Invalid JSON. */
        }
        if (restored) setState(restored);
        else {
          // Preserve the rejected snapshot for recovery before replacing demo state.
          localStorage.setItem(`${key}-recovery`, saved);
          setRecovered(true);
        }
      }
    } catch {
      setStorageError(true);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        setStorageError(true);
      }
  }, [state, ready]);
  function update(fn: (d: State) => void, notice?: string) {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
    if (notice) setToast(notice);
  }
  return (
    <StudioContext.Provider
      value={{
        state,
        update,
        go,
        open: (title, body, size = "form") => setModal({ title, body, size }),
        close,
        reset: () => {
          setState(structuredClone(initialState));
          setToast("Sample practice restored.");
        },
      }}
    >
      {ready ? (
        children
      ) : (
        <Stack align="center" justify="center" minH="100vh" w="full">
          <Spinner color="copper.400" />
          Opening your practice…
        </Stack>
      )}
      {recovered && (
        <div role="status" className="ws-storage">
          Saved practice data could not be restored. The sample practice has
          been loaded; the previous data is preserved in this browser for
          recovery.
        </div>
      )}
      {storageError && (
        <div className="ws-storage">
          This browser cannot save changes. Keep this tab open and export your
          roadmap before leaving.
        </div>
      )}
      <Portal>
        <Toaster toaster={toaster} width="min(384px, calc(100vw - 32px))">
          {(toast) => (
            <Toast.Root width="full" maxW="full">
              <Toast.Indicator />
              <Toast.Description minW="0" overflowWrap="anywhere">{toast.description}</Toast.Description>
              <Toast.CloseTrigger />
            </Toast.Root>
          )}
        </Toaster>
      </Portal>
      {modal && (
        <Modal title={modal.title} size={modal.size} onClose={close}>
          {modal.body}
        </Modal>
      )}
    </StudioContext.Provider>
  );
}
function Modal({
  size,
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  size: DialogSize;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      placement="center"
      scrollBehavior="inside"
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner p={{ base: 3, md: 6 }}>
          <Dialog.Content
            className="studio-dialog"
            width="full"
            maxWidth={dialogWidths[size]}
            data-dialog-size={size}
            bg="bg.panel"
            color="fg"
            borderWidth="control"
            borderColor="border"
            borderRadius="2xl"
          >
            <Dialog.Header>
              <Dialog.Title fontSize="2xl">{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton aria-label="Close dialog" size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body pb="6"><ModalActionContext.Provider value>{children}</ModalActionContext.Provider></Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card.Root
      as="section"
      className={`ws-panel ${className}`}
      bg="bg.panel"
      borderColor="border"
      borderRadius="xl"
      variant="outline"
    >
      {title && (
        <Card.Header
          className="ws-panel-heading"
          p="0"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Card.Title as="h2">{title}</Card.Title>
          {action}
        </Card.Header>
      )}
      {children}
    </Card.Root>
  );
}
export function Pill({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  const status = typeof children === "string" ? children : "";
  const statusTones: Record<string, string> = {
    Returning: "green", Active: "green", Confirmed: "green", Completed: "green",
    Paid: "green", Ready: "green", Replied: "green", Resolved: "green", Published: "green",
    New: "blue", "New enquiry": "blue", Open: "blue", "Draft ready": "blue",
    Pending: "amber", "In progress": "amber", "Needs sync": "amber", Escalated: "amber",
    Cancelled: "red", Failed: "red", Rejected: "red", Blocked: "red",
    Refunded: "neutral", Hidden: "neutral",
  };
  const resolvedTone = statusTones[status] || tone || "neutral";
  return (
    <Badge
      className="ws-pill"
      data-tone={resolvedTone}
      variant="subtle"
      colorPalette={
        tone === "green"
          ? "green"
          : tone === "red"
            ? "red"
            : tone === "amber"
              ? "orange"
              : "copper"
      }
      borderRadius="full"
    >
      {children}
    </Badge>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <EmptyState.Root className="ws-empty">
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Check size={26} />
        </EmptyState.Indicator>
        <EmptyState.Title as="h3">{title}</EmptyState.Title>
        <EmptyState.Description>{body}</EmptyState.Description>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}
export function Action({
  children,
  onClick,
  secondary = false,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const inModal = useContext(ModalActionContext);
  const { close } = useStudio();
  const button = (
    <Button
      colorPalette="copper"
      variant={secondary ? "outline" : "solid"}
      type={type}
      className={`ws-button ${secondary ? "secondary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
  return inModal && type === "submit" ? (
    <Flex className="ws-dialog-actions" gap="3" justify="flex-end" mt="6">
      <Button type="button" variant="outline" onClick={close}>Cancel</Button>
      {button}
    </Flex>
  ) : button;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <ChakraField.Root className="ws-field">
      <ChakraField.Label>{label}</ChakraField.Label>
      {children}
    </ChakraField.Root>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <ChakraAvatar.Root className="ws-avatar" size="sm" colorPalette="copper">
      <ChakraAvatar.Fallback name={name} />
    </ChakraAvatar.Root>
  );
}
export const priorities: Priority[] = [
  "Unsorted",
  "Essential",
  "Next",
  "Later",
  "Not needed",
];
export function FeatureVote({ view }: { view: View }) {
  const { state, update, go } = useStudio();
  return (
    <details className="ws-feature-feedback">
      <summary>Help shape this feature</summary>
      <div className="ws-feature-vote">
      <span>Does this belong in your first version?</span>
      <StudioSelect
        aria-label="Feature priority"
        value={state.priorities[view] || "Unsorted"}
        onChange={(e) =>
          update((d) => {
            d.priorities[view] = e.target.value as Priority;
          }, "Roadmap priority saved.")
        }
      >
        {priorities.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </StudioSelect>
      <Button variant="ghost" size="sm" onClick={() => go("roadmap")}>
        View roadmap <ArrowUpRight size={13} />
      </Button>
      </div>
    </details>
  );
}
