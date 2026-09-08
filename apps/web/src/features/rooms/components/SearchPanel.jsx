import React, { useState, useMemo } from 'react';
import { VscSearch, VscFile } from 'react-icons/vsc';

export const SearchPanel = ({ files, onFileSelect }) => {
  const [query, setQuery] = useState('');

  // Search logic: matches filename or content
  const results = useMemo(() => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    const matches = [];

    files.forEach(file => {
      // Don't search inside `.keep` dummy files or directories if we had them explicitly
      if (file.name === '.keep') return;

      const isNameMatch = file.name.toLowerCase().includes(lowerQuery);
      
      let contentMatchLine = -1;
      let contentSnippet = '';

      if (file.content) {
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            contentMatchLine = i + 1;
            contentSnippet = lines[i].trim();
            break; // Just grab the first matching line for preview
          }
        }
      }

      if (isNameMatch || contentMatchLine !== -1) {
        matches.push({
          file,
          isNameMatch,
          contentMatchLine,
          contentSnippet
        });
      }
    });

    return matches;
  }, [query, files]);

  return (
    <div className="flex flex-col h-full bg-[#252526] text-gray-300 w-full relative">
      <div className="px-4 py-2 text-[13px] font-bold text-gray-400 tracking-wider uppercase h-[44px] flex items-center border-b border-white/10 shrink-0">
        Search
      </div>

      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center bg-[#1e1e1e] border border-white/10 rounded px-2 focus-within:border-indigo-500 transition-colors">
          <VscSearch className="w-4 h-4 text-gray-500 mr-2 shrink-0" />
          <input 
            type="text" 
            placeholder="Search files..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-gray-300 py-1.5 outline-none placeholder-gray-500"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {!query.trim() ? (
          <div className="text-center text-sm text-gray-500 mt-4 px-4">
            Type to search across all files in this project.
          </div>
        ) : results.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-4 px-4">
            No results found for "{query}".
          </div>
        ) : (
          <div className="space-y-1">
            {results.map((result, idx) => (
              <div 
                key={result.file.id || idx}
                className="group flex flex-col px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                onClick={() => onFileSelect(result.file)}
              >
                <div className="flex items-center text-[13px] text-gray-200">
                  <VscFile className="w-4 h-4 text-blue-400 mr-2 shrink-0" />
                  <span className="truncate">{result.file.path}</span>
                </div>
                
                {result.contentMatchLine !== -1 && (
                  <div className="pl-6 pr-2 mt-1 flex items-start text-[12px] text-gray-500 group-hover:text-gray-400 transition-colors">
                    <span className="w-6 shrink-0 text-right mr-2 text-indigo-400/70 select-none">
                      {result.contentMatchLine}
                    </span>
                    <span className="truncate font-mono">
                      {result.contentSnippet}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
