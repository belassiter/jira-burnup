import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppShell, Group, Text, TextInput, Button, Container, Paper, Stack, Select, SegmentedControl, ActionIcon, Notification, Loader } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { CredentialsModal } from './components/CredentialsModal';
import { StatusManager } from './components/StatusManager';
import { ForecastModal } from './components/ForecastModal';
import { ConfluenceSettingsModal } from './components/ConfluenceSettingsModal';
import { BulkPublishModal } from './components/BulkPublishModal';
import { Area, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { extractAllStatuses, processDailySnapshots } from './utils/dataProcessor';
import { generateForecast } from './utils/forecasting';
import { getRoundedYAxisMax, getYAxisTicks } from './utils/chartAxis';
import { getXAxisTicks } from './utils/xAxis';
import { Issue, StatusConfig, StatusCategory, ForecastConfig, ConfluenceConfig } from './types';
import { IconDeviceFloppy, IconFolderOpen, IconSettings, IconDownload, IconRefresh, IconDice, IconCheck, IconX, IconStack2 } from '@tabler/icons-react';
import { toPng } from 'html-to-image';
import { SimulationResultsModal } from './components/SimulationResultsModal';
import { getConfluenceAttachmentFilename, getLoadedConfluenceChartConfig, parseConfluencePageId } from './utils/confluence';

import '@mantine/dates/styles.css';

// Metrics definitions
const METRICS = [
  { value: 'customfield_10006', label: 'Story Points' },
  { value: 'count', label: 'Issue Count' },
  { value: 'customfield_15505', label: 'Run Time (minutes)' }
];

interface BulkPublishJob {
    path: string;
    filename: string;
    status: 'pending' | 'active' | 'success' | 'failed';
}

function guessCategory(statusName: string): StatusCategory {
    const lower = statusName.toLowerCase();
    if (['done', 'closed', 'resolved', 'released', 'shipped', 'cancelled'].some(s => lower.includes(s))) return 'done';
    if (['in progress', 'review', 'qa', 'testing', 'verify', 'development'].some(s => lower.includes(s))) return 'started';
    return 'not-started';
}

export default function App() {
  const [credentialsOpen, { open: openCredentials, close: closeCredentials }] = useDisclosure(false);
  const [statusManagerOpen, { open: openStatusManager, close: closeStatusManager }] = useDisclosure(false);
  const [forecastModalOpen, { open: openForecastModal, close: closeForecastModal }] = useDisclosure(false);
  const [simulationModalOpen, { open: openSimulationModal, close: closeSimulationModal }] = useDisclosure(false);
  const [confluenceModalOpen, { open: openConfluenceModal, close: closeConfluenceModal }] = useDisclosure(false);
  const [bulkPublishModalOpen, { open: openBulkPublishModal, close: closeBulkPublishModal }] = useDisclosure(false);

  // Data State
  const [jql, setJql] = useState('project = "JIRA" AND sprint in openSprints()');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Chart Configuration
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(new Date().setDate(new Date().getDate() - 14)), new Date()]);
  const [metric, setMetric] = useState<string | null>('customfield_10006');
  const [graphTitle, setGraphTitle] = useState('Burnup Chart');
  const [graphType, setGraphType] = useState('bar');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Forecast Configuration
  const [forecastConfig, setForecastConfig] = useState<ForecastConfig>({
      enabled: false,
      avgDatapoints: 3,
      showConfidence: true,
      mcCycles: 100000
  });

  // Status State
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [statusConfigs, setStatusConfigs] = useState<StatusConfig[]>([]);
  const [statusDisplayMode, setStatusDisplayMode] = useState<'all' | 'categories'>('categories');
    const [confluenceConfig, setConfluenceConfig] = useState<ConfluenceConfig>({
            confluenceUrl: '',
            personalAccessToken: '',
            pageUrl: '',
            attachmentFilename: 'jira-burnup-latest.png'
    });
    const [publishingConfluence, setPublishingConfluence] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);
      const [bulkJobs, setBulkJobs] = useState<BulkPublishJob[]>([]);
    const [snackbar, setSnackbar] = useState<{ message: string; color: 'green' | 'red' } | null>(null);

    const baseChartData = useMemo(() => {
        if (!dateRange[0] || !dateRange[1]) return [];
    
    // We want the chart data to contain values for ALL statuses, even disabled ones.
    // This is crucial for forecasting, which needs to know the Total Scope (all work).
    // The visualization logic filters what bars to draw based on 'statusConfigs',
    // but the data points should be complete.
    const statusesToTrack = availableStatuses;

    return processDailySnapshots(issues, dateRange[0], dateRange[1], metric || 'count', statusesToTrack);
  }, [issues, dateRange, metric, availableStatuses]);

  // Calculate Y-axis domain/ticks with fixed 50-unit increments.
  const yAxisConfig = useMemo(() => {
      let maxStack = 0;

      baseChartData.forEach(d => {
          let sum = 0;
          statusConfigs.forEach(c => {
              // Only sum enabled statuses
              if (c.enabled && typeof d[c.name] === 'number') {
                  sum += d[c.name];
              }
          });
          if (sum > maxStack) maxStack = sum;
      });

      const domainMax = getRoundedYAxisMax(maxStack);
      const ticks = getYAxisTicks(maxStack);

      return { domainMax, ticks };
  }, [baseChartData, statusConfigs]);

  const forecastColor = useMemo(() => {
      // "Lowest status on the Status configuration"
      // Assuming statusConfigs is ordered top-down as listed in UI.
      // The last element is the bottom one.
      const enabled = statusConfigs.filter(s => s.enabled);
      if (enabled.length > 0) {
          return enabled[enabled.length - 1].color;
      }
      return '#ff7300';
  }, [statusConfigs]);
  // Memoize the Forecast Result separately so we can access simulation stats
  const forecastResult = useMemo(() => {
      if (!forecastConfig.enabled || baseChartData.length === 0) return null;
      
      // Pass the end date of the chart's view. Forecast should NOT extend beyond this.
      const endDateStr = dateRange[1] ? dateRange[1].toISOString().split('T')[0] : undefined;
      return generateForecast(baseChartData, forecastConfig, statusConfigs, endDateStr);
  }, [baseChartData, forecastConfig, statusConfigs, dateRange]);

  const forecastText = useMemo(() => {
      if (!forecastConfig.enabled || !forecastResult || !forecastResult.completionDate) return null;
      let text = `Forecasted Completion: ${forecastResult.completionDate}`;
      
      if (forecastConfig.showConfidence && forecastResult.simulationResults) {
          const dates = forecastResult.simulationResults.completionDates;
          if (dates && dates.length > 0) {
              const sortedDates = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
              const p2_5Index = Math.floor(sortedDates.length * 0.025);
              const medianIndex = Math.floor(sortedDates.length / 2);
              const p97_5Index = Math.floor(sortedDates.length * 0.975);
              
              const medianDate = sortedDates[medianIndex];
              const d1 = new Date(sortedDates[p2_5Index]).getTime();
              const d2 = new Date(sortedDates[p97_5Index]).getTime();
              
              const spanDays = (d2 - d1) / (1000 * 60 * 60 * 24);
              const halfSpanWeeks = Math.round((spanDays / 7) / 2);
              
              text = `Forecasted Completion: ${medianDate} ± ${halfSpanWeeks} weeks`;
          }
      }
      
      return text;
  }, [forecastResult, forecastConfig]);

  // Determine what stacks to render based on Display Mode
  const activeDisplayConfigs = useMemo(() => {
      if (statusDisplayMode === 'all') {
          return [...statusConfigs].reverse().filter(s => s.enabled);
      } else {
          return [
              { name: 'Not Started', color: '#e03131', enabled: true, category: 'not-started' }, // standard redshift for Not Started
              { name: 'Started', color: '#f59f00', enabled: true, category: 'started' }, // gold
              { name: 'Done', color: '#2b8a3e', enabled: true, category: 'done' } // green
          ].reverse(); // Render 'Done' at the bottom of the stack
      }
  }, [statusConfigs, statusDisplayMode]);

  // Combine Base Data with Forecast
  const chartData = useMemo(() => {
      // console.log(`Forecast Config: enabled=${forecastConfig.enabled}, dataLen=${baseChartData.length}`);
        let combined = [...baseChartData];

        if (forecastResult) {
            // Merge forecast points into the base data.
            forecastResult.forecastPoints.forEach(pt => {
                const index = combined.findIndex(d => d.date === pt.date);
                if (index !== -1) {
                    // Merge into existing point
                    combined[index] = { ...combined[index], ...pt };
                }
                // Else: Ignore points outside the chart's date range (shouldn't happen with strict endDate logic)
            });
        }

        if (statusDisplayMode === 'categories') {
            combined = combined.map(point => {
                const newPoint = { ...point };
                let notStarted = 0, started = 0, done = 0;
                let hasVal = false;
                statusConfigs.forEach(c => {
                    if (c.enabled && typeof point[c.name] === 'number') {
                        hasVal = true;
                        if (c.category === 'not-started') notStarted += (point[c.name] as number);
                        else if (c.category === 'started') started += (point[c.name] as number);
                        else if (c.category === 'done') done += (point[c.name] as number);
                    }
                });
                
                if (hasVal) {
                    newPoint['Not Started'] = notStarted;
                    newPoint['Started'] = started;
                    newPoint['Done'] = done;
                }
                
                return newPoint;
            });
        }

        return combined;

      }, [baseChartData, forecastResult, statusConfigs, statusDisplayMode]);

      const xAxisTicks = useMemo(() => {
          const availableDates = chartData.map(d => d.date);
          return getXAxisTicks(availableDates, dateRange[0], dateRange[1]);
      }, [chartData, dateRange]);

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

  useEffect(() => {
      const loadConfluenceConfig = async () => {
          try {
              const savedConfig = await window.ipcRenderer.invoke('get-confluence-config');
              if (savedConfig && typeof savedConfig === 'object') {
                  setConfluenceConfig({
                      confluenceUrl: savedConfig.confluenceUrl || '',
                      personalAccessToken: savedConfig.personalAccessToken || '',
                      pageUrl: savedConfig.pageUrl || '',
                      attachmentFilename: getConfluenceAttachmentFilename(savedConfig.attachmentFilename)
                  });
              }
          } catch (e) {
              console.error('Failed to load Confluence settings', e);
          }
      };
      loadConfluenceConfig();
  }, []);

  useEffect(() => {
      if (!snackbar) return;
      const timer = window.setTimeout(() => setSnackbar(null), 4000);
      return () => window.clearTimeout(timer);
  }, [snackbar]);

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
                          enabled: true,
                          category: guessCategory(s)
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
          statusConfigs,
          statusDisplayMode,
          graphTitle,
          graphType,
          forecastConfig,
          confluenceConfig: {
              pageUrl: confluenceConfig.pageUrl,
              attachmentFilename: getConfluenceAttachmentFilename(confluenceConfig.attachmentFilename)
          }
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
      setLoadingConfig(true);

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';

      input.oncancel = () => {
          setLoadingConfig(false);
      };

      input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (!file) {
              setLoadingConfig(false);
              return;
          }

          const reader = new FileReader();
          reader.onload = async (event) => {
              try {
                  const config = JSON.parse(event.target?.result as string);
                  if (config.jql) setJql(config.jql);
                  if (config.dateRange) setDateRange([
                      config.dateRange[0] ? new Date(config.dateRange[0]) : null, 
                      config.dateRange[1] ? new Date(config.dateRange[1]) : null
                  ]);
                  if (config.metric) setMetric(config.metric);
                  if (config.statusConfigs) setStatusConfigs(config.statusConfigs);
                  if (config.statusDisplayMode) setStatusDisplayMode(config.statusDisplayMode);
                  if (config.graphTitle) setGraphTitle(config.graphTitle);
                  if (config.graphType) setGraphType(config.graphType);
                  if (config.forecastConfig) setForecastConfig(config.forecastConfig);
                  const loadedConfluenceChartConfig = getLoadedConfluenceChartConfig(config.confluenceConfig);
                  setConfluenceConfig(prev => ({
                      ...prev,
                      pageUrl: loadedConfluenceChartConfig.pageUrl,
                      attachmentFilename: loadedConfluenceChartConfig.attachmentFilename
                  }));

                  if (config.jql) {
                      await handleFetchData(config.jql);
                  }
              } catch {
                  alert("Invalid config file");
              } finally {
                  setLoadingConfig(false);
              }
          };
          reader.onerror = () => {
              alert('Failed to read config file');
              setLoadingConfig(false);
          };
          reader.readAsText(file);
      };
      input.click();
  };
  
  const resetConfiguration = () => {
      if (confirm('Are you sure you want to reset the entire configuration to defaults? This will clear loaded data.')) {
        setJql('project = "JIRA" AND sprint in openSprints()');
        setIssues([]);
        setDateRange([new Date(new Date().setDate(new Date().getDate() - 14)), new Date()]);
        setMetric('customfield_10006');
        setGraphTitle('Burnup Chart');
        setGraphType('bar');
        setForecastConfig({
            enabled: false,
            avgDatapoints: 3,
            showConfidence: true,
            mcCycles: 100000
        });
        setAvailableStatuses([]);
        setStatusConfigs([]);
        setStatusDisplayMode('categories');
        setConfluenceConfig(prev => ({
            ...prev,
            pageUrl: '',
            attachmentFilename: 'jira-burnup-latest.png'
        }));
      }
  };

  const handleConfluenceConfigSave = async (config: ConfluenceConfig) => {
      const normalizedConfig = {
          ...config,
          attachmentFilename: getConfluenceAttachmentFilename(config.attachmentFilename)
      };
      setConfluenceConfig(normalizedConfig);
      const result = await window.ipcRenderer.invoke('save-confluence-config', normalizedConfig);
      if (!result?.success) {
          throw new Error(result?.error || 'Failed to save Confluence settings');
      }
  };

  const handlePublishToConfluence = async () => {
      if (!chartRef.current) return;

      if (!confluenceConfig.confluenceUrl || !confluenceConfig.personalAccessToken || !confluenceConfig.pageUrl) {
          setSnackbar({ message: 'Please fill Confluence settings before publishing.', color: 'red' });
          openConfluenceModal();
          return;
      }

      const parsedPageId = parseConfluencePageId(confluenceConfig.pageUrl);
      if (!parsedPageId) {
          setSnackbar({ message: 'Confluence page URL is missing a valid page ID.', color: 'red' });
          openConfluenceModal();
          return;
      }

      setPublishingConfluence(true);
      try {
          const filter = (node: HTMLElement) => {
              if (node.classList && node.classList.contains('no-capture')) {
                  return false;
              }
              return true;
          };

          const dataUrl = await toPng(chartRef.current, { cacheBust: true, backgroundColor: '#ffffff', filter });
          const publishResult = await window.ipcRenderer.invoke('publish-confluence', {
              config: {
                  ...confluenceConfig,
                  attachmentFilename: getConfluenceAttachmentFilename(confluenceConfig.attachmentFilename)
              },
              imageDataUrl: dataUrl,
              graphTitle,
              jql
          });

          if (!publishResult.success) {
              setSnackbar({ message: `Confluence publish failed: ${publishResult.error || 'Unknown error'}`, color: 'red' });
              return;
          }

          setSnackbar({ message: 'Published burnup chart to Confluence.', color: 'green' });
      } catch (e: any) {
          console.error('Failed publishing to Confluence', e);
          setSnackbar({ message: `Confluence publish failed: ${e?.message || 'Unknown error'}`, color: 'red' });
      } finally {
          setPublishingConfluence(false);
      }
  };

    const handleBulkPublishSequence = async (configPaths: string[]) => {
        closeBulkPublishModal();
        setLoadingConfig(true); 

        const initialJobs: BulkPublishJob[] = configPaths.map(path => ({
            path,
            filename: path.split(/[/\\]/).pop() || 'unknown',
            status: 'pending'
        }));
        setBulkJobs(initialJobs);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < configPaths.length; i++) {
            setBulkJobs(prev => prev.map((job, idx) => idx === i ? { ...job, status: 'active' } : job));
            try {
                const raw = await window.ipcRenderer.invoke('read-file-content', configPaths[i]);
                const config = JSON.parse(raw);

                if (config.jql) setJql(config.jql);
                if (config.dateRange) setDateRange([
                    config.dateRange[0] ? new Date(config.dateRange[0]) : null,
                    config.dateRange[1] ? new Date(config.dateRange[1]) : null
                ]);
                if (config.metric) setMetric(config.metric);
                if (config.statusConfigs) setStatusConfigs(config.statusConfigs);
                if (config.statusDisplayMode) setStatusDisplayMode(config.statusDisplayMode);
                if (config.graphTitle) setGraphTitle(config.graphTitle);
                if (config.graphType) setGraphType(config.graphType);
                if (config.forecastConfig) setForecastConfig(config.forecastConfig);

                const loadedCConfig = getLoadedConfluenceChartConfig(config.confluenceConfig);
                setConfluenceConfig(prev => ({
                    ...prev,
                    pageUrl: loadedCConfig.pageUrl,
                    attachmentFilename: loadedCConfig.attachmentFilename
                }));

                if (config.jql) {
                    await handleFetchData(config.jql);
                }

                if (!chartRef.current) throw new Error("Chart reference lost");

                // Wait until the Recharts ResponsiveContainer has physically rendered to a non-zero size
                for (let j = 0; j < 30; j++) {
                    const surface = chartRef.current.querySelector('.recharts-surface');
                    if (surface) {
                        const rect = surface.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            break;
                        }
                    }
                    await new Promise(r => setTimeout(r, 100));
                }

                // Add an additional small buffer to ensure DOM layout / repaints are fully settled
                await new Promise(r => setTimeout(r, 500));

                const latestConfluenceCreds = await window.ipcRenderer.invoke('get-confluence-config');
                const safeConfluenceURL = latestConfluenceCreds?.confluenceUrl || confluenceConfig.confluenceUrl;
                const safeToken = latestConfluenceCreds?.personalAccessToken || confluenceConfig.personalAccessToken;

                const filter = (node: HTMLElement) => {
                    const exclusionClasses = ['recharts-tooltip-wrapper', 'no-capture'];
                    return !exclusionClasses.some((classname) => node.classList?.contains(classname));
                };
                // wait another tick for dom repaints
                await new Promise(r => setTimeout(r, 500));

                const dataUrl = await toPng(chartRef.current, { cacheBust: true, backgroundColor: '#ffffff', filter });

                const publishResult = await window.ipcRenderer.invoke('publish-confluence', {
                    config: {
                        confluenceUrl: safeConfluenceURL,
                        personalAccessToken: safeToken,
                        pageUrl: loadedCConfig.pageUrl,
                        attachmentFilename: getConfluenceAttachmentFilename(loadedCConfig.attachmentFilename)
                    },
                    imageDataUrl: dataUrl,
                    graphTitle: config.graphTitle,
                    jql: config.jql
                });

                if (publishResult.success) {
                    successCount++;
                    setBulkJobs(prev => prev.map((job, idx) => idx === i ? { ...job, status: 'success' } : job));
                } else {
                    console.error("Bulk publish failed for", configPaths[i], publishResult.error);
                    failCount++;
                    setBulkJobs(prev => prev.map((job, idx) => idx === i ? { ...job, status: 'failed' } : job));
                }

            } catch (e: any) {
                console.error("Failed handling bulk config:", configPaths[i], e);
                failCount++;
                setBulkJobs(prev => prev.map((job, idx) => idx === i ? { ...job, status: 'failed' } : job));
            }
        }

        setLoadingConfig(false);
        setSnackbar({
            message: `Bulk Publish complete. ${successCount} succeeded, ${failCount} failed.`,
            color: failCount > 0 ? 'red' : 'green'
        });
        
        setTimeout(() => {
            setBulkJobs([]);
        }, 5000);
    };

    const handleDownload = useCallback(() => {
      if (!chartRef.current) return;

      const filter = (node: HTMLElement) => {
           // Exclude elements with class 'no-capture'
           if (node.classList && node.classList.contains('no-capture')) {
               return false;
           }
           return true;
      };

      toPng(chartRef.current, { cacheBust: true, backgroundColor: '#ffffff', filter })
          .then((dataUrl) => {
              const link = document.createElement('a');
              const now = new Date();
              const dateString = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
              const timeString = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '-'); // HH-MM-SS
              
              link.download = `${graphTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${dateString}_${timeString}.png`;
              link.href = dataUrl;
              link.click();
          })
          .catch((err) => {
              console.error("Failed to download chart image", err);
          });
  }, [graphTitle]);

  const metricLabel = METRICS.find(m => m.value === metric)?.label || metric;

  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
      layout="alt"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700}>Jira Burnup Chart</Text>
          <Group>
                        <Button leftSection={<IconSettings size={16} />} color="blue" onClick={openConfluenceModal}>Confluence</Button><Button leftSection={<IconStack2 size={16} />} color="blue" onClick={openBulkPublishModal}>Bulk Publish</Button><Button color="blue" loading={publishingConfluence} onClick={handlePublishToConfluence}>Publish</Button>
            <Button leftSection={<IconRefresh size={16} />} variant="default" color="red" onClick={resetConfiguration}>Reset</Button>
            <Button leftSection={<IconDeviceFloppy size={16} />} variant="default" onClick={saveConfiguration}>Save Config</Button>
            <Button leftSection={<IconFolderOpen size={16} />} variant="default" onClick={loadConfiguration}>Load Config</Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CredentialsModal opened={credentialsOpen} onClose={closeCredentials} canClose={true} />          <BulkPublishModal opened={bulkPublishModalOpen} onClose={closeBulkPublishModal} onPublish={handleBulkPublishSequence} />        <ConfluenceSettingsModal
            opened={confluenceModalOpen}
            onClose={closeConfluenceModal}
            config={confluenceConfig}
            onSave={handleConfluenceConfigSave}
        />
        <StatusManager 
            opened={statusManagerOpen}
            onClose={closeStatusManager}
            availableStatuses={availableStatuses}
            statusConfigs={statusConfigs}
            onConfigsChange={setStatusConfigs}
            displayMode={statusDisplayMode}
            onDisplayModeChange={setStatusDisplayMode}
        />
        <ForecastModal
            opened={forecastModalOpen}
            onClose={closeForecastModal}
            config={forecastConfig}
            onSave={setForecastConfig}
            key={forecastModalOpen ? 'open' : 'closed'}
        />
        <SimulationResultsModal 
            opened={simulationModalOpen} 
            onClose={closeSimulationModal} 
            results={forecastResult?.simulationResults}
            metricLabel={metricLabel || 'Items'}
            mcCycles={forecastConfig.mcCycles || 100000}
            onUpdateMcCycles={(cycles) => setForecastConfig(prev => ({ ...prev, mcCycles: cycles }))}
        />
        
        <Container fluid style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: 0 }}>
            <Stack gap="sm" style={{ flex: 1, height: '100%' }}>
                <Paper p="xs" withBorder shadow="sm">
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

                <Paper p="xs" withBorder shadow="sm">
                    <Group align="flex-end">
                         <DatePickerInput
                            type="range"
                            label="Date Range"
                            valueFormat="YYYY-MM-DD"
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
                        <Stack gap={0}>
                            <Text size="sm" fw={500} mb={3}>Graph Type</Text>
                            <SegmentedControl
                                value={graphType}
                                onChange={setGraphType}
                                data={[
                                    { label: 'Stacked Bar', value: 'bar' },
                                    { label: 'Stacked Area', value: 'area' },
                                ]}
                            />
                        </Stack>
                         <Stack gap={0}>
                                <Button 
                                    variant={forecastConfig.enabled ? "light" : "default"}
                                    onClick={openForecastModal}
                                    rightSection={<IconSettings size={14} />}
                                >
                                    Forecast
                                </Button>
                         </Stack>
                         <Stack gap={0}>
                            <Button 
                                variant="light" 
                                onClick={openStatusManager} 
                                rightSection={<IconSettings size={14} />}
                                disabled={issues.length === 0}
                            >
                                Statuses
                            </Button>
                         </Stack>
                    </Group>
                </Paper>


                <Paper ref={chartRef} p={0} withBorder shadow="sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                    {loadingConfig && (
                        <div                              className="no-capture"                            style={{
                                position: 'absolute',
                                inset: 0,
                                zIndex: 100,
                                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Loader size="lg" />
                        </div>
                    )}
                    
                    {/* Header: Download + Title */}
                    <div style={{ position: 'relative', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }}>
                        
                        <div className="no-capture" style={{ position: 'absolute', left: 10, top: 10, zIndex: 20, display: 'flex', gap: 5 }}>
                            <ActionIcon onClick={handleDownload} title="Download Chart Image" variant="subtle" color="gray" size="lg">
                                <IconDownload size={20} />
                            </ActionIcon>
                            {forecastConfig.enabled && forecastResult?.simulationResults && (
                                <ActionIcon onClick={openSimulationModal} title="Show Simulation Distribution" variant="subtle" color="gray" size="lg">
                                    <IconDice size={20} />
                                </ActionIcon>
                            )}
                        </div>


                        {/* Centered Title */}
                        <div style={{ zIndex: 10 }}>
                            {isEditingTitle ? (
                                <TextInput
                                    value={graphTitle}
                                    onChange={(e) => setGraphTitle(e.currentTarget.value)}
                                    onBlur={() => setIsEditingTitle(false)}
                                    // Submit on Enter
                                    onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTitle(false); }}
                                    autoFocus
                                    styles={{ input: { textAlign: 'center', fontWeight: 700, width: 300 } }}
                                />
                            ) : (
                                <Paper 
                                    withBorder 
                                    p="xs" 
                                    onClick={() => setIsEditingTitle(true)}
                                    style={{ cursor: 'text', minWidth: 200, display: 'flex', justifyContent: 'center', backgroundColor: 'transparent' }}
                                >
                                     <Text fw={700} size="md">{graphTitle}</Text>
                                </Paper>
                            )}
                        </div>

                        {/* Legend Placeholder */}
                         <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 10 }}>
                             {forecastText && (
                                <Text size="sm" fw={600} style={{ backgroundColor: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: 4, color: 'var(--mantine-color-dimmed)' }}>
                                    {forecastText}
                                </Text>
                             )}
                        </div>
                    </div>
                    
                    <div style={{ flex: 1, width: '100%', minHeight: 0, marginTop: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={chartData}
                                margin={{ top: 10, right: 46, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="date" 
                                    ticks={xAxisTicks}
                                    interval={0}
                                    minTickGap={30}
                                    tickMargin={8}
                                />
                                <YAxis 
                                    domain={[0, yAxisConfig.domainMax]}
                                    ticks={yAxisConfig.ticks}
                                    allowDataOverflow={true} 
                                >
                                    <Label value={metricLabel || ''} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                                </YAxis>
                                <Tooltip 
                                    cursor={{fill: 'transparent'}} 
                                    formatter={(value: any, name: any) => {
                                        if (typeof value === 'number') {
                                            // 2 Significant Figures logic:
                                            // If >= 100, round to integer? No, 123 -> 120.
                                            // User said: "Only use decimals if needed to show 2 significant figures"
                                            // Maybe they meant "2 decimal places"? No, "significant figures".
                                            // Let's try flexible formatting.
                                            // Case: 1234.5 -> 1200 (2 sig figs) is aggressive. 
                                            // Maybe they mean "Show 2 decimal places max, or 2 sig figs if small"?
                                            // "Only use decimals if needed to show 2 significant figures." implies:
                                            // 10 -> 10. (2 sig figs)
                                            // 1 -> 1.0? (2 sig figs)
                                            // 0.1 -> 0.10 (2 sig figs)
                                            // 100 -> 100 ? (1 sig fig? or 3?)
                                            // Let's stick to a cleaner heuristic:
                                            // If val >= 10, no decimals (integer). 
                                            // If val < 10, 1 decimal. 
                                            // If val < 1, 2 decimals.
                                            // Wait, "Only use decimals if needed to show 2 significant figures"
                                            // Example: 85 (2 sig figs, no decimals). OK.
                                            // Example: 5 (1 sig figs). To get 2: 5.0. 
                                            
                                            // Let's interpret "Reasonable number... Only use decimals if needed..." as:
                                            // Clean integers if large. Max 2 decimal places if small.
                                            return [
                                                value >= 10 ? Math.round(value) : parseFloat(value.toPrecision(2)),
                                                name
                                            ];
                                        }
                                        return [value, name];
                                    }}
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    align="right" 
                                    wrapperStyle={{ top: 0, right: 10, lineHeight: '30px' }} 
                                    payload={
                                        // Custom payload to exclude Forecast items or specific items
                                        // We want historical items normally.
                                        // Recharts doesn't make it easy to filter purely via prop.
                                        // If we don't provide payload, it generates one.
                                        // If we provide one, we must provide ALL.
                                        // Use `content` prop or `filter` logic? No, `payload` overrides everything.
                                        undefined // Revert to default, we handle hiding via 'legendType="none"' on Line
                                    }
                                />
                                
                                <defs>
                                    {/* Pattern or gradients if needed */}
                                </defs>

                                {/* Historical Data - Stacked */}
                                {activeDisplayConfigs.map((config) => {
                                    /* Use dynamic component based on graphType state */
                                    const TagName = (graphType === 'area' ? Area : Bar) as any;
                                    const props: any = {
                                        dataKey: config.name,
                                        stackId: "a",
                                        fill: config.color,
                                        stroke: config.color,
                                        name: config.name,
                                        type: "linear",
                                        isAnimationActive: bulkJobs.length === 0
                                    };
                                    if (graphType === 'area') {
                                        props.dot = false;
                                    }
                                    return <TagName key={config.name} {...props} />;
                                })}
                                
                                {/* Fallback when issues not loaded yet */}
                                {statusConfigs.length === 0 && availableStatuses.map((status, index) => {
                                     const TagName = (graphType === 'area' ? Area : Bar) as any;
                                     return (
                                        <TagName 
                                            key={status} 
                                            dataKey={status} 
                                            stackId="a" 
                                            fill={`hsl(${index * 40}, 70%, 50%)`} 
                                            stroke={`hsl(${index * 40}, 70%, 50%)`}
                                            type="linear"
                                            isAnimationActive={bulkJobs.length === 0}
                                        />
                                     );
                                })}

                                {/* Forecast Lines */}
                                {forecastConfig.enabled && (
                                    <>
                                        {/* Linear Forecast */}
                                        <Line 
                                            type="linear" 
                                            dataKey="Forecast" 
                                            stroke={forecastColor} 
                                            strokeDasharray="5 5" 
                                            dot={false}
                                            activeDot={{ r: 8 }} 
                                            name="Projected Completion"
                                            strokeWidth={2}
                                            isAnimationActive={false}
                                            connectNulls={true}
                                            legendType="none"
                                        />
                                        
                                        {/* Total Scope Line */}
                                        <Line 
                                            type="linear"
                                            dataKey="TotalScopeProjected"
                                            stroke={statusConfigs.find(s => s.category === 'not-started')?.color || '#888'}
                                            strokeDasharray="3 3"
                                            dot={false}
                                            name="Total Scope"
                                            strokeWidth={2}
                                            isAnimationActive={false}
                                            connectNulls={true}
                                            legendType="none"
                                        />
                                        
                                        {/* Confidence Intervals */}
                                        {forecastConfig.showConfidence && (
                                            <>
                                                <Line 
                                                    type="linear" 
                                                    dataKey="ConfidenceHigh" 
                                                    stroke={forecastColor} 
                                                    strokeDasharray="2 2" 
                                                    dot={false} 
                                                    strokeOpacity={0.5}
                                                    name="95% High"
                                                    isAnimationActive={false}
                                                    connectNulls={true}
                                                    legendType="none"
                                                />
                                                <Line 
                                                    type="linear" 
                                                    dataKey="ConfidenceLow" 
                                                    stroke={forecastColor} 
                                                    strokeDasharray="2 2" 
                                                    dot={false} 
                                                    strokeOpacity={0.5}
                                                    name="95% Low"
                                                    isAnimationActive={false}
                                                    connectNulls={true}
                                                    legendType="none"
                                                />
                                            </>
                                        )}
                                    </>
                                )}

                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </Paper>
            </Stack>
        </Container>
                {snackbar && (
                        <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000 }}>
                                <Notification
                                        color={snackbar.color}
                                        icon={snackbar.color === 'green' ? <IconCheck size={18} /> : <IconX size={18} />}
                                        onClose={() => setSnackbar(null)}
                                >
                                        {snackbar.message}
                                </Notification>
                        </div>
                )}

                {bulkJobs.length > 0 && (
                    <Paper
                        withBorder
                        shadow="xl"
                        p="md"
                        style={{
                            position: 'fixed',
                            bottom: 24,
                            right: 24,
                            zIndex: 2000,
                            width: 350,
                            maxHeight: 400,
                            overflowY: 'auto'
                        }}
                    >
                        <Text fw={600} mb="sm">Bulk Publish Progress</Text>
                        <Stack gap="xs">
                            {bulkJobs.map((job, idx) => (
                                <Group key={idx} justify="space-between" wrap="nowrap">
                                    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                        {job.status === 'pending' && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dee2e6', marginLeft: 4, marginRight: 4 }} />}
                                        {job.status === 'active' && <Loader size={16} />}
                                        {job.status === 'success' && <IconCheck color="green" size={16} />}
                                        {job.status === 'failed' && <IconX color="red" size={16} />}
                                        <Text size="sm" truncate>{job.filename}</Text>
                                    </Group>
                                    <Text size="xs" c="dimmed" tt="capitalize">{job.status}</Text>
                                </Group>
                            ))}
                        </Stack>
                    </Paper>
                )}
      </AppShell.Main>
    </AppShell>
  );
}

