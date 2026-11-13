import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Gift, ChevronRight, Check, Share2, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/contexts/LocaleContext';
import { haptic } from '@/lib/haptics';
import { contestEndLabel, type ReferralContestStatus } from '@shared/referralContest';

/**
 * Конкурс среди пригласивших друзей: месяц Premium одному случайному участнику.
 * Статус приходит с сервера (/api/contest/referral): участвует ли пользователь, сколько участников, итог.
 */

export function useReferralContest() {
  const { data } = useQuery<{ ok: boolean; data: ReferralContestStatus }>({
    queryKey: ['/api/contest/referral'],
    staleTime: 60_000,
  });
  return data?.ok ? data.data : null;
}

function daysLeft(endsAt: string): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000));
}

function daysWord(n: number, ru: boolean): string {
  if (!ru) return n === 1 ? 'day' : 'days';
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}

/** Компактный баннер на главном — пока конкурс идёт */
export function ReferralContestBanner() {
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const [, navigate] = useLocation();
  const c = useReferralContest();
  if (!c || !c.active) return null;
  const left = daysLeft(c.endsAt);

  return (
    <button
      type="button"
      className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-[hsl(var(--solar-gold))]/35 bg-[hsl(var(--solar-gold))]/[0.07] p-4 text-left tap-scale"
      onClick={() => { haptic.impact('light'); navigate('/referral'); }}
      data-testid="banner-referral-contest"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--solar-gold))]/15">
        <Gift className="h-6 w-6 text-[hsl(var(--solar-gold))]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold leading-tight">
          {ru ? 'Разыгрываем месяц Premium' : 'Win a month of Premium'}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {c.participating
            ? (ru ? `Вы участвуете ✓ · итоги через ${left} ${daysWord(left, ru)}` : `You're in ✓ · results in ${left} ${daysWord(left, ru)}`)
            : (ru ? 'Пригласите одного друга — и вы в розыгрыше' : 'Invite one friend and you are in the draw')}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** Карточка конкурса на экране «Пригласить друзей» */
export function ReferralContestCard({ onInvite, isAdmin }: { onInvite: () => void; isAdmin?: boolean }) {
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const c = useReferralContest();
  if (!c || (!c.active && !c.drawn)) return null;
  const left = daysLeft(c.endsAt);
  const end = contestEndLabel(c.endsAt, locale);

  return (
    <Card className="mb-6 overflow-hidden border-[hsl(var(--solar-gold))]/35 p-5" data-testid="card-referral-contest">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--solar-gold))]/15">
          {c.drawn ? <Trophy className="h-6 w-6 text-[hsl(var(--solar-gold))]" /> : <Gift className="h-6 w-6 text-[hsl(var(--solar-gold))]" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">
            {ru ? 'Розыгрыш месяца Premium' : 'Premium month giveaway'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {c.drawn ? (ru ? 'Итоги подведены' : 'The draw is complete') : (ru ? `Итоги — ${end}` : `Results — ${end}`)}
          </p>
        </div>
        {c.active && (
          <Badge variant="outline" className="shrink-0 border-[hsl(var(--solar-gold))]/50 text-[hsl(var(--solar-gold))]">
            {left} {daysWord(left, ru)}
          </Badge>
        )}
      </div>

      {c.drawn ? (
        <div className="mt-4 space-y-2">
          {c.isWinner ? (
            <p className="text-sm">
              🎉 {ru
                ? `Вы победили! Premium уже включён на ${c.prizeDays} дней — спасибо, что делитесь AstroOrbi.`
                : `You won! Premium is already on for ${c.prizeDays} days — thank you for sharing AstroOrbi.`}
            </p>
          ) : (
            <p className="text-sm">
              {ru ? 'Победитель — ' : 'Winner — '}
              <span className="font-semibold text-[hsl(var(--solar-gold))]">{c.winnerName}</span>
              {ru ? `. Участников было: ${c.participants}.` : `. Participants: ${c.participants}.`}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {isAdmin ? (
            <p className="text-sm text-muted-foreground">
              {ru ? `Участников сейчас: ${c.participants}. Админы в розыгрыше не участвуют.` : `Participants: ${c.participants}. Admins are not eligible.`}
            </p>
          ) : c.participating ? (
            <p className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
              <span>
                {ru
                  ? `Вы участвуете — приглашено друзей: ${c.invited}. Участников: ${c.participants}.`
                  : `You're in — friends invited: ${c.invited}. Participants: ${c.participants}.`}
              </span>
            </p>
          ) : (
            <p className="text-sm">
              {ru
                ? 'Пригласите хотя бы одного друга по своей ссылке — и вы участвуете в розыгрыше месяца Premium.'
                : 'Invite at least one friend with your link and you are in the draw for a month of Premium.'}
            </p>
          )}
          {!isAdmin && (
            <Button className="w-full min-h-[44px]" onClick={() => { haptic.impact('medium'); onInvite(); }} data-testid="button-contest-invite">
              <Share2 className="mr-2 h-4 w-4" />
              {c.participating ? (ru ? 'Пригласить ещё друга' : 'Invite another friend') : (ru ? 'Пригласить друга' : 'Invite a friend')}
            </Button>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {ru
              ? `Победителя выберем случайно среди всех участников, шансы равные. Приглашение засчитывается, когда друг открыл AstroOrbi по вашей ссылке и прошёл регистрацию. Приз — Premium на ${c.prizeDays} дней, включается автоматически.`
              : `The winner is picked at random; everyone has an equal chance. An invite counts once your friend opens AstroOrbi with your link and completes sign-up. The prize — ${c.prizeDays} days of Premium — is switched on automatically.`}
          </p>
        </div>
      )}
    </Card>
  );
}
