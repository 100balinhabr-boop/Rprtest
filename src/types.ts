export interface Channel {
  id: string;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  userAgent?: string;
  isFavorite?: boolean;
}

export interface ChannelGroup {
  name: string;
  count: number;
}

export interface AndroidFile {
  name: string;
  path: string;
  category: 'manifest' | 'gradle' | 'model' | 'parser' | 'repository' | 'viewmodel' | 'adapter' | 'ui' | 'layout' | 'drawable';
  language: 'java' | 'xml' | 'groovy';
  description: string;
  content: string;
}

export type UserRole = 'AdminMaster' | 'AdminRevenda' | 'UsuarioComum' | 'admin' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  createdAt: string;
  isBlocked?: boolean;
  playlistUrl?: string;
  playlistName?: string;
  playlistUpdatedAt?: string;
  expirationDate?: string | null; // Data de vencimento YYYY-MM-DD ou ISO
  createdBy?: string; // Username ou ID do criador da conta
  createdByName?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserAccount;
  token?: string;
  error?: string;
  message?: string;
}

export type ViewMode = 'player' | 'code' | 'architecture' | 'parser_test';
