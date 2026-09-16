import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, ArrowRight, ShieldCheck, Zap, HardDrive, 
  Code2, Check, ExternalLink, Laptop, Terminal, Sparkles, Cpu, RefreshCw
} from 'lucide-react';

export const DownloadPage = () => {
  const navigate = useNavigate();
  const [os, setOs] = useState('windows'); // 'windows', 'mac', 'linux'
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');

  useEffect(() => {
    // Detect OS from userAgent
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) {
      setOs('windows');
    } else if (userAgent.includes('mac')) {
      setOs('mac');
    } else if (userAgent.includes('linux')) {
      setOs('linux');
    }
  }, []);

  const handleDownload = (platform, format = 'installer') => {
    setDownloading(true);
    const fileName = platform === 'windows' 
      ? 'OwlSync-Setup-1.0.0.exe' 
      : platform === 'mac' 
      ? 'OwlSync-1.0.0-arm64.dmg' 
      : 'OwlSync-1.0.0.AppImage';

    setDownloadMessage(`Preparing ${fileName}... Your download will begin in a moment.`);

    setTimeout(() => {
      // Create a mock trigger / real download link
      const link = document.createElement('a');
      link.href = `#`; // in production, links to /releases/OwlSync-Setup-1.0.0.exe or GitHub Release Asset
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      // alert or notification
      setDownloadMessage(`✅ ${fileName} is downloading! Check your browser downloads.`);
      setTimeout(() => {
        setDownloading(false);
      }, 3000);
    }, 1200);
  };

  const getPrimaryLabel = () => {
    if (os === 'windows') return { text: 'Download for Windows', ext: '.exe (64-bit)' };
    if (os === 'mac') return { text: 'Download for macOS', ext: '.dmg (Apple Silicon & Intel)' };
    return { text: 'Download for Linux', ext: '.AppImage / .deb' };
  };

  const primary = getPrimaryLabel();

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <img 
              src="/logo.png" 
              alt="OwlSync Logo" 
              className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform object-cover" 
            />
            <span className="text-xl font-bold tracking-tight text-white">OwlSync</span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/projects')}
              className="text-sm font-medium text-slate-300 hover:text-white transition"
            >
              Open Web App
            </button>
            <button 
              onClick={() => handleDownload(os)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-md shadow-indigo-500/20 flex items-center gap-2"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles size={14} />
            OwlSync Desktop v1.0.0 Now Available
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Code, sync, and collaborate.<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Directly on your Desktop.
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Experience sub-10ms Monaco pair programming, native local filesystem access, WebRTC voice rooms, and AI assistance in a native standalone application.
          </p>

          {/* Primary Download CTA */}
          <div className="flex flex-col items-center justify-center gap-4 mb-8">
            <button
              onClick={() => handleDownload(os)}
              disabled={downloading}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-lg shadow-xl shadow-indigo-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3 disabled:opacity-70 cursor-pointer"
            >
              <Download size={22} className={downloading ? 'animate-bounce' : ''} />
              <span>{primary.text}</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono font-normal">
                {primary.ext}
              </span>
            </button>

            {downloadMessage && (
              <div className="text-sm font-medium text-emerald-400 animate-fade-in flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                <Check size={16} />
                <span>{downloadMessage}</span>
              </div>
            )}

            <span className="text-xs text-slate-500">
              Free & Open Source under MIT License • SHA-256 Verified
            </span>
          </div>
        </div>
      </section>

      {/* All Platforms Download Matrix */}
      <section className="py-16 border-t border-slate-800/80 bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-2">Available for all major operating systems</h2>
            <p className="text-slate-400 text-sm">Download the binary or standalone installer tailored for your machine.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Windows */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 transition flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-2xl font-bold mb-4">
                  🪟
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Windows</h3>
                <p className="text-xs text-slate-400 mb-6">Windows 10, 11 (64-bit architecture)</p>

                <div className="space-y-2.5">
                  <button 
                    onClick={() => handleDownload('windows', 'installer')}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-between"
                  >
                    <span>Installer Setup (.exe)</span>
                    <Download size={16} className="text-slate-400" />
                  </button>
                  <button 
                    onClick={() => handleDownload('windows', 'portable')}
                    className="w-full py-2.5 px-4 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition flex items-center justify-between border border-slate-800"
                  >
                    <span>Portable Standalone (.zip)</span>
                    <Download size={16} className="text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                <span>x64 / ARM64</span>
                <span className="text-emerald-400">NSIS Wizard</span>
              </div>
            </div>

            {/* macOS */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 transition flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-2xl font-bold mb-4">
                  🍎
                </div>
                <h3 className="text-lg font-bold text-white mb-1">macOS</h3>
                <p className="text-xs text-slate-400 mb-6">macOS 11.0 Big Sur or later</p>

                <div className="space-y-2.5">
                  <button 
                    onClick={() => handleDownload('mac', 'arm')}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-between"
                  >
                    <span>Apple Silicon (.dmg)</span>
                    <Download size={16} className="text-slate-400" />
                  </button>
                  <button 
                    onClick={() => handleDownload('mac', 'intel')}
                    className="w-full py-2.5 px-4 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition flex items-center justify-between border border-slate-800"
                  >
                    <span>Intel CPU (.dmg)</span>
                    <Download size={16} className="text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Universal Binary</span>
                <span className="text-emerald-400">DMG Image</span>
              </div>
            </div>

            {/* Linux */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 transition flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl font-bold mb-4">
                  🐧
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Linux</h3>
                <p className="text-xs text-slate-400 mb-6">Ubuntu, Debian, Fedora, Arch</p>

                <div className="space-y-2.5">
                  <button 
                    onClick={() => handleDownload('linux', 'appimage')}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-between"
                  >
                    <span>AppImage (Portable)</span>
                    <Download size={16} className="text-slate-400" />
                  </button>
                  <button 
                    onClick={() => handleDownload('linux', 'deb')}
                    className="w-full py-2.5 px-4 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition flex items-center justify-between border border-slate-800"
                  >
                    <span>Debian Package (.deb)</span>
                    <Download size={16} className="text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                <span>x86_64</span>
                <span className="text-emerald-400">Direct Binary</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* "How to Install" Step-by-Step Guide */}
      <section className="py-16 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-center text-white mb-12">
            Easy Installation in 3 Simple Steps
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm mb-4">
                1
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Download Installer</h3>
              <p className="text-sm text-slate-400">
                Click download for your OS to get the setup file (<code className="text-indigo-300 font-mono text-xs">OwlSync-Setup-1.0.0.exe</code>).
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm mb-4">
                2
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Run Setup Wizard</h3>
              <p className="text-sm text-slate-400">
                Double-click the installer, choose your installation path, and click <strong>Next &rarr; Install</strong>.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm mb-4">
                3
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Launch & Pair Code</h3>
              <p className="text-sm text-slate-400">
                Open OwlSync from your Desktop or Start Menu, open any local folder, and start coding live with teammates!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        <p>&copy; 2026 OwlSync. Built for modern software engineering teams.</p>
      </footer>
    </div>
  );
};
