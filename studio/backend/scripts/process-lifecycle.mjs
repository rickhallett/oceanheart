// The CLI may exit before its native backend does. Its detached process group
// remains our responsibility even when ChildProcess.exitCode is already set.
export async function stopProcessGroup(child) {
  if (!child?.pid) return;
  const signal = (name) => {
    try {
      process.kill(-child.pid, name);
      return true;
    } catch (error) {
      if (error.code === "ESRCH") return false;
      throw error;
    }
  };
  if (!signal("SIGTERM")) return;
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    if (!signal(0)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  signal("SIGKILL");
}
