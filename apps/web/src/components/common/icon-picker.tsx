'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  LayoutDashboard,
  User,
  Settings,
  Building2,
  Briefcase,
  Shield,
  Menu as MenuIcon,
  BookOpen,
  Folder,
  FileText,
  MousePointer,
  Home,
  Users,
  Key,
  Lock,
  Unlock,
  Bell,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Clock,
  Map,
  MapPin,
  Globe,
  Compass,
  Star,
  Heart,
  Bookmark,
  Flag,
  Tag,
  Archive,
  Database,
  Server,
  Monitor,
  Smartphone,
  Laptop,
  Wifi,
  Bluetooth,
  Cpu,
  HardDrive,
  MemoryStick,
  Printer,
  Camera,
  Image,
  Video,
  Music,
  Headphones,
  Mic,
  Volume2,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Repeat,
  Shuffle,
  Download,
  Upload,
  Share,
  Link,
  ExternalLink,
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Save,
  FolderOpen,
  File,
  FilePlus,
  FileText as FileTextIcon,
  FileCheck,
  FileX,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  AlertCircle,
  Info,
  HelpCircle,
  CheckCircle,
  XCircle,
  PlusCircle,
  MinusCircle,
  Edit,
  Edit2,
  Edit3,
  PenTool,
  Type,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Quote,
  Code,
  Terminal,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Github,
  Gitlab,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 常用图标列表
const ICON_LIST: { name: string; icon: LucideIcon }[] = [
  { name: 'LayoutDashboard', icon: LayoutDashboard },
  { name: 'Home', icon: Home },
  { name: 'User', icon: User },
  { name: 'Users', icon: Users },
  { name: 'Settings', icon: Settings },
  { name: 'Building2', icon: Building2 },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Shield', icon: Shield },
  { name: 'ShieldCheck', icon: ShieldCheck },
  { name: 'ShieldAlert', icon: ShieldAlert },
  { name: 'ShieldX', icon: ShieldX },
  { name: 'Key', icon: Key },
  { name: 'Lock', icon: Lock },
  { name: 'Unlock', icon: Unlock },
  { name: 'Menu', icon: MenuIcon },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Folder', icon: Folder },
  { name: 'FolderOpen', icon: FolderOpen },
  { name: 'File', icon: File },
  { name: 'FileText', icon: FileText },
  { name: 'FilePlus', icon: FilePlus },
  { name: 'FileCheck', icon: FileCheck },
  { name: 'FileX', icon: FileX },
  { name: 'MousePointer', icon: MousePointer },
  { name: 'Bell', icon: Bell },
  { name: 'Mail', icon: Mail },
  { name: 'MessageSquare', icon: MessageSquare },
  { name: 'Phone', icon: Phone },
  { name: 'Calendar', icon: Calendar },
  { name: 'Clock', icon: Clock },
  { name: 'Map', icon: Map },
  { name: 'MapPin', icon: MapPin },
  { name: 'Globe', icon: Globe },
  { name: 'Compass', icon: Compass },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'Flag', icon: Flag },
  { name: 'Tag', icon: Tag },
  { name: 'Archive', icon: Archive },
  { name: 'Database', icon: Database },
  { name: 'Server', icon: Server },
  { name: 'Monitor', icon: Monitor },
  { name: 'Smartphone', icon: Smartphone },
  { name: 'Laptop', icon: Laptop },
  { name: 'Wifi', icon: Wifi },
  { name: 'Cpu', icon: Cpu },
  { name: 'HardDrive', icon: HardDrive },
  { name: 'Printer', icon: Printer },
  { name: 'Camera', icon: Camera },
  { name: 'Image', icon: Image },
  { name: 'Video', icon: Video },
  { name: 'Music', icon: Music },
  { name: 'Headphones', icon: Headphones },
  { name: 'Mic', icon: Mic },
  { name: 'Volume2', icon: Volume2 },
  { name: 'Play', icon: Play },
  { name: 'Pause', icon: Pause },
  { name: 'Download', icon: Download },
  { name: 'Upload', icon: Upload },
  { name: 'Share', icon: Share },
  { name: 'Link', icon: Link },
  { name: 'ExternalLink', icon: ExternalLink },
  { name: 'Copy', icon: Copy },
  { name: 'Trash2', icon: Trash2 },
  { name: 'Save', icon: Save },
  { name: 'Search', icon: Search },
  { name: 'Filter', icon: Filter },
  { name: 'RefreshCw', icon: RefreshCw },
  { name: 'Eye', icon: Eye },
  { name: 'EyeOff', icon: EyeOff },
  { name: 'AlertTriangle', icon: AlertTriangle },
  { name: 'AlertCircle', icon: AlertCircle },
  { name: 'Info', icon: Info },
  { name: 'HelpCircle', icon: HelpCircle },
  { name: 'CheckCircle', icon: CheckCircle },
  { name: 'XCircle', icon: XCircle },
  { name: 'PlusCircle', icon: PlusCircle },
  { name: 'Edit', icon: Edit },
  { name: 'Edit2', icon: Edit2 },
  { name: 'Edit3', icon: Edit3 },
  { name: 'Code', icon: Code },
  { name: 'Terminal', icon: Terminal },
  { name: 'GitBranch', icon: GitBranch },
  { name: 'GitCommit', icon: GitCommit },
  { name: 'GitMerge', icon: GitMerge },
  { name: 'GitPullRequest', icon: GitPullRequest },
];

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = ICON_LIST.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const SelectedIcon = ICON_LIST.find((item) => item.name === value)?.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          {SelectedIcon ? (
            <SelectedIcon className="h-4 w-4" />
          ) : (
            <span className="h-4 w-4" />
          )}
          <span className="flex-1 text-left">{value || '选择图标'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <Input
            placeholder="搜索图标..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="grid grid-cols-8 gap-1 p-2 max-h-60 overflow-y-auto">
          {filteredIcons.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => {
                  onChange(item.name);
                  setOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'flex items-center justify-center rounded-md p-2 hover:bg-accent transition-colors',
                  value === item.name && 'bg-primary text-primary-foreground',
                )}
                title={item.name}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
          {filteredIcons.length === 0 && (
            <div className="col-span-8 py-4 text-center text-sm text-muted-foreground">
              未找到图标
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
