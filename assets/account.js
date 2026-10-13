// Account chip + email sign-in dialog, shared by the homepage and the Time Chamber.
// Usage: Account.mount(element)  — renders "Sign in" or your email with a sign-out option.

(function () {
  const css = `
  .acct-chip { font: inherit; font-weight: 600; font-size: 0.85rem; cursor: pointer; padding: 7px 14px; border-radius: 999px;
    border: 1px solid var(--acct-border, #d6cfbf); background: var(--acct-bg, #fff); color: var(--acct-text, #1b1b1a); }
  .acct-chip.primary { background: #2b59c3; border-color: #2b59c3; color: #fff; }
  .acct-wrap { position: relative; display: inline-block; }
  .acct-menu { position: absolute; right: 0; top: calc(100% + 6px); min-width: 220px; z-index: 60; padding: 12px;
    background: var(--acct-bg, #fff); color: var(--acct-text, #1b1b1a); border: 1px solid var(--acct-border, #e3ddd0);
    border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.15); font-size: 0.85rem; }
  .acct-menu[hidden] { display: none; }
  .acct-menu p { margin: 0 0 10px; color: var(--acct-muted, #6b6b66); word-break: break-all; }
  .acct-dialog { border: none; border-radius: 18px; padding: 0; width: min(420px, calc(100vw - 32px));
    box-shadow: 0 30px 80px rgba(0,0,0,.35); background: #fffdf8; color: #1b1b1a; }
  .acct-dialog::backdrop { background: rgba(20,18,14,.45); backdrop-filter: blur(4px); }
  .acct-dialog form { padding: 26px; }
  .acct-dialog h2 { margin: 0 0 6px; font-size: 1.35rem; letter-spacing: -0.01em; }
  .acct-dialog p { margin: 0 0 16px; color: #6b6b66; line-height: 1.5; font-size: 0.92rem; }
  .acct-dialog input[type=email] { width: 100%; box-sizing: border-box; font: inherit; font-size: 1rem; padding: 12px 14px;
    border-radius: 12px; border: 1px solid #d6cfbf; background: #fff; color: inherit; }
  .acct-dialog input:focus { outline: 2px solid #2b59c3; outline-offset: 1px; }
  .acct-dialog .acct-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .acct-dialog small { display: block; margin-top: 14px; color: #8a857a; line-height: 1.45; }
  .acct-dialog .acct-error { color: #c0392b; margin-top: 10px; font-size: 0.85rem; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const name = (window.AWARE_CONFIG && window.AWARE_CONFIG.appName) || "Aware Life";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let dialog;
  function buildDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "acct-dialog";
    dialog.innerHTML = `
      <form method="dialog" id="acct-form">
        <h2>Make it yours</h2>
        <p>Enter your email and we'll send you a sign-in link. Your own ${esc(name)} space is created the first time you sign in, with your projects, reminders, to-dos and day summaries, private to you.</p>
        <input type="email" id="acct-email" required placeholder="you@example.com" autocomplete="email">
        <div class="acct-error" id="acct-error" hidden></div>
        <div class="acct-row">
          <button type="button" class="acct-chip" id="acct-cancel">Not now</button>
          <button type="submit" class="acct-chip primary" id="acct-send">Send sign-in link</button>
        </div>
        <small>We use your email only to sign you in and to keep a record of who visits. We never sell or share it.</small>
      </form>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#acct-cancel").addEventListener("click", () => dialog.close());
    dialog.querySelector("#acct-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = dialog.querySelector("#acct-email").value.trim();
      const err = dialog.querySelector("#acct-error");
      const send = dialog.querySelector("#acct-send");
      err.hidden = true;
      send.disabled = true;
      send.textContent = "Sending…";
      try {
        await Store.signIn(email);
        dialog.querySelector("form").innerHTML = `
          <h2>Check your email</h2>
          <p>We sent a sign-in link to <strong>${esc(email)}</strong>. Open it on this device to finish signing in.</p>
          <div class="acct-row"><button type="button" class="acct-chip primary" onclick="this.closest('dialog').close()">Done</button></div>`;
      } catch (ex) {
        err.textContent = ex.message || "Couldn't send the link. Try again.";
        err.hidden = false;
        send.disabled = false;
        send.textContent = "Send sign-in link";
      }
    });
  }

  function openSignIn() {
    if (!Store.state().configured) {
      alert(`${name} accounts are being set up. For now you're in a sandbox: your changes are saved in this browser.`);
      return;
    }
    if (dialog) dialog.remove();
    buildDialog();
    dialog.showModal();
  }

  function render(el) {
    const s = Store.state();
    if (!s.signedIn) {
      el.innerHTML = `<button type="button" class="acct-chip primary">Sign in</button>`;
      el.querySelector("button").addEventListener("click", openSignIn);
      return;
    }
    el.innerHTML = `
      <span class="acct-wrap">
        <button type="button" class="acct-chip" aria-haspopup="true">${esc(s.email.split("@")[0])}</button>
        <div class="acct-menu" hidden>
          <p>Signed in as<br><strong>${esc(s.email)}</strong></p>
          <button type="button" class="acct-chip" data-out>Sign out</button>
        </div>
      </span>`;
    const chip = el.querySelector(".acct-chip"), menu = el.querySelector(".acct-menu");
    chip.addEventListener("click", () => { menu.hidden = !menu.hidden; });
    document.addEventListener("click", (e) => { if (!el.contains(e.target)) menu.hidden = true; });
    el.querySelector("[data-out]").addEventListener("click", () => Store.signOut());
  }

  window.Account = {
    mount(el) {
      render(el);
      Store.onChange(() => render(el));
    },
    openSignIn,
  };
})();
