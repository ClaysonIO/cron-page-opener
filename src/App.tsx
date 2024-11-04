import { useEffect, useState, useMemo } from 'react'
import parser from 'cron-parser'
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  TextField,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Box,
  ThemeProvider,
  createTheme,
  CssBaseline
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, initializeDefaults, ScheduledPage } from './db'

function getTimeUntil(target: Date | null): { days: number; hours: number; minutes: number; seconds: number } | null {
  if (!target) return null;
  
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  
  if (diff <= 0) return null;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds };
}

function getNextPageToVisit(pages: ScheduledPage[]): ScheduledPage | null {
  if (pages.length === 0) return null;

  // Group pages by lastOpened time
  const pagesByLastOpened = pages.reduce((acc, page) => {
    const time = page.lastOpened ? page.lastOpened.getTime() : 0;
    if (!acc[time]) acc[time] = [];
    acc[time].push(page);
    return acc;
  }, {} as Record<number, ScheduledPage[]>);

  // Get the least recently opened time
  const oldestTime = Math.min(...Object.keys(pagesByLastOpened).map(Number));
  
  // Get all pages from that time
  const oldestPages = pagesByLastOpened[oldestTime];
  
  // Randomly select one page from the oldest pages
  return oldestPages[Math.floor(Math.random() * oldestPages.length)];
}

function App() {
  const pages = useLiveQuery(() => db.pages.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.toArray()) ?? [];
  const cronExpression = settings[0]?.cronExpression ?? '*/5 * * * *';
  const darkMode = settings[0]?.darkMode ?? false;
  const [nextRunTime, setNextRunTime] = useState<Date | null>(null);
  const [newUrl, setNewUrl] = useState<string>('');
  const [timeUntil, setTimeUntil] = useState<ReturnType<typeof getTimeUntil>>(null);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          primary: {
            main: '#8B0000',
          },
        },
      }),
    [darkMode]
  );

  useEffect(() => {
    initializeDefaults();
  }, []);

  useEffect(() => {
    const calculateNextRun = () => {
      try {
        const interval = parser.parseExpression(cronExpression);
        setNextRunTime(interval.next().toDate());
      } catch (err) {
        setNextRunTime(null);
      }
    };

    calculateNextRun();
    const timer = setInterval(calculateNextRun, 1000);
    return () => clearInterval(timer);
  }, [cronExpression]);

  useEffect(() => {
    const updateCountdown = () => {
      setTimeUntil(getTimeUntil(nextRunTime));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [nextRunTime]);

  useEffect(() => {
    const checkAndOpenPage = () => {
      if (!nextRunTime || pages.length === 0) return;
      const now = new Date();
      if (now >= nextRunTime) {
        const pageToVisit = getNextPageToVisit(pages);
        if (pageToVisit && pageToVisit.id) {
          window.open(pageToVisit.url, '_blank');
          db.pages.update(pageToVisit.id, {
            ...pageToVisit,
            lastOpened: new Date()
          });
        }
      }
    };

    const timer = setInterval(checkAndOpenPage, 1000);
    return () => clearInterval(timer);
  }, [nextRunTime, pages]);

  const addPage = async () => {
    if (!newUrl) return;
    try {
      new URL(newUrl);
      await db.pages.add({
        url: newUrl,
        lastOpened: null
      });
      setNewUrl('');
    } catch (err) {
      alert('Please enter a valid URL');
    }
  };

  const removePage = async (id: number) => {
    await db.pages.delete(id);
  };

  const updateCronExpression = async (expression: string) => {
    if (settings[0]?.id) {
      await db.settings.update(settings[0].id, {
        ...settings[0],
        cronExpression: expression
      });
    } else {
      await db.settings.add({
        cronExpression: expression,
        darkMode: false
      });
    }
  };

  const toggleDarkMode = async () => {
    if (settings[0]?.id) {
      await db.settings.update(settings[0].id, {
        ...settings[0],
        darkMode: !darkMode
      });
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
        margin: 0,
        padding: 0
      }}>
        <AppBar position="static" sx={{ bgcolor: '#8B0000' }}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, textAlign: 'center' }}>
              Open The Page
            </Typography>
            <IconButton sx={{ ml: 1 }} onClick={toggleDarkMode} color="inherit">
              {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ mt: 4, flexGrow: 1 }}>
          <Grid container spacing={4} direction="column" alignItems="center">
            <Grid item xs={12} sx={{ textAlign: 'center', width: '100%' }}>
              <Typography variant="h4" gutterBottom>
                Next Run Time:
              </Typography>
              <Paper elevation={3} sx={{ p: 3, mb: 2, minWidth: 300 }}>
                <Typography variant="h5">
                  {nextRunTime ? nextRunTime.toLocaleString() : 'Invalid cron expression'}
                </Typography>
              </Paper>
              {timeUntil && (
                <Paper elevation={3} sx={{ p: 2, mb: 4, minWidth: 300 }}>
                  <Typography variant="h6" color="text.secondary">
                    Time until next run:
                  </Typography>
                  <Typography variant="body1">
                    {timeUntil.days > 0 && `${timeUntil.days}d `}
                    {timeUntil.hours}h {timeUntil.minutes}m {timeUntil.seconds}s
                  </Typography>
                </Paper>
              )}
            </Grid>

            <Grid item xs={12} sx={{ width: '100%' }}>
              <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Cron Expression"
                      value={cronExpression}
                      onChange={(e) => updateCronExpression(e.target.value)}
                      placeholder="Enter cron expression (e.g. */5 * * * *)"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Add URL"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://example.com"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={addPage}
                      sx={{ bgcolor: '#8B0000', '&:hover': { bgcolor: '#660000' } }}
                    >
                      Add Page
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12} sx={{ width: '100%' }}>
              <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Scheduled Pages:
                </Typography>
                <List>
                  {pages.map((page) => (
                    <ListItem key={page.id} divider>
                      <ListItemText
                        primary={page.url}
                        secondary={page.lastOpened ? `Last opened: ${page.lastOpened.toLocaleString()}` : 'Never opened'}
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => page.id && removePage(page.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
