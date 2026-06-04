import { Typography, Paper, TextField, Switch, FormControlLabel, Select, MenuItem, InputLabel, FormControl, Box } from '@mui/material';
import type { Group } from '../types';

interface Props {
  formState: Partial<Group>;
  onChange: (field: keyof Group, value: any) => void;
}

export function SettingsSection({ formState, onChange }: Props) {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>Settings</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField 
          label="Timezone" 
          value={formState.timezone || ''} 
          onChange={e => onChange('timezone', e.target.value)} 
          fullWidth
        />
        <TextField 
          label="Reminder Hours" 
          type="number" 
          slotProps={{ htmlInput: { step: "0.5" } }}
          value={formState.reminder_hours ?? ''} 
          onChange={e => onChange('reminder_hours', parseFloat(e.target.value))} 
          fullWidth
        />
        <TextField 
          label="Check Window Hours" 
          type="number" 
          slotProps={{ htmlInput: { step: "1" } }}
          value={formState.check_window_hours ?? ''} 
          onChange={e => onChange('check_window_hours', parseFloat(e.target.value))} 
          fullWidth
        />
        <FormControlLabel
          control={<Switch checked={!!formState.auto_create} onChange={e => onChange('auto_create', e.target.checked)} />}
          label="Auto Create Streams"
        />
        <FormControl fullWidth>
          <InputLabel>Broadcast Privacy</InputLabel>
          <Select
            value={formState.broadcast_privacy || 'unlisted'}
            label="Broadcast Privacy"
            onChange={e => onChange('broadcast_privacy', e.target.value)}
          >
            <MenuItem value="public">Public</MenuItem>
            <MenuItem value="unlisted">Unlisted</MenuItem>
            <MenuItem value="private">Private</MenuItem>
          </Select>
        </FormControl>
        <TextField 
          label="Broadcast Description" 
          multiline
          minRows={3}
          value={formState.broadcast_description || ''} 
          onChange={e => onChange('broadcast_description', e.target.value)} 
          fullWidth
        />
        <FormControlLabel
          control={<Switch checked={!!formState.broadcast_made_for_kids} onChange={e => onChange('broadcast_made_for_kids', e.target.checked)} />}
          label="Made for Kids"
        />
      </Box>
    </Paper>
  );
}
