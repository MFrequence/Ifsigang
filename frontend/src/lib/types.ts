export type DomainKey = "A" | "B" | "C" | "D" | "E";

export type DomainFilter = DomainKey | "ALL";

// Hand-written mirror of backend/models/sheet.py SheetOut — keep in sync by hand.
export interface Sheet {
  id: string;
  title: string;
  domain: DomainKey;
  author: string;
  description: string;
  filename: string;
  mime: string;
  size: number;
  downloads: number;
  created_at: string;
}

// Mirror of UnlockStatus in backend/models/sheet.py.
export interface UnlockStatus {
  unlocked: boolean;
}
