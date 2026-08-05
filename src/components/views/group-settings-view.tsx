'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Copy,
  Check,
  Pencil,
  X,
  LogOut,
  Trash2,
  MoreHorizontal,
  Music,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore, useDataStore, useNavigationStore } from '@/lib/store';

// ---------- types ----------
interface Member {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: string;
  instrument?: string;
  joinedAt: string;
}

// ---------- role helpers ----------
const roleBadgeColors: Record<string, string> = {
  owner: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
  producer: 'bg-[#8A2BE2]/15 text-[#8A2BE2] border-[#8A2BE2]/30',
  musician: 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/30',
  guest: 'bg-[#6B7280]/15 text-[#6B7280] border-[#6B7280]/30',
};

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  producer: 'Producer',
  musician: 'Musician',
  guest: 'Guest',
};

const roleOptions = ['owner', 'producer', 'musician', 'guest'];

// ---------- animation variants ----------
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

// ---------- component ----------
export function GroupSettingsView() {
  const user = useAuthStore((s) => s.user);
  const currentGroupId = useAuthStore((s) => s.currentGroupId);
  const currentGroup = useDataStore((s) => s.currentGroup);
  const navigate = useNavigationStore((s) => s.navigate);
  const logout = useAuthStore((s) => s.logout);

  const isOwner = currentGroup?.ownerId === user?.id;

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  // Edit group dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGenre, setEditGenre] = useState('');

  // Copy invite code state
  const [copied, setCopied] = useState(false);

  // Remove member alert dialog
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  // Leave group alert dialog
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  // Delete group alert dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!currentGroupId) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/groups/${currentGroupId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? data);
      }
    } catch {
      // silently fail for MVP
    } finally {
      setMembersLoading(false);
    }
  }, [currentGroupId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Copy invite code
  const handleCopyCode = () => {
    if (currentGroup?.inviteCode) {
      navigator.clipboard.writeText(currentGroup.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Open edit dialog
  const handleOpenEdit = () => {
    setEditName(currentGroup?.name ?? '');
    setEditDescription(currentGroup?.description ?? '');
    setEditGenre(currentGroup?.genre ?? '');
    setEditDialogOpen(true);
  };

  // Save edit (cosmetic for MVP)
  const handleSaveEdit = () => {
    // In a full implementation, this would call PATCH /api/groups/{groupId}
    setEditDialogOpen(false);
  };

  // Role change (cosmic for MVP — just updates local state for UI)
  const handleRoleChange = (memberId: string, newRole: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
  };

  // Leave group
  const handleLeaveGroup = () => {
    // In full implementation, call DELETE /api/groups/{groupId}/members/me
    setLeaveDialogOpen(false);
    logout();
    navigate('onboarding');
  };

  // Delete group
  const handleDeleteGroup = () => {
    // In full implementation, call DELETE /api/groups/{groupId}
    setDeleteDialogOpen(false);
    logout();
    navigate('onboarding');
  };

  // Remove member
  const handleRemoveMember = () => {
    if (!removeTarget) return;
    // In full implementation, call DELETE /api/groups/{groupId}/members/{memberId}
    setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id));
    setRemoveTarget(null);
  };

  // Avatar fallback
  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl space-y-8 p-6 lg:p-8">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
            Group Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your band profile and members
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* ===================== BAND CARD SECTION ===================== */}
          <motion.div variants={itemVariants}>
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#8A2BE2]" />
                    <CardTitle className="text-lg text-foreground">Band Card</CardTitle>
                  </div>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-[#1E1E28]"
                          onClick={handleOpenEdit}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="left"
                        className="bg-card border-border text-foreground"
                      >
                        Edit band info
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <Separator className="bg-border" />
              <CardContent className="pt-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                  {/* Avatar */}
                  <div className="flex items-center justify-center sm:justify-start">
                    {currentGroup?.avatarUrl ? (
                      <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                        <AvatarImage
                          src={currentGroup.avatarUrl}
                          alt={currentGroup.name}
                        />
                        <AvatarFallback className="bg-[#8A2BE2]/15 text-[#8A2BE2] text-2xl">
                          {getInitial(currentGroup.name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                        <AvatarFallback className="bg-[#8A2BE2]/15 text-[#8A2BE2] text-2xl">
                          {currentGroup?.name
                            ? getInitial(currentGroup.name)
                            : '?'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <h2 className="text-xl font-bold text-foreground truncate">
                        {currentGroup?.name || 'Unnamed Band'}
                      </h2>
                      {currentGroup?.genre && (
                        <Badge
                          variant="outline"
                          className="mt-1.5 text-[10px] uppercase tracking-wide border-[#00E5FF]/30 text-[#00E5FF]"
                        >
                          {currentGroup.genre}
                        </Badge>
                      )}
                    </div>

                    {currentGroup?.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {currentGroup.description}
                      </p>
                    )}

                    {/* Invite code */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Invite code:</span>
                      <code className="rounded bg-background px-2 py-0.5 text-xs text-[#00E5FF] font-mono">
                        {currentGroup?.inviteCode || '——'}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-[#1E1E28]"
                        onClick={handleCopyCode}
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-[#10B981]" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ===================== MEMBERS SECTION ===================== */}
          <motion.div variants={itemVariants}>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Members
              </h2>
              <Badge
                variant="outline"
                className="border-border text-muted-foreground text-xs"
              >
                {members.length}
              </Badge>
            </div>

            <Card className="border-border bg-card">
              {membersLoading ? (
                <CardContent className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                    <span className="text-sm">Loading members…</span>
                  </div>
                </CardContent>
              ) : members.length === 0 ? (
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No members found
                  </p>
                </CardContent>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {members.map((member, idx) => (
                    <div key={member.id}>
                      {idx > 0 && <Separator className="bg-border" />}
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#1E1E28]/40 transition-colors">
                        {/* Avatar */}
                        <Avatar className="h-9 w-9">
                          {member.avatarUrl ? (
                            <AvatarImage
                              src={member.avatarUrl}
                              alt={member.displayName}
                            />
                          ) : null}
                          <AvatarFallback className="bg-muted text-xs font-medium">
                            {getInitial(member.displayName)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Name & details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {member.displayName}
                            </span>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] uppercase tracking-wide ${
                                roleBadgeColors[member.role] ??
                                'border-border text-muted-foreground'
                              }`}
                            >
                              {roleLabels[member.role] ?? member.role}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            {member.instrument && (
                              <span className="flex items-center gap-1">
                                <Music className="h-3 w-3" />
                                {member.instrument}
                              </span>
                            )}
                            <span>Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}</span>
                          </div>
                        </div>

                        {/* Owner controls */}
                        {isOwner && member.id !== user?.id && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Select
                              value={member.role}
                              onValueChange={(val) =>
                                handleRoleChange(member.id, val)
                              }
                            >
                              <SelectTrigger className="h-7 w-[110px] text-[11px] border-border bg-transparent">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {roleOptions.map((role) => (
                                  <SelectItem
                                    key={role}
                                    value={role}
                                    className="text-xs"
                                  >
                                    {roleLabels[role]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                    onClick={() => setRemoveTarget(member)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="left"
                                  className="bg-card border-border text-foreground"
                                >
                                  Remove member
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* ===================== DANGER ZONE ===================== */}
          <motion.div variants={itemVariants}>
            <Card className="border-red-500/20 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-red-400">
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <Separator className="bg-red-500/20" />
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Leave Group
                    </p>
                    <p className="text-xs text-muted-foreground">
                      You will lose access to all group content.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50 transition-colors"
                    onClick={() => setLeaveDialogOpen(true)}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave
                  </Button>
                </div>

                {isOwner && (
                  <>
                    <Separator className="bg-red-500/10" />
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          Delete Group
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Permanently delete this group and all its data. This
                          action cannot be undone.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50 transition-colors"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* ===================== EDIT GROUP DIALOG ===================== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Band Info</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update your band&apos;s profile details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-foreground text-sm">
                Band Name
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="border-border bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="edit-genre"
                className="text-foreground text-sm"
              >
                Genre
              </Label>
              <Input
                id="edit-genre"
                value={editGenre}
                onChange={(e) => setEditGenre(e.target.value)}
                placeholder="e.g. Rock, Jazz, Electronic"
                className="border-border bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="edit-description"
                className="text-foreground text-sm"
              >
                Description
              </Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="A short bio for your band"
                className="border-border bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#8A2BE2] hover:bg-[#8A2BE2]/80 text-white"
              onClick={handleSaveEdit}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== REMOVE MEMBER ALERT ===================== */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Remove Member
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to remove{' '}
              <span className="font-medium text-foreground">
                {removeTarget?.displayName}
              </span>{' '}
              from the group? They will lose access to all group content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleRemoveMember}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===================== LEAVE GROUP ALERT ===================== */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Leave Group
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to leave{' '}
              <span className="font-medium text-foreground">
                {currentGroup?.name}
              </span>
              ? You will lose access to all projects, ideas, and tracks in this
              group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleLeaveGroup}
            >
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===================== DELETE GROUP ALERT ===================== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">
              Delete Group
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete{' '}
              <span className="font-medium text-foreground">
                {currentGroup?.name}
              </span>{' '}
              and all of its data including projects, ideas, tracks, and comments.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteGroup}
            >
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
