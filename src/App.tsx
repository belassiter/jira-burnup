import { useState, useEffect, useMemo } from 'react';
import { AppShell, Group, Text, TextInput, Button, Container, Paper, Stack, Select, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { CredentialsModal } from './components/CredentialsModal';
import { StatusManager } from './components/StatusManager';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { extractAllStatuses, processDailySnapshots, Issue } from './utils/dataProcessor';
import { IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react';

import '@mantine/dates/styles.css';

// Metrics definitions
const METRICS = [
  { value: 'customfield_10006', label: 'Story Points' },
  { value: 'count', label: 'Issue Count' },
  { value: 'customfield_15505', label: 'Run Time' }
];

export interface StatusConfig {
    name: string;
    color: string;
    enabled: boolean;
}

export default function App() {
  const [credentialsOpen, { open: openCredentials, close: closeCredentials }] = useDisclosure(false);
  const [statusManagerOpen, { open: openStatusManager, close: closeStatusManager }] = useDisclosure(false);
  
  // Data State
  const [jql, setJql] = useState('project = "JIRA" AND sprint in openSprints()');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Chart Configuration
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(new Date().setDate(new Date().getDate() - 14)), new Date()]);
  const [metric, setMetric] = useState<string | null>('customfield_10006');
  
  // Status State
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [statusConfigs, setStatusConfigs] = useState<StatusConfig[]>([]);

  // Derived State: Chart Data
  const chartData = useMemo(() => {
    if (!dateRange[0] || !dateRange[1]) return [];
    
    // Get enabled statuses in order
    const enabledStatuses = statusConfigs.filter(s => s.enabled).map(s => s.name);
    // If no configs yet (first load), use all available
    const statusesToTrack = enabledStatuses.length > 0 ? enabledStatuses : availableStatuses;

    return processDailySnapshots(issues, dateRange[0], dateRange[1], metric || 'count', statusesToTrack);
  }, [issues, dateRange, metric, statusConfigs, availableStatuses]);

  // Check credentials on mount
  useEffect(() => {
    const checkCreds = async () => {
        try {
            const exists = await window.ipcRenderer.invoke('has-credentials');
            if (!exists) {
                openCredentials();
            }
        } catch (e) {
            console.error("Failed to check credentials", e);
        }
    };
    checkCreds();
  }, []);

  const handleFetchData = async (query = jql) => {
      setLoading(true);
      try {
          const result = await window.ipcRenderer.invoke('get-issues', query);
          setIssues(result);
          
          const allStatuses = extractAllStatuses(result);
          setAvailableStatuses(allStatuses);
          
          // Initialize configs if empty, preserving existing ones
          setStatusConfigs(prev => {
              const newConfigs = [...prev];
              allStatuses.forEach(s => {
                  if (!newConfigs.find(c => c.name === s)) {
                      newConfigs.push({
                          name: s,
                          color: `hsl(${Math.random() * 360}, 70%, 50%)`, // Random color for now
                          enabled: true
                      });
                  }
              });
              return newConfigs;
          });

      } catch (err: any) {
          console.error(err);
          alert("Failed to fetch data: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const saveConfiguration = async () => {
      const config = {
          jql,
          dateRange,
          metric,
          statusConfigs
      };
      
      try {
          const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'jira-burnup-config.json';
          a.click();
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error("Save failed", e);
      }
  };

  const loadConfiguration = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const config = JSON.parse(event.target?.result as string);
                  if (config.jql) setJql(config.jql);
                  if (config.dateRange) setDateRange([
                      config.dateRange[0] ? new Date(config.dateRange[0]) : null, 
                      config.dateRange[1] ? new Date(config.dateRange[1]) : null
                  ]);
                  if (config.metric) setMetric(config.metric);
                  if (config.statusConfigs) setStatusConfigs(config.statusConfigs);

                  if (config.jql) {
                      handleFetchData(config.jql);
                  }
              } catch (err) {
                  alert("Invalid config file");
              }
          };
          reader.readAsText(file);
      };
      input.click();
  };

  const metricLabel = METRICS.find(m => m.value === metric)?.label || metric;

  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700}>Jira Burnup Chart</Text>
          <Group>
            <Button leftSection={<IconDeviceFloppy size={16} />} variant="default" onClick={saveConfiguration}>Save Config</Button>
            <Button leftSection={<IconFolderOpen size={16} />} variant="default" onClick={loadConfiguration}>Load Config</Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <CredentialsModal opened={credentialsOpen} onClose={closeCredentials} />
        <StatusManager 
            opened={statusManagerOpen} 
            onClose={closeStatusManager}
            availableStatuses={availableStatuses}
            statusConfigs={statusConfigs}
            onConfigsChange={setStatusConfigs}
        />
        
        <Container fluid>
            <Stack gap="lg">
                <Paper p="md" withBorder shadow="sm">
                    <Stack>
                        <TextInput 
                            label="JQL Query" 
                            value={jql} 
                            onChange={(e) => setJql(e.currentTarget.value)}
                            rightSection={<Button size="xs" onClick={() => handleFetchData(jql)} loading={loading}>Pull Data</Button>}
                            rightSectionWidth={100}
                        />
                    </Stack>
                </Paper>

                <Paper p="md" withBorder shadow="sm">
                    <Group align="flex-end">
                         <DatePickerInput
                            type="range"
                            label="Date Range"
                            placeholder="Pick dates"
                            value={dateRange}
                            onChange={setDateRange}
                            style={{ flex: 1 }}
                        />
                        <Select
                            label="Metric"
                            data={METRICS}
                            value={metric}
                            onChange={setMetric}
                            searchable
                            style={{ flex: 1 }}
                        />
                         <Stack gap={0} style={{ flex: 1 }}>
                            <Text size="sm" fw={500} mb={3}>Statuses</Text>
                            <Button 
                                variant="default" 
                                onClick={openStatusManager} 
                                justify="space-between" 
                                rightSection={<Text size="xs" c="dimmed">{statusConfigs.filter(s => s.enabled).length} selected</Text>}
                                disabled={issues.length === 0}
                            >
                                Configure Statuses & Colors
                            </Button>
                         </Stack>
                    </Group>
                </Paper>

                <Paper p="md" withBorder shadow="sm" h={500}>
                    <Title order={4} mb="md">Burnup Chart</Title>
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis>
                                <Label value={metricLabel || ''} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                            </YAxis>
                            <Tooltip cursor={{fill: 'transparent'}} />
                            <Legend />
                            {/* Reverse the order when mapping to bars so the first item in the list (Top)
                                appears at the Top of the stack. Recharts stacks bottom-to-top by default.
                            */}
                            {[...statusConfigs].reverse().filter(s => s.enabled).map((config) => (
                                <Bar 
                                    key={config.name} 
                                    dataKey={config.name} 
                                    stackId="a" 
                                    fill={config.color} 
                                    name={config.name}
                                />
                            ))}
                            
                            {/* Fallback if no configs but data (loading state or initial) */}
                            {statusConfigs.length === 0 && availableStatuses.map((status, index) => (
                                <Bar key={status} dataKey={status} stackId="a" fill={`hsl(${index * 40}, 70%, 50%)`} />
                            ))}

                        </BarChart>
                    </ResponsiveContainer>
                </Paper>
            </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
