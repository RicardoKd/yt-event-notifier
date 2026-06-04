import { Paper, Button, Box } from '@mui/material';
import { Sync } from '@mui/icons-material';
import { triggerCheck } from '../api/check';

interface Props {
  groupId: number;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function CheckSection({ groupId, onSuccess, onError }: Props) {
  const handleTrigger = async () => {
    try {
      await triggerCheck(groupId);
      onSuccess('Manual sync triggered successfully');
    } catch (err: any) {
      onError(err.message);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button variant="outlined" startIcon={<Sync />} onClick={handleTrigger}>
          Trigger Manual Sync
        </Button>
      </Box>
    </Paper>
  );
}
