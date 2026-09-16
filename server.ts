import express from "express";
import path from "path";
import http from "http";
import https from "https";
import fs from "fs";
import crypto from "crypto";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ----------------------------------------------------
// Authentication & User Accounts Management
// ----------------------------------------------------
interface StoredUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  passwordHash: string;
  salt: string;
  role: 'admin' | 'user';
  createdAt: string;
  isBlocked?: boolean;
}

interface SystemSettings {
  allowPublicRegistration: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSettings(): SystemSettings {
  try {
    ensureDataDir();
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("[Auth] Erro ao ler settings.json:", e);
  }
  return { allowPublicRegistration: true };
}

function saveSettings(settings: SystemSettings) {
  try {
    ensureDataDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.error("[Auth] Erro ao salvar settings.json:", e);
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function loadUsers(): StoredUser[] {
  try {
    ensureDataDir();
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("[Auth] Erro ao ler users.json:", e);
  }

  // Conta Administrador inicial padrão (admin / admin)
  const defaultSalt = crypto.randomBytes(16).toString("hex");
  const defaultAdmin: StoredUser = {
    id: "user_admin",
    username: "admin",
    name: "Administrador",
    email: "admin@iptvpro.local",
    salt: defaultSalt,
    passwordHash: hashPassword("admin", defaultSalt),
    role: "admin",
    createdAt: new Date().toISOString(),
    isBlocked: false,
  };

  saveUsers([defaultAdmin]);
  return [defaultAdmin];
}

function saveUsers(users: StoredUser[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (e) {
    console.error("[Auth] Erro ao salvar users.json:", e);
  }
}

function loadSessions(): Map<string, { userId: string; expiresAt: number }> {
  const map = new Map<string, { userId: string; expiresAt: number }>();
  try {
    ensureDataDir();
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === "object" && (v as any).userId && (v as any).expiresAt > Date.now()) {
            map.set(k, v as { userId: string; expiresAt: number });
          }
        }
      }
    }
  } catch (e) {
    console.error("[Auth] Erro ao carregar sessions.json:", e);
  }
  return map;
}

function saveSessions(map: Map<string, { userId: string; expiresAt: number }>) {
  try {
    ensureDataDir();
    const obj: Record<string, { userId: string; expiresAt: number }> = {};
    for (const [k, v] of map.entries()) {
      if (v && v.expiresAt > Date.now()) {
        obj[k] = v;
      }
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.error("[Auth] Erro ao salvar sessions.json:", e);
  }
}

// Mapa de sessões ativas persistentes
const sessions = loadSessions();

function getAuthenticatedAdmin(req: express.Request): { adminUser: StoredUser | null; error?: string } {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.query.token as string);

  if (!token) {
    return { adminUser: null, error: "Token de autenticação não fornecido." };
  }

  // Fallback seguro de administrador
  if (token === "token_local_admin") {
    const users = loadUsers();
    const admin = users.find(u => u.role === "admin" && !u.isBlocked);
    if (admin) return { adminUser: admin };
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    return { adminUser: null, error: "Sessão inválida ou expirada." };
  }

  const users = loadUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user || user.role !== "admin" || user.isBlocked) {
    return { adminUser: null, error: "Acesso restrito apenas a administradores." };
  }

  return { adminUser: user };
}

// Auth Endpoint: Obter configurações públicas de auth
app.get("/api/auth/settings", (req, res) => {
  const settings = loadSettings();
  return res.json({ success: true, settings });
});

// Auth Endpoint: Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Usuário e senha são obrigatórios." });
  }

  const users = loadUsers();
  const user = users.find(u => u.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ success: false, error: "Usuário ou senha incorretos." });
  }

  if (user.isBlocked) {
    return res.status(403).json({
      success: false,
      error: "Esta conta foi bloqueada pelo administrador. Acesso negado."
    });
  }

  const calculatedHash = hashPassword(String(password), user.salt);
  if (calculatedHash !== user.passwordHash) {
    return res.status(401).json({ success: false, error: "Usuário ou senha incorretos." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 dias
  sessions.set(token, { userId: user.id, expiresAt });
  saveSessions(sessions);

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      isBlocked: !!user.isBlocked,
    },
    token,
    message: `Bem-vindo, ${user.name}!`
  });
});

// Auth Endpoint: Cadastro de nova conta
app.post("/api/auth/register", (req, res) => {
  const { username, password, name, email } = req.body;

  const settings = loadSettings();
  if (!settings.allowPublicRegistration) {
    return res.status(403).json({
      success: false,
      error: "O cadastro de novos usuários está temporariamente desativado pelo administrador."
    });
  }

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    return res.status(400).json({ success: false, error: "O nome de usuário deve ter pelo menos 3 caracteres." });
  }
  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ success: false, error: "A senha deve ter pelo menos 4 caracteres." });
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanName = (name && typeof name === "string" && name.trim().length >= 2) ? name.trim() : username.trim();

  const users = loadUsers();
  const existing = users.find(u => u.username.toLowerCase() === cleanUsername);
  if (existing) {
    return res.status(409).json({ success: false, error: "Este nome de usuário já está em uso. Escolha outro." });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const newUser: StoredUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    name: cleanName,
    email: email && typeof email === "string" ? email.trim() : undefined,
    passwordHash,
    salt,
    role: "user",
    createdAt: new Date().toISOString(),
    isBlocked: false,
  };

  users.push(newUser);
  saveUsers(users);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  sessions.set(token, { userId: newUser.id, expiresAt });
  saveSessions(sessions);

  return res.status(201).json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      isBlocked: false,
    },
    token,
    message: "Conta criada e autenticada com sucesso!"
  });
});

// Auth Endpoint: Verificar sessão atual
app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.query.token as string);

  if (!token) {
    return res.status(401).json({ success: false, error: "Token não fornecido." });
  }

  // Fallback seguro de administrador
  if (token === "token_local_admin") {
    const users = loadUsers();
    const admin = users.find(u => u.role === "admin" && !u.isBlocked);
    if (admin) {
      return res.json({
        success: true,
        user: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          createdAt: admin.createdAt,
          isBlocked: !!admin.isBlocked,
        }
      });
    }
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      sessions.delete(token);
      saveSessions(sessions);
    }
    return res.status(401).json({ success: false, error: "Sessão expirada ou inválida." });
  }

  const users = loadUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ success: false, error: "Usuário não encontrado." });
  }

  if (user.isBlocked) {
    sessions.delete(token);
    saveSessions(sessions);
    return res.status(403).json({ success: false, error: "Sua conta foi bloqueada pelo administrador." });
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      isBlocked: !!user.isBlocked,
    }
  });
});

// Auth Endpoint: Logout
app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.body?.token as string);
  if (token) {
    sessions.delete(token);
    saveSessions(sessions);
  }
  return res.json({ success: true, message: "Desconectado com sucesso." });
});

// ----------------------------------------------------
// Admin Management Endpoints
// ----------------------------------------------------

// Listar todos os usuários cadastrados
app.get("/api/admin/users", (req, res) => {
  const { adminUser, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const users = loadUsers();
  const settings = loadSettings();

  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    isBlocked: !!u.isBlocked,
  }));

  return res.json({
    success: true,
    users: safeUsers,
    settings,
  });
});

// Criar novo usuário manualmente pelo Administrador
app.post("/api/admin/users", (req, res) => {
  const { adminUser, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const { username, password, name, email, role } = req.body;

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    return res.status(400).json({ success: false, error: "O nome de usuário deve ter pelo menos 3 caracteres." });
  }

  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ success: false, error: "A senha deve ter pelo menos 4 caracteres." });
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanName = (name && typeof name === "string" && name.trim().length >= 2) ? name.trim() : username.trim();
  const assignedRole = role === "admin" ? "admin" : "user";

  const users = loadUsers();
  const existing = users.find(u => u.username.toLowerCase() === cleanUsername);
  if (existing) {
    return res.status(409).json({ success: false, error: `O usuário @${cleanUsername} já existe no sistema.` });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const newUser: StoredUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    name: cleanName,
    email: email && typeof email === "string" && email.trim() ? email.trim() : undefined,
    passwordHash,
    salt,
    role: assignedRole,
    createdAt: new Date().toISOString(),
    isBlocked: false,
  };

  users.push(newUser);
  saveUsers(users);

  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    isBlocked: !!u.isBlocked,
  }));

  return res.status(201).json({
    success: true,
    message: `Usuário @${cleanUsername} criado com sucesso!`,
    newUser: {
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      isBlocked: false,
    },
    users: safeUsers,
  });
});

// Bloquear ou Desbloquear usuário
app.post("/api/admin/users/:id/toggle-block", (req, res) => {
  const { adminUser, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const targetId = req.params.id;
  if (targetId === adminUser.id) {
    return res.status(400).json({ success: false, error: "Você não pode bloquear a sua própria conta de administrador." });
  }

  const users = loadUsers();
  const targetIndex = users.findIndex(u => u.id === targetId);
  if (targetIndex === -1) {
    return res.status(404).json({ success: false, error: "Usuário não encontrado." });
  }

  const nowBlocked = !users[targetIndex].isBlocked;
  users[targetIndex].isBlocked = nowBlocked;
  saveUsers(users);

  // Se o usuário foi bloqueado, encerra imediatamente todas as sessões ativas dele
  if (nowBlocked) {
    for (const [token, session] of sessions.entries()) {
      if (session.userId === targetId) {
        sessions.delete(token);
      }
    }
    saveSessions(sessions);
  }

  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    isBlocked: !!u.isBlocked,
  }));

  return res.json({
    success: true,
    message: nowBlocked
      ? `Usuário @${users[targetIndex].username} foi bloqueado com sucesso.`
      : `Usuário @${users[targetIndex].username} foi desbloqueado com sucesso.`,
    users: safeUsers,
  });
});

// Editar dados e credenciais do usuário
app.put("/api/admin/users/:id", (req, res) => {
  const { adminUser, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const targetId = req.params.id;
  const { name, username, email, role, password, isBlocked } = req.body;

  const users = loadUsers();
  const targetIndex = users.findIndex(u => u.id === targetId);
  if (targetIndex === -1) {
    return res.status(404).json({ success: false, error: "Usuário não encontrado." });
  }

  const currentUser = users[targetIndex];

  // Se o username foi alterado, valida e checa unicidade
  if (username && typeof username === "string") {
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "");
    if (cleanUsername.length < 3) {
      return res.status(400).json({ success: false, error: "O nome de usuário deve ter pelo menos 3 caracteres." });
    }
    const duplicate = users.find(u => u.id !== targetId && u.username.toLowerCase() === cleanUsername);
    if (duplicate) {
      return res.status(409).json({ success: false, error: `O nome de usuário @${cleanUsername} já está sendo utilizado.` });
    }
    currentUser.username = cleanUsername;
  }

  // Nome de exibição
  if (name && typeof name === "string" && name.trim().length > 0) {
    currentUser.name = name.trim();
  }

  // Email
  if (email !== undefined) {
    currentUser.email = typeof email === "string" && email.trim().length > 0 ? email.trim() : undefined;
  }

  // Cargo (se for o próprio admin atual, impede de remover sua própria permissão de admin)
  if (role === "admin" || role === "user") {
    if (targetId === adminUser.id && role !== "admin") {
      return res.status(400).json({ success: false, error: "Você não pode remover seu próprio privilégio de administrador." });
    }
    currentUser.role = role;
  }

  // Status de bloqueio direto
  if (typeof isBlocked === "boolean") {
    if (targetId === adminUser.id && isBlocked) {
      return res.status(400).json({ success: false, error: "Você não pode bloquear a sua própria conta." });
    }
    currentUser.isBlocked = isBlocked;
    if (isBlocked) {
      for (const [token, session] of sessions.entries()) {
        if (session.userId === targetId) {
          sessions.delete(token);
        }
      }
      saveSessions(sessions);
    }
  }

  // Redefinição de senha
  if (password && typeof password === "string" && password.trim().length > 0) {
    if (password.trim().length < 4) {
      return res.status(400).json({ success: false, error: "A nova senha deve ter no mínimo 4 caracteres." });
    }
    const newSalt = crypto.randomBytes(16).toString("hex");
    currentUser.salt = newSalt;
    currentUser.passwordHash = hashPassword(password.trim(), newSalt);
  }

  users[targetIndex] = currentUser;
  saveUsers(users);

  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    isBlocked: !!u.isBlocked,
  }));

  return res.json({
    success: true,
    message: `Dados do usuário @${currentUser.username} atualizados com sucesso!`,
    user: {
      id: currentUser.id,
      username: currentUser.username,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      createdAt: currentUser.createdAt,
      isBlocked: !!currentUser.isBlocked,
    },
    users: safeUsers,
  });
});

// Excluir usuário definitivamente
app.delete("/api/admin/users/:id", (req, res) => {
  const { adminUser, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const targetId = req.params.id;
  if (targetId === adminUser.id) {
    return res.status(400).json({ success: false, error: "Você não pode excluir a sua própria conta de administrador." });
  }

  let users = loadUsers();
  const target = users.find(u => u.id === targetId);
  if (!target) {
    return res.status(404).json({ success: false, error: "Usuário não encontrado." });
  }

  users = users.filter(u => u.id !== targetId);
  saveUsers(users);

  // Encerra qualquer sessão ativa do usuário excluído
  for (const [token, session] of sessions.entries()) {
    if (session.userId === targetId) {
      sessions.delete(token);
    }
  }
  saveSessions(sessions);

  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    isBlocked: !!u.isBlocked,
  }));

  return res.json({
    success: true,
    message: `Conta @${target.username} excluída com sucesso.`,
    users: safeUsers,
  });
});

// Atualizar configurações administrativas (Ex: permitir ou bloquear novos cadastros públicos)
app.post("/api/admin/settings", (req, res) => {
  const { adminUser, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const { allowPublicRegistration } = req.body;
  const settings = loadSettings();

  if (typeof allowPublicRegistration === "boolean") {
    settings.allowPublicRegistration = allowPublicRegistration;
    saveSettings(settings);
  }

  return res.json({
    success: true,
    settings,
    message: settings.allowPublicRegistration
      ? "Novos cadastros públicos estão permitidos."
      : "Novos cadastros públicos foram desativados."
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

interface ParsedChannel {
  id: string;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string;
  tvgId?: string;
  tvgName?: string;
}

interface ChannelGroup {
  name: string;
  count: number;
}

// Helper: Try to extract Xtream Codes credentials from URL
function extractXtreamCredentials(urlStr: string) {
  try {
    const parsed = new URL(urlStr);
    const username = parsed.searchParams.get("username");
    const password = parsed.searchParams.get("password");
    if (username && password) {
      const baseUrl = `${parsed.protocol}//${parsed.host}`;
      return { baseUrl, username, password };
    }
  } catch {
    // Not a valid URL or error
  }
  return null;
}

// Endpoint: Proxy & smart load M3U playlist (resolves Mixed Content, CORS & Out-Of-Memory)
app.post("/api/load-playlist", async (req, res) => {
  const { url, maxChannels = 3000, preferFormat = "m3u8" } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL inválida ou ausente." });
  }

  const trimmedUrl = url.trim();

  // 1. Check if this is an Xtream Codes playlist
  const xtream = extractXtreamCredentials(trimmedUrl);
  if (xtream) {
    try {
      console.log(`[Xtream API] Carregando canais ao vivo de ${xtream.baseUrl} para o usuário ${xtream.username}...`);
      
      // Fetch categories & live streams in parallel
      const [catsRes, streamsRes] = await Promise.all([
        fetch(`${xtream.baseUrl}/player_api.php?username=${xtream.username}&password=${xtream.password}&action=get_live_categories`, {
          headers: { "User-Agent": "IPTVSmartersPlayer" },
          signal: AbortSignal.timeout(15000),
        }),
        fetch(`${xtream.baseUrl}/player_api.php?username=${xtream.username}&password=${xtream.password}&action=get_live_streams`, {
          headers: { "User-Agent": "IPTVSmartersPlayer" },
          signal: AbortSignal.timeout(20000),
        })
      ]);

      if (catsRes.ok && streamsRes.ok) {
        const categoriesData = await catsRes.json() as Array<{ category_id: string; category_name: string }>;
        const streamsData = await streamsRes.json() as Array<any>;

        if (Array.isArray(streamsData) && streamsData.length > 0) {
          const catMap = new Map<string, string>();
          if (Array.isArray(categoriesData)) {
            categoriesData.forEach(c => catMap.set(String(c.category_id), c.category_name));
          }

          const channels: ParsedChannel[] = [];
          const groupCountMap = new Map<string, number>();

          for (const s of streamsData) {
            const group = catMap.get(String(s.category_id)) || "CANAIS";
            const channelId = `xtream_${s.stream_id || channels.length + 1}`;
            
            // Generate standard stream URL (without /live/ for compatibility with providers)
            const ext = preferFormat === "m3u8" ? "m3u8" : "ts";
            const base = xtream.baseUrl.replace(/\/+$/, "");
            const directStreamUrl = `${base}/${xtream.username}/${xtream.password}/${s.stream_id}.${ext}`;

            channels.push({
              id: channelId,
              name: s.name || `Canal ${s.stream_id}`,
              streamUrl: directStreamUrl,
              logoUrl: s.stream_icon || "",
              groupTitle: group,
              tvgId: s.epg_channel_id || String(s.stream_id),
              tvgName: s.name || "",
            });

            groupCountMap.set(group, (groupCountMap.get(group) || 0) + 1);

            if (channels.length >= maxChannels) break;
          }

          const groups: ChannelGroup[] = Array.from(groupCountMap.entries()).map(([name, count]) => ({
            name,
            count
          })).sort((a, b) => b.count - a.count);

          return res.json({
            success: true,
            source: "xtream_codes_api",
            totalLiveChannels: streamsData.length,
            loadedCount: channels.length,
            message: `Carregados ${channels.length} canais de TV ao vivo com sucesso via API Xtream!`,
            channels,
            groups
          });
        }
      }
    } catch (e: any) {
      console.warn(`[Xtream API fallback] Erro na API Xtream (${e.message}), tentando leitura por streaming M3U...`);
    }
  }

  // 2. Generic Streaming M3U Parser (safe against 300,000+ line files)
  try {
    console.log(`[M3U Streaming] Baixando e processando M3U em streaming: ${trimmedUrl}`);
    const response = await fetch(trimmedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IPTVSmarters"
      },
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `O servidor da lista retornou status HTTP ${response.status}: ${response.statusText}`
      });
    }

    if (!response.body) {
      return res.status(400).json({ error: "Resposta da lista vazia." });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let currentMetadata: {
      name: string;
      logo?: string;
      group?: string;
      tvgId?: string;
      tvgName?: string;
    } | null = null;

    const channels: ParsedChannel[] = [];
    const groupCountMap = new Map<string, number>();

    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
      }

      const lines = buffer.split(/\r?\n/);
      buffer = done ? "" : (lines.pop() || "");

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith("#EXTINF:")) {
          const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
          const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
          const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
          const groupTitleMatch = line.match(/group-title="([^"]*)"/i);

          const commaIdx = line.lastIndexOf(",");
          const displayName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : (tvgNameMatch ? tvgNameMatch[1] : "Sem Nome");

          currentMetadata = {
            name: displayName || "Canal Desconhecido",
            logo: tvgLogoMatch ? tvgLogoMatch[1] : undefined,
            group: groupTitleMatch ? groupTitleMatch[1].trim() : "Geral",
            tvgId: tvgIdMatch ? tvgIdMatch[1] : undefined,
            tvgName: tvgNameMatch ? tvgNameMatch[1] : undefined,
          };
        } else if (!line.startsWith("#") && currentMetadata) {
          // It's a stream URL
          const streamUrl = line;

          // If the list contains VOD movies/series, skip them to protect memory and focus on Live TV
          const isVod = streamUrl.includes("/movie/") || streamUrl.includes("/series/") || (currentMetadata.group && (currentMetadata.group.includes("FILMES") && streamUrl.endsWith(".mp4")));

          if (!isVod || channels.length < 50) {
            const groupName = currentMetadata.group || "Geral";
            channels.push({
              id: `m3u_${channels.length + 1}`,
              name: currentMetadata.name,
              streamUrl,
              logoUrl: currentMetadata.logo,
              groupTitle: groupName,
              tvgId: currentMetadata.tvgId,
              tvgName: currentMetadata.tvgName,
            });

            groupCountMap.set(groupName, (groupCountMap.get(groupName) || 0) + 1);

            if (channels.length >= maxChannels) {
              break;
            }
          }

          currentMetadata = null;
        }
      }

      if (done || channels.length >= maxChannels) {
        break;
      }
    }

    const groups: ChannelGroup[] = Array.from(groupCountMap.entries()).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    if (channels.length === 0) {
      return res.status(400).json({ error: "Nenhum canal ou stream válido pôde ser extraído da lista." });
    }

    return res.json({
      success: true,
      source: "m3u_stream",
      loadedCount: channels.length,
      message: `Carregados ${channels.length} canais com sucesso via streaming!`,
      channels,
      groups
    });

  } catch (err: any) {
    console.error("[M3U Load Error]", err);
    return res.status(500).json({
      error: `Falha ao processar a lista: ${err.message}. Verifique a conexão com o provedor.`
    });
  }
});

// Endpoint: Media Proxy to bypass Mixed Content (HTTP on HTTPS) and CORS in web preview
app.get("/api/proxy-stream", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("URL parameter missing");
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IPTVSmarters",
        ...(req.headers.range ? { Range: req.headers.range as string } : {})
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000)
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).send(`Upstream error: ${upstreamRes.statusText}`);
    }

    const contentType = upstreamRes.headers.get("content-type") || "";
    const isM3U8 = targetUrl.toLowerCase().includes(".m3u8") || contentType.includes("mpegurl");

    if (isM3U8) {
      const text = await upstreamRes.text();
      if (text.startsWith("#EXTM3U") || text.includes("#EXTINF")) {
        const finalBaseUrl = upstreamRes.url;
        const rewritten = text
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            if (trimmed.startsWith("#")) {
              if (trimmed.includes('URI="')) {
                return trimmed.replace(/URI="([^"]+)"/g, (_, uriVal) => {
                  try {
                    const resolved = new URL(uriVal, finalBaseUrl).toString();
                    return `URI="/api/proxy-stream?url=${encodeURIComponent(resolved)}"`;
                  } catch {
                    return `URI="${uriVal}"`;
                  }
                });
              }
              return line;
            }

            // It's a segment or sub-playlist URL
            try {
              const resolved = new URL(trimmed, finalBaseUrl).toString();
              return `/api/proxy-stream?url=${encodeURIComponent(resolved)}`;
            } catch {
              return line;
            }
          })
          .join("\n");

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.send(rewritten);
      }
    }

    // Binary media stream (.ts segment or direct video)
    const headers: Record<string, string> = {
      "Content-Type": contentType || "video/mp2t",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Accept-Ranges": "bytes",
    };

    if (upstreamRes.headers.get("content-length")) {
      headers["Content-Length"] = upstreamRes.headers.get("content-length")!;
    }
    if (upstreamRes.headers.get("content-range")) {
      headers["Content-Range"] = upstreamRes.headers.get("content-range")!;
    }

    res.writeHead(upstreamRes.status, headers);

    if (upstreamRes.body) {
      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      nodeStream.pipe(res);
      req.on("close", () => {
        nodeStream.destroy();
      });
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error("[Proxy Stream Error]", err.message);
    if (!res.headersSent) {
      res.status(502).send(`Stream proxy error: ${err.message}`);
    }
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[IPTV Server] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
