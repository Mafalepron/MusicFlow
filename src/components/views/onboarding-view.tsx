'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Users, UserPlus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore, useNavigationStore, useDataStore } from '@/lib/store';

/* ─── palette (Cyberpunk 2077 HUD — matches home-view.tsx) ─── */
const Y = '#c7a008';   // industrial desaturated gold
const Y2 = '#9e7c06';  // darker gold
const C = '#00a8c6';   // controlled cyan
const P = '#7b2cbf';   // deep violet
const G = '#4a8d6f';   // muted green
const A = '#718096';   // muted grey
const BG_MAIN = '#0a0c10';
const BG_PANEL = '#11141d';
const BG_CARD_PURPLE = '#161224';
const BG_CARD_TEAL = '#0e1a24';
const BORDER_MUTED = '#1f2633';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_SECONDARY = '#718096';

/* ─── clipPath chamfers ─── */
// 4px symmetric 8-point chamfer (for inputs / buttons / tabs)
const CHAMFER_4 = 'polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 calc(100% - 4px), 0 4px)';
// 12px asymmetric chamfer: top-left, top-right, bottom-right chamfered (Cyberpunk 2077 HUD card shape)
const CHAMFER_12 = 'polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)';

type Step = 'auth' | 'group';

const ROLES = [
  { value: 'owner', label: 'Владелец' },
  { value: 'producer', label: 'Продюсер' },
  { value: 'musician', label: 'Музыкант' },
  { value: 'guest', label: 'Гость' },
];

/* ─── HUD panel wrapper — chamfered cyan border + corner brackets ─── */
function HudPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #11141d 0%, #0c0e16 100%)',
      border: '1px solid rgba(0,168,198,0.4)',
      clipPath: CHAMFER_12,
      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.06), inset 0 -1px 1px rgba(0,0,0,0.8), 0 0 14px rgba(0,168,198,0.10)',
    }}>
      {/* Blue corner bracket (top-left) */}
      <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none" style={{
        borderTop: '1.5px solid rgba(0,168,198,0.6)',
        borderLeft: '1.5px solid rgba(0,168,198,0.6)',
      }} />
      {/* Yellow corner bracket (bottom-right) */}
      <div className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none" style={{
        borderBottom: '1.5px solid rgba(199,160,8,0.6)',
        borderRight: '1.5px solid rgba(199,160,8,0.6)',
      }} />
      {children}
    </div>
  );
}

/* ─── HUD submit button — yellow gradient with chamfer + glow + hover scale ─── */
function HudButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <Button
      type="submit"
      variant="ghost"
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="w-full h-11 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] outline-none focus-visible:ring-0 focus-visible:outline-none"
      style={{
        background: disabled
          ? 'linear-gradient(135deg, #5a4a08, #3e3205)'
          : `linear-gradient(135deg, ${h ? '#dcb009' : Y} 0%, ${h ? '#b88a06' : Y2} 100%)`,
        color: BG_MAIN,
        clipPath: CHAMFER_4,
        fontFamily: 'var(--font-rajdhani), sans-serif',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textShadow: '0 1px 0 rgba(255,255,255,0.18)',
        boxShadow: disabled
          ? 'inset 0 1px 0 rgba(255,255,255,0.08)'
          : h
            ? 'inset 0 1px 0 rgba(255,255,255,0.3), 0 0 16px rgba(199,160,8,0.55), 0 0 4px rgba(199,160,8,0.6)'
            : 'inset 0 1px 0 rgba(255,255,255,0.2), 0 0 10px rgba(199,160,8,0.35)',
        transform: h && !disabled ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span className="inline-flex items-center gap-2">
        {children}
      </span>
    </Button>
  );
}

/* ─── HUD label — uppercase yellow JetBrains Mono ─── */
function HudLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-[10px] font-bold uppercase tracking-[0.18em] block"
      style={{
        color: Y,
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        textShadow: '0 0 4px rgba(199,160,8,0.2)',
        letterSpacing: '0.18em',
      }}
    >
      {children}
    </Label>
  );
}

/* ─── HUD input — dark bg, cyan border, chamfered, focus yellow glow ─── */
const HudInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <Input
      {...props}
      className={`w-full h-10 px-3 text-sm outline-none transition-all
        bg-[#0a0c10] text-[#e2e8f0] placeholder:text-[#4a5568] placeholder:font-normal
        border border-[rgba(0,168,198,0.3)] rounded-none
        hover:border-[rgba(0,168,198,0.55)]
        focus:border-[#c7a008] focus-visible:border-[#c7a008]
        focus:shadow-[0_0_10px_rgba(199,160,8,0.4)] focus-visible:shadow-[0_0_10px_rgba(199,160,8,0.4)]
        focus-visible:ring-0 focus-visible:outline-none`}
      style={{
        clipPath: CHAMFER_4,
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        letterSpacing: '0.04em',
        ...(props.style || {}),
      }}
    />
  );
};
HudInput.displayName = 'HudInput';

/* ─── HUD error — red chamfered monospace container ─── */
function HudError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 text-xs" style={{
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.4)',
      color: '#ef4444',
      fontFamily: 'var(--font-jetbrains-mono), monospace',
      clipPath: CHAMFER_4,
      letterSpacing: '0.04em',
      boxShadow: '0 0 8px rgba(239,68,68,0.15)',
    }}>
      <span className="font-bold leading-relaxed">!</span>
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}

/* ─── HUD tab trigger — yellow gradient when active, transparent + yellow text when inactive ─── */
function HudTabTrigger({
  value,
  active,
  children,
  icon,
}: {
  value: string;
  active: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="flex-1 h-8 px-2 text-xs font-bold uppercase tracking-[0.16em] transition-all duration-200 outline-none focus-visible:ring-0 focus-visible:outline-none border border-transparent rounded-none"
      style={active ? {
        background: 'linear-gradient(135deg, #c7a008 0%, #9e7c06 100%)',
        color: BG_MAIN,
        clipPath: CHAMFER_4,
        fontFamily: 'var(--font-rajdhani), sans-serif',
        fontWeight: 700,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 10px rgba(199,160,8,0.45)',
        textShadow: '0 1px 0 rgba(255,255,255,0.15)',
      } : {
        background: 'transparent',
        color: Y,
        clipPath: CHAMFER_4,
        fontFamily: 'var(--font-rajdhani), sans-serif',
        fontWeight: 700,
        textShadow: '0 0 6px rgba(199,160,8,0.25)',
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        {icon}
        {children}
      </span>
    </TabsTrigger>
  );
}

export function OnboardingView() {
  const { setUser, setCurrentGroupId, setCurrentGroupName, setCurrentGroupInviteCode, setMemberInfo } = useAuthStore();
  const { navigate } = useNavigationStore();
  const { setCurrentGroup } = useDataStore();
  const [step, setStep] = useState<Step>('auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [groupTab, setGroupTab] = useState<'create' | 'join'>('create');

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
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Регистрация не удалась'); }
      const { user } = await res.json();
      setUser(user);
      setStep('group');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
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
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Вход не удался'); }
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
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally { setLoading(false); }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Не авторизован');
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
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Не удалось создать группу'); }
      const { group, memberInfo: mi } = await res.json();
      setCurrentGroupId(group.id);
      setCurrentGroupName(group.name);
      setCurrentGroupInviteCode(group.inviteCode);
      setMemberInfo(mi);
      setCurrentGroup(group);
      navigate('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally { setLoading(false); }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Не авторизован');
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
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Не удалось присоединиться к группе'); }
      const { group, memberInfo: mi } = await res.json();
      setCurrentGroupId(group.id);
      setCurrentGroupName(group.name);
      setCurrentGroupInviteCode(group.inviteCode);
      setMemberInfo(mi);
      setCurrentGroup(group);
      navigate('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally { setLoading(false); }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background: BG_MAIN,
        backgroundImage: `
          radial-gradient(ellipse 70% 50% at 50% 0%, rgba(123,44,191,0.10) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 90% 100%, rgba(0,168,198,0.08) 0%, transparent 55%),
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 20px 20px, 20px 20px',
      }}
    >
      {/* Faint ambient glows for depth */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-[100px]" style={{ background: 'rgba(123,44,191,0.18)' }} />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full blur-[100px]" style={{ background: 'rgba(0,168,198,0.16)' }} />
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
          {/* ── Logo area — holographic double-ring with pulsing glow ── */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="relative flex h-14 w-14 items-center justify-center">
              {/* Outer ring — cyan with glow, breathing animation */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '1.5px solid #00a8c6',
                  boxShadow: '0 0 10px rgba(0,168,198,0.35), inset 0 0 6px rgba(0,168,198,0.15)',
                  animation: 'kb-breathe 3.4s ease-in-out infinite',
                }}
              />
              {/* Inner ring — purple with glow, breathing animation (slight offset) */}
              <div
                className="absolute inset-[4px] rounded-full"
                style={{
                  border: '1px solid #7b2cbf',
                  boxShadow: '0 0 6px rgba(123,44,191,0.35), inset 0 0 4px rgba(123,44,191,0.15)',
                  animation: 'kb-breathe 3.4s ease-in-out infinite',
                  animationDelay: '0.6s',
                }}
              />
              {/* Center music icon — yellow with drop-shadow */}
              <Music
                className="h-6 w-6 relative"
                style={{
                  color: Y,
                  filter: 'drop-shadow(0 0 4px rgba(199,160,8,0.55))',
                }}
              />
            </div>
            <h1
              className="text-2xl font-bold"
              style={{
                color: Y,
                fontFamily: 'var(--font-rajdhani), sans-serif',
                letterSpacing: '0.06em',
                textShadow: '0 0 10px rgba(199,160,8,0.35), 0 0 4px rgba(199,160,8,0.25)',
              }}
            >
              SoundFlow
            </h1>
            <p
              className="text-sm"
              style={{
                color: TEXT_SECONDARY,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                letterSpacing: '0.10em',
              }}
            >
              Сотрудничай над музыкой вместе
            </p>
          </div>

          {/* ── AUTH STEP ── */}
          {step === 'auth' && (
            <HudPanel>
              {/* Top accent strip */}
              <div className="h-[2px] w-full" style={{
                background: 'linear-gradient(90deg, transparent, rgba(0,168,198,0.7) 20%, rgba(0,168,198,0.7) 80%, transparent)',
                boxShadow: '0 0 6px rgba(0,168,198,0.25)',
              }} />

              <div className="px-6 pt-6 pb-6">
                {/* Card title */}
                <div className="mb-5">
                  <h2
                    className="text-base font-bold uppercase"
                    style={{
                      color: TEXT_PRIMARY,
                      fontFamily: 'var(--font-rajdhani), sans-serif',
                      fontWeight: 700,
                      letterSpacing: '2px',
                      textShadow: '0 0 8px rgba(0,168,198,0.2)',
                    }}
                  >
                    ДОСТУП К СИСТЕМЕ
                  </h2>
                  <p
                    className="mt-1 text-xs"
                    style={{
                      color: TEXT_SECONDARY,
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Войдите или создайте аккаунт
                  </p>
                </div>

                <Tabs
                  value={authTab}
                  onValueChange={(v) => setAuthTab(v as 'login' | 'register')}
                  className="w-full"
                >
                  <TabsList
                    className="w-full h-10 p-1 bg-[#0a0c10] border rounded-none"
                    style={{
                      border: '1px solid rgba(0,168,198,0.3)',
                      clipPath: CHAMFER_4,
                    }}
                  >
                    <HudTabTrigger value="login" active={authTab === 'login'}>ВХОД</HudTabTrigger>
                    <HudTabTrigger value="register" active={authTab === 'register'}>РЕГИСТРАЦИЯ</HudTabTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-4">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-1.5">
                        <HudLabel htmlFor="login-email">Почта</HudLabel>
                        <HudInput
                          id="login-email"
                          type="email"
                          placeholder="ваш@email.ru"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <HudLabel htmlFor="login-pass">Пароль</HudLabel>
                        <HudInput
                          id="login-pass"
                          type="password"
                          placeholder="Введите пароль"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                      </div>
                      {error && <HudError message={error} />}
                      <HudButton disabled={loading}>
                        {loading ? 'Вход...' : 'ВОЙТИ'}
                        {!loading && <ArrowRight className="h-4 w-4" />}
                      </HudButton>
                    </form>
                  </TabsContent>

                  <TabsContent value="register" className="mt-4">
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="space-y-1.5">
                        <HudLabel htmlFor="reg-name">Имя</HudLabel>
                        <HudInput
                          id="reg-name"
                          placeholder="Ваше имя"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <HudLabel htmlFor="reg-email">Почта</HudLabel>
                        <HudInput
                          id="reg-email"
                          type="email"
                          placeholder="ваш@email.ru"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <HudLabel htmlFor="reg-pass">Пароль</HudLabel>
                        <HudInput
                          id="reg-pass"
                          type="password"
                          placeholder="Создайте пароль (мин 6 символов)"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                      </div>
                      {error && <HudError message={error} />}
                      <HudButton disabled={loading}>
                        {loading ? 'Создание...' : 'СОЗДАТЬ АККАУНТ'}
                        {!loading && <ArrowRight className="h-4 w-4" />}
                      </HudButton>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>
            </HudPanel>
          )}

          {/* ── GROUP STEP ── */}
          {step === 'group' && (
            <HudPanel>
              {/* Top accent strip — yellow for group step */}
              <div className="h-[2px] w-full" style={{
                background: 'linear-gradient(90deg, transparent, rgba(199,160,8,0.7) 20%, rgba(199,160,8,0.7) 80%, transparent)',
                boxShadow: '0 0 6px rgba(199,160,8,0.25)',
              }} />

              <div className="px-6 pt-6 pb-6">
                {/* Card title */}
                <div className="mb-5">
                  <h2
                    className="text-base font-bold uppercase"
                    style={{
                      color: TEXT_PRIMARY,
                      fontFamily: 'var(--font-rajdhani), sans-serif',
                      fontWeight: 700,
                      letterSpacing: '2px',
                      textShadow: '0 0 8px rgba(199,160,8,0.2)',
                    }}
                  >
                    СОЗДАТЬ ИЛИ ПРИСОЕДИНИТЬСЯ
                  </h2>
                  <p
                    className="mt-1 text-xs"
                    style={{
                      color: TEXT_SECONDARY,
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Настройте пространство для сотрудничества
                  </p>
                </div>

                <Tabs
                  value={groupTab}
                  onValueChange={(v) => setGroupTab(v as 'create' | 'join')}
                  className="w-full"
                >
                  <TabsList
                    className="w-full h-10 p-1 bg-[#0a0c10] border rounded-none"
                    style={{
                      border: '1px solid rgba(0,168,198,0.3)',
                      clipPath: CHAMFER_4,
                    }}
                  >
                    <HudTabTrigger
                      value="create"
                      active={groupTab === 'create'}
                      icon={<Users className="h-3.5 w-3.5" />}
                    >
                      СОЗДАТЬ
                    </HudTabTrigger>
                    <HudTabTrigger
                      value="join"
                      active={groupTab === 'join'}
                      icon={<UserPlus className="h-3.5 w-3.5" />}
                    >
                      ПРИСОЕДИНИТЬСЯ
                    </HudTabTrigger>
                  </TabsList>

                  <TabsContent value="create" className="mt-4">
                    <form onSubmit={handleCreateGroup} className="space-y-4">
                      <div className="space-y-1.5">
                        <HudLabel htmlFor="grp-name">Название группы</HudLabel>
                        <HudInput
                          id="grp-name"
                          placeholder="Название бэнда или группы"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <HudLabel htmlFor="grp-desc">Описание</HudLabel>
                        <HudInput
                          id="grp-desc"
                          placeholder="Над чем вы работаете?"
                          value={groupDesc}
                          onChange={(e) => setGroupDesc(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <HudLabel htmlFor="grp-genre">Жанр</HudLabel>
                        <HudInput
                          id="grp-genre"
                          placeholder="напр. Электроника, Рок"
                          value={groupGenre}
                          onChange={(e) => setGroupGenre(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <HudLabel>Ваша роль</HudLabel>
                          <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger
                              className="w-full h-10 px-3 text-sm rounded-none bg-[#0a0c10] text-[#e2e8f0] border-[rgba(0,168,198,0.3)] hover:border-[#c7a008] focus:border-[#c7a008] focus-visible:ring-0 focus-visible:outline-none data-[placeholder]:text-[#718096]"
                              style={{
                                clipPath: CHAMFER_4,
                                fontFamily: 'var(--font-jetbrains-mono), monospace',
                                letterSpacing: '0.04em',
                              }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent
                              className="bg-[#0a0c10] border-[rgba(0,168,198,0.4)] text-[#e2e8f0] rounded-none"
                              style={{
                                clipPath: CHAMFER_4,
                              }}
                            >
                              {ROLES.map((r) => (
                                <SelectItem
                                  key={r.value}
                                  value={r.value}
                                  className="text-[#e2e8f0] focus:bg-[rgba(199,160,8,0.15)] focus:text-[#c7a008] data-[state=checked]:text-[#c7a008]"
                                  style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', letterSpacing: '0.04em' }}
                                >
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <HudLabel>Инструмент</HudLabel>
                          <HudInput
                            placeholder="напр. Гитара, Вокал"
                            value={instrument}
                            onChange={(e) => setInstrument(e.target.value)}
                          />
                        </div>
                      </div>
                      {error && <HudError message={error} />}
                      <HudButton disabled={loading}>
                        {loading ? 'Создание...' : 'СОЗДАТЬ ГРУППУ'}
                        {!loading && <ArrowRight className="h-4 w-4" />}
                      </HudButton>
                    </form>
                  </TabsContent>

                  <TabsContent value="join" className="mt-4">
                    <form onSubmit={handleJoinGroup} className="space-y-4">
                      <div className="space-y-1.5">
                        <HudLabel htmlFor="invite-code">Код приглашения</HudLabel>
                        <HudInput
                          id="invite-code"
                          placeholder="Введите код приглашения"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <HudLabel>Ваша роль</HudLabel>
                          <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger
                              className="w-full h-10 px-3 text-sm rounded-none bg-[#0a0c10] text-[#e2e8f0] border-[rgba(0,168,198,0.3)] hover:border-[#c7a008] focus:border-[#c7a008] focus-visible:ring-0 focus-visible:outline-none data-[placeholder]:text-[#718096]"
                              style={{
                                clipPath: CHAMFER_4,
                                fontFamily: 'var(--font-jetbrains-mono), monospace',
                                letterSpacing: '0.04em',
                              }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent
                              className="bg-[#0a0c10] border-[rgba(0,168,198,0.4)] text-[#e2e8f0] rounded-none"
                              style={{
                                clipPath: CHAMFER_4,
                              }}
                            >
                              {ROLES.filter((r) => r.value !== 'owner').map((r) => (
                                <SelectItem
                                  key={r.value}
                                  value={r.value}
                                  className="text-[#e2e8f0] focus:bg-[rgba(199,160,8,0.15)] focus:text-[#c7a008] data-[state=checked]:text-[#c7a008]"
                                  style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', letterSpacing: '0.04em' }}
                                >
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <HudLabel>Инструмент</HudLabel>
                          <HudInput
                            placeholder="напр. Гитара, Вокал"
                            value={instrument}
                            onChange={(e) => setInstrument(e.target.value)}
                          />
                        </div>
                      </div>
                      {error && <HudError message={error} />}
                      <HudButton disabled={loading}>
                        {loading ? 'Подключение...' : 'ПРИСОЕДИНИТЬСЯ'}
                        {!loading && <ArrowRight className="h-4 w-4" />}
                      </HudButton>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>
            </HudPanel>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
