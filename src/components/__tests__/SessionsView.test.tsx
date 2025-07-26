import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionsView from '../views/SessionsView';
import sessionService from '../../services/SessionService';
import { Session } from '../../types/Session';

// Mock the session service
vi.mock('../../services/SessionService', () => ({
  default: {
    getAllSessions: vi.fn(),
    searchSessions: vi.fn(),
    deleteSession: vi.fn(),
    addNoteToSession: vi.fn(),
    addTagsToSession: vi.fn(),
    removeTagFromSession: vi.fn(),
    exportSession: vi.fn(),
  },
}));

// Mock the ProgressIndicator component
vi.mock('../ProgressIndicator', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="progress-indicator">{children}</div>
  ),
}));

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'mock-url'),
    revokeObjectURL: vi.fn(),
  },
});

const mockSessions: Session[] = [
  {
    id: '1',
    createdAt: new Date('2024-01-01'),
    metadata: {
      sessionName: 'Test Session 1',
      duration: 3600,
      format: 'wav' as const,
      quality: 128,
      fileSize: 1024000,
    },
    filePath: '/path/to/session1.wav',
    notes: ['First note'],
    tags: ['adventure', 'test'],
  },
  {
    id: '2',
    createdAt: new Date('2024-01-02'),
    metadata: {
      sessionName: 'Test Session 2',
      duration: 1800,
      format: 'mp3' as const,
      quality: 256,
      fileSize: 2048000,
    },
    filePath: '/path/to/session2.mp3',
    notes: [],
    tags: ['combat'],
  },
];

describe('SessionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sessionService.getAllSessions as any).mockResolvedValue(mockSessions);
  });

  it('renders sessions list correctly', async () => {
    render(<SessionsView />);

    await waitFor(() => {
      expect(screen.getByText('Test Session 1')).toBeInTheDocument();
      expect(screen.getByText('Test Session 2')).toBeInTheDocument();
    });

    expect(sessionService.getAllSessions).toHaveBeenCalled();
  });

  it('handles search functionality', async () => {
    const user = userEvent.setup();
    (sessionService.searchSessions as any).mockResolvedValue([mockSessions[0]]);

    render(<SessionsView />);

    const searchInput = screen.getByLabelText(/search sessions/i);
    await user.type(searchInput, 'Test Session 1');

    await waitFor(() => {
      expect(sessionService.searchSessions).toHaveBeenCalledWith('Test Session 1');
    });
  });

  it('selects a session when clicked', async () => {
    const user = userEvent.setup();
    render(<SessionsView />);

    await waitFor(() => {
      expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test Session 1'));

    // Check if session details are displayed
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('handles session deletion', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => true);
    (sessionService.deleteSession as any).mockResolvedValue(undefined);

    render(<SessionsView />);

    await waitFor(() => {
      expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    });

    const deleteButton = screen.getAllByLabelText(/delete session/i)[0];
    await user.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(sessionService.deleteSession).toHaveBeenCalledWith('1');
  });

  it('handles adding notes to a session', async () => {
    const user = userEvent.setup();
    (sessionService.addNoteToSession as any).mockResolvedValue(undefined);

    render(<SessionsView />);

    await waitFor(() => {
      expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    });

    // Select a session
    await user.click(screen.getByText('Test Session 1'));

    // Click on notes area to start editing
    const notesArea = screen.getByText('First note');
    await user.click(notesArea);

    // Find and type in the textarea
    const textarea = screen.getByLabelText(/edit session notes/i);
    await user.clear(textarea);
    await user.type(textarea, 'Updated note');

    // Save the note
    const saveButton = screen.getByLabelText(/save session notes/i);
    await user.click(saveButton);

    expect(sessionService.addNoteToSession).toHaveBeenCalledWith('1', 'Updated note');
  });

  it('handles adding tags to a session', async () => {
    const user = userEvent.setup();
    (sessionService.addTagsToSession as any).mockResolvedValue(undefined);

    render(<SessionsView />);

    await waitFor(() => {
      expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    });

    // Select a session
    await user.click(screen.getByText('Test Session 1'));

    // Add a new tag
    const tagInput = screen.getByLabelText(/add new tag/i);
    await user.type(tagInput, 'newtag');

    const addButton = screen.getByLabelText(/add tag to session/i);
    await user.click(addButton);

    expect(sessionService.addTagsToSession).toHaveBeenCalledWith('1', ['newtag']);
  });

  it('handles session export', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
    (sessionService.exportSession as any).mockResolvedValue(mockBlob);

    // Mock createElement and click
    const mockAnchor = {
      click: vi.fn(),
      href: '',
      download: '',
    };
    document.createElement = vi.fn(() => mockAnchor as any);

    render(<SessionsView />);

    await waitFor(() => {
      expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    });

    // Select a session
    await user.click(screen.getByText('Test Session 1'));

    // Export the session
    const exportButton = screen.getByLabelText(/export session/i);
    await user.click(exportButton);

    await waitFor(() => {
      expect(sessionService.exportSession).toHaveBeenCalledWith('1');
    });

    expect(mockAnchor.click).toHaveBeenCalled();
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<SessionsView />);

    await waitFor(() => {
      expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    });

    const sessionItem = screen.getByLabelText(/Session Test Session 1/);
    sessionItem.focus();

    // Test Enter key
    await user.keyboard('{Enter}');
    expect(screen.getByText('Details')).toBeInTheDocument();

    // Reset selection
    await user.click(screen.getByText('Test Session 2'));

    // Test Space key
    sessionItem.focus();
    await user.keyboard(' ');
    expect(screen.getByText('Details')).toBeInTheDocument();
  });
});