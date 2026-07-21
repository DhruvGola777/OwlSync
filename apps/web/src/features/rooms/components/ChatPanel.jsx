import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';
import { Send, Smile, X } from 'lucide-react';
import { api } from '../../../services/api';
import { socketService } from '../../../services/socket';
import { useAuth } from '../../../providers/AuthProvider';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';

export const ChatPanel = ({ roomId, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const pastMessages = await api.getRoomMessages(roomId);
        setMessages(pastMessages);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };
    fetchMessages();

    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNewMessage = ({ message }) => {
      setMessages(prev => [...prev, message]);
    };

    const handleTypingStart = ({ userId }) => {
      if (userId === user?.id) return;
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.add(userId);
        return newSet;
      });
    };

    const handleTypingStop = ({ userId }) => {
      if (userId === user?.id) return;
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    socket.on('chat:new_message', handleNewMessage);
    socket.on('chat:typing_start', handleTypingStart);
    socket.on('chat:typing_stop', handleTypingStop);

    return () => {
      socket.off('chat:new_message', handleNewMessage);
      socket.off('chat:typing_start', handleTypingStart);
      socket.off('chat:typing_stop', handleTypingStop);
    };
  }, [roomId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('chat:typing_start', { roomId });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('chat:typing_stop', { roomId });
      }, 2000);
    }
  };

  const sendMessage = () => {
    if (!inputValue.trim()) return;
    
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('chat:send_message', { roomId, content: inputValue.trim() });
      socket.emit('chat:typing_stop', { roomId });
    }
    
    setInputValue('');
    setShowEmojiPicker(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onEmojiClick = (emojiObject) => {
    setInputValue(prev => prev + emojiObject.emoji);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 relative">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gray-900/50">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Room Chat</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-10">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user.id === user?.id;
            return (
              <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {!isMe && (
                    <AvatarDisplay avatarUrl={msg.user.avatarUrl} name={msg.user.name || msg.user.username} size={20} />
                  )}
                  <span className="text-xs font-medium text-gray-400">
                    {isMe ? 'You' : (msg.user.name || msg.user.username)}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`px-3 py-2 rounded-xl max-w-[90%] text-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/10 text-gray-200 rounded-tl-none'}`}>
                  <div className="prose prose-invert max-w-none prose-p:leading-snug prose-p:m-0 prose-pre:bg-gray-950 prose-pre:p-2 prose-pre:rounded-md prose-pre:text-xs prose-pre:m-0 prose-code:text-xs prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      <div className="h-6 px-4 flex items-center shrink-0">
        {typingUsers.size > 0 && (
          <span className="text-xs text-indigo-400 animate-pulse italic">
            {typingUsers.size === 1 ? 'Someone is typing...' : 'Several people are typing...'}
          </span>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-white/10 bg-gray-900 relative">
        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-2 z-50 shadow-xl" ref={emojiPickerRef}>
            <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
          </div>
        )}
        <div className="flex items-end gap-2 bg-gray-950 rounded-xl border border-white/10 p-2 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
          <button 
            className="p-2 text-gray-400 hover:text-indigo-400 transition-colors"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="w-5 h-5" />
          </button>
          
          <textarea
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message room..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-200 resize-none max-h-32 min-h-[24px] py-2 outline-none placeholder-gray-600 scrollbar-thin scrollbar-thumb-gray-800"
            rows={1}
          />
          
          <button 
            onClick={sendMessage}
            disabled={!inputValue.trim()}
            className="p-2 text-indigo-500 hover:text-indigo-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
