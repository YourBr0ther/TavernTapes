import { RecordingMetadata } from './AudioService';

export interface Session {
  id: string;
  metadata: RecordingMetadata;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportOptions {
  format?: 'wav' | 'mp3';
  quality?: number;
  includeMetadata?: boolean;
}

class SessionService {
  private readonly STORAGE_KEY = 'tavernTapes_sessions';
  private readonly RECORDINGS_STORAGE_KEY = 'tavernTapes_recordings';

  constructor() {
    // Initialize storage if it doesn't exist
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.RECORDINGS_STORAGE_KEY)) {
      localStorage.setItem(this.RECORDINGS_STORAGE_KEY, JSON.stringify({}));
    }
  }

  async getAllSessions(): Promise<Session[]> {
    const sessions = localStorage.getItem(this.STORAGE_KEY);
    return sessions ? JSON.parse(sessions) : [];
  }

  async getSessionById(id: string): Promise<Session | null> {
    const sessions = await this.getAllSessions();
    return sessions.find(session => session.id === id) || null;
  }

  async addSession(metadata: RecordingMetadata): Promise<Session> {
    const sessions = await this.getAllSessions();
    
    const newSession: Session = {
      id: crypto.randomUUID(),
      metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    sessions.push(newSession);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    
    return newSession;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session | null> {
    const sessions = await this.getAllSessions();
    const index = sessions.findIndex(session => session.id === id);
    
    if (index === -1) return null;

    const updatedSession = {
      ...sessions[index],
      ...updates,
      updatedAt: new Date()
    };

    sessions[index] = updatedSession;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    
    return updatedSession;
  }

  async deleteSession(id: string): Promise<boolean> {
    const sessions = await this.getAllSessions();
    const filteredSessions = sessions.filter(session => session.id !== id);
    
    if (filteredSessions.length === sessions.length) {
      return false;
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredSessions));
    return true;
  }

  async addNoteToSession(id: string, note: string): Promise<Session | null> {
    return this.updateSession(id, { notes: note });
  }

  async addTagsToSession(id: string, tags: string[]): Promise<Session | null> {
    const session = await this.getSessionById(id);
    if (!session) return null;

    const existingTags = session.tags || [];
    const uniqueTags = [...new Set([...existingTags, ...tags])];
    
    return this.updateSession(id, { tags: uniqueTags });
  }

  async removeTagFromSession(id: string, tag: string): Promise<Session | null> {
    const session = await this.getSessionById(id);
    if (!session || !session.tags) return null;

    const updatedTags = session.tags.filter(t => t !== tag);
    return this.updateSession(id, { tags: updatedTags });
  }

  async searchSessions(query: string): Promise<Session[]> {
    const sessions = await this.getAllSessions();
    const lowerQuery = query.toLowerCase();

    return sessions.filter(session => 
      session.metadata.sessionName.toLowerCase().includes(lowerQuery) ||
      session.notes?.toLowerCase().includes(lowerQuery) ||
      session.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async exportSession(id: string, options: ExportOptions = {}): Promise<Blob> {
    const session = await this.getSessionById(id);
    if (!session) {
      throw new Error('Session not found');
    }

    const recordings = JSON.parse(localStorage.getItem(this.RECORDINGS_STORAGE_KEY) || '{}');
    const sessionRecordings = recordings[id];
    
    if (!sessionRecordings || sessionRecordings.length === 0) {
      throw new Error('No recordings found for this session');
    }

    // If there's only one recording part, return it directly
    if (sessionRecordings.length === 1) {
      return this.base64ToBlob(sessionRecordings[0].data, sessionRecordings[0].mimeType);
    }

    // For multiple parts, combine them
    const blobs = sessionRecordings.map(recording => 
      this.base64ToBlob(recording.data, recording.mimeType)
    );

    // Combine all blobs into one
    return new Blob(blobs, { type: sessionRecordings[0].mimeType });
  }

  async exportSessionToFile(id: string, options: ExportOptions = {}): Promise<void> {
    const blob = await this.exportSession(id, options);
    const session = await this.getSessionById(id);
    
    if (!session) {
      throw new Error('Session not found');
    }

    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.metadata.sessionName}.${session.metadata.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mimeType });
  }
}

export const sessionService = new SessionService();
export default sessionService; 