import { useState } from 'react';
import { Typography, Paper, TextField, Box, IconButton, Select, MenuItem, FormControl, InputLabel, Button } from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import type { Slot } from '../types';
import { addSlot, removeSlot } from '../api/slots';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Props {
  slots: Slot[];
  groupId: number;
  slotEdits: Record<number, Partial<Slot>>;
  onSlotEdit: (id: number, field: keyof Slot, value: string) => void;
  onUpdate: () => void;
  onError: (msg: string) => void;
}

export function SlotsSection({ slots, groupId, slotEdits, onSlotEdit, onUpdate, onError }: Props) {
  const [newDay, setNewDay] = useState<number>(0);
  const [newTime, setNewTime] = useState<string>('12:00');
  const [newTemplate, setNewTemplate] = useState<string>('');

  const handleAdd = async () => {
    if (!newTemplate) {
      onError('Title template is required');
      return;
    }
    try {
      await addSlot(groupId, { day_of_week: newDay, local_time: newTime, title_template: newTemplate });
      setNewTemplate('');
      onUpdate();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await removeSlot(groupId, id);
      onUpdate();
    } catch (err: any) {
      onError(err.message);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>Slots</Typography>
      
      {slots.map(slot => (
        <Box key={slot.id} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', p: 1, border: '1px solid #ccc', borderRadius: 1 }}>
          <Box sx={{ minWidth: 100 }}>
            <Typography variant="subtitle2">{DAYS[slot.day_of_week]}</Typography>
            <Typography variant="body2">{slot.local_time}</Typography>
          </Box>
          <TextField 
            label="Title Template" 
            size="small" 
            value={slotEdits[slot.id]?.title_template ?? slot.title_template}
            onChange={e => onSlotEdit(slot.id, 'title_template', e.target.value)}
            fullWidth
          />
          <TextField 
            label="Custom Message" 
            size="small" 
            value={slotEdits[slot.id]?.custom_message ?? (slot.custom_message || '')}
            onChange={e => onSlotEdit(slot.id, 'custom_message', e.target.value)}
            fullWidth
          />
          <IconButton color="error" onClick={() => handleRemove(slot.id)}>
            <DeleteIcon />
          </IconButton>
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 3, pt: 2, borderTop: '1px solid #eee' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Day</InputLabel>
          <Select value={newDay} label="Day" onChange={e => setNewDay(e.target.value as number)}>
            {DAYS.map((day, i) => <MenuItem key={i} value={i}>{day}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField 
          type="time" 
          size="small" 
          value={newTime} 
          onChange={e => setNewTime(e.target.value)} 
        />
        <TextField 
          label="Title Template" 
          size="small" 
          value={newTemplate} 
          onChange={e => setNewTemplate(e.target.value)} 
          fullWidth
        />
        <Button variant="contained" onClick={handleAdd} startIcon={<AddIcon />}>Add</Button>
      </Box>
    </Paper>
  );
}
