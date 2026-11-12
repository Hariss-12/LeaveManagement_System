const crypto = require("node:crypto");

const COOKIE_NAME = "leave_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 8;
const secret = () => process.env.AUTH_SECRET || "";

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verify(token) {
  if (!secret() || typeof token !== "string") return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch { return null; }
}

function setSession(res, user) {
  const token = sign({ sub: String(user._id), role: user.role, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TOKEN_TTL_SECONDS}${secure}`);
}

function clearSession(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

function requireAuth(role) {
  return (req, res, next) => {
    const cookie = req.headers.cookie || "";
    const token = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    const session = verify(token);
    if (!session) return res.status(401).json({ success: false, message: "Please log in to continue" });
    if (role && session.role !== role) return res.status(403).json({ success: false, message: "You do not have access to this resource" });
    req.auth = session;
    next();
  };
}

module.exports = { setSession, clearSession, requireAuth };
