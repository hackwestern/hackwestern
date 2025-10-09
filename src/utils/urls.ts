export const GITHUB_URL = "https://github.com/";
export const LINKEDIN_URL = "https://linkedin.com/in/";

export function getGithubUsername(text: string) {
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);

    if (url.hostname === "github.com") {
      const pathSegments = url.pathname.split("/");
      return pathSegments[1] ?? text;
    }
  } catch (error) {
    return text;
  }

  return text;
}

export function getLinkedinUsername(text: string) {
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);

    if (
      url.hostname === "linkedin.com" ||
      url.hostname === "www.linkedin.com"
    ) {
      const pathSegments = url.pathname.split("/");
      return pathSegments[2] ?? text;
    }
  } catch (error) {
    return text;
  }

  return text;
}

/**
 * Ensure a URL string has an http(s) protocol. Returns the original value for
 * falsy inputs. If the text already starts with http:// or https:// (case
 * insensitive) it is returned unchanged; otherwise `https://` is prepended.
 */
export function ensureUrlHasProtocol(text?: string | null) {
  if (!text) return text;
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}
