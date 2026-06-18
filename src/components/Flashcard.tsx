import { useState } from "react";
import { motion } from "framer-motion";
import { Info, HelpCircle } from "lucide-react";

interface FlashcardProps {
  front: string;
  back: string;
  isFlipped?: boolean;
  onFlip?: () => void;
}

export default function Flashcard({
  front,
  back,
  isFlipped: controlledFlipped,
  onFlip,
}: FlashcardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped;

  const handleFlip = () => {
    if (onFlip) {
      onFlip();
    } else {
      setInternalFlipped(!internalFlipped);
    }
  };

  return (
    <div
      className="perspective-1000 w-full max-w-[500px] aspect-[1.6/1] cursor-pointer group"
      onClick={handleFlip}
    >
      <motion.div
        className="relative w-full h-full preserve-3d duration-700 transition-transform"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        {/* Front Face */}
        <div className="absolute inset-0 backface-hidden glass-layer-2 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl border border-white/10 overflow-hidden">
          <div className="absolute top-4 left-4 text-shell-accent/40">
            <HelpCircle size={18} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-shell-accent/5 to-transparent pointer-events-none" />
          <h3 className="text-xl font-bold text-shell-text leading-tight group-hover:scale-[1.02] transition-transform">
            {front}
          </h3>
          <p className="absolute bottom-6 text-[10px] text-shell-text-muted uppercase tracking-[0.2em] font-bold">
            Click to reveal answer
          </p>
        </div>

        {/* Back Face */}
        <div className="absolute inset-0 backface-hidden glass-layer-2 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl border border-shell-accent/20 rotate-y-180 overflow-hidden">
          <div className="absolute top-4 left-4 text-emerald-400/40">
            <Info size={18} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <p className="text-lg text-shell-text-secondary leading-relaxed">{back}</p>
          <p className="absolute bottom-6 text-[10px] text-emerald-400/60 uppercase tracking-[0.2em] font-bold">
            Correct!
          </p>
        </div>
      </motion.div>
    </div>
  );
}
