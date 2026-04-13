import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Cookie className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-slate-900">Cookie Policy</h3>
                  <button 
                    onClick={() => setIsVisible(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                  We use cookies to enhance your exam preparation experience, analyze site traffic, and provide AI-powered tutoring.
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAccept}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-10 text-xs"
                  >
                    Accept All
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setIsVisible(false)}
                    className="flex-1 border-slate-200 text-slate-600 font-bold rounded-xl h-10 text-xs"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
