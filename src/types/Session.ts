export interface SessionMetadata {
  sessionName: string;
  duration: number;
  format: 'wav' | 'mp3';
  quality: number;
  fileSize: number;
}

export interface Session {
  id: string;
  createdAt: Date;
  metadata: SessionMetadata;
  filePath: string;
}

export interface ExportOptions {
  format?: 'wav' | 'mp3';
  quality?: number;
} 