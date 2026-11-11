// 文件格式图标：形状表达类型，颜色跟随主题。
// 不使用文件类型品牌色，避免侧栏与标签栏出现和主题强调色互相冲突的彩色噪点。

import type { CSSProperties, ReactNode } from 'react';
import {
  FileText,
  File,
  Database,
  Braces,
  FileCode,
  CodeXml,
  PencilRuler,
  FileQuestion,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Film,
  AppWindow,
  Shapes,
  SlidersHorizontal,
  Terminal,
  Table,
  Archive,
  Music,
  Video,
  Network,
  Workflow,
  GitMerge,
  Layout,
  ChartColumn,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { extFromPath } from '../../core/docKind';

export interface FileIconOptions {
  size?: number;
  isDir?: boolean;
  isOpen?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 文件夹用主题强调色作为唯一色相，文件统一继承所在行的文本色。 */
const FOLDER_COLOR = 'var(--editor-accent)';

function iconForExtension(ext: string): LucideIcon {
  switch (ext) {
    case 'doc':
    case 'docx':
    case 'pdf':
    case 'dwg':
    case 'dxf':
      return FileText;
    case 'epub':
    case 'note':
    case 'goodnotes':
      return BookOpen;
    case 'xls':
    case 'xlsx':
      return Table;
    case 'ppt':
    case 'pptx':
      return Layout;
    case 'md':
    case 'markdown':
      return FileText;
    case 'mindmap':
    case 'xmind':
    case 'mm':
      return Network;
    case 'drawio':
    case 'dio':
      return Layout;
    case 'bitable':
    case 'table':
      return Table;
    case 'mmd':
    case 'mermaid':
      return Workflow;
    case 'infographic':
    case 'ig':
      return ChartColumn;
    case 'puml':
    case 'plantuml':
    case 'iuml':
    case 'uml':
      return GitMerge;
    case 'board':
    case 'canvas':
    case 'excalidraw':
      return PencilRuler;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'jpe':
    case 'jfif':
    case 'bmp':
    case 'dib':
    case 'avif':
    case 'webp':
      return ImageIcon;
    case 'gif':
    case 'apng':
      return Film;
    case 'ico':
    case 'cur':
      return AppWindow;
    case 'svg':
      return Shapes;
    case 'sql':
    case 'sqlite':
    case 'db':
      return Database;
    case 'json':
    case 'jsonc':
    case 'json5':
      return Braces;
    case 'yaml':
    case 'yml':
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'ts':
    case 'mts':
    case 'cts':
    case 'jsx':
    case 'tsx':
    case 'rs':
    case 'py':
    case 'pyw':
    case 'go':
    case 'java':
    case 'kt':
    case 'c':
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'h':
    case 'hpp':
      return FileCode;
    case 'xml':
    case 'xsd':
    case 'rss':
    case 'atom':
    case 'html':
    case 'htm':
      return CodeXml;
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'bat':
    case 'cmd':
    case 'ps1':
      return Terminal;
    case 'csv':
    case 'tsv':
      return Table;
    case 'ini':
    case 'conf':
    case 'cfg':
    case 'env':
    case 'properties':
    case 'toml':
      return SlidersHorizontal;
    case 'txt':
    case 'log':
    case 'text':
      return FileText;
    case 'zip':
    case 'tar':
    case 'gz':
    case '7z':
    case 'rar':
      return Archive;
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'aac':
    case 'ogg':
      return Music;
    case 'mp4':
    case 'mkv':
    case 'avi':
    case 'mov':
    case 'webm':
      return Video;
    default:
      return ext ? FileQuestion : File;
  }
}

/** 根据文件路径与状态获取文件/文件夹图标。 */
export function getExplorerFileIcon(
  fileNameOrPath: string,
  options: FileIconOptions = {},
): ReactNode {
  const { size = 14, isDir = false, isOpen = false, className, style } = options;
  const iconProps = {
    size,
    className,
    color: 'currentColor',
    style: { flexShrink: 0, ...style },
  };

  if (isDir) {
    const FolderIcon = isOpen ? FolderOpen : Folder;
    return (
      <FolderIcon
        {...iconProps}
        color={FOLDER_COLOR}
        fill={FOLDER_COLOR}
        fillOpacity={0.16}
      />
    );
  }

  const Icon = iconForExtension(extFromPath(fileNameOrPath));
  return <Icon {...iconProps} />;
}
