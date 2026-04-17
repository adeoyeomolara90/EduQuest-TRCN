/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Candidate, ExamSession, Question } from './types';
import { SAMPLE_QUESTIONS } from './constants';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ExamView from './components/ExamView';
import ResultsView from './components/ResultsView';
import AdminPanel from './components/AdminPanel';
import CookieConsent from './components/CookieConsent';
import PWAInstaller from './components/PWAInstaller';
import { AlertCircle, RefreshCcw, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp, Timestamp, addDoc, writeBatch } from 'firebase/firestore';
import { TRCN_QUESTIONS } from './data/trcn_questions';
import { handleFirestoreError, OperationType } from './lib/errorHandlers';
import { ExamSettings } from './types';

// Simple Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center space-y-6 border border-slate-100">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-slate-900">Something went wrong</h1>
              <p className="text-slate-500 font-medium">The application encountered an unexpected error. Please try refreshing the page.</p>
            </div>
            {this.state.error && (
              <pre className="bg-slate-50 p-4 rounded-xl text-xs font-mono text-red-500 text-left overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <Button 
              onClick={() => window.location.reload()}
              className="w-full py-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl gap-2"
            >
              <RefreshCcw className="w-4 h-4" /> Refresh Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type AppState = 'login' | 'dashboard' | 'exam' | 'results' | 'admin';

export default function App() {
  const [state, setState] = useState<AppState>('login');
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [examPool, setExamPool] = useState<Question[]>(SAMPLE_QUESTIONS);
  const [examSettings, setExamSettings] = useState<ExamSettings>({
    durationMinutes: 120,
    questionsPerExam: 50,
    passingScore: 50,
    allowAIHelp: true
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const isSeedingRef = React.useRef(false);

  // Auto-seeding logic
  useEffect(() => {
    const autoSeed = async () => {
      if (isSeedingRef.current || !candidate || candidate.role !== 'admin') return;
      
      try {
        // Only run if we have questions in the pool and it's less than the total available
        if (examPool.length < TRCN_QUESTIONS.length) {
          isSeedingRef.current = true;
          console.log("Auto-seeding missing questions...");
          const existingTexts = new Set(examPool.map(q => q.text));
          const questionsToSeed = TRCN_QUESTIONS.filter(q => !existingTexts.has(q.text));
          
          // Seed settings if missing
          const settingsDoc = await getDoc(doc(db, 'config', 'exam_settings'));
          if (!settingsDoc.exists()) {
            console.log("Seeding initial exam settings...");
            await setDoc(doc(db, 'config', 'exam_settings'), examSettings);
          }

          if (questionsToSeed.length > 0) {
            const BATCH_SIZE = 500;
            for (let i = 0; i < questionsToSeed.length; i += BATCH_SIZE) {
              const batch = writeBatch(db);
              const currentBatch = questionsToSeed.slice(i, i + BATCH_SIZE);
              for (const q of currentBatch) {
                const { id, ...qData } = q;
                const newDocRef = doc(collection(db, 'questions'));
                batch.set(newDocRef, qData);
              }
              await batch.commit();
              console.log(`Seeded batch ${Math.floor(i/BATCH_SIZE) + 1}`);
            }
            // Refresh the pool after seeding
            const qSnapshot = await getDocs(collection(db, 'questions'));
            const questions = qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
            setExamPool(questions);
          }
        }
      } catch (error) {
        console.error("Auto-seed error:", error);
      } finally {
        isSeedingRef.current = false;
      }
    };
    autoSeed();
  }, [examPool.length, candidate?.role]);

  // Auth Listener
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        setIsLoading(true);
        unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const isAdminEmail = user.email?.toLowerCase() === 'imageandkolors@gmail.com';
            const role = isAdminEmail ? 'admin' : (userData.role || 'candidate');
            
            setCandidate({
              id: user.uid,
              name: userData.name,
              regNumber: userData.regNumber,
              role: role,
              examStatus: userData.examStatus || 'not-started',
              pastAttempts: userData.pastAttempts || [],
              attemptedQuestionIds: userData.attemptedQuestionIds || []
            });
            
            // Auto-update role in Firestore if it's the admin email but role is not admin
            if (isAdminEmail && userData.role !== 'admin') {
              updateDoc(doc(db, 'users', user.uid), { role: 'admin' }).catch(console.error);
            }
            
            // Check for active session
            const checkSession = async () => {
              try {
                const sessionsQuery = query(
                  collection(db, 'sessions'),
                  where('candidateId', '==', user.uid),
                  where('status', '==', 'active')
                );
                const sessionsSnapshot = await getDocs(sessionsQuery);
                if (!sessionsSnapshot.empty) {
                  const sessionData = sessionsSnapshot.docs[0].data();
                  setSession({
                    ...sessionData,
                    id: sessionsSnapshot.docs[0].id
                  } as ExamSession);
                }
              } catch (error) {
                console.error("Error fetching session:", error);
              }
            };
            checkSession();
            setState('dashboard');
          } else {
            // User exists in Auth but not in Firestore yet
            setState('login');
          }
          setIsAuthReady(true);
          setIsLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          setIsAuthReady(true);
          setIsLoading(false);
        });
      } else {
        setCandidate(null);
        setSession(null);
        setState('login');
        setIsAuthReady(true);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Load exam pool from Firestore
  useEffect(() => {
    if (!isAuthReady || !candidate) return;

    const unsubscribe = onSnapshot(collection(db, 'questions'), (snapshot) => {
      if (!snapshot.empty) {
        const questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setExamPool(questions);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'questions');
    });
    return () => unsubscribe();
  }, [isAuthReady, !!candidate]);

  // Load exam settings
  useEffect(() => {
    if (!isAuthReady || !candidate) return;
    const unsubscribe = onSnapshot(doc(db, 'config', 'exam_settings'), (snapshot) => {
      if (snapshot.exists()) {
        setExamSettings(snapshot.data() as ExamSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/exam_settings');
    });
    return () => unsubscribe();
  }, [isAuthReady, !!candidate]);

  const handleLogin = async () => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Check if user already exists in Firestore
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', user.uid));
      } catch (error) {
        console.error("Error fetching user profile during login:", error);
        throw new Error(`Profile fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      if (!userDoc || !userDoc.exists()) {
        const isAdminUser = user.email?.toLowerCase() === 'imageandkolors@gmail.com';
        const userData = {
          uid: user.uid,
          name: user.displayName || 'Candidate',
          email: user.email,
          regNumber: isAdminUser ? 'ADMIN' : `TRCN/PQE/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
          role: isAdminUser ? 'admin' : 'candidate',
          examStatus: 'not-started',
          pastAttempts: [],
          createdAt: serverTimestamp()
        };

        try {
          await setDoc(doc(db, 'users', user.uid), userData);
        } catch (error) {
          console.error("Error creating user profile during login:", error);
          throw new Error(`Profile creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      let message = error.message || "An unexpected error occurred during login.";
      
      if (error.code === 'auth/configuration-not-found') {
        message = "Auth Configuration Error: Please ensure you have enabled 'Google' as a Sign-in provider in your Firebase Console and added the app domains to 'Authorized Domains'.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = "Unauthorized Domain: This domain is not authorized in your Firebase Console for authentication.";
      }
      
      setLoginError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setState('login');
      setCandidate(null);
      setSession(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const startExam = async (topic?: string) => {
    if (!candidate || !auth.currentUser) return;
    
    setIsLoading(true);
    try {
      // Filter out questions already attempted by this candidate
      const attemptedIds = candidate.attemptedQuestionIds || [];
      let availableQuestions = examPool.filter(q => !attemptedIds.includes(q.id));
      
      // Filter by topic if provided
      if (topic && topic !== 'All Subjects') {
        availableQuestions = availableQuestions.filter(q => q.topic === topic);
      }

      // If not enough new questions, use all questions from the pool (filtered by topic if needed)
      let poolToUse = availableQuestions;
      if (poolToUse.length < 50) {
        poolToUse = topic && topic !== 'All Subjects' 
          ? examPool.filter(q => q.topic === topic)
          : examPool;
      }
      
      // Shuffle and pick questions based on settings
      const selectedQuestions = [...poolToUse]
        .sort(() => Math.random() - 0.5)
        .slice(0, examSettings.questionsPerExam);

      if (selectedQuestions.length === 0) {
        throw new Error("No questions available for the selected subject.");
      }

      const newSessionData = {
        candidateId: auth.currentUser.uid,
        startTime: new Date().toISOString(),
        durationMinutes: examSettings.durationMinutes,
        totalTimeLeft: examSettings.durationMinutes * 60,
        questions: selectedQuestions,
        answers: {},
        flags: [],
        currentQuestionIndex: 0,
        questionTimers: selectedQuestions.reduce((acc, q) => ({ ...acc, [q.id]: 60 }), {}),
        allowAIHelp: examSettings.allowAIHelp,
        status: 'active',
        violations: []
      };
      
      const sessionRef = doc(collection(db, 'sessions'));
      await setDoc(sessionRef, newSessionData);
      
      setSession({ ...newSessionData, id: sessionRef.id } as ExamSession);
      setState('exam');
    } catch (error) {
      console.error("Start exam error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resumeExam = () => {
    setState('exam');
  };

  const updateSession = async (updatedSession: ExamSession) => {
    setSession(updatedSession);
    if (updatedSession.id) {
      try {
        await updateDoc(doc(db, 'sessions', updatedSession.id), {
          answers: updatedSession.answers,
          flags: updatedSession.flags,
          currentQuestionIndex: updatedSession.currentQuestionIndex,
          questionTimers: updatedSession.questionTimers,
          violations: updatedSession.violations || []
        });
      } catch (error) {
        console.error("Update session error:", error);
      }
    }
  };

  const completeExam = async (finalSession: ExamSession) => {
    if (!candidate || !auth.currentUser || !finalSession.id) return;

    setIsLoading(true);
    try {
      const score = finalSession.questions.reduce((acc, q) => {
        return acc + (finalSession.answers[q.id] === q.correctAnswer ? 1 : 0);
      }, 0);
      const percentage = Math.round((score / finalSession.questions.length) * 100);

      // Calculate topic scores
      const topicScores: Record<string, { correct: number; total: number }> = {};
      finalSession.questions.forEach(q => {
        const topic = q.topic || 'General';
        if (!topicScores[topic]) topicScores[topic] = { correct: 0, total: 0 };
        topicScores[topic].total++;
        if (finalSession.answers[q.id] === q.correctAnswer) {
          topicScores[topic].correct++;
        }
      });

      const newAttempt = {
        id: finalSession.id,
        date: new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
        score,
        total: finalSession.questions.length,
        percentage,
        topicScores
      };

      const updatedPastAttempts = [newAttempt, ...candidate.pastAttempts];
      const newAttemptedIds = Array.from(new Set([
        ...(candidate.attemptedQuestionIds || []),
        ...finalSession.questions.map(q => q.id)
      ]));

      // Update User Profile
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        pastAttempts: updatedPastAttempts,
        attemptedQuestionIds: newAttemptedIds,
        examStatus: 'completed'
      });

      // Update Session
      await updateDoc(doc(db, 'sessions', finalSession.id), {
        status: 'completed',
        endTime: new Date().toISOString(),
        score,
        percentage
      });

      setCandidate({
        ...candidate,
        pastAttempts: updatedPastAttempts,
        attemptedQuestionIds: newAttemptedIds,
        examStatus: 'completed'
      });
      
      setSession({
        ...finalSession,
        endTime: new Date().toISOString()
      });

      setState('results');
    } catch (error) {
      console.error("Complete exam error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const restart = () => {
    setState('dashboard');
    setSession(null);
  };

  const handleAdminQuestions = async (newQuestions: Question[]) => {
    setIsLoading(true);
    try {
      for (const q of newQuestions) {
        // Remove id if it's a temporary one from generator
        const { id, ...questionData } = q;
        await addDoc(collection(db, 'questions'), questionData);
      }
    } catch (error) {
      console.error("Admin questions error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">Initializing EduQuest...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="antialiased text-slate-900 selection:bg-blue-100 selection:text-blue-900">
        <div className="fixed top-4 right-4 z-50">
          {candidate?.role === 'admin' && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setState(state === 'admin' ? 'dashboard' : 'admin')}
              className="bg-white/80 backdrop-blur shadow-sm border border-slate-100 rounded-full hover:bg-white"
            >
              <Settings className="w-5 h-5 text-slate-400" />
            </Button>
          )}
        </div>

        <CookieConsent />
        <PWAInstaller />

        {state === 'login' && <Login onLogin={handleLogin} error={loginError} />}
        {state === 'dashboard' && candidate && (
          <Dashboard 
            candidate={candidate} 
            examSettings={examSettings}
            onStart={(topic) => startExam(topic)} 
            onResume={resumeExam}
            onLogout={handleLogout}
            onOpenAdmin={() => setState('admin')}
            hasActiveSession={!!session}
          />
        )}
        {state === 'exam' && session && (
          <ExamView 
            session={session} 
            onComplete={completeExam} 
            onUpdate={updateSession}
          />
        )}
        {state === 'results' && session && candidate && (
          <div className="min-h-screen bg-slate-50">
            <ResultsView 
              session={session} 
              candidate={candidate} 
              passingScore={examSettings.passingScore}
              onRestart={restart} 
            />
          </div>
        )}
        {state === 'admin' && (
          <AdminPanel 
            examSettings={examSettings}
            onQuestionsGenerated={handleAdminQuestions} 
            onClose={() => setState('dashboard')} 
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
