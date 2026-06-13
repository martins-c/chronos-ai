export function requireActiveSession(response) {
  if (response.status !== 401) return false;
  window.location.replace('/login.html');
  return true;
}
