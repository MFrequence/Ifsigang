export type DomainKey = "A" | "B" | "C" | "D" | "E";

export type DomainFilter = DomainKey | "ALL";

// Hand-written mirror of backend/models/sheet.py SheetOut — keep in sync by hand.
export interface Sheet {
  id: string;
  title: string;
  domain: DomainKey;
  unit: string;
  author: string;
  uploader_id: string;
  description: string;
  filename: string;
  mime: string;
  size: number;
  downloads: number;
  created_at: string;
}

// Mirror of UserOut in backend/models/user.py.
export interface User {
  id: string;
  email: string;
  name: string;
}

// Mirror of FlashcardOut in backend/models/flashcard.py.
export interface Flashcard {
  id: string;
  sheet_id: string;
  question: string;
  answer: string;
  distractors: string[];
  order: number;
}

// Mirror of StudyCard in backend/models/flashcard.py.
export interface StudyCard extends Flashcard {
  sheet_title: string;
  domain: string;
  unit: string;
  due: boolean;
}

// Mirror of DomainProgress / ProgressStats in backend/models/progress.py.
export interface DomainProgress {
  domain: string;
  answered: number;
  correct: number;
  accuracy: number;
}

export interface ProgressStats {
  answered: number;
  correct: number;
  accuracy: number;
  mastered: number;
  to_review: number;
  sessions_days: number;
  per_domain: DomainProgress[];
}

// Mirror of LeaderboardEntry in backend/models/progress.py.
export interface LeaderboardEntry {
  user_id: string;
  name: string;
  answered: number;
  correct: number;
  accuracy: number;
  sheets_uploaded: number;
  is_me: boolean;
}

export type StudyMode = "flash" | "quiz";
