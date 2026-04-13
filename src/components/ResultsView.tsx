/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  Trophy, 
  BarChart3, 
  BookOpen, 
  RotateCcw,
  ChevronRight,
  Sparkles,
  Flag,
  MessageSquare,
  Send,
  Loader2,
  User,
  Bot,
  Award,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ExamSession, Question, Candidate, PastAttempt } from '@/src/types';
import { geminiService } from '@/src/services/geminiService';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import Certificate from './Certificate';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer 
} from 'recharts';

import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';

interface ResultsViewProps {
  session: ExamSession;
  candidate: Candidate;
  passingScore: number;
  onRestart: () => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function ResultsView({ session, candidate, passingScore, onRestart }: ResultsViewProps) {
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  const score = session.questions.reduce((acc, q) => {
    return acc + (session.answers[q.id] === q.correctAnswer ? 1 : 0);
  }, 0);

  const percentage = (score / session.questions.length) * 100;
  const isPassed = percentage >= passingScore;

  // Calculate topic performance
  const topicDataMap: Record<string, { correct: number; total: number }> = {};
  session.questions.forEach(q => {
    const topic = q.topic || 'General';
    if (!topicDataMap[topic]) topicDataMap[topic] = { correct: 0, total: 0 };
    topicDataMap[topic].total++;
    if (session.answers[q.id] === q.correctAnswer) {
      topicDataMap[topic].correct++;
    }
  });

  const radarData = Object.entries(topicDataMap).map(([topic, data]) => ({
    topic,
    score: Math.round((data.correct / data.total) * 100),
    fullMark: 100
  }));

  const handleExplain = async (question: Question) => {
    if (explanations[question.id]) return;
    
    setExplainingId(question.id);
    const userAnswerIndex = session.answers[question.id];
    
    const explanation = await geminiService.explainConcept(question, userAnswerIndex);
    setExplanations(prev => ({ ...prev, [question.id]: explanation }));
    setExplainingId(null);
  };

  const handleSendMessage = async (questionId: string) => {
    if (!inputMessage.trim() || isSending) return;

    const userMsg: ChatMessage = { role: 'user', text: inputMessage };
    const currentChat = chats[questionId] || [];
    const updatedChat = [...currentChat, userMsg];
    
    setChats(prev => ({ ...prev, [questionId]: updatedChat }));
    setInputMessage('');
    setIsSending(true);

    try {
      const history = updatedChat.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const response = await geminiService.chatWithTutor(history, inputMessage);
      setChats(prev => ({
        ...prev,
        [questionId]: [...updatedChat, { role: 'model', text: response }]
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${questionId}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 p-4 md:p-12 font-sans overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 pb-20 md:pb-0">
        {/* Score Hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-200 border border-slate-100"
        >
          <div className="absolute top-0 right-0 p-12 opacity-5 hidden md:block">
            <Trophy className="w-64 h-64" />
          </div>
          
          <div className="p-6 md:p-12 flex flex-col md:flex-row items-center gap-8 md:gap-12 relative z-10">
            <div className="flex-shrink-0 relative">
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 md:border-8 border-slate-50 flex items-center justify-center relative">
                <svg className="w-full h-full -rotate-90 overflow-visible">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    fill="none"
                    stroke={isPassed ? "#10b981" : "#ef4444"}
                    strokeWidth="8%"
                    strokeDasharray="283%"
                    strokeDashoffset={`${283 - (283 * percentage) / 100}%`}
                    className="transition-all duration-1000 ease-out"
                    pathLength="100"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl md:text-5xl font-black text-slate-900">{Math.round(percentage)}%</span>
                  <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Score</span>
                </div>
              </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-3 md:space-y-4">
              <Badge className={cn(
                "px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-sm font-bold uppercase tracking-wider mb-1 md:mb-2",
                isPassed ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-red-100 text-red-700 hover:bg-red-100"
              )}>
                {isPassed ? "Examination Passed" : "Examination Failed"}
              </Badge>
              <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                {isPassed ? "Congratulations, Professional!" : "Keep Pushing, Educator!"}
              </h1>
              <p className="text-slate-500 text-sm md:text-lg font-medium max-w-lg leading-relaxed">
                You correctly answered {score} out of {session.questions.length} questions. 
                {isPassed 
                  ? " You have demonstrated the professional standards required." 
                  : " A minimum score of 60% is required for certification. Review the concepts below to improve your performance."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-2 md:pt-4 justify-center md:justify-start">
                <Button onClick={onRestart} variant="outline" className="gap-2 font-bold border-slate-200 h-11 md:h-12 text-sm">
                  <RotateCcw className="w-4 h-4" /> Retake Exam
                </Button>
                {isPassed && (
                  <Button 
                    onClick={() => setShowCertificate(true)}
                    className="gap-2 font-bold bg-blue-600 hover:bg-blue-700 text-white h-11 md:h-12 text-sm shadow-lg shadow-blue-500/20"
                  >
                    <Award className="w-4 h-4" /> View Certificate <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Detailed Breakdown */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          <div className="md:col-span-2 space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3">
              <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              Question Review
            </h2>
            <div className="space-y-4">
              {session.questions.map((q, idx) => {
                const userAnswer = session.answers[q.id];
                const isCorrect = userAnswer === q.correctAnswer;
                const showExplanation = explanations[q.id];

                return (
                  <Card key={q.id} className="border-none shadow-md shadow-slate-200/50 overflow-hidden rounded-2xl">
                    <CardHeader className="bg-white border-b border-slate-50 p-5 md:p-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Question {idx + 1}</span>
                        <div className="flex items-center gap-2">
                          {session.flags.includes(q.id) && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-100 gap-1 md:gap-1.5 font-bold text-[9px] md:text-xs">
                              <Flag className="w-3 h-3 md:w-3.5 md:h-3.5 fill-current" /> Flagged
                            </Badge>
                          )}
                          {isCorrect ? (
                            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 gap-1 md:gap-1.5 font-bold text-[9px] md:text-xs">
                              <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Correct
                            </Badge>
                          ) : (
                            <Badge className="bg-red-50 text-red-600 border-red-100 gap-1 md:gap-1.5 font-bold text-[9px] md:text-xs">
                              <XCircle className="w-3 h-3 md:w-3.5 md:h-3.5" /> Incorrect
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-base md:text-lg font-bold text-slate-800 leading-snug">
                        {q.text}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 md:p-6 space-y-4">
                      <div className="grid gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div 
                            key={oIdx}
                            className={cn(
                              "p-3 rounded-lg text-xs md:text-sm font-medium flex items-center gap-3",
                              oIdx === q.correctAnswer ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : 
                              oIdx === userAnswer ? "bg-red-50 text-red-800 border border-red-100" : "bg-slate-50 text-slate-500"
                            )}
                          >
                            <div className={cn(
                              "w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold shrink-0",
                              oIdx === q.correctAnswer ? "bg-emerald-500 text-white" : 
                              oIdx === userAnswer ? "bg-red-500 text-white" : "bg-slate-200 text-slate-500"
                            )}>
                              {String.fromCharCode(65 + oIdx)}
                            </div>
                            <span className="leading-tight">{opt}</span>
                          </div>
                        ))}
                      </div>

                      {showExplanation ? (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 space-y-4"
                        >
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-2 mb-2 text-blue-700">
                              <Sparkles className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">AI Explanation</span>
                            </div>
                            <div className="text-sm text-blue-900 leading-relaxed prose prose-blue max-w-none">
                              <ReactMarkdown>{showExplanation}</ReactMarkdown>
                            </div>
                          </div>

                          {/* AI Tutor Chat */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-slate-700">
                                <MessageSquare className="w-4 h-4" />
                                <span className="text-xs font-bold">Ask AI Tutor</span>
                              </div>
                              <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-400">Beta</Badge>
                            </div>
                            
                            <ScrollArea className="h-48 p-4">
                              <div className="space-y-4">
                                {chats[q.id]?.map((msg, mIdx) => (
                                  <div key={mIdx} className={cn(
                                    "flex gap-3",
                                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                                  )}>
                                    <div className={cn(
                                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                                      msg.role === 'user' ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600"
                                    )}>
                                      {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className={cn(
                                      "p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed",
                                      msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-slate-100 text-slate-800 rounded-tl-none"
                                    )}>
                                      {msg.text}
                                    </div>
                                  </div>
                                ))}
                                {isSending && activeChatId === q.id && (
                                  <div className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    </div>
                                    <div className="p-3 rounded-2xl bg-slate-100 text-slate-400 text-xs animate-pulse">
                                      Thinking...
                                    </div>
                                  </div>
                                )}
                                {(!chats[q.id] || chats[q.id].length === 0) && (
                                  <p className="text-center text-[10px] text-slate-400 font-medium py-4">
                                    Ask a follow-up question about this concept.
                                  </p>
                                )}
                              </div>
                            </ScrollArea>

                            <div className="p-3 border-t border-slate-100 flex gap-2">
                              <Input 
                                placeholder="Type your question..." 
                                className="h-9 text-xs rounded-lg border-slate-200"
                                value={activeChatId === q.id ? inputMessage : ''}
                                onChange={(e) => {
                                  setActiveChatId(q.id);
                                  setInputMessage(e.target.value);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(q.id)}
                              />
                              <Button 
                                size="icon" 
                                className="h-9 w-9 bg-blue-600 hover:bg-blue-700 shrink-0"
                                onClick={() => handleSendMessage(q.id)}
                                disabled={isSending || (activeChatId === q.id && !inputMessage.trim())}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-2 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                          onClick={() => handleExplain(q)}
                          disabled={explainingId === q.id}
                        >
                          <Sparkles className={cn("w-4 h-4", explainingId === q.id && "animate-spin")} />
                          {explainingId === q.id ? "Analyzing..." : "Explain with AI"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Performance
            </h2>
            <Card className="border-none shadow-md shadow-slate-200/50">
              <CardContent className="p-6 space-y-6">
                <div className="h-48 md:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="topic" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Proficiency"
                        dataKey="score"
                        stroke="#2563eb"
                        fill="#3b82f6"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold text-slate-600">
                    <span>Accuracy</span>
                    <span>{Math.round(percentage)}%</span>
                  </div>
                  <Progress value={percentage} className="h-2 bg-slate-100" />
                </div>
                
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Correct Answers</span>
                    <span className="text-sm font-bold text-emerald-600">{score}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Incorrect Answers</span>
                    <span className="text-sm font-bold text-red-600">{session.questions.length - score}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Time Taken</span>
                    <span className="text-sm font-bold text-slate-700">12:45</span>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
                  <h4 className="text-xs font-bold text-blue-700 uppercase tracking-widest">Next Steps</h4>
                  <p className="text-xs text-blue-800 leading-relaxed font-medium">
                    Based on your results, we recommend focusing on <strong>Professional Standards</strong> and <strong>Policy Frameworks</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showCertificate && (
        <Certificate 
          candidate={candidate} 
          attempt={{
            id: session.id || 'current',
            date: new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
            score,
            total: session.questions.length,
            percentage
          }} 
          onClose={() => setShowCertificate(false)} 
        />
      )}
    </div>
  );
}
