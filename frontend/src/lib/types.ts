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
  must_change_password: boolean;
}

// Mirror of TemporaryPassword in backend/models/admin.py.
export interface TemporaryPassword {
  user_id: string;
  email: string;
  temporary_password: string;
}

// Mirror of SheetReportOut in backend/models/sheet.py.
export interface SheetReport {
  id: string;
  sheet_id: string;
  sheet_title: string;
  user_name: string;
  reason: string;
  created_at: string;
}

// Mirror of FlashcardOut in backend/models/flashcard.py.
export interface Flashcard {
  id: string;
  sheet_id: string;
  question: string;
  answer: string;
  distractors: string[];
  order: number;
  reports: number;
}

// Mirror of StudyCard in backend/models/flashcard.py.
export interface StudyCard extends Flashcard {
  sheet_title: string;
  domain: string;
  unit: string;
  due: boolean;
}

// Mirror of RevisionCard in backend/models/revision.py.
export interface RevisionCard extends StudyCard {
  level: number;
  stage: string;
  next_stage: string;
  is_new: boolean;
  overdue_days: number;
}

// Mirror of DayLoad / RevisionPlan in backend/models/revision.py.
export interface DayLoad {
  date: string;
  count: number;
}

export interface RevisionPlan {
  today: string;
  due_today: number;
  new_available: number;
  scheduled: number;
  mastered: number;
  total_cards: number;
  upcoming: DayLoad[];
}

// Mirror of StreakDay / Streak in backend/models/revision.py.
export interface StreakDay {
  date: string;
  completed: boolean;
  is_today: boolean;
}

export interface Streak {
  today: string;
  current: number;
  best: number;
  completed_today: boolean;
  remaining_today: number;
  total_days: number;
  days: StreakDay[];
}

// Mirror of AdminStatus / AdminUser in backend/models/admin.py.
export interface AdminStatus {
  is_admin: boolean;
  configured: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  created_at: string | null;
  sheets: number;
  answers: number;
  is_me: boolean;
}

// Mirror of ReportOut in backend/models/revision.py.
export interface CardReport {
  id: string;
  card_id: string;
  sheet_id: string;
  user_name: string;
  reason: string;
  created_at: string;
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

// Mirror of LexiconEntryOut in backend/models/reference.py.
export interface LexiconEntry {
  id: string;
  term: string;
  definition: string;
  category: string;
  author_name: string;
  is_mine: boolean;
  editable: boolean;
}

// Mirror of DrugSearchResult in backend/models/reference.py.
export interface DrugSearchResult {
  cis: string;
  label: string;
  form: string;
  routes: string[];
  holder: string;
  marketed: boolean;
  substances: string[];
  cached: boolean;
}

// Mirror of DrugCard in backend/models/reference.py.
export interface DrugCard {
  cis: string;
  label: string;
  dci: string;
  drug_class: string;
  indications: string[];
  dosage: string[];
  side_effects: string[];
  contraindications: string[];
  nursing_watch: string[];
  source: string;
}
