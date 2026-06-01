export type Role = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
