import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Trophy, RefreshCcw } from "lucide-react";
import Flashcard from "./Flashcard";

interface Card {
  front: string;
  back: string;
}

interface FlashcardDeckProps {
  cards: Card[];
  onClose: () => void;
  title?: string;
}

export default function FlashcardDeck({
  cards,
  onClose,
  title = "Flashcard Session",
}: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(currentIndex + 1), 100);
    } else {
      setCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(currentIndex - 1), 100);
    }
  };

  const reset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setCompleted(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (completed) {
        if (event.key.toLowerCase() === "r") {
          event.preventDefault();
          reset();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setIsFlipped((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completed, onClose, currentIndex, cards.length]);

  if (cards.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-shell-bg/95 backdrop-blur-xl p-8">
        <div className="text-center">
          <p className="text-shell-text-muted mb-4 text-lg">No cards in this deck.</p>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-shell-surface hover:bg-shell-surface-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-shell-bg/95 backdrop-blur-xl p-8 animate-fade-in overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] aspect-square bg-shell-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] aspect-square bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl flex flex-col h-full relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-shell-text tracking-tight uppercase">
              {title}
            </h2>
            <p className="text-xs text-shell-text-muted font-bold tracking-[0.2em] mt-1">
              Card {completed ? cards.length : currentIndex + 1} of {cards.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-full bg-shell-surface/50 border border-shell-border hover:bg-shell-error/20 hover:text-shell-error transition-all"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {!completed ? (
              <motion.div
                key="active-deck"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full flex flex-col items-center"
              >
                <Flashcard
                  front={cards[currentIndex].front}
                  back={cards[currentIndex].back}
                  isFlipped={isFlipped}
                  onFlip={() => setIsFlipped(!isFlipped)}
                />

                {/* Navigation Controls */}
                <div className="mt-16 flex items-center gap-8">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className={`p-4 rounded-2xl border transition-all ${
                      currentIndex === 0
                        ? "opacity-20 border-shell-border cursor-not-allowed"
                        : "bg-shell-surface border-shell-border hover:border-shell-accent/40 hover:text-shell-accent"
                    }`}
                  >
                    <ChevronLeft size={24} />
                  </button>

                  {/* Progress Indicator */}
                  <div className="flex items-center gap-3">
                    {cards.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === currentIndex
                            ? "w-8 bg-shell-accent"
                            : i < currentIndex
                              ? "w-2 bg-emerald-400"
                              : "w-2 bg-shell-border"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleNext}
                    className="p-4 rounded-2xl bg-shell-accent text-white shadow-xl shadow-shell-accent/20 hover:bg-shell-accent-hover transition-all"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="completion"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center p-12 glass-layer-2 rounded-[40px] border border-emerald-500/20 max-w-lg w-full"
              >
                <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 text-emerald-400 shadow-xl shadow-emerald-500/10">
                  <Trophy size={40} />
                </div>
                <h3 className="text-3xl font-black text-shell-text mb-4">Mastery Achieved!</h3>
                <p className="text-shell-text-secondary leading-relaxed mb-10">
                  You've reviewed all {cards.length} cards in this deck. Great job keeping your
                  study streak alive.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={reset}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border border-shell-border hover:bg-shell-surface transition-all font-bold"
                  >
                    <RefreshCcw size={18} />
                    Restart
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 rounded-2xl bg-emerald-500 text-white font-bold shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                  >
                    Finish
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hint Footer */}
        {!completed && (
          <footer className="mt-auto py-8 text-center text-[10px] text-shell-text-muted font-bold tracking-[0.3em] uppercase opacity-40">
            Use arrow keys or click buttons to navigate
          </footer>
        )}
      </div>
    </div>
  );
}
