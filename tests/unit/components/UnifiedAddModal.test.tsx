import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UnifiedAddModal from '@/components/shared/class-management/UnifiedAddModal';

// Mock fetch
global.fetch = jest.fn();

describe('UnifiedAddModal', () => {
  const mockProps = {
    eventId: 'test-event-123',
    availableClasses: [
      { classId: 'class1', className: 'Klasse 1a' },
      { classId: 'class2', className: 'Klasse 1b' },
      { classId: 'class3', className: 'Klasse 2a' },
    ],
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    apiBasePath: '/api/teacher',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it('renders with Gruppe tab selected by default', () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Check title (use heading role to avoid collision with button)
    expect(screen.getByRole('heading', { name: 'Gruppe erstellen' })).toBeInTheDocument();

    // Check tabs are present
    expect(screen.getByRole('button', { name: 'Gruppe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lehrerlied' })).toBeInTheDocument();

    // Check Gruppe help text is shown
    expect(screen.getByText('Mehrere Klassen singen gemeinsam ein Lied')).toBeInTheDocument();

    // Check class checkboxes are shown
    expect(screen.getByText('Klasse 1a')).toBeInTheDocument();
    expect(screen.getByText('Klasse 1b')).toBeInTheDocument();
    expect(screen.getByText('Klasse 2a')).toBeInTheDocument();

    // Check submit button (use role and disabled state to distinguish from title)
    expect(screen.getByRole('button', { name: 'Gruppe erstellen' })).toBeDisabled();
  });

  it('switches to Chor tab and shows correct content', () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Click Chor tab
    fireEvent.click(screen.getByRole('button', { name: 'Chor' }));

    // Check Chor help text is shown
    expect(screen.getByText('Für alle Eltern sichtbar, unabhängig von der Klasse')).toBeInTheDocument();

    // Check class checkboxes are NOT shown
    expect(screen.queryByText('Klassen auswählen')).not.toBeInTheDocument();

    // Check submit button text
    expect(screen.getByText('Chor erstellen')).toBeInTheDocument();
  });

  it('switches to Lehrerlied tab and shows correct content', () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Click Lehrerlied tab
    fireEvent.click(screen.getByRole('button', { name: 'Lehrerlied' }));

    // Check submit button text
    expect(screen.getByText('Lehrerlied erstellen')).toBeInTheDocument();

    // Check class checkboxes are NOT shown
    expect(screen.queryByText('Klassen auswählen')).not.toBeInTheDocument();
  });

  it('resets form when switching tabs', () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Enter a name in Gruppe tab
    const nameInput = screen.getByPlaceholderText('z.B. Klasse 3+4, Jahrgang 2');
    fireEvent.change(nameInput, { target: { value: 'Test Gruppe' } });
    expect(nameInput).toHaveValue('Test Gruppe');

    // Switch to Chor tab
    fireEvent.click(screen.getByRole('button', { name: 'Chor' }));

    // Check input is reset
    const choirInput = screen.getByPlaceholderText('z.B. Schulchor, Klasse 3+4 Chor');
    expect(choirInput).toHaveValue('');
  });

  it('submits group with selected classes to groups endpoint', async () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Enter name
    const nameInput = screen.getByPlaceholderText('z.B. Klasse 3+4, Jahrgang 2');
    fireEvent.change(nameInput, { target: { value: 'Test Gruppe' } });

    // Select 2 classes
    fireEvent.click(screen.getByText('Klasse 1a'));
    fireEvent.click(screen.getByText('Klasse 1b'));

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe erstellen' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/teacher/events/test-event-123/groups',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupName: 'Test Gruppe',
            memberClassIds: ['class1', 'class2'],
          }),
        })
      );
    });
  });

  it('submits choir to collections endpoint', async () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Switch to Chor tab
    fireEvent.click(screen.getByRole('button', { name: 'Chor' }));

    // Enter name
    const nameInput = screen.getByPlaceholderText('z.B. Schulchor, Klasse 3+4 Chor');
    fireEvent.change(nameInput, { target: { value: 'Test Chor' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Chor erstellen' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/teacher/events/test-event-123/collections',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Chor',
            type: 'choir',
          }),
        })
      );
    });
  });

  it('submits teacher song to collections endpoint', async () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Switch to Lehrerlied tab
    fireEvent.click(screen.getByRole('button', { name: 'Lehrerlied' }));

    // Enter name
    const nameInput = screen.getByPlaceholderText('z.B. Lehrerband, Abschiedslied');
    fireEvent.change(nameInput, { target: { value: 'Abschiedslied' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Lehrerlied erstellen' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/teacher/events/test-event-123/collections',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Abschiedslied',
            type: 'teacher_song',
          }),
        })
      );
    });
  });

  it('disables submit button when group has less than 2 classes selected', () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Enter name
    const nameInput = screen.getByPlaceholderText('z.B. Klasse 3+4, Jahrgang 2');
    fireEvent.change(nameInput, { target: { value: 'Test Gruppe' } });

    // Select only 1 class
    fireEvent.click(screen.getByText('Klasse 1a'));

    // Submit button should still be disabled
    expect(screen.getByRole('button', { name: 'Gruppe erstellen' })).toBeDisabled();
  });

  it('disables submit button when name is empty', () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Select 2 classes but don't enter name
    fireEvent.click(screen.getByText('Klasse 1a'));
    fireEvent.click(screen.getByText('Klasse 1b'));

    // Submit button should still be disabled
    expect(screen.getByRole('button', { name: 'Gruppe erstellen' })).toBeDisabled();
  });

  it('enables submit button when form is valid', () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Enter name
    const nameInput = screen.getByPlaceholderText('z.B. Klasse 3+4, Jahrgang 2');
    fireEvent.change(nameInput, { target: { value: 'Test Gruppe' } });

    // Select 2 classes
    fireEvent.click(screen.getByText('Klasse 1a'));
    fireEvent.click(screen.getByText('Klasse 1b'));

    // Submit button should be enabled
    expect(screen.getByRole('button', { name: 'Gruppe erstellen' })).not.toBeDisabled();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<UnifiedAddModal {...mockProps} />);

    fireEvent.click(screen.getByText('Abbrechen'));

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when X button is clicked', () => {
    render(<UnifiedAddModal {...mockProps} />);

    // Find the close button by its SVG path
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn =>
      btn.querySelector('svg path[d="M6 18L18 6M6 6l12 12"]')
    );

    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockProps.onClose).toHaveBeenCalled();
    }
  });
});
