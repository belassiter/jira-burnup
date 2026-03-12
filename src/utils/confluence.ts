export function parseConfluencePageId(pageUrl: string): string | null {
    const trimmed = pageUrl.trim();
    if (!trimmed) return null;

    const pageIdParamMatch = trimmed.match(/[?&]pageId=(\d+)/i);
    if (pageIdParamMatch) return pageIdParamMatch[1];

    const pagesPathMatch = trimmed.match(/\/pages\/(\d+)(?:[/?#]|$)/i);
    if (pagesPathMatch) return pagesPathMatch[1];

    const displayPathMatch = trimmed.match(/\/display\/[^/]+\/(\d+)(?:[/?#]|$)/i);
    if (displayPathMatch) return displayPathMatch[1];

    return null;
}

export function getConfluenceAttachmentFilename(filename: string | undefined): string {
    const fallback = 'jira-burnup-latest.png';
    const trimmed = (filename || '').trim();
    return trimmed || fallback;
}

export function getLoadedConfluenceChartConfig(config: { pageUrl?: string; attachmentFilename?: string } | undefined): { pageUrl: string; attachmentFilename: string } {
    return {
        pageUrl: config?.pageUrl || '',
        attachmentFilename: getConfluenceAttachmentFilename(config?.attachmentFilename)
    };
}
