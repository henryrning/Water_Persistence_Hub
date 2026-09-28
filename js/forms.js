/* Sign-in, access request and contact forms.
   Prototype behaviour: nothing is sent. Requests and drafts are kept in this
   browser so the admin queue and the forms can be exercised end to end. The
   controls keep their product labels; the prototype boundary is stated once,
   in the result, not on every button. */
(() => {
  const $ = id => document.getElementById(id);
  function feedback(form) {
    const p = document.createElement("p"); p.className = "inline-status";
    p.setAttribute("role", "status"); p.setAttribute("aria-atomic", "true"); form.append(p); return p;
  }
  const ALLOWED_NEXT = new Set(["download.html", "account.html", "admin.html"]);
  function safeNext(fallback) {
    const next = new URLSearchParams(location.search).get("next");
    if (!next) return fallback;
    try {
      const url = new URL(next, location.href), base = new URL(".", location.href);
      if (url.origin === base.origin && url.pathname.startsWith(base.pathname) && ALLOWED_NEXT.has(url.pathname.slice(base.pathname.length))) return url.href;
    } catch { /* malformed next: use the fallback */ }
    return fallback;
  }

  // ---------- Sign in ----------
  const signForm = $("signin-form");
  if (signForm) {
    const status = feedback(signForm);
    function go(role) {
      try { Session.demo(role); location.href = safeNext(role === "admin" ? "admin.html" : "download.html"); }
      catch { status.classList.add("error"); status.textContent = "This browser could not save the session. Enable site storage and try again."; }
    }
    signForm.onsubmit = e => {
      e.preventDefault();
      const email = $("email");
      if (!email.value.trim()) { email.setAttribute("aria-invalid", "true"); email.focus(); status.classList.add("error"); status.textContent = "Enter your work email."; return; }
      // Prototype: an @illinois.edu address opens the administrator view; anything else the data-user view.
      go(email.value.trim().toLowerCase().endsWith("@illinois.edu") ? "admin" : "user");
    };
    document.querySelectorAll("[data-demo]").forEach(button => button.onclick = () => go(button.dataset.demo));
    const forgot = $("forgot");
    if (forgot) forgot.onclick = e => {
      e.preventDefault(); status.classList.remove("error");
      status.textContent = "If that address has an account, a one-time reset link is emailed to it. (No email is sent in this prototype.)";
    };
  }

  // ---------- Request access (AUTH-04, AUTH-06) ----------
  const request = $("req-form");
  if (request) {
    const status = feedback(request), email = $("f-email"), emailMessage = $("email-msg");
    function checkEmail() {
      const result = HUB.checkDomain(email.value);
      email.setAttribute("aria-invalid", email.value ? result.state === "invalid" : "false");
      emailMessage.textContent = "";
      if (!email.value) return result;
      const box = document.createElement("div");
      box.className = "field-msg " + (result.state === "invalid" ? "bad" : result.state === "eligible" ? "good" : "warn");
      box.textContent = result.state === "invalid" ? "Enter a full email address, like name@company.com."
        : result.state === "eligible" ? `${result.org} is on the eligible list.`
        : `${result.dom} isn’t on our list yet. You can still apply — an administrator will review it by hand.`;
      emailMessage.append(box);
      return result;
    }
    email.onblur = checkEmail;
    email.oninput = () => { if (emailMessage.textContent) checkEmail(); };
    request.onsubmit = e => {
      e.preventDefault();
      let firstInvalid;
      request.querySelectorAll("[required]").forEach(field => {
        const valid = field.checkValidity() && field.value.trim();
        field.setAttribute("aria-invalid", !valid);
        if (!valid && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) { status.classList.add("error"); status.textContent = "Complete the highlighted fields. Your entries have been preserved."; firstInvalid.focus(); return; }
      // Snapshot first, then persist, then replace the form — never read fields after they are gone.
      const value = id => $(id).value.trim();
      const record = { name: value("f-name"), org: value("f-org"), email: value("f-email"), role: value("f-role"), use: value("f-use"), flagged: checkEmail().state === "review", at: new Date().toISOString() };
      try {
        const queue = JSON.parse(localStorage.getItem("wph.requests") || "[]");
        if (!Array.isArray(queue)) throw new Error("Invalid queue");
        queue.unshift(record); localStorage.setItem("wph.requests", JSON.stringify(queue));
      } catch {
        status.classList.add("error"); status.textContent = "Could not save the request in this browser. Your entries are preserved; retry or use the contact page."; return;
      }
      const panel = document.createElement("div"); panel.className = "card-pad form-result";
      const title = document.createElement("h2"); title.textContent = "Request received"; title.tabIndex = -1;
      const detail = document.createElement("p");
      detail.textContent = `Thanks, ${record.name.split(" ")[0]}. We’ll email ${record.email} once an administrator has reviewed it.`;
      panel.append(title, detail);
      if (record.flagged) {
        const note = document.createElement("div"); note.className = "callout callout-info";
        const p = document.createElement("p"); p.textContent = "Your domain isn’t on the eligible list, so your request is flagged for a closer look. This can take a little longer."; note.append(p); panel.append(note);
      }
      const proto = document.createElement("p"); proto.className = "prototype-note form-result-note";
      proto.textContent = "Prototype: the request was added to the demo review queue in this browser. No email was sent.";
      const link = document.createElement("a"); link.href = "docs.html"; link.className = "link-arrow"; link.textContent = "Browse the documentation meanwhile";
      const linkWrap = document.createElement("p"); linkWrap.className = "form-result-link"; linkWrap.append(link);
      panel.append(proto, linkWrap);
      request.closest(".card").replaceChildren(panel); title.focus();
    };
  }

  // ---------- Contact, data-problem report, beta feedback (DOC-12, LAND-08) ----------
  document.querySelectorAll("[data-form]").forEach(form => {
    const status = feedback(form);
    const done = { contact: "Thanks — your question was sent. We usually reply within two business days.",
                   report: "Thanks — your report was logged. We’ll email you when it’s reviewed.",
                   feedback: "Thanks for the feedback!" }[form.dataset.form];
    const key = `wph.draft.${form.dataset.form}`;
    form.onsubmit = e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const draft = { kind: form.dataset.form, at: new Date().toISOString(), fields: {} };
      form.querySelectorAll("input, select, textarea").forEach(field => { draft.fields[field.id] = field.value; });
      try { localStorage.setItem(key, JSON.stringify(draft)); }
      catch { status.classList.add("error"); status.textContent = "Could not save your message in this browser. Your text is still here; copy it before leaving."; return; }
      status.classList.remove("error"); status.classList.add("good");
      status.textContent = `${done} (Prototype: kept on this device only — nothing was sent.)`;
      form.querySelectorAll("input, textarea").forEach(f => { if (f.type !== "hidden") f.value = ""; });
    };
    // Restore an unsent draft so a reload doesn't lose typed text.
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved?.fields && Object.values(saved.fields).some(v => v)) {
        for (const field of form.querySelectorAll("input, select, textarea")) if (typeof saved.fields[field.id] === "string") field.value = saved.fields[field.id];
        status.textContent = "Restored the text you typed earlier.";
      }
    } catch { /* No usable saved draft */ }
  });
})();
