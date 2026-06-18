import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";

interface DropOverlayProps {
  isVisible: boolean;
}

export default function DropOverlay({ isVisible }: DropOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
      className="fixed inset-0 z-[2000] flex items-center justify-center p-8 bg-shell-accent/20 backdrop-blur-[4px]"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: isVisible ? 1 : 0.9, opacity: isVisible ? 1 : 0 }}
        className="w-full max-w-lg glass-layer-2 rounded-3xl border-2 border-dashed border-shell-accent flex flex-col items-center justify-center py-16 shadow-2xl"
      >
        <div className="w-20 h-20 rounded-full bg-shell-accent/10 flex items-center justify-center mb-6">
          <UploadCloud size={40} className="text-shell-accent animate-bounce" />
        </div>
        <h2 className="text-2xl font-bold text-shell-text mb-2 tracking-tight">
          Import to StudyShell
        </h2>
        <p className="text-shell-text-secondary text-[14px]">
          Release to copy files into your workspace
        </p>
      </motion.div>
    </motion.div>
  );
}
