const app = document.querySelector("#app");
const state = {
  user: null,
  organizations: [],
  orgId: "",
  engagements: [],
  detail: null,
  project: null,
  error: "",
  notice: "",
  busy: false,
  mode: "register",
  aiProvider: "not_configured",
};

const stages = [
  "discovery",
  "requirements_ready",
  "proposal_ready",
  "accepted",
  "in_delivery",
  "delivered",
];

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function money(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.error?.message ?? "Request failed");
    error.details = data?.error?.details;
    throw error;
  }
  return data;
}

function selectedOrg() {
  return state.organizations.find((organization) => organization.id === state.orgId) ?? null;
}

async function refreshSession() {
  const data = await api("/api/session");
  state.user = data.user;
  state.organizations = data.organizations;
  if (!state.orgId && data.organizations[0]) state.orgId = data.organizations[0].id;
}

async function refreshEngagements() {
  if (!state.orgId) return;
  const data = await api(`/api/organizations/${state.orgId}/engagements`);
  state.engagements = data.engagements;
}

async function openEngagement(id) {
  state.detail = await api(`/api/organizations/${state.orgId}/engagements/${id}`);
  state.project = state.detail.project
    ? await api(`/api/organizations/${state.orgId}/projects/${state.detail.project.id}`)
    : null;
}

function render() {
  const org = selectedOrg();
  app.innerHTML = `
    <main class="shell">
      <header class="top">
        <div>
          <h1 class="wordmark">Outcome OS</h1>
          <p class="lede">Describe an operational problem. The platform produces requirements, a priced proposal, and a verified runbook package.</p>
        </div>
        <div class="row">${state.user ? `<span>${escapeHtml(state.user.name)}</span><button class="secondary" id="logout" type="button">Sign out</button>` : ""}</div>
      </header>
      <p class="error">${escapeHtml(state.error)}</p>
      <p class="meta">${escapeHtml(state.notice)}</p>
      ${state.user ? workspace(org) : authPanel()}
    </main>`;
  bind();
}

function authPanel() {
  const register = state.mode === "register";
  return `<section class="panel grid">
    <h2>${register ? "Create an account" : "Sign in"}</h2>
    <label><span>Email</span><input id="email" type="email" autocomplete="username"></label>
    ${register ? `<label><span>Your name</span><input id="name" autocomplete="name"></label>` : ""}
    <label><span>Password</span><input id="password" type="password" autocomplete="${register ? "new-password" : "current-password"}"></label>
    <div class="row">
      <button id="auth-submit" type="button">${register ? "Create account" : "Sign in"}</button>
      <button class="secondary" id="auth-switch" type="button">${register ? "I already have an account" : "Create an account"}</button>
    </div>
  </section>`;
}

function workspace(org) {
  if (!org) {
    return `<section class="panel grid"><h2>Create your organization</h2><label><span>Organization name</span><input id="org-name"></label><button id="create-org" type="button">Create organization</button></section>`;
  }
  return `<section class="panel">
      <div class="row"><strong>${escapeHtml(org.name)}</strong><span class="meta">${escapeHtml(org.role)}</span></div>
      <p class="meta">${
        state.aiProvider === "configured"
          ? "A model key is configured. Summaries are optional and do not change the price."
          : "Model enrichment is off until an AI provider key is configured. Pricing and delivery use the deterministic runbook engine."
      }</p>
    </section>
    <section class="grid two">
      <form id="intake" class="panel grid">
        <h2>New problem</h2>
        <label><span>Customer name</span><input name="customer" required></label>
        <label><span>Company</span><input name="company" required></label>
        <label><span>Business problem</span><textarea name="problem" required minlength="20"></textarea></label>
        <button type="submit">Start discovery</button>
      </form>
      <section class="panel">
        <h2>Engagements</h2>
        <div class="list">${state.engagements.map((item) => `<button class="card" data-open="${item.id}" type="button"><strong>${escapeHtml(item.status)}</strong><div>${escapeHtml(item.problem)}</div></button>`).join("") || `<p class="meta">No engagements yet.</p>`}</div>
      </section>
    </section>
    ${state.detail ? detailPanel() : ""}`;
}

function detailPanel() {
  const detail = state.detail;
  const stage = detail.engagement.status;
  const proposal = detail.proposal;
  return `<section class="panel grid">
    <div class="stages">${stages.map((item) => `<span class="${item === stage || (stage === "needs_human" && item === "in_delivery") ? "on" : ""}">${escapeHtml(item.replaceAll("_", " "))}</span>`).join("")}</div>
    <h2>Discovery</h2>
    <p>${escapeHtml(detail.engagement.problem)}</p>
    ${detail.engagement.narrative ? `<p>${escapeHtml(detail.engagement.narrative)}</p>` : ""}
    ${
      state.aiProvider === "configured"
        ? `<button id="summarize" type="button">Write summary</button>`
        : ""
    }
    ${detail.facts.length ? `<ul>${detail.facts.map((fact) => `<li>${escapeHtml(fact.value)} <span class="meta">(${escapeHtml(fact.source)})</span></li>`).join("")}</ul>` : ""}
    <form id="answers" class="grid">
      ${detail.questions.map((question) => `<label><span>${escapeHtml(question.prompt)}</span><textarea name="${escapeHtml(question.key)}">${escapeHtml(question.answer ?? "")}</textarea>${question.issue && question.answer ? `<span class="error">${escapeHtml(question.issue)}</span>` : ""}</label>`).join("")}
      <div class="row"><button type="submit">Save answers</button><button class="secondary" id="finalize" type="button">Build requirements</button></div>
    </form>
    ${detail.requirements ? `<p class="meta">Requirements are stored with a source on every statement. Open questions: ${detail.requirements.openQuestions.length}.</p>` : ""}
    <div class="row"><button id="compose" type="button" ${detail.requirements ? "" : "disabled"}>Compose proposal</button></div>
    ${proposal ? proposalPanel(proposal) : ""}
    ${state.project ? projectPanel() : ""}
  </section>`;
}

function proposalPanel(proposal) {
  const document = proposal.document;
  return `<article class="grid">
    <h2>Proposal · ${escapeHtml(proposal.status)} · ${money(proposal.priceCents)}</h2>
    <p>${escapeHtml(document.proposedSolution)}</p>
    <p class="meta">Fixed project ${money(document.priceCents)}. Monthly maintenance ${money(document.recurringMonthlyCents)} is quoted, not billed. Payment is not collected in this version (${escapeHtml(document.recurringStatus)}).</p>
    <h3>Exclusions</h3>
    <ul>${document.exclusions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    ${proposal.status === "ready" ? `<button id="accept" type="button">Accept proposal</button>` : ""}
  </article>`;
}

function projectPanel() {
  const project = state.project;
  const review = project.tasks.find(
    (task) => task.kind === "approval" && task.status === "pending",
  );
  return `<article class="grid">
    <h2>Project · ${escapeHtml(project.project.status)}</h2>
    <p class="meta">Commercial status: ${escapeHtml(project.project.commercialStatus)}</p>
    ${
      project.project.commercialStatus === "paid"
        ? ""
        : `<button id="checkout" type="button">Open checkout</button>`
    }
    <ul>${project.tasks.map((task) => `<li>${escapeHtml(task.title)} · ${escapeHtml(task.executor)} · ${escapeHtml(task.status)} · attempts ${task.attempts}</li>`).join("")}</ul>
    <div class="row">
      ${project.project.status === "ready" || project.project.status === "running" ? `<button id="run" type="button">Run fulfillment</button>` : ""}
      ${review ? `<button id="retry" type="button" data-task="${review.id}">Approve another attempt</button><button class="secondary" id="stop" type="button" data-task="${review.id}">Stop project</button>` : ""}
    </div>
    <h3>Execution</h3>
    <ul>${project.executions.map((item) => `<li>${escapeHtml(item.agent_id)} · ${escapeHtml(item.status)} · ${item.cost_cents} cents · ${item.duration_ms} ms</li>`).join("") || "<li>No executions yet.</li>"}</ul>
    ${project.artifacts.map((artifact) => `<section><h3>${escapeHtml(artifact.title)}</h3><pre>${escapeHtml(artifact.content)}</pre></section>`).join("")}
    ${project.outcome ? `<form id="outcome" class="grid"><h3>Outcome</h3><p>Baseline ${escapeHtml(project.outcome.before_value)} ${escapeHtml(project.outcome.unit)}. After: ${escapeHtml(project.outcome.after_value ?? "not recorded")}</p><label><span>Measured result after delivery</span><input name="after" value="${escapeHtml(project.outcome.after_value ?? "")}"></label><button type="submit">Record outcome</button></form>` : ""}
    ${project.blueprint ? `<p class="meta">Blueprint stage: ${escapeHtml(project.blueprint.stage)}. Promotion stays gated.</p><button class="secondary" id="promote" type="button">Request promotion</button>` : ""}
  </article>`;
}

function bind() {
  document.querySelector("#summarize")?.addEventListener("click", () =>
    act(async () => {
      const result = await api(
        `/api/organizations/${state.orgId}/engagements/${state.detail.engagement.id}/narrative`,
        { method: "POST", body: { privacy: "standard" } },
      );
      state.detail.engagement.narrative = result.narrative;
      state.notice = "Summary stored. The price is unchanged.";
    }),
  );
  document.querySelector("#logout")?.addEventListener("click", () =>
    act(() =>
      api("/api/auth/logout", { method: "POST" }).then(() => {
        state.user = null;
        state.detail = null;
        state.project = null;
      }),
    ),
  );
  document.querySelector("#auth-switch")?.addEventListener("click", () => {
    state.mode = state.mode === "register" ? "login" : "register";
    render();
  });
  document.querySelector("#auth-submit")?.addEventListener("click", () =>
    act(async () => {
      const payload = {
        email: value("#email"),
        password: value("#password"),
        ...(state.mode === "register" ? { name: value("#name") } : {}),
      };
      await api(state.mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: payload,
      });
      await refreshSession();
      await refreshEngagements();
    }),
  );
  document.querySelector("#create-org")?.addEventListener("click", () =>
    act(async () => {
      await api("/api/organizations", { method: "POST", body: { name: value("#org-name") } });
      await refreshSession();
    }),
  );
  document.querySelector("#intake")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    act(async () => {
      const customer = await api(`/api/organizations/${state.orgId}/customers`, {
        method: "POST",
        body: {
          name: new FormData(form).get("customer"),
          company: new FormData(form).get("company"),
        },
      });
      const engagement = await api(`/api/organizations/${state.orgId}/engagements`, {
        method: "POST",
        body: { customerId: customer.id, problem: new FormData(form).get("problem") },
      });
      await refreshEngagements();
      await openEngagement(engagement.id);
    });
  });
  for (const button of document.querySelectorAll("[data-open]")) {
    button.addEventListener("click", () => act(() => openEngagement(button.dataset.open)));
  }
  document.querySelector("#answers")?.addEventListener("submit", (event) => {
    event.preventDefault();
    act(() => saveAnswers());
  });
  document.querySelector("#finalize")?.addEventListener("click", () =>
    act(async () => {
      await saveAnswers();
      state.detail = await api(
        `/api/organizations/${state.orgId}/engagements/${state.detail.engagement.id}/requirements`,
        { method: "POST", body: {} },
      );
    }),
  );
  document.querySelector("#compose")?.addEventListener("click", () =>
    act(async () => {
      state.detail = await api(
        `/api/organizations/${state.orgId}/engagements/${state.detail.engagement.id}/solution`,
        { method: "POST", body: {} },
      );
    }),
  );
  document.querySelector("#accept")?.addEventListener("click", () =>
    act(async () => {
      await api(`/api/organizations/${state.orgId}/proposals/${state.detail.proposal.id}/accept`, {
        method: "POST",
        body: {},
      });
      await openEngagement(state.detail.engagement.id);
    }),
  );
  document.querySelector("#checkout")?.addEventListener("click", () =>
    act(async () => {
      const result = await api(
        `/api/organizations/${state.orgId}/projects/${state.project.project.id}/checkout`,
        { method: "POST", body: {} },
      );
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      state.notice = "Checkout is open. Payment is recorded only after Stripe confirms it.";
      await openEngagement(state.detail.engagement.id);
    }),
  );
  document.querySelector("#run")?.addEventListener("click", () =>
    act(async () => {
      state.project = await api(
        `/api/organizations/${state.orgId}/projects/${state.project.project.id}/run`,
        { method: "POST", body: {} },
      );
      state.detail = await api(
        `/api/organizations/${state.orgId}/engagements/${state.detail.engagement.id}`,
      );
    }),
  );
  document
    .querySelector("#retry")
    ?.addEventListener("click", (event) => review(event.currentTarget.dataset.task, "retry"));
  document
    .querySelector("#stop")
    ?.addEventListener("click", (event) => review(event.currentTarget.dataset.task, "stop"));
  document.querySelector("#outcome")?.addEventListener("submit", (event) => {
    event.preventDefault();
    act(async () => {
      state.project = await api(
        `/api/organizations/${state.orgId}/projects/${state.project.project.id}/outcomes`,
        {
          method: "POST",
          body: { afterValue: new FormData(event.currentTarget).get("after") },
        },
      );
    });
  });
  document.querySelector("#promote")?.addEventListener("click", () =>
    act(async () => {
      await api(
        `/api/organizations/${state.orgId}/projects/${state.project.project.id}/blueprint/promote`,
        { method: "POST", body: {} },
      );
    }),
  );
}

function value(selector) {
  return document.querySelector(selector)?.value ?? "";
}

async function saveAnswers() {
  const form = document.querySelector("#answers");
  const body = Object.fromEntries(new FormData(form).entries());
  state.detail = await api(
    `/api/organizations/${state.orgId}/engagements/${state.detail.engagement.id}/answers`,
    { method: "POST", body },
  );
}

function review(taskId, decision) {
  act(async () => {
    state.project = await api(
      `/api/organizations/${state.orgId}/projects/${state.project.project.id}/reviews/${taskId}`,
      {
        method: "POST",
        body: { decision, note: "Operator decision from the workspace." },
      },
    );
    state.detail = await api(
      `/api/organizations/${state.orgId}/engagements/${state.detail.engagement.id}`,
    );
  });
}

async function act(work) {
  if (state.busy) return;
  state.busy = true;
  state.error = "";
  state.notice = "";
  try {
    await work();
  } catch (error) {
    state.error = error.message;
    const open = error.details?.openQuestions;
    if (Array.isArray(open) && open.length) state.error = `${error.message} ${open.join(" ")}`;
  } finally {
    state.busy = false;
    render();
  }
}

async function refreshHealth() {
  const health = await api("/api/health");
  state.aiProvider = health.aiProvider === "configured" ? "configured" : "not_configured";
}

refreshHealth()
  .catch(() => {
    state.aiProvider = "not_configured";
  })
  .finally(() => {
    refreshSession()
      .then(refreshEngagements)
      .catch(() => {
        state.user = null;
      })
      .finally(render);
  });
