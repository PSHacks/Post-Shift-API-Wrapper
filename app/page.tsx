"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  label: string;
  hash: string;
  balance?: number;
  lastBalanceAt?: string;
};

type Mailbox = {
  key: string;
  email: string;
  accountId: string;
  livetime?: number;
  letters?: LetterSummary[];
};

type LetterSummary = {
  id: number;
  date: string;
  subject: string;
  from: string;
};

type LoadedMessage = {
  id: number;
  body: string;
};

const STORAGE_KEY = "post-shift-console-state-v1";
const PAID_ACTIONS = new Set(["new", "getlist", "getmail", "update"]);

type StoredState = {
  accounts: Account[];
  mailboxes: Mailbox[];
  activeAccountId?: string;
  activeMailboxKey?: string;
};

async function callPostShift<T>(params: Record<string, string | number | boolean | undefined>) {
  const response = await fetch("/api/post-shift", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params)
  });
  const payload = (await response.json()) as { data?: T; error?: string; message?: string };

  if (!response.ok || payload.error) {
    throw new Error(payload.message || payload.error || "API request failed");
  }

  return payload.data as T;
}

function accountLabel(hash: string) {
  return `Hash ${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function normalizeMailbox(input: unknown, accountId: string): Mailbox[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is { key: string; mail: string } => {
      return Boolean(item && typeof item === "object" && "key" in item && "mail" in item);
    })
    .map((item) => ({ key: item.key, email: item.mail, accountId }));
}

function isLetterArray(input: unknown): input is LetterSummary[] {
  return (
    Array.isArray(input) &&
    input.every((item) => {
      return (
        item &&
        typeof item === "object" &&
        typeof (item as LetterSummary).id === "number" &&
        typeof (item as LetterSummary).subject === "string" &&
        typeof (item as LetterSummary).from === "string"
      );
    })
  );
}

function safeMessageHtml(body: string) {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" rel="noreferrer noopener" target="_blank">$1</a>'
  );

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src 'none'; connect-src 'none'; frame-src 'none'; script-src 'none'; base-uri 'none'; form-action 'none'">
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        padding: 18px;
        background: #0c0d10;
        color: #eff4ff;
        font: 14px/1.58 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      a { color: #7cc7ff; word-break: break-word; }
      pre {
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-family: inherit;
      }
    </style>
  </head>
  <body><pre>${linked}</pre></body>
</html>`;
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>("");
  const [activeMailboxKey, setActiveMailboxKey] = useState<string>("");
  const [message, setMessage] = useState<LoadedMessage | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [toast, setToast] = useState("");
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [loginHash, setLoginHash] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [recoverEmail, setRecoverEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [domain, setDomain] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const state = JSON.parse(raw) as StoredState;
      setAccounts(state.accounts || []);
      setMailboxes(state.mailboxes || []);
      setActiveAccountId(state.activeAccountId || state.accounts?.[0]?.id || "");
      setActiveMailboxKey(state.activeMailboxKey || state.mailboxes?.[0]?.key || "");
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const state: StoredState = { accounts, mailboxes, activeAccountId, activeMailboxKey };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [accounts, mailboxes, activeAccountId, activeMailboxKey]);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) || accounts[0],
    [accounts, activeAccountId]
  );

  const accountMailboxes = useMemo(
    () => mailboxes.filter((box) => box.accountId === activeAccount?.id),
    [mailboxes, activeAccount?.id]
  );

  const activeMailbox = useMemo(
    () => accountMailboxes.find((box) => box.key === activeMailboxKey) || accountMailboxes[0],
    [accountMailboxes, activeMailboxKey]
  );

  useEffect(() => {
    if (activeAccount && activeAccount.id !== activeAccountId) setActiveAccountId(activeAccount.id);
    if (activeMailbox && activeMailbox.key !== activeMailboxKey) setActiveMailboxKey(activeMailbox.key);
  }, [activeAccount, activeAccountId, activeMailbox, activeMailboxKey]);

  function showToast(value: string) {
    setToast(value);
    window.setTimeout(() => setToast(""), 3200);
  }

  function mergeMailbox(nextBox: Mailbox) {
    setMailboxes((current) => {
      const exists = current.some((box) => box.key === nextBox.key);
      if (exists) {
        return current.map((box) => (box.key === nextBox.key ? { ...box, ...nextBox } : box));
      }
      return [nextBox, ...current];
    });
    setActiveMailboxKey(nextBox.key);
  }

  async function guarded<T>(name: string, action: string, run: () => Promise<T>) {
    setBusy(name);
    try {
      const result = await run();
      return result;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Что-то пошло не так");
      return undefined;
    } finally {
      setBusy("");
    }
  }

  function addAccount(hash: string, label?: string) {
    const trimmed = hash.trim();
    if (!trimmed) return;
    const id = trimmed;
    setAccounts((current) => {
      if (current.some((account) => account.hash === trimmed)) return current;
      return [...current, { id, hash: trimmed, label: label || accountLabel(trimmed) }];
    });
    setActiveAccountId(id);
    setLoginHash("");
  }

  async function refreshBalance(account = activeAccount) {
    if (!account) return;
    await guarded("balance", "balance", async () => {
      const data = await callPostShift<{ limit?: number }>({ action: "balance", hash: account.hash });
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id
            ? { ...item, balance: Number(data?.limit ?? 0), lastBalanceAt: new Date().toISOString() }
            : item
        )
      );
    });
  }

  async function importKeys() {
    if (!activeAccount) return;
    await guarded("getkeys", "getkeys", async () => {
      const data = await callPostShift<unknown>({ action: "getkeys", hash: activeAccount.hash });
      const imported = normalizeMailbox(data, activeAccount.id);
      if (!imported.length) {
        showToast("Активных ящиков не найдено");
        return;
      }
      setMailboxes((current) => {
        const withoutDuplicates = current.filter((box) => !imported.some((next) => next.key === box.key));
        return [...imported, ...withoutDuplicates];
      });
      setActiveMailboxKey(imported[0].key);
      showToast(`Импортировано: ${imported.length}`);
    });
  }

  async function createMailbox(event: FormEvent) {
    event.preventDefault();
    if (!activeAccount) return;
    await guarded("new", "new", async () => {
      const data = await callPostShift<{ email?: string; key?: string }>({
        action: "new",
        hash: activeAccount.hash,
        name: newName.trim() || undefined,
        domain: domain || undefined
      });
      if (!data?.email || !data?.key) throw new Error("API не вернул email/key");
      mergeMailbox({ email: data.email, key: data.key, accountId: activeAccount.id });
      setMessage(null);
      setNewName("");
      refreshBalance(activeAccount);
    });
  }

  async function refreshInbox() {
    if (!activeAccount || !activeMailbox) return;
    await guarded("getlist", "getlist", async () => {
      const data = await callPostShift<unknown>({
        action: "getlist",
        hash: activeAccount.hash,
        key: activeMailbox.key
      });
      const letters = isLetterArray(data) ? data : [];
      setMailboxes((current) =>
        current.map((box) => (box.key === activeMailbox.key ? { ...box, letters } : box))
      );
      setMessage(null);
      refreshBalance(activeAccount);
    });
  }

  async function openLetter(letter: LetterSummary) {
    if (!activeAccount || !activeMailbox) return;
    await guarded(`getmail-${letter.id}`, "getmail", async () => {
      const data = await callPostShift<{ message?: string }>({
        action: "getmail",
        hash: activeAccount.hash,
        key: activeMailbox.key,
        id: letter.id,
        cut: "html",
        base64: "decode"
      });
      setMessage({ id: letter.id, body: String(data?.message || "") });
      refreshBalance(activeAccount);
    });
  }

  async function refreshLife() {
    if (!activeMailbox) return;
    await guarded("livetime", "livetime", async () => {
      const data = await callPostShift<{ livetime?: string; error?: string }>({
        action: "livetime",
        key: activeMailbox.key
      });
      if (data?.error) throw new Error(data.error);
      setMailboxes((current) =>
        current.map((box) =>
          box.key === activeMailbox.key ? { ...box, livetime: Number(data?.livetime || 0) } : box
        )
      );
    });
  }

  async function extendMailbox() {
    if (!activeAccount || !activeMailbox) return;
    await guarded("update", "update", async () => {
      const data = await callPostShift<{ livetime?: string }>({
        action: "update",
        hash: activeAccount.hash,
        key: activeMailbox.key
      });
      setMailboxes((current) =>
        current.map((box) =>
          box.key === activeMailbox.key ? { ...box, livetime: Number(data?.livetime || 0) } : box
        )
      );
      refreshBalance(activeAccount);
    });
  }

  async function clearMailbox() {
    if (!activeMailbox) return;
    await guarded("clear", "clear", async () => {
      await callPostShift({ action: "clear", key: activeMailbox.key });
      setMailboxes((current) =>
        current.map((box) => (box.key === activeMailbox.key ? { ...box, letters: [] } : box))
      );
      setMessage(null);
    });
  }

  async function deleteMailbox() {
    if (!activeMailbox) return;
    await guarded("delete", "delete", async () => {
      await callPostShift({ action: "delete", key: activeMailbox.key });
      setMailboxes((current) => current.filter((box) => box.key !== activeMailbox.key));
      setMessage(null);
    });
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    await guarded("reg", "reg", async () => {
      const data = await callPostShift<{ hash?: string }>({ action: "reg", email: registerEmail.trim() });
      if (data?.hash) {
        addAccount(data.hash, registerEmail.trim());
        showToast("Hash добавлен. Подтверди email по письму.");
      }
    });
  }

  async function recover(action: "hash" | "getverify") {
    await guarded(action, action, async () => {
      await callPostShift({ action, email: recoverEmail.trim() });
      showToast(action === "hash" ? "Hash отправлен на почту" : "Ссылка подтверждения отправлена");
    });
  }

  function logout() {
    setActiveAccountId("");
    setActiveMailboxKey("");
    setMessage(null);
  }

  function removeAccount(id: string) {
    setAccounts((current) => current.filter((account) => account.id !== id));
    setMailboxes((current) => current.filter((box) => box.accountId !== id));
    if (activeAccountId === id) {
      setActiveAccountId("");
      setActiveMailboxKey("");
    }
  }

  const hasAccounts = accounts.length > 0 && Boolean(activeAccount);
  const messageHtml = message ? safeMessageHtml(message.body) : "";

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Post-Shift.Ru</p>
          <h1>Temporary Mail Console</h1>
        </div>
        <div className="top-actions">
          {activeAccount ? (
            <select value={activeAccount.id} onChange={(event) => setActiveAccountId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          ) : null}
          {hasAccounts ? (
            <>
              <button type="button" onClick={() => setSettingsOpen(true)}>
                Настройки
              </button>
              <button type="button" className="ghost" onClick={logout}>
                Logout
              </button>
            </>
          ) : null}
        </div>
      </section>

      {!hasAccounts ? (
        <section className="auth-center">
          <div className="tile auth-card">
            <div className="tabbox" role="tablist" aria-label="Авторизация">
              <button
                type="button"
                role="tab"
                aria-selected={authTab === "login"}
                className={authTab === "login" ? "active" : ""}
                onClick={() => setAuthTab("login")}
              >
                Вход
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === "register"}
                className={authTab === "register" ? "active" : ""}
                onClick={() => setAuthTab("register")}
              >
                Регистрация
              </button>
            </div>

            {authTab === "login" ? (
              <form
                className="auth-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  addAccount(loginHash);
                }}
              >
                <span className="tile-label">Post-Shift.Ru</span>
                <h2>Добавить API hash</h2>
                <input
                  value={loginHash}
                  onChange={(event) => setLoginHash(event.target.value)}
                  placeholder="d6be5cce6245..."
                  autoComplete="off"
                />
                <button type="submit" disabled={!loginHash.trim()}>
                  Войти локально
                </button>
                <p>Hash хранится только в localStorage этого браузера.</p>
              </form>
            ) : (
              <form className="auth-form" onSubmit={register}>
                <span className="tile-label">Новый аккаунт</span>
                <h2>Регистрация</h2>
                <input
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  placeholder="real@email.ru"
                  type="email"
                />
                <button type="submit" disabled={!registerEmail.trim() || busy === "reg"}>
                  Получить hash
                </button>
                <p>Подтверждение пройдет по ссылке из письма.</p>
              </form>
            )}
          </div>
        </section>
      ) : (
        <section className="workspace">
          <aside className="sidebar tile">
            <div className="sidebar-head">
              <div>
                <span className="tile-label">Ящики</span>
                <strong>{accountMailboxes.length}</strong>
              </div>
              <button type="button" onClick={importKeys} disabled={busy === "getkeys"}>
                Импорт
              </button>
            </div>

            <form className="new-box" onSubmit={createMailbox}>
              <input
                maxLength={10}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="имя до 10 симв."
              />
              <select value={domain} onChange={(event) => setDomain(event.target.value)}>
                <option value="">случайный домен</option>
                <option value="post-shift.ru">post-shift.ru</option>
                <option value="postshift.ru">postshift.ru</option>
              </select>
              <button type="submit" className="paid" disabled={busy === "new"}>
                Создать, -1
              </button>
            </form>

            <div className="mailbox-list">
              {accountMailboxes.map((box) => (
                <button
                  key={box.key}
                  type="button"
                  className={box.key === activeMailbox?.key ? "mailbox active" : "mailbox"}
                  onClick={() => {
                    setActiveMailboxKey(box.key);
                    setMessage(null);
                  }}
                >
                  <span>{box.email}</span>
                  <small>{box.livetime ? `${box.livetime}s` : "livetime ?"}</small>
                </button>
              ))}
              {!accountMailboxes.length ? <p className="empty">Создай ящик или импортируй активные ключи.</p> : null}
            </div>
          </aside>

          <section className="mail tile">
            {activeMailbox ? (
              <>
                <header className="mail-head">
                  <div>
                    <span className="tile-label">Активный адрес</span>
                    <button
                      type="button"
                      className="copy-address"
                      onClick={() => {
                        navigator.clipboard.writeText(activeMailbox.email);
                        showToast("Адрес скопирован");
                      }}
                    >
                      {activeMailbox.email}
                    </button>
                  </div>
                  <div className="mail-actions">
                    <button type="button" onClick={refreshLife} disabled={busy === "livetime"}>
                      Время
                    </button>
                    <button type="button" className="paid" onClick={extendMailbox} disabled={busy === "update"}>
                      Продлить, -1
                    </button>
                    <button type="button" onClick={clearMailbox} disabled={busy === "clear"}>
                      Очистить
                    </button>
                    <button type="button" className="danger" onClick={deleteMailbox} disabled={busy === "delete"}>
                      Удалить
                    </button>
                  </div>
                </header>

                <div className="inbox-toolbar">
                  <div>
                    <strong>Входящие</strong>
                    <span>{activeMailbox.letters?.length ?? 0} писем</span>
                  </div>
                  <button type="button" className="paid" onClick={refreshInbox} disabled={busy === "getlist"}>
                    Обновить, -1
                  </button>
                </div>

                <div className="mail-grid">
                  <div className="letters">
                    {(activeMailbox.letters || []).map((letter) => (
                      <button
                        key={letter.id}
                        type="button"
                        className={message?.id === letter.id ? "letter active" : "letter"}
                        onClick={() => openLetter(letter)}
                      >
                        <strong>{letter.subject || "Без темы"}</strong>
                        <span>{letter.from}</span>
                        <small>{letter.date}</small>
                        <em>Открыть, -1</em>
                      </button>
                    ))}
                    {activeMailbox.letters && !activeMailbox.letters.length ? (
                      <p className="empty">Писем нет. Автообновления нет, чтобы не тратить баланс.</p>
                    ) : null}
                    {!activeMailbox.letters ? (
                      <p className="empty">Нажми обновление входящих, когда ждешь письмо.</p>
                    ) : null}
                  </div>

                  <div className="reader">
                    {message ? (
                      <iframe title="Содержимое письма" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={messageHtml} />
                    ) : (
                      <div className="reader-empty">Письмо откроется здесь в изолированном iframe.</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="center-empty">
                <h2>Ящик еще не выбран</h2>
                <p>Создай новый временный адрес или импортируй активные ключи аккаунта.</p>
              </div>
            )}
          </section>
        </section>
      )}

      {settingsOpen ? (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <section className="modal tile" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="tile-label">Настройки</span>
                <h2>Аккаунты и баланс</h2>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Закрыть
              </button>
            </header>

            <div className="settings-list">
              {accounts.map((account) => (
                <div className="account-row" key={account.id}>
                  <div>
                    <strong>{account.label}</strong>
                    <span>{account.hash}</span>
                    <small>
                      Баланс: {account.balance ?? "?"}
                      {account.lastBalanceAt ? ` | ${new Date(account.lastBalanceAt).toLocaleString("ru-RU")}` : ""}
                    </small>
                  </div>
                  <button type="button" onClick={() => refreshBalance(account)}>
                    Баланс
                  </button>
                  <button type="button" className="danger" onClick={() => removeAccount(account.id)}>
                    Убрать
                  </button>
                </div>
              ))}
            </div>

            <form className="add-hash" onSubmit={(event) => {
              event.preventDefault();
              addAccount(loginHash);
            }}>
              <input value={loginHash} onChange={(event) => setLoginHash(event.target.value)} placeholder="Добавить еще hash" />
              <button type="submit">Добавить</button>
            </form>

            <div className="recover">
              <input
                value={recoverEmail}
                onChange={(event) => setRecoverEmail(event.target.value)}
                placeholder="email для восстановления"
                type="email"
              />
              <button type="button" onClick={() => recover("hash")} disabled={!recoverEmail.trim()}>
                Выслать hash
              </button>
              <button type="button" onClick={() => recover("getverify")} disabled={!recoverEmail.trim()}>
                Выслать verify
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
      {busy && PAID_ACTIONS.has(busy) ? <div className="busy">Платный запрос выполняется...</div> : null}
    </main>
  );
}
