import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, X, GraduationCap } from "lucide-react";

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizViewProps {
  questions: Question[];
  onClose: () => void;
  title?: string;
}

export default function QuizView({ questions, onClose, title = "Knowledge Quiz" }: QuizViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

  const currentQuestion = questions[currentIndex];

  const handleOptionSelect = (index: number) => {
    if (showResult) return;
    setSelectedOption(index);
    setShowResult(true);
    if (index === currentQuestion.correctIndex) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setQuizComplete(true);
    }
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowResult(false);
    setScore(0);
    setQuizComplete(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-shell-bg/95 backdrop-blur-xl p-8 animate-fade-in">
      <div className="absolute top-0 left-0 w-full h-1 bg-shell-border">
        <motion.div
          className="h-full bg-shell-accent"
          animate={{
            width: `${((currentIndex + (quizComplete ? 1 : 0)) / questions.length) * 100}%`,
          }}
        />
      </div>

      <div className="w-full max-w-2xl flex flex-col items-center relative z-10">
        <header className="w-full flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-shell-accent/10 text-shell-accent">
              <GraduationCap size={20} />
            </div>
            <h2 className="text-xl font-bold text-shell-text">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-shell-text-muted hover:text-shell-text hover:bg-shell-surface transition-all"
          >
            <X size={20} />
          </button>
        </header>

        <AnimatePresence mode="wait">
          {!quizComplete ? (
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <h3 className="text-2xl font-bold text-shell-text mb-8 leading-tight">
                {currentQuestion.question}
              </h3>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const isCorrect = index === currentQuestion.correctIndex;
                  const isSelected = index === selectedOption;

                  let stateClass =
                    "border-shell-border hover:border-shell-accent/50 bg-shell-surface/30";
                  if (showResult) {
                    if (isCorrect)
                      stateClass = "border-emerald-500 bg-emerald-500/10 text-emerald-400";
                    else if (isSelected)
                      stateClass = "border-shell-error bg-shell-error/10 text-shell-error";
                    else stateClass = "border-shell-border opacity-50";
                  } else if (isSelected) {
                    stateClass = "border-shell-accent bg-shell-accent/10";
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => handleOptionSelect(index)}
                      disabled={showResult}
                      className={`w-full p-5 rounded-2xl border text-left transition-all flex items-center justify-between group ${stateClass}`}
                    >
                      <span className="font-medium">{option}</span>
                      {showResult && isCorrect && <CheckCircle2 size={20} />}
                      {showResult && isSelected && !isCorrect && <XCircle size={20} />}
                    </button>
                  );
                })}
              </div>

              {showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 p-6 rounded-2xl bg-shell-surface border border-shell-border"
                >
                  <p className="text-[13px] leading-relaxed text-shell-text-secondary">
                    <span className="font-bold text-shell-text">Explanation:</span>{" "}
                    {currentQuestion.explanation}
                  </p>
                  <button
                    onClick={handleNext}
                    className="mt-6 w-full py-4 rounded-xl bg-shell-accent text-white font-bold flex items-center justify-center gap-2 hover:bg-shell-accent-hover transition-all"
                  >
                    {currentIndex < questions.length - 1 ? "Next Question" : "See Results"}
                    <ChevronRight size={18} />
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="w-24 h-24 rounded-full border-4 border-shell-accent flex items-center justify-center mx-auto mb-8">
                <span className="text-3xl font-black text-shell-text">
                  {Math.round((score / questions.length) * 100)}%
                </span>
              </div>
              <h3 className="text-3xl font-bold text-shell-text mb-4">Quiz Completed!</h3>
              <p className="text-shell-text-secondary mb-12">
                You got {score} out of {questions.length} questions correct.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={resetQuiz}
                  className="flex-1 py-4 rounded-xl border border-shell-border hover:bg-shell-surface transition-all font-bold flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-4 rounded-xl bg-shell-accent text-white font-bold hover:bg-shell-accent-hover transition-all shadow-lg shadow-shell-accent/20"
                >
                  Close Quiz
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
