import { Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, Link } from '@mui/material';
import type { Stream, Group } from '../types';

interface Props {
  streams: Stream[];
  group: Group | null;
}

export function StreamsSection({ streams, group }: Props) {
  if (!group || streams.length === 0) return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>Active Streams</Typography>
      <Typography variant="body2" color="text.secondary">No active streams.</Typography>
    </Paper>
  );

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>Active Streams</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Scheduled</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>URL</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {streams.map((stream, i) => {
            const dt = new Date(stream.scheduled_start * 1000).toLocaleString('default', { timeZone: group.timezone });
            return (
              <TableRow key={stream.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{dt}</TableCell>
                <TableCell>{stream.status}</TableCell>
                <TableCell>
                  {stream.yt_url ? <Link href={stream.yt_url} target="_blank" rel="noopener">Link</Link> : '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}
