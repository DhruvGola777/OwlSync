import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  VscChevronRight, VscChevronDown, VscNewFile, VscNewFolder, VscTrash,
  VscFile, VscFolder, VscFolderOpened
} from 'react-icons/vsc';
import { getFileIcon } from '../utils/fileIcons';

function buildFileTree(files) {
  const root = { name: 'root', type: 'folder', children: {}, path: '/' };

  files.forEach(file => {
    // Ignore dummy .keep files in the UI if they are the only thing in a folder, 
    // actually we still build the tree with them, but we'll hide the .keep file itself in the renderer.
    const parts = file.path.split('/').filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          type: isFile ? 'file' : 'folder',
          children: {},
          path: '/' + parts.slice(0, index + 1).join('/'),
          file: isFile ? file : null
        };
      }
      current = current.children[part];
    });
  });

  return root;
}

const FileNode = ({
  node,
  level = 0,
  activeFileId,
  onFileSelect,
  onDeleteFile,
  creatingState,
  setCreatingState,
  handleCreateSubmit,
  setContextMenu,
  onDragStartNode,
  onDragOverNode,
  onDragLeaveNode,
  onDropNode,
  draggedNode,
  dragOverPath
}) => {
  const [isOpen, setIsOpen] = useState(level === 0 || level === 1); // open root and level 1 by default
  const inputRef = useRef(null);

  const isFolder = node.type === 'folder';
  const isActive = node.file?.id === activeFileId;
  const isCreatingHere = creatingState?.parentPath === node.path;
  const isBeingDragged = draggedNode?.path === node.path;
  const isDropTarget = dragOverPath === node.path;

  useEffect(() => {
    if (isCreatingHere && inputRef.current) {
      inputRef.current.focus();
      setIsOpen(true);
    }
  }, [isCreatingHere]);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (isFolder) setIsOpen(!isOpen);
    else if (node.file) onFileSelect(node.file);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Allow context menu on folders too
    if (node.name !== 'root') {
      setContextMenu({ x: e.clientX, y: e.clientY, node });
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCreateSubmit(e.target.value);
    } else if (e.key === 'Escape') {
      setCreatingState(null);
    }
  };

  if (node.name === 'root') {
    return (
      <div className="w-full text-white text-[15px] font-sans">
        {Object.values(node.children)
          .sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
          })
          .map(child => (
            <FileNode
              key={child.path}
              node={child}
              level={0}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
              onDeleteFile={onDeleteFile}
              creatingState={creatingState}
              setCreatingState={setCreatingState}
              handleCreateSubmit={handleCreateSubmit}
              setContextMenu={setContextMenu}
              onDragStartNode={onDragStartNode}
              onDragOverNode={onDragOverNode}
              onDragLeaveNode={onDragLeaveNode}
              onDropNode={onDropNode}
              draggedNode={draggedNode}
              dragOverPath={dragOverPath}
            />
          ))}
        {/* Creating at root */}
        {creatingState && creatingState.parentPath === '/' && (
          <div className="flex items-center py-1 px-2" style={{ paddingLeft: '8px' }}>
            <div className="w-[18px] mr-2 shrink-0"></div>
            {creatingState.type === 'folder' ? (
              <VscFolder className="w-[18px] h-[18px] text-[#dcb67a] mr-2 shrink-0" />
            ) : (
              <VscFile className="w-[18px] h-[18px] text-gray-400 mr-2 shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              className="bg-gray-950 text-gray-200 border border-indigo-500/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-[15px] px-2 w-full h-[26px] rounded-sm"
              onKeyDown={onKeyDown}
              onBlur={() => setCreatingState(null)}
            />
          </div>
        )}
      </div>
    );
  }

  // Hide .keep files from the UI completely
  if (node.name === '.keep') return null;

  return (
    <div className="select-none">
      <div
        draggable
        onDragStart={(e) => onDragStartNode(e, node)}
        onDragOver={(e) => onDragOverNode(e, node)}
        onDragLeave={(e) => onDragLeaveNode(e, node)}
        onDrop={(e) => onDropNode(e, node)}
        className={`flex items-center group py-1 px-2 cursor-pointer transition-all duration-100 rounded-sm mx-1
          ${isBeingDragged ? 'opacity-40 scale-[0.98]' : ''}
          ${isDropTarget ? 'bg-indigo-600/30 ring-1 ring-indigo-400 text-white shadow-sm' : ''}
          ${!isDropTarget && isActive ? 'bg-indigo-500/30 text-white' : ''}
          ${!isDropTarget && !isActive ? 'text-gray-200 hover:text-white hover:bg-white/10' : ''}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleToggle}
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center flex-1 min-w-0 h-[26px]">
          <div className="w-[18px] flex justify-center shrink-0 items-center mr-1">
            {isFolder && (
              isOpen ? <VscChevronDown className="w-5 h-5" /> : <VscChevronRight className="w-5 h-5" />
            )}
          </div>
          {isFolder ? (
            isOpen ? <VscFolderOpened className="w-[18px] h-[18px] text-[#dcb67a] mr-2 shrink-0" /> : <VscFolder className="w-[18px] h-[18px] text-[#dcb67a] mr-2 shrink-0" />
          ) : getFileIcon(node.name)}
          <span className="truncate ml-0.5">{node.name}</span>
        </div>

        {/* Hover Actions */}
        <div className="hidden group-hover:flex items-center space-x-1.5 shrink-0 ml-2">
          {isFolder && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setCreatingState({ parentPath: node.path, type: 'file' }); setIsOpen(true); }}
                className="p-[2px] hover:bg-white/10 rounded" title="New File"
              >
                <VscNewFile className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setCreatingState({ parentPath: node.path, type: 'folder' }); setIsOpen(true); }}
                className="p-[2px] hover:bg-white/10 rounded" title="New Folder"
              >
                <VscNewFolder className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {!isFolder && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteFile(node.file); }}
              className="p-[2px] hover:bg-white/10 rounded" title="Delete"
            >
              <VscTrash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isFolder && isOpen && (
        <div className="flex flex-col">
          {/* Creating inside this folder */}
          {isCreatingHere && (
            <div className="flex items-center py-1 px-2" style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
              <div className="w-[18px] mr-1 shrink-0"></div>
              {creatingState.type === 'folder' ? (
                <VscFolder className="w-[18px] h-[18px] text-[#dcb67a] mr-2 shrink-0" />
              ) : (
                <VscFile className="w-[18px] h-[18px] text-gray-400 mr-2 shrink-0" />
              )}
              <input
                ref={inputRef}
                type="text"
                className="bg-gray-950 text-gray-200 border border-indigo-500/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-[15px] px-2 w-full h-[26px] rounded-sm"
                onKeyDown={onKeyDown}
                onBlur={() => setCreatingState(null)}
              />
            </div>
          )}

          {Object.values(node.children)
            .sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === 'folder' ? -1 : 1;
            })
            .map(child => (
              <FileNode
                key={child.path}
                node={child}
                level={level + 1}
                activeFileId={activeFileId}
                onFileSelect={onFileSelect}
                onDeleteFile={onDeleteFile}
                creatingState={creatingState}
                setCreatingState={setCreatingState}
                handleCreateSubmit={handleCreateSubmit}
                setContextMenu={setContextMenu}
                onDragStartNode={onDragStartNode}
                onDragOverNode={onDragOverNode}
                onDragLeaveNode={onDragLeaveNode}
                onDropNode={onDropNode}
                draggedNode={draggedNode}
                dragOverPath={dragOverPath}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer = ({ 
  projectName, 
  files, 
  activeFileId, 
  onFileSelect, 
  onCreateFile, 
  onRenameFile, 
  onDeleteFile,
  onMoveFile 
}) => {
  const fileTree = useMemo(() => buildFileTree(files || []), [files]);

  // { parentPath: string, type: 'file' | 'folder' } | null
  const [creatingState, setCreatingState] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Drag & Drop State
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);
  
  // Move confirmation dialog: { sourceNode, targetFolderNode, newPath } | null
  const [moveConfirmDialog, setMoveConfirmDialog] = useState(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Keyboard shortcut to confirm or cancel move dialog
  useEffect(() => {
    if (!moveConfirmDialog) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMoveConfirmDialog(null);
      } else if (e.key === 'Enter') {
        handleConfirmMove();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveConfirmDialog]);

  const handleCreateSubmit = (newName) => {
    if (!newName.trim() || !creatingState) return;

    const parentPath = creatingState.parentPath;

    if (creatingState.type === 'file') {
      const path = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;
      onCreateFile({ name: newName, path });
    } else if (creatingState.type === 'folder') {
      // To create a folder, we create a dummy .keep file inside it
      const path = parentPath === '/' ? `/${newName}/.keep` : `${parentPath}/${newName}/.keep`;
      onCreateFile({ name: '.keep', path, content: '' });
    }

    setCreatingState(null);
  };

  // Drag & Drop Handlers
  const handleDragStartNode = (e, node) => {
    e.stopPropagation();
    setDraggedNode(node);
    e.dataTransfer.setData('application/json', JSON.stringify({ path: node.path, name: node.name, type: node.type }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverNode = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNode) return;

    // Target folder is node if it is a folder, otherwise parent folder
    let targetPath = node.path;
    if (node.type !== 'folder') {
      const parts = node.path.split('/');
      parts.pop();
      targetPath = parts.join('/') || '/';
    }

    // Cannot drop on itself or into its own subdirectory
    if (draggedNode.path === targetPath || (draggedNode.type === 'folder' && targetPath.startsWith(draggedNode.path + '/'))) {
      e.dataTransfer.dropEffect = 'none';
      setDragOverPath(null);
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    setDragOverPath(targetPath);
  };

  const handleDragLeaveNode = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverPath === node.path) {
      setDragOverPath(null);
    }
  };

  const handleDropNode = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);

    if (!draggedNode) return;

    let targetFolder = node;
    if (node.type !== 'folder') {
      // If dropped onto a file, target its parent folder
      const parts = node.path.split('/');
      parts.pop();
      const parentPath = parts.join('/') || '/';
      targetFolder = { name: parentPath === '/' ? 'root' : parentPath.split('/').pop(), type: 'folder', path: parentPath };
    }

    executeMoveRequest(draggedNode, targetFolder);
    setDraggedNode(null);
  };

  // Dropping into root empty area
  const handleDragOverRoot = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNode) return;
    
    // Check if item is already at root
    const parts = draggedNode.path.split('/').filter(Boolean);
    if (parts.length <= 1) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    setDragOverPath('/');
  };

  const handleDropRoot = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    if (!draggedNode) return;

    const rootTarget = { name: 'root', type: 'folder', path: '/' };
    executeMoveRequest(draggedNode, rootTarget);
    setDraggedNode(null);
  };

  const executeMoveRequest = (sourceNode, targetFolderNode) => {
    if (!sourceNode || !targetFolderNode) return;

    // Check if already in this folder
    const targetPath = targetFolderNode.path === '/' 
      ? `/${sourceNode.name}` 
      : `${targetFolderNode.path}/${sourceNode.name}`;

    if (targetPath === sourceNode.path) return;

    // Prevent moving folder into itself or child
    if (sourceNode.type === 'folder' && (targetFolderNode.path === sourceNode.path || targetFolderNode.path.startsWith(sourceNode.path + '/'))) {
      alert('Cannot move a folder into itself or into one of its subfolders.');
      return;
    }

    // Open confirmation dialog
    setMoveConfirmDialog({
      sourceNode,
      targetFolderNode,
      newPath: targetPath
    });
  };

  const handleConfirmMove = () => {
    if (!moveConfirmDialog) return;
    const { sourceNode, targetFolderNode, newPath } = moveConfirmDialog;
    
    if (onMoveFile) {
      onMoveFile(
        sourceNode.path,
        newPath,
        sourceNode.name,
        targetFolderNode.name === 'root' ? 'root' : targetFolderNode.name
      );
    }

    setMoveConfirmDialog(null);
  };

  return (
    <div className="flex flex-col h-full w-full relative group/sidebar">
      <div className="flex items-center justify-between px-4 py-2 h-[44px] shrink-0 border-b border-white/5">
        <h2 className="text-[13px] font-bold text-gray-200 tracking-wider uppercase truncate max-w-[150px]" title={projectName || 'Explorer'}>
          {projectName || 'EXPLORER'}
        </h2>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setCreatingState({ parentPath: '/', type: 'file' })}
            className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition-colors"
            title="New File"
          >
            <VscNewFile className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCreatingState({ parentPath: '/', type: 'folder' })}
            className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition-colors"
            title="New Folder"
          >
            <VscNewFolder className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div 
        className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 py-2 transition-colors ${dragOverPath === '/' ? 'bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/50' : ''}`}
        onDragOver={handleDragOverRoot}
        onDragLeave={() => setDragOverPath(prev => prev === '/' ? null : prev)}
        onDrop={handleDropRoot}
      >
        {(files && files.length > 0) || creatingState ? (
          <FileNode
            node={fileTree}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
            onDeleteFile={onDeleteFile}
            creatingState={creatingState}
            setCreatingState={setCreatingState}
            handleCreateSubmit={handleCreateSubmit}
            setContextMenu={setContextMenu}
            onDragStartNode={handleDragStartNode}
            onDragOverNode={handleDragOverNode}
            onDragLeaveNode={handleDragLeaveNode}
            onDropNode={handleDropNode}
            draggedNode={draggedNode}
            dragOverPath={dragOverPath}
          />
        ) : (
          <div className="text-[13px] text-gray-500 text-center mt-10 px-4">
            You have not yet created any files.
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#252526] border border-white/10 shadow-2xl rounded-md py-1 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-5 py-2 text-[15px] text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors"
            onClick={() => {
              const newName = window.prompt("Enter new name:", contextMenu.node.name);
              if (newName && newName.trim() && newName !== contextMenu.node.name) {
                onRenameFile(contextMenu.node, newName.trim());
              }
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            className="w-full text-left px-5 py-2 text-[15px] text-gray-200 hover:bg-indigo-500 hover:text-white transition-colors"
            onClick={() => {
              const node = contextMenu.node;
              const msg = node.type === 'folder'
                ? `Are you sure you want to delete the folder "${node.name}" and all its contents?`
                : `Are you sure you want to delete "${node.name}"?`;
              if (window.confirm(msg)) {
                onDeleteFile(node);
              }
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* VS Code Style Move Confirmation Modal Dialog */}
      {moveConfirmDialog && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100"
          onClick={() => setMoveConfirmDialog(null)}
        >
          <div 
            className="bg-[#252526] border border-white/15 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center space-x-3 px-5 pt-5 pb-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                <VscFolderOpened className="w-5 h-5 text-indigo-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-white truncate">
                  Move {moveConfirmDialog.sourceNode.type === 'folder' ? 'Folder' : 'File'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Confirm moving item in workspace
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-3 space-y-3">
              <p className="text-[14px] text-gray-200 leading-relaxed">
                Are you sure you want to move <span className="font-semibold text-white bg-white/10 px-1.5 py-0.5 rounded font-mono text-[13px]">{moveConfirmDialog.sourceNode.name}</span> into <span className="font-semibold text-white bg-white/10 px-1.5 py-0.5 rounded font-mono text-[13px]">{moveConfirmDialog.targetFolderNode.name === 'root' ? 'root directory' : moveConfirmDialog.targetFolderNode.name}</span>?
              </p>
              
              <div className="bg-[#1e1e1e] p-3 rounded-md border border-white/5 font-mono text-[12px] space-y-1.5">
                <div className="flex items-center text-gray-300 truncate">
                  <span className="w-12 text-gray-500 text-[11px] uppercase tracking-wider shrink-0">From:</span>
                  <span className="truncate text-rose-300">{moveConfirmDialog.sourceNode.path}</span>
                </div>
                <div className="flex items-center text-gray-300 truncate">
                  <span className="w-12 text-gray-500 text-[11px] uppercase tracking-wider shrink-0">To:</span>
                  <span className="truncate text-emerald-300">{moveConfirmDialog.newPath}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2.5 px-5 py-3.5 bg-[#1e1e1e]/80 border-t border-white/10">
              <button
                type="button"
                onClick={() => setMoveConfirmDialog(null)}
                className="px-4 py-1.5 text-[13px] font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirmMove}
                className="px-4 py-1.5 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-md transition-all shadow-md shadow-indigo-600/30"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
