import { useState, useRef, useCallback, useEffect } from 'react';

export const useSessionRecorder = (localAudioStream = null) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Format recording seconds to MM:SS or HH:MM:SS
  const formatDuration = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const startRecording = useCallback(async () => {
    try {
      // 1. Capture screen stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'browser',
          frameRate: { ideal: 30, max: 60 }
        },
        audio: true
      });
      screenStreamRef.current = screenStream;

      // 2. Mix audio if microphone is available
      const tracks = [...screenStream.getVideoTracks()];

      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        tracks.push(...screenAudioTracks);
      }
      if (localAudioStream) {
        const micAudioTracks = localAudioStream.getAudioTracks();
        if (micAudioTracks.length > 0) {
          tracks.push(...micAudioTracks);
        }
      }

      const combinedStream = new MediaStream(tracks);

      // 3. Determine best supported mimeType
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264',
        'video/webm',
        'video/mp4'
      ];
      const selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMimeType
      });
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedBlobUrl(url);
        setShowPreviewModal(true);
        setIsRecording(false);

        // Stop all tracks in screen stream
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
        }

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      // If user clicks "Stop sharing" on the browser native floating bar
      screenStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };

      mediaRecorder.start(1000); // 1-second chunks
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start session recording:', err);
      if (err.name !== 'NotAllowedError') {
        alert('Could not start screen recording: ' + err.message);
      }
    }
  }, [localAudioStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const downloadRecording = useCallback((filename = null) => {
    if (!recordedBlobUrl) return;
    const a = document.createElement('a');
    a.href = recordedBlobUrl;
    a.download = filename || `OwlSync_Session_${new Date().toISOString().slice(0, 10)}_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [recordedBlobUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return {
    isRecording,
    recordingSeconds,
    formattedDuration: formatDuration(recordingSeconds),
    recordedBlobUrl,
    recordedBlob,
    showPreviewModal,
    setShowPreviewModal,
    startRecording,
    stopRecording,
    downloadRecording
  };
};
