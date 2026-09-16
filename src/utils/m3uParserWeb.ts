import { Channel } from '../types';

/**
 * Web implementation of the Java M3UParser logic.
 * Parses M3U and M3U8 string content extracted from file or URL.
 */
export function parseM3U(content: string): { channels: Channel[]; groups: string[] } {
  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];
  const groupsSet = new Set<string>();

  const tvgIdRegex = /tvg-id="([^"]*)"/i;
  const tvgNameRegex = /tvg-name="([^"]*)"/i;
  const tvgLogoRegex = /tvg-logo="([^"]*)"/i;
  const groupTitleRegex = /group-title="([^"]*)"/i;
  const userAgentRegex = /http-user-agent="([^"]*)"/i;

  let currentExtInf: string | null = null;
  let currentUserAgent: string | null = null;
  let counter = 1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentExtInf = line;
    } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
      currentUserAgent = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();
    } else if (!line.startsWith('#')) {
      // Line is stream URL
      if (currentExtInf) {
        const tvgIdMatch = currentExtInf.match(tvgIdRegex);
        const tvgNameMatch = currentExtInf.match(tvgNameRegex);
        const tvgLogoMatch = currentExtInf.match(tvgLogoRegex);
        const groupTitleMatch = currentExtInf.match(groupTitleRegex);
        const userAgentMatch = currentExtInf.match(userAgentRegex);

        const tvgId = tvgIdMatch ? tvgIdMatch[1] : undefined;
        const tvgName = tvgNameMatch ? tvgNameMatch[1] : undefined;
        const tvgLogo = tvgLogoMatch ? tvgLogoMatch[1] : undefined;
        const groupTitle = groupTitleMatch ? groupTitleMatch[1].trim() : 'Geral';
        const userAgent = userAgentMatch ? userAgentMatch[1] : (currentUserAgent || undefined);

        let channelName = `Canal ${counter}`;
        const commaIdx = currentExtInf.lastIndexOf(',');
        if (commaIdx !== -1 && commaIdx < currentExtInf.length - 1) {
          channelName = currentExtInf.substring(commaIdx + 1).trim() || channelName;
        } else if (tvgName) {
          channelName = tvgName;
        }

        const channel: Channel = {
          id: tvgId || `ch_${counter}`,
          name: channelName,
          streamUrl: line,
          logoUrl: tvgLogo,
          groupTitle: groupTitle || 'Geral',
          tvgId,
          tvgName,
          userAgent,
          isFavorite: false
        };

        channels.push(channel);
        groupsSet.add(channel.groupTitle || 'Geral');
        counter++;

        currentExtInf = null;
        currentUserAgent = null;
      } else if (line.startsWith('http://') || line.startsWith('https://')) {
        const channel: Channel = {
          id: `ch_${counter}`,
          name: `Stream ${counter}`,
          streamUrl: line,
          groupTitle: 'Geral',
          isFavorite: false
        };
        channels.push(channel);
        groupsSet.add('Geral');
        counter++;
      }
    }
  }

  const groups = Array.from(groupsSet).sort();
  return { channels, groups };
}
