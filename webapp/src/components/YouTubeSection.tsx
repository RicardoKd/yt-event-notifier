import { Typography, Paper, Button, Box } from '@mui/material';
import { YouTube, LinkOff } from '@mui/icons-material';
import type { Group } from '../types';
import { getAuthUrl, disconnectYoutube } from '../api/youtube';

interface Props {
  group: Group;
  groupId: number;
  onUpdate: () => void;
  onError: (msg: string) => void;
}

export function YouTubeSection({ group, groupId, onUpdate, onError }: Props) {
  const handleConnect = async () => {
    try {
      const res = await getAuthUrl(groupId);
      window.location.href = res.url;
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectYoutube(groupId);
      onUpdate();
    } catch (err: any) {
      onError(err.message);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>YouTube Integration</Typography>
      <Box sx={{ mt: 2 }}>
        {group.yt_channel_id ? (
          <Button variant="outlined" color="error" startIcon={<LinkOff />} onClick={handleDisconnect}>
            Disconnect YouTube
          </Button>
        ) : (
          <Button variant="contained" color="error" startIcon={<YouTube />} onClick={handleConnect}>
            Connect YouTube
          </Button>
        )}
      </Box>
    </Paper>
  );
}
