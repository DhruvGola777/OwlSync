import React from 'react';
import { VscClose } from 'react-icons/vsc';
import { getFileIcon } from '../utils/fileIcons';

export const EditorTabs = ({ openFiles, activeFileId, onTabSelect, onTabClose }) => {
  return (
    <div className="flex items-center bg-[#252526] h-[44px] overflow-x-auto scrollbar-none shadow-sm z-10 w-full shrink-0 border-b border-white/10">
      {openFiles.map((file) => {
        const isActive = file.id === activeFileId;
        return (
          <div
            key={file.id}
            onClick={() => onTabSelect(file)}
            className={`
              group flex items-center h-full px-4 border-r border-white/10 cursor-pointer shrink-0 max-w-[240px] select-none text-[15px] transition-colors
              ${isActive ? 'bg-[#1e1e1e] text-indigo-300 border-t border-t-indigo-500' : 'bg-[#252526] text-gray-400 hover:bg-white/5 hover:text-gray-200 border-t border-t-transparent'}
            `}
            style={{ borderTopWidth: isActive ? '2px' : '2px' }}
          >
            <div className="flex items-center shrink-0">
              {getFileIcon(file.name)}
            </div>
            <span className="truncate mr-3">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file.id);
              }}
              className={`p-0.5 rounded-md hover:bg-white/10 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <VscClose className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
