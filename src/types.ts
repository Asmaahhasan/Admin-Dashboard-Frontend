export interface Grade {
  id: string;
  name: string;
  order: number;
  trackId: string;
}

export interface Track {
  id: string;
  name: string;
  order: number;
  grades: Grade[];
}

export interface Stage {
  id: string;
  name: string;
  order: number;
  tracks: Track[];
}

export interface Semester {
  id: string;
  name: string;
}

export interface Subject {
  gradeSubjectId: string;
  subjectId: string;
  name: string;
}

export interface LessonActivityItem {
  id?: string;
  lessonActivityId?: string;
  type: string; // 'GAME' | 'PRESENTATION' | 'PDF' | 'VIDEO'
  title: string;
  url?: string;
  filePath?: string;
  thumbnailUrl?: string;
}

export interface LessonActivity {
  id: string;
  gradeSubjectId: string;
  syllabusWeekId?: string;
  lessonTitle: string;
  items: LessonActivityItem[];
}

export interface SyllabusWeek {
  id: string;
  gradeSubjectId: string;
  weekNumber: number;
  title: string;
  activity?: LessonActivity | null;
}
