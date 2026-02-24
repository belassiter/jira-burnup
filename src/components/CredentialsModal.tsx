import { Modal, TextInput, PasswordInput, Button, Group, Stack, Alert, Text } from '@mantine/core';
import { useState } from 'react';

interface CredentialsModalProps {
    opened: boolean;
    onClose: () => void;
}

export function CredentialsModal({ opened, onClose }: CredentialsModalProps) {
    const [host, setHost] = useState('');
    const [email, setEmail] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        
        try {
            // Simple validation
            if (!host || !apiToken) {
                setError("Host and API Token are required.");
                setSaving(false);
                return;
            }

            // Save credentials via Electron IPC
            const result = await window.ipcRenderer.invoke('save-credentials', { host, email, apiToken });
            
            if (result) {
                onClose();
            } else {
                setError("Failed to save credentials");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal 
            opened={opened} 
            onClose={onClose} 
            title="Setup Jira Access" 
            withCloseButton={false} 
            closeOnClickOutside={false}
            closeOnEscape={false}
        >
            <form onSubmit={handleSubmit}>
                <Stack>
                    <Text size="sm" c="dimmed">
                        Enter your Jira credentials.
                    </Text>
                    
                    {error && <Alert color="red" variant="light">{error}</Alert>}
                    
                    <TextInput 
                        label="Jira Host" 
                        placeholder="jira.company.com" 
                        value={host}
                        onChange={(event) => setHost(event.currentTarget.value)}
                        required
                    />

                    <TextInput 
                        label="Email (Optional for PAT)" 
                        placeholder="you@company.com" 
                        value={email}
                        onChange={(event) => setEmail(event.currentTarget.value)}
                    />
                    
                    <PasswordInput 
                        label="API Token / Password" 
                        placeholder="Paste token here" 
                        value={apiToken}
                        onChange={(event) => setApiToken(event.currentTarget.value)}
                        required
                    />
                    
                    <Group justify="flex-end" mt="md">
                        <Button type="submit" loading={saving}>Save Credentials</Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}
