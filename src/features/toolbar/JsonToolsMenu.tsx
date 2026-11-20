// JSON 工具菜单：展开格式化、单行压缩与格式校验
// 从 CodeToolbar 拆出，避免工具栏继续膨胀。

import { Braces, CheckCircle2, Maximize2, Minimize2 } from 'lucide-react';
import {
  ToolbarButton,
  ToolbarDropdown,
  ToolbarDropdownItem,
} from './ToolbarComponents';

type Scope = 'all' | 'selection';

interface JsonToolsMenuProps {
  compact: boolean;
  isJson: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpand: (scope: Scope, tabSize?: number) => void;
  onMinify: (scope: Scope) => void;
  onValidate: (scope: Scope) => void;
}

export function JsonToolsMenu({
  compact,
  isJson,
  open,
  onOpenChange,
  onExpand,
  onMinify,
  onValidate,
}: JsonToolsMenuProps) {
  return (
    <ToolbarDropdown
      isOpen={open}
      onOpenChange={onOpenChange}
      trigger={
        <ToolbarButton
          icon={<Braces size={15} />}
          label={compact ? undefined : 'JSON 工具'}
          hasDropdown
          title="JSON 展开格式化、单行压缩与格式校验"
          active={isJson}
        />
      }
    >
      <ToolbarDropdownItem
        icon={<Maximize2 size={14} color="var(--nb-blue-500)" />}
        label="JSON 展开 / 格式化"
        submenu={
          <>
            <ToolbarDropdownItem
              label="格式化全文 (2 空格缩进)"
              shortcut="Shift+Alt+F"
              onClick={() => onExpand('all', 2)}
            />
            <ToolbarDropdownItem
              label="格式化全文 (4 空格缩进)"
              onClick={() => onExpand('all', 4)}
            />
            <ToolbarDropdownItem
              label="格式化选中文本"
              onClick={() => onExpand('selection')}
            />
          </>
        }
      />

      <ToolbarDropdownItem
        icon={<Minimize2 size={14} color="var(--nb-purple-500)" />}
        label="JSON 压缩 (Minify)"
        submenu={
          <>
            <ToolbarDropdownItem
              label="压缩全文为单行"
              shortcut="Shift+Alt+M"
              onClick={() => onMinify('all')}
            />
            <ToolbarDropdownItem
              label="压缩选中文本"
              onClick={() => onMinify('selection')}
            />
          </>
        }
      />

      <ToolbarDropdownItem
        icon={<CheckCircle2 size={14} color="var(--nb-emerald-500)" />}
        label="JSON 格式校验"
        submenu={
          <>
            <ToolbarDropdownItem
              label="校验全文语法"
              shortcut="Shift+Alt+V"
              onClick={() => onValidate('all')}
            />
            <ToolbarDropdownItem
              label="校验选中文本"
              onClick={() => onValidate('selection')}
            />
          </>
        }
      />
    </ToolbarDropdown>
  );
}
