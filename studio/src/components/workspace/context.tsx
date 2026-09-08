"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X, Check, ArrowUpRight } from "lucide-react";
import { initialState, type State, type View, type Priority } from "./model";
const key = "oceanheart-studio-workspace-v1";
type Context = {
  state: State;
  update: (fn: (draft: State) => void, notice?: string) => void;
  open: (title: string, body: ReactNode) => void;
  close: () => void;
  go: (view: View) => void;
  reset: () => void;
};
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
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [modal, setModal] = useState<{ title: string; body: ReactNode } | null>(
    null,
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        if (
          data.practice &&
          Array.isArray(data.clients) &&
          Array.isArray(data.bookings) &&
          data.priorities
        )
          setState({ ...structuredClone(initialState), ...data });
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
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
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
        open: (title, body) => setModal({ title, body }),
        close: () => setModal(null),
        reset: () => {
          setState(structuredClone(initialState));
          setToast("Sample practice restored.");
        },
      }}
    >
      {ready ? (
        children
      ) : (
        <div className="ws-loading">Opening your practice…</div>
      )}
      {storageError && (
        <div className="ws-storage">
          This browser cannot save changes. Keep this tab open and export your
          roadmap before leaving.
        </div>
      )}
      {toast && (
        <div role="status" className="ws-toast">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          {modal.body}
        </Modal>
      )}
    </StudioContext.Provider>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const root = ref.current;
    root?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && root) {
        const nodes = root.querySelectorAll<HTMLElement>(
          'button,a[href],input,select,textarea,[tabindex="0"]',
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === root)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="ws-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ws-modal"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="ws-icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
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
    <section className={`ws-panel ${className}`}>
      {title && (
        <header className="ws-panel-heading">
          <h2>{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function Pill({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`ws-pill ${tone}`}>{children}</span>;
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="ws-empty">
      <Check size={26} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
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
  return (
    <button
      type={type}
      className={`ws-button ${secondary ? "secondary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="ws-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="ws-avatar">
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
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
    <div className="ws-feature-vote">
      <span>Does this belong in your first version?</span>
      <select
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
      </select>
      <button onClick={() => go("roadmap")}>
        View roadmap <ArrowUpRight size={13} />
      </button>
    </div>
  );
}
