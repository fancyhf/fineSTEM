import { useState, useRef, useCallback } from 'react';

interface UseCanvasRecorderReturn {
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  downloadUrl: string | null;
}

export const useCanvasRecorder = (
  canvasSource: React.RefObject<HTMLCanvasElement> | (() => HTMLCanvasElement | null)
): UseCanvasRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const getCanvas = useCallback(() => {
    if (typeof canvasSource === 'function') {
      return canvasSource();
    }
    return canvasSource.current;
  }, [canvasSource]);

  const startRecording = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    let stream: MediaStream;
    try {
      stream = canvas.captureStream(60); // 60 FPS
    } catch (e) {
      console.error('Failed to capture stream', e);
      return;
    }
    
    // Detect supported mimeType
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    
    let selectedMimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }
    
    if (!selectedMimeType) {
      console.error('No supported mimeType found for MediaRecorder');
      return;
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMimeType
    });

    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      if (chunksRef.current.length === 0) {
        console.warn('No recorded chunks available');
        return;
      }
      const blob = new Blob(chunksRef.current, { type: selectedMimeType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      
      // Auto-download helper
      const a = document.createElement('a');
      a.href = url;
      // Determine extension based on mimeType
      const ext = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
      a.download = `recording-${Date.now()}.${ext}`;
      a.click();
    };

    // Start with 1000ms timeslice to ensure data availability events fire
    mediaRecorder.start(1000);
    setIsRecording(true);
  }, [getCanvas]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  return { isRecording, startRecording, stopRecording, downloadUrl };
};
