import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { ConfluenceConfig } from '../types';
import { getConfluenceAttachmentFilename } from '../utils/confluence';

interface ConfluenceSettingsModalProps {
    opened: boolean;
    config: ConfluenceConfig;
    onClose: () => void;
    onSave: (config: ConfluenceConfig) => Promise<void>;
}

export function ConfluenceSettingsModal({ opened, config, onClose, onSave }: ConfluenceSettingsModalProps) {
    const [draft, setDraft] = useState<ConfluenceConfig>(config);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sanitizeText = (value: string): string => {
        // Remove control chars that can appear when pasting from some password managers/remote sessions.
        return Array.from(value)
            .filter((ch) => {
                const code = ch.charCodeAt(0);
                return code >= 32 && code !== 127;
            })
            .join('');
    };

    const handlePaste = (field: keyof ConfluenceConfig) => (event: React.ClipboardEvent<HTMLInputElement>) => {
        event.preventDefault();
        const pasted = sanitizeText(event.clipboardData.getData('text'));
        setDraft(prev => ({ ...prev, [field]: pasted }));
    };

    const handleChange = (field: keyof ConfluenceConfig) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const val = sanitizeText(event.currentTarget.value);
        setDraft(prev => ({ ...prev, [field]: val }));
    };

    useEffect(() => {
        if (opened) {
            setDraft({
                ...config,
                attachmentFilename: getConfluenceAttachmentFilename(config.attachmentFilename)
            });
            setError(null);
        }
    }, [opened, config]);

    const handleClose = async () => {
        setSaving(true);
        setError(null);
        try {
            await onSave({
                ...draft,
                attachmentFilename: getConfluenceAttachmentFilename(draft.attachmentFilename)
            });
            onClose();
        } catch (e: any) {
            setError(e?.message || 'Failed to save Confluence settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title="Confluence Publishing Settings"
            closeOnClickOutside={false}
            closeOnEscape={false}
        >
            <Stack>
                <Text size="sm" c="dimmed">
                    Enter Confluence settings used by Publish.
                </Text>

                {error && <Alert color="red" variant="light">{error}</Alert>}

                <TextInput
                    label="Confluence URL"
                    placeholder="https://confluence.company.com"
                    value={draft.confluenceUrl}
                    onChange={handleChange('confluenceUrl')}
                    onPaste={handlePaste('confluenceUrl')}
                />

                <PasswordInput
                    label="Personal Access Token"
                    placeholder="Paste token here"
                    value={draft.personalAccessToken}
                    onChange={handleChange('personalAccessToken')}
                    onPaste={handlePaste('personalAccessToken')}
                />

                <TextInput
                    label="Page URL"
                    placeholder="https://confluence.company.com/pages/viewpage.action?pageId=123456"
                    value={draft.pageUrl}
                    onChange={handleChange('pageUrl')}
                    onPaste={handlePaste('pageUrl')}
                />

                <TextInput
                    label="Attachment filename"
                    placeholder="jira-burnup-latest.png"
                    value={draft.attachmentFilename}
                    onChange={handleChange('attachmentFilename')}
                    onPaste={handlePaste('attachmentFilename')}
                />

                <Group justify="flex-end" mt="sm">
                    <Button variant="default" onClick={handleClose} loading={saving}>Close</Button>
                </Group>
            </Stack>
        </Modal>
    );
}
