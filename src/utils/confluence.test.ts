import { describe, expect, it } from 'vitest';
import { getConfluenceAttachmentFilename, getLoadedConfluenceChartConfig, parseConfluencePageId } from './confluence';

describe('parseConfluencePageId', () => {
    it('extracts page id from viewpage URL query parameter', () => {
        expect(parseConfluencePageId('https://confluence.example.com/pages/viewpage.action?pageId=123456')).toBe('123456');
    });

    it('extracts page id from /pages/{id} style URL', () => {
        expect(parseConfluencePageId('https://confluence.example.com/spaces/ENG/pages/98765/Burnup')).toBe('98765');
    });

    it('returns null when no page id exists', () => {
        expect(parseConfluencePageId('https://confluence.example.com/spaces/ENG/pages/Burnup')).toBeNull();
    });
});

describe('getConfluenceAttachmentFilename', () => {
    it('uses fallback when filename is empty', () => {
        expect(getConfluenceAttachmentFilename('')).toBe('jira-burnup-latest.png');
    });

    it('uses provided filename when available', () => {
        expect(getConfluenceAttachmentFilename('weekly-burnup.png')).toBe('weekly-burnup.png');
    });
});

describe('getLoadedConfluenceChartConfig', () => {
    it('clears page URL when config does not include one', () => {
        expect(getLoadedConfluenceChartConfig(undefined).pageUrl).toBe('');
        expect(getLoadedConfluenceChartConfig({ attachmentFilename: 'x.png' }).pageUrl).toBe('');
    });

    it('uses fallback attachment filename when missing', () => {
        expect(getLoadedConfluenceChartConfig({ pageUrl: 'https://example/page' }).attachmentFilename).toBe('jira-burnup-latest.png');
    });
});
