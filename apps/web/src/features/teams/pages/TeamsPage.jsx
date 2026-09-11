import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useAuth } from '../../../providers/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Shield, UserPlus, Trash2, FolderOpen, 
  Crown, ShieldCheck, User, Code2, Loader2, AlertCircle, ArrowRight 
} from 'lucide-react';

export const TeamsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [newProjectName, setNewProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const res = await api.getTeams();
      setTeams(res || []);
      if (res && res.length > 0) {
        // Load details for first team
        const fullTeam = await api.getTeam(res[0].id);
        setActiveTeam(fullTeam);
      } else {
        setActiveTeam(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeam = async (teamId) => {
    try {
      const fullTeam = await api.getTeam(teamId);
      setActiveTeam(fullTeam);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setIsSubmitting(true);
    setModalError('');
    try {
      const created = await api.createTeam({
        name: newTeamName.trim(),
        description: newTeamDesc.trim()
      });
      const fullTeam = await api.getTeam(created.id);
      setTeams([created, ...teams]);
      setActiveTeam(fullTeam);
      setShowCreateTeamModal(false);
      setNewTeamName('');
      setNewTeamDesc('');
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberIdentifier.trim() || !activeTeam) return;
    setIsSubmitting(true);
    setModalError('');
    try {
      const added = await api.addTeamMember(activeTeam.id, {
        username: memberIdentifier.trim(),
        role: memberRole
      });
      setActiveTeam({
        ...activeTeam,
        members: [...activeTeam.members, added]
      });
      setShowAddMemberModal(false);
      setMemberIdentifier('');
      setMemberRole('MEMBER');
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.removeTeamMember(activeTeam.id, memberUserId);
      setActiveTeam({
        ...activeTeam,
        members: activeTeam.members.filter(m => m.userId !== memberUserId)
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTeam = async () => {
    if (!window.confirm(`Are you sure you want to delete the team "${activeTeam.name}"? This action cannot be undone.`)) return;
    try {
      await api.deleteTeam(activeTeam.id);
      const remaining = teams.filter(t => t.id !== activeTeam.id);
      setTeams(remaining);
      if (remaining.length > 0) {
        const full = await api.getTeam(remaining[0].id);
        setActiveTeam(full);
      } else {
        setActiveTeam(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateTeamProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !activeTeam) return;
    setIsSubmitting(true);
    setModalError('');
    try {
      const project = await api.createProject({
        name: newProjectName.trim(),
        description: `Team workspace project for ${activeTeam.name}`,
        teamId: activeTeam.id
      });
      setActiveTeam({
        ...activeTeam,
        projects: [project, ...(activeTeam.projects || [])]
      });
      setShowCreateProjectModal(false);
      setNewProjectName('');
      navigate(`/project/${project.id}`);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentUserMembership = activeTeam?.members?.find(m => m.userId === user?.id);
  const isOwnerOrAdmin = activeTeam?.ownerId === user?.id || currentUserMembership?.role === 'ADMIN' || currentUserMembership?.role === 'OWNER';

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Teams & Organizations</h1>
          <p className="text-slate-600 mt-1">Collaborate seamlessly with team members across shared workspaces and projects.</p>
        </div>
        <button
          onClick={() => { setModalError(''); setShowCreateTeamModal(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-sm shadow-indigo-200"
        >
          <Plus size={18} />
          Create Team
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No teams yet</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto text-sm">
            Create an organization to invite teammates, share real-time code projects, and build software collaboratively.
          </p>
          <button
            onClick={() => { setModalError(''); setShowCreateTeamModal(true); }}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition shadow-md shadow-indigo-200 inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Create Your First Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Teams Selector Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Your Organizations</h3>
            <div className="space-y-1">
              {teams.map((t) => {
                const isActive = activeTeam?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTeam(t.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center justify-between group ${
                      isActive 
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-semibold shadow-sm' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      }`}>
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{t.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {t.membersCount || t.members?.length || 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Team Workspace View */}
          {activeTeam && (
            <div className="lg:col-span-3 space-y-6">
              {/* Team Banner Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl font-bold shadow-md">
                    {activeTeam.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-slate-900">{activeTeam.name}</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {activeTeam.ownerId === user?.id ? 'Owner' : (currentUserMembership?.role || 'Member')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {activeTeam.description || 'No organization description provided.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => { setModalError(''); setShowAddMemberModal(true); }}
                      className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition"
                    >
                      <UserPlus size={16} />
                      Add Member
                    </button>
                  )}
                  {activeTeam.ownerId === user?.id && (
                    <button
                      onClick={handleDeleteTeam}
                      title="Delete Team"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Members Roster */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Users size={18} className="text-indigo-600" />
                    Team Members ({activeTeam.members?.length || 0})
                  </h3>
                </div>

                <div className="divide-y divide-slate-100">
                  {activeTeam.members?.map((m) => {
                    const isSelf = m.userId === user?.id;
                    const isOwner = m.role === 'OWNER' || m.userId === activeTeam.ownerId;
                    const isAdmin = m.role === 'ADMIN';

                    return (
                      <div key={m.id} className="py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {m.user?.avatarUrl ? (
                            <img src={m.user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                              {(m.user?.name || m.user?.username || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 text-sm">{m.user?.name || m.user?.username}</span>
                              {isSelf && <span className="text-xs text-slate-400">(You)</span>}
                            </div>
                            <span className="text-xs text-slate-500 font-mono">@{m.user?.username || 'user'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isOwner 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : isAdmin 
                              ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isOwner ? <Crown size={12} /> : isAdmin ? <ShieldCheck size={12} /> : <User size={12} />}
                            {m.role}
                          </span>

                          {isOwnerOrAdmin && !isOwner && !isSelf && (
                            <button
                              onClick={() => handleRemoveMember(m.userId)}
                              className="text-slate-400 hover:text-red-600 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team Projects */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <FolderOpen size={18} className="text-indigo-600" />
                      Team Shared Projects
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Projects shared across all members of {activeTeam.name}.</p>
                  </div>
                  <button
                    onClick={() => { setModalError(''); setShowCreateProjectModal(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-medium transition shadow-sm"
                  >
                    <Plus size={14} />
                    New Team Project
                  </button>
                </div>

                {(!activeTeam.projects || activeTeam.projects.length === 0) ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100">
                    <Code2 size={24} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">No team projects yet</p>
                    <p className="text-xs text-slate-400 mt-1">Create a shared project to code live together.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeTeam.projects.map((proj) => (
                      <div
                        key={proj.id}
                        onClick={() => navigate(`/project/${proj.id}`)}
                        className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition cursor-pointer flex flex-col justify-between group bg-white"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-800 text-sm group-hover:text-indigo-600 transition">{proj.name}</span>
                            <Code2 size={16} className="text-slate-400 group-hover:text-indigo-600" />
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{proj.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 pt-3 mt-3 border-t border-slate-100">
                          <span>{proj.files?.length || 0} files</span>
                          <span className="font-medium text-indigo-600 group-hover:underline flex items-center gap-1">Open <ArrowRight size={12} /></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Create Team Organization</h2>
            <p className="text-slate-500 text-sm mb-6">Build a workspace for your team or company.</p>

            {modalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Team Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OwlSync Core Team"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  rows={2}
                  placeholder="What is this team working on?"
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTeamName.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm transition flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Add Member to {activeTeam?.name}</h2>
            <p className="text-slate-500 text-sm mb-6">Invite a user to collaborate in this team workspace.</p>

            {modalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Username or Email *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. johndoe or john@example.com"
                  value={memberIdentifier}
                  onChange={(e) => setMemberIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none bg-white"
                >
                  <option value="MEMBER">Member (Can view & edit shared projects)</option>
                  <option value="ADMIN">Admin (Can manage members & projects)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !memberIdentifier.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm transition flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Team Project Modal */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-1">New Team Project</h2>
            <p className="text-slate-500 text-sm mb-6">Create a shared project inside {activeTeam?.name}.</p>

            {modalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTeamProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Microservices API"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateProjectModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newProjectName.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm transition flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
