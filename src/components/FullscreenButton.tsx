import React, { useState, useEffect, useCallback } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenButtonProps {
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
  variant?: 'default' | 'subtle' | 'header';
  id?: string;
}

export const FullscreenButton: React.FC<FullscreenButtonProps> = ({
  className = '',
  showLabel = false,
  labelClassName = '',
  variant = 'header',
  id = 'fullscreen-toggle-btn',
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  // Check and update fullscreen state
  const checkFullscreen = useCallback(() => {
    const doc = document as any;
    const fsElement =
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement;

    setIsFullscreen(Boolean(fsElement));
  }, []);

  // Toggle fullscreen mode on document root element
  const toggleFullscreen = useCallback(async () => {
    const doc = document as any;
    const docEl = document.documentElement as any;

    try {
      const isCurrentlyFs = Boolean(
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isCurrentlyFs) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err: any) {
      console.warn('Fullscreen toggle request was prevented or not permitted:', err);
    }
  }, []);

  // Listen for fullscreen change events & Escape key handler
  useEffect(() => {
    const doc = document as any;
    const docEl = document.documentElement as any;

    const supported = Boolean(
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen
    );
    setIsSupported(supported);

    const handleFullscreenChange = () => {
      checkFullscreen();
    };

    // Event listener for Escape key to handle exiting fullscreen explicitly
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const isFs = Boolean(
          document.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
        );

        if (isFs) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
          } else if (doc.mozCancelFullScreen) {
            doc.mozCancelFullScreen();
          } else if (doc.msExitFullscreen) {
            doc.msExitFullscreen();
          }
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    // Initial check
    checkFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [checkFullscreen]);

  if (!isSupported) {
    return null;
  }

  // Base styling variants
  let buttonStyle = 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700';
  if (variant === 'subtle') {
    buttonStyle = 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400';
  } else if (variant === 'header') {
    buttonStyle = isFullscreen
      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60'
      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700';
  }

  const tooltipText = isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen Mode';

  return (
    <button
      id={id}
      type="button"
      onClick={toggleFullscreen}
      title={tooltipText}
      aria-label={tooltipText}
      className={`relative inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all select-none active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${buttonStyle} ${className}`}
    >
      {isFullscreen ? (
        <Minimize2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 flex-shrink-0" />
      ) : (
        <Maximize2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 flex-shrink-0" />
      )}

      {showLabel && (
        <span className={labelClassName || 'font-bold'}>
          {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
        </span>
      )}
    </button>
  );
};
