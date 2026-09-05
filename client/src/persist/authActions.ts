import { shellAuthActions } from '@/generated/catalog';

function authActionPath(key: string): string {
  const action = shellAuthActions.find((entry) => entry.key === key);
  if (!action) {
    throw new Error(`Missing shell auth action: ${key}`);
  }
  return action.path;
}

async function readCsrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Could not load auth CSRF token');
  }
  const body = (await response.json()) as { csrfToken?: string };
  if (!body.csrfToken) {
    throw new Error('Auth CSRF token missing');
  }
  return body.csrfToken;
}

function postAuthForm(actionPath: string, csrfToken: string, callbackUrl: string) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionPath;
  const csrfInput = document.createElement('input');
  csrfInput.type = 'hidden';
  csrfInput.name = 'csrfToken';
  csrfInput.value = csrfToken;
  form.appendChild(csrfInput);
  const callbackInput = document.createElement('input');
  callbackInput.type = 'hidden';
  callbackInput.name = 'callbackUrl';
  callbackInput.value = callbackUrl;
  form.appendChild(callbackInput);
  document.body.appendChild(form);
  form.submit();
}

/** Start Google OAuth via Auth.js (CSRF + POST). */
export async function startGoogleSignIn(): Promise<void> {
  const csrfToken = await readCsrfToken();
  postAuthForm(authActionPath('google_sign_in'), csrfToken, window.location.href);
}

/** End the Auth.js session and return to the current page. */
export async function startSignOut(): Promise<void> {
  const csrfToken = await readCsrfToken();
  postAuthForm(authActionPath('sign_out'), csrfToken, window.location.href);
}
