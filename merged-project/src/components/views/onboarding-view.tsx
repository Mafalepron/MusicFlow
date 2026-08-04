'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Users, UserPlus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore, useNavigationStore, useDataStore } from '@/lib/store';

type Step = 'auth' | 'group';

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'producer', label: 'Producer' },
  { value: 'musician', label: 'Musician' },
  { value: 'guest', label: 'Guest' },
];

export function OnboardingView() {
  const { setUser, setCurrentGroupId, setCurrentGroupName, setCurrentGroupInviteCode, setMemberInfo } = useAuthStore();
  const { navigate } = useNavigationStore();
  const { setCurrentGroup } = useDataStore();
  const [step, setStep] = useState<Step>('auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupGenre, setGroupGenre] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedRole, setSelectedRole] = useState('owner');
  const [instrument, setInstrument] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword || !regName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail.trim(), password: regPassword, displayName: regName.trim() }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Registration failed'); }
      const { user } = await res.json();
      setUser(user);
      setStep('group');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Login failed'); }
      const { user, groupId, memberInfo: mi, group } = await res.json();
      setUser(user);
      if (groupId && group) {
        setCurrentGroupId(groupId);
        setCurrentGroupName(group.name);
        setCurrentGroupInviteCode(group.inviteCode);
        setMemberInfo(mi);
        setCurrentGroup(group);
        navigate('home');
      } else { setStep('group'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setLoading(false); }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not authenticated');
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim() || undefined,
          genre: groupGenre.trim() || undefined,
          userId: user.id,
          role: selectedRole,
          instrument: instrument.trim() || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to create group'); }
      const { group, memberInfo: mi } = await res.json();
      setCurrentGroupId(group.id);
      setCurrentGroupName(group.name);
      setCurrentGroupInviteCode(group.inviteCode);
      setMemberInfo(mi);
      setCurrentGroup(group);
      navigate('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setLoading(false); }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not authenticated');
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inviteCode.trim(),
          userId: user.id,
          role: selectedRole,
          instrument: instrument.trim() || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to join group'); }
      const { group, memberInfo: mi } = await res.json();
      setCurrentGroupId(group.id);
      setCurrentGroupName(group.name);
      setCurrentGroupInviteCode(group.inviteCode);
      setMemberInfo(mi);
      setCurrentGroup(group);
      navigate('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setLoading(false); }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-[#00E5FF]/8 blur-[100px]" />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 glow-purple">
              <Music className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">SoundFlow</h1>
            <p className="text-sm text-muted-foreground">Collaborate on music, together</p>
          </div>

          {step === 'auth' && (
            <Card className="bg-card border-border rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-foreground">Get Started</CardTitle>
                <CardDescription className="text-muted-foreground">Sign in or create an account</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="w-full bg-[#1E1E28]">
                    <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Login</TabsTrigger>
                    <TabsTrigger value="register" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Register</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <Input id="login-email" type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="bg-input border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-pass">Password</Label>
                        <Input id="login-pass" type="password" placeholder="Enter password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="bg-input border-border" />
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        {loading ? 'Signing in...' : 'Sign In'} <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </form>
                  </TabsContent>
                  <TabsContent value="register">
                    <form onSubmit={handleRegister} className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-name">Display Name</Label>
                        <Input id="reg-name" placeholder="Your name" value={regName} onChange={(e) => setRegName(e.target.value)} required className="bg-input border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Email</Label>
                        <Input id="reg-email" type="email" placeholder="you@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required className="bg-input border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-pass">Password</Label>
                        <Input id="reg-pass" type="password" placeholder="Create password (min 6 chars)" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} className="bg-input border-border" />
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        {loading ? 'Creating account...' : 'Create Account'} <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {step === 'group' && (
            <Card className="bg-card border-border rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-foreground">Create or Join a Group</CardTitle>
                <CardDescription className="text-muted-foreground">Set up your collaboration space</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="create" className="w-full">
                  <TabsList className="w-full bg-[#1E1E28]">
                    <TabsTrigger value="create" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Users className="mr-1.5 h-3.5 w-3.5" />Create</TabsTrigger>
                    <TabsTrigger value="join" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><UserPlus className="mr-1.5 h-3.5 w-3.5" />Join</TabsTrigger>
                  </TabsList>
                  <TabsContent value="create">
                    <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="grp-name">Group Name</Label>
                        <Input id="grp-name" placeholder="Band or group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} required className="bg-input border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="grp-desc">Description</Label>
                        <Input id="grp-desc" placeholder="What are you working on?" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} className="bg-input border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="grp-genre">Genre</Label>
                        <Input id="grp-genre" placeholder="e.g. Electronic, Rock" value={groupGenre} onChange={(e) => setGroupGenre(e.target.value)} className="bg-input border-border" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Your Role</Label>
                          <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {ROLES.map((r) => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Instrument</Label>
                          <Input
                            placeholder="e.g. Guitar, Vocals"
                            value={instrument}
                            onChange={(e) => setInstrument(e.target.value)}
                            className="bg-input border-border"
                          />
                        </div>
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        {loading ? 'Creating...' : 'Create Group'} <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </form>
                  </TabsContent>
                  <TabsContent value="join">
                    <form onSubmit={handleJoinGroup} className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="invite-code">Invite Code</Label>
                        <Input id="invite-code" placeholder="Enter invite code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required className="bg-input border-border font-mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Your Role</Label>
                          <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {ROLES.filter((r) => r.value !== 'owner').map((r) => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Instrument</Label>
                          <Input
                            placeholder="e.g. Guitar, Vocals"
                            value={instrument}
                            onChange={(e) => setInstrument(e.target.value)}
                            className="bg-input border-border"
                          />
                        </div>
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        {loading ? 'Joining...' : 'Join Group'} <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
