const form = document.getElementById("shortenForm");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");
const result = document.getElementById("result");
const shortUrl = document.getElementById("shortUrl");
const destination = document.getElementById("destination");
const clickCount = document.getElementById("clickCount");
const copyBtn = document.getElementById("copyBtn");
const recentLinks = document.getElementById("recentLinks");
const dashboardPanel = document.getElementById("dashboardPanel");
const dashboardList = document.getElementById("dashboardList");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const authMessage = document.getElementById("authMessage");
const authTokenKey = "shortener-admin-token";

function getAuthToken() {
  return localStorage.getItem(authTokenKey) || "";
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem(authTokenKey, token);
  } else {
    localStorage.removeItem(authTokenKey);
  }
}

function getAuthHeaders(extra = {}) {
  const token = getAuthToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function setAuthNotice(message, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.className = `message ${isError ? "error" : "success"}`;
}

function updateAuthUi() {
  const isLoggedIn = Boolean(getAuthToken());
  dashboardPanel.classList.toggle("hidden", !isLoggedIn);
  logoutBtn.classList.toggle("hidden", !isLoggedIn);
  loginForm.classList.toggle("hidden", isLoggedIn);

  if (isLoggedIn) {
    setAuthNotice("Dashboard unlocked. You can manage your links.");
    loadDashboard();
  } else {
    setAuthNotice("Please login to edit or delete short URLs.");
    if (dashboardList) {
      dashboardList.innerHTML = '<div class="empty-state">Please login to view the dashboard.</div>';
    }
  }
}

async function loadRecentLinks() {
  if (!recentLinks) return;

  try {
    const response = await fetch("/api/urls");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to load links.");
    }

    const links = Array.isArray(payload.data) ? payload.data : [];

    if (!links.length) {
      recentLinks.innerHTML = '<div class="empty-state">No short URLs yet. Create your first one above.</div>';
      return;
    }

    recentLinks.innerHTML = links
      .slice(0, 6)
      .map(
        (link) => `
          <div class="link-item">
            <div class="link-topline">
              <a href="${link.shortURL}" target="_blank" rel="noopener">${link.shortURL}</a>
              <span>${link.clicks} clicks</span>
            </div>
            <div class="link-meta">${link.redirectURL}</div>
          </div>
        `
      )
      .join("");
  } catch (error) {
    recentLinks.innerHTML = `<div class="empty-state error-text">${error.message}</div>`;
  }
}

async function loadDashboard() {
  if (!dashboardList || !getAuthToken()) return;

  try {
    const response = await fetch("/api/urls/dashboard", {
      headers: getAuthHeaders(),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to load dashboard.");
    }

    const links = Array.isArray(payload.data) ? payload.data : [];

    if (!links.length) {
      dashboardList.innerHTML = '<div class="empty-state">No links yet. Start by creating one above.</div>';
      return;
    }

    dashboardList.innerHTML = links
      .map(
        (link) => `
          <div class="dashboard-item">
            <div class="dashboard-header">
              <a href="${link.shortURL}" target="_blank" rel="noopener">${link.shortURL}</a>
              <span>${link.clicks} clicks</span>
            </div>
            <div class="dashboard-meta">${link.redirectURL}</div>
            <form class="dashboard-form" data-short-id="${link.shortId}">
              <input type="url" name="redirectURL" value="${link.redirectURL}" required>
              <input type="text" name="customAlias" value="${link.shortId}" required>
              <div class="dashboard-actions">
                <button type="submit" class="primary-btn small-btn">Save</button>
                <button type="button" class="danger-btn small-btn" data-action="delete" data-short-id="${link.shortId}">Delete</button>
              </div>
            </form>
          </div>
        `
      )
      .join("");
  } catch (error) {
    dashboardList.innerHTML = `<div class="empty-state error-text">${error.message}</div>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = document.getElementById("url");
  const customAliasInput = document.getElementById("customAlias");
  const url = input.value.trim();
  const customAlias = customAliasInput.value.trim();

  formMessage.textContent = "";
  submitBtn.disabled = true;
  submitBtn.innerHTML = "Creating…";

  try {
    const response = await fetch("/api/urls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        customAlias,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to create short URL.");
    }

    const data = payload.data;
    shortUrl.href = data.shortURL;
    shortUrl.textContent = data.shortURL;
    destination.textContent = data.redirectURL;
    clickCount.textContent = `${data.clicks} clicks`;
    result.classList.remove("hidden");
    formMessage.className = "message success";
    formMessage.textContent = "Short URL created successfully.";
    input.value = "";
    customAliasInput.value = "";
    await loadRecentLinks();
    if (getAuthToken()) {
      await loadDashboard();
    }
  } catch (error) {
    formMessage.className = "message error";
    formMessage.textContent = error.message;
    result.classList.add("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Shorten URL <span>→</span>';
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Login failed.");
    }

    setAuthToken(payload.token);
    setAuthNotice("Login successful.");
    updateAuthUi();
  } catch (error) {
    setAuthNotice(error.message, true);
  }
});

logoutBtn.addEventListener("click", () => {
  setAuthToken("");
  setAuthNotice("You have been logged out.");
  updateAuthUi();
});

dashboardList.addEventListener("submit", async (event) => {
  const formTarget = event.target;
  if (!(formTarget instanceof HTMLFormElement) || !formTarget.matches(".dashboard-form")) return;

  event.preventDefault();

  const shortId = formTarget.dataset.shortId;
  const redirectURL = formTarget.elements.redirectURL.value.trim();
  const customAlias = formTarget.elements.customAlias.value.trim();

  try {
    const response = await fetch(`/api/urls/${shortId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ redirectURL, customAlias }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to update URL.");
    }

    setAuthNotice("URL updated successfully.");
    await loadRecentLinks();
    await loadDashboard();
  } catch (error) {
    setAuthNotice(error.message, true);
  }
});

dashboardList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const shortId = target.dataset.shortId;
  if (!action || !shortId) return;

  if (action === "delete") {
    const confirmed = window.confirm("Delete this short URL?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/urls/${shortId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete URL.");
      }

      setAuthNotice("URL deleted successfully.");
      await loadRecentLinks();
      await loadDashboard();
    } catch (error) {
      setAuthNotice(error.message, true);
    }
  }
});

copyBtn.addEventListener("click", async () => {
  const value = shortUrl.textContent.trim();
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    copyBtn.textContent = "Copied!";
  } catch {
    copyBtn.textContent = "Copy failed";
  }

  setTimeout(() => {
    copyBtn.textContent = "Copy";
  }, 1400);
});

loadRecentLinks();
updateAuthUi();
