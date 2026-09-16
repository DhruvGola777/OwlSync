import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import { Code2, Plus, Loader2, Search, FolderUp, HardDrive } from 'lucide-react';
import { ImportProjectModal } from '../components/ImportProjectModal';

export const ProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.isDesktop);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleOpenLocalFolder = async () => {
    if (!window.electronAPI?.openLocalFolder) return;
    try {
      const result = await window.electronAPI.openLocalFolder();
      if (!result) return;
      
      setIsSubmitting(true);
      const newProject = await api.createProject({
        name: result.folderName,
        description: `Local project from ${result.folderPath}`
      });

      for (const item of result.files) {
        if (item.type === 'file') {
          const content = await window.electronAPI.readLocalFile(item.fullPath);
          await api.createFile(newProject.id, {
            name: item.name,
            path: item.path,
            content: content || ''
          });
        }
      }

      setProjects([newProject, ...projects]);
      navigate(`/project/${newProject.id}`);
    } catch (err) {
      console.error('Failed to open local folder:', err);
      alert('Failed to import local folder: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await api.getProjects();
      setProjects(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    setIsSubmitting(true);
    setError('');
    try {
      const project = await api.createProject({
        name: newProjectName,
        description: ''
      });

      setProjects([project, ...projects]);
      setShowCreateModal(false);
      setNewProjectName('');
      navigate(`/project/${project.id}`);
    } catch (err) {
      console.error("CREATE PROJECT ERROR:", err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Your Projects</h1>
          <p className="text-slate-600 mt-1">Manage your solo projects & imported repositories</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
            />
          </div>
          {isDesktop && (
            <button
              onClick={handleOpenLocalFolder}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg transition font-medium shadow-sm"
              title="Select and open an existing folder from your PC"
            >
              <HardDrive size={18} className="text-indigo-600" />
              Open Local Folder
            </button>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition font-medium shadow-sm"
          >
            <FolderUp size={18} className="text-slate-500" />
            Import Project
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-sm shadow-indigo-200"
          >
            <Plus size={18} />
            New Project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm mb-8">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Code2 size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No projects yet</h2>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            Create a blank project or import your local codebase from your PC.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition shadow-sm flex items-center gap-2"
            >
              <FolderUp size={18} className="text-slate-500" />
              Import Local Code
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition shadow-md shadow-indigo-200 flex items-center gap-2"
            >
              <Plus size={18} />
              New Blank Project
            </button>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm mb-8">
          <p className="text-slate-500">No projects found matching "{searchQuery}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredProjects.map(project => (
            <div 
              key={project.id}
              onClick={() => navigate(`/project/${project.id}`)}
              className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-indigo-300 transition cursor-pointer group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Code2 size={20} />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1 line-clamp-1">{project.name}</h3>
              <p className="text-slate-500 text-sm mb-4 line-clamp-2 min-h-10 flex-1">
                {project.description || 'No description provided.'}
              </p>
              
              <div className="flex items-center justify-between text-sm pt-4 border-t border-slate-100 w-full mt-auto">
                <span className="text-slate-500">ID: <span className="font-mono text-slate-700">{project.id.split('-')[0]}</span></span>
                <span className="font-medium text-indigo-600 group-hover:underline">Open Project &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Create Project</h2>
            <p className="text-slate-500 mb-6 text-sm">Start a new persistent collaborative codebase.</p>
            
            {error && <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
                <input
                  autoFocus
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition"
                  placeholder="e.g. Portfolio Website"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setError(''); }}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newProjectName.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Project Modal (ZIP & Folder) */}
      <ImportProjectModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onProjectCreated={(newProj) => setProjects([newProj, ...projects])}
      />
    </div>
  );
};
