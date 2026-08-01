import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  VscChevronRight, VscChevronDown, VscNewFile, VscNewFolder, VscTrash,
  VscFile, VscFolder, VscFolderOpened, VscJson
} from 'react-icons/vsc';
import { DiJavascript1, DiReact, DiCss3, DiHtml5 } from 'react-icons/di';

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

export const getFileIcon = (filename) => {
  if (filename.endsWith('.js')) return <DiJavascript1 className="w-[18px] h-[18px] text-[#f1e05a] mr-2 shrink-0" />;
  if (filename.endsWith('.jsx')) return <DiReact className="w-[18px] h-[18px] text-[#61dafb] mr-2 shrink-0" />;
  if (filename.endsWith('.css')) return <DiCss3 className="w-[18px] h-[18px] text-[#563d7c] mr-2 shrink-0" />;
  if (filename.endsWith('.html')) return <DiHtml5 className="w-[18px] h-[18px] text-[#e34c26] mr-2 shrink-0" />;
  if (filename.endsWith('.json')) return <VscJson className="w-[18px] h-[18px] text-[#cb3837] mr-2 shrink-0" />;
  return <VscFile className="w-[18px] h-[18px] text-[#cccccc] mr-2 shrink-0" />;
};

const FileNode = ({
  node,
  level = 0,
  activeFileId,
  onFileSelect,
  onDeleteFile,
  creatingState,
  setCreatingState,
  handleCreateSubmit,
  setContextMenu
}) => {
  const [isOpen, setIsOpen] = useState(level === 0 || level === 1); // open root and level 1 by default
  const inputRef = useRef(null);

  const isFolder = node.type === 'folder';
  const isActive = node.file?.id === activeFileId;
  const isCreatingHere = creatingState?.parentPath === node.path;

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
        className={`flex items-center group py-1 px-2 cursor-pointer transition-colors
          ${isActive ? 'bg-indigo-500/30 text-white' : 'text-gray-200 hover:text-white hover:bg-white/10'}
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
          <span className="truncate">{node.name}</span>
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
              />
            ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer = ({ projectName, files, activeFileId, onFileSelect, onCreateFile, onRenameFile, onDeleteFile }) => {
  const fileTree = useMemo(() => buildFileTree(files || []), [files]);

  // { parentPath: string, type: 'file' | 'folder' } | null
  const [creatingState, setCreatingState] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

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

  return (
    <div className="flex flex-col h-full w-full relative group/sidebar">
      <div className="flex items-center justify-between px-4 py-2 h-[44px] shrink-0">
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
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 py-2">
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
          />
        ) : (
          <div className="text-[13px] text-gray-500 text-center mt-10 px-4">
            You have not yet created any files.
          </div>
        )}
      </div>

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
    </div>
  );
};
