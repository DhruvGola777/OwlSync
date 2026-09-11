import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderUp, FileArchive, Upload, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../../services/api';

export const ImportProjectModal = ({ isOpen, onClose, onProjectCreated }) => {
  const navigate = useNavigate();
  const [importMode, setImportMode] = useState('zip'); // 'zip' or 'folder'
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [zipFile, setZipFile] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const zipInputRef = useRef(null);
  const folderInputRef = useRef(null);

  if (!isOpen) return null;

  const handleZipChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setError('Please select a valid .zip archive file.');
        return;
      }
      setZipFile(file);
      setError('');
      if (!projectName) {
        setProjectName(file.name.replace(/\.zip$/i, ''));
      }
    }
  };

  const handleFolderChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError('');
    const readableFiles = [];

    // Derive root folder name
    const samplePath = files[0].webkitRelativePath || files[0].name;
    const rootName = samplePath.split('/')[0] || 'My Imported Project';
    if (!projectName) {
      setProjectName(rootName);
    }

    const ignoredRegex = /(^|\/)(\.git|\.next|node_modules|dist|build|\.DS_Store|__pycache__|\.idea|\.vscode)(\/|$)/i;
    const binaryRegex = /\.(png|jpe?g|gif|webp|ico|svg|mp4|mov|webm|mp3|wav|zip|tar|gz|exe|dll|dylib|so|bin)$/i;

    for (const f of files) {
      const relPath = f.webkitRelativePath ? '/' + f.webkitRelativePath.split('/').slice(1).join('/') : '/' + f.name;
      
      if (ignoredRegex.test(f.webkitRelativePath || f.name)) continue;
      if (binaryRegex.test(f.name)) continue;

      try {
        const text = await f.text();
        readableFiles.push({
          name: f.name,
          path: relPath,
          content: text
        });
      } catch (err) {
        // Skip unreadable files
      }
    }

    setFolderFiles(readableFiles);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!projectName.trim()) {
      setError('Please enter a project name.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (importMode === 'zip') {
        if (!zipFile) {
          setError('Please select a .zip file to upload.');
          setIsSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', zipFile);
        formData.append('name', projectName.trim());
        if (description) formData.append('description', description.trim());

        const res = await api.importProjectZip(formData);
        onProjectCreated?.(res.project);
        onClose();
        navigate(`/project/${res.project.id}`);
      } else {
        if (folderFiles.length === 0) {
          setError('Please select a folder containing code files.');
          setIsSubmitting(false);
          return;
        }

        const res = await api.importProjectFolder({
          name: projectName.trim(),
          description: description.trim() || 'Imported local folder',
          files: folderFiles
        });

        onProjectCreated?.(res.project);
        onClose();
        navigate(`/project/${res.project.id}`);
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Import Local Project</h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload a local folder or .zip file into OwlSync</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => { setImportMode('zip'); setError(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-t border-x ${
              importMode === 'zip'
                ? 'bg-white text-indigo-600 border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <FileArchive size={16} />
            Upload ZIP Archive
          </button>
          <button
            type="button"
            onClick={() => { setImportMode('folder'); setError(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-t border-x ${
              importMode === 'folder'
                ? 'bg-white text-indigo-600 border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <FolderUp size={16} />
            Select Local Folder
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. My Next.js Web App"
              required
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Frontend client code with components"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Mode 1: ZIP Upload */}
          {importMode === 'zip' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                ZIP File (.zip) *
              </label>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleZipChange}
                className="hidden"
              />
              <div
                onClick={() => zipInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                  zipFile
                    ? 'border-indigo-400 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                }`}
              >
                {zipFile ? (
                  <div className="flex flex-col items-center gap-1.5 text-indigo-700">
                    <CheckCircle2 size={28} className="text-indigo-600" />
                    <span className="font-semibold text-sm">{zipFile.name}</span>
                    <span className="text-xs text-slate-500">{(zipFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-500">
                    <Upload size={28} className="text-slate-400" />
                    <span className="font-medium text-sm text-slate-700">Click to select .zip archive</span>
                    <span className="text-xs text-slate-400">Max size: 50MB</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mode 2: Directory Picker */}
          {importMode === 'folder' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Choose Folder *
              </label>
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory="true"
                directory="true"
                multiple
                onChange={handleFolderChange}
                className="hidden"
              />
              <div
                onClick={() => folderInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                  folderFiles.length > 0
                    ? 'border-indigo-400 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                }`}
              >
                {folderFiles.length > 0 ? (
                  <div className="flex flex-col items-center gap-1.5 text-indigo-700">
                    <CheckCircle2 size={28} className="text-indigo-600" />
                    <span className="font-semibold text-sm">{folderFiles.length} text code files selected</span>
                    <span className="text-xs text-slate-500">Filtered out node_modules, .git, and binaries</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-500">
                    <FolderUp size={28} className="text-slate-400" />
                    <span className="font-medium text-sm text-slate-700">Click to select local directory</span>
                    <span className="text-xs text-slate-400">All code files in the directory will be parsed</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (importMode === 'zip' ? !zipFile : folderFiles.length === 0)}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium transition text-sm flex items-center justify-center gap-2 shadow-sm shadow-indigo-200"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importing...
                </>
              ) : (
                'Import & Open'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default ImportProjectModal;
