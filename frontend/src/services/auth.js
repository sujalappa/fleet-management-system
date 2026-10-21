const TOKEN_KEY = "bhushilp_token";
const USER_KEY = "bhushilp_user";
const PROJECT_KEY = "bhushilp_project";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

export function getActiveProjectId() {
  return localStorage.getItem(PROJECT_KEY) || "kamptee";
}

export function setActiveProjectId(projectId) {
  localStorage.setItem(PROJECT_KEY, projectId);
}
