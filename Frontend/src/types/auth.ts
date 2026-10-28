export type UserRole = 'principal_investigator' | 'co_investigator' | 'researcher' | 'analyst' | 'coordinator' | 'guest';

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  role: UserRole;
  institution?: string;
  department?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface AuthSession {
  user: UserProfile | null;
  token?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: string | null;
}

