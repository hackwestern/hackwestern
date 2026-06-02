const url = "http://localhost:3000/api/auth";
const username = "lucasvanderwielen@icloud.com";
const password = "Metallica1!";

const res = await fetch(url + "/csrf");

const initalToken: { csrfToken: string } = await res.json();
console.log(initalToken);

const cookies = parseCookies(res.headers.getSetCookie());

const token = cookies["next-auth.csrf-token"];
if (token == undefined) {
  console.log("Token does not exist");
  process.exit(1);
}

const login = await fetch(url + "/callback/credentials", {
  method: "POST",
  headers: {
    Cookie: `next-auth.csrf-token=${token}; next-auth.callback-url=http://localhost:3000/live`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    username: username,
    password: password,
    csrfToken: initalToken.csrfToken,
    callbackUrl: "http://localhost:3000/live?tab=home",
    redirect: false,
    json: true,
  }),
});

const sessionCookies = parseCookies(login.headers.getSetCookie());
console.log(login.headers.getSetCookie());

const sessionToken = sessionCookies["next-auth.session-token"];

const body = await login.json();
console.log("Body: " + JSON.stringify(body));

console.log("Token: " + sessionToken);

function parseCookies(cookies: string[]): Record<string, string> {
  return Object.fromEntries(
    cookies.map((s) => {
      const split = s.split(";");
      const first = split[0]!.split("=");

      return [first[0]!, first[1]!];
    }),
  );
}
