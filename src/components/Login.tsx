/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  GraduationCap, 
  User, 
  Lock, 
  ArrowRight, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LoginProps {
  onLogin: () => void;
  error?: string | null;
}

export default function Login({ onLogin, error }: LoginProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await onLogin();
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-6 font-sans">
      <div className="max-w-md w-full space-y-6 md:space-y-8">
        <div className="text-center space-y-3 md:space-y-4">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-200 mb-2 md:mb-4"
          >
            <GraduationCap className="w-8 h-8 md:w-10 md:h-10" />
          </motion.div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">EduQuest CBT</h1>
          <p className="text-slate-500 font-medium text-xs md:text-sm px-4">Teachers Registration Council of Nigeria (TRCN) Professional Qualifying Examination Portal</p>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-none shadow-2xl shadow-slate-200/60 overflow-hidden rounded-3xl">
            <CardHeader className="bg-white border-b border-slate-50 p-6 md:p-8">
              <CardTitle className="text-lg md:text-xl font-bold text-slate-800">Secure Access</CardTitle>
              <CardDescription className="text-xs md:text-sm text-slate-500 font-medium">Sign in with your Google account to access the examination portal.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8 space-y-5 md:space-y-6 text-center">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-medium text-left">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              <Button 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-8 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-100 rounded-2xl font-bold text-base md:text-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 h-16 md:h-20 flex items-center justify-center gap-4"
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                    Connecting...
                  </div>
                ) : (
                  <>
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Sign in with Google
                  </>
                )}
              </Button>
              <p className="text-[10px] md:text-xs text-slate-400 font-medium">
                By signing in, you agree to the examination terms and conditions.
              </p>
            </CardContent>
            <CardFooter className="bg-slate-50 p-4 md:p-6 flex items-center justify-center gap-3 md:gap-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-[9px] md:text-xs font-bold text-emerald-600 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 md:w-4 h-4" /> Secure
              </div>
              <div className="w-1 h-1 bg-slate-300 rounded-full" />
              <div className="flex items-center gap-1.5 text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 md:w-4 h-4" /> Verified
              </div>
            </CardFooter>
          </Card>
        </motion.div>

        <div className="text-center space-y-1 md:space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technical Support</p>
          <p className="text-xs md:text-sm font-medium text-slate-600">Contact your center supervisor for login issues.</p>
        </div>
      </div>
    </div>
  );
}
