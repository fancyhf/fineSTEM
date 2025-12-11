import { useState, useRef, useCallback } from 'react';

interface UseCanvasRecorderReturn {
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  downloadUrl: string | null;
}

export const useCanvasRecorder = (
  canvasRef: React.RefObject<HTMLCanvasElement>
): UseCanvasRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(() => {
    if (!canvasRef.current) return;

    const stream = canvasRef.current.captureStream(60); // 60 FPS
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      
      // Auto-download helper
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${Date.now()}.webm`;
      a.click();
    };

    mediaRecorder.start();
    setIsRecording(true);
  }, [canvasRef]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  return { isRecording, startRecording, stopRecording, downloadUrl };
};
