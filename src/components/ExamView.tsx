/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Menu,
  X,
  XCircle,
  Sparkles,
  AlertTriangle,
  BrainCircuit,
  ArrowRight,
  Send,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Markdown from 'react-markdown';
import { Question, ExamSession } from '@/src/types';
import { geminiService } from '@/src/services/geminiService';
import { cn } from '@/lib/utils';
import { auth } from '@/src/lib/firebase';

import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';

interface ExamViewProps {
  session: ExamSession;
  onComplete: (session: ExamSession) => void;
  onUpdate: (session: ExamSession) => void;
}

export default function ExamView({ session: initialSession, onComplete, onUpdate }: ExamViewProps) {
  const [session, setSession] = useState<ExamSession>(initialSession);
  const [currentIndex, setCurrentIndex] = useState(initialSession.currentQuestionIndex);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastSelectedOption, setLastSelectedOption] = useState<number | null>(null);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [violationAlert, setViolationAlert] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', parts: { text: string }[] }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
    }
  }, [chatMessages, isChatLoading, isChatOpen]);

  // Proctoring: Enhanced Violation Detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const timestamp = new Date().toISOString();
        const violation = {
          timestamp,
          type: 'TAB_BLUR',
          message: 'Candidate navigated away from the examination tab.'
        };

        setSession(prev => {
          const updated = {
            ...prev,
            violations: [...(prev.violations || []), violation]
          };
          onUpdate(updated);
          return updated;
        });

        setViolationAlert("Warning: Navigating away from the exam tab is recorded as a violation.");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const violation = {
        timestamp: new Date().toISOString(),
        type: 'RIGHT_CLICK',
        message: 'Right-click is disabled during the exam.'
      };
      setViolationAlert(violation.message);
      setSession(prev => {
        const updated = {
          ...prev,
          violations: [...(prev.violations || []), violation]
        };
        onUpdate(updated);
        return updated;
      });
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const type = e.type === 'copy' ? 'COPY' : 'PASTE';
      const violation = {
        timestamp: new Date().toISOString(),
        type,
        message: `${type === 'COPY' ? 'Copying' : 'Pasting'} is disabled during the exam.`
      };
      setViolationAlert(violation.message);
      setSession(prev => {
        const updated = {
          ...prev,
          violations: [...(prev.violations || []), violation]
        };
        onUpdate(updated);
        return updated;
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        const violation = {
          timestamp: new Date().toISOString(),
          type: 'DEV_TOOLS',
          message: 'Accessing developer tools is prohibited.'
        };
        setViolationAlert(violation.message);
        setSession(prev => {
          const updated = {
            ...prev,
            violations: [...(prev.violations || []), violation]
          };
          onUpdate(updated);
          return updated;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onUpdate]);

  const currentQuestion = session.questions[currentIndex];
  const progress = session.questions.length > 0 
    ? (Object.keys(session.answers).length / session.questions.length) * 100 
    : 0;
  const [currentTimeLeft, setCurrentTimeLeft] = useState(60);
  const [totalTimeLeft, setTotalTimeLeft] = useState(session.totalTimeLeft || session.durationMinutes * 60);

  // Total Exam Timer
  useEffect(() => {
    if (totalTimeLeft <= 0) {
      onComplete(session);
      return;
    }

    const timer = setInterval(() => {
      setTotalTimeLeft(prev => {
        const next = Math.max(0, prev - 1);
        if (next % 30 === 0) { // Update Firestore every 30 seconds to save bandwidth
          onUpdate({ ...session, totalTimeLeft: next });
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [totalTimeLeft <= 0]);

  // Format time (HH:MM:SS)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Timer logic for current question
  useEffect(() => {
    // Reset timer when question changes or feedback is hidden
    if (!showFeedback) {
      setCurrentTimeLeft(60);
    }
  }, [currentIndex, showFeedback]);

  useEffect(() => {
    if (showFeedback) return; // Pause timer during feedback

    if (currentTimeLeft <= 0) {
      handleAutoSkip();
      return;
    }

    const timer = setInterval(() => {
      setCurrentTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentTimeLeft, showFeedback]);

  const handleAutoSkip = () => {
    if (currentIndex < session.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // If last question timer runs out, we might want to show the submit prompt
      // or just complete. Let's show the submit prompt by ensuring feedback is off
      // and we are on the last question.
      if (session.answers[currentQuestion.id] === undefined) {
        // Mark as skipped/unanswered if needed, but here we just move on
      }
      // For the last question, if timer runs out, we stay here but maybe show a "Time Up" message?
      // The user said "automatically move to the next question". 
      // If it's the last, there's no next.
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (session.answers[currentQuestion.id] !== undefined) return;

    setLastSelectedOption(optionIndex);
    const updatedSession = {
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: optionIndex
      },
      currentQuestionIndex: currentIndex
    };
    setSession(updatedSession);
    onUpdate(updatedSession);
    setShowFeedback(true);
  };

  const toggleFlag = () => {
    setSession((prev) => {
      const newFlags = [...prev.flags];
      const index = newFlags.indexOf(currentQuestion.id);
      if (index > -1) {
        newFlags.splice(index, 1);
      } else {
        newFlags.push(currentQuestion.id);
      }
      const next = { ...prev, flags: newFlags };
      onUpdate(next);
      return next;
    });
  };

  const jumpToNextFlagged = () => {
    const nextFlaggedIndex = session.questions.findIndex((q, idx) => 
      idx > currentIndex && session.flags.includes(q.id)
    );
    
    if (nextFlaggedIndex !== -1) {
      setCurrentIndex(nextFlaggedIndex);
    } else {
      // Wrap around
      const firstFlaggedIndex = session.questions.findIndex((q) => session.flags.includes(q.id));
      if (firstFlaggedIndex !== -1) setCurrentIndex(firstFlaggedIndex);
    }
  };

  const nextQuestion = () => {
    setShowFeedback(false);
    if (currentIndex < session.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevQuestion = () => {
    setShowFeedback(false);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user' as const, parts: [{ text: userMessage }] }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
      // Provide context about the current question
      const contextPrompt = chatMessages.length === 0 
        ? `I am currently looking at this question: "${currentQuestion.text}". The options are: ${currentQuestion.options.join(', ')}. The correct answer is option index ${currentQuestion.correctAnswer}. Explanation: ${currentQuestion.explanation}. My question is: ${userMessage}`
        : userMessage;

      const response = await geminiService.chatWithTutor(chatMessages, contextPrompt);
      setChatMessages([...newMessages, { role: 'model' as const, parts: [{ text: response }] }]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsChatLoading(false);
    }
  };

  const resetChat = () => {
    setChatMessages([]);
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex flex-col gap-2 md:gap-4 sticky top-0 z-30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden shrink-0"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm md:text-lg font-bold text-slate-900 leading-tight truncate">TRCN Professional Qualifying Exam</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="hidden sm:inline-block text-[9px] md:text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Session: {session.id.split('_')[1]}</span>
                <span className="text-[9px] md:text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Start: {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[9px] md:text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Dur: {session.durationMinutes}m</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6 shrink-0">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Progress</span>
              <div className="flex items-center gap-2 w-32">
                <Progress value={progress} className="h-1.5" />
                <span className="text-xs font-mono font-bold text-slate-700">{Math.round(progress)}%</span>
              </div>
            </div>
            
            <div className={cn(
              "flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full border-2 transition-colors",
              totalTimeLeft < 300 ? "bg-red-50 border-red-200 text-red-600 animate-pulse" : "bg-slate-50 border-slate-200 text-slate-700"
            )}>
              <Clock className="w-3.5 h-3.5 md:w-4 h-4" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-black uppercase tracking-widest leading-none mb-0.5">Time Remaining</span>
                <span className="text-sm md:text-xl font-mono font-bold leading-none">{formatTime(totalTimeLeft)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Violation Alert */}
      <AnimatePresence>
        {violationAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-600 text-white px-6 py-3 flex items-center justify-between z-50 sticky top-[72px] md:top-[88px]"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-sm font-bold">{violationAlert}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViolationAlert(null)}
              className="text-white hover:bg-white/20"
            >
              Acknowledge
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar Backdrop Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar Navigation */}
        <aside className={cn(
          "fixed inset-0 z-40 lg:relative lg:z-0 lg:flex w-80 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="flex flex-col h-full w-full">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Question Navigator</h2>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="grid grid-cols-5 gap-2 mb-8">
                {session.questions.map((q, idx) => {
                  const isAnswered = session.answers[q.id] !== undefined;
                  const isFlagged = session.flags.includes(q.id);
                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setIsSidebarOpen(false);
                        setShowFeedback(false);
                      }}
                      className={cn(
                        "h-10 w-10 rounded-lg text-sm font-bold transition-all flex items-center justify-center relative",
                        isCurrent ? "ring-2 ring-blue-600 ring-offset-2 scale-110 z-10" : "",
                        isAnswered ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400",
                        isFlagged ? "bg-amber-400 text-white shadow-lg shadow-amber-200" : "",
                        !isAnswered && !isFlagged && !isCurrent ? "hover:bg-slate-200" : ""
                      )}
                    >
                      {idx + 1}
                      {isFlagged && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute -top-1 -right-1"
                        >
                          <Flag className="w-3 h-3 text-amber-600 fill-current" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4 mb-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Legend</h3>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span>Answered</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <div className="w-3 h-3 rounded bg-amber-400" />
                    <span>Flagged</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <div className="w-3 h-3 rounded bg-slate-100" />
                    <span>Unanswered</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <div className="w-3 h-3 rounded ring-2 ring-blue-600 ring-offset-1" />
                    <span>Current Question</span>
                  </div>
                </div>
              </div>

              {session.flags.length > 0 && (
                <Button 
                  variant="outline" 
                  className="w-full gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold"
                  onClick={jumpToNextFlagged}
                >
                  <Flag className="w-4 h-4 fill-current" /> Jump to Flagged ({session.flags.length})
                </Button>
              )}
            </ScrollArea>
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
              <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
                Navigate questions or use the main screen to submit
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-12 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-2xl md:rounded-3xl">
                  <CardHeader className="bg-white border-b border-slate-100 p-5 md:p-8">
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="outline" className="text-[10px] md:text-xs text-blue-600 border-blue-200 bg-blue-50 px-2 md:px-3 py-0.5 md:py-1 font-bold">
                        Q{currentIndex + 1} of {session.questions.length}
                      </Badge>
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Question Timer</span>
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              className={cn(
                                "h-full transition-colors",
                                currentTimeLeft < 10 ? "bg-red-500" : "bg-blue-500"
                              )}
                              initial={{ width: "100%" }}
                              animate={{ width: `${(currentTimeLeft / 60) * 100}%` }}
                              transition={{ duration: 1, ease: "linear" }}
                            />
                          </div>
                        </div>
                        {session.allowAIHelp !== false && (
                          <Sheet open={isChatOpen} onOpenChange={(open) => {
                            setIsChatOpen(open);
                            if (open && chatMessages.length === 0) {
                              // Optional: initial greeting or context
                            }
                          }}>
                            <SheetTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold text-xs"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  Ask AI Tutor
                                </Button>
                              }
                            />
                          <SheetContent className="w-full sm:max-w-md flex flex-col p-0 h-full overflow-hidden">
                            <SheetHeader className="p-6 border-b">
                              <SheetTitle className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-blue-600" />
                                AI Exam Tutor
                              </SheetTitle>
                              <SheetDescription>
                                Ask questions about the current topic or specific question.
                              </SheetDescription>
                            </SheetHeader>
                            <ScrollArea className="flex-1 p-6">
                              <div className="space-y-4">
                                {chatMessages.length === 0 && (
                                  <div className="text-center py-8 text-slate-400">
                                    <BrainCircuit className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="text-xs font-medium">How can I help you with this question?</p>
                                  </div>
                                )}
                                {chatMessages.map((msg, i) => (
                                  <div key={i} className={cn(
                                    "flex flex-col gap-1 max-w-[85%]",
                                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                                  )}>
                                    <div className={cn(
                                      "p-3 rounded-2xl text-sm",
                                      msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-slate-100 text-slate-700 rounded-tl-none"
                                    )}>
                                      <Markdown>{msg.parts[0].text}</Markdown>
                                    </div>
                                  </div>
                                ))}
                                {isChatLoading && (
                                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Tutor is thinking...
                                  </div>
                                )}
                                <div ref={chatEndRef} />
                              </div>
                            </ScrollArea>
                            <div className="p-4 border-t bg-slate-50">
                              <form 
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  handleSendMessage();
                                }}
                                className="flex gap-2"
                              >
                                <Input 
                                  value={chatInput}
                                  onChange={(e) => setChatInput(e.target.value)}
                                  placeholder="Type your question..."
                                  className="rounded-xl h-10 text-sm"
                                  disabled={isChatLoading}
                                />
                                <Button 
                                  type="submit" 
                                  size="icon" 
                                  disabled={!chatInput.trim() || isChatLoading}
                                  className="rounded-xl h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-700"
                                >
                                  <Send className="w-4 h-4" />
                                </Button>
                              </form>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={resetChat}
                                className="mt-2 w-full text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-widest"
                              >
                                Clear Chat
                              </Button>
                            </div>
                          </SheetContent>
                        </Sheet>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleFlag}
                          className={cn(
                            "gap-1.5 md:gap-2 font-bold transition-colors h-8 md:h-10 text-[10px] md:text-xs",
                            session.flags.includes(currentQuestion.id) ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          <Flag className={cn("w-3.5 h-3.5 md:w-4 h-4", session.flags.includes(currentQuestion.id) && "fill-current")} />
                          <span className="hidden xs:inline">{session.flags.includes(currentQuestion.id) ? "Flagged" : "Flag"}</span>
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-lg md:text-2xl font-bold text-slate-800 leading-relaxed">
                      {currentQuestion.text}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 md:p-8 space-y-3 md:space-y-4 bg-white relative">
                    {currentQuestion.options.map((option, idx) => {
                      const isSelected = session.answers[currentQuestion.id] === idx;
                      const isCorrect = idx === currentQuestion.correctAnswer;
                      const isAnswered = session.answers[currentQuestion.id] !== undefined;

                      return (
                        <motion.button
                          key={idx}
                          initial={false}
                          animate={showFeedback ? {
                            scale: isSelected || isCorrect ? 1.02 : 0.98,
                            opacity: isAnswered && !isSelected && !isCorrect ? 0.6 : 1
                          } : { scale: 1, opacity: 1 }}
                          disabled={isAnswered}
                          onClick={() => handleAnswer(idx)}
                          className={cn(
                            "w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all flex items-center gap-3 md:gap-4 group relative overflow-hidden",
                            isSelected && !showFeedback ? "border-blue-600 bg-blue-50 text-blue-900 shadow-md" : 
                            showFeedback && isCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-lg shadow-emerald-100" :
                            showFeedback && isSelected && !isCorrect ? "border-red-500 bg-red-50 text-red-900 shadow-lg shadow-red-100" :
                            "border-slate-100 hover:border-slate-300 text-slate-600 hover:bg-slate-50",
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 md:w-8 md:h-8 rounded-xl flex items-center justify-center font-bold text-xs md:text-sm shrink-0 transition-colors",
                            isSelected && !showFeedback ? "bg-blue-600 text-white" :
                            showFeedback && isCorrect ? "bg-emerald-500 text-white" :
                            showFeedback && isSelected && !isCorrect ? "bg-red-500 text-white" :
                            "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                          )}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className="font-medium text-base md:text-lg leading-snug">{option}</span>
                          <AnimatePresence>
                            {showFeedback && isCorrect && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="ml-auto"
                              >
                                <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-500 shrink-0" />
                              </motion.div>
                            )}
                            {showFeedback && isSelected && !isCorrect && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="ml-auto"
                              >
                                <XCircle className="w-5 h-5 md:w-6 md:h-6 text-red-500 shrink-0" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })}

                    {/* Feedback Overlay */}
                    <AnimatePresence>
                      {showFeedback && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 md:mt-8 p-5 md:p-6 rounded-2xl bg-slate-900 text-white shadow-2xl"
                        >
                          <div className="flex items-center gap-3 mb-3 md:mb-4">
                            {session.answers[currentQuestion.id] === currentQuestion.correctAnswer ? (
                              <div className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-[10px] md:text-sm">
                                <Sparkles className="w-4 h-4 md:w-5 md:h-5" /> Correct Answer
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-red-400 font-black uppercase tracking-widest text-[10px] md:text-sm">
                                <AlertCircle className="w-4 h-4 md:w-5 md:h-5" /> Incorrect
                              </div>
                            )}
                          </div>
                          <p className="text-slate-300 text-xs md:text-sm leading-relaxed mb-5 md:mb-6 font-medium">
                            {currentQuestion.explanation || "No detailed explanation available for this question."}
                          </p>
                          <Button 
                            onClick={nextQuestion}
                            className="w-full bg-white text-slate-900 hover:bg-slate-100 font-bold py-5 md:py-6 rounded-xl text-sm md:text-base"
                          >
                            {currentIndex < session.questions.length - 1 ? "Next Question" : "View Results"}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                  <CardFooter className="bg-slate-50 border-t border-slate-100 p-5 md:p-6 flex flex-col gap-4 md:gap-6">
                    <div className="w-full flex justify-between gap-3">
                      <Button
                        variant="outline"
                        onClick={prevQuestion}
                        disabled={currentIndex === 0}
                        className="flex-1 md:flex-none gap-2 font-bold border-slate-200 text-slate-600 h-11 md:h-12 text-sm"
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous
                      </Button>
                      <Button
                        onClick={nextQuestion}
                        disabled={currentIndex === session.questions.length - 1}
                        className="flex-1 md:flex-none gap-2 font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 md:px-8 h-11 md:h-12 text-sm"
                      >
                        Next <span className="hidden xs:inline">Question</span> <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Submit Prompt on Last Question */}
                    {currentIndex === session.questions.length - 1 && session.answers[currentQuestion.id] !== undefined && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full p-5 md:p-6 bg-white rounded-2xl border-2 border-blue-100 shadow-sm space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm md:text-base">Ready to Submit?</h3>
                            <p className="text-[10px] md:text-xs text-slate-500 font-medium">You have reached the end of the examination.</p>
                          </div>
                        </div>
                        <div className="flex flex-col xs:flex-row gap-2 md:gap-3">
                          <Button 
                            variant="outline" 
                            className="flex-1 rounded-xl py-5 md:py-6 font-bold text-sm h-11 md:h-14"
                            onClick={() => setIsSidebarOpen(true)}
                          >
                            Review Questions
                          </Button>
                          <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                            <DialogTrigger
                              render={
                                <Button 
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 md:py-6 rounded-xl shadow-lg shadow-blue-200 text-sm h-11 md:h-14"
                                >
                                  Submit Exam
                                </Button>
                              }
                            />
                            <DialogContent className="sm:max-w-md rounded-2xl md:rounded-3xl p-6">
                              <DialogHeader>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                                  <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <DialogTitle className="text-xl md:text-2xl font-black text-slate-900">Final Submission</DialogTitle>
                                <DialogDescription className="text-xs md:text-sm text-slate-500 font-medium">
                                  Are you sure you want to submit your exam now? This action cannot be undone.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter className="flex flex-col sm:flex-row gap-2 md:gap-3 mt-4">
                                <Button 
                                  variant="outline" 
                                  onClick={() => setIsSubmitDialogOpen(false)}
                                  className="rounded-xl py-5 md:py-6 font-bold h-11 md:h-14"
                                >
                                  Back to Review
                                </Button>
                                <Button 
                                  onClick={() => onComplete(session)}
                                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-5 md:py-6 font-bold h-11 md:h-14"
                                >
                                  Yes, Submit Now
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </motion.div>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
