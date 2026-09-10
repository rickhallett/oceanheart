import styles from "./workspace-loading.module.css";

export function WorkspaceLoading({
  label = "Loading your workspace…",
  fullScreen = true,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  return (
    <div className={`${styles.root} ${fullScreen ? styles.fullScreen : styles.inline}`} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
