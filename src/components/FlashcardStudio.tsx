import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Plus, Trash2, Sparkles, BookOpen, Check, Edit3, Lightbulb } from "lucide-react";
import type { StudyAI } from "../hooks/useStudyAI";
import type { FileNode } from "../types";
import type { FlashcardCard } from "../utils/flashcards";
import { getPathBaseName, getParentPath } from "../utils/pathUtils";
import { parseFlashcardsResponse } from "../utils/flashcards";
import { useToast } from "./ToastProvider";
import FlashcardDeck from "./FlashcardDeck";

interface FlashcardStudioProps {
  content: string;
  filePath: string;
  onSave: (content: string) => void;
  onFileSelect: (node: FileNode) => void;
  fileTree: FileNode[];
  ai: StudyAI;
}

export default function FlashcardStudio({
  content,
  filePath,
  onSave,
  onFileSelect,
  fileTree,
  ai,
}: FlashcardStudioProps) {
  const toast = useToast();
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [aiExpanding, setAiExpanding] = useState(false);

  // Form states
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");

  // Edit states
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<"front" | "back" | null>(null);
  const [editText, setEditText] = useState("");

  const fileName = useMemo(() => getPathBaseName(filePath), [filePath]);
  const dirPath = useMemo(() => getParentPath(filePath), [filePath]);

  // Parse initial content
  useEffect(() => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        setCards(parsed);
      } else {
        setCards([]);
      }
    } catch {
      setCards([]);
    }
  }, [content]);

  // Save utility
  const saveCards = useCallback(
    (newCards: FlashcardCard[]) => {
      setCards(newCards);
      onSave(JSON.stringify(newCards, null, 2));
    },
    [onSave],
  );

  // Find corresponding source note
  const sourceNode = useMemo(() => {
    const baseName = fileName.replace(".flashcards.json", "");

    // Find sibling files in fileTree
    const findSibling = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.is_dir && node.children) {
          const res = findSibling(node.children);
          if (res) return res;
        } else if (!node.is_dir && node.path.startsWith(dirPath)) {
          const nodeBase = node.name.replace(/\.[^/.]+$/, "");
          if (
            nodeBase.toLowerCase() === baseName.toLowerCase() &&
            !node.name.endsWith(".flashcards.json")
          ) {
            return node;
          }
        }
      }
      return null;
    };

    return findSibling(fileTree);
  }, [fileName, dirPath, fileTree]);

  // Handle manual add card
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) {
      toast.info("Please fill in both sides of the card.");
      return;
    }
    const updated = [...cards, { front: newFront.trim(), back: newBack.trim() }];
    saveCards(updated);
    setNewFront("");
    setNewBack("");
    setIsAdding(false);
    toast.success("Card added to deck.");
  };

  // Handle delete card
  const handleDeleteCard = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = cards.filter((_, i) => i !== index);
    saveCards(updated);
    toast.info("Card deleted.");
  };

  // Handle inline edit
  const startEditing = (index: number, field: "front" | "back", currentVal: string) => {
    setEditingIndex(index);
    setEditingField(field);
    setEditText(currentVal);
  };

  const submitEdit = () => {
    if (editingIndex === null || editingField === null) return;
    const updated = [...cards];
    if (!editText.trim()) {
      setEditingIndex(null);
      setEditingField(null);
      return;
    }
    updated[editingIndex] = {
      ...updated[editingIndex],
      [editingField]: editText.trim(),
    };
    saveCards(updated);
    setEditingIndex(null);
    setEditingField(null);
  };

  // Handle AI Expansion
  const handleAIExpand = async () => {
    if (!sourceNode) {
      toast.error("Could not locate source note/PDF file to generate cards from.");
      return;
    }

    setAiExpanding(true);
    try {
      const existingCardsPrompt = cards.map((c) => `Q: ${c.front}`).join("\n");
      const prompt = `Based on the source file, generate 5 MORE high-quality flashcards. 
      Do NOT duplicate any of the following existing questions:
      ${existingCardsPrompt}

      Return ONLY a raw JSON array of objects with no extra text or markdown code blocks:
      [
        {"front": "Question/Term", "back": "Answer/Definition"}
      ]`;

      // Read source note's contents directly if we can
      const fileContentText = await invokeReadFile(sourceNode.path);

      const response = await ai.sendMessage(prompt, fileContentText);
      if (!response) {
        toast.error("Failed to generate additional flashcards.");
        return;
      }

      const newCards = parseFlashcardsResponse(response);
      const updated = [...cards, ...newCards];
      saveCards(updated);
      toast.success(`Added ${newCards.length} new flashcards using AI!`);
    } catch (e) {
      console.error("Flashcard expansion error:", e);
      toast.error("AI Expansion failed. Try again.");
    } finally {
      setAiExpanding(false);
    }
  };

  // Safe read file from Tauri bridge helper
  const invokeReadFile = async (path: string): Promise<string> => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("read_file", { path });
    } catch {
      return "";
    }
  };

  return (
    <div className="h-full flex flex-col bg-shell-surface overflow-hidden">
      {/* Studio Header Action Banner */}
      <div className="flex-shrink-0 px-6 py-6 border-b border-shell-border bg-shell-bg/40 backdrop-blur-md relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-shell-accent/5 to-purple-500/5 opacity-50 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider">
                Flashcard Studio
              </span>
              {sourceNode && (
                <button
                  onClick={() => onFileSelect(sourceNode)}
                  className="flex items-center gap-1 text-[11px] text-shell-text-muted hover:text-shell-accent transition-colors font-medium"
                >
                  <BookOpen size={11} />
                  Linked to {sourceNode.name}
                </button>
              )}
            </div>
            <h2 className="text-xl font-black text-shell-text tracking-tight uppercase truncate max-w-lg">
              {fileName.replace(".flashcards.json", "")}
            </h2>
            <p className="text-xs text-shell-text-secondary mt-1 font-semibold">
              {cards.length} card{cards.length === 1 ? "" : "s"} in this deck
            </p>
          </div>

          <div className="flex items-center gap-3">
            {cards.length > 0 && (
              <button
                onClick={() => setIsReviewing(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-shell-accent text-white font-bold shadow-lg shadow-shell-accent/20 hover:bg-shell-accent-hover transition-all text-xs uppercase tracking-wider cursor-pointer"
              >
                <Play size={13} fill="currentColor" />
                Practice Deck
              </button>
            )}

            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-shell-border bg-shell-bg/50 hover:bg-shell-surface-hover text-shell-text font-bold transition-all text-xs uppercase tracking-wider cursor-pointer"
            >
              <Plus size={13} />
              Add Card
            </button>

            {sourceNode && (
              <button
                onClick={handleAIExpand}
                disabled={aiExpanding}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/20 text-amber-400 font-bold hover:from-amber-500/20 hover:to-purple-500/20 hover:border-amber-500/30 transition-all text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Sparkles size={13} className={aiExpanding ? "animate-spin" : ""} />
                {aiExpanding ? "Generating..." : "AI Expand"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
        {/* Expanding manual add form */}
        <AnimatePresence>
          {isAdding && (
            <motion.form
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: "auto", opacity: 1, marginBottom: 24 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onSubmit={handleAddCard}
              className="overflow-hidden border border-shell-border bg-shell-bg/60 rounded-3xl p-6 glass-layer-2"
            >
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-shell-text-muted mb-4 flex items-center gap-2">
                <Plus size={14} className="text-shell-accent" />
                Create New Flashcard
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-shell-text-secondary uppercase tracking-widest pl-1">
                    Front (Question or Term)
                  </label>
                  <textarea
                    rows={2}
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                    placeholder="Enter the question, vocabulary word, or concept..."
                    className="w-full rounded-2xl border border-shell-border bg-shell-bg/85 px-4 py-3 text-xs text-shell-text placeholder:text-shell-text-muted focus:border-shell-accent/40 outline-none resize-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-shell-text-secondary uppercase tracking-widest pl-1">
                    Back (Answer or Definition)
                  </label>
                  <textarea
                    rows={2}
                    value={newBack}
                    onChange={(e) => setNewBack(e.target.value)}
                    placeholder="Enter the answer, explanation, or definition..."
                    className="w-full rounded-2xl border border-shell-border bg-shell-bg/85 px-4 py-3 text-xs text-shell-text placeholder:text-shell-text-muted focus:border-shell-accent/40 outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-shell-text-muted hover:text-shell-text transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-shell-accent text-white font-bold hover:bg-shell-accent-hover transition-colors text-xs cursor-pointer"
                >
                  <Check size={14} />
                  Add Card
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {cards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
            {cards.map((card, i) => (
              <motion.div
                layout
                key={`card-${i}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="group relative flex flex-col rounded-3xl border border-shell-border bg-shell-bg/30 hover:bg-shell-bg/70 hover:border-shell-accent/25 hover:shadow-xl hover:shadow-shell-accent/5 transition-all duration-300 min-h-[140px] overflow-hidden"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-shell-accent/20 to-purple-500/20 group-hover:from-shell-accent/60 group-hover:to-purple-500/60 transition-colors" />

                <div className="flex-1 p-5 flex flex-col gap-4">
                  {/* Front Side */}
                  <div className="flex-1 flex flex-col">
                    <span className="text-[9px] font-bold text-shell-accent uppercase tracking-widest flex items-center gap-1.5 mb-1.5 select-none">
                      <Lightbulb size={10} />
                      Front
                    </span>
                    {editingIndex === i && editingField === "front" ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={submitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitEdit();
                          }
                        }}
                        autoFocus
                        rows={2}
                        className="w-full text-xs text-shell-text bg-shell-bg/70 border border-shell-accent/40 rounded-xl px-3 py-2 outline-none resize-none font-medium leading-relaxed"
                      />
                    ) : (
                      <p
                        onClick={() => startEditing(i, "front", card.front)}
                        className="text-xs text-shell-text font-bold leading-relaxed cursor-edit flex items-start gap-1 group/text"
                        title="Click to edit Front"
                      >
                        <span className="flex-1 truncate-3-lines">{card.front}</span>
                        <Edit3
                          size={11}
                          className="text-shell-text-muted opacity-0 group-hover/text:opacity-100 transition-opacity ml-1.5 mt-0.5"
                        />
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-[1px] bg-shell-border/60 border-dashed" />

                  {/* Back Side */}
                  <div className="flex-1 flex flex-col">
                    <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5 select-none">
                      <Check size={10} />
                      Back
                    </span>
                    {editingIndex === i && editingField === "back" ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={submitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitEdit();
                          }
                        }}
                        autoFocus
                        rows={2}
                        className="w-full text-xs text-shell-text bg-shell-bg/70 border border-shell-accent/40 rounded-xl px-3 py-2 outline-none resize-none font-medium leading-relaxed"
                      />
                    ) : (
                      <p
                        onClick={() => startEditing(i, "back", card.back)}
                        className="text-xs text-shell-text-secondary leading-relaxed cursor-edit flex items-start gap-1 group/text"
                        title="Click to edit Back"
                      >
                        <span className="flex-1 truncate-3-lines">{card.back}</span>
                        <Edit3
                          size={11}
                          className="text-shell-text-muted opacity-0 group-hover/text:opacity-100 transition-opacity ml-1.5 mt-0.5"
                        />
                      </p>
                    )}
                  </div>
                </div>

                {/* Floating Delete Action */}
                <button
                  onClick={(e) => handleDeleteCard(i, e)}
                  className="absolute bottom-3 right-3 p-2 rounded-xl border border-shell-border bg-shell-surface hover:border-shell-error/25 hover:bg-shell-error/15 hover:text-shell-error transition-all opacity-0 group-hover:opacity-100 shadow-md cursor-pointer"
                  title="Delete Card"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center">
            <motion.div
              animate={{ y: [-4, 4, -4] }}
              transition={{ ease: "easeInOut", duration: 4, repeat: Infinity }}
              className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500/15 to-purple-500/15 border border-shell-border flex items-center justify-center shadow-inner"
            >
              <Sparkles
                size={28}
                className="text-amber-400 fill-amber-400/5 animate-pulse-subtle"
              />
            </motion.div>
            <h3 className="text-base font-bold text-shell-text mb-2">Deck is Currently Empty</h3>
            <p className="text-xs text-shell-text-secondary max-w-[280px] mx-auto leading-relaxed mb-8">
              Write custom cards using the "Add Card" button, or expand this deck instantly using AI
              context.
            </p>
            {sourceNode && (
              <button
                onClick={handleAIExpand}
                disabled={aiExpanding}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 text-white font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Sparkles size={13} className={aiExpanding ? "animate-spin" : ""} />
                {aiExpanding ? "Generating Deck..." : "Generate Deck with AI"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Practice 3D Flip Viewer Overlay */}
      {isReviewing && (
        <FlashcardDeck
          cards={cards}
          onClose={() => setIsReviewing(false)}
          title={fileName.replace(".flashcards.json", "")}
        />
      )}
    </div>
  );
}
