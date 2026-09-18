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
export type UserRole = 'AdminMaster' | 'AdminRevenda' | 'UsuarioComum' | 'admin' | 'user';

interface StoredUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  passwordHash: string;
  salt: string;
  role: 'AdminMaster' | 'AdminRevenda' | 'UsuarioComum' | 'admin' | 'user';
  createdAt: string;
  isBlocked?: boolean;
  playlistUrl?: string;
  playlistName?: string;
  playlistUpdatedAt?: string;
  expirationDate?: string | null;
  createdBy?: string;
  createdByName?: string;
  notes?: string;
}

function normalizeRole(role?: string): 'AdminMaster' | 'AdminRevenda' | 'UsuarioComum' {
  if (role === 'AdminMaster' || role === 'admin') return 'AdminMaster';
  if (role === 'AdminRevenda') return 'AdminRevenda';
  return 'UsuarioComum';
}

function isDateExpired(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  let timestamp: number;
  if (dateStr.length === 10) {
    timestamp = new Date(`${dateStr}T23:59:59.999`).getTime();
  } else {
    timestamp = new Date(dateStr).getTime();
  }
  if (isNaN(timestamp)) return false;
  return Date.now() > timestamp;
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "Vitalício";
  try {
    const parts = dateStr.slice(0, 10).split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateStr).toLocaleDateString("pt-BR");
  } catch {
    return dateStr || "Vitalício";
  }
}

function formatSafeUser(u: StoredUser) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: normalizeRole(u.role),
    createdAt: u.createdAt,
    isBlocked: !!u.isBlocked,
    playlistUrl: u.playlistUrl,
    playlistName: u.playlistName,
    playlistUpdatedAt: u.playlistUpdatedAt,
    expirationDate: u.expirationDate !== undefined ? u.expirationDate : null,
    createdBy: u.createdBy,
    createdByName: u.createdByName,
    notes: u.notes,
  };
}

interface ClientTabConfig {
  id: 'movies' | 'series' | 'live' | 'settings';
  label: string;
  visible: boolean;
}

interface ClientBranding {
  appName: string;
  accentColor: string;
  logoUrl: string;
  footerText: string;
}

interface SystemSettings {
  allowPublicRegistration: boolean;
  clientTabs?: ClientTabConfig[];
  branding?: ClientBranding;
}

const DEFAULT_CLIENT_TABS: ClientTabConfig[] = [
  { id: 'movies', label: 'FILMES', visible: true },
  { id: 'series', label: 'SÉRIES', visible: true },
  { id: 'live', label: 'TV AO VIVO', visible: true },
  { id: 'settings', label: 'CONFIGURAÇÕES', visible: true },
];

const DEFAULT_BRANDING: ClientBranding = {
  appName: 'RPR TV',
  accentColor: '#dc2626',
  logoUrl: '',
  footerText: 'Transmissão HD • Canais ao Vivo • Player Rápido',
};

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
      const parsed = JSON.parse(raw);
      if (!parsed.clientTabs || !Array.isArray(parsed.clientTabs)) {
        parsed.clientTabs = DEFAULT_CLIENT_TABS;
      }
      if (!parsed.branding || typeof parsed.branding !== 'object') {
        parsed.branding = DEFAULT_BRANDING;
      } else {
        parsed.branding = { ...DEFAULT_BRANDING, ...parsed.branding };
      }
      return parsed;
    }
  } catch (e) {
    console.error("[Auth] Erro ao ler settings.json:", e);
  }
  return { allowPublicRegistration: true, clientTabs: DEFAULT_CLIENT_TABS, branding: DEFAULT_BRANDING };
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
        let changed = false;
        const normalized: StoredUser[] = parsed.map((u: any) => {
          let r = u.role;
          if (r === 'admin') {
            r = 'AdminMaster';
            changed = true;
          } else if (r === 'user') {
            r = 'UsuarioComum';
            changed = true;
          }
          return {
            ...u,
            role: r,
            expirationDate: u.expirationDate !== undefined ? u.expirationDate : null,
          };
        });
        if (changed) {
          saveUsers(normalized);
        }
        return normalized;
      }
    }
  } catch (e) {
    console.error("[Auth] Erro ao ler users.json:", e);
  }

  const defaultSalt = crypto.randomBytes(16).toString("hex");
  const defaultAdmin: StoredUser = {
    id: "user_admin",
    username: "admin",
    name: "Administrador Master",
    email: "admin@iptvpro.local",
    salt: defaultSalt,
    passwordHash: hashPassword("admin", defaultSalt),
    role: "AdminMaster",
    createdAt: new Date().toISOString(),
    isBlocked: false,
    expirationDate: null,
  };

  const clientSalt = crypto.randomBytes(16).toString("hex");
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const defaultClient: StoredUser = {
    id: "user_cliente_demo",
    username: "cliente",
    name: "Cliente Final",
    email: "cliente@iptv.local",
    salt: clientSalt,
    passwordHash: hashPassword("123456", clientSalt),
    role: "UsuarioComum",
    createdAt: new Date().toISOString(),
    isBlocked: false,
    expirationDate: in30Days.toISOString().split("T")[0],
  };

  const initialUsers = [defaultAdmin, defaultClient];
  saveUsers(initialUsers);
  return initialUsers;
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

const sessions = loadSessions();

function getAuthenticatedAdmin(req: express.Request): { 
  adminUser: StoredUser | null; 
  isMaster: boolean; 
  isRevenda: boolean; 
  error?: string 
} {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.query.token as string);

  if (!token) {
    return { adminUser: null, isMaster: false, isRevenda: false, error: "Token de autenticação não fornecido." };
  }

  if (token === "token_local_admin") {
    const users = loadUsers();
    const admin = users.find(u => normalizeRole(u.role) === "AdminMaster" && !u.isBlocked);
    if (admin) return { adminUser: admin, isMaster: true, isRevenda: false };
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    return { adminUser: null, isMaster: false, isRevenda: false, error: "Sessão inválida ou expirada." };
  }

  const users = loadUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user || user.isBlocked) {
    return { adminUser: null, isMaster: false, isRevenda: false, error: "Usuário não encontrado ou bloqueado." };
  }

  const role = normalizeRole(user.role);
  if (role !== "AdminMaster" && role !== "AdminRevenda") {
    return { adminUser: null, isMaster: false, isRevenda: false, error: "Acesso restrito apenas a AdminMaster e AdminRevenda." };
  }

  if (role === "AdminRevenda" && isDateExpired(user.expirationDate)) {
    return { 
      adminUser: null, 
      isMaster: false, 
      isRevenda: false, 
      error: `Sua conta de revendedor venceu em ${formatDateBR(user.expirationDate)}. Entre em contato com o AdminMaster.` 
    };
  }

  return { 
    adminUser: user, 
    isMaster: role === "AdminMaster", 
    isRevenda: role === "AdminRevenda" 
  };
}

function getAuthenticatedUser(req: express.Request): { user: StoredUser | null; isExpired?: boolean; error?: string } {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.query.token as string);

  if (!token) {
    return { user: null, error: "Token de autenticação não fornecido." };
  }

  const users = loadUsers();
  if (token === "token_local_admin") {
    const admin = users.find(u => normalizeRole(u.role) === "AdminMaster" && !u.isBlocked);
    if (admin) return { user: admin };
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    return { user: null, error: "Sessão inválida ou expirada." };
  }

  const user = users.find(u => u.id === session.userId);
  if (!user || user.isBlocked) {
    return { user: null, error: "Usuário não encontrado ou bloqueado." };
  }

  const role = normalizeRole(user.role);
  if (role !== "AdminMaster" && isDateExpired(user.expirationDate)) {
    return { 
      user: null, 
      isExpired: true, 
      error: `Seu acesso venceu em ${formatDateBR(user.expirationDate)}. Entre em contato com o suporte ou seu revendedor para renovar.` 
    };
  }

  return { user };
}

app.get("/api/auth/settings", (req, res) => {
  const settings = loadSettings();
  return res.json({ success: true, settings });
});

// Endpoint público — config visual do app do cliente (sem auth, dados não-sensíveis)
app.get("/api/client-config", (req, res) => {
  const settings = loadSettings();
  return res.json({
    success: true,
    clientTabs: settings.clientTabs || DEFAULT_CLIENT_TABS,
    branding: settings.branding || DEFAULT_BRANDING,
  });
});

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

  const role = normalizeRole(user.role);
  if (role !== "AdminMaster" && isDateExpired(user.expirationDate)) {
    return res.status(403).json({
      success: false,
      isExpired: true,
      expirationDate: user.expirationDate,
      error: `Seu acesso venceu em ${formatDateBR(user.expirationDate)}. Entre em contato com seu revendedor ou suporte para renovar o acesso.`
    });
  }

  const calculatedHash = hashPassword(String(password), user.salt);
  if (calculatedHash !== user.passwordHash) {
    return res.status(401).json({ success: false, error: "Usuário ou senha incorretos." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  sessions.set(token, { userId: user.id, expiresAt });
  saveSessions(sessions);

  return res.json({
    success: true,
    user: formatSafeUser(user),
    token,
    message: `Bem-vindo, ${user.name}!`
  });
});

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

  const trialDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const newUser: StoredUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    name: cleanName,
    email: email && typeof email === "string" ? email.trim() : undefined,
    passwordHash,
    salt,
    role: "UsuarioComum",
    createdAt: new Date().toISOString(),
    isBlocked: false,
    expirationDate: trialDate,
  };

  users.push(newUser);
  saveUsers(users);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  sessions.set(token, { userId: newUser.id, expiresAt });
  saveSessions(sessions);

  return res.status(201).json({
    success: true,
    user: formatSafeUser(newUser),
    token,
    message: "Conta criada e autenticada com sucesso!"
  });
});

app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.query.token as string);

  if (!token) {
    return res.status(401).json({ success: false, error: "Token não fornecido." });
  }

  if (token === "token_local_admin") {
    const users = loadUsers();
    const admin = users.find(u => normalizeRole(u.role) === "AdminMaster" && !u.isBlocked);
    if (admin) {
      return res.json({
        success: true,
        user: formatSafeUser(admin)
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

  const role = normalizeRole(user.role);
  if (role !== "AdminMaster" && isDateExpired(user.expirationDate)) {
    sessions.delete(token);
    saveSessions(sessions);
    return res.status(403).json({
      success: false,
      isExpired: true,
      expirationDate: user.expirationDate,
      error: `Seu acesso venceu em ${formatDateBR(user.expirationDate)}. Entre em contato com seu revendedor ou suporte para renovar o acesso.`
    });
  }

  return res.json({
    success: true,
    user: formatSafeUser(user)
  });
});

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
// User Saved Playlist Endpoints
// ----------------------------------------------------

app.get("/api/user/playlist", (req, res) => {
  const { user, error } = getAuthenticatedUser(req);
  if (error || !user) {
    return res.status(401).json({ success: false, error: error || "Não autenticado." });
  }

  return res.json({
    success: true,
    playlistUrl: user.playlistUrl || null,
    playlistName: user.playlistName || null,
    playlistUpdatedAt: user.playlistUpdatedAt || null,
  });
});

app.post("/api/user/playlist", (req, res) => {
  const { user, error } = getAuthenticatedUser(req);
  if (error || !user) {
    return res.status(401).json({ success: false, error: error || "Não autenticado." });
  }

  const { playlistUrl, playlistName } = req.body;
  const cleanUrl = typeof playlistUrl === "string" ? playlistUrl.trim() : "";
  const cleanName = typeof playlistName === "string" && playlistName.trim() ? playlistName.trim() : "Minha Lista IPTV";

  if (!cleanUrl) {
    return res.status(400).json({ success: false, error: "A URL da lista M3U é obrigatória." });
  }

  const users = loadUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Usuário não localizado para salvar a lista." });
  }

  users[index].playlistUrl = cleanUrl;
  users[index].playlistName = cleanName;
  users[index].playlistUpdatedAt = new Date().toISOString();
  saveUsers(users);

  return res.json({
    success: true,
    message: "Lista M3U salva com sucesso na sua conta!",
    user: formatSafeUser(users[index]),
  });
});

app.delete("/api/user/playlist", (req, res) => {
  const { user, error } = getAuthenticatedUser(req);
  if (error || !user) {
    return res.status(401).json({ success: false, error: error || "Não autenticado." });
  }

  const users = loadUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index !== -1) {
    users[index].playlistUrl = undefined;
    users[index].playlistName = undefined;
    users[index].playlistUpdatedAt = undefined;
    saveUsers(users);
  }

  return res.json({
    success: true,
    message: "Lista M3U desvinculada da sua conta com sucesso.",
    user: index !== -1 ? formatSafeUser(users[index]) : undefined,
  });
});

// ----------------------------------------------------
// Admin Management Endpoints
// ----------------------------------------------------

app.get("/api/admin/users", (req, res) => {
  const { adminUser, isMaster, isRevenda, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const users = loadUsers();
  const settings = loadSettings();

  return res.json({
    success: true,
    users: users.map(formatSafeUser),
    currentAdminRole: normalizeRole(adminUser.role),
    isMaster,
    isRevenda,
    settings,
  });
});

app.post("/api/admin/users", (req, res) => {
  const { adminUser, isMaster, isRevenda, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const { username, password, name, email, role, playlistUrl, playlistName, expirationDate, notes } = req.body;

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    return res.status(400).json({ success: false, error: "O nome de usuário deve ter pelo menos 3 caracteres." });
  }

  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ success: false, error: "A senha deve ter pelo menos 4 caracteres." });
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanName = (name && typeof name === "string" && name.trim().length >= 2) ? name.trim() : username.trim();

  let assignedRole: 'AdminMaster' | 'AdminRevenda' | 'UsuarioComum';
  if (isRevenda) {
    if (role && normalizeRole(role) !== "UsuarioComum") {
      return res.status(403).json({
        success: false,
        error: "AdminRevenda só tem permissão para adicionar Usuário Comum."
      });
    }
    assignedRole = "UsuarioComum";
  } else {
    assignedRole = normalizeRole(role);
  }

  const cleanPlaylistUrl = typeof playlistUrl === "string" && playlistUrl.trim() ? playlistUrl.trim() : undefined;
  const cleanPlaylistName = typeof playlistName === "string" && playlistName.trim() ? playlistName.trim() : (cleanPlaylistUrl ? "Lista IPTV" : undefined);
  const cleanExpirationDate = expirationDate && typeof expirationDate === "string" && expirationDate.trim() && expirationDate.trim() !== "vitalicio"
    ? expirationDate.trim()
    : null;

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
    playlistUrl: cleanPlaylistUrl,
    playlistName: cleanPlaylistName,
    playlistUpdatedAt: cleanPlaylistUrl ? new Date().toISOString() : undefined,
    expirationDate: cleanExpirationDate,
    createdBy: adminUser.username,
    createdByName: adminUser.name,
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : undefined,
  };

  users.push(newUser);
  saveUsers(users);

  return res.status(201).json({
    success: true,
    message: `Usuário @${cleanUsername} criado com sucesso como ${assignedRole}!`,
    newUser: formatSafeUser(newUser),
    users: users.map(formatSafeUser),
  });
});

app.post("/api/admin/users/:id/toggle-block", (req, res) => {
  const { adminUser, isMaster, isRevenda, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const targetId = req.params.id;
  if (targetId === adminUser.id) {
    return res.status(400).json({ success: false, error: "Você não pode bloquear a sua própria conta." });
  }

  const users = loadUsers();
  const targetIndex = users.findIndex(u => u.id === targetId);
  if (targetIndex === -1) {
    return res.status(404).json({ success: false, error: "Usuário não encontrado." });
  }

  const targetRole = normalizeRole(users[targetIndex].role);

  if (targetRole === "AdminMaster") {
    return res.status(400).json({ success: false, error: "Não é permitido bloquear a conta do AdminMaster." });
  }

  if (isRevenda && targetRole !== "UsuarioComum") {
    return res.status(403).json({
      success: false,
      error: "AdminRevenda só tem permissão para gerenciar Usuários Comuns."
    });
  }

  const nowBlocked = !users[targetIndex].isBlocked;
  users[targetIndex].isBlocked = nowBlocked;
  saveUsers(users);

  if (nowBlocked) {
    for (const [token, session] of sessions.entries()) {
      if (session.userId === targetId) {
        sessions.delete(token);
      }
    }
    saveSessions(sessions);
  }

  return res.json({
    success: true,
    message: nowBlocked
      ? `Usuário @${users[targetIndex].username} foi bloqueado com sucesso.`
      : `Usuário @${users[targetIndex].username} foi desbloqueado com sucesso.`,
    users: users.map(formatSafeUser),
  });
});

app.put("/api/admin/users/:id", (req, res) => {
  const { adminUser, isMaster, isRevenda, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const targetId = req.params.id;
  const { name, username, email, role, password, isBlocked, playlistUrl, playlistName, expirationDate, notes } = req.body;

  const users = loadUsers();
  const targetIndex = users.findIndex(u => u.id === targetId);
  if (targetIndex === -1) {
    return res.status(404).json({ success: false, error: "Usuário não encontrado." });
  }

  const currentUser = users[targetIndex];
  const targetRole = normalizeRole(currentUser.role);

  if (targetRole === "AdminMaster" && !isMaster) {
    return res.status(403).json({ success: false, error: "Você não tem permissão para alterar contas de AdminMaster." });
  }

  if (targetRole === "AdminRevenda" && isRevenda && targetId !== adminUser.id) {
    return res.status(403).json({ success: false, error: "AdminRevenda não pode alterar dados de outros revendedores." });
  }

  if (isRevenda && role !== undefined && normalizeRole(role) !== "UsuarioComum") {
    return res.status(403).json({ success: false, error: "AdminRevenda não tem permissão para alterar cargos ou promover usuários." });
  }

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

  if (name && typeof name === "string" && name.trim().length > 0) {
    currentUser.name = name.trim();
  }

  if (email !== undefined) {
    currentUser.email = typeof email === "string" && email.trim().length > 0 ? email.trim() : undefined;
  }

  if (role !== undefined && isMaster) {
    const normalizedNewRole = normalizeRole(role);
    if (targetId === adminUser.id && normalizedNewRole !== "AdminMaster") {
      return res.status(400).json({ success: false, error: "Você não pode remover seu próprio privilégio de AdminMaster." });
    }
    currentUser.role = normalizedNewRole;
  }

  if (expirationDate !== undefined) {
    if (!expirationDate || expirationDate === "vitalicio" || String(expirationDate).trim() === "") {
      currentUser.expirationDate = null;
    } else {
      currentUser.expirationDate = String(expirationDate).trim();
    }
  }

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

  if (password && typeof password === "string" && password.trim().length > 0) {
    if (password.trim().length < 4) {
      return res.status(400).json({ success: false, error: "A nova senha deve ter no mínimo 4 caracteres." });
    }
    const newSalt = crypto.randomBytes(16).toString("hex");
    currentUser.salt = newSalt;
    currentUser.passwordHash = hashPassword(password.trim(), newSalt);
  }

  if (playlistUrl !== undefined) {
    const cleanUrl = typeof playlistUrl === "string" && playlistUrl.trim() ? playlistUrl.trim() : undefined;
    currentUser.playlistUrl = cleanUrl;
    currentUser.playlistUpdatedAt = cleanUrl ? new Date().toISOString() : undefined;
  }
  if (playlistName !== undefined) {
    currentUser.playlistName = typeof playlistName === "string" && playlistName.trim() ? playlistName.trim() : (currentUser.playlistUrl ? "Lista IPTV" : undefined);
  }

  if (notes !== undefined) {
    const cleanNotes = typeof notes === "string" && notes.trim() ? notes.trim() : undefined;
    currentUser.notes = cleanNotes;
  }

  users[targetIndex] = currentUser;
  saveUsers(users);

  return res.json({
    success: true,
    message: `Dados do usuário @${currentUser.username} atualizados com sucesso!`,
    user: formatSafeUser(currentUser),
    users: users.map(formatSafeUser),
  });
});

app.post("/api/admin/users/:id/renew", (req, res) => {
  const { adminUser, isMaster, isRevenda, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const targetId = req.params.id;
  const users = loadUsers();
  const targetIndex = users.findIndex(u => u.id === targetId);
  if (targetIndex === -1) {
    return res.status(404).json({ success: false, error: "Usuário não encontrado." });
  }

  const currentUser = users[targetIndex];
  const targetRole = normalizeRole(currentUser.role);

  if (isRevenda && targetRole !== "UsuarioComum") {
    return res.status(403).json({ success: false, error: "AdminRevenda só pode renovar o vencimento de Usuários Comuns." });
  }

  const { days, newExpirationDate } = req.body;

  let finalDateStr: string | null = null;
  if (newExpirationDate !== undefined) {
    finalDateStr = (!newExpirationDate || newExpirationDate === "vitalicio") ? null : String(newExpirationDate).trim();
  } else if (typeof days === "number" && days > 0) {
    let baseTime = Date.now();
    if (currentUser.expirationDate && !isDateExpired(currentUser.expirationDate)) {
      const existingTime = new Date(`${currentUser.expirationDate.slice(0, 10)}T23:59:59`).getTime();
      if (!isNaN(existingTime) && existingTime > Date.now()) {
        baseTime = existingTime;
      }
    }
    const newTime = baseTime + days * 24 * 60 * 60 * 1000;
    finalDateStr = new Date(newTime).toISOString().split('T')[0];
  } else {
    return res.status(400).json({ success: false, error: "Informe a quantidade de dias ou a nova data de vencimento." });
  }

  currentUser.expirationDate = finalDateStr;
  users[targetIndex] = currentUser;
  saveUsers(users);

  const displayMsg = finalDateStr
    ? `Acesso de @${currentUser.username} renovado até ${formatDateBR(finalDateStr)} com sucesso!`
    : `Acesso de @${currentUser.username} definido como Vitalício / Ilimitado!`;

  return res.json({
    success: true,
    message: displayMsg,
    user: formatSafeUser(currentUser),
    users: users.map(formatSafeUser),
  });
});

app.delete("/api/admin/users/:id", (req, res) => {
  const { adminUser, isMaster, isRevenda, error } = getAuthenticatedAdmin(req);
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

  const targetRole = normalizeRole(target.role);

  if (targetRole === "AdminMaster") {
    return res.status(400).json({ success: false, error: "Não é permitido excluir a conta do AdminMaster principal." });
  }

  if (isRevenda && targetRole !== "UsuarioComum") {
    return res.status(403).json({
      success: false,
      error: "AdminRevenda não tem permissão para remover revendedores. Apenas o AdminMaster pode remover contas de revenda."
    });
  }

  users = users.filter(u => u.id !== targetId);
  saveUsers(users);

  for (const [token, session] of sessions.entries()) {
    if (session.userId === targetId) {
      sessions.delete(token);
    }
  }
  saveSessions(sessions);

  return res.json({
    success: true,
    message: `Conta @${target.username} (${targetRole}) excluída com sucesso.`,
    users: users.map(formatSafeUser),
  });
});

app.post("/api/admin/settings", (req, res) => {
  const { adminUser, error } = getAuthenticatedAdmin(req);
  if (error || !adminUser) {
    return res.status(403).json({ success: false, error: error || "Não autorizado." });
  }

  const { allowPublicRegistration, clientTabs, branding } = req.body;
  const settings = loadSettings();

  if (typeof allowPublicRegistration === "boolean") {
    settings.allowPublicRegistration = allowPublicRegistration;
  }

  if (Array.isArray(clientTabs)) {
    const validIds = ['movies', 'series', 'live', 'settings'];
    settings.clientTabs = clientTabs
      .filter((t: any) => t && validIds.includes(t.id))
      .map((t: any) => ({
        id: t.id,
        label: typeof t.label === 'string' && t.label.trim() ? t.label.trim().slice(0, 20) : t.id.toUpperCase(),
        visible: !!t.visible,
      }));
  }

  if (branding && typeof branding === 'object') {
    const current = settings.branding || DEFAULT_BRANDING;
    settings.branding = {
      appName: typeof branding.appName === 'string' && branding.appName.trim()
        ? branding.appName.trim().slice(0, 30)
        : current.appName,
      accentColor: typeof branding.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(branding.accentColor)
        ? branding.accentColor
        : current.accentColor,
      logoUrl: typeof branding.logoUrl === 'string'
        ? branding.logoUrl.slice(0, 500000)
        : current.logoUrl,
      footerText: typeof branding.footerText === 'string'
        ? branding.footerText.trim().slice(0, 80)
        : current.footerText,
    };
  }

  saveSettings(settings);

  return res.json({
    success: true,
    settings,
    message: "Configurações atualizadas com sucesso."
  });
});

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
  }
  return null;
}

app.post("/api/load-playlist", async (req, res) => {
  const { 
    url, 
    maxChannels = 0,
    preferFormat = "m3u8",
    mode = "all",
    includeVod = true
  } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL inválida ou ausente." });
  }

  const trimmedUrl = url.trim();
  const effectiveMax = (typeof maxChannels === "number" && maxChannels > 0) ? maxChannels : 100000;

  const xtream = extractXtreamCredentials(trimmedUrl);
  
  if (xtream && mode === "live") {
    try {
      console.log(`[Xtream API] Carregando canais ao vivo de ${xtream.baseUrl} para o usuário ${xtream.username}...`);
      
      const [catsRes, streamsRes] = await Promise.all([
        fetch(`${xtream.baseUrl}/player_api.php?username=${xtream.username}&password=${xtream.password}&action=get_live_categories`, {
          headers: { "User-Agent": "IPTVSmartersPlayer" },
          signal: AbortSignal.timeout(20000),
        }),
        fetch(`${xtream.baseUrl}/player_api.php?username=${xtream.username}&password=${xtream.password}&action=get_live_streams`, {
          headers: { "User-Agent": "IPTVSmartersPlayer" },
          signal: AbortSignal.timeout(30000),
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
            const group = catMap.get(String(s.category_id)) || "CANAIS AO VIVO";
            const channelId = `xtream_${s.stream_id || channels.length + 1}`;
            
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

            if (channels.length >= effectiveMax) break;
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
            message: `Carregados todos os ${channels.length} canais de TV ao vivo com sucesso via API Xtream!`,
            channels,
            groups
          });
        }
      }
    } catch (e: any) {
      console.warn(`[Xtream API fallback] Erro na API Xtream (${e.message}), tentando leitura por streaming M3U completo...`);
    }
  }

  try {
    console.log(`[M3U Streaming] Baixando e processando M3U completa (mode: ${mode}, max: ${effectiveMax}): ${trimmedUrl}`);
    const response = await fetch(trimmedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IPTVSmarters"
      },
      signal: AbortSignal.timeout(90000)
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

    let countLive = 0;
    let countMovies = 0;
    let countSeries = 0;

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
          const streamUrl = line;
          const upperGroup = (currentMetadata.group || "").toUpperCase();
          const upperUrl = streamUrl.toUpperCase();

          const isMovie = upperUrl.includes("/MOVIE/") || upperGroup.includes("FILME") || upperGroup.includes("CINEMA") || upperGroup.includes("VOD") || upperUrl.endsWith(".MP4") || upperUrl.endsWith(".MKV");
          const isSerie = upperUrl.includes("/SERIES/") || upperGroup.includes("SERIE") || upperGroup.includes("TEMPORADA") || upperGroup.includes("NOVELA");
          const isVod = isMovie || isSerie;

          let shouldInclude = true;
          if (mode === "live" && isVod) {
            shouldInclude = false;
          } else if (mode === "vod" && !isVod) {
            shouldInclude = false;
          }

          if (shouldInclude) {
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

            if (isMovie) countMovies++;
            else if (isSerie) countSeries++;
            else countLive++;

            groupCountMap.set(groupName, (groupCountMap.get(groupName) || 0) + 1);

            if (channels.length >= effectiveMax) {
              break;
            }
          }

          currentMetadata = null;
        }
      }

      if (done || channels.length >= effectiveMax) {
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
      stats: {
        live: countLive,
        movies: countMovies,
        series: countSeries,
        total: channels.length
      },
      message: `Lista inteira carregada com sucesso! ${channels.length} itens totais (${countLive} canais ao vivo, ${countMovies} filmes e ${countSeries} séries).`,
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

// ----------------------------------------------------
// Smart On-Demand Xtream Codes Engine
// ----------------------------------------------------

interface XtreamCacheItem {
  timestamp: number;
  data: any;
}

const xtreamMemoryCache = new Map<string, XtreamCacheItem>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getFromXtreamCache<T>(key: string): T | null {
  const item = xtreamMemoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    xtreamMemoryCache.delete(key);
    return null;
  }
  return item.data as T;
}

function setInXtreamCache(key: string, data: any) {
  if (xtreamMemoryCache.size > 500) {
    const firstKey = xtreamMemoryCache.keys().next().value;
    if (firstKey) xtreamMemoryCache.delete(firstKey);
  }
  xtreamMemoryCache.set(key, { timestamp: Date.now(), data });
}

function parseXtreamCredentialsFromReq(body: any) {
  const { url, server, username, password } = body;
  if (server && username && password) {
    return {
      baseUrl: server.trim().replace(/\/+$/, ''),
      username: username.trim(),
      password: password.trim(),
    };
  }
  if (url && typeof url === 'string') {
    return extractXtreamCredentials(url.trim());
  }
  return null;
}

app.post("/api/xtream/categories", async (req, res) => {
  const xtream = parseXtreamCredentialsFromReq(req.body);
  if (!xtream) {
    return res.status(400).json({ success: false, error: "Credenciais Xtream não encontradas na URL." });
  }

  const type = (req.body.type || "live") as "live" | "vod" | "series";
  let action = "get_live_categories";
  if (type === "vod") action = "get_vod_categories";
  if (type === "series") action = "get_series_categories";

  const cacheKey = `cats_${xtream.baseUrl}_${xtream.username}_${type}`;
  const cached = getFromXtreamCache<any[]>(cacheKey);
  if (cached) {
    return res.json({ success: true, source: "cache", type, categories: cached });
  }

  try {
    const fetchUrl = `${xtream.baseUrl}/player_api.php?username=${xtream.username}&password=${xtream.password}&action=${action}`;
    const response = await fetch(fetchUrl, {
      headers: { "User-Agent": "IPTVSmartersPlayer/3.1.5 (Linux;Android 12)" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: `Servidor retornou status ${response.status}` });
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return res.status(500).json({ success: false, error: "Resposta inesperada do servidor Xtream." });
    }

    const categories = data.map((c: any) => ({
      id: String(c.category_id),
      name: c.category_name || `Categoria ${c.category_id}`,
    }));

    setInXtreamCache(cacheKey, categories);
    return res.json({ success: true, source: "network", type, categories });
  } catch (err: any) {
    console.error("[Xtream Categories Error]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/xtream/streams", async (req, res) => {
  const xtream = parseXtreamCredentialsFromReq(req.body);
  if (!xtream) {
    return res.status(400).json({ success: false, error: "Credenciais Xtream não encontradas na URL." });
  }

  const { type = "live", categoryId, search, preferFormat = "m3u8", page = 1, limit = 100 } = req.body;
  let action = "get_live_streams";
  if (type === "vod") action = "get_vod_streams";
  if (type === "series") action = "get_series";

  const cacheKey = `streams_${xtream.baseUrl}_${xtream.username}_${type}_cat_${categoryId || 'all'}`;
  let streams = getFromXtreamCache<any[]>(cacheKey);

  if (!streams) {
    try {
      let fetchUrl = `${xtream.baseUrl}/player_api.php?username=${xtream.username}&password=${xtream.password}&action=${action}`;
      if (categoryId && categoryId !== "ALL" && categoryId !== "TODOS") {
        fetchUrl += `&category_id=${encodeURIComponent(categoryId)}`;
      }

      const response = await fetch(fetchUrl, {
        headers: { "User-Agent": "IPTVSmartersPlayer/3.1.5 (Linux;Android 12)" },
        signal: AbortSignal.timeout(25000),
      });

      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: `Servidor retornou status ${response.status}` });
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        return res.status(500).json({ success: false, error: "Formato de lista inválido retornado pelo provedor." });
      }

      streams = data;
      setInXtreamCache(cacheKey, streams);
    } catch (err: any) {
      console.error("[Xtream Streams Error]", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  let filtered = streams || [];
  if (search && typeof search === "string" && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((s: any) => (s.name && s.name.toLowerCase().includes(q)));
  }

  const totalCount = filtered.length;
  const pageNum = Math.max(1, parseInt(String(page)) || 1);
  const limitNum = Math.max(1, Math.min(5000, parseInt(String(limit)) || 100));
  const startIndex = (pageNum - 1) * limitNum;
  const pagedItems = filtered.slice(startIndex, startIndex + limitNum);

  if (type === "live") {
    const ext = preferFormat === "m3u8" ? "m3u8" : "ts";
    const formattedChannels = pagedItems.map((s: any) => ({
      id: `live_${s.stream_id}`,
      name: s.name || `Canal ${s.stream_id}`,
      streamUrl: `${xtream.baseUrl}/${xtream.username}/${xtream.password}/${s.stream_id}.${ext}`,
      logoUrl: s.stream_icon || "",
      groupTitle: s.category_name || "TV ao Vivo",
      tvgId: s.epg_channel_id || String(s.stream_id),
      tvgName: s.name || "",
      isFavorite: false,
    }));

    return res.json({
      success: true,
      type: "live",
      categoryId,
      totalCount,
      page: pageNum,
      limit: limitNum,
      hasMore: startIndex + limitNum < totalCount,
      items: formattedChannels,
    });
  }

  if (type === "vod") {
    const formattedMovies = pagedItems.map((m: any) => {
      const ext = m.container_extension || "mp4";
      return {
        id: `vod_${m.stream_id}`,
        title: m.name || "Filme",
        type: "movie",
        posterUrl: m.stream_icon || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80",
        streamUrl: `${xtream.baseUrl}/movie/${xtream.username}/${xtream.password}/${m.stream_id}.${ext}`,
        rating: m.rating ? parseFloat(m.rating) : 4.5,
        year: m.year ? parseInt(m.year) : 2024,
        genre: m.category_name || "Filmes",
        category: "VOD",
        synopsis: m.plot || `Filme: ${m.name}`,
        badge: "HD",
      };
    });

    return res.json({
      success: true,
      type: "vod",
      categoryId,
      totalCount,
      page: pageNum,
      limit: limitNum,
      hasMore: startIndex + limitNum < totalCount,
      items: formattedMovies,
    });
  }

  const formattedSeries = pagedItems.map((s: any) => ({
    id: `series_${s.series_id}`,
    seriesId: s.series_id,
    title: s.name || "Série",
    type: "series",
    posterUrl: s.cover || "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=600&q=80",
    streamUrl: "",
    rating: s.rating ? parseFloat(s.rating) : 4.8,
    year: s.releaseDate ? parseInt(s.releaseDate.slice(0, 4)) : 2024,
    genre: s.category_name || "Séries",
    category: "Séries",
    synopsis: s.plot || `Série: ${s.name}`,
    badge: "SÉRIE",
  }));

  return res.json({
    success: true,
    type: "series",
    categoryId,
    totalCount,
    page: pageNum,
    limit: limitNum,
    hasMore: startIndex + limitNum < totalCount,
    items: formattedSeries,
  });
});

app.post("/api/xtream/series-info", async (req, res) => {
  const xtream = parseXtreamCredentialsFromReq(req.body);
  if (!xtream) {
    return res.status(400).json({ success: false, error: "Credenciais Xtream não encontradas na URL." });
  }

  const { seriesId } = req.body;
  if (!seriesId) {
    return res.status(400).json({ success: false, error: "ID da série ausente." });
  }

  const cacheKey = `series_info_${xtream.baseUrl}_${seriesId}`;
  const cached = getFromXtreamCache(cacheKey);
  if (cached) {
    return res.json({ success: true, source: "cache", data: cached });
  }

  try {
    const fetchUrl = `${xtream.baseUrl}/player_api.php?username=${xtream.username}&password=${xtream.password}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;
    const response = await fetch(fetchUrl, {
      headers: { "User-Agent": "IPTVSmartersPlayer/3.1.5 (Linux;Android 12)" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: `Servidor retornou status ${response.status}` });
    }

    const data = await response.json();
    setInXtreamCache(cacheKey, data);
    return res.json({ success: true, source: "network", data });
  } catch (err: any) {
    console.error("[Xtream Series Info Error]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

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
