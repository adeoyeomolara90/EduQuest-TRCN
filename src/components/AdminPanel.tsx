/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Save, 
  Settings, 
  BrainCircuit,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  Database,
  Search,
  ChevronRight,
  Eye,
  FileText,
  Upload,
  File,
  Filter,
  X,
  Type,
  ClipboardPaste,
  Clock,
  User,
  BarChart3,
  Award,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { geminiService } from '@/src/services/geminiService';
import { Question, Candidate, ExamSettings } from '@/src/types';
import { cn } from '@/lib/utils';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';

interface AdminPanelProps {
  examSettings: ExamSettings;
  onQuestionsGenerated: (questions: Question[]) => void;
  onClose: () => void;
}

export default function AdminPanel({ examSettings, onQuestionsGenerated, onClose }: AdminPanelProps) {
  const [topic, setTopic] = useState('Professional Teaching Standards');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentTopic: '' });
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [allUsers, setAllUsers] = useState<Candidate[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<Candidate | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSettings, setLocalSettings] = useState<ExamSettings>(examSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [roleChangeUser, setRoleChangeUser] = useState<{ id: string, name: string, currentRole: 'candidate' | 'admin' } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const TOPICS = [
    "English and Communication Skills",
    "Basic Mathematics",
    "History of Education",
    "Educational Technology and ICT",
    "Teaching Profession",
    "Curriculum Studies",
    "Philosophy of Education",
    "Child Friendly Schools",
    "Measuring and Evaluation",
    "Educational Psychology",
    "Sociology and Education",
    "Special Target Group/Adult Education",
    "Educational Research",
    "Statistics",
    "Use of Library",
    "Educational Management",
    "Micro Teaching",
    "Special Education",
    "Guidance and Counselling",
    "Classroom Management",
    "Comparative Education",
    "Teacher Education",
    "Subject Methodology",
    "Current Affairs"
  ];
  
  // Filters
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // File Upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Manual Entry State
  const [manualQuestion, setManualQuestion] = useState<Partial<Question>>({
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    topic: 'Professional Teaching Standards',
    category: 'General',
    difficulty: 'medium'
  });

  // Text Extraction State
  const [pasteText, setPasteText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Fetch data for management tabs
  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      const qSnapshot = await getDocs(collection(db, 'questions'));
      const uSnapshot = await getDocs(collection(db, 'users'));
      
      setAllQuestions(qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
      setAllUsers(uSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Candidate)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'admin_data');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Real-time listener for active sessions
  React.useEffect(() => {
    const q = query(collection(db, 'sessions'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => {
        const data = doc.data();
        const candidate = allUsers.find(u => u.id === data.candidateId);
        return {
          id: doc.id,
          ...data,
          candidateName: candidate?.name || 'Unknown Candidate'
        };
      });
      setActiveSessions(sessions);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions/active');
    });
    return () => unsubscribe();
  }, [allUsers]);

  const handleBulkGenerate = async () => {
    if (!window.confirm("This will generate 75 questions for EACH of the 23 topics (1,725 questions total). This may take several minutes and use significant AI quota. Continue?")) return;
    
    setIsBulkGenerating(true);
    setStatus(null);
    setBulkProgress({ current: 0, total: TOPICS.length, currentTopic: '' });

    try {
      let totalAdded = 0;
      for (let i = 0; i < TOPICS.length; i++) {
        const currentTopic = TOPICS[i];
        setBulkProgress(prev => ({ ...prev, current: i + 1, currentTopic }));
        
        // Generate 75 questions in batches of 10 to avoid token limits and JSON truncation
        for (let batch = 0; batch < 8; batch++) {
          const batchCount = batch === 7 ? 5 : 10;
          const questions = await geminiService.generateQuestions(currentTopic, batchCount, 'medium');
          if (questions && questions.length > 0) {
            const firestoreBatch = writeBatch(db);
            questions.forEach(q => {
              const { id, ...qData } = q;
              const newDocRef = doc(collection(db, 'questions'));
              firestoreBatch.set(newDocRef, qData);
              totalAdded++;
            });
            await firestoreBatch.commit();
          }
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      setStatus({ type: 'success', message: `Bulk generation complete! Added ${totalAdded} questions across all topics.` });
      fetchData();
    } catch (error) {
      console.error("Bulk generation error:", error);
      setStatus({ type: 'error', message: 'Bulk generation failed partway through.' });
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'questions', id));
      setAllQuestions(prev => prev.filter(q => q.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `questions/${id}`);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStatus(null);
    try {
      const questions = await geminiService.generateQuestions(topic, count, difficulty);
      if (questions && questions.length > 0) {
        setGeneratedQuestions(questions);
        setStatus({ type: 'success', message: `Successfully generated ${questions.length} questions.` });
      } else {
        setStatus({ type: 'error', message: 'Failed to generate questions. Please try again.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'An error occurred during generation.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (generatedQuestions.length > 0) {
      setIsGenerating(true);
      try {
        const batch = writeBatch(db);
        generatedQuestions.forEach(q => {
          const { id, ...qData } = q;
          const newDocRef = doc(collection(db, 'questions'));
          batch.set(newDocRef, qData);
        });
        await batch.commit();
        
        setGeneratedQuestions([]);
        setStatus({ type: 'success', message: `Successfully saved ${generatedQuestions.length} questions to the bank.` });
        fetchData();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'questions/bulk');
        setStatus({ type: 'error', message: 'Failed to save questions.' });
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleManualSave = async () => {
    if (!manualQuestion.text || manualQuestion.options?.some(o => !o)) {
      setStatus({ type: 'error', message: 'Please fill all question fields.' });
      return;
    }

    setIsGenerating(true);
    try {
      const { id, ...qData } = manualQuestion as Question;
      await addDoc(collection(db, 'questions'), qData);
      setManualQuestion({
        text: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        topic: 'Professional Teaching Standards',
        category: 'General'
      });
      setStatus({ type: 'success', message: 'Question saved successfully.' });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'questions/manual');
      setStatus({ type: 'error', message: 'Failed to save question.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await updateDoc(doc(db, 'config', 'exam_settings'), { ...localSettings });
      setStatus({ type: 'success', message: 'Exam settings updated successfully.' });
    } catch (error) {
      console.error("Save settings error:", error);
      setStatus({ type: 'error', message: 'Failed to save settings.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSeedQuestions = async () => {
    setIsSeeding(true);
    setStatus(null);
    try {
      const { SAMPLE_QUESTIONS } = await import('@/src/constants');
      
      // Only seed questions that don't already exist (based on text)
      const existingTexts = new Set(allQuestions.map(q => q.text));
      const questionsToSeed = SAMPLE_QUESTIONS.filter(q => !existingTexts.has(q.text));
      
      if (questionsToSeed.length === 0) {
        setStatus({ type: 'success', message: 'Question bank is already up to date.' });
        setIsSeeding(false);
        return;
      }

      let addedCount = 0;
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < questionsToSeed.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const currentBatch = questionsToSeed.slice(i, i + BATCH_SIZE);
        
        for (const q of currentBatch) {
          const { id, ...qData } = q;
          const newDocRef = doc(collection(db, 'questions'));
          batch.set(newDocRef, qData);
          addedCount++;
        }
        
        await batch.commit();
      }

      setStatus({ type: 'success', message: `Successfully seeded ${addedCount} new questions to the bank.` });
      fetchData();
    } catch (error) {
      console.error("Seeding error:", error);
      setStatus({ type: 'error', message: 'Failed to seed questions.' });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleTextExtract = async () => {
    if (!pasteText) return;
    setIsExtracting(true);
    setStatus(null);
    try {
      const questions = await geminiService.extractQuestionsFromFile(pasteText);
      if (questions && questions.length > 0) {
        setGeneratedQuestions(questions);
        setStatus({ type: 'success', message: `Extracted ${questions.length} questions from text.` });
      } else {
        setStatus({ type: 'error', message: 'No questions could be extracted.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Extraction failed.' });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'candidate' | 'admin') => {
    setIsUpdatingRole(true);
    setStatus(null);
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setStatus({ type: 'success', message: `Updated user role to ${newRole}.` });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } as Candidate : u));
      setRoleChangeUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      setStatus({ type: 'error', message: 'Failed to update user role.' });
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const reader = new FileReader();
      
      const processFile = async (content: any, mimeType?: string) => {
        let questions: Question[] = [];
        if (mimeType) {
          // Image or PDF for Gemini
          questions = await geminiService.extractQuestionsFromFile({
            inlineData: {
              data: content.split(',')[1],
              mimeType
            }
          });
        } else {
          // Text content
          questions = await geminiService.extractQuestionsFromFile(content);
        }

        if (questions && questions.length > 0) {
          // Save to Firestore
          for (const q of questions) {
            const { id, ...qData } = q;
            await addDoc(collection(db, 'questions'), qData);
          }
          setUploadStatus({ type: 'success', message: `Successfully extracted and saved ${questions.length} questions.` });
          fetchData(); // Refresh bank
        } else {
          setUploadStatus({ type: 'error', message: 'No questions could be extracted from this file.' });
        }
      };

      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        reader.onload = (event) => {
          processFile(event.target?.result, file.type);
        };
        reader.readAsDataURL(file);
      } else if (file.name.endsWith('.docx')) {
        const mammoth = await import('mammoth');
        reader.onload = async (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          processFile(result.value);
        };
        reader.readAsArrayBuffer(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        reader.onload = (event) => {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const text = XLSX.utils.sheet_to_txt(firstSheet);
          processFile(text);
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Assume text/plain
        reader.onload = (event) => {
          processFile(event.target?.result as string);
        };
        reader.readAsText(file);
      }
    } catch (error) {
      console.error("File upload error:", error);
      setUploadStatus({ type: 'error', message: 'Failed to process file. Please try again.' });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredQuestions = allQuestions.filter(q => {
    const matchesSearch = 
      q.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.category && q.category.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesDifficulty = filterDifficulty === 'all' || (q.difficulty && q.difficulty.toLowerCase() === filterDifficulty.toLowerCase());
    const matchesTopic = filterTopic === 'all' || q.topic === filterTopic;
    const matchesCategory = filterCategory === 'all' || q.category === filterCategory;
    
    return matchesSearch && matchesTopic && matchesCategory && matchesDifficulty;
  });

  const uniqueTopics = Array.from(new Set(allQuestions.map(q => q.topic)));
  const uniqueCategories = Array.from(new Set(allQuestions.map(q => q.category).filter(Boolean)));

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12 font-sans overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2 md:gap-3">
              <Settings className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
              Admin Portal
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium">AI-Powered Question Generation & Management</p>
          </div>
          <Button variant="outline" onClick={onClose} className="rounded-xl font-bold h-10 md:h-11 text-xs md:text-sm self-start sm:self-auto">
            Back to Dashboard
          </Button>
        </div>

        <Tabs defaultValue="generator" className="w-full" onValueChange={(val) => val !== 'generator' && fetchData()}>
          <ScrollArea className="w-full whitespace-nowrap rounded-2xl mb-6 md:mb-8">
            <TabsList className="inline-flex w-full md:grid md:grid-cols-5 bg-slate-100 p-1 rounded-2xl h-12">
              <TabsTrigger value="generator" className="rounded-xl font-bold text-xs md:text-sm gap-2 px-4 md:px-0">
                <Sparkles className="w-4 h-4" /> Generator
              </TabsTrigger>
              <TabsTrigger value="bank" className="rounded-xl font-bold text-xs md:text-sm gap-2 px-4 md:px-0">
                <Database className="w-4 h-4" /> Question Bank
              </TabsTrigger>
              <TabsTrigger value="active" className="rounded-xl font-bold text-xs md:text-sm gap-2 px-4 md:px-0">
                <Clock className="w-4 h-4" /> Active Exams
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-xl font-bold text-xs md:text-sm gap-2 px-4 md:px-0">
                <Users className="w-4 h-4" /> User Management
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-xl font-bold text-xs md:text-sm gap-2 px-4 md:px-0">
                <Settings className="w-4 h-4" /> Settings
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          <TabsContent value="generator">
            <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
              <div className="lg:col-span-1 space-y-6">
                <Tabs defaultValue="ai" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-slate-200/50 p-1 rounded-xl h-10 mb-4">
                    <TabsTrigger value="ai" className="rounded-lg text-[10px] font-bold">AI Gen</TabsTrigger>
                    <TabsTrigger value="manual" className="rounded-lg text-[10px] font-bold">Manual</TabsTrigger>
                    <TabsTrigger value="paste" className="rounded-lg text-[10px] font-bold">Paste</TabsTrigger>
                  </TabsList>

                  <TabsContent value="ai">
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl md:rounded-3xl">
                      <CardHeader className="p-5 md:p-6">
                        <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                          AI Generator
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 md:p-6 pt-0 md:pt-0 space-y-5 md:space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Topic</label>
                          <Input 
                            value={topic} 
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. Educational Psychology"
                            className="rounded-xl h-11 md:h-12 text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Difficulty</label>
                          <Select value={difficulty} onValueChange={setDifficulty}>
                            <SelectTrigger className="rounded-xl h-11 md:h-12 text-sm">
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Question Count</label>
                          <Input 
                            type="number" 
                            min={1} 
                            max={20}
                            value={count} 
                            onChange={(e) => setCount(parseInt(e.target.value))}
                            className="rounded-xl h-11 md:h-12 text-sm"
                          />
                        </div>

                        <Button 
                          onClick={handleGenerate} 
                          disabled={isGenerating || isBulkGenerating || !topic}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 md:py-7 rounded-xl shadow-lg shadow-blue-200 text-sm h-12 md:h-14"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Generate with AI
                            </>
                          )}
                        </Button>

                        <div className="pt-4 border-t border-slate-100">
                          <Button 
                            variant="outline"
                            onClick={handleBulkGenerate}
                            disabled={isBulkGenerating || isGenerating}
                            className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 font-bold py-6 rounded-xl text-xs h-12"
                          >
                            {isBulkGenerating ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Bulk Generating ({bulkProgress.current}/{bulkProgress.total})</span>
                                </div>
                                <span className="text-[8px] opacity-70 truncate max-w-[200px]">{bulkProgress.currentTopic}</span>
                              </div>
                            ) : (
                              <>
                                <Database className="w-4 h-4 mr-2" />
                                Bulk Generate (All Topics)
                              </>
                            )}
                          </Button>
                          <p className="text-[9px] text-slate-400 text-center mt-2 font-medium">
                            Generates 75 questions for each of the 23 TRCN topics (1,725 total).
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="manual">
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl md:rounded-3xl">
                      <CardHeader className="p-5 md:p-6">
                        <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                          <Type className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                          Manual Entry
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 md:p-6 pt-0 md:pt-0 space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Question Text</label>
                          <Textarea 
                            value={manualQuestion.text}
                            onChange={(e) => setManualQuestion({...manualQuestion, text: e.target.value})}
                            placeholder="Enter question..."
                            className="rounded-xl min-h-[80px] text-sm"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Options</label>
                          {manualQuestion.options?.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 cursor-pointer transition-colors",
                                manualQuestion.correctAnswer === i ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                              )} onClick={() => setManualQuestion({...manualQuestion, correctAnswer: i})}>
                                {String.fromCharCode(65 + i)}
                              </div>
                              <Input 
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...(manualQuestion.options || [])];
                                  newOpts[i] = e.target.value;
                                  setManualQuestion({...manualQuestion, options: newOpts});
                                }}
                                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                className="rounded-xl h-9 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Topic</label>
                            <Input 
                              value={manualQuestion.topic}
                              onChange={(e) => setManualQuestion({...manualQuestion, topic: e.target.value})}
                              className="rounded-xl h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                            <Input 
                              value={manualQuestion.category}
                              onChange={(e) => setManualQuestion({...manualQuestion, category: e.target.value})}
                              className="rounded-xl h-9 text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1 pt-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Difficulty</label>
                          <Select 
                            value={manualQuestion.difficulty} 
                            onValueChange={(val: 'easy' | 'medium' | 'hard') => setManualQuestion({ ...manualQuestion, difficulty: val })}
                          >
                            <SelectTrigger className="rounded-xl h-9 text-xs">
                              <SelectValue placeholder="Select Difficulty" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          onClick={handleManualSave}
                          disabled={isGenerating}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-11 text-xs mt-2"
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                          Add to Bank
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="paste">
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl md:rounded-3xl">
                      <CardHeader className="p-5 md:p-6">
                        <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                          <ClipboardPaste className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                          Paste Text
                        </CardTitle>
                        <CardDescription className="text-[10px]">Paste raw text containing questions and let AI extract them.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-5 md:p-6 pt-0 md:pt-0 space-y-4">
                        <Textarea 
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          placeholder="Paste your questions here..."
                          className="rounded-xl min-h-[200px] text-sm"
                        />
                        <Button 
                          onClick={handleTextExtract}
                          disabled={isExtracting || !pasteText}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-12 text-sm"
                        >
                          {isExtracting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                          Extract Questions
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="lg:col-span-2 space-y-4 md:space-y-6">
                {status && (
                  <div className={cn(
                    "p-4 rounded-2xl flex items-center gap-3 border",
                    status.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
                  )}>
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <p className="text-xs md:text-sm font-bold">{status.message}</p>
                  </div>
                )}

                {generatedQuestions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h2 className="text-lg md:text-xl font-bold text-slate-800">Preview Questions</h2>
                      <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-10 md:h-11 text-xs md:text-sm">
                        <Save className="w-4 h-4 mr-2" />
                        Save to Exam Pool
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {generatedQuestions.map((q, idx) => (
                        <Card key={idx} className="border-none shadow-md shadow-slate-200/50 rounded-2xl">
                          <CardContent className="p-5 md:p-6 space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-blue-600 border-blue-100 text-[10px] md:text-xs">Question {idx + 1}</Badge>
                              <div className="flex gap-2">
                                <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 uppercase text-[9px] md:text-[10px] font-bold">{q.topic}</Badge>
                                <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 uppercase text-[9px] md:text-[10px] font-bold">{difficulty}</Badge>
                              </div>
                            </div>
                            <p className="font-bold text-slate-800 text-sm md:text-base leading-snug">{q.text}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className={cn(
                                  "p-2.5 rounded-lg text-[11px] md:text-xs font-medium border leading-tight",
                                  oIdx === q.correctAnswer ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-500"
                                )}>
                                  <span className="font-bold mr-1">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-[300px] md:min-h-[400px] rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-8 md:p-12 space-y-4">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center">
                      <BrainCircuit className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">No Questions Generated</p>
                      <p className="text-slate-500 font-medium text-xs md:text-sm max-w-xs">Use the settings on the left to generate a new set of professional exam questions.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bank">
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      placeholder="Search questions..." 
                      className="pl-10 rounded-xl"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-3 py-1 text-xs">
                      {allQuestions.length} / 1700+ Questions
                    </Badge>
                    <Button 
                      variant="outline" 
                      onClick={handleSeedQuestions} 
                      disabled={isSeeding}
                      className="rounded-xl font-bold h-10 border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      {isSeeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      <span className="hidden sm:inline">Seed Past Questions</span>
                      <span className="sm:hidden">Seed</span>
                    </Button>
                    <div className="relative">
                      <input 
                        type="file" 
                        id="question-upload"
                        className="sr-only" 
                        onChange={handleFileUpload}
                        accept=".txt,.pdf,.docx,.xlsx,.xls,image/*"
                        disabled={isUploading}
                      />
                      <label htmlFor="question-upload">
                        <span className={cn(buttonVariants({ variant: "outline" }), "rounded-xl font-bold gap-2 border-dashed border-2 cursor-pointer h-10 px-4")}>
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span className="hidden sm:inline">Upload Questions</span>
                          <span className="sm:hidden">Upload</span>
                        </span>
                      </label>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-3 md:px-4 py-2 h-10 whitespace-nowrap">
                      {filteredQuestions.length} / {allQuestions.length} <span className="hidden xs:inline ml-1">Questions</span>
                    </Badge>
                  </div>
                </div>

                {uploadStatus && (
                  <div className={cn(
                    "p-3 rounded-xl flex items-center justify-between gap-3 border text-xs font-bold",
                    uploadStatus.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
                  )}>
                    <div className="flex items-center gap-2">
                      {uploadStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {uploadStatus.message}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setUploadStatus(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
                  <Select value={filterTopic} onValueChange={setFilterTopic}>
                    <SelectTrigger className="rounded-xl h-10 text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Filter className="w-3 h-3 text-slate-400 shrink-0" />
                        <SelectValue placeholder="All Topics" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Topics</SelectItem>
                      {uniqueTopics.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="rounded-xl h-10 text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Filter className="w-3 h-3 text-slate-400 shrink-0" />
                        <SelectValue placeholder="All Categories" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map(c => (
                        <SelectItem key={c!} value={c!}>{c!}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                    <SelectTrigger className="rounded-xl h-10 text-xs xs:col-span-2 sm:col-span-1">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Filter className="w-3 h-3 text-slate-400 shrink-0" />
                        <SelectValue placeholder="All Difficulties" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Difficulties</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoadingData ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-slate-500 font-bold">Loading Question Bank...</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {filteredQuestions.length === 0 ? (
                      <div className="text-center py-20 text-slate-400">
                        <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">No questions found matching your filters.</p>
                      </div>
                    ) : (
                      filteredQuestions.map((q, idx) => (
                        <Card key={q.id} className="border-none shadow-md shadow-slate-200/50 rounded-2xl">
                          <CardContent className="p-5 md:p-6 flex flex-col sm:flex-row gap-6">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-blue-600 border-blue-100 text-[10px]">{q.id.toUpperCase()}</Badge>
                                <Badge className="bg-slate-100 text-slate-600 uppercase text-[9px] font-bold">{q.topic}</Badge>
                                {q.category && <Badge className="bg-blue-50 text-blue-600 uppercase text-[9px] font-bold">{q.category}</Badge>}
                              </div>
                              <p className="font-bold text-slate-800 text-sm leading-snug">{q.text}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className={cn(
                                    "p-2 rounded-lg text-[10px] font-medium border",
                                    oIdx === q.correctAnswer ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-500"
                                  )}>
                                    <span className="font-bold mr-1">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex sm:flex-col gap-2 justify-end">
                              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteQuestion(q.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="active">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Live Exam Monitoring</h2>
                <Badge className="bg-blue-600 text-white px-4 py-1.5 rounded-full font-bold">
                  {activeSessions.length} Active Sessions
                </Badge>
              </div>

              <div className="grid gap-4">
                {activeSessions.length === 0 ? (
                  <Card className="border-none shadow-md shadow-slate-200/50 border-dashed border-2 border-slate-200 bg-transparent">
                    <CardContent className="p-12 text-center space-y-2">
                      <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Active Sessions</p>
                      <p className="text-slate-500 font-medium">There are currently no candidates taking an exam.</p>
                    </CardContent>
                  </Card>
                ) : (
                  activeSessions.map((session) => (
                    <Card key={session.id} className="border-none shadow-md shadow-slate-200/50 rounded-2xl overflow-hidden">
                      <CardContent className="p-5 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <User className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800">{session.candidateName}</h3>
                              <p className="text-xs font-medium text-slate-500">Session ID: <span className="font-mono">{session.id.slice(0, 8)}...</span></p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-6 md:gap-12">
                            <div className="text-center md:text-right">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Progress</p>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-700">Q{session.currentQuestionIndex + 1}/{session.questions.length}</p>
                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 transition-all duration-500" 
                                    style={{ width: `${((session.currentQuestionIndex + 1) / session.questions.length) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="text-center md:text-right">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Violations</p>
                              <Badge variant={session.violations?.length > 0 ? "destructive" : "outline"} className="font-bold">
                                {session.violations?.length || 0} Detected
                              </Badge>
                            </div>

                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                              <ChevronRight className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>

                        {session.violations && session.violations.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-50">
                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Recent Violations</p>
                            <div className="space-y-2">
                              {session.violations.slice(-2).map((v: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 text-xs bg-red-50 text-red-700 p-2 rounded-lg border border-red-100">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span className="font-bold">[{v.type}]</span>
                                  <span className="font-medium">{v.message}</span>
                                  <span className="ml-auto text-[10px] opacity-60">{new Date(v.timestamp).toLocaleTimeString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search candidates..." 
                    className="pl-10 rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold px-4 py-2 whitespace-nowrap">
                  {allUsers.length} <span className="hidden xs:inline ml-1">Registered Candidates</span>
                  <span className="xs:hidden ml-1">Users</span>
                </Badge>
              </div>

              {isLoadingData ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-slate-500 font-bold">Loading Candidates...</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {allUsers
                    .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.regNumber.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((user) => (
                    <Card key={user.id} className="border-none shadow-md shadow-slate-200/50 rounded-2xl overflow-hidden">
                      <CardContent className="p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Users className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800">{user.name}</h3>
                            <p className="text-xs font-medium text-slate-500">Reg: <span className="font-mono text-slate-700">{user.regNumber}</span></p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-center sm:text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Role</p>
                            <Badge 
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-widest px-2 cursor-pointer transition-all",
                                user.role === 'admin' ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              )}
                              onClick={() => setRoleChangeUser({ id: user.id || '', name: user.name, currentRole: user.role })}
                            >
                              {user.role}
                            </Badge>
                          </div>
                          <div className="text-center sm:text-right hidden xs:block">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Attempts</p>
                            <p className="text-sm font-bold text-slate-700">{user.pastAttempts.length}</p>
                          </div>
                          <div className="text-center sm:text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Best Score</p>
                            <p className="text-sm font-bold text-emerald-600">
                              {user.pastAttempts.length > 0 
                                ? `${Math.max(...user.pastAttempts.map(a => a.percentage))}%`
                                : 'N/A'}
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => setSelectedUser(user)}
                          >
                            <BarChart3 className="w-5 h-5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl md:rounded-3xl">
              <CardHeader className="p-5 md:p-6">
                <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                  <Settings className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                  Exam Configuration
                </CardTitle>
                <CardDescription>Configure global exam parameters for all candidates.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 md:p-6 pt-0 md:pt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exam Duration (Minutes)</label>
                    <Input 
                      type="number" 
                      value={localSettings.durationMinutes} 
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) }))}
                      className="rounded-xl h-11 md:h-12 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Questions Per Exam</label>
                    <Input 
                      type="number" 
                      value={localSettings.questionsPerExam} 
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, questionsPerExam: parseInt(e.target.value) }))}
                      className="rounded-xl h-11 md:h-12 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Passing Score (%)</label>
                    <Input 
                      type="number" 
                      value={localSettings.passingScore} 
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, passingScore: parseInt(e.target.value) }))}
                      className="rounded-xl h-11 md:h-12 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Tutor Help</label>
                    <Select 
                      value={localSettings.allowAIHelp ? "true" : "false"} 
                      onValueChange={(v) => setLocalSettings(prev => ({ ...prev, allowAIHelp: v === "true" }))}
                    >
                      <SelectTrigger className="rounded-xl h-11 md:h-12 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Enabled</SelectItem>
                        <SelectItem value="false">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handleSaveSettings} 
                  disabled={isSavingSettings}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-6 rounded-xl shadow-lg text-sm h-12 md:h-14"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving Settings...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Configuration
                    </>
                  )}
                </Button>

                {status && (
                  <div className={cn(
                    "p-4 rounded-xl flex items-center gap-3",
                    status.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  )}>
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <p className="text-sm font-bold">{status.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Performance Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-4xl h-full max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedUser.name}</h3>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Reg: {selectedUser.regNumber}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-6 md:p-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Performance Summary */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border-none bg-slate-50 shadow-none rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Attempts</p>
                      <p className="text-2xl font-black text-slate-900">{selectedUser.pastAttempts.length}</p>
                    </Card>
                    <Card className="border-none bg-emerald-50 shadow-none rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Best Percentage</p>
                      <p className="text-2xl font-black text-emerald-600">
                        {selectedUser.pastAttempts.length > 0 
                          ? `${Math.max(...selectedUser.pastAttempts.map(a => a.percentage))}%`
                          : '0%'}
                      </p>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      Topic Proficiency
                    </h4>
                    <div className="h-64 w-full bg-slate-50 rounded-3xl p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={(() => {
                          const aggregateTopicData: Record<string, { correct: number; total: number }> = {};
                          selectedUser.pastAttempts.forEach(attempt => {
                            if (attempt.topicScores) {
                              Object.entries(attempt.topicScores).forEach(([topic, data]) => {
                                if (!aggregateTopicData[topic]) aggregateTopicData[topic] = { correct: 0, total: 0 };
                                aggregateTopicData[topic].correct += data.correct;
                                aggregateTopicData[topic].total += data.total;
                              });
                            }
                          });
                          return Object.entries(aggregateTopicData).map(([topic, data]) => ({
                            topic,
                            score: Math.round((data.correct / data.total) * 100),
                            fullMark: 100
                          }));
                        })()}>
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
                  </div>
                </div>

                {/* Attempt History */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    Attempt History
                  </h4>
                  <div className="space-y-3">
                    {selectedUser.pastAttempts.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Attempts Yet</p>
                      </div>
                    ) : (
                      selectedUser.pastAttempts.map((attempt, idx) => (
                        <div key={idx} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs",
                              attempt.percentage >= 60 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                            )}>
                              {attempt.percentage}%
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">Attempt #{selectedUser.pastAttempts.length - idx}</p>
                              <p className="text-[10px] font-medium text-slate-500">{attempt.date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-700">{attempt.score}/{attempt.total}</p>
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-bold uppercase tracking-widest px-2 py-0",
                              attempt.percentage >= 60 ? "text-emerald-600 border-emerald-100 bg-emerald-50" : "text-red-600 border-red-100 bg-red-50"
                            )}>
                              {attempt.percentage >= 60 ? "Pass" : "Fail"}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button onClick={() => setSelectedUser(null)} className="bg-slate-900 text-white font-bold rounded-xl px-8">
                Close Report
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {roleChangeUser && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 md:p-8 space-y-6"
          >
            <div className="space-y-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Change User Role?</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                Are you sure you want to change <span className="text-slate-900 font-bold">{roleChangeUser.name}</span>'s role from <span className="uppercase text-slate-900 font-bold">{roleChangeUser.currentRole}</span> to <span className="uppercase text-blue-600 font-bold">{roleChangeUser.currentRole === 'admin' ? 'candidate' : 'admin'}</span>?
              </p>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setRoleChangeUser(null)}
                className="flex-1 rounded-xl font-bold h-12"
                disabled={isUpdatingRole}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleUpdateUserRole(roleChangeUser.id, roleChangeUser.currentRole === 'admin' ? 'candidate' : 'admin')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold h-12"
                disabled={isUpdatingRole}
              >
                {isUpdatingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Change"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
