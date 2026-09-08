import React from 'react';
import { BookOpen, Moon, Sun, History, PlusCircle, Sparkles } from 'lucide-react';
import { FullscreenButton } from './FullscreenButton';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: 'home' | 'upload' | 'library' | 'history') => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  hasActiveTest?: boolean;
  readyTestsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  isDarkMode,
  onToggleTheme,
  hasActiveTest = false,
  readyTestsCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand & App Title */}
        <div 
          onClick={() => {
            if (currentView === 'test') {
              if (window.confirm('A test is currently in progress. Do you want to return to the home screen? Your test progress will be preserved.')) {
                onNavigate('home');
              }
            } else {
              onNavigate('home');
            }
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white">
                DPP<span className="text-blue-600 dark:text-blue-400">2</span>JEE
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                CBT Mock
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Daily Practice Problem to Online Exam Simulator
            </p>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentView !== 'test' && (
            <>
              <button
                onClick={() => onNavigate('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  currentView === 'upload'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>New DPP</span>
              </button>

              <button
                onClick={() => onNavigate('library')}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  currentView === 'library'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Ready Tests</span>
                {readyTestsCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    currentView === 'library'
                      ? 'bg-white text-blue-600'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  }`}>
                    {readyTestsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onNavigate('history')}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  currentView === 'history'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Test History</span>
                <span className="sm:hidden">History</span>
              </button>
            </>
          )}

          {hasActiveTest && currentView !== 'test' && (
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-white animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Resume Test</span>
            </button>
          )}

          {/* Full Screen Toggle */}
          <FullscreenButton
            id="nav-fullscreen-btn"
            variant="default"
            showLabel={false}
            className="w-9 h-9 !p-0 rounded-xl"
          />

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle Theme"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
