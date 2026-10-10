import type { Notification, NotificationChannel, NotificationTemplate } from '../types';
import type { DomainEvent } from './events';
import { iso, type Context, type SimState } from './state';

type AnnouncedEvent = DomainEvent<'OrderCreated' | 'OrderConfirmed' | 'OrderCancelled'>;

const MESSAGES: Record<
  AnnouncedEvent['type'],
  { template: NotificationTemplate; subject: string }
> = {
  OrderCreated: { template: 'ORDER_RECEIVED', subject: 'Recebemos o seu pedido' },
  OrderConfirmed: { template: 'ORDER_CONFIRMED', subject: 'Seu pedido foi confirmado' },
  OrderCancelled: { template: 'ORDER_CANCELLED', subject: 'Seu pedido foi cancelado' },
};

/** Preference of a user who never configured anything: e-mail and push on, SMS off. */
const DEFAULT_CHANNELS: NotificationChannel[] = ['EMAIL', 'PUSH'];

const isAnnounced = (event: DomainEvent): event is AnnouncedEvent => event.type in MESSAGES;

export function onNotificationEvent(state: SimState, event: DomainEvent, ctx: Context): void {
  if (!isAnnounced(event)) return;
  const { template, subject } = MESSAGES[event.type];
  const { customerId, customerName, customerEmail } = event.payload;

  for (const channel of DEFAULT_CHANNELS) {
    const notification: Notification = {
      id: ctx.newId(),
      userId: customerId,
      orderId: event.orderId,
      channel,
      template,
      recipient: {
        name: customerName,
        email: customerEmail,
        phone: null,
        deviceToken: `device-${customerId}`,
      },
      subject,
      status: 'PENDING',
      attempts: [],
      scheduledAt: null,
      sentAt: null,
      createdAt: iso(ctx.now),
    };
    state.notifications.push(notification);
    ctx.after(400 + ctx.random() * 600, {
      kind: 'send-notification',
      notificationId: notification.id,
    });
  }
}

export function sendNotification(state: SimState, notificationId: string, ctx: Context): void {
  const notification = state.notifications.find((n) => n.id === notificationId);
  if (!notification || notification.status === 'SENT') return;

  const at = iso(ctx.now);
  const number = notification.attempts.length + 1;
  // Now and then a first push goes unanswered, so the retry of the real service has
  // something to show.
  const fails = notification.channel === 'PUSH' && number === 1 && ctx.random() < 0.15;

  if (fails) {
    notification.attempts.push({ number, at, success: false, error: 'Dispositivo não respondeu' });
    notification.status = 'RETRYING';
    ctx.after(2000 + ctx.random() * 1500, { kind: 'send-notification', notificationId });
    return;
  }
  notification.attempts.push({ number, at, success: true, error: null });
  notification.status = 'SENT';
  notification.sentAt = at;
}
