import { Modal, TextInput, PasswordInput, Button, Group, Stack, Alert, Text } from '@mantine/core';
import { useState } from 'react';

interface CredentialsModalProps {
    opened: boolean;
    onClose: () => void;
    canClose: boolean; // If false, hide close button and prevent closing without success
}

export function CredentialsModal({ opened, onClose, canClose }: CredentialsModalProps) {
    const [host, setHost] = useState('');
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
                setError("All fields are required.");
                setSaving(false);
                return;
            }

            // @ts-ignore
            const result = await window.ipcRenderer.invoke('save-credentials', { host, apiToken });
            
            if (result.success) {
                onClose();
            } else {
                setError(result.error || "Failed to save credentials");
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
            onClose={() => canClose && onClose()} 
            title="Setup Jira Access" 
            withCloseButton={canClose} 
            closeOnClickOutside={canClose}
            closeOnEscape={canClose}
        >
            <form onSubmit={handleSubmit}>
                <Stack>
                    <Text size="sm" c="dimmed">
                        Enter your Jira Datacenter credentials.
                    </Text>
                    
                    {error && <Alert color="red" variant="light">{error}</Alert>}
                    
                    <TextInput 
                        label="Jira Host" 
                        placeholder="jira.companyname.com:8443" 
                        value={host}
                        onChange={(event) => setHost(event.currentTarget.value)}
                        required
                    />
                    
                    <PasswordInput 
                        label="Personal Access Token" 
                        placeholder="Paste token here" 
                        value={apiToken}
                        onChange={(event) => setApiToken(event.currentTarget.value)}
                        required
                    />
                    
                    <Group justify="flex-end" mt="md">
                        {canClose && <Button variant="default" onClick={onClose}>Cancel</Button>}
                        <Button type="submit" loading={saving}>Save Credentials</Button>
                    </Group>

                    <Text size="xs" mt="md">
                        <b>How to get your Jira access token (Jira Datacenter):</b><br/>
                        1. Go to Jira<br/>
                        2. In the upper-right, click on your user icon --&gt; Profile<br/>
                        3. Personal Access Token --&gt; Create token<br/>
                        4. Give the token any name, like "for Cycle Time app". Expiry date is optional<br/>
                        5. Click "Create"<br/>
                        6. Copy and paste the code it gives to into this app
                    </Text>
                </Stack>
            </form>
        </Modal>
    );
}
