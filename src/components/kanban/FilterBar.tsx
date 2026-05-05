import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { Stage } from "@/hooks/useStages";
import type { WorkspaceMember } from "@/hooks/useWorkspaceMembers";

const UNASSIGNED = "__unassigned__";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  stages: Stage[];
  selectedStages: string[];
  onStagesChange: (v: string[]) => void;
  members: WorkspaceMember[];
  selectedOwners: string[];
  onOwnersChange: (v: string[]) => void;
  onClear: () => void;
  hasFilters: boolean;
};

export function FilterBar({
  search,
  onSearchChange,
  stages,
  selectedStages,
  onStagesChange,
  members,
  selectedOwners,
  onOwnersChange,
  onClear,
  hasFilters,
}: Props) {
  const [local, setLocal] = useState(search);
  useEffect(() => setLocal(search), [search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== search) onSearchChange(local);
    }, 300);
    return () => clearTimeout(t);
  }, [local, search, onSearchChange]);

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Buscar por nome ou empresa..."
          className="pl-8"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Etapas
            {selectedStages.length > 0 && (
              <Badge variant="secondary" className="ml-1">{selectedStages.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <div className="space-y-1 max-h-64 overflow-auto">
            {stages.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                <Checkbox
                  checked={selectedStages.includes(s.id)}
                  onCheckedChange={() => onStagesChange(toggle(selectedStages, s.id))}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Responsável
            {selectedOwners.length > 0 && (
              <Badge variant="secondary" className="ml-1">{selectedOwners.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="space-y-1 max-h-64 overflow-auto">
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
              <Checkbox
                checked={selectedOwners.includes(UNASSIGNED)}
                onCheckedChange={() => onOwnersChange(toggle(selectedOwners, UNASSIGNED))}
              />
              <span>Sem responsável</span>
            </label>
            {members.map((m) => (
              <label key={m.user_id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                <Checkbox
                  checked={selectedOwners.includes(m.user_id)}
                  onCheckedChange={() => onOwnersChange(toggle(selectedOwners, m.user_id))}
                />
                <span className="truncate">{m.full_name || m.email}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
          <X className="h-4 w-4" /> Limpar filtros
        </Button>
      )}
    </div>
  );
}
