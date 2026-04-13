/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type QuestionStatus = 'unvisited' | 'answered' | 'flagged';

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  topic: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface PastAttempt {
  id: string;
  date: string;
  score: number;
  total: number;
  percentage: number;
  topicScores?: Record<string, { correct: number; total: number }>;
}

export interface Candidate {
  id: string;
  name: string;
  regNumber: string;
  role: 'candidate' | 'admin';
  examStatus: 'not-started' | 'in-progress' | 'completed';
  pastAttempts: PastAttempt[];
  attemptedQuestionIds?: string[];
}

export interface ExamSettings {
  durationMinutes: number;
  questionsPerExam: number;
  passingScore: number;
  allowAIHelp: boolean;
}

export interface ExamSession {
  id: string;
  candidateId: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  totalTimeLeft: number; // Seconds remaining for the whole exam
  questions: Question[];
  answers: Record<string, number>;
  flags: string[]; // Changed to string[] for JSON serialization
  currentQuestionIndex: number;
  questionTimers: Record<string, number>; // Seconds left for each question
  allowAIHelp?: boolean;
  violations?: { timestamp: string; type: string; message: string }[];
}
