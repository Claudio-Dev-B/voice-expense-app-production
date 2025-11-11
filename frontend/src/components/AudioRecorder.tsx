import React, { useState, useRef } from "react";

type Props = {
  onRecordingComplete: (audioBlob: Blob) => void;
};

const AudioRecorder: React.FC<Props> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Erro ao acessar o microfone:", error);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card p-6 text-center mb-6">
      <div className="w-20 h-20 mx-auto mb-4 relative">
        <div className={`absolute inset-0 rounded-full ${
          isRecording 
            ? 'bg-red-100 animate-pulse' 
            : 'bg-blue-100'
        }`}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">
            {isRecording ? '🎙️' : '🎤'}
          </span>
        </div>
      </div>

      {isRecording && (
        <div className="mb-4">
          <div className="flex items-center justify-center space-x-2 text-red-600">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            <span className="font-semibold">Gravando</span>
            <span className="font-mono">{formatTime(recordingTime)}</span>
          </div>
        </div>
      )}

      <button
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        className={`w-full ${
          isRecording 
            ? 'btn-secondary' 
            : 'btn-primary'
        }`}
      >
        {isRecording ? (
          <span className="flex items-center justify-center space-x-2">
            <span>⏹️</span>
            <span>Parar Gravação</span>
          </span>
        ) : (
          <span className="flex items-center justify-center space-x-2">
            <span>🎧</span>
            <span>Iniciar Gravação</span>
          </span>
        )}
      </button>

      {!isRecording && (
        <p className="text-sm text-gray-500 mt-3">
          Toque para começar a gravar sua despesa
        </p>
      )}
    </div>
  );
};

export default AudioRecorder;
