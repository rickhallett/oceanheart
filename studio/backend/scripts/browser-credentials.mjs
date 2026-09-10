// Disk projection for browser login only. Session tokens stay in runner memory.
export function browserCredentials({ runId, target, clientId, accounts }) {
  return {
    runId, target, clientId,
    accounts: accounts.map(({ role, email, password, userId }) => ({
      role, email, password, ...(userId ? { userId } : {}),
    })),
  };
}
