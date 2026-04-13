/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Award, Shield, CheckCircle2, QrCode } from 'lucide-react';
import { Candidate, PastAttempt } from '@/src/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CertificateProps {
  candidate: Candidate;
  attempt: PastAttempt;
  onClose: () => void;
}

export default function Certificate({ candidate, attempt, onClose }: CertificateProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-start md:justify-center p-2 md:p-8 overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none print:block">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-5xl shadow-2xl rounded-sm relative overflow-hidden flex flex-col my-auto print:my-0 print:shadow-none print:rounded-none print:max-w-none border-[1px] border-slate-200 aspect-[1.414/1] md:aspect-[1.414/1]"
      >
        {/* Decorative Border */}
        <div className="absolute inset-0 border-[6px] md:border-[16px] border-double border-slate-200 pointer-events-none m-1.5 md:m-6 print:m-4" />
        <div className="absolute inset-0 border-[1px] md:border-[2px] border-slate-800 pointer-events-none m-3 md:m-10 print:m-8" />

        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '15px 15px' }} />

        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-16 text-center space-y-4 md:space-y-8 relative z-10">
          {/* Header */}
          <div className="space-y-2 md:space-y-4">
            <div className="flex justify-center mb-2 md:mb-4">
              <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xl border-2 md:border-4 border-white">
                <Shield className="w-6 h-6 md:w-10 md:h-10" />
              </div>
            </div>
            <h1 className="text-xl md:text-3xl lg:text-4xl font-serif font-black text-slate-900 tracking-tight uppercase leading-tight">Certificate of Achievement</h1>
            <div className="h-0.5 md:h-1 w-16 md:w-32 bg-blue-600 mx-auto" />
          </div>

          {/* Body */}
          <div className="space-y-2 md:space-y-6">
            <p className="text-[10px] md:text-base font-medium text-slate-500 italic">This is to certify that</p>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 border-b-2 border-slate-100 pb-1 md:pb-4 inline-block px-4 md:px-12">
              {candidate.name}
            </h2>
            <p className="text-[10px] md:text-base lg:text-lg font-medium text-slate-600 max-w-2xl mx-auto leading-relaxed px-4">
              has successfully completed the <span className="font-bold text-slate-900">Professional Qualifying Examination (PQE)</span> 
              conducted by the EduQuest CBT Portal on <span className="font-bold text-slate-900">{attempt.date}</span>.
            </p>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-12 lg:gap-20 py-2 md:py-4">
            <div className="text-center min-w-[60px] md:min-w-[80px]">
              <p className="text-[6px] md:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5 md:mb-2">Score</p>
              <p className="text-sm md:text-2xl lg:text-3xl font-serif font-black text-slate-900">{attempt.score} / {attempt.total}</p>
            </div>
            <div className="text-center min-w-[60px] md:min-w-[80px]">
              <p className="text-[6px] md:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5 md:mb-2">Percentage</p>
              <p className="text-sm md:text-2xl lg:text-3xl font-serif font-black text-blue-600">{attempt.percentage}%</p>
            </div>
            <div className="text-center min-w-[60px] md:min-w-[80px]">
              <p className="text-[6px] md:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5 md:mb-2">Result</p>
              <p className="text-sm md:text-2xl lg:text-3xl font-serif font-black text-emerald-600">PASSED</p>
            </div>
          </div>

          {/* Footer */}
          <div className="w-full pt-4 md:pt-12 flex flex-row items-end justify-between gap-2 md:gap-4 px-4 md:px-0">
            <div className="text-center md:text-left space-y-0.5 md:space-y-2 flex-1">
              <div className="hidden md:block w-32 lg:w-48 h-px bg-slate-300 mb-4" />
              <p className="text-[7px] md:text-xs font-bold text-slate-900 uppercase tracking-widest">Registrar General</p>
              <p className="text-[6px] md:text-[10px] text-slate-400 font-medium">TRCN Nigeria</p>
            </div>

            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="p-1 md:p-2 bg-white border border-slate-100 rounded-md md:rounded-lg shadow-sm">
                <QrCode className="w-6 h-6 md:w-10 md:h-10 text-slate-800" />
              </div>
              <p className="text-[6px] font-mono text-slate-400 uppercase">Verify: {attempt.id.substring(0, 8)}</p>
            </div>

            <div className="text-center md:text-right space-y-0.5 md:space-y-2 flex-1">
              <div className="hidden md:block w-32 lg:w-48 h-px bg-slate-300 mb-4" />
              <p className="text-[7px] md:text-xs font-bold text-slate-900 uppercase tracking-widest">Director of Exams</p>
              <p className="text-[6px] md:text-[10px] text-slate-400 font-medium">EduQuest Board</p>
            </div>
          </div>
        </div>

        {/* Seal Decoration */}
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-600/5 rounded-full blur-3xl" />
      </motion.div>

      {/* Controls */}
      <div className="mt-8 mb-8 flex flex-col sm:flex-row gap-4 print:hidden shrink-0">
        <Button 
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-6 rounded-2xl shadow-xl shadow-blue-500/20 w-full sm:w-auto"
        >
          Print Certificate
        </Button>
        <Button 
          variant="outline"
          onClick={onClose}
          className="bg-white hover:bg-slate-50 text-slate-900 font-bold px-8 py-6 rounded-2xl shadow-xl w-full sm:w-auto"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
