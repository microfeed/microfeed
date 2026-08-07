export interface AccountSessionSummary {
  createdAt: string;
  current: boolean;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  updatedAt: string;
  userAgent: string | null;
}

export interface AccountPasskeySummary {
  backedUp: boolean;
  createdAt: string | null;
  deviceType: string;
  id: string;
  name: string;
  provider: string | null;
}
