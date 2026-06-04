import { Typography, Paper, Box } from '@mui/material';
import type { Group } from '../types';

interface Props {
  group: Group | null;
}

export function StatusSection({ group }: Props) {
  if (!group) return null;

  const now = new Date();
  const minutesUntilPoll = 15 - (now.getMinutes() % 15);

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>Status</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography>
          <strong>YouTube Connection:</strong> {group.yt_channel_id ? `Connected (${group.yt_channel_name}) 🟢` : 'Not connected 🔴'}
        </Typography>
        <Typography>
          <strong>Next scheduled poll:</strong> in ~{minutesUntilPoll} minute(s)
        </Typography>
      </Box>
    </Paper>
  );
}
