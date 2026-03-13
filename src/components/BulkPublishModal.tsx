import { useState } from 'react';
import { ActionIcon, Alert, Button, Group, Modal, Stack, Text, ScrollArea, Title, Tooltip } from '@mantine/core';
import { IconPlus, IconX, IconDeviceFloppy, IconFolderOpen, IconTrash } from '@tabler/icons-react';

interface BulkPublishModalProps {
    opened: boolean;
    onClose: () => void;
    onPublish: (configs: string[]) => void;
}

export function BulkPublishModal({ opened, onClose, onPublish }: BulkPublishModalProps) {
    const [configs, setConfigs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleAddConfig = async () => {
        setError(null);
        try {
            const result = await window.ipcRenderer.invoke('show-open-dialog', {
                title: 'Select Jira Burnup Config',
                properties: ['openFile'],
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
                const newPath = result.filePaths[0];
                if (!configs.includes(newPath)) {
                    setConfigs(prev => [...prev, newPath]);
                }
            }
        } catch (e: any) {
            setError('Failed to pick file: ' + e.message);
        }
    };

    const handleRemoveConfig = (index: number) => {
        setConfigs(prev => prev.filter((_, i) => i !== index));
    };

    const handleReset = () => {
        setConfigs([]);
        setError(null);
    };

    const handleSaveBulkConfig = async () => {
        setError(null);
        try {
            const result = await window.ipcRenderer.invoke('show-save-dialog', {
                title: 'Save Bulk Publish Config',
                defaultPath: 'jira-burnup-bulk-publish-config.json',
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (!result.canceled && result.filePath) {
                await window.ipcRenderer.invoke('write-file-content', result.filePath, JSON.stringify({ configs }, null, 2));
            }
        } catch (e: any) {
            setError('Failed to save bulk config: ' + e.message);
        }
    };

    const handleLoadBulkConfig = async () => {
        setError(null);
        try {
            const result = await window.ipcRenderer.invoke('show-open-dialog', {
                title: 'Load Bulk Publish Config',
                properties: ['openFile'],
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
                const content = await window.ipcRenderer.invoke('read-file-content', result.filePaths[0]);
                const parsed = JSON.parse(content);
                if (parsed.configs && Array.isArray(parsed.configs)) {
                    setConfigs(parsed.configs);
                } else {
                    setError('Invalid bulk config file format.');
                }
            }
        } catch (e: any) {
            setError('Failed to load bulk config: ' + e.message);
        }
    };

    const handleBulkPublish = () => {
        if (configs.length === 0) {
            setError('Please add at least one configuration file.');
            return;
        }
        setError(null);
        onPublish(configs);
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Bulk Publish"
            size="lg"
            keepMounted={true}
        >
            <Stack>
                {error && <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
                
                <Group justify="space-between">
                    <Group>
                        <Button leftSection={<IconDeviceFloppy size={16} />} variant="default" onClick={handleSaveBulkConfig}>Save Bulk Config</Button>
                        <Button leftSection={<IconFolderOpen size={16} />} variant="default" onClick={handleLoadBulkConfig}>Load Bulk Config</Button>
                    </Group>
                    <Button color="blue" onClick={handleBulkPublish} disabled={configs.length === 0}>
                        Bulk Publish
                    </Button>
                </Group>

                <Group justify="space-between" align="center" mt="md">
                    <Title order={5}>Configurations</Title>
                    <Group>
                        <Button leftSection={<IconTrash size={16} />} variant="subtle" color="red" size="sm" onClick={handleReset} disabled={configs.length === 0}>Reset</Button>
                        <Button leftSection={<IconPlus size={16} />} variant="light" size="sm" onClick={handleAddConfig}>Add Config</Button>
                    </Group>
                </Group>

                <ScrollArea h={300} type="always" offsetScrollbars>
                    <Stack gap="xs">
                        {configs.length === 0 ? (
                            <Text c="dimmed" size="sm" ta="center" mt="xl">No configurations added. Click + to add one.</Text>
                        ) : (
                            configs.map((path, idx) => (
                                <Group key={idx} justify="space-between" wrap="nowrap" style={{ border: '1px solid #eee', padding: '8px', borderRadius: '4px' }}>
                                    <Tooltip label={path} position="top-start" withArrow>
                                        <Text size="sm" truncate style={{ flex: 1, cursor: 'pointer' }}>{path.split(/[/\\]/).pop()}</Text>
                                    </Tooltip>
                                    <ActionIcon color="red" variant="subtle" onClick={() => handleRemoveConfig(idx)}>
                                        <IconX size={16} />
                                    </ActionIcon>
                                </Group>
                            ))
                        )}
                    </Stack>
                </ScrollArea>
                
                <Group justify="flex-end" mt="sm">
                    <Button variant="default" onClick={onClose}>Close</Button>
                </Group>
            </Stack>
        </Modal>
    );
}
