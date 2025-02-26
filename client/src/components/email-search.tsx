import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmailSearchProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  folder: string;
  onFolderChange: (value: string) => void;
}

export default function EmailSearch({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  folder,
  onFolderChange
}: EmailSearchProps) {
  return (
    <div className="flex gap-4 mb-6">
      <Input
        placeholder="Search emails..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1"
      />

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="INTERESTED">Interested</SelectItem>
          <SelectItem value="MEETING_BOOKED">Meeting Booked</SelectItem>
          <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
          <SelectItem value="SPAM">Spam</SelectItem>
          <SelectItem value="OUT_OF_OFFICE">Out of Office</SelectItem>
        </SelectContent>
      </Select>

      <Select value={folder} onValueChange={onFolderChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Folder" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Folders</SelectItem>
          <SelectItem value="INBOX">Inbox</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}