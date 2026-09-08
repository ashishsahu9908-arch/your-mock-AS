import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  svgContent?: string;
  title?: string;
  caption?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  svgContent,
  title = 'Diagram / Figure Inspection',
  caption,
}) => {
  const [scale, setScale] = useState(1);

  // Reset scale when opened
  useEffect(() => {
    if (isOpen) {
      setScale(1);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || (!imageUrl && !svgContent)) return null;

  const handleZoomIn = () => setScale((s) => Math.min(3.5, s + 0.25));
  const handleZoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));
  const handleReset = () => setScale(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Zoom level: {Math.round(scale * 100)}%
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 3.5}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-slate-600 dark:text-slate-400 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 min-h-[300px] overflow-auto p-6 flex items-center justify-center bg-slate-100/50 dark:bg-slate-950/50">
          <div 
            style={{ 
              transform: `scale(${scale})`, 
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out' 
            }}
            className="flex items-center justify-center max-w-full"
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title}
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-md select-none"
              />
            ) : svgContent ? (
              <div
                className="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-md select-none max-w-full overflow-hidden [&>svg]:max-w-full [&>svg]:h-auto"
                dangerouslySetForwardRef={undefined}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            ) : null}
          </div>
        </div>

        {/* Caption bar if provided */}
        {caption && (
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Description: </span>
            {caption}
          </div>
        )}
      </div>
    </div>
  );
};
