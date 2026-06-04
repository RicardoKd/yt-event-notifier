import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';

interface Props {
  darkMode: boolean;
  onToggleTheme: () => void;
}

export function AppHeader({ darkMode, onToggleTheme }: Props) {
  return (
    <AppBar position="static" elevation={0} color="primary">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          YT Event Notifier
        </Typography>
        <IconButton color="inherit" onClick={onToggleTheme}>
          {darkMode ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
