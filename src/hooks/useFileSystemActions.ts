import { useCallback, useState } from "react";
import type { FileNode } from "../types";
import type { useFileSystem } from "./useFileSystem";
import { useToast } from "../components/ToastProvider";
import {
  buildDirectoryPath,
  buildMarkdownNotePath,
  buildNewMarkdownContent,
  listChildNamesForDirectory,
  normalizeRenameName,
  resolveCreationDirectory,
  suggestUniqueDirectoryName,
  suggestUniqueMarkdownFileName,
} from "../utils/fileCreation";
import { getParentPath, joinPath } from "../utils/pathUtils";

export type CreationMode = "file" | "folder" | "rename";

export function useFileSystemActions(
  fs: ReturnType<typeof useFileSystem>,
  onFileSelect: (node: FileNode) => void
) {
  const toast = useToast();
  const [creationModal, setCreationModal] = useState<{
    isOpen: boolean;
    mode: CreationMode;
    targetNode: FileNode | null;
    suggestedName: string;
  }>({
    isOpen: false,
    mode: "file",
    targetNode: null,
    suggestedName: "",
  });

  const handleCreateNote = useCallback(
    (node: FileNode) => {
      const targetDirectory = resolveCreationDirectory(node);
      const existingNames = listChildNamesForDirectory(fs.fileTree, targetDirectory, fs.rootPath);
      const suggestedName = suggestUniqueMarkdownFileName(existingNames, "untitled-note");
      
      setCreationModal({
        isOpen: true,
        mode: "file",
        targetNode: node,
        suggestedName,
      });
    },
    [fs.fileTree, fs.rootPath]
  );

  const handleCreateFolder = useCallback(
    (node: FileNode) => {
      const targetDirectory = resolveCreationDirectory(node);
      const existingNames = listChildNamesForDirectory(fs.fileTree, targetDirectory, fs.rootPath);
      const suggestedName = suggestUniqueDirectoryName(existingNames, "untitled-folder");
      
      setCreationModal({
        isOpen: true,
        mode: "folder",
        targetNode: node,
        suggestedName,
      });
    },
    [fs.fileTree, fs.rootPath]
  );

  const handleRenameRequest = useCallback((node: FileNode) => {
    setCreationModal({
      isOpen: true,
      mode: "rename",
      targetNode: node,
      suggestedName: node.name,
    });
  }, []);

  const handleConfirmCreation = useCallback(
    async (name: string) => {
      if (!creationModal.targetNode) return;
      const node = creationModal.targetNode;
      const targetDirectory = resolveCreationDirectory(node);
      const existingNames = listChildNamesForDirectory(fs.fileTree, targetDirectory, fs.rootPath);

      try {
        if (creationModal.mode === "file") {
          const fileName = suggestUniqueMarkdownFileName(existingNames, name);
          const notePath = buildMarkdownNotePath(node, fileName);
          await fs.createFile(notePath, buildNewMarkdownContent(fileName));
          await fs.refreshTree();
          onFileSelect({
            name: fileName,
            path: notePath,
            is_dir: false,
            extension: "md",
            children: null,
          });
        } else {
          const folderName = suggestUniqueDirectoryName(existingNames, name);
          const folderPath = buildDirectoryPath(node, folderName);
          await fs.createDirectory(folderPath);
          await fs.refreshTree();
        }
      } catch (error) {
        console.error(`Failed to create ${creationModal.mode}:`, error);
        toast.error(`Failed to create ${creationModal.mode}: ${error}`);
      } finally {
        setCreationModal(prev => ({ ...prev, isOpen: false }));
      }
    },
    [fs, creationModal, onFileSelect, toast]
  );

  const handleConfirmRename = useCallback(async (newName: string, onRenameSuccess: (oldPath: string, newPath: string) => void | Promise<void>) => {
    if (!creationModal.targetNode) return;
    const node = creationModal.targetNode;
    
    try {
      const normalizedName = normalizeRenameName(node, newName);
      const newPath = joinPath(getParentPath(node.path), normalizedName);

      if (newPath === node.path) {
        toast.info("Name unchanged.");
        return;
      }

      await fs.renameEntry(node.path, newPath);
      await onRenameSuccess(node.path, newPath);
      toast.success("Renamed successfully.");
    } catch (error) {
       toast.error(`Rename failed: ${error}`);
    } finally {
      setCreationModal(prev => ({ ...prev, isOpen: false }));
    }
  }, [fs, creationModal.targetNode, toast]);

  return {
    creationModal,
    setCreationModal,
    handleCreateNote,
    handleCreateFolder,
    handleRenameRequest,
    handleConfirmCreation,
    handleConfirmRename,
  };
}
