import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, CssBaseline, Container, Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import { Save } from '@mui/icons-material';
import { getTheme } from './theme';
import { useGroupId } from './hooks/useGroupId';
import type { Group, Slot, Stream } from './types';
import { getGroup, patchGroup } from './api/group';
import { listSlots, updateSlot } from './api/slots';
import { listStreams } from './api/streams';

import { AppHeader } from './components/AppHeader';
import { StatusSection } from './components/StatusSection';
import { YouTubeSection } from './components/YouTubeSection';
import { SettingsSection } from './components/SettingsSection';
import { SlotsSection } from './components/SlotsSection';
import { StreamsSection } from './components/StreamsSection';
import { CheckSection } from './components/CheckSection';

export default function App() {
  const groupId = useGroupId();
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const theme = getTheme(darkMode ? 'dark' : 'light');

  const [group, setGroup] = useState<Group | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [formState, setFormState] = useState<Partial<Group>>({});
  const [slotEdits, setSlotEdits] = useState<Record<number, Partial<Slot>>>({});
  
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const loadData = useCallback(async () => {
    if (!groupId) return;
    try {
      const g = await getGroup(groupId);
      setGroup(g);
      setFormState({
        timezone: g.timezone,
        reminder_hours: g.reminder_hours,
        check_window_hours: g.check_window_hours,
        auto_create: g.auto_create,
        broadcast_privacy: g.broadcast_privacy,
        broadcast_description: g.broadcast_description,
        broadcast_made_for_kids: g.broadcast_made_for_kids,
      });

      const [sl, st] = await Promise.all([
        listSlots(groupId),
        listStreams(groupId)
      ]);
      setSlots(sl);
      setStreams(st);
      setSlotEdits({});
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1' && groupId) {
      showSnackbar('YouTube connected successfully!', 'success');
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?group_id=${groupId}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
      loadData();
    }
  }, [groupId, loadData]);

  if (!groupId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography variant="h5">No group ID provided. Open this app from your Telegram bot.</Typography>
      </Box>
    );
  }

  const handleSave = async () => {
    try {
      if (Object.keys(formState).length > 0) {
        await patchGroup(groupId, formState);
      }
      
      for (const [slotId, edits] of Object.entries(slotEdits)) {
        await updateSlot(groupId, parseInt(slotId, 10), edits);
      }
      
      showSnackbar('Settings saved', 'success');
      loadData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppHeader darkMode={darkMode} onToggleTheme={() => setDarkMode(!darkMode)} />
      
      <Container maxWidth="md" sx={{ py: 4 }}>
        <StatusSection group={group} />
        {group && (
          <YouTubeSection 
            group={group} 
            groupId={groupId} 
            onUpdate={loadData} 
            onError={(msg) => showSnackbar(msg, 'error')} 
          />
        )}
        <SettingsSection 
          formState={formState} 
          onChange={(field, value) => setFormState(prev => ({ ...prev, [field]: value }))} 
        />
        <SlotsSection 
          slots={slots} 
          groupId={groupId} 
          slotEdits={slotEdits} 
          onSlotEdit={(id, field, value) => setSlotEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))}
          onUpdate={loadData}
          onError={(msg) => showSnackbar(msg, 'error')}
        />
        <StreamsSection streams={streams} group={group} />
        
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <Button variant="contained" size="large" startIcon={<Save />} onClick={handleSave} color="primary">
            Save Changes
          </Button>
        </Box>

        <CheckSection 
          groupId={groupId} 
          onSuccess={(msg) => showSnackbar(msg, 'success')} 
          onError={(msg) => showSnackbar(msg, 'error')} 
        />
      </Container>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
