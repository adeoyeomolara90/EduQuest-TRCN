/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Play, 
  BookOpen, 
  Info, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  HelpCircle,
  Sparkles,
  User,
  BarChart3,
  Award,
  X,
  Loader2,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Candidate, PastAttempt, ExamSession, ExamSettings } from '@/src/types';
import { cn } from '@/lib/utils';
import Certificate from './Certificate';
import ResultsView from './ResultsView';
import { db } from '@/src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { geminiService } from '@/src/services/geminiService';

import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer 
} from 'recharts';

import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DashboardProps {
  candidate: Candidate;
  examSettings: ExamSettings;
  onStart: (topic?: string) => void;
  onResume?: () => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
  hasActiveSession?: boolean;
}

export default function Dashboard({ candidate, examSettings, onStart, onResume, onLogout, onOpenAdmin, hasActiveSession }: DashboardProps) {
  const [agreed, setAgreed] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedAttempt, setSelectedAttempt] = useState<PastAttempt | null>(null);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Calculate aggregate topic performance from past attempts
  const aggregateTopicData: Record<string, { correct: number; total: number }> = {};
  candidate.pastAttempts.forEach(attempt => {
    if (attempt.topicScores) {
      Object.entries(attempt.topicScores).forEach(([topic, data]) => {
        if (!aggregateTopicData[topic]) aggregateTopicData[topic] = { correct: 0, total: 0 };
        aggregateTopicData[topic].correct += data.correct;
        aggregateTopicData[topic].total += data.total;
      });
    }
  });

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (candidate.pastAttempts.length === 0) return;
      
      setIsLoadingSuggestions(true);
      try {
        const perfData = Object.entries(aggregateTopicData).map(([topic, data]) => ({
          topic,
          percentage: Math.round((data.correct / data.total) * 100)
        }));
        
        const recommended = await geminiService.getTopicSuggestions(perfData);
        setSuggestions(recommended);
      } catch (error) {
        console.error("Error fetching AI suggestions:", error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [candidate.pastAttempts.length]);

  const handleViewDetails = async (attempt: PastAttempt) => {
    setIsLoadingSession(true);
    try {
      const sessionDoc = await getDoc(doc(db, 'sessions', attempt.id));
      if (sessionDoc.exists()) {
        setSelectedSession({ id: sessionDoc.id, ...sessionDoc.data() } as ExamSession);
      } else {
        // Fallback for older attempts or if session was deleted
        setSelectedAttempt(attempt);
      }
    } catch (error) {
      console.error("Error fetching session details:", error);
      setSelectedAttempt(attempt);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const radarData = Object.entries(aggregateTopicData).map(([topic, data]) => ({
    topic,
    score: Math.round((data.correct / data.total) * 100),
    fullMark: 100
  }));

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
          <div className="space-y-2">
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 px-3 py-1 font-bold uppercase tracking-wider text-[10px] md:text-xs">Examination Portal</Badge>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">Welcome, {candidate.name}</h1>
            <p className="text-slate-500 font-medium text-base md:text-lg">Reg No: <span className="font-mono font-bold text-slate-700">{candidate.regNumber}</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3 self-start md:self-auto w-full md:w-auto">
            {candidate.role === 'admin' && (
              <Button 
                variant="outline" 
                onClick={onOpenAdmin}
                className="bg-slate-900 text-white hover:bg-slate-800 border-none rounded-xl font-bold gap-2 h-10 md:h-12 px-3 md:px-6 flex-1 md:flex-none text-xs md:text-sm"
              >
                <BarChart3 className="w-4 h-4" /> <span className="hidden xs:inline">Admin Panel</span><span className="xs:hidden">Admin</span>
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={onLogout}
              className="rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-100 h-10 md:h-12 px-3 md:px-6 flex-1 md:flex-none text-xs md:text-sm"
            >
              Log Out
            </Button>
            <div className="flex items-center gap-2 md:gap-4 bg-white p-2 md:p-3 rounded-2xl shadow-sm border border-slate-100 flex-1 md:flex-none justify-center md:justify-start">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">System</p>
                <p className="text-xs font-bold text-slate-700">Ready</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Tutor Suggestions */}
        {candidate.pastAttempts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">AI Tutor Recommended Topics</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {isLoadingSuggestions ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                ))
              ) : (
                suggestions.map((topic, idx) => (
                  <Card 
                    key={idx} 
                    className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer bg-white group rounded-2xl overflow-hidden border border-slate-100"
                    onClick={() => {
                      setSelectedSubject(topic);
                      onStart(topic);
                    }}
                  >
                    <CardContent className="p-4 flex flex-col justify-between h-full min-h-[100px]">
                      <div className="flex items-start justify-between">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Lightbulb className="w-4 h-4" />
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold text-blue-500 border-blue-100">AI PICK</Badge>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-2 mt-2">{topic}</h4>
                      <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-1 group-hover:text-blue-600">
                        Practice now <Play className="w-2 h-2 fill-current" />
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* Active Session Alert */}
        {hasActiveSession && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 border-2 border-amber-200 p-5 md:p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h3 className="font-bold text-amber-900 text-sm md:text-base">Active Session Found</h3>
                <p className="text-xs md:text-sm text-amber-700 font-medium">You have an ongoing examination session.</p>
              </div>
            </div>
            <Button 
              onClick={onResume}
              className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 py-5 md:py-6 rounded-2xl shadow-lg shadow-amber-200 text-sm"
            >
              Resume Examination
            </Button>
          </motion.div>
        )}

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {/* Exam Info & Past Attempts */}
          <div className="md:col-span-2 space-y-6 md:space-y-8">
            <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-3xl">
              <CardHeader className="bg-white border-b border-slate-50 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <CardTitle className="text-xl md:text-2xl font-bold text-slate-800">PQE Professional Exam</CardTitle>
                </div>
                <CardDescription className="text-slate-500 font-medium text-sm md:text-base leading-relaxed">
                  This examination tests your knowledge of professional teaching standards and pedagogy in Nigeria.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6 md:space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Duration
                    </p>
                    <p className="text-base md:text-lg font-bold text-slate-800">60 Minutes</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> Questions
                    </p>
                    <p className="text-base md:text-lg font-bold text-slate-800">50 MCQs</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Enabled
                    </p>
                    <p className="text-base md:text-lg font-bold text-slate-800">Smart Analysis</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-500" />
                    Important Instructions
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Ensure you have a stable internet connection throughout the session.",
                      "Do not switch tabs or minimize the browser window. This may lead to disqualification.",
                      "The exam will auto-submit when the timer reaches zero.",
                      "You can flag questions to review them later before final submission.",
                      "Each question carries equal marks. There is no negative marking."
                    ].map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-sm font-medium text-slate-600 leading-relaxed">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {idx + 1}
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 p-8 border-t border-slate-100">
                <div className="flex items-start gap-4">
                  <button 
                    onClick={() => setAgreed(!agreed)}
                    className={cn(
                      "w-6 h-6 rounded-lg border-2 flex-shrink-0 transition-all flex items-center justify-center",
                      agreed ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200"
                    )}
                  >
                    {agreed && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed">
                    I have read and understood the instructions. I agree to abide by the examination rules and regulations of the TRCN.
                  </p>
                </div>
              </CardFooter>
            </Card>

            {/* Past Attempts Section */}
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  Past Exam Attempts
                </div>
              </h2>
              
              {candidate.pastAttempts.length > 0 && radarData.length > 0 && (
                <Card className="border-none shadow-md shadow-slate-200/50 mb-6">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest">Aggregate Proficiency</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
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
                  </CardContent>
                </Card>
              )}

              {candidate.pastAttempts.length > 0 ? (
                <div className="grid gap-4">
                  {candidate.pastAttempts.map((attempt) => (
                    <Card key={attempt.id} className="border-none shadow-md shadow-slate-200/50 overflow-hidden">
                      <CardContent className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-bold",
                            attempt.percentage >= 60 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          )}>
                            {attempt.percentage}%
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">Professional Qualifying Exam</p>
                            <p className="text-xs font-medium text-slate-500">{attempt.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-700">{attempt.score}/{attempt.total}</p>
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-bold uppercase tracking-widest",
                              attempt.percentage >= 60 ? "text-emerald-600 border-emerald-100 bg-emerald-50" : "text-red-600 border-red-100 bg-red-50"
                            )}>
                              {attempt.percentage >= 60 ? "Passed" : "Failed"}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 h-8 px-2 text-[10px] font-bold"
                              onClick={() => handleViewDetails(attempt)}
                              disabled={isLoadingSession}
                            >
                              {isLoadingSession ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3 mr-1" />} DETAILS
                            </Button>
                            {attempt.percentage >= 60 && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 h-8 px-2 text-[10px] font-bold"
                                onClick={() => setSelectedAttempt(attempt)}
                              >
                                <Award className="w-3 h-3 mr-1" /> CERTIFICATE
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-none shadow-md shadow-slate-200/50 border-dashed border-2 border-slate-200 bg-transparent">
                  <CardContent className="p-12 text-center space-y-2">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Past Attempts</p>
                    <p className="text-slate-500 font-medium">Your examination history will appear here once you complete your first attempt.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Action Sidebar */}
          <div className="space-y-6">
            <Card className="border-none shadow-xl shadow-slate-200/50 bg-slate-900 text-white overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold">Ready to Start?</CardTitle>
                <CardDescription className="text-slate-400 font-medium">Click the button below to begin your examination session.</CardDescription>
              </CardHeader>
              <CardContent className="pb-8 space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Subject</label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="w-full bg-white/10 border-white/20 text-white h-12 rounded-xl focus:ring-blue-500">
                      <SelectValue placeholder="Select Subject" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="All Subjects">All Subjects</SelectItem>
                      <SelectItem value="English and Communication Skills">English & Communication</SelectItem>
                      <SelectItem value="Basic Mathematics">Basic Mathematics</SelectItem>
                      <SelectItem value="History of Education">History of Education</SelectItem>
                      <SelectItem value="Educational Technology and ICT">Educational Tech & ICT</SelectItem>
                      <SelectItem value="Teaching Profession">Teaching Profession</SelectItem>
                      <SelectItem value="Curriculum Studies">Curriculum Studies</SelectItem>
                      <SelectItem value="Philosophy of Education">Philosophy of Education</SelectItem>
                      <SelectItem value="Child Friendly Schools">Child Friendly Schools</SelectItem>
                      <SelectItem value="Measuring and Evaluation">Measuring & Evaluation</SelectItem>
                      <SelectItem value="Educational Psychology">Educational Psychology</SelectItem>
                      <SelectItem value="Sociology and Education">Sociology & Education</SelectItem>
                      <SelectItem value="Special Target Group/Adult Education">Special/Adult Education</SelectItem>
                      <SelectItem value="Educational Research">Educational Research</SelectItem>
                      <SelectItem value="Statistics">Statistics</SelectItem>
                      <SelectItem value="Use of Library">Use of Library</SelectItem>
                      <SelectItem value="Educational Management">Educational Management</SelectItem>
                      <SelectItem value="Micro Teaching">Micro Teaching</SelectItem>
                      <SelectItem value="Special Education">Special Education</SelectItem>
                      <SelectItem value="Guidance and Counselling">Guidance & Counselling</SelectItem>
                      <SelectItem value="Classroom Management">Classroom Management</SelectItem>
                      <SelectItem value="Comparative Education">Comparative Education</SelectItem>
                      <SelectItem value="Teacher Education">Teacher Education</SelectItem>
                      <SelectItem value="Subject Methodology">Subject Methodology</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-slate-300 leading-relaxed">
                    Once started, the timer cannot be paused.
                  </p>
                </div>
                <Button 
                  disabled={!agreed}
                  onClick={() => onStart(selectedSubject)}
                  className="w-full py-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-5 h-5 mr-2 fill-current" /> Start Examination
                </Button>
              </CardContent>
            </Card>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Candidate Profile</h4>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{candidate.name}</p>
                  <p className="text-xs font-medium text-slate-500">Category C (Graduate)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedAttempt && (
        <Certificate 
          candidate={candidate} 
          attempt={selectedAttempt} 
          onClose={() => setSelectedAttempt(null)} 
        />
      )}

      {selectedSession && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 lg:p-8">
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-white w-full max-w-6xl h-[92vh] h-[92dvh] md:h-full md:max-h-[90vh] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base">Attempt Details</h3>
                  <p className="text-[10px] md:text-xs font-medium text-slate-500">Reviewing session from {new Date(selectedSession.startTime || '').toLocaleDateString()}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedSession(null)} className="rounded-full hover:bg-slate-100 w-10 h-10">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain bg-slate-50">
              <ResultsView 
                session={selectedSession} 
                candidate={candidate} 
                passingScore={examSettings.passingScore}
                onRestart={() => setSelectedSession(null)} 
              />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
